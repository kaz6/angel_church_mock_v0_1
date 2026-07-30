/* =========================================================================
   sim-margin-gate.mjs — 余白の制約を入れた 255スケール再探索【検証専用】

   実行:  node tools/sim-margin-gate.mjs

   ★ 本体（app.js）は一切変更しない。値の差し替えはすべて本スクリプト内。
   ★ 「休む」に angelFatigue の直接軽減は入れない（レバーCは却下済み）。

   前回（sim-255.mjs）からの重要な変更:
     ★「止める」の振る舞いを確定仕様に合わせた。
       前回モデル : 枠は進むが余白は変わらない（＝ただの機会損失）
       今回モデル : **「休む」として扱う。余白は回復する（+4）**
       これは効きの強さが全く違う。前回「効きすぎた」のはこの差が原因。
     ★ 0クランプの漏れを計測する（負に振れた分をクランプが何回・何ポイント吸収したか）。

   確定済みで据え置くもの:
     angelFatigue [0,20] 初期20 / eveningPrayerGain 6 / 「休む」の疲労加算なし
     心身の余白 [0,20] 初期10 / 夜ケアの回復は余白から導出（段階5・2〜6）
     夜ケアの余白消費 -2 / 就寝の余白回復 +4 / 255スケールへの移行は確定
     形は flat（逓減は行動回数が少ない軸に効かないと前回確定）

   モデリング仮定（踏襲。実機と1〜7日目が全一致することを確認済み）:
     1日目は素通り / 7日目は夜なし（trust のみ +）/ 21日目も夜なし（何も動かない）
     14日目は night:'force'（現状は実行時の効果なし）/ 28日目の夜で終了
   ========================================================================= */

'use strict';

const MAX = 255;
const FAT = [0, 20];
const MRG = [0, 20];
const EVENING_PRAYER_GAIN = 6;
const EVENING_PRAY_REDUCE = 1;
const SLEEP_MARGIN = 4;
const NIGHTCARE_MARGIN = -2;
const CHORES_FATIGUE = -2;
const REST_MARGIN = 4;
const DAYS = 28;

// 信頼は比例移行（60→255 は ×4.25）。★疲労軽減の係数も比例させる
const TRUST = {
  talk: 13, night: 8, day7: 21, unlock: 212,
  rate: 0.6 / MAX, // = 0.002353。忘れると係数が負になり疲労の加算が止まる
};

function careRecovery(margin) {
  const band = Math.min(4, Math.floor(margin / 4));
  return -Math.round(2 + (4 * band) / 4);
}

/* ---- 余白の帯（★今回の探索対象） ----
   低い  … 天使様が止めて休ませる。**「休む」として扱う（余白は +4 回復）**
   中    … 効果が midRate 倍になる（「疲れていてうまくできない」）
   十分  … そのまま */
function marginBand(margin, band) {
  if (margin <= band.lowMax) return 'low';
  if (margin <= band.midMax) return 'mid';
  return 'high';
}

