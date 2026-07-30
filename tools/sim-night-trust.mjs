/* =========================================================================
   sim-night-trust.mjs — 夜ケアの信頼増加を上げて再探索【検証専用】

   実行:  node tools/sim-night-trust.mjs

   ★ 本体（app.js）は一切変更しない。値の差し替えはすべて本スクリプト内。
   ★ 「休む」に angelFatigue の直接軽減は入れない（レバーCは却下済み）。
   ★ 夜ケアの**疲労側の回復量は触らない**。信頼への加算だけを変える。

   確定値（2026-07-29。この値は変えない）:
     余白の帯   … 0-2 → 止める（休むとして扱う・余白+4）／3-7 → 効果×0.5／8-20 → そのまま
     ゲート閾値 … 200（上限255）
     家事       … +8（夕方は +4）
     夕方の祈り … +7（＋ボーナス +2、昼は +5）
     angelFatigue [0,20] 初期20 / 心身の余白 [0,20] 初期10
     夜ケアの疲労回復は余白から導出（段階5・2〜6）／余白消費 -2 ／就寝 +4

   今回の探索対象:
     夜ケアの信頼増加（現状 +8）。必要なら talk（現状 +13）を下げる案も試す。

   モデリング仮定（踏襲。実機と1〜7日目が全一致することを確認済み）:
     1日目は素通り / 7日目は夜なし（trust のみ +21）/ 21日目も夜なし（何も動かない）
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

// 確定値
const BAND = { lowMax: 2, midMax: 7, midRate: 0.5 };
const GATE = 200;
const SCORE = { careDay: 8, careEvening: 4, prayDay: 5, prayEvening: 7, prayBonus: 2 };
const TRUST_UNLOCK = 212;      // 60スケールの50を比例移行した値
const TRUST_DAY7 = 21;         // 7日目 nightHold
const TRUST_RATE = 0.6 / MAX;  // 疲労軽減の係数（比例移行）

const careRecovery = (margin) => -Math.round(2 + (4 * Math.min(4, Math.floor(margin / 4))) / 4);
const bandOf = (m) => (m <= BAND.lowMax ? 'low' : m <= BAND.midMax ? 'mid' : 'high');

function makeSim(cfg) {
  const gainAfterTrust = (base, trust) =>
    Math.round(base * Math.max(0, 1 - trust * TRUST_RATE));

  function addMargin(s, d) {
    const raw = s.margin + d;
    if (raw < MRG[0]) { s.clamp.count += 1; s.clamp.absorbed += MRG[0] - raw; }
    s.margin = Math.min(MRG[1], Math.max(MRG[0], raw));
  }

  function applySlot(s, action, slot) {
    const evening = slot === 'evening';
    if (action === 'rest') { addMargin(s, REST_MARGIN); s.counts.rest += 1; return; }
    if (action === 'talk') { s.trust = Math.min(MAX, s.trust + cfg.talk); s.counts.talk += 1; return; }
    const b = bandOf(s.margin);
    if (b === 'low') { addMargin(s, REST_MARGIN); s.counts.blocked += 1; return; }
    const mult = b === 'mid' ? BAND.midRate : 1;
    if (action === 'chores') {
      s.care = Math.min(MAX, s.care + Math.round((evening ? SCORE.careEvening : SCORE.careDay) * mult));
      addMargin(s, -2);
      if (!evening) s.fatigue = Math.max(FAT[0], s.fatigue + CHORES_FATIGUE);
      s.counts.chores += 1;
      return;
    }
    if (action === 'pray') {
      const base = evening ? SCORE.prayEvening : SCORE.prayDay;
      const bonus = s.fatigue <= 6 ? SCORE.prayBonus : 0;
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
      clamp: { count: 0, absorbed: 0 },
    };
    const trace = [];
    const snap = () => ({ fatigue: s.fatigue, margin: s.margin, trust: s.trust, pray: s.pray, care: s.care });
    for (let day = 1; day <= DAYS; day++) {
      if (day === 1) { trace.push({ day, ...snap() }); continue; }
      const pick = typeof slots === 'function' ? slots(day) : slots;
      applySlot(s, pick[0], 'morning');
      applySlot(s, pick[1], 'noon');
      s.fatigue = Math.min(FAT[1], s.fatigue + gainAfterTrust(EVENING_PRAYER_GAIN, s.trust));
      applySlot(s, pick[2], 'evening');
      if (day === 7) {
        s.trust = Math.min(MAX, s.trust + TRUST_DAY7);
      } else if (day === 21) {
        // 葬儀。夜なしで stats を宣言していないので何も動かない
      } else {
        s.fatigue = Math.max(FAT[0], s.fatigue + careRecovery(s.margin));
        s.trust = Math.min(MAX, s.trust + cfg.night); // ★今回の探索対象
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

const PATTERNS = {
  休息家事: ['rest', 'chores', 'pray'],   // ★基準
  最大労働: ['chores', 'talk', 'pray'],
  家事重視: ['chores', 'chores', 'pray'],
  祈り重視: ['pray', 'pray', 'pray'],
  会話重視: ['talk', 'talk', 'pray'],
  休息重視: ['rest', 'talk', 'pray'],
  受け身: ['rest', 'rest', 'rest'],
};
// 固定7パターンとは別に、同じ骨格の混合も見る（参考）
const MIXED = {
  交互: (day) => [day % 2 === 0 ? 'rest' : 'talk', 'chores', 'pray'],
  休み寄り: (day) => [day % 3 === 0 ? 'talk' : 'rest', 'chores', 'pray'],
};

const firstDay = (trace, key, th) => {
  const i = trace.findIndex((t) => t[key] >= th);
  return i === -1 ? null : i + 1;
};
const fatigueLand = (trace) => {
  const i = trace.findIndex((t) => t.fatigue <= 2);
  return i === -1 ? null : i + 1;
};
const pad = (v, n = 2) => String(v ?? '—').padStart(n);
const aliveDays = (trace, key) => trace.slice(1).filter((t) => t[key] < MAX).length;
const inR = (v, a, b) => v !== null && v >= a && v <= b;

function evaluate(cfg, withMixed = false) {
  const sim = makeSim(cfg);
  const out = {};
  const all = withMixed ? { ...PATTERNS, ...MIXED } : PATTERNS;
  for (const [name, slots] of Object.entries(all)) {
    const r = sim.run(slots);
    out[name] = {
      trustUnlock: (() => { const d = firstDay(r.trace, 'trust', TRUST_UNLOCK); return d === null ? null : Math.max(d, 8); })(),
      fatigueLand: fatigueLand(r.trace),
      prayGate: firstDay(r.trace, 'pray', GATE),
      careGate: firstDay(r.trace, 'care', GATE),
      trustAlive: aliveDays(r.trace, 'trust'),
      prayAlive: aliveDays(r.trace, 'pray'),
      careAlive: aliveDays(r.trace, 'care'),
      counts: r.counts, end: r.end, trace: r.trace,
      avgMargin: Math.round(r.trace.slice(1).reduce((a, t) => a + t.margin, 0) / (DAYS - 1)),
    };
  }
  return out;
}

function goals(o) {
  const both = (x) => x.prayGate !== null && x.careGate !== null;
  const onlyRestChores = Object.keys(PATTERNS).filter((k) => both(o[k]));
  return {
    信頼解禁が14日目より前: o.休息家事.trustUnlock !== null && o.休息家事.trustUnlock < 14,
    両ゲートが24to28: inR(o.休息家事.prayGate, 24, 28) && inR(o.休息家事.careGate, 24, 28),
    受け身も28日以内に解禁: o.受け身.trustUnlock !== null && o.受け身.trustUnlock <= 28,
    両ゲートに届くのは休息家事だけ: onlyRestChores.length === 1 && onlyRestChores[0] === '休息家事',
  };
}
// 疲労着地は別枠で見る（★夜ケアの信頼を上げると連動して早まるため）
const fatigueGoal = (o) => inR(o.休息家事.fatigueLand, 9, 16);

/* ================================================================= */
console.log('='.repeat(100));
console.log('夜ケアの信頼増加を上げて再探索（本体コードは未変更）');
console.log('確定値：帯 0-2/3-7/8-20（×0.5）／ゲート200／家事+8（夕方+4）／夕方の祈り+7（+2、昼+5）');
console.log('='.repeat(100));

