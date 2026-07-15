/* =========================================================================
   sim-fatigue-tune.mjs — 疲労値調整（A＋D）候補スイープ＋再シミュ

   目的: 前回シミュ(sim-fatigue-28day.mjs)の結論「現行値では疲労が取れるのが早すぎる」
         を受け、A＋D 方針で「14日着地＋trust 14日飽和」に近い FATIGUE_CONFIG 候補を探す。
   実行:  node tools/sim-fatigue-tune.mjs
   ★ 本体(app.js)は変更しない。値の探索はこのスクリプト内のパラメータで行い、推奨のみ報告する。

   調整範囲（タスク指定）:
     A: 初期 angelFatigue 10 → 18〜20
     D: trust の伸びを緩やかに（cap 60 は上げない）→ trustGainScale で表現。
        trust が14日でちょうど飽和し、後半は bond にバトンタッチする形を狙う。
     B・C（eveningPrayerGain=4 / 夜ケア減少量 / range 0–20）は現状維持＝変更しない。

   モデリング上の仮定（前回と同じ・報告用）:
     - ケア成功度 中=現行コード固定値そのもの。低=×0.5 / 高=×1.5（将来ミニゲーム想定）。
     - おあずけ: その夜は夜ケアなし（疲労減少なし・trust増なし）。就寝(+4)は起こる。
     - trustGainScale: talk(+4)と夜ケア(+2)の trust 上昇量に掛ける係数（D＝「trust上昇を緩やかに」）。
   ========================================================================= */

'use strict';

// ---- 固定（B・C＝変更しない） ----
const RANGE = { angelFatigue: [0, 20], mentalMargin: [0, 20] };
const FIXED = { eveningPrayerGain: 4, restGain: 1, eveningPrayReduce: 1 };
const NIGHTCARE = { trust: 2, angelFatigue: -2, mentalMargin: -2, bonusAngelFatigue: -2, bonusMentalMarginMin: 14 };
const SLEEP_MARGIN = 4;
const TALK_TRUST = 4;

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

// ---- パラメータ化した1プロファイルの28日シミュ ----
// params: { initFatigue, trustGainScale, trustReductionRate, trustCap }
function simulate(params, { slots, successMult, holdback }) {
  const { initFatigue, trustGainScale, trustReductionRate, trustCap } = params;
  const gain = (base, trust) => Math.round(base * Math.max(0, 1 - trust * trustReductionRate));
  const s = { fatigue: initFatigue, trust: 0, margin: 10 };
  const clampAll = () => {
    s.fatigue = clamp(s.fatigue, RANGE.angelFatigue);
    s.trust = clamp(s.trust, [0, trustCap]);
    s.margin = clamp(s.margin, RANGE.mentalMargin);
  };
  const dayAction = (a) => {
    if (a === 'chores') { s.fatigue += -2; s.margin += -2; }
    else if (a === 'pray') { s.margin += -2; }
    else if (a === 'talk') { s.trust += TALK_TRUST * trustGainScale; }
    else if (a === 'rest') { s.margin += 4; s.fatigue += gain(FIXED.restGain, s.trust); }
  };
  const eveningAction = (a) => {
    if (a === 'chores') { s.margin += -2; }
    else if (a === 'pray') { s.margin += -2; s.fatigue += -FIXED.eveningPrayReduce; }
    else if (a === 'rest') { s.margin += 4; }
  };
  const trace = [], trustTrace = [];
  for (let day = 1; day <= 28; day++) {
    dayAction(slots[0]); clampAll();
    dayAction(slots[1]); clampAll();
    s.fatigue += gain(FIXED.eveningPrayerGain, s.trust); clampAll(); // 夕方の日課
    eveningAction(slots[2]); clampAll();
    if (!holdback.has(day)) {
      const bonus = s.margin >= NIGHTCARE.bonusMentalMarginMin ? NIGHTCARE.bonusAngelFatigue : 0;
      const red = Math.round((Math.abs(NIGHTCARE.angelFatigue) + Math.abs(bonus)) * successMult);
      s.fatigue += -red; s.trust += NIGHTCARE.trust * trustGainScale; s.margin += NIGHTCARE.mentalMargin; clampAll();
    }
    s.margin += SLEEP_MARGIN; clampAll();
    trace.push(s.fatigue); trustTrace.push(Math.round(s.trust));
  }
  return { trace, trustTrace };
}

const MIX = {
  balanced:   ['chores', 'talk', 'pray'],
  choreHeavy: ['chores', 'chores', 'pray'],
  relax:      ['rest', 'talk', 'pray'],
  talkHeavy:  ['talk', 'talk', 'pray'],
};
const HOLD = { なし: new Set(), 時々: new Set([7, 14, 21, 28]), 多め: new Set([2,4,6,9,11,13,16,18,20,23,25,27]) };
const THRESHOLD = 2;

