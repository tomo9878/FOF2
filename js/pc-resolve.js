// ===== PC（Potential Contact）解決エンジン =====
//
// ルールブック §8.2.4 "Resolving PC Markers" の手順を実装する。
// ここでは「接触するかどうか」だけを判定する（§8.3 の敵パッケージ決定は別途）。
//
// 手順:
//   1. PCマーカーが "?" 側なら解決開始時に表にする
//   2. マーカーの文字(A/B/C) × 現在の活動レベル → PC_DRAW_CHART（pc.js）
//        'auto' → カードを引かず接触成立
//        N      → アクションカードを N 枚引き、type==='contact' が1枚でもあれば接触
//   3. 結果に関わらず PC マーカーを除去し、活動レベルを再計算する
//
// カードを引く操作は必ず人間が行う（1枚ずつ・combat.js の resolveStep1/2 と同じ方針）。
// 対象は「友軍ユニットがいる、PCマーカー付きのカード」のみ（§8.2.4）。

import { getPC, getPCDraw, clearPC, revealPC } from './pc.js';
import { drawActionCard } from './deck.js';
import { getActivityLevel } from './contact.js';
import { unitCoordMap } from './state.js';

/** そのカードに友軍ユニットが1体以上いるか */
function _hasFriendlyUnit(coord) {
  let found = false;
  unitCoordMap.forEach((c, unitId) => {
    if (found || c !== coord) return;
    const slot = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
    if (slot?.dataset.faction === 'friendly') found = true;
  });
  return found;
}

/**
 * このカードで PC 解決が可能か判定する（PCマーカー必須 + 友軍ユニット必須）。
 * ボタンの有効/無効表示に使う。マーカーが "?" 側でも文字は分からないため、
 * 表示上は revealed のみ返し、実際のドロー枚数は解決開始後に確定する。
 * @param {string} coord
 * @returns {{letter:string, revealed:boolean}|null}
 */
export function getPCResolutionPlan(coord) {
  const pc = getPC(coord);
  if (!pc) return null;
  if (!_hasFriendlyUnit(coord)) return null;
  return { letter: pc.letter, revealed: pc.revealed };
}

/**
 * PC解決を開始する。"?" 側なら表にしてから、文字×活動レベルでドロー内容を決める。
 * @param {string} coord
 * @returns {{letter:string, drawSpec:'auto'|number}|null}
 */
export function startPCResolution(coord) {
  const pc = getPC(coord);
  if (!pc) return null;
  if (!pc.revealed) revealPC(coord);
  const drawSpec = getPCDraw(pc.letter, getActivityLevel());
  return { letter: pc.letter, drawSpec };
}

/**
 * ドロー1回分: カードを1枚引いて Contact タイプか判定する。
 * @returns {{card:object, isContact:boolean}}
 */
export function resolvePCDrawStep() {
  const card = drawActionCard();
  return { card, isContact: card.type === 'contact' };
}

/**
 * 解決を確定する: PCマーカーを除去し、活動レベル再計算をトリガーする。
 * @param {string} coord
 */
export function finishPCResolution(coord) {
  clearPC(coord);
  document.dispatchEvent(new CustomEvent('board:changed'));
}
