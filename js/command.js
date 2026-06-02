// ===== コマンドポイント（AP）管理モジュール =====
//
// AP を保持できるのは commandRole を持つ指揮ユニット（BN/CO HQ・CO staff・PLT HQ）。
//
// 保持するステート:
//   - currentAP: 現在の保有コマンド数（刻々と変わる）
//
// 計算で導出する値（保存しない）:
//   - 繰越上限 getCarryoverMax(): 練度 × 視界 で決まる（CARRYOVER_TABLE）
//   - 消費上限 getExpendLimit(): 1インパルスで使える最大（視界のみ・練度非依存）
//
// ※ 練度はユニット定義（experience）に、視界は getVisibility() に既にあるため、
//    導出値を箱に保存すると二重管理になる。よって都度計算する。

import { getVisibility } from './ncm.js';
import { UNITS } from './data/units-normandy.js';

// ===== ルールテーブル =====

/**
 * コマンド繰越上限（Saved Commands）: 練度 × 視界
 * 次のターンへ貯金（Save）できる最大コマンド数。
 */
export const CARRYOVER_TABLE = {
  green: { daylight: 3, limited: 2 },
  line:  { daylight: 6, limited: 4 },
  vet:   { daylight: 9, limited: 6 },
};

/**
 * 消費上限（Expend）: 1インパルスで消費できる最大コマンド数。
 * 練度に関わらず視界のみで決まる。
 */
export const EXPEND_LIMIT = { daylight: 6, limited: 4 };

// ===== 内部ユーティリティ =====

/**
 * 現在の視界モードを返す。
 * getVisibility(): 0=昼間 / それ以外（夜・霧等）=視界制限。
 * @returns {'daylight'|'limited'}
 */
function _visMode() {
  return getVisibility() === 0 ? 'daylight' : 'limited';
}

/**
 * ユニットの経験レベルを UNITS 定義から引く。
 * @param {string} unitId
 * @returns {'vet'|'line'|'green'}
 */
function _experience(unitId) {
  for (const units of Object.values(UNITS)) {
    const u = units.find(u => u.id === unitId);
    if (u) return u.experience ?? 'line';
  }
  return 'line';
}

/**
 * ユニットの commandRole を UNITS 定義から引く（なければ null）。
 * @param {string} unitId
 * @returns {string|null}
 */
export function getCommandRole(unitId) {
  for (const units of Object.values(UNITS)) {
    const u = units.find(u => u.id === unitId);
    if (u) return u.commandRole ?? null;
  }
  return null;
}

/**
 * AP を保持できるユニットか（commandRole を持つか）。
 * @param {string} unitId
 * @returns {boolean}
 */
export function canHoldCommands(unitId) {
  return getCommandRole(unitId) !== null;
}

// ===== ストア =====

/** unitId → { currentAP: number } */
export const unitCommandMap = new Map();

// ===== 現在AP ゲッター/セッター =====

/**
 * @param {string} unitId
 * @returns {number}
 */
export function getCurrentAP(unitId) {
  return unitCommandMap.get(unitId)?.currentAP ?? 0;
}

/**
 * @param {string} unitId
 * @param {number} n
 */
export function setCurrentAP(unitId, n) {
  if (!unitCommandMap.has(unitId)) unitCommandMap.set(unitId, { currentAP: 0 });
  unitCommandMap.get(unitId).currentAP = Math.max(0, n);
}

/**
 * @param {string} unitId
 * @param {number} delta - 正で加算、負で消費
 */
export function changeCurrentAP(unitId, delta) {
  setCurrentAP(unitId, getCurrentAP(unitId) + delta);
}

// ===== 導出値（計算）=====

/**
 * 次ターンへ繰り越せる上限（練度 × 視界）。
 * @param {string} unitId
 * @returns {number}
 */
export function getCarryoverMax(unitId) {
  const exp = _experience(unitId);
  return CARRYOVER_TABLE[exp]?.[_visMode()] ?? 0;
}

/**
 * 1インパルスで消費できる上限（視界のみ・全ユニット共通）。
 * @returns {number}
 */
export function getExpendLimit() {
  return EXPEND_LIMIT[_visMode()];
}
