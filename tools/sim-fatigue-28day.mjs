/* =========================================================================
   sim-fatigue-28day.mjs — angelFatigue 28日シミュレーション（数値検証専用）

   目的: 本体（app.js）を一切変えずに、angelFatigue の28日推移を検証する。
   実行:  node tools/sim-fatigue-28day.mjs

   ★ 本スクリプトは app.js の疲労ロジックを「写し取った」もの。
     下記の定数・式は app.js と一致させること（app.js を変えたらここも更新）。
     出典（app.js 2026-07-15 時点）:
       - statsDefault(app.js:173): angelFatigue=10, trust=0, mentalMargin=10, mentalMarginMax=20
       - statsRange(app.js:182): angelFatigue [0,20], trust [0,60]
       - FATIGUE_CONFIG(app.js:225): eveningPrayerGain=4, restGain=1, eveningPrayReduce=1, trustReductionRate=0.01
       - STAT_CONFIG(app.js:191): chores.angelFatigue=-2 / rest(加算はFATIGUE_CONFIG) /
         eveningPray.-eveningPrayReduce / nightCare{trust:2, angelFatigue:-2, mentalMargin:-2,
         bonusAngelFatigue:-2, bonusMentalMarginMin:14} / sleep.mentalMargin=4
       - fatigueGainAfterTrust(app.js:234): round(base * max(0, 1 - trust*trustReductionRate))
       - applyEveningPrayerDutyFatigue(app.js:1224): 夕方フェーズに入る瞬間に毎日1回、
         fatigueGainAfterTrust(eveningPrayerGain) を加算（プレイヤー行動と無関係）
       - applyNightCareStats(app.js:1230): 上記 nightCare。bonus は「加算前の mentalMargin>=14」で判定

   ★ 変更しない: FATIGUE_CONFIG の値は現状のまま。調整は「提案」として報告する（本タスクの厳守事項）。

   ★ モデリング上の仮定（現行コードに無い／将来設計を写したもの。報告する）:
     - ケア成功度: 現行コードの夜ケア回復は固定。将来のミニゲーム結果で回復量が変わる設計(D-20)を、
       夜ケアの疲労減少「量」に係数を掛けて表現する。中=×1.0=現行コードそのもの。低=×0.5 / 高=×1.5。
     - おあずけ: その夜は夜ケアをしない → 疲労減少なし・trust+2なし・mentalMargin-2なし。就寝(+4)は起こる。
     - 昼の行動構成は仮定（下記 DAY_MIXES）。疲労推移はこの構成に強く依存するため、感度も併記する。
   ========================================================================= */

'use strict';

// ---- app.js から写した定数（同期必須） ----
const STATS_INIT = { angelFatigue: 10, trust: 0, mentalMargin: 10 };
const RANGE = { angelFatigue: [0, 20], trust: [0, 60], mentalMargin: [0, 20] };
const FATIGUE_CONFIG = { eveningPrayerGain: 4, restGain: 1, eveningPrayReduce: 1, trustReductionRate: 0.01 };
const NIGHTCARE = { trust: 2, angelFatigue: -2, mentalMargin: -2, bonusAngelFatigue: -2, bonusMentalMarginMin: 14 };
const SLEEP_MARGIN = 4;

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const fatigueGainAfterTrust = (base, trust) =>
  Math.round(base * Math.max(0, 1 - trust * FATIGUE_CONFIG.trustReductionRate));

// ---- 昼の行動が (fatigue, trust, margin) に与える効果（app.js の apply*Stats を写す） ----
function applyDayAction(s, action) {
  switch (action) {
    case 'chores': s.fatigue += -2; s.margin += -2; break;         // chores.angelFatigue=-2, mentalMargin=-2
    case 'pray':   s.margin += -2; break;                          // 疲労に影響なし
    case 'talk':   s.trust += 4; break;                            // trust+4
    case 'rest':   s.margin += 4; s.fatigue += fatigueGainAfterTrust(FATIGUE_CONFIG.restGain, s.trust); break;
    default: break;
  }
}
function applyEveningAction(s, action) {
  switch (action) {
    case 'chores': s.margin += -2; break;                          // eveningChores: 疲労に影響なし
    case 'pray':   s.margin += -2; s.fatigue += -FATIGUE_CONFIG.eveningPrayReduce; break; // 日課を少し相殺
    case 'rest':   s.margin += 4; break;                           // 夕方restは加算対象外
    default: break;
  }
}
function clampAll(s) {
  s.fatigue = clamp(s.fatigue, RANGE.angelFatigue);
  s.trust = clamp(s.trust, RANGE.trust);
  s.margin = clamp(s.margin, RANGE.mentalMargin);
}

// ---- 昼の行動構成（仮定） ----
const DAY_MIXES = {
  balanced:   { label: '朝=家事 / 昼=話す / 夕=祈る（世話＋関係＋祈り）', slots: ['chores', 'talk', 'pray'] },
  choreHeavy: { label: '朝=家事 / 昼=家事 / 夕=祈る（世話中心）',        slots: ['chores', 'chores', 'pray'] },
  relax:      { label: '朝=休む / 昼=話す / 夕=祈る（主人公が休みがち）', slots: ['rest', 'talk', 'pray'] },
  talkHeavy:  { label: '朝=話す / 昼=話す / 夕=祈る（関係中心）',        slots: ['talk', 'talk', 'pray'] },
};