/* ===== ★まず構造の確認：信頼はどこから来るか ===== */
console.log('');
console.log('■ ★構造：信頼の入口は「会話」と「夜ケア」と「7日目」の3つだけ');
console.log('  夜ケアは 25回（28夜 − 1日目 − 7日目 − 21日目）。7日目の nightHold が +21。');
console.log('');
console.log('  パターン    会話の回数 | 信頼の内訳');
for (const [name, slots] of Object.entries(PATTERNS)) {
  const talks = slots.filter((x) => x === 'talk').length * 27;
  console.log(`  ${name.padEnd(5)}      ${pad(talks, 3)}回   | ${talks === 0 ? '★夜ケア 25回 ＋ 7日目 +21 のみ（会話ゼロ）' : `会話 ${talks}回 ＋ 夜ケア 25回 ＋ 7日目 +21`}`);
}
console.log('');
console.log('★ **休息＋家事 と 受け身 は、どちらも会話ゼロ＝信頼の内訳が完全に同一。**');
console.log('  → 夜ケアの信頼を上げると、**受け身の解禁日も同じだけ早くなる**（構造的に切り離せない）。');

/* ===== 夜ケアの信頼を振る ===== */
console.log('');
console.log('='.repeat(100));
console.log('【探索1】夜ケアの信頼増加を振る（talk は +13 のまま）');
console.log('='.repeat(100));
console.log('  夜ケア | 休息家事 解禁 | 受け身 解禁 | 休息家事 祈/世 | 疲労着地 | 両ゲート到達（固定7種）| 目標');
console.log('  ' + '-'.repeat(96));
const r1 = [];
for (const night of [8, 10, 12, 14, 16, 17, 18, 19, 20, 22, 24, 26, 28]) {
  const cfg = { night, talk: 13 };
  const o = evaluate(cfg);
  const g = goals(o);
  const ok = Object.values(g).every(Boolean);
  const both = Object.keys(PATTERNS).filter((k) => o[k].prayGate !== null && o[k].careGate !== null);
  r1.push({ night, cfg, o, g, ok });
  console.log(`   ${pad(night)}   |    ${pad(o.休息家事.trustUnlock)}日     |   ${pad(o.受け身.trustUnlock)}日    ` +
    `|   ${pad(o.休息家事.prayGate)}/${pad(o.休息家事.careGate)}日   |   ${pad(o.休息家事.fatigueLand)}日   | ${(both.join(',') || 'なし').padEnd(20)} | ${ok ? '★' : '×'}`);
}

