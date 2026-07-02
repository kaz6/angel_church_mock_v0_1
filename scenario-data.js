/* =========================================================================
   辺境教会の天使様と、はじまりの生活 - scenario-data.js
   セリフ外部ファイル化・足場（第一弾）

   台詞データを app.js から少しずつ切り出すための置き場所。
   window.SCENARIO_DATA として公開する。index.html では app.js より前に読み込むこと。

   今回移したもの:
   - nightCareEvents（毎晩ケア・1夜目オープニング含む）
   - nightEvents（2日目/3日目 夜の強制イベント本文・選択肢・選択後テキスト）
   - callNameReactions（呼び名の特定ワード反応）
   - statLabels / actionLabels / timeSlotLabels（表示用ラベル）
   - freeActionTexts（自由行動の結果テキスト・default のみ）
   - statusTexts（stats 値に応じた状態文・雰囲気文）
   - statusChangeTexts（stats 増減時の雰囲気文）
   - endingTexts（14日目エンディング本文・置き場のみ。分岐処理は未実装）
   - openingScenes（1日目オープニング本文・一部のみ。進行は app.js）

   setFlags / relationChange 等の「処理」は app.js 側に残し、
   ここには台詞・演出まわりのデータのみを置く。
   ========================================================================= */

'use strict';

