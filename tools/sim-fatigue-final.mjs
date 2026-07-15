/* =========================================================================
   sim-fatigue-final.mjs — 疲労値確定（A＋B＋D改）最終スイープ

   確定方針（DECISION_LOG「疲労値の最終方針」）:
     A : 初期 angelFatigue = 20（固定）
     B : eveningPrayerGain 4→ 5〜7 で探索（14日着地の本丸）
     D改: talk.trust / nightCare.trust は触らず（信頼パラメータ全体への波及回避）、
          trustReductionRate（疲労側だけに効く）を 0.01 から下げて探索
     C : 触らない（夜ケア回復量・range 0–20 据置）
   目標: balanced（標準プレイ）で 14日目に angelFatigue が概ね取れる（≤2）。

   実行: node tools/sim-fatigue-final.mjs
   ★ app.js は変えず、値の探索はここで行う。確定値は app.js の
     statsDefault.angelFatigue / FATIGUE_CONFIG.eveningPrayerGain / trustReductionRate に反映する。
   ========================================================================= */

'use strict';

const RANGE = { angelFatigue: [0, 20], mentalMargin: [0, 20] };
const FIXED = { restGain: 1, eveningPrayReduce: 1 };            // B以外の加算系（据置）
const NIGHTCARE = { trust: 2, angelFatigue: -2, mentalMargin: -2, bonusAngelFatigue: -2, bonusMentalMarginMin: 14 };
const SLEEP_MARGIN = 4, TALK_TRUST = 4, TRUST_CAP = 60;
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

// params: { initFatigue, eveningPrayerGain, trustReductionRate }
function simulate(params, { slots, successMult, holdback }) {
  const { initFatigue, eveningPrayerGain, trustReductionRate } = params;
  const gain = (base, trust) => Math.round(base * Math.max(0, 1 - trust * trustReductionRate));
  const s = { fatigue: initFatigue, trust: 0, margin: 10 };
  const cl = () => { s.fatigue = clamp(s.fatigue, RANGE.angelFatigue); s.trust = clamp(s.trust, [0, TRUST_CAP]); s.margin = clamp(s.margin, RANGE.mentalMargin); };
  const day = (a) => { if (a==='chores'){s.fatigue+=-2;s.margin+=-2;} else if(a==='pray'){s.margin+=-2;} else if(a==='talk'){s.trust+=TALK_TRUST;} else if(a==='rest'){s.margin+=4;s.fatigue+=gain(FIXED.restGain,s.trust);} };
  const eve = (a) => { if(a==='chores'){s.margin+=-2;} else if(a==='pray'){s.margin+=-2;s.fatigue+=-FIXED.eveningPrayReduce;} else if(a==='rest'){s.margin+=4;} };
  const trace=[], trustTrace=[];
  for (let d=1; d<=28; d++) {
    day(slots[0]); cl(); day(slots[1]); cl();
    s.fatigue += gain(params.eveningPrayerGain, s.trust); cl();   // B: 夕方の日課
    eve(slots[2]); cl();
    if (!holdback.has(d)) {
      const bonus = s.margin >= NIGHTCARE.bonusMentalMarginMin ? NIGHTCARE.bonusAngelFatigue : 0;
      const red = Math.round((Math.abs(NIGHTCARE.angelFatigue)+Math.abs(bonus))*successMult);
      s.fatigue += -red; s.trust += NIGHTCARE.trust; s.margin += NIGHTCARE.mentalMargin; cl();
    }
    s.margin += SLEEP_MARGIN; cl();
    trace.push(s.fatigue); trustTrace.push(s.trust);
  }
  return { trace, trustTrace };
}

const MIX = { balanced:['chores','talk','pray'], choreHeavy:['chores','chores','pray'], relax:['rest','talk','pray'], talkHeavy:['talk','talk','pray'] };
const HOLD = { なし:new Set(), 時々:new Set([7,14,21,28]), 多め:new Set([2,4,6,9,11,13,16,18,20,23,25,27]) };
const THRESHOLD = 2;
const spark = (t) => t.map(v=>'▁▂▃▄▅▆▇█'[Math.min(7,Math.round((v/20)*7))]).join('');
function met(r){ const f=r.trace.findIndex(v=>v<=THRESHOLD); const st=r.trustTrace.findIndex(v=>v>=TRUST_CAP); const tail=r.trace.slice(20); return {landing:f===-1?'—':f+1, f14:r.trace[13], t14:r.trustTrace[13], sat:st===-1?'—':st+1, tail:`${Math.min(...tail)}–${Math.max(...tail)}`}; }

// ---- A(20) × B(5,6,7) × D改(rate) スイープ。評価: balanced/中/なし ----
console.log('==== A=20 固定 × B(eveningPrayerGain) × D改(trustReductionRate) ====');
console.log('  目標: balanced/中/なし で「概ね取れた」≒14日目、28日目=0付近');
console.log('   B   rate    | 概ね取れた  14日目  28日目  trust飽和');
const results = [];
for (const B of [5,6,7]) for (const rate of [0.010,0.009,0.008,0.007,0.006,0.005]) {
  const p = { initFatigue:20, eveningPrayerGain:B, trustReductionRate:rate };
  const r = simulate(p, {slots:MIX.balanced, successMult:1.0, holdback:HOLD['なし']});
  const m = met(r);
  results.push({p,m,r});
  console.log(`   ${B}   ${rate.toFixed(3)}  |   ${String(m.landing).padStart(3)}日     ${String(m.f14).padStart(2)}     ${String(m.trace28=r.trace[27]).padStart(2)}      ${String(m.sat).padStart(3)}日`);
}
console.log('');

// ---- 推奨: landing が 14 に最も近い（14以下優先） ----
function score(m){ if(m.landing==='—') return 99; const d=m.landing-14; return d<=0 ? -d*0.5 : d; }
results.sort((a,b)=>score(a.m)-score(b.m));
const best = results[0];
console.log('==== 推奨確定値（balanced 14日着地に最も近い）====');
console.log(`  A: 初期 angelFatigue = ${best.p.initFatigue}`);
console.log(`  B: eveningPrayerGain = ${best.p.eveningPrayerGain}`);
console.log(`  D改: trustReductionRate = ${best.p.trustReductionRate}`);
console.log(`  balanced/中/なし: 概ね取れた=${best.m.landing}日目 / 14日目fatigue=${best.m.f14} / 28日目=${best.r.trace[27]} / trust飽和=${best.m.sat}日目`);
console.log(`  推移: ${best.r.trace.join(' ')}`);
console.log(`  graph: ${spark(best.r.trace)}`);
console.log('');
console.log('  [昼行動別（中/なし）着地日]');
for (const k of Object.keys(MIX)) { const m=met(simulate(best.p,{slots:MIX[k],successMult:1.0,holdback:HOLD['なし']})); console.log(`    ${k.padEnd(10)}: 取れた=${String(m.landing).padStart(3)}日  14日目=${m.f14}  28日目=`+simulate(best.p,{slots:MIX[k],successMult:1.0,holdback:HOLD['なし']}).trace[27]); }
console.log('  [ケア成功度×おあずけ（balanced）着地日]');
for (const s of [['低',0.5],['中',1.0],['高',1.5]]) { const row=['なし','時々','多め'].map(h=>`${h}=${String(met(simulate(best.p,{slots:MIX.balanced,successMult:s[1],holdback:HOLD[h]})).landing).padStart(3)}日`).join('  '); console.log(`    ケア${s[0]}: ${row}`); }
