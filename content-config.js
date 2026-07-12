/* =========================================================================
   辺境教会の天使様と、はじまりの生活 - content-config.js
   全年齢 / R-18 モード切替（唯一の切替箇所）

   - "all_ages": 全年齢版。text_normal（無ければ従来の text）を表示する
   - "r18":      R-18版。text_adult があればそれを表示し、
                 未定義・プレースホルダ（[TODO: で始まる文字列）なら
                 text_normal に自動フォールバックする

   モード切替はこのファイルの mode を書き換えるだけでよい。
   コード側は asset-resolver.js（AssetResolver）経由で参照を解決するため、
   他のファイルを触る必要はない。
   Unity移植時は本ファイル相当を ScriptableObject / ビルド設定に置き換える想定。

   読み込み順（index.html）: content-config.js → asset-resolver.js →
   scenario-data.js → night-care-data.js → app.js
   ========================================================================= */

'use strict';

window.CONTENT_CONFIG = {
  mode: 'all_ages', // 'all_ages' | 'r18'
};
