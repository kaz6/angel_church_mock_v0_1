# STATE_INVENTORY.md — 現行実装の状態棚卸し

**作成: 2026-07-15 / 対象コミット: ブランチ `claude/all-ages-r18-architecture-jbk8wv`**
**方針: 読み取り専用の事実確認。コードは一切変更していない。推測で埋めず、「仕様書にあるが実装に無い」はそのまま記載する。**

> ⚠️ 最重要の結論（詳細は §3・§7）
> - **`painPoints` / `painType` / `painSeeds` はコードに一切存在しない。** pain 関連は boolean フラグ `pain_tired` / `hide_pain` の2つだけ。
> - **夜ケアの「数値仕様（careEnergy / careStage 1〜5 / stageProgress / ミニゲーム）」も未実装。** 現行の夜ケアは固定の1〜2文イベント＋固定 stat 変化のみ。
> - なお `CURRENT_SPEC.md` 自身が painSeeds/painType を「未実装・仕様メモのみ」と明記している（CURRENT_SPEC.md:819, 1029）。乖離は「隠れた食い違い」ではなく「仕様先行・実装未着手」。

---

## 1. リポジトリ構成

- **実験用・派生フォルダは無し。** このリポジトリは本体のみ（`experiments/` 等は存在しない）。
  「夜ケア単体プロトタイプ」は別 Git 管理で、**このリポジトリには含まれない**。
- **エントリポイント: `index.html`**（`content-config.js → asset-resolver.js → scenario-data.js → night-care-data.js → app.js` の順に読み込む）。ビルド不要でブラウザで開けば動く。

| ファイル | 役割 |
| --- | --- |
| `index.html` | 画面構造・スクリプト読み込み順（119行） |
| `style.css` | 教会風 UI |
| `app.js` | 進行・状態管理・判定・セーブ・stats 処理・描画・デバッグ（2253行。本体ロジックの中心） |
| `scenario-data.js` | 台詞/イベント本文・ラベル・状態文・自由行動テキスト・オープニング・夜イベント等（1076行、`window.SCENARIO_DATA`） |
| `night-care.csv` | 夜ケア本文の**編集元**（表計算）。38行 |
| `tools/build-nightcare.js` | `night-care.csv` → `night-care-data.js` 生成 |
| `tools/csv-util.js` / `tools/dump-nightcare.js` | CSVパーサ/ライタ・初回生成補助 |
| `night-care-data.js` | **`night-care.csv` からの自動生成物**。`window.SCENARIO_DATA.nightCareEvents`（153行） |
| `content-config.js` | 全年齢/R-18 モード設定（`CONTENT_CONFIG.mode`） |
| `asset-resolver.js` | normal/adult 参照の解決層（`AssetResolver`。106行） |
| `docs/*.md` | 設計・決定の永続記録（DECISION_LOG / SESSION_STATE / 本ファイル） |
| `CURRENT_SPEC.md` / `CONCEPT.md` / `CHARACTER_DESIGN.md` / `AI_GUIDELINES.md` / `PROJECT_BRIEF.md` / `NEXT_TASKS.md` | 設計ドキュメント |

---

## 2. 状態変数の全一覧

全状態は単一の `gameState`（`createInitialState()` app.js:686）に集約。
**セーブ**: `saveGame()` が `gameState` 全体を JSON 化して localStorage に保存（app.js:1700）。ロードは app.js:1717 でマージ。→ 下表は原則すべて「セーブされる」。

### 2-1. 数値パラメータ `gameState.stats`（定義 app.js:173 / 範囲 app.js:182）

