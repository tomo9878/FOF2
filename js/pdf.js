// ===== PDF（Primary Direction of Fire）マーカー管理 =====
//
// 配置ルール（ユーザー仕様）:
//   上3方向(NW/N/NE) → カード上辺中央
//   左(W)           → カード左辺中央
//   右(E)           → カード右辺中央
//   下3方向(SW/S/SE) → カード下辺中央
//   画像は方向に合わせて回転

export const cardPDFMap = new Map(); // coord → Set<direction>

// エッジ位置と回転角度（0°=上向き、時計回り）
const PDF_DIRS = {
  'top-left':     { edge: 'top',    deg: 315 },
  'top':          { edge: 'top',    deg: 0   },
  'top-right':    { edge: 'top',    deg: 45  },
  'left':         { edge: 'left',   deg: 270 },
  'right':        { edge: 'right',  deg: 90  },
  'bottom-left':  { edge: 'bottom', deg: 225 },
  'bottom':       { edge: 'bottom', deg: 180 },
  'bottom-right': { edge: 'bottom', deg: 135 },
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
}

// PDF 状態を確認
export function hasPDF(coord, direction) {
  return cardPDFMap.get(coord)?.has(direction) ?? false;
}

// カードの全 PDF を除去
export function clearAllPDFs(coord) {
  cardPDFMap.delete(coord);
  renderCardPDFs(coord);
}

// カード上の PDF マーカーを再描画
export function renderCardPDFs(coord) {
  const overlay = document.querySelector(`.terrain-card[data-coord="${coord}"] .card-overlay`);
  if (!overlay) return;

  // 既存マーカーを削除
  overlay.querySelectorAll('.pdf-marker').forEach(el => el.remove());

  const dirs = cardPDFMap.get(coord);
  if (!dirs || dirs.size === 0) return;

  dirs.forEach(dir => {
    const { edge, deg } = PDF_DIRS[dir];
    const img = document.createElement('img');
    img.className = 'pdf-marker';
    img.src = 'images/VOF - PDF.png';
    img.dataset.direction = dir;
    img.style.setProperty('--pdf-rot', `${deg}deg`);
    img.title = `PDF: ${PDF_LABELS[dir]} (${dir})`;
    overlay.appendChild(img);
  });
}
