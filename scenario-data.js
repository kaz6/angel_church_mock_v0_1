/* =========================================================================
   辺境教会の天使様と、はじまりの生活 - scenario-data.js
   セリフ外部ファイル化・足場（第一弾）

   台詞データを app.js から少しずつ切り出すための置き場所。
   window.SCENARIO_DATA として公開する。index.html では app.js より前に読み込むこと。

   今回移したもの:
   - nightCareEvents（毎晩ケア）
   - callNameReactions（呼び名の特定ワード反応）

   setFlags / relationChange 等の「処理」は app.js 側に残し、
   ここには台詞・演出まわりのデータのみを置く。
   ========================================================================= */

'use strict';

window.SCENARIO_DATA = {
  nightCareEvents: [
    {
      id: 'night_care_d2',
      day: 2,
      priority: 10,
      location: '個室',
      angelExpression: 'tired',
      angelStatus: '祈りの後、肩を落としている',
      relationChange: 1,
      setFlags: { angel_relaxed_by_care: true },
      text:
        '祈りを終えた天使様は、いつもより少し肩を落としていた。\n' +
        'あなたが声をかけると、彼女は小さくうなずく。\n\n' +
        '「……少しだけ、お願いします」',
    },
    {
      id: 'night_care_d3',
      day: 3,
      priority: 10,
      location: '個室',
      angelExpression: 'gentle',
      angelStatus: '少し自然に身を預けている',
      relationChange: 1,
      setFlags: { angel_relaxed_by_care: true },
      text:
        '昨日よりも、天使様は少しだけ自然に身を預けた。\n' +
        '部屋の外では、夏の終わりの虫の声が細く続いている。',
    },
    {
      id: 'night_care_fallback',
      priority: 1,
      location: '個室',
      angelExpression: 'soft',
      angelStatus: '静かに休んでいる',
      relationChange: 1,
      setFlags: { angel_relaxed_by_care: true },
      text:
        '就寝前、天使様の肩をそっとほぐす。\n' +
        '天使様は目を細め、小さく息を吐いた。',
    },
  ],

  callNameReactions: [
    {
      type: 'exact',
      word: '主人',
      text: '「……ご主人、ですか。少し照れますが、覚えておきます」',
    },
    {
      type: 'exact',
      word: 'あなた',
      text: '「あなた、ですか。……穏やかな呼び方ですね」',
    },
    {
      type: 'includes',
      word: '様',
      text: '「……丁寧すぎるかもしれませんが、嬉しいです」',
    },
    {
      type: 'includes',
      word: '君',
      text: '「君、ですか。……少し、懐かしい響きですね」',
    },
  ],
};
