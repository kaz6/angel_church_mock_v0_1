/* =========================================================================
   ⚠️ 過去の記録用。現行の app.js とは乖離している。

   このファイルは **2026-07-29 以前の検証を再現するためのもの**。
   回復レンジの探索段階のもの。**確定は「段階5／2〜6」**で、7日目 nightHold の trust も +4 → +5 に変わった。
   ★ 最新のモデルは `tools/sim-final.mjs`。数値の検証はそちらで行うこと。
   ========================================================================= */

/* =========================================================================
   sim-margin-care.mjs — 余白 → 夜ケアの成果（逓減）のシミュレーション【検証専用】

   目的: 「昼の心身の余白 → 夜の精力 → 耐えた量 ＝ angelFatigue の回復量」
         という仕様上の経路をシミュに入れ、どの単一戦略も突出しない形を探す。
   実行:  node tools/sim-margin-care.mjs

   ★ 本体（app.js）は一切変更しない。値の差し替えはすべて本スクリプト内。
   ★ 「休む」に angelFatigue の直接軽減は入れない（レバーCは却下済み）。
      休むが効くのは「余白が増える → 夜ケアの回復量が上がる」経路だけ。

   基準線（段階A・前回の検証で確定）:
     おあずけ解禁の信頼閾値 50 / 疲労軽減の係数 1 - trust*0.01 / talk の信頼 +3
     7日目 nightHold の trust +4

   モデリング仮定（前回踏襲。変更点は夜ケアの成果のみ）:
     1) 1日目は固定オープニングで stats を動かさない（自由行動は2日目朝から）
     2) 7日目は夜なし（nightHold）。trust のみ加算、angelFatigue は回復しない
     3) おあずけは行わない
     4) END_DAY は現状7だが28日まで回す
   ★ 今回変わる点:
     5) 夜ケアの回復量を「成功度 中 固定」から「その夜の余白から導出」へ。
        これに伴い、現行の「余白>=14 で追加 -2」ボーナスは**この式に吸収**して廃止する
        （二重取りを避けるため）。
     6) 夜ケアが余白を -2 消費する点は現行のまま据え置く（仕様の「余白を精力に変換」に相当）。
   ========================================================================= */

'use strict';

const RANGE = { angelFatigue: [0, 20], trust: [0, 60], mentalMargin: [0, 20] };
const INIT = { fatigue: 20, trust: 0, margin: 10, pray: 0, care: 0 };
const MARGIN_MAX = RANGE.mentalMargin[1];
const SLEEP_MARGIN = 4;
const EVENING_PRAYER_GAIN = 6;
const REST_GAIN = 1;
const EVENING_PRAY_REDUCE = 1;
const NIGHTCARE_TRUST = 2;
const NIGHTCARE_MARGIN_COST = -2;

// 段階A（基準線）
const BASE = { trustUnlock: 50, trustRate: 0.01, talkTrust: 3 };
const UNLOCK_MIN_DAY = 8;
const DAY7_TRUST = 4;

const PATTERNS = {
  balanced: { label: 'balanced  ', slots: ['chores', 'talk', 'pray'], kind: '混合' },
  会話重視: { label: '会話重視  ', slots: ['talk', 'talk', 'pray'], kind: '単一' },
  家事重視: { label: '家事重視  ', slots: ['chores', 'chores', 'pray'], kind: '単一' },
  受け身: { label: '受け身    ', slots: ['rest', 'rest', 'rest'], kind: '単一' },
  休息重視: { label: '休息重視  ', slots: ['rest', 'talk', 'pray'], kind: '混合' },
  休息家事: { label: '休息＋家事', slots: ['rest', 'chores', 'pray'], kind: '混合' },
};

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

/* ---- 余白 → 夜ケアの回復量（負値を返す） ----
   いずれも「余白0で min、余白20で max」。逓減の付き方だけが違う。 */
const CARE_MODELS = {
  線形: (margin, min, max) => -Math.round(min + (max - min) * (margin / MARGIN_MAX)),
  平方根: (margin, min, max) => -Math.round(min + (max - min) * Math.sqrt(margin / MARGIN_MAX)),
  段階制: (margin, min, max) => {
    const mid = (min + max) / 2;
    if (margin <= 5) return -Math.round(min);      // 0–5   小
    if (margin <= 12) return -Math.round(mid);     // 6–12  中
    return -Math.round(max);                       // 13–20 大
  },
};

