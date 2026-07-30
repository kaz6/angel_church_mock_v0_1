/* =========================================================================
   ⚠️ 過去の記録用。現行の app.js とは乖離している。

   このファイルは **2026-07-29 以前の検証を再現するためのもの**。
   冒頭の「出典（app.js 2026-07-29 時点）」は**確定値の適用前**のスナップショット（talk +4 / 夜ケア固定 -2 ＋余白ボーナス）。現行とは違う。
   ★ 最新のモデルは `tools/sim-final.mjs`。数値の検証はそちらで行うこと。
   ========================================================================= */

/* =========================================================================
   sim-rebalance.mjs — 数値整理後の再シミュレーション【検証専用】

   目的: 「勤勉が最適解になっている」状態の是正案を、段階A / 段階B に分けて検証する。
   実行:  node tools/sim-rebalance.mjs

   ★ 本体（app.js）は一切変更しない。値の差し替えは本スクリプト内だけで行う。
   ★ 前回（sim-trust-28day.mjs）のモデリング仮定を踏襲する:
       1) 1日目は固定オープニングで stats を動かさない（自由行動は2日目朝から）
       2) 7日目は夜なし（nightHold）。trust のみ加算され、angelFatigue は回復しない
       3) 夜ケアの成功度は「中」＝現行コードの固定値そのもの（係数1.0）
       4) おあずけは行わない（おあずけ係数の検証は最終節で別途行う）
       5) END_DAY は現状7だが、28日構成の検証のため28日まで回す

   出典（app.js 2026-07-29 時点）:
     statsDefault trust=0 / angelFatigue=20 / mentalMargin=10
     statsRange   trust [0,60] / angelFatigue [0,20] / mentalMargin [0,20]
     STAT_CONFIG  chores{angelFatigue -2, mentalMargin -2} / pray{mentalMargin -2}
                  talk{trust +4} / rest{mentalMargin +4}
                  nightCare{trust +2, angelFatigue -2, mentalMargin -2,
                            bonusAngelFatigue -2, bonusMentalMarginMin 14}
                  sleep{mentalMargin +4}
     FATIGUE_CONFIG eveningPrayerGain 6 / restGain 1 / eveningPrayReduce 1
                    trustReductionRate 0.009
     DAY_RULES day7 night:'none' / nightHold.stats{trust +4}
   ========================================================================= */

'use strict';

const RANGE = { angelFatigue: [0, 20], trust: [0, 60], mentalMargin: [0, 20] };
const INIT = { fatigue: 20, trust: 0, margin: 10 };
const SLEEP_MARGIN = 4;
const EVENING_PRAYER_GAIN = 6;
const REST_GAIN = 1;
const EVENING_PRAY_REDUCE = 1;
const NIGHTCARE_TRUST = 2;
const NIGHTCARE_MARGIN = -2;
const NIGHTCARE_BONUS_MARGIN_MIN = 14;

// ---- 現行値 / 段階A の設定 ----
const PRESETS = {
  現行: { trustUnlock: 54, trustRate: 0.009, talkTrust: 4, talkFatigue: 0, careBase: -2, careBonus: -2 },
  段階A: { trustUnlock: 50, trustRate: 0.01, talkTrust: 3, talkFatigue: 0, careBase: -2, careBonus: -2 },
};
const UNLOCK_MIN_DAY = 8; // 「8日目以降」条件
const DAY7_NIGHT_HOLD_TRUST = 4;

const PATTERNS = {
  balanced: { label: 'balanced', slots: ['chores', 'talk', 'pray'] },
  会話重視: { label: '会話重視 ', slots: ['talk', 'talk', 'pray'] },
  家事重視: { label: '家事重視 ', slots: ['chores', 'chores', 'pray'] },
  受け身: { label: '受け身  ', slots: ['rest', 'rest', 'rest'] },
};

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const clampAll = (s) => {
  s.fatigue = clamp(s.fatigue, RANGE.angelFatigue);
  s.trust = clamp(s.trust, RANGE.trust);
  s.margin = clamp(s.margin, RANGE.mentalMargin);
};

