// ===== LOS（視線）・距離計算モジュール（§5.2.1 Line of Sight (LOS) and Range）=====
//
// 8方向・最大3カード先までの視線を、地形カードの境界色（white=通る/dark=遮る）と
// 標高（Hill）から判定する。
//
// レンジ区分（§5.2.1）:
//   Close Range      : 隣接1枚 — 境界色に関わらず常に見える
//   Long Range       : 2枚先  — 間に挟む1枚の「出入り境界」が両方 white である必要
//   Very Long Range  : 3枚先  — 間に挟む2枚それぞれの「出入り境界」が両方 white である必要
// 視界制限時（Limited Visibility, §9.1）は Close Range までに短縮される。
//
// 標高（§5.2.2）:
//   基本標高は1。Hillが1枚乗ると+1。
//   高い標高からは、自分より低い標高の dark border を無視して視線を通せる
//   （同標高同士は不可）。
//   ※ 「同標高以上のカードを挟んで直上/直下を見る場合は遮られる」という
//     ルールブックの細かい例外（5.2.2 該当箇所）はここでは簡略化し、未対応。
//     （既知の簡略化。必要になったら拡張する）
//
// 注意: Urban Combat の LOS（13.8.2）はより複雑な別ルールのため対象外（プロジェクト方針で当面対象外）。

import { placedCards } from './grid.js';
import { getTerrainData } from './data/terrain-data.js';
import { getVisibility } from './ncm.js';

const DIRS = ['top', 'top_right', 'right', 'bottom_right', 'bottom', 'bottom_left', 'left', 'top_left'];

const OPPOSITE = {
  top: 'bottom', bottom: 'top',
  left: 'right', right: 'left',
  top_left: 'bottom_right', bottom_right: 'top_left',
  top_right: 'bottom_left', bottom_left: 'top_right',
};

// 方向 → (行delta, 列delta)
//
// 方向名は**画面基準**。行番号はスタートエリア側から数える（grid.js の座標系の約束）ので、
//   'top'（画面上＝敵側）    → 行番号 **+1**
//   'bottom'（画面下＝自軍側）→ 行番号 −1
// ※ 以前は行番号が上下逆だったため top が −1 だった。座標系の修正に合わせて符号を反転。
const DIR_DELTA = {
  top: [1, 0], bottom: [-1, 0], left: [0, -1], right: [0, 1],
  top_left: [1, -1], top_right: [1, 1], bottom_left: [-1, -1], bottom_right: [-1, 1],
};

function _coordToRC(coord) {
  const col = coord.charCodeAt(0) - 65; // 'A' = 0
  const row = parseInt(coord.slice(1), 10) - 1;
  return { row, col };
}

function _rcToCoord(row, col) {
  return String.fromCharCode(65 + col) + (row + 1);
}

/**
 * 現在配置されているマップの範囲を placedCards から算出する。
 * §8.4.5 のマップ拡張により行ラベルは 0 や負数にもなりうるため、
 * min/max を実測する（0始まりを仮定しない）。
 */
function _mapDims() {
  let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
  placedCards.forEach(p => {
    const { row, col } = _coordToRC(p.coord);
    minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col);
  });
  return { minRow, maxRow, minCol, maxCol };
}

function _placedAt(coord) {
  return placedCards.find(p => p.coord === coord) ?? null;
}

/**
 * coord の実効地形データと標高を返す。
 * Hill が乗っているカードは、上に重ねて表示される地形（underCardId）を
 * 実効地形として使う（Hill 自体は defense0・LOS全開放で、標高のみ+1する）。
 * @param {string} coord
 * @returns {{ terrain:object|null, elevation:number }}
 */
export function getEffectiveTerrain(coord) {
  const placed = _placedAt(coord);
  if (!placed) return { terrain: null, elevation: 1 };

  if (placed.underCardId) {
    return { terrain: getTerrainData(placed.underCardId), elevation: 2 };
  }
  return { terrain: getTerrainData(placed.cardId), elevation: 1 };
}

/** coord の標高を返す（getEffectiveTerrain のショートカット） */
export function getElevation(coord) {
  return getEffectiveTerrain(coord).elevation;
}

function _inBounds(row, col, dims) {
  return row >= dims.minRow && row <= dims.maxRow && col >= dims.minCol && col <= dims.maxCol;
}