function makeSim(cfg) {
  const gainAfterTrust = (base, trust) =>
    Math.round(base * Math.max(0, 1 - trust * TRUST.rate));

  // ★余白を足し引きする唯一の入口。0 クランプが負を吸収した分を計測する
  function addMargin(s, delta) {
    const before = s.margin;
    const raw = before + delta;
    if (raw < MRG[0]) {
      s.clamp.count += 1;
      s.clamp.absorbed += MRG[0] - raw; // クランプがタダで生んだ余白
    }
    if (raw > MRG[1]) s.clamp.overflow += raw - MRG[1];
    s.margin = Math.min(MRG[1], Math.max(MRG[0], raw));
  }

  function applySlot(s, action, slot) {
    const evening = slot === 'evening';
    if (action === 'rest') { addMargin(s, REST_MARGIN); s.counts.rest += 1; return; }
    if (action === 'talk') {
      // 会話は余白を消費しないので制約の対象外
      s.trust = Math.min(MAX, s.trust + TRUST.talk);
      s.counts.talk += 1;
      return;
    }
    // 家事・祈るは余白を消費する行動 ＝ 制約の対象
    const b = marginBand(s.margin, cfg.band);
    if (b === 'low') {
      // ★天使様が止めて休ませる。枠は消費されるが、余白は回復する
      addMargin(s, REST_MARGIN);
      s.counts.blocked += 1;
      return;
    }
    const mult = b === 'mid' ? cfg.band.midRate : 1;
    if (action === 'chores') {
      const base = evening ? cfg.careEvening : cfg.careDay;
      s.care = Math.min(MAX, s.care + Math.round(base * mult));
      addMargin(s, -2);
      if (!evening) s.fatigue = Math.max(FAT[0], s.fatigue + CHORES_FATIGUE);
      s.counts.chores += 1;
      return;
    }
    if (action === 'pray') {
      const base = evening ? cfg.prayEvening : cfg.prayDay;
      const bonus = s.fatigue <= 6 ? cfg.prayBonus : 0;
      s.pray = Math.min(MAX, s.pray + Math.round((base + bonus) * mult));
      addMargin(s, -2);
      if (evening) s.fatigue = Math.max(FAT[0], s.fatigue - EVENING_PRAY_REDUCE);
      s.counts.pray += 1;
      return;
    }
  }

  function run(slots) {
    const s = {
      fatigue: 20, margin: 10, trust: 0, pray: 0, care: 0,
      counts: { chores: 0, pray: 0, rest: 0, talk: 0, blocked: 0, nightCare: 0 },
      clamp: { count: 0, absorbed: 0, overflow: 0 },
    };
    const trace = [];
    const snap = () => ({
      fatigue: s.fatigue, margin: s.margin, trust: s.trust, pray: s.pray, care: s.care,
    });
    for (let day = 1; day <= DAYS; day++) {
      if (day === 1) { trace.push({ day, ...snap() }); continue; }
      const pick = typeof slots === 'function' ? slots(day, s) : slots;
      applySlot(s, pick[0], 'morning');
      applySlot(s, pick[1], 'noon');
      s.fatigue = Math.min(FAT[1], s.fatigue + gainAfterTrust(EVENING_PRAYER_GAIN, s.trust));
      applySlot(s, pick[2], 'evening');

      if (day === 7) {
        s.trust = Math.min(MAX, s.trust + TRUST.day7);
      } else if (day === 21) {
        // 葬儀。夜なしで stats を宣言していないので何も動かない
      } else {
        s.fatigue = Math.max(FAT[0], s.fatigue + careRecovery(s.margin));
        s.trust = Math.min(MAX, s.trust + TRUST.night);
        addMargin(s, NIGHTCARE_MARGIN);
        s.counts.nightCare += 1;
      }
      addMargin(s, SLEEP_MARGIN);
      trace.push({ day, ...snap() });
    }
    return { trace, counts: s.counts, clamp: s.clamp, end: snap() };
  }
  return { run };
}

/* ---- パターン（★旧 balanced を「最大労働」に改名） ---- */
const PATTERNS = {
  休息家事: ['rest', 'chores', 'pray'],   // ★新しい基準
  最大労働: ['chores', 'talk', 'pray'],   // 旧 balanced
  家事重視: ['chores', 'chores', 'pray'],
  祈り重視: ['pray', 'pray', 'pray'],
  会話重視: ['talk', 'talk', 'pray'],
  休息重視: ['rest', 'talk', 'pray'],
  受け身: ['rest', 'rest', 'rest'],
  // ★実際のプレイに近い形：朝を「休む」と「話す」で日替わりにする
  //   3枠しかないため、家事・祈り・休む・話す の4つは同じ日に揃えられない。
  //   「どの日に何を捨てるか」を混ぜるのが現実的なプレイになる。
  交互: (day) => [day % 2 === 0 ? 'rest' : 'talk', 'chores', 'pray'],
  // 休む2日に対して話す1日（休み寄りの混合）
  休み寄り: (day) => [day % 3 === 0 ? 'talk' : 'rest', 'chores', 'pray'],
};

const firstDay = (trace, key, th) => {
  const i = trace.findIndex((t) => t[key] >= th);
  return i === -1 ? null : i + 1;
};
const pad = (v, n = 2) => String(v ?? '—').padStart(n);
const aliveDays = (trace, key) => trace.slice(1).filter((t) => t[key] < MAX).length;

function evaluate(cfg) {
  const sim = makeSim(cfg);
  const out = {};
  for (const [name, slots] of Object.entries(PATTERNS)) {
    const r = sim.run(slots);
    out[name] = {
      trustUnlock: (() => { const d = firstDay(r.trace, 'trust', TRUST.unlock); return d === null ? null : Math.max(d, 8); })(),
      fatigueLand: firstDay(r.trace.map((t) => ({ v: -t.fatigue })), 'v', -2),
      prayGate: firstDay(r.trace, 'pray', cfg.gate),
      careGate: firstDay(r.trace, 'care', cfg.gate),
      prayAlive: aliveDays(r.trace, 'pray'),
      careAlive: aliveDays(r.trace, 'care'),
      avgMargin: Math.round(r.trace.slice(1).reduce((a, t) => a + t.margin, 0) / (DAYS - 1)),
      counts: r.counts, clamp: r.clamp, end: r.end, trace: r.trace,
    };
  }
  return out;
}

