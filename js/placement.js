// ===== 敵配置ロジック（§8.4 Location of Enemy Contact）=====
//
// §8.3で決まった敵パッケージについて、実際にどのカードへ配置するかを
// §8.4.1（距離）+ §8.4.2（方向）から決める。
// 実際のユニット配置の細則（cover探索・PDF/VOF付与・友軍との重なり回避等 §8.4.3）は別途。
//
// ── 距離コード（§5.2.1 Range の定義に対応）──
//   point_blank   : 0（同カード）
//   close         : 1（隣接）
//   long          : 2
//   very_long     : 3
//   max_los_range : そのカードへ実際にOpen Fireできる最大距離（LOSが届く最遠。§8.4.3）
//   max_los       : スポッター/未発砲ユニット用。LOSが届く最遠（Open Fire目的ではない）
//   ※ どちらも本エンジンでは同じ traceLOSDirection の最遠カードとして扱う
//     （武器ごとの実射程差は未モデル化・既知の簡略化）
//
// ── 方向（§8.4.2, unitPlacementDirection テーブルの結果）──
//   front       → 'top'       （進軍方向。Row番号が小さくなる向き）
//   left_front  → 'top_left'
//   right_front → 'top_right'
//   縦方向(行)距離はどの方向でも1歩につき1行分動くため、
//   resolvePlacementCoord() が返す distance がそのまま「縦の長さ」になる。

import { traceLOSDirection, getMaxRangeCards, isAtMapEdge } from './los.js';
import { resolveValueSpec } from './data/scenario-tables.js';
import { expandMapEdge } from './grid.js';

const DISTANCE_FIXED = { point_blank: 0, close: 1, long: 2, very_long: 3 };

export const DIRECTION_TO_COMPASS = {
  front: 'top',
  left_front: 'top_left',
  right_front: 'top_right',
};

// 各方向で盤面外に出た場合に拡張すべき辺（§8.4.5）。
// 斜め方向は行・列の両方を拡張しておく（どちらの軸が原因で止まったかを
// 厳密に区別せず、両方拡張しても実害はないため簡略化している）。
const DIRECTION_TO_EDGES = {
  front: ['top'],
  left_front: ['top', 'left'],
  right_front: ['top', 'right'],
};

/**
 * 指定方向への視線を、必要ならマップを拡張しながら最大レンジまで解決する（§8.4.5）。
 * 盤面の端（まだ地形がない）に達した場合のみ拡張する。地形でLOSが遮られて
 * 止まった場合は拡張しない（ルール通り、拡張は「LOSが通る限り」続ける）。
 * @param {string} triggerCoord
 * @param {string} dir - 8方位（'top'/'top_left'/'top_right'等）
 * @param {'front'|'left_front'|'right_front'} directionKey - 拡張すべき辺を引くためのキー
 * @returns {string[]} 視線が通るカードの coord 配列（近い順）
 */
function _traceWithExpansion(triggerCoord, dir, directionKey) {
  const maxRange = getMaxRangeCards();
  const edges = DIRECTION_TO_EDGES[directionKey] ?? [];
  let visible = traceLOSDirection(triggerCoord, dir);

  let guard = 0;
  while (visible.length < maxRange && guard < maxRange + 1) {
    guard++;
    const lastCoord = visible.length ? visible[visible.length - 1] : triggerCoord;
    if (!isAtMapEdge(lastCoord, dir)) break; // 地形でLOSが遮られて止まった → 拡張不要

    edges.forEach(edge => expandMapEdge(edge));
    const next = traceLOSDirection(triggerCoord, dir);
    if (next.length <= visible.length) { visible = next; break; } // 新カードがLOSを遮った → ここで停止
    visible = next;
  }
  return visible;
}

/**
 * distanceSpec を解決して距離コードを返す（scenario-tables.js の resolveValueSpec を利用）。
 * @param {string|object} spec
 * @returns {{ code:string|null, r?:number, card?:object }}
 */
export function resolveDistanceCode(spec) {
  const { value, r, card } = resolveValueSpec(spec);
  return { code: value, r, card };
}

/**
 * 距離コード + 方向 + 起点カードから、実際に配置するカードを決める。
 * @param {string} triggerCoord - 接触の元になったカード（PCマーカーがあったカード）
 * @param {'front'|'left_front'|'right_front'} directionKey
 * @param {string} distanceCode
 * @returns {{ coord:string|null, distance:number|null }}
 *   coord=null は「その方向・距離では配置できない」（マップ端 or LOS遮断）。
 */
export function resolvePlacementCoord(triggerCoord, directionKey, distanceCode) {
  const dir = DIRECTION_TO_COMPASS[directionKey];
  if (!dir) return { coord: null, distance: null };

  if (distanceCode === 'max_los_range' || distanceCode === 'max_los') {
    const visible = _traceWithExpansion(triggerCoord, dir, directionKey);
    if (visible.length === 0) return { coord: null, distance: null }; // マップ端でカードなし
    return { coord: visible[visible.length - 1], distance: visible.length };
  }

  const fixedDist = DISTANCE_FIXED[distanceCode];
  if (fixedDist === undefined) return { coord: null, distance: null };
  if (fixedDist === 0) return { coord: triggerCoord, distance: 0 }; // Point Blank = 同カード

  // Close Rangeは境界色に関わらず常に見えるが、Long/VeryLongはLOSが遮られていれば
  // （マップ端なら§8.4.5に従い拡張して）その距離まで届くか確認する。
  const visible = _traceWithExpansion(triggerCoord, dir, directionKey);
  if (fixedDist <= visible.length) return { coord: visible[fixedDist - 1], distance: fixedDist };
  return { coord: null, distance: null };
}

/**
 * パッケージ全体（enemyForcePackages の1行）の配置を解決する。
 * パッケージレベルの distanceSpec があれば全ユニット共有の1回判定、
 * なければ units[].distanceSpec を個別に判定する。
 * @param {object} pkg
 * @param {string} triggerCoord
 * @param {'front'|'left_front'|'right_front'} directionKey
 * @returns {Array<{ name:string, coord:string|null, distance:number|null, distanceCode:string|null, r?:number, card?:object }>}
 */
export function resolvePackagePlacement(pkg, triggerCoord, directionKey) {
  const units = pkg.units ?? [{ name: pkg.label }];

  if (pkg.distanceSpec) {
    const { code, r, card } = resolveDistanceCode(pkg.distanceSpec);
    const { coord, distance } = resolvePlacementCoord(triggerCoord, directionKey, code);
    return units.map(u => ({ name: u.name, coord, distance, distanceCode: code, r, card }));
  }

  return units.map(u => {
    const { code, r, card } = resolveDistanceCode(u.distanceSpec);
    const { coord, distance } = resolvePlacementCoord(triggerCoord, directionKey, code);
    return { name: u.name, coord, distance, distanceCode: code, r, card };
  });
}
