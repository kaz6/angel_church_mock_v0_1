/* =========================================================================
   sim-255.mjs — 255スケール移行とゲートの着地調整【検証専用】

   実行:  node tools/sim-255.mjs

   ★ 本体（app.js）は一切変更しない。値の差し替えはすべて本スクリプト内。
   ★ 「休む」に angelFatigue の直接軽減は入れない（レバーCは却下済み）。

   確定済みで据え置くもの（2026-07-29 の最終確定・app.js に適用済み）:
     angelFatigue [0,20] 初期20 / eveningPrayerGain 6 / 「休む」の疲労加算なし
     心身の余白 [0,20] 初期10 / 夜ケアの回復は余白から導出（段階5・2〜6）
     夜ケアの余白消費 -2 / 就寝の余白回復 +4

   今回の対象:
     信頼 / 祈りの調律 / 世話役適性 の上限を 60 → 255 にし、
     祈りの調律・世話役適性のゲート到達を 24〜28日目に着地させる形を探す。

   モデリング仮定（前タスクまでを踏襲。実機と全7日一致を確認済み）:
     1) 1日目は固定オープニングで stats を動かさない（自由行動は2日目朝から）
     2) 7日目は夜なし（nightHold）。trust のみ加算、angelFatigue は回復しない
     3) ★21日目も夜なし（葬儀）。stats を宣言していないので trust も動かない
     4) 14日目は night:'force'（現状は実行時の効果なし）
     5) 28日目の夜を終えた時点で終了
   ========================================================================= */

'use strict';

const MAX = 255;                  // 信頼 / 祈りの調律 / 世話役適性 の上限
const FAT = [0, 20];              // angelFatigue（据え置き）
const MRG = [0, 20];              // 心身の余白（据え置き）
const MRG_MAX = MRG[1];

const EVENING_PRAYER_GAIN = 6;    // 天使様の日課（据え置き）
const EVENING_PRAY_REDUCE = 1;    // 夕方に祈ると日課を少し相殺（据え置き）
const SLEEP_MARGIN = 4;
const NIGHTCARE_MARGIN = -2;
const CHORES_FATIGUE = -2;
const REST_MARGIN = 4;
const DAYS = 28;

// 夜ケアの疲労回復（段階5・2〜6。app.js の nightCareFatigueRecovery と同一）
function careRecovery(margin) {
  const band = Math.min(4, Math.floor(margin / 4));
  return -Math.round(2 + (4 * band) / 4);
}

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const clamp255 = (v) => Math.min(MAX, Math.max(0, v));

/* ---- 伸び方の形（スコア系だけに掛ける） ----
   flat   … 常に同じだけ伸びる（現行と同じ形）
   逓減   … 値が高いほど鈍る。1 - v/MAX を掛ける（下限 floorRate で止める）
   平方根 … 1 - sqrt(v/MAX)。序盤の鈍りが緩く、終盤で強く効く */
const SHAPES = {
  flat: () => 1,
  逓減: (v, floorRate) => Math.max(floorRate, 1 - v / MAX),
  平方根: (v, floorRate) => Math.max(floorRate, 1 - Math.sqrt(v / MAX)),
};

/* ---- 余白の制約（★2026-07-29 の決定。未実装） ----
   低い  … 天使様が止めて休ませる。行動は消費されない（余白も減らない）＝機会損失のみ
   中    … 効果が減る（率で表す）
   高い  … そのまま */
const MARGIN_CONTROL = {
  lowMax: 3,     // これ以下なら止められる
  midMax: 11,    // これ以下なら効果が減る
  midRate: 0.5,  // 中のときの倍率
};

