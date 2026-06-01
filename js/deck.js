// ===== アクションカード デッキ管理モジュール =====
//
// map.js（UIカード引きボタン）と combat.js（戦闘解決カード引き）の
// 両方が同一デッキを共有できるよう、ここで一元管理する。

import { ACTION_CARDS, shuffle } from './data/cards.js';

let _deck = shuffle([...ACTION_CARDS]);
let _idx  = 0;

/**
 * デッキからカードを1枚引いて返す。
 * 山が尽きたら自動でシャッフル・リセットする。
 * @returns {object} ACTION_CARDS の要素（number/file/activated/initiative/type/combat/hit）
 */
export function drawActionCard() {
  if (_idx >= _deck.length) {
    _idx  = 0;
    _deck = shuffle([...ACTION_CARDS]);
  }
  return _deck[_idx++];
}

/**
 * 山に残っているカード枚数を返す。
 * @returns {number}
 */
export function getDeckCount() {
  return _deck.length - _idx;
}

/**
 * デッキをリセット（シャッフルして最初から）。
 * シナリオリセット時などに使用。
 */
export function resetDeck() {
  _deck = shuffle([...ACTION_CARDS]);
  _idx  = 0;
}