| 変数 | 型・範囲 | 初期値 | 意味 | 誰が増減させるか（file:line） | セーブ |
| --- | --- | --- | --- | --- | --- |
| `trust` | int [0,30] | 0 | 信頼 | talk +2 (app.js:1126)／夜ケア +1 (app.js:1153) | Yes |
| `prayerTuning` | int [0,30] | 0 | 祈りの調律 | pray +2、疲労≤3で+1 (app.js:1102)／夕方pray +3(+1) (app.js:1140) | Yes |
| `caretakerAptitude` | int [0,30] | 0 | 世話役適性 | chores +2 (app.js:1094)／夕方chores +1 (app.js:1132) | Yes |
| `mentalMargin` | int [0, `mentalMarginMax`] | 5 | 心身の余白 | chores/pray/夜ケア −1、rest +2 (app.js:1110)、就寝 +2 (app.js:1148)。clamp app.js:922 | Yes |
| `mentalMarginMax` | int | 10 | 余白の上限 | **どこからも変更されない**（実質定数） | Yes |
| `angelFatigue` | int [0,10] | 5 | 天使様の疲労 | chores −1 (app.js:1094)／夜ケア −1、余白≥7で更に−1 (app.js:1153) | Yes |

> ⚠️ **`angelFatigue` は減少のみ。** コード上、増加させる処理が存在しない（単調減少）。→ §8

### 2-2. フラグ `gameState.memoryFlags`（定義 app.js:147、全21キー）

| フラグ | 初期 | 意味 / 設定箇所（file:line） | セーブ |
| --- | --- | --- | --- |
| `angel_revealed` | false | 天使開示。OP `angel_confession`（app.js:246 付近 setFlags） | Yes |
| `went_to_attic` | false | 屋根裏へ行った。OP選択 app.js:221 | Yes |
| `stayed_in_room` | false | 部屋に留まった。OP選択 app.js:227,239 | Yes |
| `respected_warning` | false | 言いつけを守った。OP選択 app.js:239 | Yes |
| `prioritized_help` | false | 助けを優先。OP選択 app.js:221,233 | Yes |
| `pain_tired` | false | **痛み関連①** 2日目夜「少しだけ」。`admit_tired`→ app.js:565 | Yes |
| `hide_pain` | false | **痛み関連②** 2日目夜「大丈夫です」。`hide_tired`→ app.js:566 | Yes |
| `helped_church` | false | 家事をした。freeActionEvents chores app.js:313–361 | Yes |
| `prayed_with_angel` | false | 祈った。freeActionEvents pray app.js:367–415 | Yes |
| `rested_in_room` | false | 休んだ。freeActionEvents rest app.js:421–469 | Yes |
| `talked_with_angel` | false | 話しかけた。freeActionEvents talk app.js:475–534 | Yes |
| `remembered_by_angel` | false | 3日目夜イベントで覚えられた。app.js:549 | Yes |
| `first_night_care_done` | false | 初回夜ケア済。enterNightCare app.js:1334＋OP night_care | Yes |
| `night_care_routine_started` | false | 夜ケア日課化。app.js:1335 | Yes |
| `angel_relaxed_by_care` | false | ケアで和らいだ。nightCareEvents の setFlags（night-care-data.js） | Yes |
| `angel_asked_for_care` | false | 天使が自らケアを求めた（後半用）。**設定箇所なし＝未使用**（定義 app.js:163 のみ） | Yes |
| `rest_when_tired` | false | 疲労時に休んだ。rest 時 余白≤2 で app.js:1118 | Yes |
| `angel_noticed_player_tired` | false | 天使が疲れに気づいた。余白≤2 で app.js:1161 | Yes |
| `confession_day_shared` | false | 7日目懺悔室「話した」。app.js:567 | Yes |
| `confession_day_uncertain` | false | 同「言葉にならない」。app.js:568 | Yes |
| `confession_day_silent` | false | 同「黙って座る」。app.js:569 | Yes |
| `confession_day_avoided` | false | 同「やめておいた」。app.js:570 | Yes |

### 2-3. カウンタ `gameState.actionCounts`（定義 app.js:190）

| 変数 | 初期 | 増加箇所 | セーブ |
| --- | --- | --- | --- |
| `chores` / `pray` / `rest` / `talk` | 0 | 各行動の `applyStatChanges(..., {actionCountKey})`（app.js:1071） | Yes |
| `nightCare` | 0 | 夜ケア applyNightCareStats app.js:1157 | Yes |
| `nightCareCount`（※ `stats`外・gameState直下） | 0 | enterNightCare app.js:1333 | Yes |

