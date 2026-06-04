// ===== PDF（Primary Direction of Fire）マーカー管理 =====
//
// 配置ルール（ユーザー仕様）:
//   上3方向(NW/N/NE) → カード上辺中央
//   左(W)           → カード左辺中央
//   右(E)           → カード右辺中央
//   下3方向(SW/S/SE) → カード下辺中央
//   画像は方向に合わせて回転
//
// Crossfire 自動検出:
//   PDF が 2方向以上 → 直接射撃 VOF の crossfire を自動で ON/OFF する

import { cardVOFMap, VOF_IS_AREA, renderCardVOF } from './vof.js';

export const cardPDFMap = new Map(); // coord → Set<direction>

// 回転角度（0°=上向き、時計回り）。位置は CSS data-direction で制御。
const PDF_DIRS = {
  'top-left':     { deg: 315 },
  'top':          { deg: 0   },
  'top-right':    { deg: 45  },
  'left':         { deg: 270 },
  'right':        { deg: 90  },
  'bottom-left':  { deg: 225 },
  'bottom':       { deg: 180 },
  'bottom-right': { deg: 135 },
};

export const PDF_LABELS = {
  'top-left': '↖', 'top': '↑', 'top-right': '↗',
  'left': '←',                  'right': '→',
  'bottom-left': '↙', 'bottom': '↓', 'bottom-right': '↘',
};

// PDF トグル（配置 / 除去）
export function togglePDF(coord, direction) {
  if (!cardPDFMap.has(coord)) cardPDFMap.set(coord, new Set());
  const dirs = cardPDFMap.get(coord);
  if (dirs.has(direction)) dirs.delete(direction);
  else                     dirs.add(direction);
  renderCardPDFs(coord);
  checkCrossfire(coord); // PDF 変化のたびに自動判定
}

// PDF 状態を確認
export function hasPDF(coord, direction) {
  return cardPDFMap.get(coord)?.has(direction) ?? false;
}

// カードの全 PDF を除去
export function clearAllPDFs(coord) {
  cardPDFMap.delete(coord);
  renderCardPDFs(coord);
  checkCrossfire(coord); // 全消去後も判定
}

// ===== Crossfire 自動検出 =====
/**
 * 指定カードの PDF 数を見て VOF の crossfire フラグを自動更新する。
 * - 直接射撃 VOF が存在し、PDF が 2方向以上 → crossfire: true
 * - 1方向以下 → crossfire: false
 * - エリアファイア VOF は対象外（ルール上 Crossfire なし）
 * VOF を後から置いたケースに対応するため、card-context-menu.js からも呼ぶこと。
 *
 * @param {string} coord
 */
export function checkCrossfire(coord) {
  const vof = cardVOFMap.get(coord);
  if (!vof || VOF_IS_AREA.has(vof.type)) return; // エリアファイアは対象外

  const dirs       = cardPDFMap.get(coord);
  const pdfCount   = dirs?.size ?? 0;
  const shouldXfire = pdfCount >= 2;

  if (vof.crossfire !== shouldXfire) {
    vof.crossfire = shouldXfire;
    renderCardVOF(coord); // マーカー表示を更新
  }
}

// カード外縁の PDF マーカーを再描画
// ※ カード内 (.card-overlay) ではなく .terrain-card 直接の子にすることで
//    隙間（gap: 28px）エリアに配置できる
export function renderCardPDFs(coord) {
  const card = document.querySelector(`.terrain-card[data-coord="${coord}"]`);
  if (!card) return;

  // 既存マーカーを削除
  card.querySelectorAll('.pdf-marker').forEach(el => el.remove());

  // 活動レベル再計算をトリガ（PDF の増減を捕捉）
  document.dispatchEvent(new CustomEvent('board:changed'));

  const dirs = cardPDFMap.get(coord);
  if (!dirs || dirs.size === 0) return;

  dirs.forEach(dir => {
    const { deg } = PDF_DIRS[dir];
    const img = document.createElement('img');
    img.className = 'pdf-marker';
    img.src = 'images/VOF - PDF.png';
    img.dataset.direction = dir;
    img.style.setProperty('--pdf-rot', `${deg}deg`);
    img.title = `PDF: ${PDF_LABELS[dir]} (${dir})`;
    card.appendChild(img);
  });
}
