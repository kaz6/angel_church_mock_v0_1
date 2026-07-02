/* =========================================================================
   辺境教会の天使様と、はじまりの生活 - app.js
   企画検証用モック v0.3

   構成:
   1. 定数・データ定義（memoryFlags初期値 / sceneDefinitions / actionDefinitions
      / freeActionEvents / forcedNightEvents / nightCareEvents / slotIntroTexts）
   2. gameState と状態遷移ロジック
   3. 描画（render）まわり
   4. セーブ / ロード / リセット
   5. イベント配線・初期化
   ========================================================================= */

'use strict';

/* -------------------------------------------------------------------------
   1. 定数・データ定義
   ------------------------------------------------------------------------- */

const STORAGE_KEY = 'angelChurchMockV0_1_save';

const TIME_SLOTS = ['morning', 'noon', 'night'];

// 表示ラベル（編集: scenario-data.js の SCENARIO_DATA.statLabels 等）
const FALLBACK_STAT_LABELS = {
  trust: '信頼',
  prayerTuning: '祈りの調律',
  caretakerAptitude: '世話役適性',
  mentalMargin: '心身の余白',
  angelFatigue: '天使様の疲労',
};

const FALLBACK_ACTION_LABELS = {
  chores: '家事をする',
  pray: '祈る',
  rest: '休む',
  talk: '話しかける',
  nightCare: '夜ケア',
};

const FALLBACK_TIME_SLOT_LABELS = {
  morning: '朝',
  noon: '昼',
  night: '夜',
};

const statLabels = Object.assign(
  {},
  FALLBACK_STAT_LABELS,
  (window.SCENARIO_DATA && window.SCENARIO_DATA.statLabels) || {}
);

const actionLabels = Object.assign(
  {},
  FALLBACK_ACTION_LABELS,
  (window.SCENARIO_DATA && window.SCENARIO_DATA.actionLabels) || {}
);

const timeSlotLabels = Object.assign(
  {},
  FALLBACK_TIME_SLOT_LABELS,
  (window.SCENARIO_DATA && window.SCENARIO_DATA.timeSlotLabels) || {}
);

const CALL_NAME_MAX_LENGTH = 7;
const DEFAULT_CALL_NAME = 'あなた';

// 呼び名の特定ワード反応（会話追加: scenario-data.js の SCENARIO_DATA.callNameReactions に足す）
// scenario-data.js が読み込まれていない場合の最低限フォールバック（反応なし）
const callNameReactions =
  (window.SCENARIO_DATA && window.SCENARIO_DATA.callNameReactions) || [];

// memoryFlags 初期値
const memoryFlagsDefault = {
  angel_revealed: false,
  went_to_attic: false,
  stayed_in_room: false,
  respected_warning: false,
  prioritized_help: false,
  pain_tired: false,
  hide_pain: false,
  helped_church: false,
  prayed_with_angel: false,
  rested_in_room: false,
  talked_with_angel: false,
  remembered_by_angel: false,
  first_night_care_done: false,
  night_care_routine_started: false,
  angel_relaxed_by_care: false,
  angel_asked_for_care: false,
  rest_when_tired: false,
  angel_noticed_player_tired: false,
};

// パラメーター（§パラメータ設計）初期値・範囲
const statsDefault = {
  trust: 0,
  prayerTuning: 0,
  caretakerAptitude: 0,
  mentalMargin: 5,
  angelFatigue: 5,
};

const statsRange = {
  trust: [0, 30],
  prayerTuning: [0, 30],
  caretakerAptitude: [0, 30],
  mentalMargin: [0, 10],
  angelFatigue: [0, 10],
};

// 主人公の行動傾向カウント
const actionCountsDefault = {
  chores: 0,
  pray: 0,
  rest: 0,
  talk: 0,
  nightCare: 0,
};

// 2日目朝から表示する基本行動（ラベルは actionLabels 由来）
const actionDefinitions = [
  { id: 'chores', label: actionLabels.chores },
  { id: 'pray', label: actionLabels.pray },
  { id: 'rest', label: actionLabels.rest },
  { id: 'talk', label: actionLabels.talk },
];