/* ★「達成の早さ」だけでなく「その値が生きている日数」も見る（＝上限に張り付いていない日数） */
console.log('');
console.log('■ ★信頼が「生きている」日数（28日中、上限255に張り付いていない日数）');
console.log('  夜ケア | 休息家事 | 受け身 | 会話重視 | 最大労働');
for (const r of r1) {
  console.log(`   ${pad(r.night)}   |   ${pad(r.o.休息家事.trustAlive)}日   |  ${pad(r.o.受け身.trustAlive)}日  |   ${pad(r.o.会話重視.trustAlive)}日   |   ${pad(r.o.最大労働.trustAlive)}日`);
}
console.log('  → 夜ケアを上げるほど信頼が早く上限に着く＝**信頼の値が意味を持つ日数が短くなる**。');
console.log('     解禁を早める代償は「信頼という数値が後半なにも語らなくなること」。');

const hits1 = r1.filter((r) => r.ok);
console.log('');
console.log(`→ 目標5項目すべてを満たす夜ケアの値：${hits1.length ? hits1.map((h) => '+' + h.night).join(' / ') : 'なし'}`);
const ideal = r1.filter((r) => r.ok && inR(r.o.休息家事.trustUnlock, 10, 13));
console.log(`→ そのうち理想帯（解禁 10〜13日目）：${ideal.length ? ideal.map((h) => '+' + h.night).join(' / ') : 'なし'}`);