function makeSim(cfg) {
  const shapeFn = SHAPES[cfg.shape];
  const rate = (v) => shapeFn(v, cfg.floorRate);
  const gainAfterTrust = (base, trust) =>
    Math.round(base * Math.max(0, 1 - trust * cfg.trustRate));

  // 余白の状態から「働けるか／効果が何倍か」を返す
  function marginGate(margin) {
    if (!cfg.marginControl) return { blocked: false, mult: 1 };
    if (margin <= MARGIN_CONTROL.lowMax) return { blocked: true, mult: 0 };
    if (margin <= MARGIN_CONTROL.midMax) return { blocked: false, mult: MARGIN_CONTROL.midRate };
    return { blocked: false, mult: 1 };
  }

  // 1スロット分を適用する。costly な行動（家事・祈る）だけが余白制約の対象。
  function applySlot(s, action, slot) {
    const evening = slot === 'evening';
    if (action === 'rest') { s.margin += REST_MARGIN; s.counts.rest += 1; return; }
    if (action === 'talk') {
      // 会話は余白を消費しないので制約の対象外
      s.trust += cfg.trustTalk; s.counts.talk += 1; return;
    }
    const g = marginGate(s.margin);
    if (g.blocked) { s.counts.blocked += 1; return; } // 行動も余白も消費しない
    if (action === 'chores') {
      const base = evening ? cfg.careEvening : cfg.careDay;
      s.care += Math.round(base * rate(s.care) * g.mult);
      s.margin += -2;
      if (!evening) s.fatigue += CHORES_FATIGUE;
      s.counts.chores += 1;
      return;
    }
    if (action === 'pray') {
      const base = evening ? cfg.prayEvening : cfg.prayDay;
      const bonus = s.fatigue <= cfg.prayBonusFatigueMax ? cfg.prayBonus : 0;
      s.pray += Math.round((base + bonus) * rate(s.pray) * g.mult);
      s.margin += -2;
      if (evening) s.fatigue += -EVENING_PRAY_REDUCE;
      s.counts.pray += 1;
      return;
    }
  }

  const clampAll = (s) => {
    s.fatigue = clamp(s.fatigue, FAT);
    s.margin = clamp(s.margin, MRG);
    s.trust = clamp255(s.trust);
    s.pray = clamp255(s.pray);
    s.care = clamp255(s.care);
  };

  // slots は配列（固定パターン）か、関数（適応戦略）
  function run(slots) {
    const s = {
      fatigue: 20, margin: 10, trust: 0, pray: 0, care: 0,
      counts: { chores: 0, pray: 0, rest: 0, talk: 0, blocked: 0, nightCare: 0 },
    };
    const trace = [];
    for (let day = 1; day <= DAYS; day++) {
      if (day === 1) { trace.push({ day, ...snap(s) }); continue; }

      const pick = typeof slots === 'function' ? slots(s, day) : slots;
      applySlot(s, pick[0], 'morning'); clampAll(s);
      applySlot(s, pick[1], 'noon'); clampAll(s);
      s.fatigue += gainAfterTrust(EVENING_PRAYER_GAIN, s.trust); clampAll(s);
      applySlot(s, pick[2], 'evening'); clampAll(s);

      // 夜。7日目・21日目は夜なし
      if (day === 7) {
        s.trust += cfg.trustDay7; clampAll(s);
      } else if (day === 21) {
        // 葬儀。stats を宣言していないので何も動かない
      } else {
        s.fatigue += careRecovery(s.margin);
        s.trust += cfg.trustNight;
        s.margin += NIGHTCARE_MARGIN;
        s.counts.nightCare += 1;
        clampAll(s);
      }
      s.margin += SLEEP_MARGIN; clampAll(s);
      trace.push({ day, ...snap(s) });
    }
    return { trace, counts: s.counts, end: snap(s) };
  }
  const snap = (s) => ({ fatigue: s.fatigue, margin: s.margin, trust: s.trust, pray: s.pray, care: s.care });
  return { run };
}

/* ---- パターン ---- */
const PATTERNS = {
  balanced: ['chores', 'talk', 'pray'],
  会話重視: ['talk', 'talk', 'pray'],
  家事重視: ['chores', 'chores', 'pray'],
  祈り重視: ['pray', 'pray', 'pray'],
  休息重視: ['rest', 'talk', 'pray'],
  休息家事: ['rest', 'chores', 'pray'],
  受け身: ['rest', 'rest', 'rest'],
};

