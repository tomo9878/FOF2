// ===== 地形カード補充（§8.4.5 Map Expansion 用）=====
//
// マップ外への敵配置が必要になったとき、盤面拡張のために地形カードを1枚引く。
// 初期配置の55枚デッキとは別に「今すでに盤面にある地形」を除いた残りから
// ランダムに1枚選ぶ簡易実装（物理ゲームの「1つの山を最後まで使い切る」を
// 厳密に再現するものではないが、同じカードが盤面に重複しにくくなる）。

import { TERRAIN_CARDS, shuffle } from './data/cards.js';
import { placedCards } from './grid.js';

/**
 * 盤面拡張用に地形カードを1枚引く。
 * @returns {object} TERRAIN_CARDS の要素
 */
export function drawTerrainCardForExpansion() {
  const usedIds = new Set(
    placedCards.flatMap(p => [p.cardId, p.underCardId].filter(Boolean))
  );
  const available = TERRAIN_CARDS.filter(c => !usedIds.has(c.id));
  const pool = available.length > 0 ? available : TERRAIN_CARDS; // 万一尽きたら全体から
  return shuffle(pool)[0];
}
