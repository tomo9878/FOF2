// ===== VOF（Volume of Fire）マーカー管理 =====
//
// cardVOFMap: coord → { type: 'S'|'A'|'H'|'P', crossfire: boolean }
//
// カード単位で配置できる VOF タイプ:
//   type  NCM修正値  画像
//   S      +0       VOF - S.png
//   A      -1       VOF - A.png
//   H      -3       VOF - H.png
//   P      +2       VOF - P.png  ← 攻撃側が全員Pinned（最弱）
//   Crossfire      VOF - Crossfire.png（-1追加）
//
// ※ S!（Sniper）はユニット駒単位で処理するためカードメニューには含まない。
//    VOF_NCM には定義済み（将来のユニット単位処理で使用）。

export const cardVOFMap = new Map();

export const VOF_NCM = { 'S': 0, 'A': -1, 'H': -3, 'P': +2, 'S!': -3 };

// VOF タイプをセット（既存があれば上書き）
export function setVOFType(coord, type) {
  const existing = cardVOFMap.get(coord);
  if (existing) {
    existing.type = type;
  } else {
    cardVOFMap.set(coord, { type, crossfire: false });
  }
  renderCardVOF(coord);
}

// VOF 除去
export function clearVOF(coord) {
  cardVOFMap.delete(coord);
  renderCardVOF(coord);
}

// Crossfire トグル（VOF がある場合のみ）
export function toggleCrossfire(coord) {
  const vof = cardVOFMap.get(coord);
  if (!vof) return;
  vof.crossfire = !vof.crossfire;
  renderCardVOF(coord);
}

// 現在の VOF を取得
export function getVOF(coord) {
  return cardVOFMap.get(coord) ?? null;
}

// NCM を計算（地形防御値は別途加算する想定）
export function getNCM(coord, terrainDef = 0) {
  const vof = getVOF(coord);
  if (!vof) return null;
  let ncm = VOF_NCM[vof.type] + terrainDef;
  if (vof.crossfire) ncm -= 1;
  return ncm;
}

// カード上の VOF マーカーを再描画
export function renderCardVOF(coord) {
  const overlay = document.querySelector(`.terrain-card[data-coord="${coord}"] .card-overlay`);
  if (!overlay) return;

  // 既存の動的 VOF マーカーを削除
  overlay.querySelectorAll('.vof-marker-img, .xfire-marker-img').forEach(el => el.remove());

  const vof = cardVOFMap.get(coord);
  if (!vof) return;

  // VOF タイプ画像
  const vofImg = document.createElement('img');
  vofImg.className = 'vof-marker-img';
  vofImg.src = `images/VOF - ${vof.type}.png`;
  const ncmVal = VOF_NCM[vof.type];
  vofImg.title = `VOF: ${vof.type}  NCM ${ncmVal >= 0 ? '+' : ''}${ncmVal}`;
  overlay.appendChild(vofImg);

  // Crossfire マーカー（VOF 画像の右隣）
  if (vof.crossfire) {
    const xfireImg = document.createElement('img');
    xfireImg.className = 'xfire-marker-img';
    xfireImg.src = 'images/VOF - Crossfire.png';
    xfireImg.title = 'Crossfire  NCM -1';
    overlay.appendChild(xfireImg);
  }
}
