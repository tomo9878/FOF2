// ===== シナリオ定義インデックス =====
//
// ノルマンディー・キャンペーン全7ミッションを束ねる。
// セットアップ時にここから選択し、視界・練度・部隊・マップを確定する。

import m1 from './mission-01.js';
import m2 from './mission-02.js';
import m3 from './mission-03.js';
import m4 from './mission-04.js';
import m5 from './mission-05.js';
import m6 from './mission-06.js';
import m7 from './mission-07.js';

/** ミッション番号順の全シナリオ */
export const SCENARIOS = [m1, m2, m3, m4, m5, m6, m7];

/**
 * ミッション番号でシナリオ定義を取得する。
 * @param {number} missionNumber - 1〜7
 * @returns {object|null}
 */
export function getScenario(missionNumber) {
  return SCENARIOS.find(s => s.missionNumber === missionNumber) ?? null;
}

/**
 * シナリオ ID でシナリオ定義を取得する。
 * @param {string} id - 例 'normandy-01'
 * @returns {object|null}
 */
export function getScenarioById(id) {
  return SCENARIOS.find(s => s.id === id) ?? null;
}
