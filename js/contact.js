// ===== コンタクトレベル（Current Activity Level）算出モジュール =====
//
// ルール §8.1 に基づき、盤面状態から活動レベルを自動算出する。
// 4段階（弱→強）: no_contact < contact < engaged < heavily_engaged
//
// 判定（強い順に評価し、最初に該当したものを採用）:
//   heavily_engaged : VOF下の占有カードが2枚以上 かつ うち1枚以上に敵と友軍が同居
//   engaged         : VOF下の占有カードが2枚以上
//   contact         : VOF下の占有カードが1枚 または Spotted な敵が1体以上
//   no_contact      : 上記いずれも満たさない（VOF下の占有カードが0 かつ Spotted敵なし）
//
// ※ 判定の実体は「占有カード下のVOF」と「Spotted な敵」のみ。
//    占有していないカードに置かれた VOF/PDF は活動レベルに影響しない。
//    （VOF は本来ユニットのいるカードに対して置かれるため。誰も巻き込んでいない
//      空カードの VOF/PDF で接触状態にはしない。）
//
// 影響（本モジュールでは算出・表示まで。下記は将来の接続先）:
//   - No Contact 時に HQ コマンド取得判定 +1（§4.1.2）
//   - PC マーカー解決時のドロー枚数（§8.2.4・ドローチャートは PC 実装時）
//
// 循環参照を避けるため、盤面変更側は CustomEvent 'board:changed' を発火するだけ。
// 本モジュールがそれを購読して再計算する（依存は contact → vof/state の一方向）。

import { cardVOFMap } from './vof.js';
import { unitCoordMap, getUnitState } from './state.js';

export const ACTIVITY_LEVELS = ['no_contact', 'contact', 'engaged', 'heavily_engaged'];
export const ACTIVITY_LABELS = {
  no_contact:      '接触なし',
  contact:         '接触',
  engaged:         '交戦',
  heavily_engaged: '激戦',
};

let _level = 'no_contact';

// ===== 内部ユーティリティ =====

/** unitId の faction を DOM から取得（LAT 等の動的ユニットも拾える） */
function _faction(unitId) {
  const slot = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
  return slot?.dataset.faction ?? null;
}

/** 敵か（friendly 以外はすべて敵側とみなす） */
function _isEnemy(unitId) {
  const f = _faction(unitId);
  return f != null && f !== 'friendly';
}

/** coord → { friendly:bool, enemy:bool } の占有状況を集計 */
function _occupancy() {
  const occ = new Map();
  unitCoordMap.forEach((coord, unitId) => {
    if (!occ.has(coord)) occ.set(coord, { friendly: false, enemy: false });
    const o = occ.get(coord);
    if (_isEnemy(unitId)) o.enemy = true;
    else                  o.friendly = true;
  });
  return occ;
}

// ===== 算出 =====

/**
 * 現在の盤面から活動レベルを算出する（保存はしない）。
 * @returns {'no_contact'|'contact'|'engaged'|'heavily_engaged'}
 */
export function computeActivityLevel() {
  const occ = _occupancy();

  // Spotted な敵（unspotted でない敵ユニット）
  let spottedEnemy = false;
  unitCoordMap.forEach((coord, unitId) => {
    if (_isEnemy(unitId) && !getUnitState(unitId).unspotted) spottedEnemy = true;
  });

  // VOF 下にある占有カードを数え、敵味方同居の有無を見る
  let underVofCount = 0;
  let mixedExists   = false;
  occ.forEach((o, coord) => {
    if (cardVOFMap.has(coord)) {
      underVofCount++;
      if (o.friendly && o.enemy) mixedExists = true;
    }
  });

  if (underVofCount >= 2) return mixedExists ? 'heavily_engaged' : 'engaged';
  if (underVofCount === 1 || spottedEnemy) return 'contact';

  // 占有カード下の VOF も Spotted 敵もない → No Contact
  // （空カードに VOF/PDF があっても、誰も巻き込んでいなければ接触ではない）
  return 'no_contact';
}

/** 現在保持している活動レベルを返す */
export function getActivityLevel() {
  return _level;
}

/** 活動レベルの数値（0〜3）を返す */
export function getActivityLevelIndex() {
  return ACTIVITY_LEVELS.indexOf(_level);
}

/** 再計算して保持＆表示を更新する */
export function recomputeActivityLevel() {
  _level = computeActivityLevel();
  renderActivityLevel();
  return _level;
}

// ===== 表示 =====

function renderActivityLevel() {
  const el = document.getElementById('activityLevelValue');
  if (!el) return;
  const idx = ACTIVITY_LEVELS.indexOf(_level);
  el.textContent = `${idx} ${ACTIVITY_LABELS[_level]}`;
}

// ===== 初期化 =====

/**
 * 盤面変更イベントを購読し、初回計算を行う。
 * map.js の初期化（buildGrid 後）から1回呼ぶ。
 */
export function initContactLevel() {
  document.addEventListener('board:changed', recomputeActivityLevel);
  recomputeActivityLevel();
}
