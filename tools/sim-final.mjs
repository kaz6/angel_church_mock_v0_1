/* =========================================================================
   sim-final.mjs — 確定値での最終シミュレーション【検証専用】

   実行:  node tools/sim-final.mjs

   ★ 本体（app.js）は一切変更しない。値の差し替えはすべて本スクリプト内。
   ★ 「休む」に angelFatigue の直接軽減は入れない（レバーCは却下済み）。
      休むが効くのは「余白が増える → 夜ケアの回復量が上がる」経路だけ。

   確定値（DECISION_LOG 2026-07-29「数値の確定（第2弾）」）:
     おあずけ解禁の信頼閾値 50 / 疲労軽減の係数 1 - trust*0.01 / talk の信頼 +3
     7日目 nightHold の trust +5（★+4 から変更）
     夜ケアの回復レンジ 2〜10（★成功度5段階 2/4/6/8/10 に対応）
     エンディングのゲート閾値 50（★仮置き48から変更）
     ★★「休む」の疲労加算は廃止（restGain 1 → 0）

   モデリング仮定（前回踏襲）:
     1) 1日目は固定オープニングで stats を動かさない（自由行動は2日目朝から）
     2) 7日目は夜なし（nightHold）。trust のみ加算、angelFatigue は回復しない
     3) おあずけは行わない
     4) END_DAY は現状7だが28日まで回す
     5) 夜ケアの回復量はその夜の余白から導出（現行の「余白>=14 で追加 -2」は式に吸収）
     6) 夜ケアが余白を -2 消費する点は現行のまま据え置く
   ========================================================================= */

'use strict';

const RANGE = { angelFatigue: [0, 20], trust: [0, 60], mentalMargin: [0, 20] };
const INIT = { fatigue: 20, trust: 0, margin: 10, pray: 0, care: 0 };
const MARGIN_MAX = RANGE.mentalMargin[1];
const SLEEP_MARGIN = 4;
const EVENING_PRAYER_GAIN = 6;
const REST_GAIN = 0; // ★★確定：「休む」の疲労加算は廃止
const EVENING_PRAY_REDUCE = 1;
const NIGHTCARE_TRUST = 2;
const NIGHTCARE_MARGIN_COST = -2;

// 確定値
const BASE = { trustUnlock: 50, trustRate: 0.01, talkTrust: 3 };
const UNLOCK_MIN_DAY = 8;
const DAY7_TRUST = 5; // ★+4 → +5
const GATE = 50; // ★エンディングのゲート閾値 48 → 50

const PATTERNS = {
  balanced: { label: 'balanced  ', slots: ['chores', 'talk', 'pray'], kind: '混合' },
  会話重視: { label: '会話重視  ', slots: ['talk', 'talk', 'pray'], kind: '単一' },
  家事重視: { label: '家事重視  ', slots: ['chores', 'chores', 'pray'], kind: '単一' },
  受け身: { label: '受け身    ', slots: ['rest', 'rest', 'rest'], kind: '単一' },
  休息重視: { label: '休息重視  ', slots: ['rest', 'talk', 'pray'], kind: '混合' },
  休息家事: { label: '休息＋家事', slots: ['rest', 'chores', 'pray'], kind: '混合' },
};
const REST_PATTERNS = ['受け身', '休息重視', '休息家事'];

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

/* ---- 余白 → 夜ケアの回復量（負値を返す） ----
   いずれも「余白0で min、余白20で max」。逓減の付き方だけが違う。
   段階5 は「成功度5段階」に対応した離散版（レンジ 2〜10 なら 2/4/6/8/10）。 */
const CARE_MODELS = {
  線形: (margin, min, max) => -Math.round(min + (max - min) * (margin / MARGIN_MAX)),
  平方根: (margin, min, max) => -Math.round(min + (max - min) * Math.sqrt(margin / MARGIN_MAX)),
  段階3: (margin, min, max) => {
    const mid = (min + max) / 2;
    if (margin <= 5) return -Math.round(min);      // 0–5   小
    if (margin <= 12) return -Math.round(mid);     // 6–12  中
    return -Math.round(max);                       // 13–20 大
  },
  // ★成功度5段階：余白を5等分し、min..max を等間隔の5値に割り当てる
  段階5: (margin, min, max) => {
    const step = Math.min(4, Math.floor(margin / 4)); // 0-3 / 4-7 / 8-11 / 12-15 / 16-20
    return -Math.round(min + ((max - min) * step) / 4);
  },
};