/* ---------------------- 固定オープニング（1日目） ---------------------- */
// 各シーンは id / text / location / angelExpression / angelStatus /
// choices（next, setFlags, relationChange, logText を持てる） / setFlags /
// relationChange / timeSlot / logText を持つ。
const sceneDefinitions = [
  {
    id: 'arrival',
    timeSlot: 'noon',
    location: '教会前',
    angelExpression: 'tired',
    angelStatus: '少し疲れた様子で出迎えてくれた',
    logText: '辺境の教会に到着した。',
    text:
      '夏の終わりが近い、よく晴れた昼過ぎ。\n' +
      '乗合馬車を降りた先には、辺境の小さな教会が建っていた。\n\n' +
      '大教会からの辞令を手に、あなたはひとりで戸を叩く。\n' +
      'しばらくして、木の扉がゆっくりと開いた。\n\n' +
      '「――いらっしゃい。待っていました」\n\n' +
      '出迎えてくれたシスターは柔らかく微笑んだが、その声にはどこか疲れがにじんでいるように感じた。',
    choices: [{ label: '教会の中へ入る', next: 'ask_call_name' }],
  },
  {
    id: 'ask_call_name',
    location: '教会・廊下',
    angelExpression: 'soft',
    angelStatus: '静かにこちらを見ている',
    inputCallName: true,
    next: 'guide_room',
    text:
      '扉の向こうで、シスターが少しだけ足を止めた。\n\n' +
      '「――失礼です。あなたのことは、何とお呼びすればよいですか」\n\n' +
      '短い間ののち、穏やかな視線がこちらに向けられる。',
  },
  {
    id: 'guide_room',
    location: '個室',
    angelExpression: 'tired',
    angelStatus: '部屋の説明をしてくれている',
    logText: '個室に案内された。',
    text:
      'シスターに案内されたのは、二つのベッドが並ぶ小さな個室だった。\n\n' +
      '「狭い教会ですから、しばらくはこのお部屋を一緒に使っていただくことになります」\n\n' +
      '「では、{playerCallName}、こちらのお部屋です」\n\n' +
      '「少しお疲れのようですね。今日のところは、ゆっくりお休みください」\n' +
      '「お部屋は自由に使ってくださって構いません。夕方ごろには、わたしの方は少し仕事がありますので」\n\n' +
      'シスターはふと真剣な顔になり、天井の方を見上げた。\n\n' +
      '「――ひとつだけ。屋根裏部屋には、入ってはなりませんよ」',
    // ここでは「休む」のみを表示する
    choices: [{ label: '休む', next: 'sleep1' }],
  },
  {
    id: 'sleep1',
    location: '個室',
    angelExpression: 'soft',
    angelStatus: '静かに部屋を出ていった',
    logText: '眠りについた。',
    text:
      '長旅の疲れもあって、あなたは大人しく従うことにした。\n' +
      'ベッドに横になり、静かに目を閉じる。\n\n' +
      '木の軋む音、遠くの鳥の声、風が窓を撫でる音。\n' +
      '辺境の教会には、大教会にはなかった静けさがあった。\n\n' +
      'いつの間にか、あなたは眠りに落ちていた。',
    choices: [{ label: '（……）', next: 'noise_wake' }],
  },
  {
    id: 'noise_wake',
    timeSlot: 'night',
    location: '個室',
    logText: '小さな物音で目を覚ました。',
    text:
      '――小さな悲鳴と、何かが倒れるような物音で目を覚ます。\n\n' +
      '音は、どうやら天井の方――屋根裏部屋の辺りから聞こえたようだった。\n' +
      '入ってはならないと言われたばかりの、あの場所から。\n\n' +
      'あなたはベッドの上で、一瞬迷った。',
    choices: [
      {
        label: '屋根裏部屋へ向かう',
        next: 'bridge_to_attic',
        setFlags: { went_to_attic: true, prioritized_help: true },
        logText: '物音が気になり、屋根裏部屋へ向かうことにした。',
      },
      {
        label: 'しばらく様子を見る',
        next: 'bridge_to_attic',
        setFlags: { stayed_in_room: true },
        logText: 'しばらく様子を見ることにした。',
      },
      {
        label: 'シスターを呼ぶ',
        next: 'bridge_to_attic',
        setFlags: { prioritized_help: true },
        logText: 'シスターの名を呼んでみた。',
      },
      {
        label: '部屋に留まる',
        next: 'bridge_to_attic',
        setFlags: { respected_warning: true, stayed_in_room: true },
        logText: '言いつけを守り、部屋に留まろうとした。',
      },
    ],
  },
  {
    id: 'bridge_to_attic',
    location: '個室',
    logText: '屋根裏部屋の異変が気になった。',
    text:
      '迷っているうちにも、物音は止まない。\n' +
      '胸騒ぎを覚えたあなたは、結局、音のした屋根裏部屋へと向かうことにした。',
    choices: [{ label: '（……）', next: 'attic_fire' }],
  },
  {
    id: 'attic_fire',
    location: '屋根裏部屋',
    angelExpression: 'shocked',
    angelStatus: '倒れたろうそくのそばに座り込んでいる',
    logText: '火を消し止めた。',
    text:
      '重い扉を開けると、そこには信じられない光景が広がっていた。\n\n' +
      'ほとんど白く、先端だけが黒く染まった大きな翼を広げたシスターが、床に座り込んでいる。\n' +
      '倒れたろうそくから、小さな火が布に燃え移りかけていた。\n' +
      '部屋の中央には、見たこともない魔法陣が淡く光っている。\n\n' +
      '考えるより先に、あなたは駆け寄って火を踏み消していた。',
    choices: [{ label: '（……）', next: 'angel_confession' }],
  },
  {
    id: 'angel_confession',
    location: '屋根裏部屋',
    angelExpression: 'sad',
    angelStatus: '観念したような表情をしている',
    setFlags: { angel_revealed: true },
    relationChange: 1,
    logText: 'シスターが天使であることを知った。',
    text:
      '火が消えたのを確かめてから、あなたはようやく振り返る。\n' +
      '揺れるろうそくの灯りの中、白と黒の翼を持つシスターと、目が合った。\n\n' +
      '「……見られてしまいましたね」\n\n' +
      'シスターは小さく息をつき、静かに話し始めた。\n\n' +
      '「わたしは、天使です。大昔からこの土地を見守り、日々祈りを捧げることで、世界の均衡を保ってきました」\n' +
      '「少し……疲れが溜まっていたようです。それで、翼がろうそくに触れてしまったのでしょう」\n\n' +
      '短い沈黙が、部屋に降りる。',
    choices: [{ label: '（……）', next: 'meal_event' }],
  },
  {
    id: 'meal_event',
    location: '台所',
    angelExpression: 'surprised',
    angelStatus: '驚きつつも、少し嬉しそうにしている',
    relationChange: 1,
    logText: '手料理を振る舞った。',
    text:
      'あなたは、それ以上深くは尋ねなかった。\n' +
      'かわりに台所へ向かい、有り合わせの材料で温かい食事を作ることにした。\n\n' +
      '「え……わたしのために、ですか？」\n\n' +
      '差し出された皿に、シスター――天使様は驚いたように瞬きをした後、ふわりと表情を緩めた。\n\n' +
      '「{playerCallName}、怖くはないのですか。翼を見ても」\n' +
      '「いいえ、あまり」とあなたが答えると、天使様は少しだけ肩の力を抜いたようだった。\n\n' +
      '他愛のない会話をしながら、二人は同じ食卓を囲んだ。\n' +
      '名前も知らなかった相手との距離が、ほんの少しだけ縮まった夜だった。',
    choices: [{ label: '（……）', next: 'night_care' }],
  },
  {
    id: 'night_care',
    location: '個室',
    angelExpression: 'sleepy',
    angelStatus: 'ベッドに腰掛け、少し気を抜いている',
    relationChange: 1,
    setFlags: { first_night_care_done: true },
    logText: '天使様の疲れを労った。',
    text:
      '食事を終え、二人は個室に戻った。\n' +
      '天使様は、二つ並んだベッドのうちひとつに、静かに腰を下ろす。\n\n' +
      '「明日もあるのですから、そろそろ休みましょう」\n\n' +
      '「――その前に、少しだけ疲れを取りましょう」\n' +
      'あなたはそう言って、天使様の肩や手にそっと触れ、凝りをほぐすように優しく揉みほぐした。\n\n' +
      '天使様は目を細め、されるがままになっていた。\n' +
      'やがて満足したように小さく息を吐くと、そのまま静かに眠りに落ちていった。\n\n' +
      '――その日から、二人の生活が始まったのでした。',
    // next: 'FREE_START' は自由行動フェーズへの移行を示す特別な値
    choices: [{ label: '2日目の朝へ', next: 'FREE_START' }],
  },
];

/* ---------------------- 自由行動：時間帯ごとの導入文 ---------------------- */
const slotIntroTexts = {
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
};

