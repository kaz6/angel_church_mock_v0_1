/* =========================================================================
   ⚠️⚠️ 過去の記録用。現行の app.js とは乖離している ⚠️⚠️

   このファイルは **2026-07-29 以前の検証を再現するためのもの**であり、
   現在の実装を写したものではない。**このまま動かすと古い結論が出る。**

   ★ 最新のモデルは `tools/sim-final.mjs`。数値の検証はそちらで行うこと。
   ★ かつてここに書かれていた「app.js を変えたらここも更新すること」という自称は
     **取り下げる**。このファイルは意図的に当時のまま凍結してある。

   乖離している主な点（2026-07-29 の確定値の適用後）:
     - talk.trust: 4 → **3**
     - trustReductionRate: 0.009 → **0.01**
     - 7日目 nightHold の trust: 4 → **5**
     - restGain: 1 → **廃止（0）**
     - 夜ケアの疲労回復: 固定値＋余白ボーナス → **余白から導出**（段階5・2〜6）

   ========================================================================= */

/* =========================================================================
   sim-trust-28day.mjs — trust（信頼）28日シミュレーション【検証専用】

   目的: 本体（app.js）を一切変えずに、trust の28日推移と
         「おあずけ解禁（信頼9割）」の到達日を検証する。
   実行:  node tools/sim-trust-28day.mjs

   ★ 本スクリプトは app.js のロジックを「写し取った」もの。
     ※ 上記の注記のとおり、この一致はすでに崩れている（当時の記録）。
     出典（app.js 2026-07-29 時点 / データ駆動化ステップ3 適用後）:
       - statsDefault      : trust=0, angelFatigue=20, mentalMargin=10, mentalMarginMax=20
       - statsRange        : trust [0,60], angelFatigue [0,20]
       - STAT_CONFIG.talk  : trust +4
       - STAT_CONFIG.nightCare : trust +2, angelFatigue -2, mentalMargin -2,
                                 bonusAngelFatigue -2, bonusMentalMarginMin 14
       - STAT_CONFIG.chores: angelFatigue -2, mentalMargin -2
       - STAT_CONFIG.rest  : mentalMargin +4（＋FATIGUE_CONFIG.restGain の疲労加算）
       - STAT_CONFIG.sleep : mentalMargin +4
       - FATIGUE_CONFIG    : eveningPrayerGain 6, restGain 1, eveningPrayReduce 1,
                             trustReductionRate 0.009
       - fatigueGainAfterTrust : round(base * max(0, 1 - trust * trustReductionRate))
       - DAY_RULES day7    : night:'none' / nightHold.stats { trust: +4 }
                             （夜ケアを行わないため angelFatigue は回復せず、
                               nightCare の trust+2 / margin-2 も発生しない）

   ★ 値は一切変更しない。調整案は「提案」として報告する（本タスクの厳守事項）。

   ★ モデリング上の仮定（報告対象）:
     1) 1日目は固定オープニングで stats を動かさない（applyNightCareStats は
        enterNightCare からのみ＝day>=2）。自由行動は startFreePhase で
        2日目朝から。→ 本シミュは day1 を素通りし、day2〜28 を自由行動として回す。
        ※ 以前の疲労シミュ(sim-fatigue-28day.mjs)は day1 も自由行動として数えていたため、
          着地日が1日ずれる。比較用に旧方式も併記する。
     2) おあずけは行わない（4パターンとも毎晩ケアする。day7 のみ仕様で夜なし）。
     3) 夜ケアの成功度は「中」＝現行コードの固定値そのもの（係数1.0）。
     4) END_DAY は現状 7 だが、28日構成の検証のため 28 日まで回す。
   ========================================================================= */

'use strict';

// ---- app.js から写した定数（同期必須） ----
const STATS_INIT = { angelFatigue: 20, trust: 0, mentalMargin: 10 };
const RANGE = { angelFatigue: [0, 20], trust: [0, 60], mentalMargin: [0, 20] };
const FATIGUE_CONFIG = { eveningPrayerGain: 6, restGain: 1, eveningPrayReduce: 1, trustReductionRate: 0.009 };
const NIGHTCARE = { trust: 2, angelFatigue: -2, mentalMargin: -2, bonusAngelFatigue: -2, bonusMentalMarginMin: 14 };
const SLEEP_MARGIN = 4;
const TALK_TRUST = 4;

// DAY_RULES（app.js）から写した「夜なしの日」と、その日のステータス特例
const NIGHT_NONE_DAYS = new Map([
  [7, { trust: 4 }], // 告白の日。angelFatigue は宣言なし＝回復しない
]);

const TRUST_MAX = RANGE.trust[1];              // 60
const TRUST_UNLOCK_RATIO = 0.9;                // 仕様：9割
const TRUST_UNLOCK = TRUST_MAX * TRUST_UNLOCK_RATIO; // 54
const UNLOCK_MIN_DAY = 8;                      // 仕様：8日目以降

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const fatigueGainAfterTrust = (base, trust) =>
  Math.round(base * Math.max(0, 1 - trust * FATIGUE_CONFIG.trustReductionRate));

