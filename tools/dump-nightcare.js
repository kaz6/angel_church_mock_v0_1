/* =========================================================================
   dump-nightcare.js — 現行 night-care-data.js から night-care.csv を作る補助
   （初回CSV生成・移行確認用。通常運用では build-nightcare.js のみ使う）

   使い方: node tools/dump-nightcare.js > night-care.csv
   ========================================================================= */

'use strict';

const path = require('path');
const { csvRow } = require('./csv-util.js');

globalThis.window = {};
require(path.join(__dirname, '..', 'night-care-data.js'));

const events = (globalThis.window.SCENARIO_DATA || {}).nightCareEvents || [];

const HEADERS = [
  'id', 'day', 'phase', 'countsAsRoutine', 'priority', 'location',
  'angelExpression', 'angelStatus', 'relationChange', 'setFlags',
  'text_normal', 'text_adult',
];

function textToCell(t) {
  if (t == null) return '';
  if (Array.isArray(t)) return t.join('\n\n');
  return String(t);
}

const lines = [csvRow(HEADERS)];
events.forEach((e) => {
  lines.push(
    csvRow([
      e.id || '',
      e.day == null ? '' : e.day,
      e.phase || '',
      e.countsAsRoutine === undefined ? '' : String(e.countsAsRoutine),
      e.priority == null ? '' : e.priority,
      e.location || '',
      e.angelExpression || '',
      e.angelStatus || '',
      e.relationChange == null ? '' : e.relationChange,
      e.setFlags ? JSON.stringify(e.setFlags) : '',
      textToCell(e.text_normal !== undefined ? e.text_normal : e.text),
      textToCell(e.text_adult),
    ])
  );
});

process.stdout.write(lines.join('\n') + '\n');