### 2-4. 進行・その他 `gameState`（`createInitialState` app.js:686）

| 変数 | 型 | 初期値 | 意味 | セーブ |
| --- | --- | --- | --- | --- |
| `day` | int | 1 | 日数（上限 `END_DAY=7` app.js:25） | Yes |
| `timeSlot` | str | `'noon'` | `morning/noon/evening/night` | Yes |
| `phase` | str | `'opening'` | `title/opening/free/ending` | Yes |
| `currentSceneId` | str | `'arrival'` | OP進行のシーンID | Yes |
| `freeStep` | str/null | null | `select/result/observe/forced/forced_after/night_care` | Yes |
| `relationStage` | int | 0 | 距離感（ラベル化して表示。増減は各所 `relationChange`） | Yes |
| `careStyle` | str | `'default'` | ケアの型（現状 `'default'` 固定、分岐なし） | Yes |
| `seenEventIds` | array | [] | 表示済みイベント/自由行動キー | Yes |
| `seenNightCareIds` | array | [] | 表示済み夜ケアID | Yes |
| `angelExpression` | str | `'tired'` | 立ち絵プレースホルダの表情語（自由記述文字列） | Yes |
| `angelStatus` | str | 文 | 天使の短い状況文 | Yes |
| `currentLocation` | str | `'教会前'` | 現在地表示 | Yes |
| `playerCallName` | str | '' | 呼び名 | Yes |
| `pendingAction` / `pendingEntryId` / `pendingForcedChoiceId` / `pendingNightCareId` / `pendingCallNameNext` | 各 | null | 遷移用の一時保持 | 一部Yes |
| `lastStatChanges` / `lastStatusChangeComment` / `statChangeLog` | 各 | null/''/[] | stats 変化の記録（表示・デバッグ用） | Yes |
| `log` | array | [] | ログ欄 | Yes |
| `callNameReactionText` | str/null | null | 呼び名反応の一時テキスト（ロード時 null 化 app.js:1732） | No（都度リセット） |

### 2-5. 導出値（保存されず都度計算）

- `relationLabel(relationStage)`（app.js:1485）: 距離感ラベル（「まだ遠い」等）。
- `getStatusText(statKey, value)`: stats 値 → 状態文（`statusTexts` 参照）。
- 表示ラベル各種（`statLabels` 等）。
- モード解決 `AssetResolver.resolveText / resolveCgId`（現在モードに応じて normal/adult を都度解決）。

---

## 3. 痛み（pain）関連の実装状況 ★最重要

| 想定仕様 | 実装状況 |
| --- | --- |
| `painPoints`（痛みの多次元ベクトル。会話選択肢に不可視で仕込む） | **実装されていない。** コードに識別子・データ構造ともに存在しない（`*.js` 全文 grep で 0 件）。 |
| `painType`（6分類 useless / not_needed / no_rest / no_place / self_blame / loss を確定） | **実装されていない。** 6分類のIDも確定処理もコードに無い。 |
| `painSeeds`（hidden → exposed → shared の状態遷移） | **実装されていない。** 状態機械・遷移ロジックとも無い。 |
| 代替として使われている簡易な仕組み | **boolean フラグ2つのみ**：`pain_tired`（2日目夜「少しだけ」app.js:565）／`hide_pain`（同「大丈夫です」app.js:566）。この2フラグで、3日目夜イベントの続き文の分岐（scenario-data.js:341 の `textVariants`：`pain_tired`/`hide_pain`/`default`）に使われるのみ。多次元でも6分類でもなく、単発の2択記憶。 |

> `CURRENT_SPEC.md` §「痛みと癒しの記憶システム方針」（819行〜）は painSeeds/painType を詳述しているが、冒頭に **「現時点ではコード未実装。将来〜の仕様メモ」**（CURRENT_SPEC.md:819）と明記。§既知の保留（CURRENT_SPEC.md:1029）でも「未実装・仕様メモのみ」。→ 仕様書と実装の認識は一致している（＝仕様先行）。