// ★タスク2用：余白が尽きるまで働き、必要分だけ休む適応戦略。
//   「最大で何回家事と祈りを打てるか」を測るための上限値を出す。
function makeGreedy(minMargin) {
  return (s, day) => {
    const plan = [];
    let m = s.margin;
    for (let i = 0; i < 3; i++) {
      if (m - 2 >= minMargin) { plan.push(i === 1 ? 'pray' : 'chores'); m -= 2; }
      else { plan.push('rest'); m += 4; }
    }
    return plan;
  };
}

const firstDay = (trace, key, th) => {
  const i = trace.findIndex((t) => t[key] >= th);
  return i === -1 ? null : i + 1;
};
const firstFatigue = (trace) => {
  const i = trace.findIndex((t) => t.fatigue <= 2);
  return i === -1 ? null : i + 1;
};
const pad = (v, n = 2) => String(v ?? '—').padStart(n);
// その値が「生きている」日数＝上限に張り付いていない日数（1日目を除く27日中）
const aliveDays = (trace, key) => trace.slice(1).filter((t) => t[key] < MAX).length;

function evaluate(cfg) {
  const sim = makeSim(cfg);
  const out = {};
  for (const [name, slots] of Object.entries(PATTERNS)) {
    const r = sim.run(slots);
    out[name] = {
      trustUnlock: (() => { const d = firstDay(r.trace, 'trust', cfg.trustUnlock); return d === null ? null : Math.max(d, 8); })(),
      fatigueLand: firstFatigue(r.trace),
      prayGate: firstDay(r.trace, 'pray', cfg.gate),
      careGate: firstDay(r.trace, 'care', cfg.gate),
      prayAlive: aliveDays(r.trace, 'pray'),
      careAlive: aliveDays(r.trace, 'care'),
      counts: r.counts,
      end: r.end,
    };
  }
  return out;
}

// 目標判定：balanced が両ゲートに 24〜28日目で届き、疲労と信頼が壊れていない
function goals(o) {
  const inRange = (v, a, b) => v !== null && v >= a && v <= b;
  return {
    balanced祈り: inRange(o.balanced.prayGate, 24, 28),
    balanced世話役: inRange(o.balanced.careGate, 24, 28),
    balanced疲労: inRange(o.balanced.fatigueLand, 12, 16),
    balanced信頼解禁: inRange(o.balanced.trustUnlock, 10, 13),
    受け身は未到達: o.受け身.prayGate === null && o.受け身.careGate === null,
  };
}

/* ================================================================= */
console.log('='.repeat(100));
console.log('255スケール移行とゲートの着地調整（本体コードは未変更）');
console.log('据え置き：angelFatigue [0,20] / 心身の余白 [0,20] / 夜ケアの回復は段階5・2〜6');
console.log('='.repeat(100));

/* ===== タスク2：余白の制約の仮説を先に検証する ===== */
console.log('');
console.log('='.repeat(100));
console.log('【タスク2】仮説の検証：余白の制約で「毎日働く」は物理的に不可能になっているか');
console.log('='.repeat(100));
console.log('');
console.log('■ 現行の余白の収支（1日あたり）');
console.log('  就寝 +4 ／ 夜ケア -2  → 夜の純増 +2');
console.log('  家事 -2 ／ 祈る -2 ／ 休む +4 ／ 会話 ±0（昼3枠）');
console.log('  → 3枠すべてを家事か祈りにすると -6。1日の純増と合わせて **-4/日**');
console.log('  → 初期10なので、計算上は3日で0になる');
console.log('');
console.log('★しかし app.js:1145 に「心身の余白は行動不能を生むスタミナではないため、低くても行動は制限しない」');
console.log('  と明記されている。**余白は0でクランプするだけで、行動は一切止まらない。**');
console.log('');