/* ---------------------- 自由行動イベント ---------------------- */
// id / day / timeSlot / action / priority / condition / text / setFlags /
// relationChange / angelExpression / angelStatus / location
const freeActionEvents = [
  // --- 家事をする ---
  {
    id: 'chores_d2_morning', day: 2, timeSlot: 'morning', action: 'chores', priority: 10,
    text:
      '洗濯物を裏庭に干していると、天使様がそっと手伝いに来てくれた。\n\n' +
      '「こういう、地に足のついたことは苦手で……助かります」\n\n' +
      '二人でシーツを広げていると、いつもより会話が弾んだ。',
    setFlags: { helped_church: true }, relationChange: 1,
    angelExpression: 'grateful', angelStatus: '家事を手伝ってくれて嬉しそう', location: '裏庭',
  },
  {
    id: 'chores_d2_noon', day: 2, timeSlot: 'noon', action: 'chores', priority: 10,
    text:
      '埃の溜まった棚を拭き、ろうそくの替えを揃える。\n' +
      '地味だけれど、教会の暮らしにはこうした積み重ねが要るのだと分かってきた。\n\n' +
      '天使様は「ずいぶんきれいになりましたね」と、珍しく声を弾ませた。',
    setFlags: { helped_church: true }, relationChange: 1,
    angelExpression: 'pleased', angelStatus: '部屋が整って満足げ', location: '礼拝堂',
  },
  {
    id: 'chores_d3_morning', day: 3, timeSlot: 'morning', action: 'chores', priority: 10,
    text:
      '食器を洗い、朝食の片付けをする。\n' +
      '水の音だけが響く、静かな時間。\n\n' +
      '天使様が横で布巾を持ち、なんとなく一緒に手伝ってくれた。',
    setFlags: { helped_church: true }, relationChange: 1,
    angelExpression: 'soft', angelStatus: '静かに手伝ってくれている', location: '台所',
  },
  {
    id: 'chores_d3_noon', day: 3, timeSlot: 'noon', action: 'chores', priority: 10,
    text:
      '床を掃き、窓を拭く。木の床は磨くほどに艶を取り戻していく。\n\n' +
      '「この教会も、あなたが来てから少し明るくなった気がします」\n' +
      '天使様がぽつりと呟いた。',
    setFlags: { helped_church: true }, relationChange: 1,
    angelExpression: 'warm', angelStatus: '嬉しそうに微笑んでいる', location: '礼拝堂',
  },
  {
    id: 'chores_fallback', action: 'chores', priority: 1,
    text: 'ふと目についた家事を片付ける。地味だけれど、心が落ち着く時間だった。',
    setFlags: { helped_church: true }, relationChange: 1,
    angelExpression: 'soft', angelStatus: '穏やかな様子でいる', location: '個室',
  },

  // --- 祈る ---
  {
    id: 'pray_d2_morning', day: 2, timeSlot: 'morning', action: 'pray', priority: 10,
    text:
      '天使様に倣って、朝の短い祈りに付き合う。\n' +
      '言葉の意味はよく分からないが、静かに手を合わせる時間は、悪くないと思えた。',
    setFlags: { prayed_with_angel: true }, relationChange: 1,
    angelExpression: 'calm', angelStatus: '朝の祈りに集中している', location: '祈りの間',
  },
  {
    id: 'pray_d2_noon', day: 2, timeSlot: 'noon', action: 'pray', priority: 10,
    text:
      '祈りの間、蝋を整えたり、小さな雑用で天使様の仕事を手伝う。\n\n' +
      '「こういう手伝いは、初めてです」と天使様は少し照れたように言った。',
    setFlags: { prayed_with_angel: true }, relationChange: 1,
    angelExpression: 'shy', angelStatus: '少し照れくさそう', location: '祈りの間',
  },
  {
    id: 'pray_d3_morning', day: 3, timeSlot: 'morning', action: 'pray', priority: 10,
    text:
      '並んで祈りを捧げる時間にも、少しずつ慣れてきた。\n' +
      'ふと、自分の中にある小さな痛みのことを、静かに見つめ直す。',
    setFlags: { prayed_with_angel: true }, relationChange: 1,
    angelExpression: 'gentle', angelStatus: '静かに寄り添ってくれている', location: '祈りの間',
  },
  {
    id: 'pray_d3_noon', day: 3, timeSlot: 'noon', action: 'pray', priority: 10,
    text:
      '天使様の祈りを、少し離れた場所からそっと見守る。\n' +
      '横顔はどこまでも静かで、けれど確かに疲れの色があった。',
    setFlags: { prayed_with_angel: true }, relationChange: 1,
    angelExpression: 'tired', angelStatus: '祈りの疲れが見える', location: '祈りの間',
  },
  {
    id: 'pray_fallback', action: 'pray', priority: 1,
    text: '静かに手を合わせ、少しだけ祈りの真似事をしてみる。',
    setFlags: { prayed_with_angel: true }, relationChange: 1,
    angelExpression: 'calm', angelStatus: '穏やかな様子でいる', location: '個室',
  },

  // --- 休む ---
  {
    id: 'rest_d2_morning', day: 2, timeSlot: 'morning', action: 'rest', priority: 10,
    text:
      '特に何をするでもなく、ベッドに腰掛けてぼんやり過ごす。\n' +
      '外から、夏の終わりを告げる虫の声が聞こえてくる。\n\n' +
      '何もしない時間も、悪くないと思えた。',
    setFlags: { rested_in_room: true }, relationChange: 1,
    angelExpression: 'soft', angelStatus: 'そっと見守ってくれている', location: '個室',
  },
  {
    id: 'rest_d2_noon', day: 2, timeSlot: 'noon', action: 'rest', priority: 10,
    text:
      '窓辺に座り、風にあたりながら目を閉じる。\n' +
      '天使様がふと隣に腰を下ろし、同じ風を感じているようだった。',
    setFlags: { rested_in_room: true }, relationChange: 1,
    angelExpression: 'calm', angelStatus: '隣で同じ風を感じている', location: '個室',
  },
  {
    id: 'rest_d3_morning', day: 3, timeSlot: 'morning', action: 'rest', priority: 10,
    text:
      '少しの間、何も考えずに横になる。\n' +
      '天井の木目を眺めていると、自然と肩の力が抜けていく。',
    setFlags: { rested_in_room: true }, relationChange: 1,
    angelExpression: 'gentle', angelStatus: '穏やかな表情をしている', location: '個室',
  },
  {
    id: 'rest_d3_noon', day: 3, timeSlot: 'noon', action: 'rest', priority: 10,
    text:
      '静かな部屋で、ただ時間が過ぎるのに任せる。\n' +
      '天使様が時折こちらを見ていることに、なんとなく気づいていた。',
    setFlags: { rested_in_room: true }, relationChange: 1,
    angelExpression: 'warm', angelStatus: '時折こちらを見ている', location: '個室',
  },
  {
    id: 'rest_fallback', action: 'rest', priority: 1,
    text: '目を閉じ、何もしない時間をただ過ごす。',
    setFlags: { rested_in_room: true }, relationChange: 1,
    angelExpression: 'soft', angelStatus: '穏やかな様子でいる', location: '個室',
  },

  // --- 話しかける ---
  {
    id: 'talk_d2_morning', day: 2, timeSlot: 'morning', action: 'talk', priority: 10,
    text:
      '「大教会では、どんなお仕事を？」\n' +
      '天使様に問われ、ぽつりぽつりと自分のことを話す。\n\n' +
      '左遷同然の派遣だということは、なんとなく伏せておいた。',
    setFlags: { talked_with_angel: true }, relationChange: 1,
    angelExpression: 'curious', angelStatus: '話に耳を傾けている', location: '個室',
  },
  {
    id: 'talk_d2_noon', day: 2, timeSlot: 'noon', action: 'talk', priority: 10,
    text:
      '天使様に、この土地のことを尋ねてみる。\n\n' +
      '「大昔から、ずっとここに？」\n' +
      '「ええ。人も、景色も、少しずつ変わっていくのを見てきました」\n' +
      'そう語る横顔は、どこか遠い目をしていた。',
    setFlags: { talked_with_angel: true }, relationChange: 1,
    angelExpression: 'nostalgic', angelStatus: '昔を思い出しているよう', location: '個室',
  },
  {
    // 2日目に話しかけていた場合、天使様が覚えていてくれる分岐
    id: 'talk_d3_morning_remember', day: 3, timeSlot: 'morning', action: 'talk', priority: 10,
    condition: (state) => state.memoryFlags.talked_with_angel,
    text:
      '他愛のない話をしていると、天使様が以前あなたの話したことを、ふと覚えていてくれたことに気づく。\n\n' +
      '「前に、そう仰っていましたね」\n' +
      'そんな些細な一言が、少し嬉しかった。',
    setFlags: { talked_with_angel: true }, relationChange: 1,
    angelExpression: 'warm', angelStatus: '嬉しそうにしている', location: '個室',
  },
  {
    id: 'talk_d3_morning_first', day: 3, timeSlot: 'morning', action: 'talk', priority: 5,
    text:
      '天使様に、故郷のことを少しだけ話してみる。\n\n' +
      '「そう、なのですね」\n' +
      '短い返事だったけれど、静かに耳を傾けてくれているのが伝わってきた。',
    setFlags: { talked_with_angel: true }, relationChange: 1,
    angelExpression: 'warm', angelStatus: '静かに耳を傾けている', location: '個室',
  },
  {
    id: 'talk_d3_noon', day: 3, timeSlot: 'noon', action: 'talk', priority: 10,
    text:
      '「{playerCallName}、辺境に来て、まだ三日ですのに」\n' +
      '天使様がふと笑った。\n' +
      '「もう随分と、長く一緒にいるような気がします」\n\n' +
      'その言葉に、あなたも小さく頷いた。',
    setFlags: { talked_with_angel: true }, relationChange: 1,
    angelExpression: 'happy', angelStatus: '柔らかく笑っている', location: '個室',
  },
  {
    id: 'talk_fallback', action: 'talk', priority: 1,
    text: '他愛のないことを、少しだけ話してみる。',
    setFlags: { talked_with_angel: true }, relationChange: 1,
    angelExpression: 'warm', angelStatus: '穏やかな様子でいる', location: '個室',
  },
];