function makeSim(cfg) {
  const gainAfterTrust = (base, trust) =>
    Math.round(base * Math.max(0, 1 - trust * cfg.trustRate));

  const dayAction = (s, a) => {
    switch (a) {
      case 'chores': s.fatigue += -2; s.margin += -2; break;
      case 'pray': s.margin += -2; break;
      case 'talk': s.trust += cfg.talkTrust; s.fatigue += cfg.talkFatigue; break; // B-1
      case 'rest':
        s.margin += 4;
        s.fatigue += gainAfterTrust(REST_GAIN, s.trust);
        s.fatigue += cfg.restFatigue || 0; // 追加レバーC（休むにも疲労軽減）
        break;
      default: break;
    }
  };
  const eveningAction = (s, a) => {
    switch (a) {
      case 'chores': s.margin += -2; break;
      case 'pray': s.margin += -2; s.fatigue += -EVENING_PRAY_REDUCE; break;
      case 'rest': s.margin += 4; break;
      default: break; // 夕方に talk は出ない
    }
  };
  // 夜ケア1回分の疲労回復量（負値）。multiplier はおあずけ帳尻合わせ用。
  const careFatigue = (s, multiplier = 1) => {
    const bonus = s.margin >= NIGHTCARE_BONUS_MARGIN_MIN ? cfg.careBonus : 0;
    return (cfg.careBase + bonus) * multiplier;
  };

  /** @param opts { slots, day7TrustBonus, holdbackDays:Set, holdbackMultiplier:boolean } */
  function run({ slots, day7TrustBonus = DAY7_NIGHT_HOLD_TRUST, holdbackDays = new Set(), holdbackMultiplier = false, days = 28 }) {
    const s = { ...INIT };
    const trust = [], fatigue = [], careRecovery = [];
    let holdStreak = 0;

    for (let day = 1; day <= days; day++) {
      if (day === 1) { trust.push(s.trust); fatigue.push(s.fatigue); careRecovery.push(0); continue; }

      dayAction(s, slots[0]); clampAll(s);
      dayAction(s, slots[1]); clampAll(s);
      s.fatigue += gainAfterTrust(EVENING_PRAYER_GAIN, s.trust); clampAll(s);
      eveningAction(s, slots[2]); clampAll(s);

      let rec = 0;
      if (day === 7) {
        // 夜なし（告白の日）。trust のみ。疲労は回復しない。おあずけ連続カウントには算入しない
        s.trust += day7TrustBonus; clampAll(s);
      } else if (holdbackDays.has(day)) {
        holdStreak += 1; // おあずけ：回復なし・trust +2 なし・margin -2 なし
      } else {
        const mult = holdbackMultiplier ? holdStreak + 1 : 1;
        const before = s.fatigue;
        s.fatigue += careFatigue(s, mult);
        s.trust += NIGHTCARE_TRUST;
        s.margin += NIGHTCARE_MARGIN;
        clampAll(s);
        rec = before - s.fatigue; // 実際に減った量（clamp後）
        holdStreak = 0;
      }

      s.margin += SLEEP_MARGIN; clampAll(s);
      trust.push(s.trust); fatigue.push(s.fatigue); careRecovery.push(rec);
    }
    return { trust, fatigue, careRecovery, final: { ...s } };
  }

  return { run, cfg };
}

const firstDay = (arr, pred) => { const i = arr.findIndex(pred); return i === -1 ? null : i + 1; };
const unlockDay = (trustTrace, threshold) => {
  const hit = firstDay(trustTrace, (v) => v >= threshold);
  return hit === null ? null : Math.max(hit, UNLOCK_MIN_DAY);
};
const pad = (v, n = 2) => String(v ?? '—').padStart(n);

function report(title, cfg, { withoutDay7 = false } = {}) {
  const sim = makeSim(cfg);
  console.log('');
  console.log(`■ ${title}  [閾値${cfg.trustUnlock} / 係数${cfg.trustRate} / talk trust+${cfg.talkTrust}` +
    `${cfg.talkFatigue ? ` 疲労${cfg.talkFatigue}` : ''} / 夜ケア${cfg.careBase}〜${cfg.careBase + cfg.careBonus}]`);
  console.log('  パターン    解禁日  疲労≤2  疲労=0  28日目');
  const out = {};
  for (const [key, p] of Object.entries(PATTERNS)) {
    const r = sim.run({ slots: p.slots });
    const u = unlockDay(r.trust, cfg.trustUnlock);
    const f2 = firstDay(r.fatigue, (v) => v <= 2);
    const f0 = firstDay(r.fatigue, (v) => v === 0);
    out[key] = { u, f2, f0, last: r.fatigue[27], trust: r.trust, fatigue: r.fatigue };
    console.log(`  ${p.label}   ${pad(u)}日   ${pad(f2)}日   ${pad(f0)}日   ${pad(r.fatigue[27])}`);
  }
  if (withoutDay7) {
    console.log('  --- 7日目 +4 を 0 にした場合の解禁日 ---');
    for (const [key, p] of Object.entries(PATTERNS)) {
      const r = sim.run({ slots: p.slots, day7TrustBonus: 0 });
      const u = unlockDay(r.trust, cfg.trustUnlock);
      console.log(`  ${p.label}   ${pad(u)}日  ${u === null ? '★未到達' : ''}`);
    }
  }
  return out;
}