function makeSim(cfg) {
  const gainAfterTrust = (base, trust) =>
    Math.round(base * Math.max(0, 1 - trust * cfg.trustRate));

  // エンディングのゲートに使う値も追跡する（app.js の STAT_CONFIG より）
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
      if (day === 1) {
        trust.push(s.trust); fatigue.push(s.fatigue); margin.push(s.margin);
        careAmt.push(0); prayT.push(s.pray); careT.push(s.care);
        continue;
      }

      dayAction(s, slots[0]); clampAll(s);
      dayAction(s, slots[1]); clampAll(s);
      s.fatigue += gainAfterTrust(EVENING_PRAYER_GAIN, s.trust); clampAll(s);
      eveningAction(s, slots[2]); clampAll(s);

      let amt = 0;
      if (day === 7) {
        s.trust += day7Trust; clampAll(s);           // 夜なし（告白の日）
      } else {
        amt = cfg.careModel(s.margin, cfg.careMin, cfg.careMax);
        s.fatigue += amt;
        s.trust += NIGHTCARE_TRUST;
        s.margin += NIGHTCARE_MARGIN_COST;
        clampAll(s);
      }

      s.margin += SLEEP_MARGIN; clampAll(s);
      trust.push(s.trust); fatigue.push(s.fatigue); margin.push(s.margin);
      careAmt.push(amt); prayT.push(s.pray); careT.push(s.care);
    }
    return { trust, fatigue, margin, careAmt, prayT, careT, endStats: { pray: s.pray, care: s.care } };
  }
  return { run };
}

const firstDay = (arr, pred) => { const i = arr.findIndex(pred); return i === -1 ? null : i + 1; };
const unlockDay = (t, th) => { const h = firstDay(t, (v) => v >= th); return h === null ? null : Math.max(h, UNLOCK_MIN_DAY); };
const pad = (v, n = 2) => String(v ?? '—').padStart(n);

/* ---- 目標判定（タスクページ「目標値」の表） ---- */
function goals(o) {
  return {
    balanced解禁: o.balanced.u !== null && o.balanced.u >= 10 && o.balanced.u <= 13,
    balanced疲労: o.balanced.f2 !== null && o.balanced.f2 >= 12 && o.balanced.f2 <= 16,
    会話重視解禁: o.会話重視.u !== null && o.会話重視.u >= 7 && o.会話重視.u <= 9, // 8日目前後
    会話重視疲労: o.会話重視.f2 !== null,
    家事重視: o.家事重視.u !== null && o.家事重視.f2 !== null,
    受け身疲労: o.受け身.f2 !== null,
    休息重視疲労: o.休息重視.f2 !== null,
    休息家事疲労: o.休息家事.f2 !== null,
  };
}

/* ---- マイルドさの判定（4軸） ----
   疲労着地／信頼解禁／祈りの調律50到達／世話役適性50到達。すべて「早い方が良い」。
   全軸で他すべてを上回るパターンがあれば「突出」。 */