{
  // 制約なし（現行実装）で「毎日3枠すべて働く」を回す
  const base = {
    trustTalk: 3, trustNight: 2, trustDay7: 5, trustUnlock: 50, trustRate: 0.01,
    prayDay: 4, prayEvening: 6, prayBonus: 2, prayBonusFatigueMax: 6,
    careDay: 4, careEvening: 2, gate: 50, shape: 'flat', floorRate: 0,
    marginControl: false,
  };
  // 60スケールのまま（＝現行）で確認する
  const cfg60 = { ...base };
  const sim = makeSim(Object.assign({}, cfg60));
  const hardWork = ['chores', 'pray', 'pray'];
  const r = sim.run(hardWork);
  console.log('■ 現行実装（制約なし）で「朝=家事 / 昼=祈る / 夕=祈る」を28日続けた場合');
  console.log('  day |  余白  疲労   祈り  世話役');
  [2, 3, 4, 5, 10, 20, 28].forEach((d) => {
    const t = r.trace[d - 1];
    console.log(`  ${pad(d)}  | ${pad(t.margin)}    ${pad(t.fatigue)}    ${pad(t.pray, 3)}    ${pad(t.care, 3)}`);
  });
  console.log(`  行動回数：家事 ${r.counts.chores} / 祈り ${r.counts.pray} / 休む ${r.counts.rest} / 止められた ${r.counts.blocked}`);
  console.log('  → ★**27日すべてで3枠とも働けている。休む必要が一度もない。**');
  console.log('  → 余白は0に張り付くだけで、ペナルティは「夜ケアの回復量が最小（-2）になる」ことだけ');
  console.log('');

  // 上限：余白を切らさないように働く（＝制約が効いていたら何回働けるか）
  console.log('■ 参考：もし「余白0では働けない」としたら、28日で何回働けるか');
  for (const minM of [0, 2, 4]) {
    const g = makeSim(Object.assign({}, cfg60)).run(makeGreedy(minM));
    console.log(`  余白の下限 ${minM}：家事 ${pad(g.counts.chores)} 回 / 祈り ${pad(g.counts.pray)} 回 / 休む ${pad(g.counts.rest)} 回`
      + `  （働いた枠 ${pad(g.counts.chores + g.counts.pray)} / 全81枠）`);
  }
  console.log('  → 下限を 2 に置くだけで働ける枠が約2/3に落ちる。**制約は「入れれば効く」が、今は入っていない**');
}

/* ===== タスク1＋3：255スケールで形を探す ===== */
console.log('');
console.log('='.repeat(100));
console.log('【タスク1＋3】255スケールで、祈り／世話役のゲート到達を 24〜28日目にする形を探す');
console.log('='.repeat(100));
console.log('');
console.log('★信頼は「困っていない値」なので比例移行する（60→255 は ×4.25）。');
console.log('  talk +3→+13 / 夜ケア +2→+8 / 7日目 +5→+21 / 解禁 50→212');
console.log('  疲労軽減の係数も比例させる（0.01 × 60/255 = 0.002353）。これで疲労と信頼の形は不変。');
console.log('');

const TRUST_255 = {
  trustTalk: 13, trustNight: 8, trustDay7: 21, trustUnlock: 212,
  trustRate: 0.6 / MAX,
};

const results = [];
for (const shape of ['flat', '逓減', '平方根']) {
  for (const gate of [180, 200, 220]) {
    for (const scoreScale of [4, 6, 8, 10, 12, 14, 17]) {
      // 60スケールの比率（家事4:2 / 祈り4:6、ボーナス2）を保ったまま倍率だけ変える
      const cfg = {
        ...TRUST_255,
        prayDay: scoreScale,
        prayEvening: Math.round(scoreScale * 1.5),
        prayBonus: Math.round(scoreScale * 0.5),
        prayBonusFatigueMax: 6,
        careDay: scoreScale,
        careEvening: Math.round(scoreScale * 0.5),
        gate,
        shape,
        floorRate: shape === 'flat' ? 1 : 0.15,
        marginControl: false,
      };
      const o = evaluate(cfg);
      const g = goals(o);
      results.push({ shape, gate, scoreScale, cfg, o, g, ok: Object.values(g).every(Boolean) });
    }
  }
}