const inR = (v, a, b) => v !== null && v >= a && v <= b;

// 目標（タスク3の表）
function goals(o) {
  return {
    休息家事が両ゲート24to28: inR(o.休息家事.prayGate, 24, 28) && inR(o.休息家事.careGate, 24, 28),
    最大労働は制約で成立しない: o.最大労働.counts.blocked > 0,
    家事重視は世話役に届かないかギリギリ: o.家事重視.careGate === null || o.家事重視.careGate >= 24,
    祈り重視は早く到達: o.祈り重視.prayGate !== null && o.休息家事.prayGate !== null
      && o.祈り重視.prayGate < o.休息家事.prayGate,
    会話重視は片方のみか未到達: o.会話重視.careGate === null,
    受け身は未到達: o.受け身.prayGate === null && o.受け身.careGate === null,
  };
}

/* ================================================================= */
console.log('='.repeat(104));
console.log('余白の制約を入れた 255スケール再探索（本体コードは未変更）');
console.log('★「止める」＝枠は消費するが**余白は回復する**（+4）。前回モデルとの最大の違い');
console.log('='.repeat(104));

/* ===== まず：余白の収支がパターンごとにどうなるか ===== */
console.log('');
console.log('■ 1日あたりの余白の収支（制約なしで単純計算した場合）');
console.log('  夜の純増：就寝 +4 ＋ 夜ケア -2 ＝ **+2**');
const daily = (slots) => slots.reduce((a, x) => a + (x === 'rest' ? 4 : x === 'talk' ? 0 : -2), 0) + 2;
for (const [name, slots] of Object.entries(PATTERNS)) {
  if (typeof slots === 'function') { console.log(`  ${name.padEnd(5)} （日替わりの混合。日計は日によって変わる）`); continue; }
  const d = daily(slots);
  console.log(`  ${name.padEnd(5)} ${slots.join('/').padEnd(20)} 日計 ${d >= 0 ? '+' : ''}${d}/日  ${d >= 0 ? '← 余白が増える＝制約に当たらない' : '← 余白が減る＝制約に当たる'}`);
}
console.log('');
console.log('★これが今回の要点。**休息＋家事は +2/日で余白が増え、最大労働と家事重視は減る。**');
console.log('  制約を入れると、この符号の違いがそのまま有利不利になる。');

/* ===== 帯の値 × スコアの加算量を探索 ===== */
const BANDS = [];
for (const lowMax of [1, 2, 3, 4, 5]) {
  for (const midMax of [7, 9, 11, 13]) {
    for (const midRate of [0.5, 0.7]) {
      if (midMax <= lowMax) continue;
      BANDS.push({ lowMax, midMax, midRate });
    }
  }
}

const results = [];
for (const band of BANDS) {
  for (const gate of [180, 200, 220]) {
    for (const careDay of [8, 10, 12, 14, 16, 18]) {
      for (const prayEvening of [7, 9, 11, 13, 15, 17]) {
        const cfg = {
          band, gate,
          careDay, careEvening: Math.round(careDay * 0.5),
          prayDay: Math.round(prayEvening * 0.67), prayEvening, prayBonus: 2,
        };
        const o = evaluate(cfg);
        const g = goals(o);
        results.push({ cfg, o, g, ok: Object.values(g).every(Boolean) });
      }
    }
  }
}

