/* =========================================================================
   辺境教会の天使様と、はじまりの生活 - scenario-data.js
   セリフ外部ファイル化・足場（第一弾）

   台詞データを app.js から少しずつ切り出すための置き場所。
   window.SCENARIO_DATA として公開する。index.html では app.js より前に読み込むこと。

   今回移したもの:
   - nightEvents（2日目/3日目 夜の強制イベント本文・選択肢・選択後テキスト）
   - callNameReactions（呼び名の特定ワード反応）
   - statLabels / actionLabels / timeSlotLabels（表示用ラベル）
   - freeActionTexts（自由行動の結果テキスト・default + day/timeSlot 別）
   - statusTexts（stats 値に応じた状態文・雰囲気文）
   - statusChangeTexts（stats 増減時の雰囲気文）
   - endingTexts（14日目エンディング本文・置き場のみ。分岐処理は未実装）
   - openingScenes（1日目オープニング本文。分岐・setFlags は app.js の sceneDefinitions）
   - slotIntroTexts（自由行動 select 冒頭の時間帯導入文。evening-default / dayN-evening 含む）
   - observeTexts（様子を見る・行動消費なしの生活シチュ表示。eveningDefault / dN_evening 含む）

   夕方（evening）の本文は、day 別を全日分は用意せず、
   共通の eveningDefault（または evening-default）+ day7 専用文のみで足りる方針。
   day2〜6 の夕方は自動的に eveningDefault にフォールバックする（app.js 側の解決ロジック）。

   setFlags / relationChange 等の「処理」は app.js 側に残し、
   ここには台詞・演出まわりのデータのみを置く。

   夜ケア（nightCareEvents）は night-care-data.js に分離済み。
   night-care-data.js は本ファイルの後に読み込み、
   window.SCENARIO_DATA.nightCareEvents を追加する形で統合される
   （index.html の読み込み順: scenario-data.js → night-care-data.js → app.js）。
   夜ケア本文を編集する場合は night-care-data.js を編集すること。
   ========================================================================= */

'use strict';