/* ---------------------- 夜の強制イベント（2日目夜 / 3日目夜） ---------------------- */
const forcedNightEvents = {
  2: {
    id: 'pain_event',
    location: '個室',
    angelExpression: 'concerned',
    angelStatus: '心配そうにこちらを見ている',
    relationChange: 1,
    text:
      '夜、ろうそくの灯りの下で、天使様がふと手を止めてこちらを見た。\n\n' +
      '「――ここへ来る前から、あまり眠れていなかったのですか？」\n\n' +
      '静かな声だった。責めるようではなく、ただ気づかったふうに。',
    choices: [
      { label: '少しだけ', setFlags: { pain_tired: true }, logText: '「少しだけ」と答えた。' },
      { label: '大丈夫です', setFlags: { hide_pain: true }, logText: '「大丈夫です」と答えた。' },
    ],
  },
  3: {
    id: 'remembered_event',
    location: '個室',
    angelExpression: 'gentle',
    angelStatus: '静かにこちらを見つめている',
    setFlags: { remembered_by_angel: true },
    relationChange: 1,
    continueLabel: '（……）',
    textFn: (flags) => {
      const intro = '夜、眠りにつく前。天使様が、ふと思い出したように口を開いた。\n\n';
      if (flags.pain_tired) {
        return (
          intro +
          '「昨夜、少しだけ眠れていないと仰っていましたね」\n' +
          '天使様は静かにそう言うと、あなたの隣にそっと腰を下ろした。\n' +
          '「今夜は、ゆっくり眠れるといいのですが」'
        );
      }
      if (flags.hide_pain) {
        return (
          intro +
          '「大丈夫だと仰っていましたけれど……無理をなさる癖が、おありのようですね」\n' +
          '天使様は少し困ったように、けれど優しく笑った。\n' +
          '「わたしには、少しくらい頼ってくださって構いませんよ」'
        );
      }
      return (
        intro +
        '「あなたは、思っていたよりずっと頑張り屋さんのようですね」\n' +
        '天使様は静かにそう言って、微笑んだ。'
      );
    },
  },
};

const painAfterTexts = {
  tired:
    '「そう、ですか」\n' +
    '天使様は小さく頷き、それ以上は何も言わなかった。ただ、少しだけ布団を整えてくれた。',
  hide:
    '「……そうですか」\n' +
    '天使様は少し寂しそうな、それでいて何かを察したような顔をした。\n\n' +
    '「無理は、なさらないでくださいね」',
};

/* ---------------------- 毎晩ケア（2日目以降・自由行動の夜） ---------------------- */
// 会話追加: scenario-data.js の SCENARIO_DATA.nightCareEvents に
// day / priority / text 等を足す
// id / day / priority / condition / text / location / angelExpression / angelStatus /
// setFlags / relationChange
// scenario-data.js が読み込まれていない場合の最低限フォールバック（該当なし扱い）
const nightCareEvents =
  (window.SCENARIO_DATA && window.SCENARIO_DATA.nightCareEvents) || [];