function dominance(o) {
  const lo = (x, k) => (x[k] === null ? 99 : x[k]);
  const AX = ['f2', 'u', 'prayDay', 'careDay'];
  const keys = Object.keys(o);
  const atLeastAsGood = (a, b) => AX.every((k) => lo(a, k) <= lo(b, k));
  const strictlyBetter = (a, b) => AX.some((k) => lo(a, k) < lo(b, k));
  const dominating = keys.filter((k) =>
    keys.filter((m) => m !== k).every((m) => atLeastAsGood(o[k], o[m]) && strictlyBetter(o[k], o[m])));
  const dominated = keys.filter((k) =>
    keys.some((m) => m !== k && atLeastAsGood(o[m], o[k]) && strictlyBetter(o[m], o[k])));
  const f2s = keys.map((k) => lo(o[k], 'f2')).filter((v) => v !== 99);
  const spread = f2s.length ? Math.max(...f2s) - Math.min(...f2s) : null;

  // ★休息系が強すぎていないか：休息系が非休息系より「疲労着地が早い」件数と、
  //   休息系のうち他をひとつでも支配しているものを見る。
  const nonRest = keys.filter((k) => !REST_PATTERNS.includes(k));
  const restFasterThanAll = REST_PATTERNS.filter((k) =>
    nonRest.every((m) => lo(o[k], 'f2') < lo(o[m], 'f2')));
  const restDominates = REST_PATTERNS.filter((k) =>
    nonRest.some((m) => atLeastAsGood(o[k], o[m]) && strictlyBetter(o[k], o[m])));
  return { dominating, dominated, spread, restFasterThanAll, restDominates };
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
      trust28: r.trust[27],
      avgMargin: Math.round(r.margin.slice(1).reduce((a, b) => a + b, 0) / 27),
      prayDay: firstDay(r.prayT, (v) => v >= GATE),
      careDay: firstDay(r.careT, (v) => v >= GATE),
      // ★疲労が「資源として生きている」期間：疲労>2 だった日数（1日目のオープニングを除く）
      liveDays: r.fatigue.slice(1).filter((v) => v > 2).length,
      // ★疲労0に張り付いた日数
      zeroDays: r.fatigue.slice(1).filter((v) => v === 0).length,
      pray: r.endStats.pray,
      caretaker: r.endStats.care,
      avgCare: (r.careAmt.slice(1).filter((v) => v !== 0).reduce((a, b) => a + b, 0) /
        Math.max(1, r.careAmt.slice(1).filter((v) => v !== 0).length)).toFixed(1),
      fatigueTrace: r.fatigue,
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
  console.log('  パターン     解禁日  疲労≤2  疲労0日数  平均余白  平均回復  祈り50到達  世話役50到達');
  for (const [k, p] of Object.entries(PATTERNS)) {
    const x = o[k];
    console.log(`  ${p.label}   ${pad(x.u)}日   ${pad(x.f2)}日     ${pad(x.zeroDays)}日      ${pad(x.avgMargin)}     ${String(x.avgCare).padStart(5)}     ${pad(x.prayDay)}日        ${pad(x.careDay)}日`);
  }
  const ng = Object.entries(g).filter(([, v]) => !v).map(([k]) => k);
  console.log(`  → 目標: ${ok ? '★すべて満たす' : '×（未達: ' + ng.join(' / ') + '）'}`);
  console.log(`  → マイルドさ: 全軸で突出 = ${d.dominating.length ? d.dominating.join(', ') : 'なし'}` +
    ` / 支配されて選ぶ意味がない = ${d.dominated.length ? d.dominated.join(', ') : 'なし'}` +
    ` / 疲労着地の幅 = ${d.spread ?? '—'}日`);
  console.log(`  → 休息系チェック: 疲労着地が非休息系すべてより早い = ${d.restFasterThanAll.length ? d.restFasterThanAll.join(', ') : 'なし'}` +
    ` / 他を支配している休息系 = ${d.restDominates.length ? d.restDominates.join(', ') : 'なし'}`);
  return { ok, d, o };
}

console.log('='.repeat(96));
console.log('確定値での最終シミュレーション（本体コードは未変更）');
console.log('確定値: 解禁閾値50 / 係数0.01 / talk信頼+3 / 7日目trust+5 / ゲート50 / 「休む」の疲労加算=0');
console.log('='.repeat(96));

/* ================== 1) 確定レンジ 2〜10 での6パターン ================== */
console.log('');
console.log('='.repeat(96));
console.log('【1】確定レンジ 2〜10 での6パターン（式4種 × 会話疲労 0/-1）');
console.log('='.repeat(96));
for (const name of Object.keys(CARE_MODELS)) {
  for (const talkFatigue of [0, -1]) {
    printCase(`${name} / 回復 2〜10 / 会話の疲労軽減 ${talkFatigue}`,
      { ...BASE, talkFatigue, careMin: 2, careMax: 10, careModel: CARE_MODELS[name] });
  }
}