function makeSim(cfg) {
  const gainAfterTrust = (base, trust) =>
    Math.round(base * Math.max(0, 1 - trust * cfg.trustRate));

  // ★エンディングのゲートに使う値も追跡する（app.js の STAT_CONFIG より）
  //   chores: caretakerAptitude +4 / pray: prayerTuning +4（疲労<=6 で +2）
  //   eveningChores: caretakerAptitude +2 / eveningPray: prayerTuning +6（疲労<=6 で +2）
  const PRAY_BONUS = 2, PRAY_BONUS_FATIGUE_MAX = 6;
  const dayAction = (s, a) => {
    switch (a) {
      case 'chores': s.fatigue += -2; s.margin += -2; s.care += 4; break;
      case 'pray':
        s.margin += -2;
        s.pray += 4 + (s.fatigue <= PRAY_BONUS_FATIGUE_MAX ? PRAY_BONUS : 0);
        break;
      case 'talk': s.trust += cfg.talkTrust; s.fatigue += cfg.talkFatigue; break;
      case 'rest': s.margin += 4; s.fatigue += gainAfterTrust(REST_GAIN, s.trust); break;
      default: break;
    }
  };
  const eveningAction = (s, a) => {
    switch (a) {
      case 'chores': s.margin += -2; s.care += 2; break;
      case 'pray':
        s.margin += -2;
        s.fatigue += -EVENING_PRAY_REDUCE;
        s.pray += 6 + (s.fatigue <= PRAY_BONUS_FATIGUE_MAX ? PRAY_BONUS : 0);
        break;
      case 'rest': s.margin += 4; break;
      default: break;
    }
  };
  const clampAll = (s) => {
    s.fatigue = clamp(s.fatigue, RANGE.angelFatigue);
    s.trust = clamp(s.trust, RANGE.trust);
    s.margin = clamp(s.margin, RANGE.mentalMargin);
    s.pray = clamp(s.pray, [0, 60]);
    s.care = clamp(s.care, [0, 60]);
  };

  function run({ slots, day7Trust = DAY7_TRUST, days = 28 }) {
    const s = { ...INIT };
    const trust = [], fatigue = [], margin = [], careAmt = [], prayT = [], careT = [];

    for (let day = 1; day <= days; day++) {
      if (day === 1) { trust.push(s.trust); fatigue.push(s.fatigue); margin.push(s.margin); careAmt.push(0); prayT.push(s.pray); careT.push(s.care); continue; }

      dayAction(s, slots[0]); clampAll(s);
      dayAction(s, slots[1]); clampAll(s);
      s.fatigue += gainAfterTrust(EVENING_PRAYER_GAIN, s.trust); clampAll(s);
      eveningAction(s, slots[2]); clampAll(s);

      let amt = 0;
      if (day === 7) {
        s.trust += day7Trust; clampAll(s);           // 夜なし（告白の日）
      } else {
        // ★その夜の余白から回復量を導出する
        amt = cfg.careModel(s.margin, cfg.careMin, cfg.careMax);
        s.fatigue += amt;
        s.trust += NIGHTCARE_TRUST;
        s.margin += NIGHTCARE_MARGIN_COST;
        clampAll(s);
      }

      s.margin += SLEEP_MARGIN; clampAll(s);
      trust.push(s.trust); fatigue.push(s.fatigue); margin.push(s.margin); careAmt.push(amt); prayT.push(s.pray); careT.push(s.care);
    }
    return { trust, fatigue, margin, careAmt, prayT, careT, endStats: { pray: s.pray, care: s.care } };
  }
  return { run };
}

const firstDay = (arr, pred) => { const i = arr.findIndex(pred); return i === -1 ? null : i + 1; };
const unlockDay = (t, th) => { const h = firstDay(t, (v) => v >= th); return h === null ? null : Math.max(h, UNLOCK_MIN_DAY); };
const pad = (v, n = 2) => String(v ?? '—').padStart(n);

/* ---- 目標判定 ---- */
function goals(o) {
  return {
    balanced解禁: o.balanced.u !== null && o.balanced.u >= 10 && o.balanced.u <= 13,
    balanced疲労: o.balanced.f2 !== null && o.balanced.f2 >= 12 && o.balanced.f2 <= 16,
    会話重視疲労: o.会話重視.f2 !== null,
    家事重視: o.家事重視.u !== null && o.家事重視.f2 !== null,
    受け身疲労: o.受け身.f2 !== null,
    休息重視疲労: o.休息重視.f2 !== null,
  };
}

/* ---- マイルドさの判定：どの単一戦略も突出していないか ----
   単一戦略（会話だけ／家事だけ／休むだけ）が、混合戦略すべてに対して
   「疲労着地」と「信頼解禁」の両方で優位（以上）なら "突出" とみなす。 */