/* -------------------------------------------------------------------------
   2. gameState と状態遷移ロジック
   ------------------------------------------------------------------------- */

function createInitialState() {
  return {
    day: 1,
    timeSlot: 'noon',
    phase: 'opening', // 'title' | 'opening' | 'free' | 'ending'
    currentSceneId: 'arrival',
    freeStep: null, // 'select' | 'result' | 'forced' | 'forced_after' | 'night_care'
    pendingAction: null,
    pendingEntryId: null,
    pendingNightCareId: null,
    nightCareCount: 0,
    careStyle: 'default',
    seenNightCareIds: [],
    currentLocation: '教会前',
    relationStage: 0,
    angelExpression: 'tired',
    angelStatus: '少し疲れた様子で出迎えてくれた',
    memoryFlags: Object.assign({}, memoryFlagsDefault),
    stats: Object.assign({}, statsDefault),
    actionCounts: Object.assign({}, actionCountsDefault),
    lastStatChanges: null,
    statChangeLog: [],
    seenEventIds: [],
    log: [],
    playerCallName: '',
    callNameReactionText: null,
    pendingCallNameNext: null,
  };
}

let gameState = createInitialState();
let debugVisible = false;

function getPlayerCallName() {
  const name = (gameState.playerCallName || '').trim();
  return name || DEFAULT_CALL_NAME;
}

function formatDialogue(text) {
  if (!text) return '';
  return text.replace(/\{playerCallName\}/g, getPlayerCallName());
}

function findCallNameReaction(rawInput) {
  const input = (rawInput || '').trim();
  if (!input) return null;
  for (const reaction of callNameReactions) {
    if (reaction.type === 'exact' && input === reaction.word) return reaction;
  }
  for (const reaction of callNameReactions) {
    if (reaction.type === 'includes' && input.includes(reaction.word)) return reaction;
  }
  return null;
}

/* ---- オープニング（固定シーン）の進行 ---- */

function enterScene(sceneId) {
  const scene = sceneDefinitions.find((s) => s.id === sceneId);
  if (!scene) return;
  gameState.currentSceneId = sceneId;
  if (scene.location) gameState.currentLocation = scene.location;
  if (scene.timeSlot) gameState.timeSlot = scene.timeSlot;
  if (scene.angelExpression) gameState.angelExpression = scene.angelExpression;
  if (scene.angelStatus) gameState.angelStatus = scene.angelStatus;
  if (scene.setFlags) Object.assign(gameState.memoryFlags, scene.setFlags);
  if (scene.relationChange) gameState.relationStage += scene.relationChange;
  if (!gameState.seenEventIds.includes(sceneId)) gameState.seenEventIds.push(sceneId);
  if (scene.logText) addLog(formatDialogue(scene.logText));
  render();
}

function onCallNameSubmit() {
  const inputEl = document.getElementById('callname-input');
  const raw = (inputEl ? inputEl.value : '').slice(0, CALL_NAME_MAX_LENGTH);
  const trimmed = raw.trim();
  gameState.playerCallName = trimmed;

  const scene = sceneDefinitions.find((s) => s.id === gameState.currentSceneId);
  addLog(trimmed ? `呼び名を「${trimmed}」と伝えた。` : '呼び名を伝えなかった。');

  const reaction = findCallNameReaction(trimmed);
  if (reaction) {
    gameState.callNameReactionText = reaction.text;
    gameState.pendingCallNameNext = scene ? scene.next : 'guide_room';
    render();
    return;
  }

  enterScene(scene ? scene.next : 'guide_room');
}

function onCallNameReactionContinue() {
  const next = gameState.pendingCallNameNext || 'guide_room';
  gameState.callNameReactionText = null;
  gameState.pendingCallNameNext = null;
  enterScene(next);
}

function onOpeningChoiceClick(choice) {
  if (choice.setFlags) Object.assign(gameState.memoryFlags, choice.setFlags);
  if (choice.relationChange) gameState.relationStage += choice.relationChange;
  if (choice.logText) addLog(choice.logText);

  if (choice.next === 'FREE_START') {
    startFreePhase();
  } else {
    enterScene(choice.next);
  }
}

function startFreePhase() {
  gameState.phase = 'free';
  gameState.day = 2;
  gameState.timeSlot = 'morning';
  gameState.freeStep = 'select';
  gameState.pendingAction = null;
  gameState.pendingEntryId = null;
  gameState.currentLocation = '個室';
  gameState.angelExpression = 'soft';
  gameState.angelStatus = '朝の支度をしている';
  addLog('2日目の朝を迎えた。');
  render();
}

/* ---- 自由行動フェーズ ---- */

function getSlotIntroText() {
  const key = `day${gameState.day}-${gameState.timeSlot}`;
  return slotIntroTexts[key] || '静かな時間が流れている。\n\nさて、何をしよう。';
}