console.log('='.repeat(80));
console.log('数値整理後の再シミュレーション（本体コードは未変更・すべてスクリプト内で差し替え）');
console.log('='.repeat(80));

// ---- 参考：現行値 ----
report('参考：現行値', PRESETS.現行, { withoutDay7: true });

// ---- 段階A ----
const A = report('段階A：数値の整理のみ（新しい基準線）', PRESETS.段階A, { withoutDay7: true });

// ---- 段階B：候補値のグリッド ----
console.log('');
console.log('='.repeat(80));
console.log('段階B：A ＋ 新機構（B-1 会話の疲労軽減 / B-2 夜ケアの回復量）');
console.log('='.repeat(80));
console.log('目標: balanced 解禁10〜13 かつ 疲労≤2 が14〜16 / 会話重視・受け身は疲労が28日以内に抜ける');
console.log('      （会話重視は できれば15日目まで）');

const B1_OPTIONS = [0, -1, -2];      // 会話の疲労軽減
const B2_OPTIONS = [-2, -3, -4];     // 夜ケアの base（bonus -2 は据え置き → 表示は base〜base-2）

const goalCheck = (o) => {
  const g = [];
  g.push(o.balanced.u !== null && o.balanced.u >= 10 && o.balanced.u <= 13);
  g.push(o.balanced.f2 !== null && o.balanced.f2 >= 14 && o.balanced.f2 <= 16);
  g.push(o.会話重視.f2 !== null);
  g.push(o.家事重視.u !== null && o.家事重視.f2 !== null);
  g.push(o.受け身.f2 !== null);
  return { ok: g.every(Boolean), flags: g };
};

const rows = [];
for (const b1 of B1_OPTIONS) {
  for (const b2 of B2_OPTIONS) {
    const cfg = { ...PRESETS.段階A, talkFatigue: b1, careBase: b2 };
    const sim = makeSim(cfg);
    const o = {};
    for (const [key, p] of Object.entries(PATTERNS)) {
      const r = sim.run({ slots: p.slots });
      o[key] = {
        u: unlockDay(r.trust, cfg.trustUnlock),
        f2: firstDay(r.fatigue, (v) => v <= 2),
        last: r.fatigue[27],
      };
    }
    const { ok } = goalCheck(o);
    rows.push({ b1, b2, o, ok });
  }
}

console.log('');
console.log('  会話疲労 夜ケア回復 | balanced解禁 balanced疲労 | 会話重視疲労 | 家事重視解禁/疲労 | 受け身疲労 | 目標');
console.log('  ' + '-'.repeat(94));
for (const r of rows) {
  const label = `  ${pad(r.b1)}      ${r.b2}〜${r.b2 - 2}   `;
  console.log(
    `${label}|   ${pad(r.o.balanced.u)}日      ${pad(r.o.balanced.f2)}日     ` +
    `|   ${pad(r.o.会話重視.f2)}日(28日目${pad(r.o.会話重視.last)}) ` +
    `|  ${pad(r.o.家事重視.u)}日/${pad(r.o.家事重視.f2)}日   ` +
    `|  ${pad(r.o.受け身.f2)}日(${pad(r.o.受け身.last)})  | ${r.ok ? '★満たす' : '×'}`
  );
}

const hits = rows.filter((r) => r.ok);
console.log('');
if (hits.length === 0) {
  console.log('  → 目標を満たす組み合わせ: なし');
} else {
  console.log(`  → 目標を満たす組み合わせ: ${hits.length}件`);
  for (const h of hits) {
    console.log(`     会話の疲労軽減 ${h.b1} ／ 夜ケア ${h.b2}〜${h.b2 - 2}` +
      `  （balanced 解禁${h.o.balanced.u}日・疲労${h.o.balanced.f2}日 / 会話重視 疲労${h.o.会話重視.f2}日 / 受け身 疲労${h.o.受け身.f2}日）`);
  }
}

// ---- 追加探索：なぜ満たせないのか＋レバーCの検討 ----
console.log('');
console.log('='.repeat(80));
console.log('追加探索：候補外まで広げて、目標を満たす組み合わせを探す');
console.log('='.repeat(80));
console.log('※ ★重要：B-1（会話の疲労軽減）は「受け身」には一切効かない（受け身は talk を選ばない）。');
console.log('   受け身の疲労を抜くレバーは B-2（夜ケア）か、レバーC（休むにも疲労軽減）しかない。');

