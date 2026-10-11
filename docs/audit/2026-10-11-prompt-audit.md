# 指示文の点検（2026-10-11・横断運用）

手本：guild-log-mock `docs/audit/2026-10-11-prompt-audit-diff.md`。手順：claude-api の prompt-audit。
HEAD 9caace2（origin/main と一致、左右 0/0）。対象：CLAUDE.md、AI_GUIDELINES.md、`.claude/skills/session-end/`（スキルは写しのため直さない）。

## 前提
- 点検対象モデルは現行（Sonnet 5.5 主・Opus 相談役）。書き方・★強調・重複は当てない（運用指示）。
- CLAUDE.md には検証・テスト・構文チェックのコマンドの記載がない。tools/ のスクリプトは CURRENT_SPEC / docs に書かれた「実行: node …」を試した。

## 試したこと（使い捨ての git worktree で実行）
| 書いてある所 | 試したこと | 結果 |
|---|---|---|
| CURRENT_SPEC:1470, STATE_INVENTORY:156 | `node tools/build-nightcare.js` | 8エントリ生成。night-care-data.js に差分なし（再現できる） |
| DECISION_LOG:852 ほか | `tools/sim-*.mjs` 10本すべて | すべて exit 0 |
| （CLAUDE.md に記載なし） | 本体 JS 5本に `node --check` | すべて通る |
| CLAUDE.md:92 | `docs/CHARACTER_DESIGN.md` ほか参照先のパス | 実在。ただし AI_GUIDELINES:290 の `DATA_MODEL.md` は実在しない |

「全部のファイルを見ているか」の穴（遠征の node --check 型）：該当なし。CLAUDE.md が検査コマンドを持たないため、数え漏れの起きる記述自体がない。

## 指摘
- **A1（事実の訂正・当てた）**：AI_GUIDELINES.md:290 が存在しない `DATA_MODEL.md` を指していた（git 履歴にも一度もない。CURRENT_SPEC:1258 の過去の作業記録にだけ名前が残る）。実物で確かめ、一覧から外した。却下案・テストへの影響なし（DECISION_LOG に DATA_MODEL の語なし）。
- **A2（作者に質問）**：CLAUDE.md の「モデル選択」節（日常＝Sonnet 5、難所＝Opus 4.8、Fable 5 は使わない）と、同日設定した `.claude/settings.json`（model: sonnet／advisorModel: opus）。矛盾ではないが、`opus` の別名は現行では 5.x を指し、「Opus 4.8」と版が食い違う。実際の運用は settings のとおり。今回は当てていない。→ 最終報告 Q。
- **A3（session-end スキルに関わる・写しは直さない）**：スキルの写しは 2026-07-29 時点のまま（マスターは 2026-09-25 版）。既知。最終報告の一覧にまとめる。

## 当てたもの
- AI_GUIDELINES.md:290 から `DATA_MODEL.md` を外した（1行）。戻すときはこの行を元に戻す。
- CLAUDE.md は変えていない。

## 裁定の結果（2026-10-11・作者の裁定 Q3＝A）
- CLAUDE.md「モデル選択」の「日常＝Sonnet 5、難所＝Opus 4.8」を「既定のモデルと相談役は `.claude/settings.json` に従う」に置き換えた。「Fable 5 は原則使わない」の行はコストの方針で版の話ではないので残した。
- 理由：版を本文に書くと、別名が指す版が変わるたびに食い違う。実際の運用は settings のとおり。
- 却下：B（このまま）＝版の食い違いが残る。C（人間用の方針として別に残す）＝同じ節に2つの「正」が並ぶ。