function findFreeActionEvent(day, timeSlot, action) {
  const candidates = freeActionEvents.filter(
    (e) =>
      e.action === action &&
      (e.day === undefined || e.day === day) &&
      (e.timeSlot === undefined || e.timeSlot === timeSlot) &&
      (!e.condition || e.condition(gameState))
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  return candidates[0];
}

const actionLogLabels = {
  chores: '家事をした。',
  pray: '祈りを捧げた。',
  rest: 'ゆっくり休んだ。',
  talk: '天使様に話しかけた。',
};

/* ---- パラメーター（stats）更新 ---- */
// 心身の余白は行動不能を生むスタミナではないため、低くても行動は制限しない。

function clampStats() {
  Object.keys(statsRange).forEach((key) => {
    const [min, max] = statsRange[key];
    gameState.stats[key] = Math.min(max, Math.max(min, gameState.stats[key]));
  });
}

function formatStatDelta(key, delta) {
  const sign = delta > 0 ? '+' : '';
  return `${statLabels[key] || key} ${sign}${delta}`;
}

function formatStatsForDebug(stats) {
  const labeled = {};
  Object.keys(stats).forEach((key) => {
    labeled[statLabels[key] || key] = stats[key];
  });
  return labeled;
}

function formatActionCountsForDebug(counts) {
  const labeled = {};
  Object.keys(counts).forEach((key) => {
    labeled[actionLabels[key] || key] = counts[key];
  });
  return labeled;
}

function formatChangesText(changes) {
  return Object.keys(changes)
    .filter((key) => changes[key] !== 0)
    .map((key) => formatStatDelta(key, changes[key]))
    .join(' / ');
}

// パラメータ増減の共通処理（デバッグ用 lastStatChanges / statChangeLog もここで更新）
function applyStatChanges(label, changes, options = {}) {
  const before = Object.assign({}, gameState.stats);

  if (options.beforeApply) {
    options.beforeApply(before);
  }

  Object.keys(changes).forEach((key) => {
    if (gameState.stats[key] !== undefined) {
      gameState.stats[key] += changes[key];
    }
  });

  clampStats();

  const actualChanges = {};
  Object.keys(statsDefault).forEach((key) => {
    const diff = gameState.stats[key] - before[key];
    if (diff !== 0) actualChanges[key] = diff;
  });

  if (options.actionCountKey) {
    gameState.actionCounts[options.actionCountKey] += 1;
  }

  gameState.lastStatChanges = {
    label,
    changes: actualChanges,
  };

  if (!Array.isArray(gameState.statChangeLog)) {
    gameState.statChangeLog = [];
  }
  gameState.statChangeLog.unshift({
    day: gameState.day,
    timeSlot: gameState.timeSlot,
    label,
    changesText: formatChangesText(actualChanges),
  });
  if (gameState.statChangeLog.length > 10) {
    gameState.statChangeLog.length = 10;
  }
}

function applyChoresStats() {
  applyStatChanges(
    actionLabels.chores,
    { caretakerAptitude: 2, angelFatigue: -1, mentalMargin: -1 },
    { actionCountKey: 'chores' }
  );
}

function applyPrayStats() {
  const changes = { prayerTuning: 2, mentalMargin: -1 };
  if (gameState.stats.angelFatigue <= 3) {
    changes.prayerTuning += 1;
  }
  applyStatChanges(actionLabels.pray, changes, { actionCountKey: 'pray' });
}

function applyRestStats() {
  applyStatChanges(
    actionLabels.rest,
    { mentalMargin: 2 },
    {
      actionCountKey: 'rest',
      beforeApply: (before) => {
        if (before.mentalMargin <= 2) {
          gameState.memoryFlags.rest_when_tired = true;
        }
      },
    }
  );
}

function applyTalkStats() {
  applyStatChanges(actionLabels.talk, { trust: 2 }, { actionCountKey: 'talk' });
}

function applyNightCareStats() {
  const changes = { trust: 1, angelFatigue: -1, mentalMargin: -1 };
  if (gameState.stats.mentalMargin >= 7) {
    changes.angelFatigue -= 1;
  }
  applyStatChanges(actionLabels.nightCare, changes, {
    actionCountKey: 'nightCare',
    beforeApply: (before) => {
      if (before.mentalMargin <= 2) {
        gameState.memoryFlags.angel_noticed_player_tired = true;
      }
    },
  });
}

const actionStatEffects = {
  chores: applyChoresStats,
  pray: applyPrayStats,
  rest: applyRestStats,
  talk: applyTalkStats,
};

function onActionButtonClick(actionId) {
  gameState.pendingAction = actionId;
  gameState.freeStep = 'result';

  // 選ばれたイベントは setFlags 適用前に確定させ、その id を保存しておく。
  // （renderFree 側で毎回 findFreeActionEvent を呼び直すと、setFlags で
  //   条件が変化した直後に別のイベントへすり替わってしまうため）
  const entry = findFreeActionEvent(gameState.day, gameState.timeSlot, actionId);
  gameState.pendingEntryId = entry ? entry.id : null;
  if (entry) {
    if (entry.setFlags) Object.assign(gameState.memoryFlags, entry.setFlags);
    if (entry.relationChange) gameState.relationStage += entry.relationChange;
    if (entry.angelExpression) gameState.angelExpression = entry.angelExpression;
    if (entry.angelStatus) gameState.angelStatus = entry.angelStatus;
    if (entry.location) gameState.currentLocation = entry.location;
    const key = `free_${gameState.day}_${gameState.timeSlot}_${actionId}`;
    if (!gameState.seenEventIds.includes(key)) gameState.seenEventIds.push(key);
  }
  if (actionStatEffects[actionId]) actionStatEffects[actionId]();
  addLog(actionLogLabels[actionId] || '行動した。');
  render();
}

function onResultContinueClick() {
  advanceTime();
}

function advanceTime() {
  const idx = TIME_SLOTS.indexOf(gameState.timeSlot);
  if (gameState.timeSlot !== 'night') {
    gameState.timeSlot = TIME_SLOTS[idx + 1];
  } else {
    gameState.day += 1;
    gameState.timeSlot = 'morning';
  }
  gameState.pendingAction = null;
  gameState.pendingEntryId = null;

  if (gameState.timeSlot === 'night') {
    if (forcedNightEvents[gameState.day]) {
      enterForcedNightEvent();
    } else if (gameState.day >= 2) {
      enterNightCare();
    } else {
      gameState.freeStep = 'select';
      gameState.currentLocation = '個室';
      render();
    }
  } else {
    gameState.freeStep = 'select';
    gameState.currentLocation = '個室';
    render();
  }
}

function enterForcedNightEvent() {
  const fe = forcedNightEvents[gameState.day];
  gameState.freeStep = 'forced';
  gameState.currentLocation = fe.location || '個室';
  if (fe.angelExpression) gameState.angelExpression = fe.angelExpression;
  if (fe.angelStatus) gameState.angelStatus = fe.angelStatus;
  if (fe.setFlags) Object.assign(gameState.memoryFlags, fe.setFlags);
  if (fe.relationChange) gameState.relationStage += fe.relationChange;

  const key = `forced_night_${gameState.day}`;
  if (!gameState.seenEventIds.includes(key)) gameState.seenEventIds.push(key);
  addLog(
    gameState.day === 2
      ? '天使様が、あなたの疲れに気づいたようだった。'
      : '天使様が、前の晩のことを覚えていた。'
  );
  render();
}

function onForcedChoiceClick(choice) {
  if (choice.setFlags) Object.assign(gameState.memoryFlags, choice.setFlags);
  if (choice.logText) addLog(choice.logText);
  gameState.freeStep = 'forced_after';
  render();
}

function getPainAfterText() {
  return gameState.memoryFlags.pain_tired ? painAfterTexts.tired : painAfterTexts.hide;
}

function onForcedAfterContinue() {
  enterNightCare();
}

function onForcedSingleContinue() {
  enterNightCare();
}

function findNightCareEvent(day) {
  const candidates = nightCareEvents.filter(
    (e) =>
      (e.day === undefined || e.day === day) &&
      (!e.condition || e.condition(gameState))
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  return candidates[0];
}

function enterNightCare() {
  if (gameState.day < 2) {
    gameState.freeStep = 'select';
    gameState.currentLocation = '個室';
    render();
    return;
  }

  const entry = findNightCareEvent(gameState.day);
  gameState.freeStep = 'night_care';
  gameState.pendingNightCareId = entry ? entry.id : null;

  gameState.nightCareCount += 1;
  gameState.memoryFlags.first_night_care_done = true;
  gameState.memoryFlags.night_care_routine_started = true;
  applyNightCareStats();

  if (entry) {
    if (entry.location) gameState.currentLocation = entry.location;
    if (entry.angelExpression) gameState.angelExpression = entry.angelExpression;
    if (entry.angelStatus) gameState.angelStatus = entry.angelStatus;
    if (entry.setFlags) Object.assign(gameState.memoryFlags, entry.setFlags);
    if (entry.relationChange) gameState.relationStage += entry.relationChange;
    const key = entry.id || `night_care_${gameState.day}`;
    if (!gameState.seenNightCareIds.includes(key)) {
      gameState.seenNightCareIds.push(key);
    }
  }

  addLog('就寝前、天使様のケアをした。');
  render();
}

function onNightCareContinue() {
  addLog('静かに眠りについた。');
  gameState.pendingNightCareId = null;

  if (gameState.day >= 3) {
    showEndingScreen();
    return;
  }

  gameState.day += 1;
  gameState.timeSlot = 'morning';
  gameState.freeStep = 'select';
  gameState.pendingAction = null;
  gameState.pendingEntryId = null;
  gameState.currentLocation = '個室';
  render();
}

function showEndingScreen() {
  gameState.phase = 'ending';
  addLog('モック v0.2 の範囲はここまで。');
  render();
}

/* -------------------------------------------------------------------------
   3. 描画（render）まわり
   ------------------------------------------------------------------------- */

function showScreen(name) {
  document.getElementById('screen-title').classList.toggle('hidden', name !== 'title');
  document.getElementById('screen-game').classList.toggle('hidden', name !== 'game');
  document.getElementById('screen-ending').classList.toggle('hidden', name !== 'ending');
}

function setMessage(text) {
  document.getElementById('message-text').textContent = formatDialogue(text);
}

function clearChoiceBox() {
  document.getElementById('choice-box').innerHTML = '';
}

function renderChoiceButtons(items) {
  const box = document.getElementById('choice-box');
  box.innerHTML = '';
  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-btn';
    btn.textContent = item.label;
    btn.addEventListener('click', item.onClick);
    box.appendChild(btn);
  });
}