window.SCENARIO_DATA = {
  // 全年齢/R-18 差し替え: 定義済みCG ID の登録簿（asset-resolver.js が参照）。
  // r18モードで {scene_id}_adult がここに登録されている場合のみ adult CG を採用し、
  // 未登録なら {scene_id}_normal に自動フォールバックする。
  // 実CGバイナリは git に置かない（ローカル/Unity/DLsite配信で管理）。
  // ここはあくまで「どのCG IDが用意済みか」の宣言のみ。
  // 下記はサンプル（night_care_d3 のadult枠が用意済みという想定）。
  cgRegistry: ['night_care_d3_adult'],

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
    observe: '様子を見る',
  },

  timeSlotLabels: {
    morning: '朝',
    noon: '昼',
    evening: '夕方',
    night: '夜',
  },

  slotIntroTexts: {
    'day2-morning':
      '小さな鳥の声で、あなたは目を覚ます。\n' +
      '窓の外では、夏の終わりの風が葉を揺らしていた。\n\n' +
      '隣のベッドはすでに空だった。天使様は、もう朝の支度を始めているようだ。\n\n' +
      '――さて、今日は何をしよう。',
    'day2-noon':
      '陽が高くなり、教会の中も少し暖まってきた。\n' +
      '天使様は静かに祈りの本を読んでいるようだ。\n\n' +
      '昼のひとときを、どう過ごそうか。',
    'day3-morning':
      '三日目の朝。\n' +
      'もうすっかり、この部屋の静けさにも慣れてきたような気がする。\n\n' +
      '隣のベッドで、天使様が小さく伸びをしていた。',
    'day3-noon':
      '今日も変わらず、静かな時間が流れている。\n' +
      '遠くで鐘の音が響いた。\n\n' +
      '昼の時間を、どう過ごそうか。',
    // --- 4日目：通常日の延長。大きな事件は起こさず、正体を知った上での穏やかな生活 ---
    // セリフや地の文を修正する場合は、このブロックを編集する
    'day4-morning':
      '四日目の朝。\n' +
      'もう翼のことを恐れる必要はないと、身体が覚えている。\n\n' +
      '台所のほうで、天使様が静かにコップを置く音が聞こえた。',
    'day4-noon':
      '教会の中は、少しだけ生活の匂いが染みついてきた。\n' +
      '天使様は廊下で祈りの本を抱え、梁に額をぶつけそうになっている。\n\n' +
      '昼の時間を、どう過ごそうか。',
    // --- 5日目：生活に慣れてきた通常日 ---
    'day5-morning':
      '五日目の朝。\n' +
      '起きる時間も、台所の音も、もう少し馴染んでいる。\n\n' +
      '廊下の向こうで、天使様が近所の人と短く挨拶を交わす声が聞こえた。',
    'day5-noon':
      '昼過ぎ、教会の中は穏やかな生活の音で満ちている。\n' +
      '天使様は応接の隅で、届いた差し入れの包みを丁寧に並べている。\n\n' +
      '昼の時間を、どう過ごそうか。',
    // --- 6日目：7日目に向けた静かな通常日 ---
    'day6-morning':
      '六日目の朝。\n' +
      '礼拝堂の方から、短い鐘の音が残っている。\n\n' +
      '懺悔室の扉は閉じたままだ。天使様は、静かにその前を通り過ぎた。',
    'day6-noon':
      '今日は、教会の中がいつもより少し静かに感じる。\n' +
      '天使様は祈りの間で目を閉じている。話しかけるか、そっとしておくか。\n\n' +
      '昼の時間を、どう過ごそうか。',
    // --- 7日目：昼までは通常日 ---
    'day7-morning':
      '七日目の朝。\n' +
      '外の空気は、夏の終わりを少しだけ告げている。\n\n' +
      '天使様は台所で静かに茶を淹れ、あなたの分も用意してくれたようだ。',
    'day7-noon':
      '昼下がり、懺悔室の前を通ると、中からは何も聞こえない。\n' +
      '天使様は廊下の端で、ひとり目を閉じていた。\n\n' +
      '昼の時間を、どう過ごそうか。',
    // --- 夕方：day 別が無い日は evening-default が使われる（app.js 側で解決） ---
    'evening-default':
      '夕方、鐘が短く鳴った。\n' +
      '天使様は屋根裏部屋へ上がり、日課の祈りに入ったようだ。\n\n' +
      'しばらくは、声をかけても届かないだろう。夕方の時間を、どう過ごそうか。',
    // --- 7日目夕方：懺悔室イベント前の、少し静かな気配 ---
    'day7-evening':
      '七日目の夕方。屋根裏部屋からは、いつもより静かな気配しか伝わってこない。\n\n' +
      '懺悔室の古い扉が、傾きかけた夕方の光を受けていた。今夜のことを、天使様も少しだけ言葉を選んでいるのかもしれない。',
  },

  observeTexts: {
    default: [
      '台所のほうから、天使様と近所の人の穏やかな笑い声が聞こえる。食べ物を分けてもらったようだ。',
      '廊下で、背の高い天使様が梁に額をぶつけ、小さく「っ」と息を漏らしている。狭い教会らしい。',
      '応接の隅で、天使様が荷物の山を前にして、少し困った顔をしている。片付けは苦手なのかもしれない。',
      '懺悔室の向こうで、低い声が続いている。告解を聞いているようだ。そっとしておこう。',
      '告解が終わったあとも、天使様はしばらく懺悔室に残っている。静かに目を閉じている。',
    ],
    d2_morning: '朝の光の中、天使様が近所の人から野菜を受け取り、丁寧にお礼を言っている。',
    d2_noon: '昼下がり、天使様は教会前でご近所さんと談笑している。こちらには気づいていないようだ。',
    d3_morning: '三日目の朝、天使様は台所で届いたパンを並べている。誰かが差し入れてくれたのだろう。',
    d3_noon: '懺悔室の扉が閉まったままだ。中で、天使様が静かに告解を聞いているようだ。',
    // 4日目：通常日の延長。正体を知った上での生活。セリフ修正は d4_* を編集
    d4_morning:
      '四日目の朝。玄関先で、天使様が近所の人から果物を受け取っている。あなたに気づくと、小さく会釈した。',
    d4_noon:
      '礼拝堂の窓辺で、天使様がひとり静かに祈っている。懺悔室の扉は閉じたままだ。今はそっとしておこう。',
    d5_morning:
      '五日目の朝。台所で、天使様が近所の人からもらった野菜を袋から出している。生活の音が、少しずつ馴染んできた。',
    d5_noon:
      '応接の隅で、天使様が差し入れの包みを前にして首をかしげている。中身の整理は、まだ少し苦手らしい。',
    d6_morning:
      '六日目の朝。懺悔室の扉は閉じたままだ。天使様はその前を静かに通り過ぎ、礼拝堂へ向かった。',
    d6_noon:
      '祈りの間で、天使様がひとり目を閉じている。話しかけても、そっとしておいても、どちらでもよさそうだ。',
    d7_morning:
      '七日目の朝。台所で天使様が茶を淹れている。背が高く、棚に肘が当たりそうになっている。',
    d7_noon:
      '廊下の端で、天使様が静かに佇んでいる。懺悔室の方を見て、また視線を逸らした。',
    // --- 夕方：day 別が無い日は eveningDefault が使われる（app.js 側で解決） ---
    eveningDefault:
      '天使様は屋根裏部屋にいるようだ。祈りの務めの最中らしく、扉の奥は静かだった。',
    d7_evening:
      '天使様は屋根裏部屋にいるようだ。今日はいつもより、静かな気配しか伝わってこない。',
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
    {
      id: 'noise_wake',
      timeSlot: 'night',
      location: '個室',
      logText: '小さな物音で目を覚ました。',
      text: [
        '――小さな悲鳴と、何かが倒れるような物音で目を覚ます。',
        '音は、どうやら天井の方――屋根裏部屋の辺りから聞こえたようだった。',
        '入ってはならないと言われたばかりの、あの場所から。',
        'あなたはベッドの上で、一瞬迷った。',
      ],
    },
    {
      id: 'angel_confession',
      location: '屋根裏部屋',
      angelExpression: 'sad',
      angelStatus: '観念したような表情をしている',
      logText: 'シスターが天使であることを知った。',
      text: [
        '火が消えたのを確かめてから、あなたはようやく振り返る。',
        '揺れるろうそくの灯りの中、白と黒の翼を持つシスターと、目が合った。',
        '「……見られてしまいましたね」',
        'シスターは小さく息をつき、静かに話し始めた。',
        '「わたしは、天使です。大昔からこの土地を見守り、日々祈りを捧げることで、世界の均衡を保ってきました」',
        '「少し……疲れが溜まっていたようです。それで、翼がろうそくに触れてしまったのでしょう」',
        '短い沈黙が、部屋に降りる。',
      ],
    },
  ],

  // nightCareEvents は night-care-data.js に分離済み（window.SCENARIO_DATA.nightCareEvents として統合される）

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
    // 7日目夜：懺悔室イベント（骨組み）。選択肢・resultText・memoryFlags 処理は app.js
    {
      id: 'night_event_day7_confession',
      day: 7,
      location: '懺悔室',
      angelExpression: 'gentle',
      angelStatus: '静かにこちらを見ている',
      text: [
        '七日目の夜。天使様が、懺悔室の扉を開けてこちらを招いた。',
        '狭い部屋には、二人分の椅子だけが置かれている。ろうそくの灯りが、壁を淡く照らしている。',
        '「話したければ、聞きます。話したくなければ……そのままでも構いません」',
        '天使様は問い詰めるような視線ではなく、ただ、こちらの側に座を空けていた。',
      ],
      choices: [
        {
          id: 'confession_shared',
          label: '少しだけ話す',
          resultText: [
            '言葉は短かった。全部を語る必要も、語れるとは思えなかった。',
            'それでも天使様は頷くだけで、急かさなかった。',
            '「……ありがとうございます」',
          ],
        },
        {
          id: 'confession_uncertain',
          label: 'うまく言葉にならない',
          resultText: [
            '口を開きかけて、また閉じた。うまく言葉にならない。',
            '天使様は少しだけ間を置いて、静かに言った。',
            '「大丈夫です。今日は、ここまででも」',
          ],
        },
        {
          id: 'confession_silent',
          label: '何も言わずに座っている',
          resultText: [
            '何も言わず、ただ隣の席に座った。',
            '沈黙のまま時間が過ぎても、天使様は席を立たなかった。',
            '部屋の外では、風が木々を揺らす音だけが続いていた。',
          ],
        },
        {
          id: 'confession_avoided',
          label: '今日はやめておく',
          resultText: [
            '今日は、ここまでにしようと席を立った。',
            '天使様は咎めるような表情を見せず、小さく頷いた。',
            '「では、また来られる時に。お部屋へ戻りましょう」',
          ],
        },
      ],
    },
  ],

  freeActionTexts: {
    // 8〜14日目に chores の代わりに読まれるプール（app.js の DAY_RULES の
    // actionTextKeys で差し替える）。★本文は仮置き。差し替わっていることが
    // 分かる形にしてあるだけで、作者の本文は後から差し込む。
    weddingPrep: {
      default: {
        location: '礼拝堂',
        angelExpression: 'soft',
        angelStatus: '式の支度を気にしている',
        text: [
          '[TODO:作者差し込み] あなたは礼拝堂に運び込まれた長椅子の位置を直し、埋もれていた燭台を磨いた。',
          '[TODO:作者差し込み] 「……人が集まる日のために整える、というのは、久しぶりです」',
        ],
      },
    },
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
      d2_morning: {
        location: '同室の個室',
        angelExpression: 'soft',
        angelStatus: '朝の光に目を細めている',
        text: [
          '朝の光が差し込む部屋で、床に落ちた小枝を拾い上げた。',
          '天使様は窓辺からこちらを見て、静かに頷く。',
          '「……朝から、ありがとうございます。少しだけ、空気が変わりました」',
        ],
      },
      d2_noon: {
        location: '教会・廊下',
        angelExpression: 'calm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '廊下の埃を払い、祈りの間の扉周りを軽く拭った。',
          '天使様は少し離れたところから様子を見て、短く言った。',
          '「昨日より、手が慣れてきたように見えます」',
        ],
      },
      d3_morning: {
        location: '同室の個室',
        angelExpression: 'warm',
        angelStatus: '少し眠そうだが穏やか',
        text: [
          '三日目の朝、いつもの棚の本を揃え直す。',
          '天使様はベッドの端に座り、あなたの手元を見ている。',
          '「……もう、この並び方を覚えてしまいました」',
        ],
      },
      d3_noon: {
        location: '教会・台所',
        angelExpression: 'soft',
        angelStatus: '静かにこちらを見ている',
        text: [
          '台所の水を替え、使った布巾を洗って干した。',
          '天使様は戸口に立ち、言葉を選ぶように続ける。',
          '「この教会の暮らしが、少しずつあなたの手に乗ってきているのですね」',
        ],
      },
      // 4日目（d4_*）：通常日。セリフ修正はこのキーを編集
      d4_morning: {
        location: '教会・台所',
        angelExpression: 'soft',
        angelStatus: '少し困った様子でいる',
        text: [
          '四日目の朝、台所の棚を整える。',
          '天使様は高い棚の前で小さくため息をついた。「……背が高いのは、こういう時だけ不便です」',
        ],
      },
      d4_noon: {
        location: '教会・廊下',
        angelExpression: 'calm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '廊下の窓辺に置いた花の水を替える。',
          '天使様は近所の人からもらった花を見て、静かに微笑んだ。「……よく分けてくださるのですね」',
        ],
      },
      d5_morning: {
        location: '教会・台所',
        angelExpression: 'soft',
        angelStatus: '少し困った様子でいる',
        text: [
          '五日目の朝、台所の食器を洗って棚に戻す。',
          '天使様は高い棚の前で、小さくため息をついた。「……背が高いのは、こういう時だけ不便です」',
        ],
      },
      d5_noon: {
        location: '教会・応接',
        angelExpression: 'warm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '応接の隅に積まれた差し入れの包みを、ひとつずつ並べ直した。',
          '天使様は少し照れたように言う。「……地域の方が、よく見てくださるのです」',
        ],
      },
      d6_morning: {
        location: '教会・廊下',
        angelExpression: 'calm',
        angelStatus: '静かにこちらを見ている',
        text: [
          '六日目の朝、懺悔室の前の床を軽く拭く。',
          '天使様は扉を見て、短く言った。「……今日は、まだ誰も来ていません」',
        ],
      },
      d6_noon: {
        location: '祈りの間',
        angelExpression: 'soft',
        angelStatus: '穏やかな様子でいる',
        text: [
          '祈りの間の椅子を整え、ろうそくの芯を切る。',
          '天使様は静かに頷く。「……この静けさも、大切な仕事のうちですね」',
        ],
      },
      d7_morning: {
        location: '教会・台所',
        angelExpression: 'soft',
        angelStatus: '穏やかな様子でいる',
        text: [
          '七日目の朝、いつもの台所の片付けをする。',
          '天使様は茶碗を二つ並べて言った。「……朝の支度は、少しずつ慣れてきました」',
        ],
      },
      d7_noon: {
        location: '教会・廊下',
        angelExpression: 'gentle',
        angelStatus: '静かにこちらを見ている',
        text: [
          '廊下の窓を開け、換気をする。',
          '天使様は懺悔室の方を見て、また視線を戻した。「……夕方まで、静かにしておきましょう」',
        ],
      },
      // --- 夕方：day 別が無い日は eveningDefault が使われる（app.js 側で解決） ---
      eveningDefault: {
        location: '教会・台所',
        angelExpression: 'calm',
        angelStatus: '屋根裏部屋で、祈りの務めをしているようだ',
        text: [
          '天使様がいない台所で、静かに晩御飯の支度をする。',
          '大した料理ではないけれど、鍋から立つ湯気だけで、少しだけ部屋が生活の匂いに満ちた。',
        ],
      },
      d7_evening: {
        location: '教会・台所',
        angelExpression: 'calm',
        angelStatus: '屋根裏部屋の祈りが、いつもより静かだ',
        text: [
          '七日目の夕方、いつものように晩御飯の支度をする。',
          '屋根裏からは物音ひとつしない。今夜のことを思うと、鍋をかき混ぜる手が、少しだけ遅くなった。',
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
      d2_morning: {
        location: '祈りの間',
        angelExpression: 'calm',
        angelStatus: '朝の静けさの中にいる',
        text: [
          '朝の祈りの間は、まだ外の音が遠い。',
          '手を合わせていると、隣で天使様も同じように目を閉じていた。',
        ],
      },
      d2_noon: {
        location: '祈りの間',
        angelExpression: 'soft',
        angelStatus: '穏やかな様子でいる',
        text: [
          '昼の光がステンドグラスを淡く照らす。',
          '祈りの言葉は分からなくても、並んでいるだけで、少し落ち着いた。',
        ],
      },
      d3_morning: {
        location: '祈りの間',
        angelExpression: 'warm',
        angelStatus: '静かに微笑んでいる',
        text: [
          '三日目の朝、いつもの席に座る。',
          '天使様が小さく言った。「……昨日より、手の置き方が少し落ち着いていますね」',
        ],
      },
      d3_noon: {
        location: '祈りの間',
        angelExpression: 'calm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '鐘の音のあと、しばらく目を閉じた。',
          '言葉を交わさなくても、この間の空気は、もう少し馴染んでいる気がする。',
        ],
      },
      d4_morning: {
        location: '祈りの間',
        angelExpression: 'calm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '四日目の朝、いつものように手を合わせる。',
          '隣で天使様も目を閉じている。正体を知った今でも、この静けさは変わらない。',
        ],
      },
      d4_noon: {
        location: '祈りの間',
        angelExpression: 'soft',
        angelStatus: '静かにこちらを見ている',
        text: [
          '短い祈りのあと、天使様がこちらを見た。',
          '「……今日も、並んでくださってありがとうございます」',
        ],
      },
      d5_morning: {
        location: '祈りの間',
        angelExpression: 'calm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '五日目の朝、いつもの席で手を合わせる。',
          '隣で天使様も目を閉じている。この並び方も、もう少し自然になってきた気がする。',
        ],
      },
      d5_noon: {
        location: '祈りの間',
        angelExpression: 'warm',
        angelStatus: '静かに微笑んでいる',
        text: [
          '昼の光の中、短い祈りを捧げる。',
          '天使様が小さく言った。「……最近は、この時間が落ち着きますね」',
        ],
      },
      d6_morning: {
        location: '祈りの間',
        angelExpression: 'calm',
        angelStatus: '静かにこちらを見ている',
        text: [
          '六日目の朝、目を閉じて静かに座る。',
          '言葉を交わさなくても、祈りの間の空気は穏やかだった。',
        ],
      },
      d6_noon: {
        location: '祈りの間',
        angelExpression: 'soft',
        angelStatus: '穏やかな様子でいる',
        text: [
          '鐘の音のあと、しばらく沈黙を保った。',
          '話すことも、話さないことも、ここではどちらも選べる気がする。',
        ],
      },
      d7_morning: {
        location: '祈りの間',
        angelExpression: 'calm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '七日目の朝、手を合わせる。',
          '天使様も隣で目を閉じている。今日という日が、静かに始まった。',
        ],
      },
      d7_noon: {
        location: '祈りの間',
        angelExpression: 'gentle',
        angelStatus: '静かにこちらを見ている',
        text: [
          '短い祈りのあと、天使様がこちらを見た。',
          '「……今日は、特別な日ではありません。それでも、ここにいていいのです」',
        ],
      },
      // --- 夕方：day 別が無い日は eveningDefault が使われる（app.js 側で解決） ---
      eveningDefault: {
        location: '屋根裏部屋の近く',
        angelExpression: 'calm',
        angelStatus: '屋根裏部屋で、祈りの務めに入っている',
        text: [
          '屋根裏へ続く階段の下で、そっと手を合わせる。',
          '扉の向こうから、低く静かな祈りの声がかすかに響いていた。務めの邪魔にならないよう、あなたも短く祈った。',
        ],
      },
      d7_evening: {
        location: '屋根裏部屋の近く',
        angelExpression: 'calm',
        angelStatus: '祈りの務めが、いつもより静かだ',
        text: [
          '七日目の夕方、階段の下でいつものように手を合わせる。',
          '今日は祈りの声が、いつもより小さい。務めの重さが、扉越しにも伝わってくるようだった。',
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
      d2_morning: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '静かにこちらを見ている',
        text: [
          'ベッドに腰を下ろし、深く息をついた。',
          '天使様は何も言わず、窓の外を見ている。それでも、部屋は急かされない。',
        ],
      },
      d2_noon: {
        location: '個室',
        angelExpression: 'calm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '昼下がり、椅子に寄りかかって目を閉じる。',
          '暑さの残り香の中で、短い休息が少しだけ身体に染みた。',
        ],
      },
      d3_morning: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '少し眠そうだが穏やか',
        text: [
          '三日目の朝、布団の端を整えたまま、しばらくぼんやりとする。',
          '天使様は小さく言った。「……休むことも、仕事のうちですよ」',
        ],
      },
      d3_noon: {
        location: '個室',
        angelExpression: 'warm',
        angelStatus: '静かに微笑んでいる',
        text: [
          '昨日より少しだけ、同じ部屋が居心地よく感じる。',
          '何もしない時間を選んでも、誰にも咎められない。この事実が、少しだけ心を休めた。',
        ],
      },
      d4_morning: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '穏やかな様子でいる',
        text: [
          '四日目の朝、窓辺で少し目を閉じる。',
          '隣のベッドで、天使様も同じように静かに休んでいる。急かされる気配はない。',
        ],
      },
      d4_noon: {
        location: '個室',
        angelExpression: 'calm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '昼下がり、椅子に座ってぼんやりする。',
          '天使様は本を読みながら、時折こちらに視線を向けた。また逸らす。気にかけているのだろう。',
        ],
      },
      d5_morning: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '穏やかな様子でいる',
        text: [
          '五日目の朝、窓辺で少し目を閉じる。',
          '近所の声が遠くに聞こえる。この教会での朝が、少しずつ馴染んできた。',
        ],
      },
      d5_noon: {
        location: '個室',
        angelExpression: 'warm',
        angelStatus: '静かに微笑んでいる',
        text: [
          '昼下がり、何もしない時間を選ぶ。',
          '天使様は茶を淹れてくれた。「……休むのも、立派な過ごし方です」',
        ],
      },
      d6_morning: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '静かにこちらを見ている',
        text: [
          '六日目の朝、布団の端を整えたまま、しばらくぼんやりとする。',
          '部屋の外は静かだった。急かされる気配はない。',
        ],
      },
      d6_noon: {
        location: '個室',
        angelExpression: 'calm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '椅子に座り、目を閉じる。',
          '沈黙が続いても、天使様は何も言わない。それだけで、少し楽になった。',
        ],
      },
      d7_morning: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '穏やかな様子でいる',
        text: [
          '七日目の朝、深く息をついて休む。',
          '台所から、天使様が静かに動く音が聞こえる。生活の音が、もう少し安心に感じる。',
        ],
      },
      d7_noon: {
        location: '個室',
        angelExpression: 'gentle',
        angelStatus: '静かにこちらを見ている',
        text: [
          '昼下がり、何もしない時間を過ごす。',
          '天使様は本を閉じて、短く言った。「……今夜のことは、無理に決めなくて構いません」',
        ],
      },
      // --- 夕方：day 別が無い日は eveningDefault が使われる（app.js 側で解決） ---
      eveningDefault: {
        location: '個室',
        angelExpression: 'calm',
        angelStatus: '屋根裏部屋で、祈りの務めをしているようだ',
        text: [
          '天使様がいない個室で、少しだけ体を休める。',
          '誰に気を遣うでもなく、ただ静かに過ごす時間も、悪くないと思えた。',
        ],
      },
      d7_evening: {
        location: '個室',
        angelExpression: 'calm',
        angelStatus: '屋根裏部屋の祈りが、いつもより静かだ',
        text: [
          '七日目の夕方、少しだけ横になって休む。',
          '今夜のことを考えると、なんとなく落ち着かない。それでも、目を閉じて過ごす時間を選んだ。',
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
      d2_morning: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '朝の光に目を細めている',
        text: [
          '昨夜の物音のことを、遠回しに尋ねてみた。',
          '天使様は少し間を置いて答える。「……気にかけてくださったのですね。ありがとうございます」',
        ],
      },
      d2_noon: {
        location: '個室',
        angelExpression: 'warm',
        angelStatus: '穏やかな様子でいる',
        text: [
          '大教会のことではなく、ここでの朝の音について話した。',
          '天使様は短く笑う。「……こちらの方が、少し静かですね」',
        ],
      },
      d3_morning: {
        location: '個室',
        angelExpression: 'warm',
        angelStatus: '静かに微笑んでいる',
        text: [
          '特に用件はなく、ただ挨拶を交わす。',
          '天使様は昨日のことを覚えているように言った。「……今朝も、少し肩に力が入っていましたね」',
        ],
      },
      d3_noon: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '静かにこちらを見ている',
        text: [
          '話すことも、話さないことも選べると分かってきた。',
          '沈黙が続いても、天使様は席を立たない。それだけで、少し楽になった。',
        ],
      },
      d4_morning: {
        location: '個室',
        angelExpression: 'warm',
        angelStatus: '静かに微笑んでいる',
        text: [
          '昨日の台所のことについて、短く話した。',
          '天使様は小さく笑う。「……覚えていらっしゃるのですね。ありがとうございます」',
        ],
      },
      d4_noon: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '穏やかな様子でいる',
        text: [
          '特に深い話題は出さず、今日の天気について言い合う。',
          '天使様は窓の外を見て、短く答えた。それで十分だった。',
        ],
      },
      d5_morning: {
        location: '個室',
        angelExpression: 'warm',
        angelStatus: '静かに微笑んでいる',
        text: [
          '近所の差し入れについて、短く話した。',
          '天使様は少し照れた。「……皆さん、よく見てくださるのです。ありがたいことです」',
        ],
      },
      d5_noon: {
        location: '教会・廊下',
        angelExpression: 'soft',
        angelStatus: '穏やかな様子でいる',
        text: [
          '廊下で、天使様の片付けの様子について軽く言い合う。',
          '彼女は困ったように笑った。「……得意ではないのですが、少しずつ覚えています」',
        ],
      },
      d6_morning: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '静かにこちらを見ている',
        text: [
          '特に用件はなく、短い挨拶を交わす。',
          '天使様は少し間を置いて言った。「……今日は、静かな日かもしれませんね」',
        ],
      },
      d6_noon: {
        location: '祈りの間',
        angelExpression: 'gentle',
        angelStatus: '穏やかな様子でいる',
        text: [
          '話すか、話さないかを選べると分かってきた。',
          '沈黙が続いても、天使様は席を立たない。それだけで、少し楽になった。',
        ],
      },
      d7_morning: {
        location: '個室',
        angelExpression: 'warm',
        angelStatus: '静かに微笑んでいる',
        text: [
          '七日目の朝、他愛のないことを少し話す。',
          '天使様は茶を差し出しながら言った。「……今日も、ここにいてくださってありがとうございます」',
        ],
      },
      d7_noon: {
        location: '個室',
        angelExpression: 'soft',
        angelStatus: '静かにこちらを見ている',
        text: [
          '深い話題は出さず、今日一日をどう過ごすかについて軽く言い合う。',
          '天使様は短く頷いた。「……今夜のことも、あなたのペースで構いません」',
        ],
      },
    },
  },

  // 2026-07-14: app.js の stats 2倍スケール化に追随し、閾値(max)を2倍に更新（DECISION_LOG参照）。
  // 2026-07-30: trust / prayerTuning / caretakerAptitude の 60 → 255 スケール移行に追随し、
  //   閾値(max)を同じ比（×4.25）で引き直した（12→51 / 28→119 / 60→255）。
  //   ★比例させないと1回の行動で最上段まで飛び、3段の状態文が意味を失う。
  statusTexts: {
    trust: [
      { max: 51, text: '天使様との距離：まだ少し遠い' },
      { max: 119, text: '天使様との距離：少しずつ言葉が増えている' },
      { max: 255, text: '天使様との距離：穏やかな信頼が芽生えている' },
    ],
    prayerTuning: [
      { max: 51, text: '祈りの響き：まだ不安定' },
      { max: 119, text: '祈りの響き：かすかに整っている' },
      { max: 255, text: '祈りの響き：この場所に静かに届いている' },
    ],
    caretakerAptitude: [
      { max: 51, text: '部屋の空気：まだ手探り' },
      { max: 119, text: '部屋の空気：少しずつ整ってきた' },
      { max: 255, text: '部屋の空気：あなたの手が馴染んでいる' },
    ],
    mentalMargin: [
      { max: 4, text: 'あなたの余白：かなり疲れている' },
      { max: 10, text: 'あなたの余白：少し眠い' },
      { max: 20, text: 'あなたの余白：まだ動けそう' },
    ],
    angelFatigue: [
      { max: 4, text: '天使様の様子：少し楽そう' },
      { max: 10, text: '天使様の様子：いつも通り穏やか' },
      { max: 20, text: '天使様の様子：少し疲れている' },
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