const search = [];
for (const b1 of [0, -1, -2]) {
  for (const b2 of [-2, -3, -4, -5, -6]) {
    for (const c of [0, -1, -2]) {
      const cfg = { ...PRESETS.段階A, talkFatigue: b1, careBase: b2, restFatigue: c };
      const sim = makeSim(cfg);
      const o = {};
      for (const [key, p] of Object.entries(PATTERNS)) {
        const r = sim.run({ slots: p.slots });
        o[key] = { u: unlockDay(r.trust, cfg.trustUnlock), f2: firstDay(r.fatigue, (v) => v <= 2), last: r.fatigue[27] };
      }
      const { ok } = goalCheck(o);
      search.push({ b1, b2, c, o, ok });
    }
  }
}
const found = search.filter((r) => r.ok);
console.log('');
if (found.length === 0) {
  console.log('  → 広げても目標を満たす組み合わせ: なし');
} else {
  console.log(`  → 目標を満たす組み合わせ: ${found.length}件`);
  console.log('  会話疲労 夜ケア回復 休む疲労 | balanced解禁/疲労 | 会話重視疲労 | 家事重視解禁/疲労 | 受け身疲労');
  console.log('  ' + '-'.repeat(92));
  for (const h of found) {
    console.log(`  ${pad(h.b1)}      ${h.b2}〜${h.b2 - 2}   ${pad(h.c)}    ` +
      `|   ${pad(h.o.balanced.u)}日/${pad(h.o.balanced.f2)}日    ` +
      `|   ${pad(h.o.会話重視.f2)}日     ` +
      `|  ${pad(h.o.家事重視.u)}日/${pad(h.o.家事重視.f2)}日   ` +
      `|  ${pad(h.o.受け身.f2)}日`);
  }
}

// 受け身が抜けるための最低条件を単独で調べる
console.log('');
console.log('  ● 受け身の疲労が28日以内に抜ける最低ライン（他パターンを問わず）');
for (const c of [0, -1, -2]) {
  const line = [];
  for (const b2 of [-2, -3, -4, -5, -6]) {
    const cfg = { ...PRESETS.段階A, careBase: b2, restFatigue: c };
    const r = makeSim(cfg).run({ slots: PATTERNS.受け身.slots });
    const f2 = firstDay(r.fatigue, (v) => v <= 2);
    line.push(`夜ケア${b2}:${f2 === null ? '×(' + r.fatigue[27] + ')' : f2 + '日'}`);
  }
  console.log(`    休むの疲労軽減 ${pad(c)} → ${line.join(' / ')}`);
}