function showActionBox() {
  document.getElementById('action-box').classList.remove('hidden');
}

function hideActionBox() {
  document.getElementById('action-box').classList.add('hidden');
}

function renderActionButtons() {
  const container = document.getElementById('action-buttons');
  container.innerHTML = '';
  actionDefinitions.forEach((a) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action-btn';
    btn.textContent = a.label;
    btn.addEventListener('click', () => onActionButtonClick(a.id));
    container.appendChild(btn);
  });
}

function renderHUD() {
  document.getElementById('hud-day').textContent = `${gameState.day}日目`;
  document.getElementById('hud-time').textContent =
    timeSlotLabels[gameState.timeSlot] || gameState.timeSlot;
  document.getElementById('hud-location').textContent = gameState.currentLocation;
  document.body.classList.toggle('time-night', gameState.timeSlot === 'night');
}

function relationLabel(v) {
  if (v <= 1) return 'まだ遠い';
  if (v <= 4) return '少しずつ近づいている';
  if (v <= 7) return '穏やかな信頼';
  return '静かな安心';
}

function renderAngelPanel() {
  document.getElementById('angel-expression-text').textContent = `表情: ${gameState.angelExpression}`;
  document.getElementById('angel-status-text').textContent = gameState.angelStatus || '';
  document.getElementById('relation-stage-text').textContent =
    `距離感: ${relationLabel(gameState.relationStage)} (${gameState.relationStage})`;
}

function renderCallNameInput() {
  const box = document.getElementById('choice-box');
  box.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'callname-input-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'callname-input';
  input.className = 'callname-input';
  input.maxLength = CALL_NAME_MAX_LENGTH;
  input.placeholder = '呼び名（7文字まで）';
  input.value = gameState.playerCallName || '';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onCallNameSubmit();
  });

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'choice-btn callname-submit-btn';
  btn.textContent = '決める';
  btn.addEventListener('click', onCallNameSubmit);

  row.appendChild(input);
  row.appendChild(btn);
  box.appendChild(row);
}

function renderOpening() {
  hideActionBox();
  if (gameState.callNameReactionText) {
    setMessage(gameState.callNameReactionText);
    renderChoiceButtons([{ label: '続ける', onClick: onCallNameReactionContinue }]);
    return;
  }
  const scene = sceneDefinitions.find((s) => s.id === gameState.currentSceneId);
  if (!scene) return;
  setMessage(scene.text);
  if (scene.inputCallName) {
    renderCallNameInput();
    return;
  }
  if (!scene.choices) return;
  renderChoiceButtons(
    scene.choices.map((c) => ({ label: c.label, onClick: () => onOpeningChoiceClick(c) }))
  );
}

function renderFree() {
  if (gameState.freeStep === 'select') {
    hideActionBox();
    clearChoiceBox();
    setMessage(getSlotIntroText());
    showActionBox();
    renderActionButtons();
  } else if (gameState.freeStep === 'result') {
    hideActionBox();
    // 選択時に確定させた entry を id で引き直す（flags 変化後の再判定によるすり替わりを防ぐ）
    const entry = gameState.pendingEntryId
      ? freeActionEvents.find((e) => e.id === gameState.pendingEntryId)
      : null;
    setMessage(entry ? entry.text : '（特に変わったことはなかった。）');
    renderChoiceButtons([{ label: '続ける', onClick: onResultContinueClick }]);
  } else if (gameState.freeStep === 'forced') {
    hideActionBox();
    const fe = forcedNightEvents[gameState.day];
    const text = fe.textFn ? fe.textFn(gameState.memoryFlags) : fe.text;
    setMessage(text);
    if (fe.choices) {
      renderChoiceButtons(fe.choices.map((c) => ({ label: c.label, onClick: () => onForcedChoiceClick(c) })));
    } else {
      renderChoiceButtons([{ label: fe.continueLabel || '続ける', onClick: onForcedSingleContinue }]);
    }
  } else if (gameState.freeStep === 'forced_after') {
    hideActionBox();
    setMessage(getPainAfterText());
    renderChoiceButtons([{ label: '続ける', onClick: onForcedAfterContinue }]);
  } else if (gameState.freeStep === 'night_care') {
    hideActionBox();
    const entry = gameState.pendingNightCareId
      ? nightCareEvents.find((e) => e.id === gameState.pendingNightCareId)
      : null;
    setMessage(
      entry
        ? entry.text
        : '就寝前、天使様の肩をそっとほぐした。\n\n「……お休みなさい」'
    );
    renderChoiceButtons([{ label: '就寝する', onClick: onNightCareContinue }]);
  }
}

