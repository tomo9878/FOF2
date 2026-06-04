// ===== PC（Potential Contact）マーカー管理 =====
//
// シナリオ指示に従って盤面に配置する潜在接触マーカー。
// letter(A/B/C) を表で見せるか、? 側（裏）で隠すかを持つ。
//   A = 最も severe（敵が濃い） / C = 最も穏やか
//
// 解決（§8.2.4 ドローチャート: ヒントカード#52）は別途実装する。
// PC マーカー自体は活動レベルには影響しない（活動レベルは占有下VOF/Spotted敵のみ）。

export const cardPCMap = new Map(); // coord → { letter:'A'|'B'|'C', revealed:bool }

const PC_IMG     = { A: 'PC A.png', B: 'PC B.png', C: 'PC C.png' };
const PC_UNKNOWN = 'PC Q.png';

/**
 * PC マーカーを配置する。
 * @param {string} coord
 * @param {'A'|'B'|'C'} letter
 * @param {boolean} revealed - true: 文字を表示 / false: ?（裏）で隠す
 */
export function placePC(coord, letter, revealed = true) {
  cardPCMap.set(coord, { letter, revealed });
  renderCardPC(coord);
}

export function clearPC(coord) {
  cardPCMap.delete(coord);
  renderCardPC(coord);
}

export function getPC(coord) {
  return cardPCMap.get(coord) ?? null;
}

/** ? 側を表（文字）に開く */
export function revealPC(coord) {
  const pc = cardPCMap.get(coord);
  if (pc) { pc.revealed = true; renderCardPC(coord); }
}

export function renderCardPC(coord) {
  const overlay = document.querySelector(`.terrain-card[data-coord="${coord}"] .card-overlay`);
  if (!overlay) return;
  overlay.querySelectorAll('.pc-marker-img').forEach(el => el.remove());

  const pc = cardPCMap.get(coord);
  if (!pc) return;

  const img = document.createElement('img');
  img.className = 'pc-marker-img';
  img.src   = `images/${pc.revealed ? (PC_IMG[pc.letter] ?? PC_UNKNOWN) : PC_UNKNOWN}`;
  img.title = `Potential Contact: ${pc.revealed ? pc.letter : '?'}`;
  overlay.appendChild(img);
}
