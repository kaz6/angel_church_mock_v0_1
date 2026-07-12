/* =========================================================================
   辺境教会の天使様と、はじまりの生活 - night-care-data.js
   夜ケア専用データ（分離・第一弾）

   夜ケアを「このゲームの中心体験」として今後作り込みやすくするため、
   nightCareEvents を scenario-data.js から切り出した置き場所。
   window.SCENARIO_DATA.nightCareEvents として公開する。

   読み込み順の注意（index.html）：
   1. scenario-data.js  … window.SCENARIO_DATA の本体（他の台詞データ）を作る
   2. night-care-data.js … このファイル。既存の window.SCENARIO_DATA に
                            nightCareEvents を追加する。必ず 1 の後に読み込むこと
   3. app.js

   今回移したもの:
   - nightCareEvents（1日目オープニング〜7日目・fallback）

   今回は挙動を変えず、置き場所を移しただけ。
   setFlags / relationChange 等の「処理」は app.js 側に残す方針は変わらない。
   夜ケア本文（1日目〜7日目・fallback）のセリフを直す場合は、このファイルを編集する。

   ------------------------------------------------------------------
   将来の拡張方針（NEXT_TASKS.md「夜ケア拡張案：分離・ミニゲーム化」参照。今回は未実装）
   ------------------------------------------------------------------

   1エントリを将来、以下のブロックに分割して編集しやすくする想定：
   - preTalk        … 夜ケア前の短い会話（7日目懺悔室等、重要イベント日のみ。省略可）
   - intro          … ケア開始前の地の文（現在の text がこれに相当）
   - miniGame       … 入力方式・時間・難易度の定義（ロジック参照用。長押し中心の低難易度）
   - resultTexts    … ケア結果 tier 別の締めの一言
                       （light / normal / deep / stopped_early 等）
   - setFlags / relationChange … 従来どおり app.js 側で処理する（本文はここに書かない）

   7日ごとの重要イベント（懺悔室・結婚式・葬儀など）の後は、
   このファイルに day 別の nightCareEvents エントリを追加していけば、
   専用の夜ケア本文として拾われる（app.js の findNightCareEvent が
   day 一致 → priority 降順で選ぶ、既存の仕組みをそのまま使う）。

   ------------------------------------------------------------------
   全年齢 / R-18 差分スキーマ（asset-resolver.js が解決する）
   ------------------------------------------------------------------
   - text            … 従来キー。text_normal と同義（レガシー互換）。
                       差分を持たないエントリはこのままでよい
   - text_normal     … 全年齢版本文。差分を入れるエントリで使う
   - text_adult      … R-18版本文。mode: 'r18' のときだけ表示される。
                       未定義、または '[TODO:' で始まるプレースホルダなら
                       text_normal に自動フォールバックする
   - R-18本文はすべて作者専管。AI・データ整備では
     '[TODO:作者差し込み]' プレースホルダのみ置く。
   - 同一エントリに text と text_normal/text_adult を混在させない
     （移行するときは text を text_normal にリネームする）
   - サンプル: night_care_d3 がダミー差分入り（切替確認用）、
     night_care_d7 が [TODO] プレースホルダ（フォールバック確認用）
   ========================================================================= */

'use strict';

window.SCENARIO_DATA = window.SCENARIO_DATA || {};