function dominance(o) {
  // 4軸で比較する：疲労着地（早い方が良い）／信頼解禁（早い方が良い）／
  //                祈りの調律（高い方が良い）／世話役適性（高い方が良い）
  // ★エンディングのゲートを含めないと「休むが得なだけ」に見えてしまうため。
  const lo = (x, k) => (x[k] === null ? 99 : x[k]);
  const keys = Object.keys(o);
  const atLeastAsGood = (a, b) =>
    lo(a, 'f2') <= lo(b, 'f2') && lo(a, 'u') <= lo(b, 'u') &&
    lo(a, 'prayDay') <= lo(b, 'prayDay') && lo(a, 'careDay') <= lo(b, 'careDay');
  const strictlyBetter = (a, b) =>
    lo(a, 'f2') < lo(b, 'f2') || lo(a, 'u') < lo(b, 'u') ||
    lo(a, 'prayDay') < lo(b, 'prayDay') || lo(a, 'careDay') < lo(b, 'careDay');
  // 他のすべてを支配するパターン（＝突出）
  const dominating = keys.filter((k) =>
    keys.filter((m) => m !== k).every((m) => atLeastAsGood(o[k], o[m]) && strictlyBetter(o[k], o[m])));
  // 支配されているパターン（＝選ぶ意味がない）
  const dominated = keys.filter((k) =>
    keys.some((m) => m !== k && atLeastAsGood(o[m], o[k]) && strictlyBetter(o[m], o[k])));
  const f2s = keys.map((k) => lo(o[k], 'f2')).filter((v) => v !== 99);
  const spread = f2s.length ? Math.max(...f2s) - Math.min(...f2s) : null;
  return { dominating, dominated, spread };
}

function evaluate(cfg) {
  const sim = makeSim(cfg);
  const o = {};
  for (const [k, p] of Object.entries(PATTERNS)) {
    const r = sim.run({ slots: p.slots });
    o[k] = {
      u: unlockDay(r.trust, cfg.trustUnlock),
      f2: firstDay(r.fatigue, (v) => v <= 2),
      last: r.fatigue[27],
      avgMargin: Math.round(r.margin.slice(1).reduce((a, b) => a + b, 0) / 27),
      prayDay: firstDay(r.prayT, (v) => v >= 48),
      careDay: firstDay(r.careT, (v) => v >= 48),
      pray: r.endStats.pray,
      caretaker: r.endStats.care,
      avgCare: (r.careAmt.slice(1).filter((v) => v !== 0).reduce((a, b) => a + b, 0) /
        Math.max(1, r.careAmt.slice(1).filter((v) => v !== 0).length)).toFixed(1),
    };
  }
  const g = goals(o);
  const d = dominance(o);
  return { o, g, ok: Object.values(g).every(Boolean), d };
}

function printCase(title, cfg) {
  const { o, g, ok, d } = evaluate(cfg);
  console.log('');
  console.log(`■ ${title}`);
  console.log('  パターン     解禁日  疲労≤2  28日目  平均余白  平均回復  祈り48到達  世話役48到達');
  for (const [k, p] of Object.entries(PATTERNS)) {
    const x = o[k];
    console.log(`  ${p.label}   ${pad(x.u)}日   ${pad(x.f2)}日    ${pad(x.last)}      ${pad(x.avgMargin)}      ${String(x.avgCare).padStart(5)}     ${pad(x.prayDay)}日        ${pad(x.careDay)}日`);
  }
  const ng = Object.entries(g).filter(([, v]) => !v).map(([k]) => k);
  console.log(`  → 目標: ${ok ? '★すべて満たす' : '×（未達: ' + ng.join(' / ') + '）'}`);
  console.log(`  → マイルドさ: 全軸で突出したパターン = ${d.dominating.length ? d.dominating.join(', ') : 'なし'}` +
    ` / 支配されて選ぶ意味がないパターン = ${d.dominated.length ? d.dominated.join(', ') : 'なし'}` +
    ` / 疲労着地の幅 = ${d.spread ?? '—'}日`);
  return { ok, d };
}

console.log('='.repeat(84));
console.log('余白 → 夜ケアの成果（逓減）のシミュレーション');
console.log('本体コードは未変更。段階A（閾値50 / 係数0.01 / talk信頼+3）を基準線とする');
console.log('='.repeat(84));

// ---- 比較用の基準線：現行（余白と無関係・成功度 中 固定） ----
{
  const cfg = { ...BASE, talkFatigue: 0, careMin: 2, careMax: 4, careModel: (m, min, max) => (m >= 14 ? -max : -min) };
  printCase('参考：現行モデル（余白と無関係。余白>=14 で -4、それ以外 -2）', cfg);
}