console.log('');
console.log('='.repeat(104));
console.log(`【探索】帯 ${BANDS.length}種 × ゲート3種 × 家事6種 × 祈り6種 = ${results.length}通り`);
console.log('='.repeat(104));
const hits = results.filter((r) => r.ok);
console.log(`→ 目標6項目すべてを満たす組み合わせ：**${hits.length}件**`);
if (hits.length) {
  console.log('');
  console.log('  低≤ 中≤ 減率 ゲート 家事 祈夕 | 休息家事 祈/世 | 最大労働 止め 祈/世 | 家事重視 世 | 祈り重視 祈');
  console.log('  ' + '-'.repeat(100));
  // 「効きすぎない」＝最大労働が止められる回数が少ない順（＝ぎりぎり成立しない程度）
  const ranked = [...hits].sort((a, b) => a.o.最大労働.counts.blocked - b.o.最大労働.counts.blocked);
  for (const r of ranked.slice(0, 20)) {
    const c = r.cfg, o = r.o;
    console.log(
      `  ${pad(c.band.lowMax)} ${pad(c.band.midMax)} ${c.band.midRate.toFixed(1)}  ${pad(c.gate, 4)}  ${pad(c.careDay)}  ${pad(c.prayEvening)}  ` +
      `|  ${pad(o.休息家事.prayGate)}日/${pad(o.休息家事.careGate)}日  ` +
      `|  ${pad(o.最大労働.counts.blocked)}回 ${pad(o.最大労働.prayGate)}/${pad(o.最大労働.careGate)}  ` +
      `|   ${pad(o.家事重視.careGate)}日   |   ${pad(o.祈り重視.prayGate)}日`);
  }
  if (ranked.length > 20) console.log(`  …他 ${ranked.length - 20}件`);
}

/* ===== 詳細表示 ===== */
function detail(title, cfg) {
  const o = evaluate(cfg);
  const g = goals(cfg ? o : o);
  console.log('');
  console.log(`■ ${title}`);
  console.log(`  帯：余白 0-${cfg.band.lowMax} → 止める（休むとして扱う・余白+4）／` +
    `${cfg.band.lowMax + 1}-${cfg.band.midMax} → 効果 ×${cfg.band.midRate}／${cfg.band.midMax + 1}-20 → そのまま`);
  console.log(`  加算：家事 +${cfg.careDay}（夕方 +${cfg.careEvening}）／祈り 夕方 +${cfg.prayEvening}（昼 +${cfg.prayDay}、ボーナス +${cfg.prayBonus}）／ゲート ${cfg.gate}`);
  console.log('  パターン    家事 祈り 会話 休む 止め | 平均余白 | 祈りゲート 世話役ゲート | 信頼解禁 疲労着地 | 生きてる日数 祈/世 | 0クランプ');
  for (const name of Object.keys(PATTERNS)) {
    const x = o[name], c = x.counts;
    console.log(`  ${name.padEnd(5)}     ${pad(c.chores)}  ${pad(c.pray)}  ${pad(c.talk)}  ${pad(c.rest)}  ${pad(c.blocked)} |    ${pad(x.avgMargin)}    ` +
      `|   ${pad(x.prayGate)}日      ${pad(x.careGate)}日     |  ${pad(x.trustUnlock)}日    ${pad(x.fatigueLand)}日   ` +
      `|    ${pad(x.prayAlive)}/${pad(x.careAlive)}       | ${pad(x.clamp.count)}回(${pad(x.clamp.absorbed)}pt)`);
  }
  const ng = Object.entries(g).filter(([, v]) => !v).map(([k]) => k);
  console.log(`  → 目標: ${ng.length === 0 ? '★6項目すべて満たす' : '×（未達: ' + ng.join(' / ') + '）'}`);
  return o;
}

if (hits.length) {
  console.log('');
  console.log('='.repeat(104));
  console.log('【推奨候補の詳細】最大労働が止められる回数が少ない順（＝効きすぎていない順）に上位3件');
  console.log('='.repeat(104));
  const ranked = [...hits].sort((a, b) => a.o.最大労働.counts.blocked - b.o.最大労働.counts.blocked);
  for (const r of ranked.slice(0, 3)) detail('候補', r.cfg);
}

/* ===== 0クランプの漏れの確認 ===== */
console.log('');
console.log('='.repeat(104));
console.log('【0クランプの穴】制約を入れても 0 に張り付く経路が残っているか');
console.log('='.repeat(104));
console.log('  ※ addMargin() を余白の唯一の入口にして、負に振れた分を計測している');
console.log('  ※ 昼の行動は制約で止まるが、**夜ケアの -2 は止まらない**（プレイヤーの行動ではないため）');
{
  const cfg = hits.length ? hits.sort((a, b) => a.o.最大労働.counts.blocked - b.o.最大労働.counts.blocked)[0].cfg
    : { band: { lowMax: 3, midMax: 11, midRate: 0.5 }, gate: 200, careDay: 12, careEvening: 6, prayDay: 7, prayEvening: 11, prayBonus: 2 };
  const o = evaluate(cfg);
  console.log('');
  console.log('  パターン    0クランプ発生 | 吸収した量 | 上限20での溢れ');
  for (const name of Object.keys(PATTERNS)) {
    const x = o[name];
    console.log(`  ${name.padEnd(5)}       ${pad(x.clamp.count)}回      |  ${pad(x.clamp.absorbed, 3)}pt   |  ${pad(x.clamp.overflow, 3)}pt`);
  }
}
console.log('');