/* ================== 2) 全組み合わせ一覧 ================== */
const RANGES = [[2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10]];
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
console.log('='.repeat(96));
console.log('【2】回復レンジを下げられるか（2〜5 〜 2〜10 を走査）× 会話の疲労軽減（0 / -1）');
console.log('='.repeat(96));
console.log('  式     レンジ 会話疲労 | balanced 解禁/疲労 | 会話 | 家事 | 受け身 | 休息 | 休息家事 | 目標 | 突出 | 休息系突出');
console.log('  ' + '-'.repeat(116));
for (const r of results) {
  const o = r.o;
  console.log(
    `  ${r.name.padEnd(4)} ${String(r.min + '〜' + r.max).padEnd(5)}   ${pad(r.talkFatigue)}   ` +
    `|   ${pad(o.balanced.u)}日/${pad(o.balanced.f2)}日   ` +
    `| ${pad(o.会話重視.f2)}日 | ${pad(o.家事重視.f2)}日 |  ${pad(o.受け身.f2)}日  | ${pad(o.休息重視.f2)}日 |  ${pad(o.休息家事.f2)}日   ` +
    `| ${r.ok ? '★' : '×'}  | ${(r.d.dominating.length ? r.d.dominating.join(',') : 'なし').padEnd(8)} | ` +
    `${r.d.restFasterThanAll.length ? r.d.restFasterThanAll.join(',') : 'なし'}`
  );
}

const hits = results.filter((r) => r.ok);
console.log('');
if (hits.length === 0) {
  console.log('→ 目標をすべて満たす組み合わせ: なし');
} else {
  console.log(`→ 目標をすべて満たす組み合わせ: ${hits.length}件（突出なし → 疲労着地の幅が小さい順）`);
  const ranked = [...hits].sort((a, b) =>
    (a.d.dominating.length - b.d.dominating.length) ||
    (a.d.restFasterThanAll.length - b.d.restFasterThanAll.length) ||
    (a.d.spread - b.d.spread));
  for (const h of ranked) {
    console.log(`   ${h.name.padEnd(4)} ${String(h.min + '〜' + h.max).padEnd(5)} / 会話疲労${h.talkFatigue}` +
      `  突出=${h.d.dominating.length ? h.d.dominating.join(',') : 'なし'}` +
      ` 休息系突出=${h.d.restFasterThanAll.length ? h.d.restFasterThanAll.join(',') : 'なし'}` +
      ` 幅=${h.d.spread}日`);
  }
}

/* ================== 3) 最大回復量の走査 ================== */
console.log('');
console.log('='.repeat(96));
console.log('【3】走査：最大回復量ごとの各パターンの疲労≤2 到達日（min=2 / 会話疲労0 固定）');
console.log('='.repeat(96));
for (const name of Object.keys(CARE_MODELS)) {
  console.log('');
  console.log(`  --- ${name} ---`);
  console.log('  最大回復 | balanced 会話重視 家事重視 受け身 休息重視 休息家事');
  for (const max of [4, 5, 6, 7, 8, 9, 10]) {
    const cfg = { ...BASE, talkFatigue: 0, careMin: 2, careMax: max, careModel: CARE_MODELS[name] };
    const sim = makeSim(cfg);
    const cells = Object.values(PATTERNS).map((p) => {
      const r = sim.run({ slots: p.slots });
      const f2 = firstDay(r.fatigue, (v) => v <= 2);
      return (f2 === null ? `×(${r.fatigue[27]})` : `${f2}日`).padStart(8);
    });
    console.log(`     ${String(max).padStart(2)}    |${cells.join('')}`);
  }
}

/* ================== 4) 余白 → 回復量の対応表 ================== */
console.log('');
console.log('='.repeat(96));
console.log('【4】余白 → 回復量の対応（レンジ 2〜10）');
console.log('='.repeat(96));
console.log('  余白 :  0  2  4  6  8 10 12 14 16 18 20');
for (const [name, model] of Object.entries(CARE_MODELS)) {
  const row = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((m) => pad(model(m, 2, 10))).join(' ');
  console.log(`  ${name.padEnd(4)} : ${row}`);
}
console.log('');
console.log('  ★成功度5段階（段階5）の刻み値：レンジごとに、キリのよい5値になるか');
for (const max of [5, 6, 7, 8, 9, 10]) {
  const steps = [0, 4, 8, 12, 16].map((m) => -CARE_MODELS.段階5(m, 2, max));
  const clean = steps.every((v, i) => i === 0 || v - steps[i - 1] === steps[1] - steps[0]);
  console.log(`    2〜${String(max).padEnd(2)} : ${steps.join(' / ')}  ${clean ? '← 等間隔（キリがよい）' : ''}`);
}