// ---- おあずけ係数の等価性検証 ----
console.log('');
console.log('='.repeat(80));
console.log('おあずけ係数の検証（翌日の夜ケアに「おあずけ日数×1＋1」倍をかける）');
console.log('='.repeat(80));
console.log('比較: 同じ日数の窓で、通常どおり毎晩ケアした場合と、n日おあずけ→翌晩に(n+1)倍した場合');
{
  const cfg = { ...PRESETS.段階A };
  const sim = makeSim(cfg);
  const slots = PATTERNS.balanced.slots;
  const WINDOW_START = 9; // 7日目の夜なしを避け、状態が安定する後半で比較

  const runWindow = (holdDays) => {
    const hold = new Set();
    for (let i = 0; i < holdDays; i++) hold.add(WINDOW_START + i);
    return sim.run({ slots, holdbackDays: hold, holdbackMultiplier: true, days: WINDOW_START + holdDays });
  };

  console.log('');
  console.log('  おあずけ日数 | 窓の最終日 | 疲労(窓の終わり) | 窓内の合計回復量 | trust(窓の終わり)');
  console.log('  ' + '-'.repeat(76));
  const base = runWindow(0);
  for (let n = 0; n <= 3; n++) {
    const r = runWindow(n);
    const endDay = WINDOW_START + n;
    const sumRec = r.careRecovery.slice(WINDOW_START - 1).reduce((a, b) => a + b, 0);
    console.log(`       ${n}日     |   ${pad(endDay)}日目   |       ${pad(r.fatigue[endDay - 1])}       |` +
      `        ${pad(sumRec)}        |     ${pad(r.trust[endDay - 1])}`);
  }

  // 境界条件1：疲労が低い時期（clamp で回復が無駄にならないか）
  console.log('');
  console.log('  ● 境界条件1：疲労が低い時期に窓を置いた場合（clamp による取りこぼし）');
  console.log('    晩数 | 通常の合計回復 | おあずけ＋倍率 | 差 | 窓開始時の疲労');
  console.log('    ' + '-'.repeat(66));
  for (const start of [16, 20]) {
    for (let n = 1; n <= 3; n++) {
      const hold = new Set();
      for (let i = 0; i < n; i++) hold.add(start + i);
      const held = sim.run({ slots, holdbackDays: hold, holdbackMultiplier: true, days: start + n });
      const normal = sim.run({ slots, days: start + n });
      const sumH = held.careRecovery.slice(start - 1).reduce((a, b) => a + b, 0);
      const sumN = normal.careRecovery.slice(start - 1).reduce((a, b) => a + b, 0);
      console.log(`     ${n + 1}晩 |       ${pad(sumN)}       |       ${pad(sumH)}      | ${pad(sumH - sumN)} |   ${pad(normal.fatigue[start - 2])}（${start}日目開始）`);
    }
  }

  // 境界条件2：余白ボーナスの閾値付近（おあずけは margin -2 を払わない）
  console.log('');
  console.log('  ● 境界条件2：余白ボーナス（margin>=14 で追加-2）の扱い');
  console.log('    おあずけの夜は margin -2 を払わないため、余白が閾値付近だと');
  console.log('    おあずけ側だけボーナスが乗り continue して有利になりうる。受け身（余白20固定）で確認:');
  {
    const slotsP = PATTERNS.受け身.slots;
    for (let n = 1; n <= 3; n++) {
      const hold = new Set();
      for (let i = 0; i < n; i++) hold.add(9 + i);
      const held = sim.run({ slots: slotsP, holdbackDays: hold, holdbackMultiplier: true, days: 9 + n });
      const normal = sim.run({ slots: slotsP, days: 9 + n });
      const sumH = held.careRecovery.slice(8).reduce((a, b) => a + b, 0);
      const sumN = normal.careRecovery.slice(8).reduce((a, b) => a + b, 0);
      console.log(`     ${n + 1}晩 | 通常 ${pad(sumN)} / おあずけ ${pad(sumH)} / 差 ${pad(sumH - sumN)}`);
    }
  }

  console.log('');
  console.log('  ★同じ「晩数」で揃えた比較（n日おあずけ＋1晩 vs 通常(n+1)晩）:');
  console.log('  晩数 | 通常の合計回復 | おあずけ＋倍率の合計回復 | 差 | trust差');
  console.log('  ' + '-'.repeat(70));
  for (let n = 1; n <= 3; n++) {
    const nights = n + 1;
    const normal = sim.run({ slots, days: WINDOW_START + n });
    const held = runWindow(n);
    const sumNormal = normal.careRecovery.slice(WINDOW_START - 1).reduce((a, b) => a + b, 0);
    const sumHeld = held.careRecovery.slice(WINDOW_START - 1).reduce((a, b) => a + b, 0);
    const tN = normal.trust[WINDOW_START + n - 1];
    const tH = held.trust[WINDOW_START + n - 1];
    console.log(`   ${nights}晩 |      ${pad(sumNormal)}      |           ${pad(sumHeld)}           | ${pad(sumHeld - sumNormal)} |   ${pad(tH - tN)}`);
  }
}
console.log('');

// ---- 対案の数値（A/B提示用） ----
console.log('='.repeat(80));
console.log('対案の数値（A/B提示用）');
console.log('='.repeat(80));
for (const [name, over] of Object.entries({
  '案1: 休むに疲労軽減 -2（B-1なし・夜ケア現行）': { talkFatigue: 0, careBase: -2, restFatigue: -2 },
  '案2: 案1＋会話にも疲労軽減 -1':                 { talkFatigue: -1, careBase: -2, restFatigue: -2 },
})) {
  const cfg = { ...PRESETS.段階A, ...over };
  const sim = makeSim(cfg);
  console.log('');
  console.log(`■ ${name}`);
  console.log('  パターン    解禁日  疲労≤2  疲労=0  28日目');
  for (const [key, p] of Object.entries(PATTERNS)) {
    const r = sim.run({ slots: p.slots });
    console.log(`  ${p.label}   ${pad(unlockDay(r.trust, cfg.trustUnlock))}日   ` +
      `${pad(firstDay(r.fatigue, (v) => v <= 2))}日   ${pad(firstDay(r.fatigue, (v) => v === 0))}日   ${pad(r.fatigue[27])}`);
  }
}
console.log('');