/* ================================================================================
   【最終】3枠の取り合いと、目標ごとに基準パターンが違ってしまう問題
   ================================================================================ */
const REC = {
  band: { lowMax: 2, midMax: 7, midRate: 0.5 },
  gate: 200,
  careDay: 8, careEvening: 4,
  prayDay: 5, prayEvening: 7, prayBonus: 2,
};

console.log('='.repeat(104));
console.log('【最終】★推奨：帯 0-2=止める／3-7=効果×0.5／8-20=そのまま ＋ ゲート200 / 家事+8 / 夕方の祈り+7');
console.log('='.repeat(104));
const o = evaluate(REC);

console.log('');
console.log('■ ★構造：昼は3枠しかないので「家事・祈り・休む・話す」の4つは同じ日に揃わない');
console.log('  両ゲートに届くには **家事＋祈りで2枠が固定**される。残る1枠を「休む」か「話す」に振るしかない。');
console.log('');
console.log('  残り1枠の使い方   | 両ゲート | 信頼解禁 | 疲労着地 | 止められた | 平均余白');
for (const [name, label] of [['休息家事', '毎日 休む      '], ['交互', '日替わり（半々）'], ['休み寄り', '休む2:話す1  '], ['最大労働', '毎日 話す      ']]) {
  const x = o[name];
  const both = x.prayGate !== null && x.careGate !== null ? `${pad(x.prayGate)}/${pad(x.careGate)}日` : ' 未到達 ';
  console.log(`  ${label} | ${both} |  ${pad(x.trustUnlock)}日   |  ${pad(x.fatigueLand)}日   |    ${pad(x.counts.blocked)}回    |   ${pad(x.avgMargin)}`);
}
console.log('');
console.log('  → **「休む」を取ると余白が持ってゲートに届くが、信頼の解禁が遅れる。**');
console.log('  → **「話す」を取ると信頼は早いが、余白が持たず止められてゲートに届かない。**');
console.log('  → 日替わりで混ぜると両方に届き、信頼解禁も中間に来る。★これが一番「そこそこ」に見える形。');

console.log('');
console.log('■ ⚠️ 目標ごとに、それを満たすパターンが違う');
console.log('  目標                        | 満たすパターン');
{
  const ok = (pred) => Object.keys(PATTERNS).filter((k) => pred(o[k])).join(', ') || 'なし';
  console.log(`  両ゲートが24〜28日目          | ${ok((x) => inR(x.prayGate, 24, 28) && inR(x.careGate, 24, 28))}`);
  console.log(`  疲労の着地が12〜16日目        | ${ok((x) => inR(x.fatigueLand, 12, 16))}`);
  console.log(`  信頼の解禁が10〜13日目        | ${ok((x) => inR(x.trustUnlock, 10, 13))}`);
  console.log(`  上の3つを同時に満たす        | ${ok((x) => inR(x.prayGate, 24, 28) && inR(x.careGate, 24, 28) && inR(x.fatigueLand, 12, 16) && inR(x.trustUnlock, 10, 13))}`);
}
console.log('');
console.log('  ★**同時に満たすパターンは存在しない。** 理由は2つとも構造的：');
console.log('   ① 疲労：休むと余白が高く保たれ、夜ケアの回復が最大（-6）になる。');
console.log('      → **休むプレイは疲労が9〜10日目に着地する**（12〜16日目より早い）。');
console.log('      → 回復量は「余白から導出」で確定済みなので、ここは触れない。');
console.log('   ② 信頼：解禁は会話の回数でほぼ決まる。会話を捨てると夜ケアの +8 だけになり27日目。');
console.log('      → **休むプレイは信頼の解禁が遅れる**（10〜13日目より遅い）。');
console.log('');
console.log('■ 疲労の日次推移（推奨値）');
for (const name of ['休息家事', '交互', '最大労働']) {
  console.log(`  ${name.padEnd(5)} ${o[name].trace.map((t) => String(t.fatigue).padStart(2)).join(' ')}`);
}
console.log('');
console.log('■ 心身の余白の日次推移（推奨値）★制約が効いているか目視する');
for (const name of ['休息家事', '交互', '最大労働', '家事重視']) {
  console.log(`  ${name.padEnd(5)} ${o[name].trace.map((t) => String(t.margin).padStart(2)).join(' ')}`);
}
console.log('');