function applyDayAction(s, action) {
  switch (action) {
    case 'chores': s.fatigue += -2; s.margin += -2; break;
    case 'pray':   s.margin += -2; break;
    case 'talk':   s.trust += TALK_TRUST; break;
    case 'rest':   s.margin += 4; s.fatigue += fatigueGainAfterTrust(FATIGUE_CONFIG.restGain, s.trust); break;
    default: break;
  }
}
function applyEveningAction(s, action) {
  switch (action) {
    case 'chores': s.margin += -2; break;
    case 'pray':   s.margin += -2; s.fatigue += -FATIGUE_CONFIG.eveningPrayReduce; break;
    case 'rest':   s.margin += 4; break;
    case 'talk':   break; // 夕方は talk を出さない（getAvailableActionDefinitions）
    default: break;
  }
}
function clampAll(s) {
  s.fatigue = clamp(s.fatigue, RANGE.angelFatigue);
  s.trust = clamp(s.trust, RANGE.trust);
  s.margin = clamp(s.margin, RANGE.mentalMargin);
}

// ---- プレイスタイル（朝 / 昼 / 夕） ----
const PATTERNS = {
  balanced:  { label: 'balanced（基準）朝=家事 / 昼=話す / 夕=祈る', slots: ['chores', 'talk', 'pray'] },
  talkHeavy: { label: '会話重視     朝=話す / 昼=話す / 夕=祈る', slots: ['talk', 'talk', 'pray'] },
  choreHeavy:{ label: '家事重視     朝=家事 / 昼=家事 / 夕=祈る', slots: ['chores', 'chores', 'pray'] },
  passive:   { label: '受け身       朝=休む / 昼=休む / 夕=休む', slots: ['rest', 'rest', 'rest'] },
};

/**
 * @param {object} opts
 *  - slots: [morning, noon, evening]
 *  - day7TrustBonus: 7日目 night_hold の trust 加算（既定 4。0 にすると影響を測れる）
 *  - startDay: 自由行動の開始日（既定 2＝現行仕様。1 にすると旧シミュ準拠）
 *  - day7NightCare: true にすると7日目も通常の夜ケアを行う（＝ステップ3前の挙動。内訳分析用）
 */
function simulate({ slots, day7TrustBonus = 4, startDay = 2, day7NightCare = false }) {
  const s = { fatigue: STATS_INIT.angelFatigue, trust: STATS_INIT.trust, margin: STATS_INIT.mentalMargin };
  const trust = [];   // 各日終了時（就寝後）
  const fatigue = [];

  for (let day = 1; day <= 28; day++) {
    if (day < startDay) {
      // 1日目：固定オープニング。stats は動かない（夕方の日課も advanceTime を通らない）
      trust.push(s.trust); fatigue.push(s.fatigue);
      continue;
    }

    // 朝・昼
    applyDayAction(s, slots[0]); clampAll(s);
    applyDayAction(s, slots[1]); clampAll(s);

    // 夕方フェーズに入る瞬間：天使様の日課（毎日1回）
    s.fatigue += fatigueGainAfterTrust(FATIGUE_CONFIG.eveningPrayerGain, s.trust); clampAll(s);

    // 夕方の行動
    applyEveningAction(s, slots[2]); clampAll(s);

    // 夜
    const nightNone = day7NightCare && day === 7 ? undefined : NIGHT_NONE_DAYS.get(day);
    if (nightNone) {
      // 夜なしの日：定義側の stats のみ適用（angelFatigue は宣言がないので回復しない）
      const bonus = day === 7 ? day7TrustBonus : (nightNone.trust || 0);
      s.trust += bonus;
      clampAll(s);
    } else {
      const bonus = s.margin >= NIGHTCARE.bonusMentalMarginMin ? NIGHTCARE.bonusAngelFatigue : 0;
      s.fatigue += NIGHTCARE.angelFatigue + bonus;
      s.trust += NIGHTCARE.trust;
      s.margin += NIGHTCARE.mentalMargin;
      clampAll(s);
    }

    // 就寝
    s.margin += SLEEP_MARGIN; clampAll(s);

    trust.push(s.trust); fatigue.push(s.fatigue);
  }
  return { trust, fatigue };
}

// ---- 判定 ----
const firstDay = (arr, pred) => {
  const i = arr.findIndex(pred);
  return i === -1 ? null : i + 1;
};
const unlockDay = (trustTrace) => {
  const hit = firstDay(trustTrace, (v) => v >= TRUST_UNLOCK);
  if (hit === null) return null;
  return Math.max(hit, UNLOCK_MIN_DAY); // 8日目以降の条件
};
const judgeUnlock = (d) => {
  if (d === null) return '28日内に未到達';
  if (d <= 9) return '早すぎる';
  if (d <= 13) return '★目標圏（10〜13日目）';
  return '遅い（14日目以降＝落差が出ない）';
};

