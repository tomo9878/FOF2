// ===== カード右クリック コンテキストメニュー（VOF + PDF配置）=====
import { togglePDF, hasPDF, clearAllPDFs } from './pdf.js';
import { setVOFType, clearVOF, toggleCrossfire, getVOF } from './vof.js';

let _currentCoord = null;

export function showCardContextMenu(e, coord) {
  _currentCoord = coord;
  const menu = document.getElementById('cardContextMenu');
  document.getElementById('cardCmCoord').textContent = `カード ${coord}`;
  _refreshVOFButtons(coord);
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

// ===== VOF ボタン状態更新 =====
function _refreshVOFButtons(coord) {
  const vof = getVOF(coord);

  // タイプボタン（現在のタイプをハイライト）
  document.querySelectorAll('.vof-type-btn').forEach(btn => {
    btn.classList.toggle('active', vof?.type === btn.dataset.vof);
  });

  // Crossfire ボタン
  const xfireBtn = document.getElementById('cardCmXfire');
  if (xfireBtn) {
    xfireBtn.classList.toggle('active', !!vof?.crossfire);
    xfireBtn.disabled = !vof; // VOF なしは操作不可
  }

  // VOF 除去ボタン
  const clearVofBtn = document.getElementById('cardCmClearVOF');
  if (clearVofBtn) clearVofBtn.disabled = !vof;
}

// ===== PDF ボタン状態更新 =====
function _refreshPDFButtons(coord) {
  document.querySelectorAll('.pdf-dir-btn').forEach(btn => {
    btn.classList.toggle('active', hasPDF(coord, btn.dataset.dir));
  });
}

// ===== 初期化（イベントリスナー登録）=====
export function initCardContextMenu() {
  // ── VOF タイプボタン（同じタイプを再クリックで除去）──
  document.querySelectorAll('.vof-type-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!_currentCoord) return;
      const type = btn.dataset.vof;
      const vof = getVOF(_currentCoord);
      if (vof?.type === type) {
        clearVOF(_currentCoord);     // 同タイプをクリック → 除去
      } else {
        setVOFType(_currentCoord, type); // 新タイプをセット
      }
      _refreshVOFButtons(_currentCoord);
    });
  });

  // ── Crossfire トグル ──
  document.getElementById('cardCmXfire')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!_currentCoord || !getVOF(_currentCoord)) return;
    toggleCrossfire(_currentCoord);
    _refreshVOFButtons(_currentCoord);
  });

  // ── VOF 除去 ──
  document.getElementById('cardCmClearVOF')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!_currentCoord) return;
    clearVOF(_currentCoord);
    _refreshVOFButtons(_currentCoord);
  });

  // ── PDF 方向ボタン（メニューを閉じずに連続配置可能）──
  document.querySelectorAll('.pdf-dir-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!_currentCoord) return;
      togglePDF(_currentCoord, btn.dataset.dir);
      _refreshPDFButtons(_currentCoord);
    });
  });

  // ── VOF / PDF すべて除去 ──
  document.getElementById('cardCmClearAll')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_currentCoord) {
      clearVOF(_currentCoord);
      clearAllPDFs(_currentCoord);
      _refreshVOFButtons(_currentCoord);
      _refreshPDFButtons(_currentCoord);
      hideCardContextMenu();
    }
  });

  // ── 外クリックで閉じる ──
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('cardContextMenu');
    if (menu && menu.style.display !== 'none' && !menu.contains(e.target)) {
      hideCardContextMenu();
    }
  });
}
