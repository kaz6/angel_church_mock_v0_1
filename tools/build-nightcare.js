/* =========================================================================
   build-nightcare.js — 夜ケアCSV → night-care-data.js 生成スクリプト

   使い方（リポジトリ直下で）:
     node tools/build-nightcare.js

   入力: night-care.csv（全年齢の編集元。表計算ソフトで編集する）
   出力: night-care-data.js（window.SCENARIO_DATA.nightCareEvents を生成）

   ------------------------------------------------------------------
   CSV フォーマット
   ------------------------------------------------------------------
   1行目はヘッダ。列（順不同・不要な列は空欄でよい）:
     id, day, phase, countsAsRoutine, priority, location,
     angelExpression, angelStatus, relationChange, setFlags,
     text_normal, text_adult

   - 数値列（day / priority / relationChange）は空欄ならその項目を出力しない
   - countsAsRoutine は true / false（空欄なら出力しない）
   - setFlags は JSON（例: {"angel_relaxed_by_care":true}）。空欄なら出力しない
   - text_normal / text_adult:
       * セル内で「空行（改行2つ）」＝段落区切り → 配列の要素に分割
       * 段落内の改行（改行1つ）はそのまま保持
       * 表計算ソフトのセル内改行（Alt+Enter 等）で自然に書ける
   - text_adult は R-18本文。作者専管。データ整備では
       '[TODO:作者差し込み]' プレースホルダのみ置く（未差し込みなら
       実行時に text_normal へ自動フォールバックする）。
       ※ 実R-18本文は git 追跡下のこのCSVに書かない。将来 adult 列は
         gitignore 対象の別CSVへ分離する（NEXT_TASKS 参照）。

   このファイル（night-care-data.js）は生成物。手で編集せず CSV を編集すること。
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseCSV } = require('./csv-util.js');

const ROOT = path.join(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'night-care.csv');
const OUT_PATH = path.join(ROOT, 'night-care-data.js');

// セル文字列 → 段落配列（空行区切り）。空セルは undefined
function cellToParagraphs(cell) {
  if (cell == null) return undefined;
  const trimmed = cell.replace(/\s+$/, '');
  if (trimmed === '') return undefined;
  return trimmed.split(/\n{2,}/);
}

function toNumberOrUndefined(cell) {
  if (cell == null || cell.trim() === '') return undefined;
  const n = Number(cell);
  return Number.isFinite(n) ? n : undefined;
}

function rowToEntry(headers, cols) {
  const get = (name) => {
    const idx = headers.indexOf(name);
    return idx === -1 ? undefined : cols[idx];
  };

  const entry = {};
  const id = (get('id') || '').trim();
  if (!id) return null; // id 無し行はスキップ
  entry.id = id;

  const day = toNumberOrUndefined(get('day'));
  if (day !== undefined) entry.day = day;

  const phase = (get('phase') || '').trim();
  if (phase) entry.phase = phase;

  const countsRaw = (get('countsAsRoutine') || '').trim();
  if (countsRaw === 'true') entry.countsAsRoutine = true;
  else if (countsRaw === 'false') entry.countsAsRoutine = false;

  const priority = toNumberOrUndefined(get('priority'));
  if (priority !== undefined) entry.priority = priority;

  const location = (get('location') || '').trim();
  if (location) entry.location = location;

  const angelExpression = (get('angelExpression') || '').trim();
  if (angelExpression) entry.angelExpression = angelExpression;

  const angelStatus = (get('angelStatus') || '').trim();
  if (angelStatus) entry.angelStatus = angelStatus;

  const relationChange = toNumberOrUndefined(get('relationChange'));
  if (relationChange !== undefined) entry.relationChange = relationChange;

  const setFlagsRaw = (get('setFlags') || '').trim();
  if (setFlagsRaw) {
    try {
      entry.setFlags = JSON.parse(setFlagsRaw);
    } catch (e) {
      throw new Error(`setFlags のJSONが不正です (id=${id}): ${setFlagsRaw}`);
    }
  }

  const textNormal = cellToParagraphs(get('text_normal'));
  if (textNormal) entry.text_normal = textNormal;

  const textAdult = cellToParagraphs(get('text_adult'));
  if (textAdult) entry.text_adult = textAdult;

  return entry;
}

function build() {
  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csv);
  if (rows.length < 2) {
    throw new Error('CSVにデータ行がありません');
  }
  const headers = rows[0].map((h) => h.trim());
  const entries = [];
  for (let i = 1; i < rows.length; i++) {
    const entry = rowToEntry(headers, rows[i]);
    if (entry) entries.push(entry);
  }

  const header =
    '/* =========================================================================\n' +
    '   night-care-data.js — 夜ケアデータ【自動生成ファイル】\n' +
    '\n' +
    '   このファイルは tools/build-nightcare.js が night-care.csv から生成する。\n' +
    '   直接編集しないこと。夜ケア本文を直すときは night-care.csv を編集し、\n' +
    '     node tools/build-nightcare.js\n' +
    '   を実行して再生成する。\n' +
    '\n' +
    '   読み込み順（index.html）: content-config.js → asset-resolver.js →\n' +
    '     scenario-data.js → night-care-data.js → app.js\n' +
    '   （scenario-data.js の後に読み込み、window.SCENARIO_DATA へ nightCareEvents を追加する）\n' +
    '   ========================================================================= */\n' +
    "\n'use strict';\n\n" +
    'window.SCENARIO_DATA = window.SCENARIO_DATA || {};\n\n' +
    'window.SCENARIO_DATA.nightCareEvents = ';

  const body = JSON.stringify(entries, null, 2);
  const out = header + body + ';\n';
  fs.writeFileSync(OUT_PATH, out, 'utf8');
  console.log(`generated ${path.basename(OUT_PATH)} (${entries.length} entries) from ${path.basename(CSV_PATH)}`);
}

build();