/* ===== talk を下げる案 ===== */
console.log('');
console.log('='.repeat(100));
console.log('【探索2】talk を下げて夜ケアとの大小を逆転させる案');
console.log('='.repeat(100));
console.log('  ※ 「より親密な行為なのに因果が逆」を直す方向。talk を下げると会話重視の解禁が遅れる');
console.log('  夜ケア talk | 休息家事 解禁 | 会話重視 解禁 | 最大労働 解禁 | 受け身 解禁 | 目標');
console.log('  ' + '-'.repeat(92));
const r2 = [];
for (const night of [17, 18, 20, 22, 24]) {
  for (const talk of [13, 10, 8, 6, 4]) {
    const cfg = { night, talk };
    const o = evaluate(cfg);
    const g = goals(o);
    const ok = Object.values(g).every(Boolean);
    r2.push({ night, talk, cfg, o, g, ok });
    if (!ok) continue;
    console.log(`   ${pad(night)}  ${pad(talk)}   |    ${pad(o.休息家事.trustUnlock)}日     |    ${pad(o.会話重視.trustUnlock)}日     ` +
      `|    ${pad(o.最大労働.trustUnlock)}日     |   ${pad(o.受け身.trustUnlock)}日    | ★`);
  }
}
console.log('');
console.log(`→ 目標を満たす組み合わせ：${r2.filter((r) => r.ok).length}件`);

/* ===== 詳細 ===== */
function detail(title, cfg) {
  const o = evaluate(cfg, true);
  const g = goals(o);
  console.log('');
  console.log(`■ ${title}`);
  console.log('  パターン    家事 祈り 会話 休む 止め | 信頼解禁 疲労着地 祈りゲート 世話役ゲート | 28日目の値（信頼/祈り/世話役）| 生きてる日数 信/祈/世');
  for (const name of [...Object.keys(PATTERNS), ...Object.keys(MIXED)]) {
    const x = o[name], c = x.counts;
    console.log(`  ${name.padEnd(5)}     ${pad(c.chores)}  ${pad(c.pray)}  ${pad(c.talk)}  ${pad(c.rest)}  ${pad(c.blocked)} ` +
      `|   ${pad(x.trustUnlock)}日    ${pad(x.fatigueLand)}日     ${pad(x.prayGate)}日      ${pad(x.careGate)}日    ` +
      `| ${pad(x.end.trust, 3)} / ${pad(x.end.pray, 3)} / ${pad(x.end.care, 3)}        |   ${pad(x.trustAlive)}/${pad(x.prayAlive)}/${pad(x.careAlive)}`);
  }
  const ng = Object.entries(g).filter(([, v]) => !v).map(([k]) => k);
  console.log(`  → 目標: ${ng.length === 0 ? '★5項目すべて満たす' : '×（未達: ' + ng.join(' / ') + '）'}`);
  return o;
}

if (hits1.length) {
  console.log('');
  console.log('='.repeat(100));
  console.log('【詳細】目標を満たす夜ケアの値のうち、解禁が理想帯（10〜13日目）に入るもの');
  console.log('='.repeat(100));
  for (const h of (ideal.length ? ideal : hits1).slice(0, 3)) {
    detail(`夜ケアの信頼 +${h.night} / talk +13`, h.cfg);
  }
}

/* ===== 何を諦めて何を得るか ===== */
console.log('');
console.log('='.repeat(100));
console.log('【各パターンが何を諦めて何を得るか】推奨値での整理');
console.log('='.repeat(100));
{
  const rec = ideal.length ? ideal[0].cfg : { night: 18, talk: 13 };
  const o = evaluate(rec, true);
  console.log(`  （夜ケアの信頼 +${rec.night} / talk +${rec.talk}）`);
  console.log('');
  const rows = [
    ['休息家事', '両ゲート＋早い解禁＋早い疲労回復', '会話がゼロ。物語の会話イベントを取り逃す'],
    ['交互', '両ゲート＋解禁＋会話も少し取る', 'すべてが少しずつ遅い'],
    ['最大労働', '会話を毎日取れる', '★余白が持たず止められ、両ゲート未到達'],
    ['家事重視', '世話役だけ早い', '祈り未到達。会話ゼロ。17回止められる'],
    ['祈り重視', '祈りが最速', '世話役未到達。疲労が着地しない。17回止められる'],
    ['会話重視', '解禁が最速。会話を54回', '世話役未到達（家事ゼロ）'],
    ['休息重視', '疲労が最速で回復。解禁も早い', '世話役未到達（家事ゼロ）'],
    ['受け身', '何も失わずに解禁と疲労回復を得る', '両ゲート未到達。エンディングは無条件の2つだけ'],
  ];
  console.log('  パターン    得るもの                              | 諦めるもの');
  for (const [name, get, lose] of rows) {
    console.log(`  ${name.padEnd(5)}     ${get.padEnd(36)} | ${lose}`);
  }
  console.log('');
  console.log('■ 信頼の日次推移（★解禁のしきい値 212 に到達する日を見る）');
  for (const name of ['休息家事', '交互', '最大労働', '会話重視', '受け身']) {
    console.log(`  ${name.padEnd(5)} ${o[name].trace.map((t) => String(t.trust).padStart(3)).join(' ')}`);
  }
}
console.log('');