---

## 4. 夜ケアの実装状況

- **処理（`enterNightCare` app.js:1321〜）**: ①2日目以降で発火 ②`findNightCareEvent(day)` で day 一致・priority 降順の1件を選ぶ（app.js:1296〜）③`nightCareCount +1`（app.js:1333）④フラグ `first_night_care_done` / `night_care_routine_started` を true ⑤`applyNightCareStats()` を適用 ⑥エントリの setFlags / relationChange 反映 → 本文表示 → 「就寝する」で翌日へ。
- **数値変化（`applyNightCareStats` app.js:1152）**: `trust +1`, `angelFatigue −1`, `mentalMargin −1`。`mentalMargin ≥ 7` のとき `angelFatigue` 追加 −1。就寝時に別途 `mentalMargin +2`（`applySleepRecoveryStats` app.js:1148）。
- **ミニゲーム**: **本体に統合されていない。** careEnergy / careStage / stageProgress / 長押し等の入力系はコードに存在しない（別リポジトリのプロトタイプ止まり）。
- **反映先**: 上記の `trust / angelFatigue / mentalMargin` と各フラグのみ。ケアの「成果・質」による分岐は無い（固定処理）。CURRENT_SPEC.md:540 も「現時点では夜ケア成果判定は未実装」と一致。

---

## 5. データ構造

### 5-1. `window.SCENARIO_DATA`（scenario-data.js のトップレベルキー）

`cgRegistry`(43) / `statLabels`(45) / `actionLabels`(53) / `timeSlotLabels`(62) / `slotIntroTexts`(69) / `observeTexts`(135) / `openingScenes`(171) / `nightEvents`(302) / `freeActionTexts`(414) / `statusTexts`(956) / `statusChangeTexts`(984) / `endingTexts`(1006) / `callNameReactions`(1054)。
＋ `night-care-data.js` が `nightCareEvents` を追加。

- **openingScenes / nightEvents / nightCareEvents の主なキー**: `id, day, timeSlot, location, angelExpression, angelStatus, logText, priority, text（または text_normal / text_adult）, choices[{label,next / id,resultText}], textVariants, setFlags?, relationChange?`。
  ※ ただし `setFlags` / `relationChange` の「処理」は app.js 側（`sceneDefinitions` app.js:198〜、`forcedNightEvents` app.js:542、`freeActionEvents` app.js:299〜）に持つ設計。データ側は表示・演出中心。
- **全年齢/R-18 差分**: テキストは `text_normal` / `text_adult`（`text` はレガシー互換）。CGは `{scene_id}_normal` / `{scene_id}_adult` ＋ `cgRegistry`。`AssetResolver`（asset-resolver.js）が `CONTENT_CONFIG.mode`（`all_ages`/`r18`）に応じて解決、adult 未定義や `[TODO:` は normal に自動フォールバック。

### 5-2. 夜ケアデータ & CSVパイプライン

- **入力**: `night-care.csv`（列: `id, day, phase, countsAsRoutine, priority, location, angelExpression, angelStatus, relationChange, setFlags, text_normal, text_adult`）。1行=1エントリ、text セルは空行で段落分割、setFlags は JSON。
- **生成**: `node tools/build-nightcare.js` → **`night-care-data.js`（自動生成物・手編集禁止）**。8エントリ（`night_care_d1_opening`〜`d7` ＋ `night_care_fallback`）。
- 実行時ローダは無し（file:// 制約回避のため事前生成方式）。

---

## 6. 現在プレイ可能な範囲