/**
 * coordから指定方向へ1歩進んだ先が、現在の盤面の範囲外になるかどうか。
 * §8.4.5 マップ拡張の要否判定に使う（地形で遮られたのではなく、単に盤面がまだ無い場合を検出する）。
 * @param {string} coord
 * @param {string} dir
 * @returns {boolean}
 */
export function isAtMapEdge(coord, dir) {
  const dims = _mapDims();
  const [dr, dc] = DIR_DELTA[dir];
  const { row, col } = _coordToRC(coord);
  return !_inBounds(row + dr, col + dc, dims);
}

/**
 * 現在の視界モードでの最大レンジ（カード枚数）。
 * 通常時: Very Long Range = 3枚。Limited Visibility: Close Range = 1枚（§9.1）。
 * @returns {number}
 */
export function getMaxRangeCards() {
  return getVisibility() === 0 ? 3 : 1;
}

/**
 * 指定方向への視線が通るカードを、近い順（Close→Long→VeryLong）の配列で返す。
 * @param {string} startCoord
 * @param {string} dir - DIRS のいずれか
 * @returns {string[]} 視線が通るカードの coord 配列（近い順）
 */
export function traceLOSDirection(startCoord, dir) {
  const dims = _mapDims();
  const maxRange = getMaxRangeCards();
  const observerElevation = getElevation(startCoord);
  const [dr, dc] = DIR_DELTA[dir];
  const { row: sr, col: sc } = _coordToRC(startCoord);

  const visible = [];
  let curRow = sr, curCol = sc;

  for (let dist = 1; dist <= maxRange; dist++) {
    const nr = curRow + dr, nc = curCol + dc;
    if (!_inBounds(nr, nc, dims)) break;
    const nextCoord = _rcToCoord(nr, nc);

    if (dist === 1) {
      // Close Range: 境界色に関わらず常に見える
      visible.push(nextCoord);
      curRow = nr; curCol = nc;
      continue;
    }

    // 1つ手前のカード(cur)が「通過対象」。出入り境界が両方 white(true) である必要。
    // los: true=white border（開放）/ false=dark border（遮断）
    const curCoord = _rcToCoord(curRow, curCol);
    const { terrain: curTerrain, elevation: curElevation } = getEffectiveTerrain(curCoord);
    const entryBlocked = curTerrain?.los?.[OPPOSITE[dir]] === false;
    const exitBlocked  = curTerrain?.los?.[dir] === false;

    if (entryBlocked || exitBlocked) {
      // 標高差で dark border を無視できるか（観測者 > 通過カードの標高。同標高は不可）
      if (!(observerElevation > curElevation)) break;
    }

    visible.push(nextCoord);
    curRow = nr; curCol = nc;
  }
  return visible;
}

/**
 * 8方向すべてで視線が通るカードをまとめて返す（重複なし）。
 * @param {string} startCoord
 * @returns {string[]}
 */
export function traceLOSAll(startCoord) {
  const result = new Set();
  DIRS.forEach(dir => traceLOSDirection(startCoord, dir).forEach(c => result.add(c)));
  return [...result];
}

/**
 * 2枚のカード間にLOSが通るか。
 * @param {string} coordA
 * @param {string} coordB
 * @returns {boolean}
 */
export function hasLOS(coordA, coordB) {
  if (coordA === coordB) return true; // Point Blank（同カード）
  return traceLOSAll(coordA).includes(coordB);
}

/**
 * 2枚のカード間の距離（カード枚数。隣接=1、同カード=0）。
 * 8方向の直線上（水平・垂直・斜め45度）にない場合は null。
 * @param {string} coordA
 * @param {string} coordB
 * @returns {number|null}
 */
export function cardDistance(coordA, coordB) {
  const { row: ar, col: ac } = _coordToRC(coordA);
  const { row: br, col: bc } = _coordToRC(coordB);
  const dr = br - ar, dc = bc - ac;
  if (dr === 0 && dc === 0) return 0;
  if (dr === 0) return Math.abs(dc);
  if (dc === 0) return Math.abs(dr);
  if (Math.abs(dr) === Math.abs(dc)) return Math.abs(dr);
  return null;
}