const fmtRow = (arr) => arr.map((v) => String(v).padStart(2)).join(' ');

console.log('='.repeat(78));
console.log('trust 28日シミュレーション（値は現行のまま・変更なし）');
console.log(`信頼の上限 ${TRUST_MAX} / 解禁閾値 9割 = ${TRUST_UNLOCK} / 解禁は ${UNLOCK_MIN_DAY}日目以降`);
console.log('='.repeat(78));

const results = {};
for (const [key, p] of Object.entries(PATTERNS)) {
  const base = simulate({ slots: p.slots });
  const noBonus = simulate({ slots: p.slots, day7TrustBonus: 0 });
  results[key] = { p, base, noBonus };

  const uD = unlockDay(base.trust);
  const uD0 = unlockDay(noBonus.trust);
  const fat2 = firstDay(base.fatigue, (v) => v <= 2);
  const fat0 = firstDay(base.fatigue, (v) => v === 0);

  console.log('');
  console.log(`■ ${p.label}`);
  console.log(`  日   : ${fmtRow([...Array(28)].map((_, i) => i + 1))}`);
  console.log(`  trust: ${fmtRow(base.trust)}`);
  console.log(`  疲労 : ${fmtRow(base.fatigue)}`);
  console.log(`  → 信頼9割(${TRUST_UNLOCK})到達: ${uD ?? '—'}日目   判定: ${judgeUnlock(uD)}`);
  console.log(`  → 7日目 +4 を 0 にすると    : ${uD0 ?? '—'}日目（差 ${uD && uD0 ? uD0 - uD : '—'}日）`);
  console.log(`  → angelFatigue <=2 到達: ${fat2 ?? '—'}日目 / ==0 到達: ${fat0 ?? '—'}日目 / 28日目=${base.fatigue[27]}`);
}

// ---- 7日目 +4 の影響（trust 値そのものの差） ----
console.log('');
console.log('='.repeat(78));
console.log('7日目 +4 の影響（trust 値の差 / 上段=+4あり, 下段=+4なし）');
console.log('='.repeat(78));
for (const [key, r] of Object.entries(results)) {
  const d = r.base.trust.map((v, i) => v - r.noBonus.trust[i]);
  console.log(`  ${r.p.label.split('（')[0].trim().padEnd(10)} 7日目以降の差: +${Math.max(...d)}（上限到達後は差が消える: ${d[27]}）`);
}

// ---- 旧シミュ準拠（1日目も自由行動）との比較：疲労着地の互換確認 ----
console.log('');
console.log('='.repeat(78));
console.log('参考：疲労着地の比較（balanced）');
console.log('='.repeat(78));
{
  const now = simulate({ slots: PATTERNS.balanced.slots, startDay: 2 });
  const old = simulate({ slots: PATTERNS.balanced.slots, startDay: 1 });
  const f = (t) => `<=2:${firstDay(t.fatigue, (v) => v <= 2) ?? '—'}日目 / ==0:${firstDay(t.fatigue, (v) => v === 0) ?? '—'}日目 / 14日目=${t.fatigue[13]}`;
  console.log(`  本シミュ（1日目=OP・自由行動は2日目〜・7日目は夜なし）: ${f(now)}`);
  console.log(`  旧シミュ準拠（1日目も自由行動として数える）          : ${f(old)}`);
  const old7 = simulate({ slots: PATTERNS.balanced.slots, startDay: 1, day7TrustBonus: 0 });
  console.log(`  旧シミュ準拠かつ7日目も通常の夜ケア相当（参考値）    : trust9割 ${unlockDay(old7.trust) ?? '—'}日目`);
}

// ---- 疲労着地のズレの内訳（条件を1つずつ変える） ----
console.log('');
console.log('='.repeat(78));
console.log('balanced の疲労着地：ズレの内訳（条件を1つずつ変えて切り分け）');
console.log('='.repeat(78));
{
  const B = PATTERNS.balanced.slots;
  const show = (label, opts) => {
    const r = simulate({ slots: B, ...opts });
    console.log(
      `  ${label.padEnd(44)} <=2:${String(firstDay(r.fatigue, (v) => v <= 2) ?? '—').padStart(2)}日目` +
      ` / ==0:${String(firstDay(r.fatigue, (v) => v === 0) ?? '—').padStart(2)}日目` +
      ` / 14日目=${String(r.fatigue[13]).padStart(2)}` +
      ` / 信頼9割:${String(unlockDay(r.trust) ?? '—').padStart(2)}日目`
    );
  };
  show('A 疲労確定時の条件（day1も自由行動 / 7日目も夜ケア）', { startDay: 1, day7NightCare: true });
  show('B A に「7日目を夜なし」だけ追加', { startDay: 1 });
  show('C B に「day1はOP扱い」を追加＝現行の正確なモデル', { startDay: 2 });
}
console.log('');