- **1日目オープニング 〜 7日目夜ケア → エンディング画面** まで通しでプレイ可能。
- 根拠: `END_DAY = 7`（app.js:25）。`onNightCareContinue`（app.js:1359）で `day >= END_DAY` なら `showEndingScreen()`。エンディングは固定の「モック v0.2 の範囲はここまで」画面（app.js:1373）。
- **未実装のまま残っている主なもの**:
  - 8日目以降・結婚式(14)・葬儀(21)・帰還指令(28) の本編（CURRENT_SPEC.md:163）。
  - エンディングの**分岐**（`endingTexts` データはあるが分岐処理なし。CURRENT_SPEC.md:1118）。
  - パラメータ閾値・選択比重による会話解禁（将来仕様）。
  - `angel_asked_for_care` フラグを使うイベント（フラグ定義のみ・設定箇所なし）。

---

## 7. 仕様書との乖離リスト ★重要

| 項目 | 仕様書の記述 | 実装の実態 | 乖離の大きさ |
| --- | --- | --- | --- |
| **痛みベクトル/6分類/種** | painPoints/painType/painSeeds を詳述（CURRENT_SPEC.md:819–917） | boolean `pain_tired`/`hide_pain` の2フラグのみ | **大**（ただし仕様書自身が「未実装・仕様メモのみ」と明記＝認識は一致） |
| **夜ケア数値仕様** | 「確定済み数値仕様」として careStage 1〜5 / stageProgress 0〜100 / mentalMargin→careEnergy 生成（NEXT_TASKS.md:205、PROJECT_BRIEF/開発指示書） | careEnergy/careStage/stageProgress 無し。固定 stat 変化のみ | **大**（CURRENT_SPEC.md:540 は「成果判定未実装」と整合的だが、他ドキュメントは"確定"と記載＝**ドキュメント間でも不一致**） |
| **表情システム** | 「感情セット＋目の開度(糸目/半目)＋隈」3レイヤー（DECISION_LOG / CHARACTER_DESIGN.md） | `angelExpression` は自由記述の気分語文字列（`tired/soft/gentle/sleepy/shocked` 等）。糸目/隈/開度の構造は無し | **大**（設計は最新、実装は旧プレースホルダのまま） |
| **日数構成** | 28日構成が有力（CONCEPT.md）、14/21/28 の節目 | `END_DAY=7`、7日で終了 | 中（CURRENT_SPEC.md:163 で「7日モック優先・以降未実装」と明記済み） |
| **エンディング分岐** | クリア条件・28日目選択で分岐（CURRENT_SPEC.md:733,770） | 固定の終了画面のみ、`endingTexts` は未使用 | 中（spec で「未実装・案のみ」と明記） |
| **モード運用** | 「当面 r18 モード固定で運用」（DECISION_LOG） | `content-config.js` の既定は `mode: 'all_ages'` | 小（既定値が方針と逆。切替1箇所なので変更は容易だが現状は all_ages 起動） |
| **販売方針** | R-18版のみ（DECISION_LOG / ハブ最新） | コードは全年齢/R-18両対応の器のみ（内容差分は未差し込み） | 小（設計どおり・器のみ） |

---

## 8. 気になった点（記録のみ・修正しない）

- **`angelFatigue` が単調減少**：増加させる処理がコードに無い（chores/夜ケアで減るのみ）。天使様の疲労は本来「夕方の祈りで溜まる」想定だが、その加算が実装されていない。→ 数値設計を詰める際の論点。
- **`careStyle` / `angel_asked_for_care` が定義のみで未使用**（`careStyle` は常に `'default'`、フラグは setter 無し）。将来用のプレースホルダと思われる。
- **`content-config.js` の既定が `all_ages`**：DECISION_LOG の「当面 r18 固定運用」と食い違う（起動時は全年齢で解決される）。
- **`mentalMarginMax` はどこからも変更されない**（実質定数 10）。将来ケアで上限が動く想定なら未実装。
- **表情 `angelExpression` は自由文字列**で、値の集合が固定化されていない（`tired/soft/gentle/warm/sleepy/shocked/surprised/sad/concerned/normal` 等が散在）。新表情システム（糸目×隈×感情）へ移す際は、この値の棚卸し・マッピングが必要。
- 本ファイルは「夜実験派生フォルダ」ではなく **本体リポジトリ** を対象に作成（実験用フォルダはこのリポジトリには存在しない）。
