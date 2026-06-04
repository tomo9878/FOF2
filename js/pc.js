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

// ===== PC ドローチャート（§8.2.4 / ヒントカード#52）=====
//
// PC マーカー解決時に「接触チェックのため引くアクションカード枚数」を
// マーカーの文字 × 現在の活動レベルで決める。
//   'auto' = カードを引かず自動で接触成立
//   数値 N = アクションカードを N 枚引き、'Contact' の語があるカードが出れば接触
//
//        | 接触なし | 接触 | 交戦 | 激戦 |
//   A    |  Auto   |  7  |  5  |  3  |
//   B    |  Auto   |  5  |  3  |  2  |
//   C    |   4     |  3  |  2  |  1  |
export const PC_DRAW_CHART = {
  A: { no_contact: 'auto', contact: 7, engaged: 5, heavily_engaged: 3 },
  B: { no_contact: 'auto', contact: 5, engaged: 3, heavily_engaged: 2 },
  C: { no_contact: 4,      contact: 3, engaged: 2, heavily_engaged: 1 },
};

/**
 * PC マーカーの文字と活動レベルから、接触チェックの内容を返す。
 * @param {'A'|'B'|'C'} letter
 * @param {'no_contact'|'contact'|'engaged'|'heavily_engaged'} activityLevel
 * @returns {'auto'|number|null} 'auto'=自動接触 / N=引く枚数 / null=不正
 */
export function getPCDraw(letter, activityLevel) {
  return PC_DRAW_CHART[letter]?.[activityLevel] ?? null;
}

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