console.log('  形      ゲート 加算 | balanced 祈り/世話役 | 疲労 | 信頼解禁 | 家事重視 祈り/世話役 | 祈り重視 | 受け身 | 目標');
console.log('  ' + '-'.repeat(112));
for (const r of results) {
  const o = r.o;
  console.log(
    `  ${r.shape.padEnd(4)}  ${pad(r.gate, 4)}  ${pad(r.scoreScale)}  |   ${pad(o.balanced.prayGate)}日/${pad(o.balanced.careGate)}日    ` +
    `| ${pad(o.balanced.fatigueLand)}日 |  ${pad(o.balanced.trustUnlock)}日   ` +
    `|   ${pad(o.家事重視.prayGate)}日/${pad(o.家事重視.careGate)}日     ` +
    `|  ${pad(o.祈り重視.prayGate)}日   | ${pad(o.受け身.prayGate)}日/${pad(o.受け身.careGate)}日 | ${r.ok ? '★' : '×'}`
  );
}

const hits = results.filter((r) => r.ok);
console.log('');
if (!hits.length) {
  console.log('→ 目標をすべて満たす組み合わせ：なし');
} else {
  console.log(`→ 目標をすべて満たす組み合わせ：${hits.length}件`);
  for (const h of hits) {
    console.log(`   ${h.shape.padEnd(4)} ゲート${h.gate} 加算${h.scoreScale}` +
      `  祈り${h.o.balanced.prayGate}日 世話役${h.o.balanced.careGate}日` +
      `  生きてる日数 祈り${h.o.balanced.prayAlive}/27 世話役${h.o.balanced.careAlive}/27`);
  }
}

/* ===== タスク4：両方に届くプレイの中身 ===== */
function detail(title, cfg) {
  const o = evaluate(cfg);
  console.log('');
  console.log(`■ ${title}`);
  console.log('  パターン    信頼解禁 疲労着地 祈りゲート 世話役ゲート | 28日目の値（信頼/祈り/世話役） | 行動回数（家事/祈り/会話/休む）');
  for (const name of Object.keys(PATTERNS)) {
    const x = o[name];
    console.log(`  ${name.padEnd(5)}    ${pad(x.trustUnlock)}日   ${pad(x.fatigueLand)}日    ${pad(x.prayGate)}日      ${pad(x.careGate)}日     ` +
      `| ${pad(x.end.trust, 3)} / ${pad(x.end.pray, 3)} / ${pad(x.end.care, 3)}          ` +
      `| ${pad(x.counts.chores)} / ${pad(x.counts.pray)} / ${pad(x.counts.talk)} / ${pad(x.counts.rest)}`);
  }
  const both = Object.keys(PATTERNS).filter((k) => o[k].prayGate !== null && o[k].careGate !== null);
  const one = Object.keys(PATTERNS).filter((k) => (o[k].prayGate === null) !== (o[k].careGate === null));
  const none = Object.keys(PATTERNS).filter((k) => o[k].prayGate === null && o[k].careGate === null);
  console.log(`  → 両方に届く：${both.join(', ') || 'なし'}`);
  console.log(`  → 片方だけ：${one.join(', ') || 'なし'}`);
  console.log(`  → 届かない：${none.join(', ') || 'なし'}`);
  console.log(`  → 生きている日数（27日中）：祈り ${o.balanced.prayAlive} / 世話役 ${o.balanced.careAlive}（balanced）`);
  return o;
}

console.log('');
console.log('='.repeat(100));
console.log('【タスク4】両方のゲートに届くプレイの中身');
console.log('='.repeat(100));

