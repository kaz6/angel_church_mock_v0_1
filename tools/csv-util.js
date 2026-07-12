/* =========================================================================
   csv-util.js — 最小限のCSVパーサ/ライタ（RFC4180準拠の範囲）
   夜ケアCSVパイプライン（build-nightcare.js / dump-nightcare.js）で共用。
   - 引用符つきフィールド、二重引用符エスケープ、セル内カンマ・改行に対応
   - 改行は \n に正規化（CRLFも受ける）
   ========================================================================= */

'use strict';

function parseCSV(text) {
  const src = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  rows.push(row);
  // ファイル末尾の改行が生む空行（[''] だけの行）を落とす
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

function csvField(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(arr) {
  return arr.map(csvField).join(',');
}

function stringifyCSV(rows) {
  return rows.map(csvRow).join('\n') + '\n';
}

module.exports = { parseCSV, csvField, csvRow, stringifyCSV };