/* ================================================================================
   【★連動の説明】夜ケアの信頼を上げると疲労の着地も早まる
   信頼は疲労軽減の係数（1 - trust × 0.002353）に入っているため、
   信頼が早く育つと夕方の日課で積まれる疲労が減り、着地が前に来る。
   ================================================================================ */
console.log('='.repeat(100));
console.log('【★連動】夜ケアの信頼 → 疲労の着地');
console.log('='.repeat(100));
console.log('  夜ケア | 休息家事の解禁 | 休息家事の疲労着地 | 疲労着地の目標(9〜16日) | 13日目の信頼 | 13日目の係数');
for (const night of [8, 12, 16, 17, 18, 20, 24]) {
  const o = evaluate({ night, talk: 13 });
  const t13 = o.休息家事.trace[12].trust;
  const coef = (1 - t13 * TRUST_RATE).toFixed(2);
  console.log(`   ${pad(night)}   |     ${pad(o.休息家事.trustUnlock)}日     |       ${pad(o.休息家事.fatigueLand)}日        |` +
    `          ${fatigueGoal(o) ? '○' : '×'}            |     ${pad(t13, 3)}     |    ${coef}`);
}
console.log('');
console.log('  → ★**解禁を14日目より前にする（夜ケア +18 以上）と、疲労の着地が 6日目になる。**');
console.log('     疲労着地の目標（9〜16日目）を満たすのは **+8 のまま（現状）だけ**。');
console.log('     +10〜+17 では 8日目（目標を1日下回る）。');
console.log('  → 信頼と疲労は係数で結ばれているので、**この2つは独立に決められない。**');

/* ================================================================================
   【別の手】解禁のしきい値を下げる（信頼の加算は触らない）
   ★これは確定値「おあずけ解禁の信頼しきい値 50（＝9割程度）」を引き直すことになる。
     決定の蒸し返しになるので、こちらでは採用せず選択肢として並べるだけ。
   ================================================================================ */
console.log('');
console.log('='.repeat(100));
console.log('【別の手・参考】解禁のしきい値を下げる（夜ケアの信頼は +8 のまま＝疲労に影響しない）');
console.log('='.repeat(100));
console.log('  ※ ★確定済みの「信頼の9割程度で解禁」という決定を引き直すことになる。採用の判断はチャット側。');
console.log('  しきい値 | 上限比 | 休息家事 解禁 | 受け身 解禁 | 会話重視 解禁 | 休息家事の疲労着地');
{
  const cfg = { night: 8, talk: 13 };
  const sim = makeSim(cfg);
  const runs = {};
  for (const name of Object.keys(PATTERNS)) runs[name] = sim.run(PATTERNS[name]);
  for (const th of [212, 180, 150, 120, 100, 90]) {
    const u = (name) => { const d = firstDay(runs[name].trace, 'trust', th); return d === null ? null : Math.max(d, 8); };
    const fl = fatigueLand(runs.休息家事.trace);
    console.log(`    ${pad(th, 3)}   |  ${String(Math.round((th / MAX) * 100)).padStart(2)}%  |     ${pad(u('休息家事'))}日     |   ${pad(u('受け身'))}日    |     ${pad(u('会話重視'))}日     |        ${pad(fl)}日`);
  }
}
console.log('');
console.log('  → しきい値 **100前後**にすると解禁が 12日目になり、**疲労の着地は 9日目のまま動かない**。');
console.log('  → ただし上限比が 39% になり、「信頼がほぼ最大になってから」という決定の趣旨から外れる。');
console.log('');