const CANDIDATES = [
  ['逓減 / ゲート200 / 加算12', { shape: '逓減', gate: 200, scoreScale: 12 }],
  ['flat / ゲート200 / 加算8', { shape: 'flat', gate: 200, scoreScale: 8 }],
  ['平方根 / ゲート180 / 加算14', { shape: '平方根', gate: 180, scoreScale: 14 }],
];
const built = {};
for (const [title, p] of CANDIDATES) {
  const cfg = {
    ...TRUST_255,
    prayDay: p.scoreScale, prayEvening: Math.round(p.scoreScale * 1.5),
    prayBonus: Math.round(p.scoreScale * 0.5), prayBonusFatigueMax: 6,
    careDay: p.scoreScale, careEvening: Math.round(p.scoreScale * 0.5),
    gate: p.gate, shape: p.shape, floorRate: p.shape === 'flat' ? 1 : 0.15,
    marginControl: false,
  };
  built[title] = cfg;
  detail(title, cfg);
}

/* ===== 参考：余白の制約を入れた場合 ===== */
console.log('');
console.log('='.repeat(100));
console.log('【参考】★2026-07-29 の決定「余白が低いと天使様が止めて休ませる」を入れた場合');
console.log('='.repeat(100));
console.log(`  帯：余白 0-${MARGIN_CONTROL.lowMax} → 止められる（行動も余白も消費しない）`);
console.log(`      余白 ${MARGIN_CONTROL.lowMax + 1}-${MARGIN_CONTROL.midMax} → 効果 ×${MARGIN_CONTROL.midRate}`);
console.log(`      余白 ${MARGIN_CONTROL.midMax + 1}-20 → そのまま`);
for (const [title, cfg] of Object.entries(built)) {
  detail(`${title}（余白の制約あり）`, { ...cfg, marginControl: true });
}
console.log('');

/* ================================================================================
   【追加探索】軸ごとに独立して振る

   ここまでで分かったこと（探索方針の根拠）:
     - balanced は 家事27回 / 夕方の祈り27回。祈りは**夕方枠だけ**から来る
     - 夕方に祈る他のパターン（会話重視・家事重視・休息重視・休息＋家事）は
       **balanced と全く同じ祈りの伸び**になる。祈り軸はこれらを区別できない
     - 区別できるのは家事の回数だけ（balanced 27 / 家事重視 54 / 休息＋家事 27 / 他 0）
   → したがって「両ゲートを 24〜28日目」は、**家事1回あたりと夕方の祈り1回あたりを
     揃えて、27回でちょうど届く**ように置く問題になる。
   ================================================================================ */
console.log('');
console.log('='.repeat(100));
console.log('【追加探索】家事1回あたり／夕方の祈り1回あたりを独立に振る（flat と 逓減）');
console.log('='.repeat(100));
console.log('  形    ゲート 家事/日 祈り夕 ボーナス | balanced 祈り/世話役 | 疲労 | 信頼解禁 | 28日目 祈り/世話役 | 目標');
console.log('  ' + '-'.repeat(108));

const fine = [];
for (const shape of ['flat', '逓減']) {
  for (const gate of [180, 200, 220]) {
    for (const careDay of [7, 8, 9, 10, 11]) {
      for (const prayEvening of [6, 7, 8, 9, 10]) {
        const cfg = {
          ...TRUST_255,
          prayDay: Math.round(prayEvening * 0.67),
          prayEvening,
          prayBonus: 2,
          prayBonusFatigueMax: 6,
          careDay,
          careEvening: Math.round(careDay * 0.5),
          gate, shape,
          floorRate: shape === 'flat' ? 1 : 0.15,
          marginControl: false,
        };
        const o = evaluate(cfg);
        const g = goals(o);
        const ok = Object.values(g).every(Boolean);
        fine.push({ shape, gate, careDay, prayEvening, cfg, o, ok });
      }
    }
  }
}
for (const r of fine) {
  if (!r.ok) continue;
  const o = r.o;
  console.log(
    `  ${r.shape.padEnd(4)}  ${pad(r.gate, 4)}   ${pad(r.careDay)}     ${pad(r.prayEvening)}      2    ` +
    `|   ${pad(o.balanced.prayGate)}日/${pad(o.balanced.careGate)}日    | ${pad(o.balanced.fatigueLand)}日 |  ${pad(o.balanced.trustUnlock)}日   ` +
    `|  ${pad(o.balanced.end.pray, 3)} / ${pad(o.balanced.end.care, 3)}      | ★`);
}
const fineHits = fine.filter((r) => r.ok);
console.log('');
console.log(`→ 目標（balanced が両ゲート 24〜28日目・疲労 12〜16日・信頼解禁 10〜13日・受け身は未到達）を満たす：${fineHits.length}件`);