function renderLog() {
  const list = document.getElementById('log-list');
  list.innerHTML = '';
  const items = gameState.log.slice().reverse();
  items.forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = entry;
    list.appendChild(div);
  });
}

function renderDebug() {
  if (!debugVisible) return;
  const info = {
    day: gameState.day,
    timeSlot: gameState.timeSlot,
    timeSlotLabel: timeSlotLabels[gameState.timeSlot] || gameState.timeSlot,
    phase: gameState.phase,
    relationStage: gameState.relationStage,
    nightCareCount: gameState.nightCareCount,
    careStyle: gameState.careStyle,
    playerCallName: gameState.playerCallName,
    effectiveCallName: getPlayerCallName(),
    stats: formatStatsForDebug(gameState.stats),
    actionCounts: formatActionCountsForDebug(gameState.actionCounts),
    lastStatChanges: gameState.lastStatChanges,
    statChangeLog: gameState.statChangeLog,
    memoryFlags: gameState.memoryFlags,
    seenEventIds: gameState.seenEventIds,
    seenNightCareIds: gameState.seenNightCareIds,
  };
  document.getElementById('debug-content').textContent = JSON.stringify(info, null, 2);
}

function render() {
  if (gameState.phase === 'ending') {
    showScreen('ending');
    return;
  }
  showScreen('game');
  renderHUD();
  renderAngelPanel();
  if (gameState.phase === 'opening') {
    renderOpening();
  } else if (gameState.phase === 'free') {
    renderFree();
  }
  renderLog();
  renderDebug();
}

function addLog(text) {
  const tag = `${gameState.day}日目 ${timeSlotLabels[gameState.timeSlot] || gameState.timeSlot}`;
  gameState.log.push(`[${tag}] ${text}`);
}

/* -------------------------------------------------------------------------
   4. セーブ / ロード / リセット
   ------------------------------------------------------------------------- */

function hasSave() {
  return !!localStorage.getItem(STORAGE_KEY);
}

function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    showToast('セーブしました。');
    updateTitleSaveInfo();
  } catch (e) {
    showToast('セーブに失敗しました。');
  }
}

function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    showToast('セーブデータがありません。');
    return false;
  }
  try {
    const loaded = JSON.parse(raw);
    const fresh = createInitialState();
    gameState = Object.assign(fresh, loaded, {
      memoryFlags: Object.assign({}, memoryFlagsDefault, loaded.memoryFlags || {}),
      stats: Object.assign({}, statsDefault, loaded.stats || {}),
      actionCounts: Object.assign({}, actionCountsDefault, loaded.actionCounts || {}),
      lastStatChanges: loaded.lastStatChanges || null,
      statChangeLog: Array.isArray(loaded.statChangeLog) ? loaded.statChangeLog : [],
      seenEventIds: loaded.seenEventIds || [],
      seenNightCareIds: loaded.seenNightCareIds || [],
      nightCareCount: loaded.nightCareCount != null ? loaded.nightCareCount : 0,
      careStyle: loaded.careStyle || 'default',
      playerCallName: loaded.playerCallName != null ? loaded.playerCallName : '',
      pendingNightCareId: loaded.pendingNightCareId || null,
      callNameReactionText: null,
      pendingCallNameNext: null,
      log: loaded.log || [],
    });
    render();
    showToast('ロードしました。');
    return true;
  } catch (e) {
    showToast('セーブデータの読み込みに失敗しました。');
    return false;
  }
}

function updateTitleSaveInfo() {
  const el = document.getElementById('title-save-info');
  if (hasSave()) {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      el.textContent = `セーブデータあり（${s.day}日目 ${timeSlotLabels[s.timeSlot] || ''}）`;
    } catch (e) {
      el.textContent = 'セーブデータあり';
    }
  } else {
    el.textContent = 'セーブデータはありません。';
  }
}

function startNewGame() {
  if (hasSave()) {
    if (!confirm('セーブデータがあります。上書きして、はじめから始めますか？\n（「セーブ」を押すまで、既存のセーブデータは消えません）')) {
      return;
    }
  }
  gameState = createInitialState();
  render();
}

function continueGame() {
  if (!hasSave()) {
    showToast('セーブデータがありません。');
    return;
  }
  loadGame();
}

function resetGame() {
  if (!confirm('本当にリセットしますか？セーブデータも削除されます。')) return;
  localStorage.removeItem(STORAGE_KEY);
  gameState = createInitialState();
  updateTitleSaveInfo();
  showScreen('title');
}

/* トースト通知 */
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* デバッグ表示切替 */
function toggleDebug() {
  debugVisible = !debugVisible;
  document.getElementById('debug-panel').classList.toggle('hidden', !debugVisible);
  document.getElementById('btn-debug-toggle').textContent = 'デバッグ表示 ' + (debugVisible ? 'ON' : 'OFF');
  if (debugVisible) renderDebug();
}

/* -------------------------------------------------------------------------
   5. イベント配線・初期化
   ------------------------------------------------------------------------- */

function wireButtons() {
  document.getElementById('btn-new-game').addEventListener('click', () => {
    startNewGame();
  });
  document.getElementById('btn-continue').addEventListener('click', () => {
    continueGame();
  });
  document.getElementById('btn-title-reset').addEventListener('click', () => {
    resetGame();
  });

  document.getElementById('btn-save').addEventListener('click', saveGame);
  document.getElementById('btn-load').addEventListener('click', () => {
    if (confirm('ロードしますか？現在の進行は失われます。')) loadGame();
  });
  document.getElementById('btn-reset').addEventListener('click', resetGame);
  document.getElementById('btn-debug-toggle').addEventListener('click', toggleDebug);

  document.getElementById('btn-ending-title').addEventListener('click', () => {
    showScreen('title');
    updateTitleSaveInfo();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireButtons();
  updateTitleSaveInfo();
  showScreen('title');
});