window.SCENARIO_DATA = {
  statLabels: {
    trust: '信頼',
    prayerTuning: '祈りの調律',
    caretakerAptitude: '世話役適性',
    mentalMargin: '心身の余白',
    angelFatigue: '天使様の疲労',
  },

  actionLabels: {
    chores: '家事をする',
    pray: '祈る',
    rest: '休む',
    talk: '話しかける',
    nightCare: '夜ケア',
  },

  timeSlotLabels: {
    morning: '朝',
    noon: '昼',
    night: '夜',
  },

  openingScenes: [
    {
      id: 'arrival',
      timeSlot: 'noon',
      location: '教会前',
      angelExpression: 'tired',
      angelStatus: '少し疲れた様子で出迎えてくれた',
      logText: '辺境の教会に到着した。',
      text: [
        '夏の終わりが近い、よく晴れた昼過ぎ。乗合馬車を降りた先には、辺境の小さな教会が建っていた。',
        '大教会からの辞令を手に、あなたはひとりで戸を叩く。しばらくして、木の扉がゆっくりと開いた。',
        '「――いらっしゃい。待っていました」',
        '出迎えてくれたシスターは柔らかく微笑んだが、その声にはどこか疲れがにじんでいるように感じた。',
      ],
      choices: [{ label: '教会の中へ入る', next: 'ask_call_name' }],
    },
    {
      id: 'sleep1',
      location: '個室',
      angelExpression: 'soft',
      angelStatus: '静かに部屋を出ていった',
      logText: '眠りについた。',
      text: [
        '長旅の疲れもあって、あなたは大人しく従うことにした。ベッドに横になり、静かに目を閉じる。',
        '木の軋む音、遠くの鳥の声、風が窓を撫でる音。辺境の教会には、大教会にはなかった静けさがあった。',
        'いつの間にか、あなたは眠りに落ちていた。',
      ],
      choices: [{ label: '（……）', next: 'noise_wake' }],
    },
    {
      id: 'bridge_to_attic',
      location: '個室',
      logText: '屋根裏部屋の異変が気になった。',
      text: [
        '迷っているうちにも、物音は止まない。胸騒ぎを覚えたあなたは、結局、音のした屋根裏部屋へと向かうことにした。',
      ],
      choices: [{ label: '（……）', next: 'attic_fire' }],
    },
    {
      id: 'ask_call_name',
      type: 'callNameInput',
      location: '教会・廊下',
      angelExpression: 'soft',
      angelStatus: '静かにこちらを見ている',
      next: 'guide_room',
      text: [
        '扉の向こうで、シスターが少しだけ足を止めた。',
        '「――失礼です。あなたのことは、何とお呼びすればよいですか」',
        '短い間ののち、穏やかな視線がこちらに向けられる。',
      ],
    },
    {
      id: 'guide_room',
      type: 'scene',
      location: '個室',
      angelExpression: 'tired',
      angelStatus: '部屋の説明をしてくれている',
      logText: '個室に案内された。',
      text: [
        'シスターに案内されたのは、二つのベッドが並ぶ小さな個室だった。',
        '「狭い教会ですから、しばらくはこのお部屋を一緒に使っていただくことになります」',
        '「では、{playerCallName}、こちらのお部屋です」',
        '「少しお疲れのようですね。今日のところは、ゆっくりお休みください」\n「お部屋は自由に使ってくださって構いません。夕方ごろには、わたしの方は少し仕事がありますので」',
        'シスターはふと真剣な顔になり、天井の方を見上げた。',
        '「――ひとつだけ。屋根裏部屋には、入ってはなりませんよ」',
      ],
      choices: [{ label: '休む', next: 'sleep1' }],
    },
    {
      id: 'attic_fire',
      type: 'scene',
      location: '屋根裏部屋',
      angelExpression: 'shocked',
      angelStatus: '倒れたろうそくのそばに座り込んでいる',
      logText: '火を消し止めた。',
      text: [
        '重い扉を開けると、そこには信じられない光景が広がっていた。',
        'ほとんど白く、先端だけが黒く染まった大きな翼を広げたシスターが、床に座り込んでいる。倒れたろうそくから、小さな火が布に燃え移りかけていた。部屋の中央には、見たこともない魔法陣が淡く光っている。',
        '考えるより先に、あなたは駆け寄って火を踏み消していた。',
      ],
      choices: [{ label: '（……）', next: 'angel_confession' }],
    },
    {
      id: 'meal_event',
      type: 'scene',
      location: '台所',
      angelExpression: 'surprised',
      angelStatus: '驚きつつも、少し嬉しそうにしている',
      relationChange: 1,
      logText: '手料理を振る舞った。',
      text: [
        'あなたは、それ以上深くは尋ねなかった。かわりに台所へ向かい、有り合わせの材料で温かい食事を作ることにした。',
        '「え……わたしのために、ですか？」',
        '差し出された皿に、シスター――天使様は驚いたように瞬きをした後、ふわりと表情を緩めた。',
        '「{playerCallName}、怖くはないのですか。翼を見ても」\n「いいえ、あまり」とあなたが答えると、天使様は少しだけ肩の力を抜いたようだった。',
        '他愛のない会話をしながら、二人は同じ食卓を囲んだ。名前も知らなかった相手との距離が、ほんの少しだけ縮まった夜だった。',
      ],
      choices: [{ label: '（……）', next: 'night_care' }],
    },
  ],

  nightCareEvents: [
    {
      id: 'night_care_d1_opening',
      day: 1,
      phase: 'opening',
      countsAsRoutine: false,
      priority: 10,
      location: '個室',
      angelExpression: 'sleepy',
      angelStatus: 'ベッドに腰掛け、少し気を抜いている',
      text:
        '食事を終え、二人は個室に戻った。\n' +
        '天使様は、二つ並んだベッドのうちひとつに、静かに腰を下ろす。\n\n' +
        '「明日もあるのですから、そろそろ休みましょう」\n\n' +
        '「――その前に、少しだけ疲れを取りましょう」\n' +
        'あなたはそう言って、天使様の肩や手にそっと触れ、凝りをほぐすように優しく揉みほぐした。\n\n' +
        '天使様は目を細め、されるがままになっていた。\n' +
        'やがて満足したように小さく息を吐くと、そのまま静かに眠りに落ちていった。\n\n' +
        '――その日から、二人の生活が始まったのでした。',
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

  nightEvents: [
    {
      id: 'night_event_day2_tired_question',
      day: 2,
      location: '個室',
      angelExpression: 'concerned',
      angelStatus: '心配そうにこちらを見ている',
      text: [
        '夜、ろうそくの灯りの下で、天使様がふと手を止めてこちらを見た。',
        '「――ここへ来る前から、あまり眠れていなかったのですか？」',
        '静かな声だった。責めるようではなく、ただ気づかったふうに。',
      ],
      choices: [
        {
          id: 'admit_tired',
          label: '少しだけ',
          resultText: [
            '「そう、ですか」\n' +
              '天使様は小さく頷き、それ以上は何も言わなかった。ただ、少しだけ布団を整えてくれた。',
          ],
        },
        {
          id: 'hide_tired',
          label: '大丈夫です',
          resultText: [
            '「……そうですか」\n' +
              '天使様は少し寂しそうな、それでいて何かを察したような顔をした。',
            '「無理は、なさらないでくださいね」',
          ],
        },
      ],
    },
    {
      id: 'night_event_day3_remember',
      day: 3,
      location: '個室',
      angelExpression: 'gentle',
      angelStatus: '静かにこちらを見つめている',
      text: ['夜、眠りにつく前。天使様が、ふと思い出したように口を開いた。'],
      // memoryFlags（pain_tired / hide_pain）でどの文を続けるかは app.js 側で判定する。
      textVariants: {
        pain_tired: [
          '「昨夜、少しだけ眠れていないと仰っていましたね」\n' +
            '天使様は静かにそう言うと、あなたの隣にそっと腰を下ろした。\n' +
            '「今夜は、ゆっくり眠れるといいのですが」',
        ],
        hide_pain: [
          '「大丈夫だと仰っていましたけれど……無理をなさる癖が、おありのようですね」\n' +
            '天使様は少し困ったように、けれど優しく笑った。\n' +
            '「わたしには、少しくらい頼ってくださって構いませんよ」',
        ],
        default: [
          '「あなたは、思っていたよりずっと頑張り屋さんのようですね」\n' +
            '天使様は静かにそう言って、微笑んだ。',
        ],
      },
      choices: [{ id: 'continue', label: '（……）' }],
    },
  ],

  freeActionTexts: {
    chores: {
      default: {
        location: '同室の個室',
        angelExpression: 'soft',
        angelStatus: '少し落ち着いている',
        text: [
          'あなたは、部屋の隅に置かれた小さな棚を整えた。',
          '天使様はその様子を見て、少しだけ目を細める。',
          '「……ありがとうございます。こういうことは、意外と後回しにしてしまうのです」',
        ],
      },
    },
    pray: {
      default: {
        location: '祈りの間',
        angelExpression: 'calm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '静かに手を合わせ、少しだけ祈りの真似事をしてみる。',
          '言葉の意味はよく分からないが、静かに手を合わせる時間は、悪くないと思えた。',
        ],
      },
    },
    rest: {
      default: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '穏やかな様子でいる',
        text: [
          '目を閉じ、何もしない時間をただ過ごす。',
          '外から、夏の終わりを告げる虫の声が、かすかに聞こえてくる。',
        ],
      },
    },
    talk: {
      default: {
        location: '個室',
        angelExpression: 'warm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '他愛のないことを、少しだけ話してみる。',
          '天使様は静かに頷き、短い返事をくれた。',
        ],
      },
    },
  },

  statusTexts: {
    trust: [
      { max: 6, text: '天使様との距離：まだ少し遠い' },
      { max: 14, text: '天使様との距離：少しずつ言葉が増えている' },
      { max: 30, text: '天使様との距離：穏やかな信頼が芽生えている' },
    ],
    prayerTuning: [
      { max: 6, text: '祈りの響き：まだ不安定' },
      { max: 14, text: '祈りの響き：かすかに整っている' },
      { max: 30, text: '祈りの響き：この場所に静かに届いている' },
    ],
    caretakerAptitude: [
      { max: 6, text: '部屋の空気：まだ手探り' },
      { max: 14, text: '部屋の空気：少しずつ整ってきた' },
      { max: 30, text: '部屋の空気：あなたの手が馴染んでいる' },
    ],
    mentalMargin: [
      { max: 2, text: 'あなたの余白：かなり疲れている' },
      { max: 5, text: 'あなたの余白：少し眠い' },
      { max: 10, text: 'あなたの余白：まだ動けそう' },
    ],
    angelFatigue: [
      { max: 2, text: '天使様の様子：少し楽そう' },
      { max: 5, text: '天使様の様子：いつも通り穏やか' },
      { max: 10, text: '天使様の様子：少し疲れている' },
    ],
  },

  statusChangeTexts: {
    trust: {
      up: ['天使様との距離が、ほんの少し近づいた。'],
      down: ['天使様は、少しだけ言葉を選んでいるようだった。'],
    },
    prayerTuning: {
      up: ['祈りの響きが、かすかに澄んだ。'],
    },
    caretakerAptitude: {
      up: ['部屋の空気が、ほんの少し整った。'],
    },
    mentalMargin: {
      up: ['あなたの中に、少しだけ余白が戻った。'],
      down: ['あなたは、少しだけ無理をした。'],
    },
    angelFatigue: {
      up: ['天使様は、少し疲れを隠しているようだった。'],
      down: ['天使様の疲れが、少しだけほどけた。'],
    },
  },

  // 14日目エンディング本文（データ置き場。app.js からの参照・分岐処理は未実装）
  endingTexts: {
    trustEnding: {
      id: 'ending_trust',
      title: 'そばにいるということ',
      conditionLabel: '信頼',
      choiceLabel: 'そばにいたい',
      text: [
        '十四日目の夜、天使様はいつもより少し長く沈黙していた。',
        'やがて、彼女は静かにあなたを見る。',
        '「あなたが望むなら、もう少しここにいても構いません」',
      ],
    },
    prayerEnding: {
      id: 'ending_prayer',
      title: '祈りを支える',
      conditionLabel: '祈りの調律',
      choiceLabel: '祈りを支えたい',
      text: [
        '屋根裏のろうそくは、以前よりも静かに燃えていた。',
        '天使様は魔法陣の前で振り返る。',
        '「あなたの祈りは、この場所に届いています」',
      ],
    },
    caretakerEnding: {
      id: 'ending_caretaker',
      title: 'この教会の朝',
      conditionLabel: '世話役適性',
      choiceLabel: 'この教会の暮らしを守りたい',
      text: [
        '朝、礼拝堂には穏やかな光が差し込んでいた。',
        '整えられた机と、温かな食事と、昨日より少し軽い空気。',
        '「あなたがいると、この教会の朝が整うのです」',
      ],
    },
    returnEnding: {
      id: 'ending_return',
      title: '夏の終わりの休暇',
      conditionLabel: '未達成',
      choiceLabel: '帰任する',
      text: [
        '十四日間は、静かに過ぎていった。',
        '大きな役目を得たわけではない。何かを劇的に変えたわけでもない。',
        'けれど、あなたはこの教会でよく眠った。',
        '「また、季節が変わるころに来てください」',
      ],
    },
  },

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