if (fineHits.length) {
  // 幅が最も狭いもの（祈りと世話役の到達日が近い）を推奨候補にする
  const ranked = [...fineHits].sort((a, b) =>
    Math.abs(a.o.balanced.prayGate - a.o.balanced.careGate) - Math.abs(b.o.balanced.prayGate - b.o.balanced.careGate));
  console.log('');
  console.log('='.repeat(100));
  console.log('【推奨候補の詳細】両ゲートの到達日が近い順に上位3件');
  console.log('='.repeat(100));
  for (const h of ranked.slice(0, 3)) {
    detail(`${h.shape} / ゲート${h.gate} / 家事+${h.careDay} / 夕方の祈り+${h.prayEvening}（+ボーナス2）`, h.cfg);
  }
}
console.log('');

/* ================================================================================
   【最終】推奨値の詳細と、現行60スケールとの「生きている日数」の比較
   ================================================================================ */
const REC = {
  ...TRUST_255,
  prayDay: 5, prayEvening: 7, prayBonus: 2, prayBonusFatigueMax: 6,
  careDay: 8, careEvening: 4,
  gate: 200, shape: 'flat', floorRate: 1, marginControl: false,
};
const CUR60 = {
  trustTalk: 3, trustNight: 2, trustDay7: 5, trustUnlock: 50, trustRate: 0.01,
  prayDay: 4, prayEvening: 6, prayBonus: 2, prayBonusFatigueMax: 6,
  careDay: 4, careEvening: 2, gate: 50, shape: 'flat', floorRate: 1, marginControl: false,
};

console.log('');
console.log('='.repeat(100));
console.log('【最終】★推奨：255スケール / ゲート200 / 家事+8（夕方+4） / 夕方の祈り+7（+ボーナス2、昼+5）');
console.log('='.repeat(100));
const recOut = detail('推奨値', REC);

console.log('');
console.log('■ 「その値が生きている日数」の比較（27日中・上限に張り付いていない日数）');
console.log('  パターン    現行60スケール（祈り/世話役） → 推奨255（祈り/世話役）');
{
  // 現行60スケールは上限60で測る必要があるため、専用に測り直す
  const sim60 = makeSim(CUR60);
  for (const [name, slots] of Object.entries(PATTERNS)) {
    const r60 = sim60.run(slots);
    const alive60 = (key) => r60.trace.slice(1).filter((t) => t[key] < 60).length;
    const x = recOut[name];
    console.log(`  ${name.padEnd(5)}      ${pad(alive60('pray'))} / ${pad(alive60('care'))}            →   ${pad(x.prayAlive)} / ${pad(x.careAlive)}`);
  }
}
console.log('');
console.log('■ 推奨値での行動内訳（28日＝81枠。1日目は固定オープニングなので 27日×3枠）');
console.log('  パターン    家事  祈り  会話  休む | 両ゲート到達 | 信頼解禁 | 疲労着地');
for (const name of Object.keys(PATTERNS)) {
  const x = recOut[name];
  const c = x.counts;
  const both = x.prayGate !== null && x.careGate !== null
    ? `祈${pad(x.prayGate)}日/世${pad(x.careGate)}日`
    : (x.prayGate !== null ? `祈${pad(x.prayGate)}日のみ` : '未到達    ');
  console.log(`  ${name.padEnd(5)}     ${pad(c.chores)}   ${pad(c.pray)}   ${pad(c.talk)}   ${pad(c.rest)} | ${both} |  ${pad(x.trustUnlock)}日   |  ${pad(x.fatigueLand)}日`);
}
console.log('');