/* ================== 5) 疲労の推移（推奨候補の目視用） ================== */
console.log('');
console.log('='.repeat(96));
console.log('【5】疲労の日次推移（会話疲労0・レンジ 2〜10）');
console.log('='.repeat(96));
for (const name of Object.keys(CARE_MODELS)) {
  const { o } = evaluate({ ...BASE, talkFatigue: 0, careMin: 2, careMax: 10, careModel: CARE_MODELS[name] });
  console.log('');
  console.log(`  --- ${name} ---   (day1..28)`);
  for (const [k, p] of Object.entries(PATTERNS)) {
    console.log(`  ${p.label} ${o[k].fatigueTrace.map((v) => String(v).padStart(2)).join(' ')}`);
  }
}

/* ================== 6) 疲労が「資源として生きている」期間 ==================
   疲労>2 だった日数。短いほど、疲労という資源が早々に死んで残りの日が空回りする。
   ★休息系が強すぎていないかを、支配関係とは別の角度から見る指標。 */
console.log('');
console.log('='.repeat(96));
console.log('【6】疲労が資源として生きている日数（疲労>2 だった日数 / 全27日中）会話疲労0');
console.log('='.repeat(96));
console.log('  式     レンジ | balanced 会話重視 家事重視 受け身 休息重視 休息家事 | 休息系の平均 / 非休息系の平均');
for (const name of Object.keys(CARE_MODELS)) {
  for (const [min, max] of [[2, 6], [2, 8], [2, 10]]) {
    const { o } = evaluate({ ...BASE, talkFatigue: 0, careMin: min, careMax: max, careModel: CARE_MODELS[name] });
    const cells = Object.keys(PATTERNS).map((k) => String(o[k].liveDays).padStart(8));
    const avg = (ks) => (ks.reduce((a, k) => a + o[k].liveDays, 0) / ks.length).toFixed(1);
    const nonRest = Object.keys(PATTERNS).filter((k) => !REST_PATTERNS.includes(k));
    console.log(`  ${name.padEnd(4)} ${String(min + '〜' + max).padEnd(5)}  |${cells.join('')} | ${avg(REST_PATTERNS)} / ${avg(nonRest)}`);
  }
}

/* ================== 7) 会話の疲労軽減 -1 を成立させられる下限レンジ ==================
   -1 は balanced の着地を前倒しするので、回復レンジをさらに下げれば
   12〜16日の枠に戻せる可能性がある。2〜3 まで下げて走査する。 */
console.log('');
console.log('='.repeat(96));
console.log('【7】会話の疲労軽減 -1 を成立させられるレンジがあるか（2〜3 〜 2〜10 を走査）');
console.log('='.repeat(96));
console.log('  ※ balanced の着地を12日以上に保つには max<=4、受け身を28日以内に収めるには max>=5。両立しない');
console.log('  式     レンジ 会話疲労 | balanced 解禁/疲労 | 会話 | 家事 | 受け身 | 休息 | 休息家事 | 目標');
for (const name of Object.keys(CARE_MODELS)) {
  for (const max of [3, 4, 5, 6, 7, 8, 9, 10]) {
    for (const talkFatigue of [-1]) {
      const cfg = { ...BASE, talkFatigue, careMin: 2, careMax: max, careModel: CARE_MODELS[name] };
      const { o, ok, g } = evaluate(cfg);
      const ng = Object.entries(g).filter(([, v]) => !v).map(([k]) => k);
      console.log(
        `  ${name.padEnd(4)} ${String('2〜' + max).padEnd(5)}   ${pad(talkFatigue)}   ` +
        `|   ${pad(o.balanced.u)}日/${pad(o.balanced.f2)}日   ` +
        `| ${pad(o.会話重視.f2)}日 | ${pad(o.家事重視.f2)}日 |  ${pad(o.受け身.f2)}日  | ${pad(o.休息重視.f2)}日 |  ${pad(o.休息家事.f2)}日   ` +
        `| ${ok ? '★' : '×(' + ng.join(',') + ')'}`);
    }
  }
}
console.log('');

/* ================== 8) 推奨候補の詳細 ================== */
console.log('');
console.log('='.repeat(96));
console.log('【8】推奨候補の詳細');
console.log('='.repeat(96));
for (const [name, min, max] of [['段階5', 2, 6], ['平方根', 2, 6], ['線形', 2, 5], ['段階5', 2, 10]]) {
  printCase(`${name} / 回復 ${min}〜${max} / 会話の疲労軽減 0`,
    { ...BASE, talkFatigue: 0, careMin: min, careMax: max, careModel: CARE_MODELS[name] });
}
console.log('');