const SUCCESS = { 低: 0.5, 中: 1.0, 高: 1.5 };
// おあずけ日（day 1-28 のうち夜ケアをしない日）
const HOLDBACK = {
  なし:   () => new Set(),
  時々:   () => new Set([7, 14, 21, 28]),                         // 週1
  多め:   () => new Set([2, 4, 6, 9, 11, 13, 16, 18, 20, 23, 25, 27]), // 週3
};

function simulate({ dayMix, success, holdbackSet }) {
  const s = { fatigue: STATS_INIT.angelFatigue, trust: STATS_INIT.trust, margin: STATS_INIT.mentalMargin };
  const successMult = SUCCESS[success];
  const trace = []; // 各日終了時(就寝後)の fatigue
  const trustTrace = [];
  for (let day = 1; day <= 28; day++) {
    // 朝・昼（2枠は昼扱い）
    applyDayAction(s, dayMix.slots[0]); clampAll(s);
    applyDayAction(s, dayMix.slots[1]); clampAll(s);
    // 夕方フェーズに入る瞬間: 天使様の日課（毎日1回）
    s.fatigue += fatigueGainAfterTrust(FATIGUE_CONFIG.eveningPrayerGain, s.trust); clampAll(s);
    // 夕方の行動
    applyEveningAction(s, dayMix.slots[2]); clampAll(s);
    // 夜ケア（おあずけの夜は行わない）
    if (!holdbackSet.has(day)) {
      const bonus = s.margin >= NIGHTCARE.bonusMentalMarginMin ? NIGHTCARE.bonusAngelFatigue : 0; // 加算前marginで判定
      const reductionMag = Math.round((Math.abs(NIGHTCARE.angelFatigue) + Math.abs(bonus)) * successMult);
      s.fatigue += -reductionMag;
      s.trust += NIGHTCARE.trust;
      s.margin += NIGHTCARE.mentalMargin;
      clampAll(s);
    }
    // 就寝（毎晩）
    s.margin += SLEEP_MARGIN; clampAll(s);

    trace.push(s.fatigue);
    trustTrace.push(s.trust);
  }
  return { trace, trustTrace };
}

// ---- 判定・整形 ----
const THRESHOLD = 2; // 「概ね取れた」= angelFatigue <= 2（0–20スケール）
function judge(trace) {
  const firstBelow = trace.findIndex((v) => v <= THRESHOLD);
  const day14 = trace[13];
  const day28 = trace[27];
  const tail = trace.slice(20); // 21–28日目
  const tailMin = Math.min(...tail), tailMax = Math.max(...tail);
  const stuckAtZero = tail.every((v) => v === 0);
  return {
    firstBelowDay: firstBelow === -1 ? null : firstBelow + 1,
    day14, day28,
    tailRange: `${tailMin}–${tailMax}`,
    stuckAtZero,
  };
}
function spark(trace) {
  const chars = '▁▂▃▄▅▆▇█';
  return trace.map((v) => chars[Math.min(chars.length - 1, Math.round((v / 20) * (chars.length - 1)))]).join('');
}

// ---- 実行: 3×3 マトリクス（primary day-mix = balanced） ----
const primary = DAY_MIXES.balanced;
console.log('===== 28日 angelFatigue シミュレーション =====');
console.log(`初期値: angelFatigue=${STATS_INIT.angelFatigue} / trust=0 / mentalMargin=10  （範囲 fatigue 0–20）`);
console.log(`FATIGUE_CONFIG: eveningPrayerGain=4, restGain=1, eveningPrayReduce=1, trustReductionRate=0.01`);
console.log(`昼の行動構成（仮定・primary）: ${primary.label}`);
console.log(`「概ね取れた」閾値: angelFatigue <= ${THRESHOLD}`);
console.log(`ケア成功度係数: 低=×0.5 / 中=×1.0(=現行コード) / 高=×1.5   （中以外は将来ミニゲーム想定の提案的モデリング）`);
console.log('');

const SUCC_KEYS = ['低', '中', '高'];
const HOLD_KEYS = ['なし', '時々', '多め'];
for (const succ of SUCC_KEYS) {
  for (const hold of HOLD_KEYS) {
    const { trace, trustTrace } = simulate({ dayMix: primary, success: succ, holdbackSet: HOLDBACK[hold]() });
    const j = judge(trace);
    console.log(`--- ケア成功度=${succ} / おあずけ=${hold} ---`);
    console.log(`  fatigue: ${trace.join(' ').replace(/\b(\d)\b/g, ' $1')}`);
    console.log(`  graph  : ${spark(trace)}  (day1..28)`);
    console.log(`  trust  : d14=${trustTrace[13]}  d28=${trustTrace[27]}`);
    console.log(`  判定   : 14日目=${j.day14} / 28日目=${j.day28} / 概ね取れた=${j.firstBelowDay ? j.firstBelowDay + '日目' : '到達せず'} / 終盤(21-28)=${j.tailRange}${j.stuckAtZero ? '（0張り付き）' : ''}`);
    console.log('');
  }
}

// ---- 感度: day-mix を変えたとき（中 / おあずけなし で固定） ----
console.log('===== 感度: 昼の行動構成による違い（ケア成功度=中 / おあずけ=なし 固定）=====');
for (const key of Object.keys(DAY_MIXES)) {
  const dm = DAY_MIXES[key];
  const { trace } = simulate({ dayMix: dm, success: '中', holdbackSet: HOLDBACK['なし']() });
  const j = judge(trace);
  console.log(`--- ${key}: ${dm.label} ---`);
  console.log(`  graph : ${spark(trace)}  d14=${j.day14} d28=${j.day28} 概ね取れた=${j.firstBelowDay ? j.firstBelowDay + '日目' : '到達せず'}`);
}