function metrics({ trace, trustTrace }, cap) {
  const first = trace.findIndex((v) => v <= THRESHOLD);
  const satDay = trustTrace.findIndex((v) => v >= cap);
  const tail = trace.slice(20);
  return {
    landing: first === -1 ? '—' : first + 1,
    f14: trace[13], t14: trustTrace[13],
    trustSatDay: satDay === -1 ? '—' : satDay + 1,
    tail: `${Math.min(...tail)}–${Math.max(...tail)}`,
  };
}
const spark = (t) => t.map((v) => '▁▂▃▄▅▆▇█'[Math.min(7, Math.round((v / 20) * 7))]).join('');

// ---- baseline（現行値）参照 ----
const BASE = { initFatigue: 10, trustGainScale: 1.0, trustReductionRate: 0.01, trustCap: 60 };
console.log('==== 参照: baseline（現行値・初期10 / trustGainScale=1.0 / rate=0.01 / cap=60）====');
{
  const r = simulate(BASE, { slots: MIX.balanced, successMult: 1.0, holdback: HOLD['なし'] });
  const m = metrics(r, BASE.trustCap);
  console.log(`  balanced/中/なし: 14日目 fatigue=${m.f14} trust=${m.t14} / 概ね取れた=${m.landing}日目 / trust飽和=${m.trustSatDay}日目`);
  console.log(`  ${spark(r.trace)}`);
}
console.log('');

// ---- A×D 候補スイープ（評価は primary = balanced / 中 / なし）----
console.log('==== A×D 候補スイープ（評価: balanced / ケア中 / おあずけなし）====');
console.log('  目標: 概ね取れた≒14日目 かつ trust飽和≒14日目');
console.log('  init  scale  rate   | f14  t14  取れた  trust飽和  終盤(21-28)');
const initCands = [18, 20];
const scaleCands = [1.0, 0.7, 0.5];
const rateCands = [0.01]; // D主軸は trustGainScale。rate は現状維持
const candidates = [];
for (const init of initCands) for (const sc of scaleCands) for (const rate of rateCands) {
  const p = { initFatigue: init, trustGainScale: sc, trustReductionRate: rate, trustCap: 60 };
  const r = simulate(p, { slots: MIX.balanced, successMult: 1.0, holdback: HOLD['なし'] });
  const m = metrics(r, 60);
  candidates.push({ p, m, r });
  console.log(`  ${init}    ${sc.toFixed(2)}   ${rate}  |  ${String(m.f14).padStart(2)}   ${String(m.t14).padStart(2)}   ${String(m.landing).padStart(3)}日   ${String(m.trustSatDay).padStart(3)}日     ${m.tail}`);
}
console.log('');

// ---- 推奨候補を選ぶ: |landing-14| + |trustSat-14| が最小（—は罰） ----
function score(m) {
  const l = m.landing === '—' ? 40 : Math.abs(m.landing - 14);
  const t = m.trustSatDay === '—' ? 20 : Math.abs(m.trustSatDay - 14);
  return l * 1.0 + t * 0.5;
}
candidates.sort((a, b) => score(a.m) - score(b.m));
const best = candidates[0];
console.log('==== 推奨候補（14日着地＋trust14日飽和に最も近い）====');
console.log(`  初期 angelFatigue = ${best.p.initFatigue} / trustGainScale = ${best.p.trustGainScale} / trustReductionRate = ${best.p.trustReductionRate}（rate据置） / trust cap = 60（据置）`);
console.log(`  balanced/中/なし: 14日目 fatigue=${best.m.f14} trust=${best.m.t14} / 概ね取れた=${best.m.landing}日目 / trust飽和=${best.m.trustSatDay}日目`);
console.log(`  推移: ${best.r.trace.join(' ')}`);
console.log(`  graph: ${spark(best.r.trace)}`);
console.log('');

// ---- 推奨候補の頑健性: 昼行動 × ケア成功度 × おあずけ ----
console.log('==== 推奨候補の頑健性（概ね取れた日／14日目fatigue）====');
console.log('  [昼行動別（中/なし）]');
for (const k of Object.keys(MIX)) {
  const r = simulate(best.p, { slots: MIX[k], successMult: 1.0, holdback: HOLD['なし'] });
  const m = metrics(r, 60);
  console.log(`    ${k.padEnd(10)}: 取れた=${String(m.landing).padStart(3)}日  14日目=${m.f14}`);
}
console.log('  [ケア成功度×おあずけ（balanced）]');
for (const succ of [['低',0.5],['中',1.0],['高',1.5]]) {
  const row = ['なし','時々','多め'].map((h) => {
    const r = simulate(best.p, { slots: MIX.balanced, successMult: succ[1], holdback: HOLD[h] });
    return `${h}=${String(metrics(r,60).landing).padStart(3)}日`;
  }).join('  ');
  console.log(`    ケア${succ[0]}: ${row}`);
}
