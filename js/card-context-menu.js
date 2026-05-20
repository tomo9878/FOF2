// ===== カード右クリック コンテキストメニュー（PDF配置）=====
import { togglePDF, hasPDF, clearAllPDFs, PDF_LABELS } from './pdf.js';

let _currentCoord = null;

export function showCardContextMenu(e, coord) {
  _currentCoord = coord;
  const menu = document.getElementById('cardContextMenu');
  document.getElementById('cardCmCoord').textContent = `カード ${coord}`;
  _refreshPDFButtons(coord);

  menu.style.display = 'block';
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let x = e.clientX, y = e.clientY;
  if (x + mw > window.innerWidth  - 8) x = window.innerWidth  - mw - 8;
  if (y + mh > window.innerHeight - 8) y = window.innerHeight - mh - 8;
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
}

export function hideCardContextMenu() {
  const menu = document.getElementById('cardContextMenu');
  if (menu) menu.style.display = 'none';
  _currentCoord = null;
}

function _refreshPDFButtons(coord) {
  document.querySelectorAll('.pdf-dir-btn').forEach(btn => {
    const dir = btn.dataset.dir;
    btn.classList.toggle('active', hasPDF(coord, dir));
  });
}

export function initCardContextMenu() {
  // 方向ボタン：クリックでトグル（メニューは閉じない→複数方向を連続配置可能）
  document.querySelectorAll('.pdf-dir-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!_currentCoord) return;
      togglePDF(_currentCoord, btn.dataset.dir);
      _refreshPDFButtons(_currentCoord);
    });
  });

  // 全除去
  document.getElementById('cardCmClearPDF').addEventListener('click', (e) => {
    e.stopPropagation();
    if (_currentCoord) {
      clearAllPDFs(_currentCoord);
      _refreshPDFButtons(_currentCoord);
      hideCardContextMenu();
    }
  });

  // 外クリックで閉じる
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('cardContextMenu');
    if (menu && menu.style.display !== 'none' && !menu.contains(e.target)) {
      hideCardContextMenu();
    }
  });
}
