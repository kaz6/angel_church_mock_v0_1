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

const TIME_SLOTS = ['morning', 'noon', 'evening', 'night'];

// モック終了する最終日（この日の夜ケア→就寝後に終了画面）。5, 6, 28… へ延長するときはここだけ変更。
const END_DAY = 7;

// 表示ラベル（編集: scenario-data.js の SCENARIO_DATA.statLabels 等）
const FALLBACK_STAT_LABELS = {
  trust: '信頼',
  prayerTuning: '祈りの調律',
  caretakerAptitude: '世話役適性',
  mentalMargin: '心身の余白',
  mentalMarginMax: '心身の余白（上限）',
  angelFatigue: '天使様の疲労',
};

const FALLBACK_ACTION_LABELS = {
  chores: '家事をする',
  pray: '祈る',
  rest: '休む',
  talk: '話しかける',
  nightCare: '夜ケア',
  observe: '様子を見る',
};

const FALLBACK_TIME_SLOT_LABELS = {
  morning: '朝',
  noon: '昼',
  evening: '夕方',
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

// 自由行動の結果テキスト（編集: scenario-data.js の SCENARIO_DATA.freeActionTexts）
const FALLBACK_FREE_ACTION_TEXT = 'あなたは静かに時間を過ごした。';

const freeActionTexts =
  (window.SCENARIO_DATA && window.SCENARIO_DATA.freeActionTexts) || {};

// 自由行動の時間帯導入文（編集: scenario-data.js の SCENARIO_DATA.slotIntroTexts）
const DEFAULT_SLOT_INTRO_TEXT = '静かな時間が流れている。\n\nさて、何をしよう。';

const FALLBACK_SLOT_INTRO_TEXTS = {
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

const slotIntroTexts = Object.assign(
  {},
  FALLBACK_SLOT_INTRO_TEXTS,
  (window.SCENARIO_DATA && window.SCENARIO_DATA.slotIntroTexts) || {}
);

const FALLBACK_OBSERVE_TEXTS = {
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
};

const observeTexts = Object.assign(
  {},
  FALLBACK_OBSERVE_TEXTS,
  (window.SCENARIO_DATA && window.SCENARIO_DATA.observeTexts) || {}
);

// 状態文・雰囲気文（編集: scenario-data.js の SCENARIO_DATA.statusTexts）
const FALLBACK_STATUS_TEXT = '（状態不明）';

const statusTexts =
  (window.SCENARIO_DATA && window.SCENARIO_DATA.statusTexts) || {};

const statusChangeTexts =
  (window.SCENARIO_DATA && window.SCENARIO_DATA.statusChangeTexts) || {};

// 該当 stat / 方向の文候補が見つからない場合の安全な文
const FALLBACK_STATUS_CHANGE_TEXT = '小さな変化があった。';

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
  confession_day_shared: false,
  confession_day_uncertain: false,
  confession_day_silent: false,
  confession_day_avoided: false,
};

// パラメーター（§パラメータ設計）初期値・範囲
const statsDefault = {
  trust: 0,
  prayerTuning: 0,
  caretakerAptitude: 0,
  mentalMargin: 5,
  mentalMarginMax: 10,
  angelFatigue: 5,
};

const statsRange = {
  trust: [0, 30],
  prayerTuning: [0, 30],
  caretakerAptitude: [0, 30],
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
// 本文・演出: scenario-data.js の openingScenes（id で解決）
// 分岐・setFlags・callback・進行: 下記 sceneDefinitions（同一 id で openingScenes とマージ）
const openingScenes =
  (window.SCENARIO_DATA && window.SCENARIO_DATA.openingScenes) || [];

// 分岐・setFlags・ゲーム進行ロジックを持つオープニングシーン。
// 本文は scenario-data.js の openingScenes に置く。ここに text を残す場合は例外理由をコメントすること。
const sceneDefinitions = [
  {
    id: 'noise_wake',
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
    id: 'angel_confession',
    setFlags: { angel_revealed: true },
    relationChange: 1,
    choices: [{ label: '（……）', next: 'meal_event' }],
  },
  {
    id: 'night_care',
    relationChange: 1,
    setFlags: { first_night_care_done: true },
    logText: '天使様の疲れを労った。',
    // 表示文・演出は nightCareEvents の night_care_d1_opening から取得（enterScene / renderOpening）
    choices: [{ label: '2日目の朝へ', next: 'FREE_START' }],
  },
];

// 全年齢/R-18 差し替え: 表示テキストは AssetResolver（asset-resolver.js）経由で
// text_normal / text_adult / text（レガシー）から現在モードのものを解決する。
// asset-resolver.js が読み込まれていない場合は従来どおり text を使う
function resolveContentText(entry, baseKey) {
  if (window.AssetResolver) {
    return window.AssetResolver.resolveText(entry, baseKey);
  }
  return entry ? entry[baseKey || 'text'] : undefined;
}

function formatOpeningSceneText(text) {
  if (!text) return '';
  if (Array.isArray(text)) return text.join('\n\n');
  if (typeof text === 'string') return text;
  return '';
}

function normalizeOpeningScene(scene) {
  if (!scene) return null;
  return Object.assign({}, scene, {
    text: formatOpeningSceneText(resolveContentText(scene)),
  });
}

function mergeOpeningSceneDataAndLogic(dataScene, appScene) {
  if (!dataScene && !appScene) return null;
  if (!dataScene) return appScene;
  if (!appScene) return normalizeOpeningScene(dataScene);
  const merged = Object.assign({}, dataScene, appScene);
  if (dataScene.text !== undefined) {
    merged.text = dataScene.text;
  }
  return normalizeOpeningScene(merged);
}

function findOpeningScene(sceneId) {
  const fromData = openingScenes.find((s) => s.id === sceneId);
  const fromApp = sceneDefinitions.find((s) => s.id === sceneId);
  if (fromData || fromApp) {
    return mergeOpeningSceneDataAndLogic(fromData, fromApp);
  }
  return null;
}

/* ---------------------- 自由行動イベント ---------------------- */
// id / day / timeSlot / action / priority / condition / setFlags / relationChange
// 表示文・演出は scenario-data.js の freeActionTexts から取得。
// 日付追加時: ここに day 別エントリを足し、scenario-data.js に dN_morning / dN_noon を追加。
// 条件分岐など callback 用の個別テキストだけ、ここに text を残す。
const freeActionEvents = [
  // --- 家事をする ---
  {
    id: 'chores_d2_morning', day: 2, timeSlot: 'morning', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_d2_noon', day: 2, timeSlot: 'noon', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_d3_morning', day: 3, timeSlot: 'morning', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_d3_noon', day: 3, timeSlot: 'noon', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_d4_morning', day: 4, timeSlot: 'morning', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_d4_noon', day: 4, timeSlot: 'noon', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_d5_morning', day: 5, timeSlot: 'morning', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_d5_noon', day: 5, timeSlot: 'noon', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_d6_morning', day: 6, timeSlot: 'morning', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_d6_noon', day: 6, timeSlot: 'noon', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_d7_morning', day: 7, timeSlot: 'morning', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_d7_noon', day: 7, timeSlot: 'noon', action: 'chores', priority: 10,
    setFlags: { helped_church: true }, relationChange: 1,
  },
  {
    id: 'chores_fallback', action: 'chores', priority: 1,
    setFlags: { helped_church: true }, relationChange: 1,
  },

  // --- 祈る ---
  {
    id: 'pray_d2_morning', day: 2, timeSlot: 'morning', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_d2_noon', day: 2, timeSlot: 'noon', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_d3_morning', day: 3, timeSlot: 'morning', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_d3_noon', day: 3, timeSlot: 'noon', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_d4_morning', day: 4, timeSlot: 'morning', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_d4_noon', day: 4, timeSlot: 'noon', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_d5_morning', day: 5, timeSlot: 'morning', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_d5_noon', day: 5, timeSlot: 'noon', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_d6_morning', day: 6, timeSlot: 'morning', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_d6_noon', day: 6, timeSlot: 'noon', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_d7_morning', day: 7, timeSlot: 'morning', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_d7_noon', day: 7, timeSlot: 'noon', action: 'pray', priority: 10,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },
  {
    id: 'pray_fallback', action: 'pray', priority: 1,
    setFlags: { prayed_with_angel: true }, relationChange: 1,
  },

  // --- 休む ---
  {
    id: 'rest_d2_morning', day: 2, timeSlot: 'morning', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_d2_noon', day: 2, timeSlot: 'noon', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_d3_morning', day: 3, timeSlot: 'morning', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_d3_noon', day: 3, timeSlot: 'noon', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_d4_morning', day: 4, timeSlot: 'morning', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_d4_noon', day: 4, timeSlot: 'noon', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_d5_morning', day: 5, timeSlot: 'morning', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_d5_noon', day: 5, timeSlot: 'noon', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_d6_morning', day: 6, timeSlot: 'morning', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_d6_noon', day: 6, timeSlot: 'noon', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_d7_morning', day: 7, timeSlot: 'morning', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_d7_noon', day: 7, timeSlot: 'noon', action: 'rest', priority: 10,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },
  {
    id: 'rest_fallback', action: 'rest', priority: 1,
    setFlags: { rested_in_room: true }, relationChange: 1,
  },

  // --- 話しかける ---
  {
    id: 'talk_d2_morning', day: 2, timeSlot: 'morning', action: 'talk', priority: 10,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    id: 'talk_d2_noon', day: 2, timeSlot: 'noon', action: 'talk', priority: 10,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    // 2日目に話しかけていた場合、天使様が覚えていてくれる分岐（callback）
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
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    id: 'talk_d3_noon', day: 3, timeSlot: 'noon', action: 'talk', priority: 10,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    id: 'talk_d4_morning', day: 4, timeSlot: 'morning', action: 'talk', priority: 10,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    id: 'talk_d4_noon', day: 4, timeSlot: 'noon', action: 'talk', priority: 10,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    id: 'talk_d5_morning', day: 5, timeSlot: 'morning', action: 'talk', priority: 10,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    id: 'talk_d5_noon', day: 5, timeSlot: 'noon', action: 'talk', priority: 10,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    id: 'talk_d6_morning', day: 6, timeSlot: 'morning', action: 'talk', priority: 10,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    id: 'talk_d6_noon', day: 6, timeSlot: 'noon', action: 'talk', priority: 10,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    id: 'talk_d7_morning', day: 7, timeSlot: 'morning', action: 'talk', priority: 10,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    id: 'talk_d7_noon', day: 7, timeSlot: 'noon', action: 'talk', priority: 10,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
  {
    id: 'talk_fallback', action: 'talk', priority: 1,
    setFlags: { talked_with_angel: true }, relationChange: 1,
  },
];

/* ---------------------- 夜の強制イベント（2日目夜 / 3日目夜） ---------------------- */
// 本文・選択肢ラベル・選択後テキスト・表情・状態文・場所は
// scenario-data.js の SCENARIO_DATA.nightEvents（day で一致）から取得する。
// ここ（app.js）に残すのは、日ごとの setFlags / relationChange 等の「処理」のみ。
const forcedNightEvents = {
  2: {
    id: 'pain_event',
    relationChange: 1,
  },
  3: {
    id: 'remembered_event',
    setFlags: { remembered_by_angel: true },
    relationChange: 1,
  },
  7: {
    id: 'confession_day_event',
  },
};

const forcedNightLogLabels = {
  2: '天使様が、あなたの疲れに気づいたようだった。',
  3: '天使様が、前の晩のことを覚えていた。',
  7: '夜、懺悔室で天使様と向き合った。',
};

// 選択肢 id → memoryFlags 処理（id の意味づけは app.js 側で解釈する）
const nightEventChoiceFlags = {
  admit_tired: { pain_tired: true },
  hide_tired: { hide_pain: true },
  confession_shared: { confession_day_shared: true },
  confession_uncertain: { confession_day_uncertain: true },
  confession_silent: { confession_day_silent: true },
  confession_avoided: { confession_day_avoided: true },
};

const nightEventChoiceLogLabels = {
  admit_tired: '「少しだけ」と答えた。',
  hide_tired: '「大丈夫です」と答えた。',
  confession_shared: '懺悔室で、少しだけ話した。',
  confession_uncertain: '言葉にならないまま、懺悔室にいた。',
  confession_silent: '何も言わず、懺悔室に座っていた。',
  confession_avoided: '今日は懺悔室をやめておいた。',
};

// scenario-data.js が読み込まれていない場合の最低限フォールバック
const nightEvents =
  (window.SCENARIO_DATA && window.SCENARIO_DATA.nightEvents) || [];

const NIGHT_EVENT_FALLBACK = {
  id: 'night_event_fallback',
  day: null,
  location: '個室',
  angelExpression: 'normal',
  angelStatus: '静かに戻ってきた',
  text: [
    '夜、天使様が部屋へ戻ってきた。',
    '短い会話を交わしたあと、二人は就寝前の時間へ移った。',
  ],
  choices: [
    {
      id: 'continue',
      label: '続ける',
      resultText: ['静かな時間が流れた。'],
    },
  ],
};

function joinParagraphs(value) {
  if (Array.isArray(value)) return value.join('\n\n');
  if (typeof value === 'string') return value;
  return '';
}

function findNightEvent(day) {
  return nightEvents.find((e) => e.day === day) || null;
}

function getNightEventDisplay(day) {
  return findNightEvent(day) || NIGHT_EVENT_FALLBACK;
}

// day3 のように、同じ夜イベントでも memoryFlags によって続く一文が変わる場合、
// どの variant を使うかは app.js 側（callback の判定）で決める。
function getNightEventText(scenarioEvent) {
  const base = joinParagraphs(resolveContentText(scenarioEvent));
  if (!scenarioEvent.textVariants) return base;
  const variantKey = gameState.memoryFlags.pain_tired
    ? 'pain_tired'
    : gameState.memoryFlags.hide_pain
      ? 'hide_pain'
      : 'default';
  const variantText = joinParagraphs(scenarioEvent.textVariants[variantKey]);
  return variantText ? `${base}\n\n${variantText}` : base;
}

function getNightEventChoices(scenarioEvent) {
  return scenarioEvent.choices && scenarioEvent.choices.length
    ? scenarioEvent.choices
    : NIGHT_EVENT_FALLBACK.choices;
}

/* ---------------------- 毎晩ケア（2日目以降・自由行動の夜） ---------------------- */
// 会話追加: night-care-data.js の window.SCENARIO_DATA.nightCareEvents に
// day / priority / text 等を足す（夜ケア本文の編集はこのファイル）
// id / day / priority / condition / text / location / angelExpression / angelStatus /
// setFlags / relationChange
// night-care-data.js（または scenario-data.js）が読み込まれていない場合の
// 最低限フォールバック（該当なし扱い）
const OPENING_NIGHT_CARE_ID = 'night_care_d1_opening';

const FALLBACK_OPENING_NIGHT_CARE_TEXT =
  '食事を終え、二人は個室に戻った。\n' +
  '天使様は、二つ並んだベッドのうちひとつに、静かに腰を下ろす。\n\n' +
  '「明日もあるのですから、そろそろ休みましょう」\n\n' +
  '「――その前に、少しだけ疲れを取りましょう」\n' +
  'あなたはそう言って、天使様の肩や手にそっと触れ、凝りをほぐすように優しく揉みほぐした。\n\n' +
  '天使様は目を細め、されるがままになっていた。\n' +
  'やがて満足したように小さく息を吐くと、そのまま静かに眠りに落ちていった。\n\n' +
  '――その日から、二人の生活が始まったのでした。';

const nightCareEvents =
  (window.SCENARIO_DATA && window.SCENARIO_DATA.nightCareEvents) || [];

function findNightCareEventById(id) {
  return nightCareEvents.find((e) => e.id === id) || null;
}

function getOpeningNightCareEvent() {
  return findNightCareEventById(OPENING_NIGHT_CARE_ID);
}

function getOpeningNightCareText() {
  const entry = getOpeningNightCareEvent();
  const text = resolveContentText(entry);
  return text ? joinParagraphs(text) : FALLBACK_OPENING_NIGHT_CARE_TEXT;
}

function applyOpeningNightCareDisplay(entry) {
  if (!entry) return;
  if (entry.location) gameState.currentLocation = entry.location;
  if (entry.angelExpression) gameState.angelExpression = entry.angelExpression;
  if (entry.angelStatus) gameState.angelStatus = entry.angelStatus;
}

/* -------------------------------------------------------------------------
   2. gameState と状態遷移ロジック
   ------------------------------------------------------------------------- */

function createInitialState() {
  return {
    day: 1,
    timeSlot: 'noon',
    phase: 'opening', // 'title' | 'opening' | 'free' | 'ending'
    currentSceneId: 'arrival',
    freeStep: null, // 'select' | 'result' | 'observe' | 'forced' | 'forced_after' | 'night_care'
    pendingAction: null,
    pendingEntryId: null,
    pendingForcedChoiceId: null,
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
    lastStatusChangeComment: '',
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
  const scene = findOpeningScene(sceneId);
  if (!scene) return;
  gameState.currentSceneId = sceneId;
  if (sceneId === 'night_care') {
    applyOpeningNightCareDisplay(getOpeningNightCareEvent());
  } else {
    if (scene.location) gameState.currentLocation = scene.location;
    if (scene.angelExpression) gameState.angelExpression = scene.angelExpression;
    if (scene.angelStatus) gameState.angelStatus = scene.angelStatus;
  }
  if (scene.timeSlot) gameState.timeSlot = scene.timeSlot;
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

  const scene = findOpeningScene(gameState.currentSceneId);
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
  if (slotIntroTexts[key]) return slotIntroTexts[key];
  // 夕方は day 別が無ければ共通の evening-default を挟む（day7 のみ専用文を用意）
  if (gameState.timeSlot === 'evening' && slotIntroTexts['evening-default']) {
    return slotIntroTexts['evening-default'];
  }
  return DEFAULT_SLOT_INTRO_TEXT;
}

function pickObserveText(entry) {
  if (Array.isArray(entry)) {
    return entry[Math.floor(Math.random() * entry.length)];
  }
  if (typeof entry === 'string') return entry;
  return pickObserveText(FALLBACK_OBSERVE_TEXTS.default);
}

function getObserveText() {
  const key = freeActionTextVariantKey(gameState.day, gameState.timeSlot);
  const specific = key && observeTexts[key];
  if (specific) return pickObserveText(specific);
  // 夕方は day 別が無ければ共通の eveningDefault を挟む（day7 のみ専用文を用意）
  if (gameState.timeSlot === 'evening' && observeTexts.eveningDefault) {
    return pickObserveText(observeTexts.eveningDefault);
  }
  return pickObserveText(observeTexts.default || FALLBACK_OBSERVE_TEXTS.default);
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

function formatFreeActionTextBlock(block) {
  const text = resolveContentText(block);
  if (text === undefined) return FALLBACK_FREE_ACTION_TEXT;
  if (Array.isArray(text)) return text.join('\n\n');
  if (typeof text === 'string') return text;
  return FALLBACK_FREE_ACTION_TEXT;
}

function freeActionTextVariantKey(day, timeSlot) {
  if (day == null || !timeSlot) return null;
  return `d${day}_${timeSlot}`;
}

function resolveFreeActionTextBlock(action, day, timeSlot) {
  const actionTexts = freeActionTexts[action];
  if (!actionTexts) return null;
  const variantKey = freeActionTextVariantKey(day, timeSlot);
  if (variantKey && actionTexts[variantKey]) {
    return actionTexts[variantKey];
  }
  // 夕方は day 別が無ければ共通の eveningDefault を挟む（day7 のみ専用文を用意）
  if (timeSlot === 'evening' && actionTexts.eveningDefault) {
    return actionTexts.eveningDefault;
  }
  return actionTexts.default || null;
}

function getFreeActionDisplay(entry) {
  if (!entry) {
    return { text: FALLBACK_FREE_ACTION_TEXT };
  }
  const entryText = resolveContentText(entry);
  if (entryText) {
    return {
      text: entryText,
      location: entry.location,
      angelExpression: entry.angelExpression,
      angelStatus: entry.angelStatus,
    };
  }
  const day = entry.day != null ? entry.day : gameState.day;
  const timeSlot = entry.timeSlot || gameState.timeSlot;
  const block = resolveFreeActionTextBlock(entry.action, day, timeSlot);
  if (!block) {
    return { text: FALLBACK_FREE_ACTION_TEXT };
  }
  return {
    text: formatFreeActionTextBlock(block),
    location: block.location,
    angelExpression: block.angelExpression,
    angelStatus: block.angelStatus,
  };
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
  const marginMax =
    typeof gameState.stats.mentalMarginMax === 'number' &&
    Number.isFinite(gameState.stats.mentalMarginMax)
      ? gameState.stats.mentalMarginMax
      : statsDefault.mentalMarginMax;
  gameState.stats.mentalMargin = Math.min(
    marginMax,
    Math.max(0, gameState.stats.mentalMargin)
  );
}

function normalizeLoadedStats(loadedStats) {
  const merged = Object.assign({}, statsDefault, loadedStats || {});
  if (
    typeof merged.mentalMarginMax !== 'number' ||
    !Number.isFinite(merged.mentalMarginMax)
  ) {
    merged.mentalMarginMax = statsDefault.mentalMarginMax;
  }
  return merged;
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

function getStatusText(statKey, value) {
  const tiers = statusTexts[statKey];
  if (!tiers || tiers.length === 0) {
    return FALLBACK_STATUS_TEXT;
  }
  for (let i = 0; i < tiers.length; i++) {
    if (value <= tiers[i].max) {
      return tiers[i].text;
    }
  }
  return tiers[tiers.length - 1].text;
}

function formatStatusTextsForDebug(stats) {
  return {
    trust: getStatusText('trust', stats.trust),
    prayerTuning: getStatusText('prayerTuning', stats.prayerTuning),
    caretakerAptitude: getStatusText('caretakerAptitude', stats.caretakerAptitude),
    mentalMargin: getStatusText('mentalMargin', stats.mentalMargin),
    angelFatigue: getStatusText('angelFatigue', stats.angelFatigue),
  };
}

const PRAYER_RELATED_LOCATION_PATTERN = /祈り/;

function isPrayerRelatedContext() {
  if (gameState.phase !== 'free') return false;
  if (gameState.timeSlot === 'evening') return true;
  if (gameState.pendingAction === 'pray') return true;
  const loc = gameState.currentLocation || '';
  return PRAYER_RELATED_LOCATION_PATTERN.test(loc);
}

function shouldShowPrayerTuningStatus() {
  if (debugVisible) return true;
  return isPrayerRelatedContext();
}

function getVisibleStatusTexts() {
  const stats = gameState.stats;
  const lines = [
    getStatusText('trust', stats.trust),
    getStatusText('caretakerAptitude', stats.caretakerAptitude),
    getStatusText('mentalMargin', stats.mentalMargin),
    getStatusText('angelFatigue', stats.angelFatigue),
  ];
  if (shouldShowPrayerTuningStatus()) {
    lines.push(getStatusText('prayerTuning', stats.prayerTuning));
  }
  return lines;
}

// 実際に変化した stats（key: 差分）の中からランダムに1つ選び、
// その stat・方向（up/down）に対応する文をランダムに1つ返す。
// render 時ではなく、stats 変化のタイミング（applyStatChanges）で1回だけ呼ぶこと。
function pickStatusChangeComment(changes) {
  const changedKeys = Object.keys(changes).filter((key) => changes[key]);
  if (changedKeys.length === 0) return '';

  const key = changedKeys[Math.floor(Math.random() * changedKeys.length)];
  const dir = changes[key] > 0 ? 'up' : 'down';
  const pool = (statusChangeTexts[key] || {})[dir];
  if (Array.isArray(pool) && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return FALLBACK_STATUS_CHANGE_TEXT;
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
  gameState.lastStatusChangeComment = pickStatusChangeComment(actualChanges);

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

// 夕方は天使様が屋根裏部屋で祈りの務め中のため、直接のケア（angelFatigue）は発生しない。
// 家事は一人で行うぶん caretakerAptitude の伸びを控えめに、祈るは務めに寄り添うぶん
// prayerTuning を通常より高めにする。休むは通常の rest と同じでよいため専用関数を作らない。
function applyEveningChoresStats() {
  applyStatChanges(
    actionLabels.chores,
    { caretakerAptitude: 1, mentalMargin: -1 },
    { actionCountKey: 'chores' }
  );
}

function applyEveningPrayStats() {
  const changes = { prayerTuning: 3, mentalMargin: -1 };
  if (gameState.stats.angelFatigue <= 3) {
    changes.prayerTuning += 1;
  }
  applyStatChanges(actionLabels.pray, changes, { actionCountKey: 'pray' });
}

function applySleepRecoveryStats() {
  applyStatChanges('就寝', { mentalMargin: 2 });
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

// 夕方は chores / pray のみ効果が異なる。rest は通常と同じ数値でよいため未登録（actionStatEffects にフォールバック）。
const eveningActionStatEffects = {
  chores: applyEveningChoresStats,
  pray: applyEveningPrayStats,
};

function getActionStatEffect(actionId) {
  if (gameState.timeSlot === 'evening' && eveningActionStatEffects[actionId]) {
    return eveningActionStatEffects[actionId];
  }
  return actionStatEffects[actionId];
}

const eveningActionLogLabels = {
  chores: '晩御飯の支度をした。',
  pray: '祈りの務めに、そっと寄り添った。',
  rest: '天使様がいない間、ゆっくり休んだ。',
};

function onActionButtonClick(actionId) {
  // 夕方は天使様が祈りの務め中のため、話しかけるは選択不可（ボタン自体を出さないが念のため）
  if (actionId === 'talk' && gameState.timeSlot === 'evening') return;

  gameState.pendingAction = actionId;
  gameState.freeStep = 'result';

  // 選ばれたイベントは setFlags 適用前に確定させ、その id を保存しておく。
  // （renderFree 側で毎回 findFreeActionEvent を呼び直すと、setFlags で
  //   条件が変化した直後に別のイベントへすり替わってしまうため）
  const entry = findFreeActionEvent(gameState.day, gameState.timeSlot, actionId);
  gameState.pendingEntryId = entry ? entry.id : null;
  if (entry) {
    const display = getFreeActionDisplay(entry);
    if (entry.setFlags) Object.assign(gameState.memoryFlags, entry.setFlags);
    if (entry.relationChange) gameState.relationStage += entry.relationChange;
    if (display.angelExpression) gameState.angelExpression = display.angelExpression;
    if (display.angelStatus) gameState.angelStatus = display.angelStatus;
    if (display.location) gameState.currentLocation = display.location;
    const key = `free_${gameState.day}_${gameState.timeSlot}_${actionId}`;
    if (!gameState.seenEventIds.includes(key)) gameState.seenEventIds.push(key);
  }
  const effectFn = getActionStatEffect(actionId);
  if (effectFn) effectFn();
  const logLabel =
    (gameState.timeSlot === 'evening' && eveningActionLogLabels[actionId]) ||
    actionLogLabels[actionId] ||
    '行動した。';
  addLog(logLabel);
  render();
}

function onObserveClick() {
  gameState.freeStep = 'observe';
  gameState.observeMessage = getObserveText();
  render();
}

function onObserveBackClick() {
  gameState.freeStep = 'select';
  gameState.observeMessage = '';
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
  gameState.lastStatusChangeComment = '';

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
  const scenarioEvent = getNightEventDisplay(gameState.day);
  gameState.freeStep = 'forced';
  gameState.pendingForcedChoiceId = null;
  gameState.currentLocation = scenarioEvent.location || '個室';
  if (scenarioEvent.angelExpression) gameState.angelExpression = scenarioEvent.angelExpression;
  if (scenarioEvent.angelStatus) gameState.angelStatus = scenarioEvent.angelStatus;
  if (fe.setFlags) Object.assign(gameState.memoryFlags, fe.setFlags);
  if (fe.relationChange) gameState.relationStage += fe.relationChange;

  const key = `forced_night_${gameState.day}`;
  if (!gameState.seenEventIds.includes(key)) gameState.seenEventIds.push(key);
  addLog(forcedNightLogLabels[gameState.day] || '夜の出来事があった。');
  render();
}

// 選択肢の id は app.js 側で解釈する（memoryFlags 処理・ログ・進行判定）。
// resultText を持たない選択肢（例: 3日目「（……）」）は、結果表示を挟まず夜ケアへ進む。
function onForcedChoiceClick(choice) {
  if (nightEventChoiceFlags[choice.id]) {
    Object.assign(gameState.memoryFlags, nightEventChoiceFlags[choice.id]);
  }
  if (nightEventChoiceLogLabels[choice.id]) addLog(nightEventChoiceLogLabels[choice.id]);

  if (choice.resultText) {
    gameState.pendingForcedChoiceId = choice.id;
    gameState.freeStep = 'forced_after';
    render();
  } else {
    enterNightCare();
  }
}

function onForcedAfterContinue() {
  gameState.pendingForcedChoiceId = null;
  enterNightCare();
}

function findNightCareEvent(day) {
  const candidates = nightCareEvents.filter(
    (e) =>
      e.countsAsRoutine !== false &&
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
  applySleepRecoveryStats();

  if (gameState.day >= END_DAY) {
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

/* ---- デバッグ用: OPスキップ（デバッグ表示ON時のみ使用可） ---- */
// 1日目オープニングを完了済み扱いにし、2日目朝の自由行動へ直接進める。
// stats / actionCounts / nightCareCount は createInitialState() の初期値のまま。
function debugSkipToDay2Morning() {
  const preservedCallName = gameState.playerCallName;
  gameState = createInitialState();
  gameState.day = 2;
  gameState.timeSlot = 'morning';
  gameState.phase = 'free';
  gameState.freeStep = 'select';
  gameState.playerCallName = preservedCallName || DEFAULT_CALL_NAME;
  gameState.memoryFlags.angel_revealed = true;
  gameState.memoryFlags.first_night_care_done = true;
  gameState.relationStage = 3; // 通常の1日目オープニング完了相当（angel_confession/meal_event/night_careの+1ずつ）
  gameState.currentLocation = '個室';
  gameState.angelExpression = 'soft';
  gameState.angelStatus = '朝の支度をしている';
  addLog('（デバッグ）2日目の朝へスキップした。');
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

// 夕方は天使様が祈りの務め中のため「話しかける」を出さない
function getAvailableActionDefinitions() {
  if (gameState.timeSlot === 'evening') {
    return actionDefinitions.filter((a) => a.id !== 'talk');
  }
  return actionDefinitions;
}

function renderActionButtons() {
  const container = document.getElementById('action-buttons');
  container.innerHTML = '';
  getAvailableActionDefinitions().forEach((a) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action-btn';
    btn.textContent = a.label;
    btn.addEventListener('click', () => onActionButtonClick(a.id));
    container.appendChild(btn);
  });
  const observeBtn = document.createElement('button');
  observeBtn.type = 'button';
  observeBtn.className = 'action-btn';
  observeBtn.textContent = actionLabels.observe || '様子を見る';
  observeBtn.addEventListener('click', onObserveClick);
  container.appendChild(observeBtn);
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

function renderStatusTexts() {
  const panel = document.getElementById('status-text-panel');
  const list = document.getElementById('status-text-list');
  const changeList = document.getElementById('status-change-list');
  if (!panel || !list) return;

  if (gameState.phase !== 'free') {
    panel.classList.add('hidden');
    list.innerHTML = '';
    if (changeList) changeList.innerHTML = '';
    return;
  }

  panel.classList.remove('hidden');
  list.innerHTML = '';
  getVisibleStatusTexts().forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });

  if (!changeList) return;
  changeList.innerHTML = '';
  // 「今回の変化」は常に1文だけ表示する（抽選は applyStatChanges 側で1回だけ行う）
  const showComment =
    (gameState.freeStep === 'result' ||
      gameState.freeStep === 'night_care' ||
      gameState.freeStep === 'select') &&
    !!gameState.lastStatusChangeComment;
  if (!showComment) return;

  const li = document.createElement('li');
  li.textContent = gameState.lastStatusChangeComment;
  changeList.appendChild(li);
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
  const scene = findOpeningScene(gameState.currentSceneId);
  if (!scene) return;
  if (scene.id === 'night_care') {
    setMessage(getOpeningNightCareText());
  } else {
    setMessage(scene.text);
  }
  if (scene.inputCallName || scene.type === 'callNameInput') {
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
  } else if (gameState.freeStep === 'observe') {
    hideActionBox();
    clearChoiceBox();
    setMessage(gameState.observeMessage || getObserveText());
    renderChoiceButtons([{ label: '戻る', onClick: onObserveBackClick }]);
  } else if (gameState.freeStep === 'result') {
    hideActionBox();
    // 選択時に確定させた entry を id で引き直す（flags 変化後の再判定によるすり替わりを防ぐ）
    const entry = gameState.pendingEntryId
      ? freeActionEvents.find((e) => e.id === gameState.pendingEntryId)
      : null;
    setMessage(getFreeActionDisplay(entry).text);
    renderChoiceButtons([{ label: '続ける', onClick: onResultContinueClick }]);
  } else if (gameState.freeStep === 'forced') {
    hideActionBox();
    const scenarioEvent = getNightEventDisplay(gameState.day);
    setMessage(getNightEventText(scenarioEvent));
    const choices = getNightEventChoices(scenarioEvent);
    renderChoiceButtons(choices.map((c) => ({ label: c.label, onClick: () => onForcedChoiceClick(c) })));
  } else if (gameState.freeStep === 'forced_after') {
    hideActionBox();
    const scenarioEvent = getNightEventDisplay(gameState.day);
    const choices = getNightEventChoices(scenarioEvent);
    const choice = choices.find((c) => c.id === gameState.pendingForcedChoiceId);
    setMessage(choice ? joinParagraphs(resolveContentText(choice, 'resultText')) : '');
    renderChoiceButtons([{ label: '続ける', onClick: onForcedAfterContinue }]);
  } else if (gameState.freeStep === 'night_care') {
    hideActionBox();
    const entry = gameState.pendingNightCareId
      ? nightCareEvents.find((e) => e.id === gameState.pendingNightCareId)
      : null;
    setMessage(
      entry
        ? joinParagraphs(resolveContentText(entry))
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
    contentMode: window.AssetResolver ? window.AssetResolver.getMode() : 'all_ages',
    // CG解決層の確認用: 現在モードで night_care_d3 のCG参照IDがどう解決されるか。
    // モード切替（all_ages ⇄ r18）で _normal / _adult が切り替わることを確認できる
    resolvedCgSample: window.AssetResolver
      ? window.AssetResolver.resolveCgId('night_care_d3')
      : null,
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
    statusTexts: formatStatusTextsForDebug(gameState.stats),
    actionCounts: formatActionCountsForDebug(gameState.actionCounts),
    lastStatChanges: gameState.lastStatChanges,
    lastStatusChangeComment: gameState.lastStatusChangeComment,
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
  renderStatusTexts();
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
      stats: normalizeLoadedStats(loaded.stats),
      actionCounts: Object.assign({}, actionCountsDefault, loaded.actionCounts || {}),
      lastStatChanges: loaded.lastStatChanges || null,
      lastStatusChangeComment:
        typeof loaded.lastStatusChangeComment === 'string' ? loaded.lastStatusChangeComment : '',
      statChangeLog: Array.isArray(loaded.statChangeLog) ? loaded.statChangeLog : [],
      seenEventIds: loaded.seenEventIds || [],
      seenNightCareIds: loaded.seenNightCareIds || [],
      nightCareCount: loaded.nightCareCount != null ? loaded.nightCareCount : 0,
      careStyle: loaded.careStyle || 'default',
      playerCallName: loaded.playerCallName != null ? loaded.playerCallName : '',
      pendingNightCareId: loaded.pendingNightCareId || null,
      pendingForcedChoiceId: loaded.pendingForcedChoiceId || null,
      callNameReactionText: null,
      pendingCallNameNext: null,
      log: loaded.log || [],
    });
    clampStats();
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
function getScenarioDataSafe() {
  return window.SCENARIO_DATA && typeof window.SCENARIO_DATA === 'object'
    ? window.SCENARIO_DATA
    : {};
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatScenarioPreviewText(text) {
  if (text === undefined || text === null || text === '') return '（なし）';
  if (Array.isArray(text)) return text.join('\n');
  return String(text);
}

function appendScenarioField(lines, label, value) {
  if (value === undefined || value === null || value === '') return;
  lines.push(`${label}: ${value}`);
}

function appendScenarioChoices(lines, choices) {
  if (!Array.isArray(choices) || choices.length === 0) return;
  lines.push('');
  lines.push('選択肢：');
  choices.forEach((choice) => {
    let line = `- ${choice.label || '(labelなし)'}`;
    if (choice.next) line += ` → ${choice.next}`;
    if (choice.id) line += ` [id: ${choice.id}]`;
    lines.push(line);
    if (choice.setFlags) lines.push(`  setFlags: ${JSON.stringify(choice.setFlags)}`);
    if (choice.logText) lines.push(`  logText: ${choice.logText}`);
    if (choice.resultText !== undefined) {
      lines.push('  resultText:');
      formatScenarioPreviewText(choice.resultText)
        .split('\n')
        .forEach((row) => lines.push(`    ${row}`));
    }
  });
}

function buildOpeningSceneDetail(scene) {
  const lines = [`## openingScenes / ${scene.id || '(idなし)'}`, ''];
  appendScenarioField(lines, 'id', scene.id);
  appendScenarioField(lines, 'type', scene.type || (scene.inputCallName ? 'callNameInput' : 'scene'));
  appendScenarioField(lines, 'timeSlot', scene.timeSlot);
  appendScenarioField(lines, 'location', scene.location);
  appendScenarioField(lines, 'angelExpression', scene.angelExpression);
  appendScenarioField(lines, 'angelStatus', scene.angelStatus);
  appendScenarioField(lines, 'logText', scene.logText);
  appendScenarioField(lines, 'next', scene.next);
  if (scene.setFlags) lines.push(`setFlags: ${JSON.stringify(scene.setFlags)}`);
  if (scene.relationChange) lines.push(`relationChange: ${scene.relationChange}`);
  lines.push('');
  lines.push('本文：');
  lines.push(formatScenarioPreviewText(resolveContentText(scene)));
  appendScenarioChoices(lines, scene.choices);
  return lines.join('\n');
}

function buildFreeActionDetail(actionKey) {
  const data = getScenarioDataSafe();
  const action = (data.freeActionTexts || {})[actionKey];
  const lines = [`## freeActionTexts / ${actionKey}`, ''];
  if (!action) {
    lines.push('（データなし）');
    return lines.join('\n');
  }
  Object.keys(action).forEach((variantKey) => {
    const block = action[variantKey];
    lines.push(`[${variantKey}]`);
    appendScenarioField(lines, 'location', block.location);
    appendScenarioField(lines, 'angelExpression', block.angelExpression);
    appendScenarioField(lines, 'angelStatus', block.angelStatus);
    lines.push('');
    lines.push('本文：');
    lines.push(formatScenarioPreviewText(resolveContentText(block)));
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

function buildNightEventDetail(eventId) {
  const data = getScenarioDataSafe();
  const event = (data.nightEvents || []).find((entry) => entry.id === eventId);
  const lines = [`## nightEvents / ${eventId}`, ''];
  if (!event) {
    lines.push('（データなし）');
    return lines.join('\n');
  }
  appendScenarioField(lines, 'id', event.id);
  appendScenarioField(lines, 'day', event.day);
  appendScenarioField(lines, 'location', event.location);
  appendScenarioField(lines, 'angelExpression', event.angelExpression);
  appendScenarioField(lines, 'angelStatus', event.angelStatus);
  lines.push('');
  lines.push('本文：');
  lines.push(formatScenarioPreviewText(resolveContentText(event)));
  if (event.textVariants && typeof event.textVariants === 'object') {
    lines.push('');
    lines.push('textVariants:');
    Object.keys(event.textVariants).forEach((key) => {
      lines.push(`  [${key}]`);
      formatScenarioPreviewText(event.textVariants[key])
        .split('\n')
        .forEach((row) => lines.push(`    ${row}`));
    });
  }
  appendScenarioChoices(lines, event.choices);
  return lines.join('\n');
}

function buildNightCareDetail(eventId) {
  const data = getScenarioDataSafe();
  const event = (data.nightCareEvents || []).find((entry) => entry.id === eventId);
  const lines = [`## nightCareEvents / ${eventId}`, ''];
  if (!event) {
    lines.push('（データなし）');
    return lines.join('\n');
  }
  appendScenarioField(lines, 'id', event.id);
  appendScenarioField(lines, 'day', event.day);
  appendScenarioField(lines, 'phase', event.phase);
  appendScenarioField(lines, 'priority', event.priority);
  appendScenarioField(lines, 'location', event.location);
  appendScenarioField(lines, 'angelExpression', event.angelExpression);
  appendScenarioField(lines, 'angelStatus', event.angelStatus);
  if (event.relationChange !== undefined) lines.push(`relationChange: ${event.relationChange}`);
  if (event.setFlags) lines.push(`setFlags: ${JSON.stringify(event.setFlags)}`);
  lines.push('');
  const mode = window.AssetResolver ? window.AssetResolver.getMode() : 'all_ages';
  lines.push(`本文（現在モード: ${mode}）：`);
  lines.push(formatScenarioPreviewText(resolveContentText(event)));
  if (event.text_adult !== undefined) {
    lines.push('');
    lines.push('text_adult（R-18差分・生データ）：');
    lines.push(formatScenarioPreviewText(event.text_adult));
  }
  return lines.join('\n');
}

function buildEndingDetail(endingKey) {
  const data = getScenarioDataSafe();
  const entry = (data.endingTexts || {})[endingKey];
  const lines = [`## endingTexts / ${endingKey}`, ''];
  if (!entry) {
    lines.push('（データなし）');
    return lines.join('\n');
  }
  appendScenarioField(lines, 'id', entry.id);
  appendScenarioField(lines, 'title', entry.title);
  appendScenarioField(lines, 'conditionLabel', entry.conditionLabel);
  appendScenarioField(lines, 'choiceLabel', entry.choiceLabel);
  lines.push('');
  lines.push('本文：');
  lines.push(formatScenarioPreviewText(entry.text));
  return lines.join('\n');
}

function buildCallNameReactionDetail(index) {
  const data = getScenarioDataSafe();
  const reaction = (data.callNameReactions || [])[index];
  const lines = [`## callNameReactions / ${index + 1}`, ''];
  if (!reaction) {
    lines.push('（データなし）');
    return lines.join('\n');
  }
  appendScenarioField(lines, 'type', reaction.type);
  appendScenarioField(lines, 'word', reaction.word);
  lines.push('');
  lines.push('本文：');
  lines.push(formatScenarioPreviewText(reaction.text));
  return lines.join('\n');
}

function buildStatusTextsDetail(statKey) {
  const data = getScenarioDataSafe();
  const tiers = (data.statusTexts || {})[statKey];
  const lines = [`## statusTexts / ${statKey}`, ''];
  if (!Array.isArray(tiers) || tiers.length === 0) {
    lines.push('（データなし）');
    return lines.join('\n');
  }
  tiers.forEach((tier) => {
    lines.push(`- max ${tier.max}: ${tier.text}`);
  });
  return lines.join('\n');
}

function buildStatusChangeTextsDetail(statKey) {
  const data = getScenarioDataSafe();
  const dirs = (data.statusChangeTexts || {})[statKey];
  const lines = [`## statusChangeTexts / ${statKey}`, ''];
  if (!dirs || typeof dirs !== 'object') {
    lines.push('（データなし）');
    return lines.join('\n');
  }
  ['up', 'down'].forEach((dir) => {
    if (!Array.isArray(dirs[dir]) || dirs[dir].length === 0) return;
    lines.push(`[${dir}]`);
    dirs[dir].forEach((text) => lines.push(`- ${text}`));
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

function showScenarioDetail(category, id) {
  if (!debugVisible) return;
  let text = '';
  switch (category) {
    case 'openingScenes': {
      const scene = (getScenarioDataSafe().openingScenes || []).find((entry) => entry.id === id);
      text = scene ? buildOpeningSceneDetail(scene) : `## openingScenes / ${id}\n\n（データなし）`;
      break;
    }
    case 'freeActionTexts':
      text = buildFreeActionDetail(id);
      break;
    case 'nightEvents':
      text = buildNightEventDetail(id);
      break;
    case 'nightCareEvents':
      text = buildNightCareDetail(id);
      break;
    case 'endingTexts':
      text = buildEndingDetail(id);
      break;
    case 'callNameReactions':
      text = buildCallNameReactionDetail(Number(id));
      break;
    case 'statusTexts':
      text = buildStatusTextsDetail(id);
      break;
    case 'statusChangeTexts':
      text = buildStatusChangeTextsDetail(id);
      break;
    default:
      text = `（未対応カテゴリ: ${category}）`;
  }
  const panel = document.getElementById('scenario-detail-panel');
  const content = document.getElementById('scenario-detail-content');
  if (!panel || !content) return;
  content.textContent = text;
  panel.classList.remove('hidden');
}

function renderScenarioListItem(category, id, label) {
  return (
    `<li><button type="button" class="scenario-list-item" ` +
    `data-scenario-category="${escapeHtml(category)}" data-scenario-id="${escapeHtml(id)}">` +
    `${escapeHtml(label)}</button></li>`
  );
}

function renderScenarioList() {
  const content = document.getElementById('scenario-list-content');
  if (!content) return;

  const data = getScenarioDataSafe();
  const parts = ['<p class="scenario-list-title">シナリオ一覧</p>'];

  const opening = Array.isArray(data.openingScenes) ? data.openingScenes : [];
  parts.push(`<div class="scenario-list-section"><p class="scenario-list-section-title">openingScenes：${opening.length}件</p><ul class="scenario-list-items">`);
  opening.forEach((scene) => {
    parts.push(renderScenarioListItem('openingScenes', scene.id || '', scene.id || '(idなし)'));
  });
  parts.push('</ul></div>');

  const freeActionTexts =
    data.freeActionTexts && typeof data.freeActionTexts === 'object'
      ? data.freeActionTexts
      : {};
  const freeKeys = Object.keys(freeActionTexts);
  parts.push(`<div class="scenario-list-section"><p class="scenario-list-section-title">freeActionTexts：${freeKeys.length}アクション</p><ul class="scenario-list-items">`);
  freeKeys.forEach((key) => parts.push(renderScenarioListItem('freeActionTexts', key, key)));
  parts.push('</ul></div>');

  const nightEvents = Array.isArray(data.nightEvents) ? data.nightEvents : [];
  parts.push(`<div class="scenario-list-section"><p class="scenario-list-section-title">nightEvents：${nightEvents.length}件</p><ul class="scenario-list-items">`);
  nightEvents.forEach((event) => {
    parts.push(renderScenarioListItem('nightEvents', event.id || '', event.id || '(idなし)'));
  });
  parts.push('</ul></div>');

  const nightCareEvents = Array.isArray(data.nightCareEvents) ? data.nightCareEvents : [];
  parts.push(`<div class="scenario-list-section"><p class="scenario-list-section-title">nightCareEvents：${nightCareEvents.length}件</p><ul class="scenario-list-items">`);
  nightCareEvents.forEach((event) => {
    parts.push(renderScenarioListItem('nightCareEvents', event.id || '', event.id || '(idなし)'));
  });
  parts.push('</ul></div>');

  const endingTexts =
    data.endingTexts && typeof data.endingTexts === 'object' ? data.endingTexts : {};
  const endingKeys = Object.keys(endingTexts);
  parts.push(`<div class="scenario-list-section"><p class="scenario-list-section-title">endingTexts：${endingKeys.length}件</p><ul class="scenario-list-items">`);
  endingKeys.forEach((key) => {
    const entry = endingTexts[key];
    const label = entry && entry.id ? entry.id : key;
    parts.push(renderScenarioListItem('endingTexts', key, label));
  });
  parts.push('</ul></div>');

  const callNameReactions = Array.isArray(data.callNameReactions)
    ? data.callNameReactions
    : [];
  parts.push(`<div class="scenario-list-section"><p class="scenario-list-section-title">callNameReactions：${callNameReactions.length}件</p><ul class="scenario-list-items">`);
  callNameReactions.forEach((reaction, index) => {
    const label =
      reaction && reaction.word
        ? `${reaction.type || 'type'}:${reaction.word}`
        : `reaction_${index + 1}`;
    parts.push(renderScenarioListItem('callNameReactions', String(index), label));
  });
  parts.push('</ul></div>');

  const statusTexts =
    data.statusTexts && typeof data.statusTexts === 'object' ? data.statusTexts : {};
  const statusKeys = Object.keys(statusTexts);
  parts.push(`<div class="scenario-list-section"><p class="scenario-list-section-title">statusTexts：${statusKeys.length}パラメータ</p><ul class="scenario-list-items">`);
  statusKeys.forEach((key) => parts.push(renderScenarioListItem('statusTexts', key, key)));
  parts.push('</ul></div>');

  const statusChangeTexts =
    data.statusChangeTexts && typeof data.statusChangeTexts === 'object'
      ? data.statusChangeTexts
      : {};
  const statusChangeKeys = Object.keys(statusChangeTexts);
  parts.push(`<div class="scenario-list-section"><p class="scenario-list-section-title">statusChangeTexts：${statusChangeKeys.length}パラメータ</p><ul class="scenario-list-items">`);
  statusChangeKeys.forEach((key) => parts.push(renderScenarioListItem('statusChangeTexts', key, key)));
  parts.push('</ul></div>');

  const statLabels =
    data.statLabels && typeof data.statLabels === 'object' ? data.statLabels : {};
  const statLabelKeys = Object.keys(statLabels);
  parts.push(`<div class="scenario-list-section"><p class="scenario-list-section-title">statLabels：${statLabelKeys.length}件</p><ul class="scenario-list-items">`);
  statLabelKeys.forEach((key) => parts.push(`<li>${escapeHtml(key)}</li>`));
  parts.push('</ul></div>');

  const actionLabels =
    data.actionLabels && typeof data.actionLabels === 'object' ? data.actionLabels : {};
  const actionLabelKeys = Object.keys(actionLabels);
  parts.push(`<div class="scenario-list-section"><p class="scenario-list-section-title">actionLabels：${actionLabelKeys.length}件</p><ul class="scenario-list-items">`);
  actionLabelKeys.forEach((key) => parts.push(`<li>${escapeHtml(key)}</li>`));
  parts.push('</ul></div>');

  const timeSlotLabels =
    data.timeSlotLabels && typeof data.timeSlotLabels === 'object'
      ? data.timeSlotLabels
      : {};
  const timeSlotLabelKeys = Object.keys(timeSlotLabels);
  parts.push(`<div class="scenario-list-section"><p class="scenario-list-section-title">timeSlotLabels：${timeSlotLabelKeys.length}件</p><ul class="scenario-list-items">`);
  timeSlotLabelKeys.forEach((key) => parts.push(`<li>${escapeHtml(key)}</li>`));
  parts.push('</ul></div>');

  content.innerHTML = parts.join('');
}

function setScenarioDetailVisible(visible) {
  const panel = document.getElementById('scenario-detail-panel');
  if (panel) panel.classList.toggle('hidden', !visible);
}

function onScenarioListClick(event) {
  const button = event.target.closest('[data-scenario-category]');
  if (!button) return;
  showScenarioDetail(button.dataset.scenarioCategory, button.dataset.scenarioId);
}

function setScenarioListVisible(visible) {
  const panel = document.getElementById('scenario-list-panel');
  if (panel) panel.classList.toggle('hidden', !visible);
  if (!visible) setScenarioDetailVisible(false);
}

function toggleScenarioList() {
  if (!debugVisible) return;
  const panel = document.getElementById('scenario-list-panel');
  if (!panel) return;

  const willShow = panel.classList.contains('hidden');
  if (willShow) {
    renderScenarioList();
    setScenarioDetailVisible(false);
  }
  setScenarioListVisible(willShow);
}

function toggleDebug() {
  debugVisible = !debugVisible;
  document.getElementById('debug-panel').classList.toggle('hidden', !debugVisible);
  document.getElementById('btn-debug-toggle').textContent = 'デバッグ表示 ' + (debugVisible ? 'ON' : 'OFF');
  renderStatusTexts();
  if (!debugVisible) setScenarioListVisible(false);
  if (debugVisible) renderDebug();
}

// 全年齢/R-18 モードの実行時切替（デバッグ専用）。
// 製品版のモードは content-config.js（ビルド設定）で固定し、この切替は
// 「同一データからモードで表示が変わること」を確認するためだけに使う
function updateDebugModeButton() {
  const btn = document.getElementById('btn-debug-mode-toggle');
  if (!btn || !window.AssetResolver) return;
  btn.textContent = 'モード: ' + window.AssetResolver.getMode();
}

function toggleContentMode() {
  if (!window.AssetResolver) return;
  const next = window.AssetResolver.isAdultMode()
    ? window.AssetResolver.MODE_ALL_AGES
    : window.AssetResolver.MODE_R18;
  window.AssetResolver.setMode(next);
  updateDebugModeButton();
  render();
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
  document.getElementById('btn-debug-op-skip').addEventListener('click', debugSkipToDay2Morning);
  document.getElementById('btn-debug-scenario-list').addEventListener('click', toggleScenarioList);
  document.getElementById('btn-debug-mode-toggle').addEventListener('click', toggleContentMode);
  updateDebugModeButton();
  document.getElementById('scenario-list-content').addEventListener('click', onScenarioListClick);

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
