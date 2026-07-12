/* =========================================================================
   night-care-data.js — 夜ケアデータ【自動生成ファイル】

   このファイルは tools/build-nightcare.js が night-care.csv から生成する。
   直接編集しないこと。夜ケア本文を直すときは night-care.csv を編集し、
     node tools/build-nightcare.js
   を実行して再生成する。

   読み込み順（index.html）: content-config.js → asset-resolver.js →
     scenario-data.js → night-care-data.js → app.js
   （scenario-data.js の後に読み込み、window.SCENARIO_DATA へ nightCareEvents を追加する）
   ========================================================================= */

'use strict';

window.SCENARIO_DATA = window.SCENARIO_DATA || {};

window.SCENARIO_DATA.nightCareEvents = [
  {
    "id": "night_care_d1_opening",
    "day": 1,
    "phase": "opening",
    "countsAsRoutine": false,
    "priority": 10,
    "location": "個室",
    "angelExpression": "sleepy",
    "angelStatus": "ベッドに腰掛け、少し気を抜いている",
    "text_normal": [
      "食事を終え、二人は個室に戻った。\n天使様は、二つ並んだベッドのうちひとつに、静かに腰を下ろす。",
      "「明日もあるのですから、そろそろ休みましょう」",
      "「――その前に、少しだけ疲れを取りましょう」\nあなたはそう言って、天使様の肩や手にそっと触れ、凝りをほぐすように優しく揉みほぐした。",
      "天使様は目を細め、されるがままになっていた。\nやがて満足したように小さく息を吐くと、そのまま静かに眠りに落ちていった。",
      "――その日から、二人の生活が始まったのでした。"
    ]
  },
  {
    "id": "night_care_d2",
    "day": 2,
    "priority": 10,
    "location": "個室",
    "angelExpression": "tired",
    "angelStatus": "祈りの後、肩を落としている",
    "relationChange": 1,
    "setFlags": {
      "angel_relaxed_by_care": true
    },
    "text_normal": [
      "祈りを終えた天使様は、いつもより少し肩を落としていた。\nあなたが声をかけると、彼女は小さくうなずく。",
      "「……少しだけ、お願いします」"
    ]
  },
  {
    "id": "night_care_d3",
    "day": 3,
    "priority": 10,
    "location": "個室",
    "angelExpression": "gentle",
    "angelStatus": "少し自然に身を預けている",
    "relationChange": 1,
    "setFlags": {
      "angel_relaxed_by_care": true
    },
    "text_normal": [
      "昨日よりも、天使様は少しだけ自然に身を預けた。\n部屋の外では、夏の終わりの虫の声が細く続いている。"
    ],
    "text_adult": [
      "【R-18差分ダミー】ここに作者差し込みのR-18版本文が入る（night_care_d3_adult）。",
      "昨日よりも、天使様は少しだけ自然に身を預けた。\n部屋の外では、夏の終わりの虫の声が細く続いている。"
    ]
  },
  {
    "id": "night_care_d4",
    "day": 4,
    "priority": 10,
    "location": "個室",
    "angelExpression": "soft",
    "angelStatus": "穏やかに休んでいる",
    "relationChange": 1,
    "setFlags": {
      "angel_relaxed_by_care": true
    },
    "text_normal": [
      "四日目の夜。翼をたたんだ天使様に、いつものように声をかける。",
      "「……はい。お願いします」\n彼女は小さく答え、肩の力を少しだけ抜いた。"
    ]
  },
  {
    "id": "night_care_d5",
    "day": 5,
    "priority": 10,
    "location": "個室",
    "angelExpression": "soft",
    "angelStatus": "少し自然に身を預けている",
    "relationChange": 1,
    "setFlags": {
      "angel_relaxed_by_care": true
    },
    "text_normal": [
      "五日目の夜。もう何度か重ねたケアに、天使様は少しだけ早く応じる。",
      "「……ありがとうございます。最近は、この時間が落ち着きます」"
    ]
  },
  {
    "id": "night_care_d6",
    "day": 6,
    "priority": 10,
    "location": "個室",
    "angelExpression": "gentle",
    "angelStatus": "静かに休んでいる",
    "relationChange": 1,
    "setFlags": {
      "angel_relaxed_by_care": true
    },
    "text_normal": [
      "六日目の夜。部屋の外は静かで、教会全体が少しだけ深い息をついているようだった。",
      "天使様は何も言わず肩を預けてきた。それだけで、今日一日の終わりが伝わる。"
    ]
  },
  {
    "id": "night_care_d7",
    "day": 7,
    "priority": 10,
    "location": "個室",
    "angelExpression": "soft",
    "angelStatus": "静かに休んでいる",
    "relationChange": 1,
    "setFlags": {
      "angel_relaxed_by_care": true
    },
    "text_normal": [
      "懺悔室のあと、個室に戻る。天使様も後から静かに入ってきた。",
      "告解の間でのことについて、何も問いかけてこない。",
      "「……お休みなさい」とだけ言って、いつものように肩を預けてきた。"
    ],
    "text_adult": [
      "[TODO:作者差し込み]"
    ]
  },
  {
    "id": "night_care_fallback",
    "priority": 1,
    "location": "個室",
    "angelExpression": "soft",
    "angelStatus": "静かに休んでいる",
    "relationChange": 1,
    "setFlags": {
      "angel_relaxed_by_care": true
    },
    "text_normal": [
      "就寝前、天使様の肩をそっとほぐす。\n天使様は目を細め、小さく息を吐いた。"
    ]
  }
];