// ---- 候補式 × レンジ ----
const RANGES = [[2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [3, 8], [1, 5]];
const results = [];
for (const [name, model] of Object.entries(CARE_MODELS)) {
  for (const [min, max] of RANGES) {
    for (const talkFatigue of [0, -1]) {
      const cfg = { ...BASE, talkFatigue, careMin: min, careMax: max, careModel: model };
      const r = evaluate(cfg);
      results.push({ name, min, max, talkFatigue, ...r });
    }
  }
}

console.log('');
console.log('='.repeat(84));
console.log('候補式 × 回復レンジ × 会話の疲労軽減');
console.log('='.repeat(84));
console.log('  式      レンジ  会話疲労 | balanced 解禁/疲労 | 会話 | 家事 | 受け身 | 休息 | 休息家事 | 目標 | 突出');
console.log('  ' + '-'.repeat(104));
for (const r of results) {
  const o = r.o;
  console.log(
    `  ${r.name.padEnd(4)}  ${r.min}〜${r.max}    ${pad(r.talkFatigue)}   ` +
    `|   ${pad(o.balanced.u)}日/${pad(o.balanced.f2)}日   ` +
    `| ${pad(o.会話重視.f2)}日 | ${pad(o.家事重視.f2)}日 |  ${pad(o.受け身.f2)}日  | ${pad(o.休息重視.f2)}日 |  ${pad(o.休息家事.f2)}日   ` +
    `| ${r.ok ? '★' : '×'}  | ${r.d.dominating.length ? r.d.dominating.join(',') : 'なし'}`
  );
}

const hits = results.filter((r) => r.ok);
console.log('');
if (hits.length === 0) {
  console.log('→ 目標をすべて満たす組み合わせ: なし');
} else {
  console.log(`→ 目標をすべて満たす組み合わせ: ${hits.length}件`);
  // 突出なし かつ 幅が小さい順
  const ranked = [...hits].sort((a, b) =>
    (a.d.dominating.length - b.d.dominating.length) || (a.d.spread - b.d.spread));
  for (const h of ranked) {
    console.log(`   ${h.name} ${h.min}〜${h.max} / 会話疲労${h.talkFatigue}` +
      `  突出=${h.d.dominating.length ? h.d.dominating.join(',') : 'なし'} 幅=${h.d.spread}日`);
  }
}

// ---- 上位候補の詳細 ----
console.log('');
console.log('='.repeat(84));
console.log('上位候補の詳細');
console.log('='.repeat(84));
{
  const ranked = [...results].filter((r) => r.ok)
    .sort((a, b) => (a.d.dominating.length - b.d.dominating.length) || (a.d.spread - b.d.spread));
  for (const h of ranked.slice(0, 3)) {
    printCase(`${h.name} / 回復 ${h.min}〜${h.max} / 会話の疲労軽減 ${h.talkFatigue}`,
      { ...BASE, talkFatigue: h.talkFatigue, careMin: h.min, careMax: h.max, careModel: CARE_MODELS[h.name] });
  }
}

// ---- 余白と回復量の対応表（暗算しやすさの確認） ----
console.log('');
console.log('='.repeat(84));
console.log('余白 → 回復量の対応（レンジ 2〜5 の場合）');
console.log('='.repeat(84));
console.log('  余白 :  0  2  4  6  8 10 12 14 16 18 20');
for (const [name, model] of Object.entries(CARE_MODELS)) {
  const row = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((m) => pad(model(m, 2, 5))).join(' ');
  console.log(`  ${name.padEnd(4)} : ${row}`);
}
console.log('');

// ---- 受け身が抜けるために必要な最大回復量の走査 ----
console.log('='.repeat(84));
console.log('走査：受け身（朝昼夕すべて休む）が28日以内に疲労を抜くのに必要な回復量');
console.log('='.repeat(84));
console.log('  ※ 受け身は余白20で飽和するため、どの式でも「最大値」がそのまま適用される');
console.log('  最大回復 |  線形  平方根  段階制   ← 受け身の疲労≤2 到達日（×は未到達・括弧は28日目の値）');
for (const max of [4, 5, 6, 7, 8, 9, 10]) {
  const cells = Object.entries(CARE_MODELS).map(([name, model]) => {
    const cfg = { ...BASE, talkFatigue: 0, careMin: 2, careMax: max, careModel: model };
    const r = makeSim(cfg).run({ slots: PATTERNS.受け身.slots });
    const f2 = firstDay(r.fatigue, (v) => v <= 2);
    return (f2 === null ? `×(${r.fatigue[27]})` : `${f2}日`).padStart(6);
  });
  console.log(`     ${String(max).padStart(2)}    | ${cells.join('  ')}`);
}

// ---- 受け身が抜ける水準にしたとき、他パターンがどうなるか ----
console.log('');
console.log('='.repeat(84));
console.log('受け身が抜ける水準（最大回復を上げた場合）の全体像');
console.log('='.repeat(84));
for (const max of [8, 9, 10]) {
  for (const name of ['平方根', '段階制']) {
    printCase(`${name} / 回復 2〜${max} / 会話の疲労軽減 0`,
      { ...BASE, talkFatigue: 0, careMin: 2, careMax: max, careModel: CARE_MODELS[name] });
  }
}
console.log('');