window.SCENARIO_DATA.nightCareEvents = [
  {
    id: 'night_care_d1_opening',
    day: 1,
    phase: 'opening',
    countsAsRoutine: false,
    priority: 10,
    location: '個室',
    angelExpression: 'sleepy',
    angelStatus: 'ベッドに腰掛け、少し気を抜いている',
    text: [
      '食事を終え、二人は個室に戻った。\n天使様は、二つ並んだベッドのうちひとつに、静かに腰を下ろす。',
      '「明日もあるのですから、そろそろ休みましょう」',
      '「――その前に、少しだけ疲れを取りましょう」\nあなたはそう言って、天使様の肩や手にそっと触れ、凝りをほぐすように優しく揉みほぐした。',
      '天使様は目を細め、されるがままになっていた。\nやがて満足したように小さく息を吐くと、そのまま静かに眠りに落ちていった。',
      '――その日から、二人の生活が始まったのでした。',
    ],
  },
  {
    id: 'night_care_d2',
    day: 2,
    priority: 10,
    location: '個室',
    angelExpression: 'tired',
    angelStatus: '祈りの後、肩を落としている',
    relationChange: 1,
    setFlags: { angel_relaxed_by_care: true },
    text: [
      '祈りを終えた天使様は、いつもより少し肩を落としていた。\nあなたが声をかけると、彼女は小さくうなずく。',
      '「……少しだけ、お願いします」',
    ],
  },
  // 全年齢/R-18 差分のサンプル（切替確認用）。
  // text_adult はダミー文（実内容ではない）。本差し込みは作者が行う
  {
    id: 'night_care_d3',
    day: 3,
    priority: 10,
    location: '個室',
    angelExpression: 'gentle',
    angelStatus: '少し自然に身を預けている',
    relationChange: 1,
    setFlags: { angel_relaxed_by_care: true },
    text_normal: [
      '昨日よりも、天使様は少しだけ自然に身を預けた。\n部屋の外では、夏の終わりの虫の声が細く続いている。',
    ],
    text_adult: [
      '【R-18差分ダミー】ここに作者差し込みのR-18版本文が入る（night_care_d3_adult）。',
      '昨日よりも、天使様は少しだけ自然に身を預けた。\n部屋の外では、夏の終わりの虫の声が細く続いている。',
    ],
  },
  // 4日目夜ケア：正体開示後の日課。大きな事件は起こさない
  {
    id: 'night_care_d4',
    day: 4,
    priority: 10,
    location: '個室',
    angelExpression: 'soft',
    angelStatus: '穏やかに休んでいる',
    relationChange: 1,
    setFlags: { angel_relaxed_by_care: true },
    text: [
      '四日目の夜。翼をたたんだ天使様に、いつものように声をかける。',
      '「……はい。お願いします」\n彼女は小さく答え、肩の力を少しだけ抜いた。',
    ],
  },
  {
    id: 'night_care_d5',
    day: 5,
    priority: 10,
    location: '個室',
    angelExpression: 'soft',
    angelStatus: '少し自然に身を預けている',
    relationChange: 1,
    setFlags: { angel_relaxed_by_care: true },
    text: [
      '五日目の夜。もう何度か重ねたケアに、天使様は少しだけ早く応じる。',
      '「……ありがとうございます。最近は、この時間が落ち着きます」',
    ],
  },
  {
    id: 'night_care_d6',
    day: 6,
    priority: 10,
    location: '個室',
    angelExpression: 'gentle',
    angelStatus: '静かに休んでいる',
    relationChange: 1,
    setFlags: { angel_relaxed_by_care: true },
    text: [
      '六日目の夜。部屋の外は静かで、教会全体が少しだけ深い息をついているようだった。',
      '天使様は何も言わず肩を預けてきた。それだけで、今日一日の終わりが伝わる。',
    ],
  },
  // text_adult が [TODO] プレースホルダの間は r18 モードでも
  // text_normal が表示される（フォールバック確認用サンプル）
  {
    id: 'night_care_d7',
    day: 7,
    priority: 10,
    location: '個室',
    angelExpression: 'soft',
    angelStatus: '静かに休んでいる',
    relationChange: 1,
    setFlags: { angel_relaxed_by_care: true },
    text_normal: [
      '懺悔室のあと、個室に戻る。天使様も後から静かに入ってきた。',
      '告解の間でのことについて、何も問いかけてこない。',
      '「……お休みなさい」とだけ言って、いつものように肩を預けてきた。',
    ],
    text_adult: '[TODO:作者差し込み]',
  },
  {
    id: 'night_care_fallback',
    priority: 1,
    location: '個室',
    angelExpression: 'soft',
    angelStatus: '静かに休んでいる',
    relationChange: 1,
    setFlags: { angel_relaxed_by_care: true },
    text: [
      '就寝前、天使様の肩をそっとほぐす。\n天使様は目を細め、小さく息を吐いた。',
    ],
  },
];
