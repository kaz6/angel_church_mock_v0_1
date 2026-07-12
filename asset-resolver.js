/* =========================================================================
   辺境教会の天使様と、はじまりの生活 - asset-resolver.js
   全年齢 / R-18 差し替えの解決層（AssetResolver）

   目的:
   - シナリオデータ側は「同一IDに normal / adult の差分を持つ」だけにして、
     どちらを表示するかの判断をこの1ファイルに閉じ込める。
   - Unity移植時はこのファイル相当を C# の AssetResolver クラスに
     そのまま写せるよう、DOM や gameState には依存しない純粋な解決処理のみ置く。

   スキーマ規約（scenario-data.js / night-care-data.js 側）:
   - テキスト: 同一エントリに text_normal / text_adult を持たせる。
       * 従来の text キーは text_normal と同義（レガシー互換）。既存データは
         書き換え不要で、差分を入れたいエントリだけ text_normal / text_adult
         に移行すればよい。
       * text_adult が未定義、または '[TODO:' で始まるプレースホルダの場合は
         normal 側に自動フォールバックする（差し込み前でも常に動く）。
   - CG: {scene_id}_normal / {scene_id}_adult の命名で管理する。
       * adult 側の実在確認は window.SCENARIO_DATA.cgRegistry（定義済みCG IDの
         配列。任意）で行い、未登録なら _normal にフォールバックする。

   使い方（app.js 側）:
   - AssetResolver.resolveText(entry)            … entry.text 系の解決
   - AssetResolver.resolveText(entry, 'resultText') … 別ベースキーの解決
   - AssetResolver.resolveCgId('night_care_d3')  … CG参照IDの解決
   - AssetResolver.setMode('r18')                … デバッグ用の実行時切替のみ。
     製品ではモードは content-config.js（ビルド設定）で固定する。
   ========================================================================= */

'use strict';

window.AssetResolver = (function () {
  const MODE_ALL_AGES = 'all_ages';
  const MODE_R18 = 'r18';
  const ADULT_SUFFIX = '_adult';
  const NORMAL_SUFFIX = '_normal';
  const PLACEHOLDER_PREFIX = '[TODO:';

  function getMode() {
    const config = window.CONTENT_CONFIG;
    return config && config.mode === MODE_R18 ? MODE_R18 : MODE_ALL_AGES;
  }

  function isAdultMode() {
    return getMode() === MODE_R18;
  }

  // デバッグパネル専用。製品版のモードは content-config.js で固定する
  function setMode(mode) {
    window.CONTENT_CONFIG = window.CONTENT_CONFIG || {};
    window.CONTENT_CONFIG.mode = mode === MODE_R18 ? MODE_R18 : MODE_ALL_AGES;
    return window.CONTENT_CONFIG.mode;
  }

  // '[TODO:...]' プレースホルダ（配列の場合は先頭要素で判定）は
  // 「未差し込み」とみなしてフォールバック対象にする
  function isPlaceholder(value) {
    const head = Array.isArray(value) ? value[0] : value;
    return typeof head === 'string' && head.trim().indexOf(PLACEHOLDER_PREFIX) === 0;
  }

  function isUsableText(value) {
    if (value === undefined || value === null) return false;
    return !isPlaceholder(value);
  }

  // entry から現在モードのテキスト（string | string[]）を解決する。
  // 優先順: [r18時] {baseKey}_adult → {baseKey}_normal → {baseKey}
  //         [全年齢] {baseKey}_normal → {baseKey}
  // 見つからなければ undefined（呼び出し側の既存フォールバックに任せる）
  function resolveText(entry, baseKey) {
    if (!entry) return undefined;
    const key = baseKey || 'text';
    if (isAdultMode() && isUsableText(entry[key + ADULT_SUFFIX])) {
      return entry[key + ADULT_SUFFIX];
    }
    if (isUsableText(entry[key + NORMAL_SUFFIX])) {
      return entry[key + NORMAL_SUFFIX];
    }
    return entry[key];
  }

  // scene_id から現在モードのCG参照IDを解決する。
  // adult 側は cgRegistry（定義済みCG IDリスト）に登録がある場合のみ採用し、
  // 未登録なら {scene_id}_normal にフォールバックする
  function resolveCgId(sceneId) {
    if (!sceneId) return null;
    if (isAdultMode()) {
      const adultId = sceneId + ADULT_SUFFIX;
      const registry =
        (window.SCENARIO_DATA && window.SCENARIO_DATA.cgRegistry) || [];
      if (registry.indexOf(adultId) !== -1) return adultId;
    }
    return sceneId + NORMAL_SUFFIX;
  }

  return {
    MODE_ALL_AGES: MODE_ALL_AGES,
    MODE_R18: MODE_R18,
    getMode: getMode,
    isAdultMode: isAdultMode,
    setMode: setMode,
    resolveText: resolveText,
    resolveCgId: resolveCgId,
  };
})();
