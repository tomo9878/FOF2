// ===== ズーム =====
// グリッドの実サイズ（padding含む）：テレイン3行 + 区切り28px + スタートエリア1行、gap×4
export const GRID_W = 4 * 210 + 3 * 28 + 64;
export const GRID_H = 3 * 276 + 28 + 276 + 4 * 28 + 64; // = 1308px
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
let currentZoom = 1.0;

export function applyZoom(z, pivotX, pivotY) {
  const mapArea = document.getElementById('mapArea');
  const wrapper = document.getElementById('zoomWrapper');
  const scroll = document.getElementById('scrollContent');

  // ズーム前のスクロール位置を記録（ピボット基準）
  const px = pivotX !== undefined ? pivotX : mapArea.clientWidth / 2;
  const py = pivotY !== undefined ? pivotY : mapArea.clientHeight / 2;
  const beforeContentX = (mapArea.scrollLeft + px) / currentZoom;
  const beforeContentY = (mapArea.scrollTop  + py) / currentZoom;

  currentZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  // wrapper をスケール（top-left 起点）
  wrapper.style.transform = `scale(${currentZoom})`;

  // scroll-content のサイズをスケール後の実サイズに合わせる
  const scaledW = Math.max(GRID_W * currentZoom, mapArea.clientWidth);
  const scaledH = Math.max(GRID_H * currentZoom, mapArea.clientHeight);
  scroll.style.width  = scaledW + 'px';
  scroll.style.height = scaledH + 'px';

  // ピボット点が画面上の同じ位置に来るようスクロール調整
  mapArea.scrollLeft = beforeContentX * currentZoom - px;
  mapArea.scrollTop  = beforeContentY * currentZoom - py;

  // UI更新
  document.getElementById('zoomLabel').textContent = Math.round(currentZoom * 100) + '%';
  document.getElementById('zoomSlider').value = Math.round(currentZoom * 100);
}

export function changeZoom(delta) { applyZoom(currentZoom + delta); }
export function setZoom(val) { applyZoom(parseFloat(val)); }

export function resetZoom() {
  const area = document.getElementById('mapArea');
  applyZoom(calcFitZoom());
  // フィット後に中央へ
  setTimeout(() => {
    area.scrollLeft = (area.scrollWidth - area.clientWidth) / 2;
    area.scrollTop  = (area.scrollHeight - area.clientHeight) / 2;
  }, 50);
}

export function calcFitZoom() {
  const area = document.getElementById('mapArea');
  return Math.min(area.clientWidth / GRID_W, area.clientHeight / GRID_H) * 0.95;
}

export function initZoom() {
  // ホイールでズーム（マウス位置を中心に）
  document.getElementById('mapArea').addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = document.getElementById('mapArea').getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    applyZoom(currentZoom + (e.deltaY < 0 ? 0.08 : -0.08), px, py);
  }, { passive: false });

  // リサイズ時にフィットズームを再適用
  window.addEventListener('resize', () => applyZoom(calcFitZoom()));
}
