// ===== カード右クリック コンテキストメニュー（VOF + PDF配置 + カバースロット）=====
import { togglePDF, hasPDF, clearAllPDFs, checkCrossfire } from './pdf.js';
import {
  setVOFType, clearVOF, toggleCrossfire, toggleConcentrate,
  flipToIncoming, getVOF, VOF_IS_AREA, isPendingVOF,
} from './vof.js';
import { calcNCM, getTerrainDefInfo } from './ncm.js';
import {
  COVER_TYPES,
  getCoverSlots,
  canAddCoverSlot,
  addCoverSlot,
  removeCoverSlot,
} from './cover.js';
import { resolveCombatCard, getUnitIdsOnCard } from './combat.js';

let _currentCoord = null;

export function showCardContextMenu(e, coord) {
  // カード引き中はメニューを開かせない
  if (document.body.dataset.drawLock === 'true') return;

  _currentCoord = coord;
  const menu = document.getElementById('cardContextMenu');
  document.getElementById('cardCmCoord').textContent = `カード ${coord}`;
  _refreshVOFButtons(coord);
  _refreshPDFButtons(coord);
  _refreshNCMDisplay(coord);
  _refreshCoverSection(coord);

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

  // Crossfire ボタン（エリアファイアは不可）
  const xfireBtn = document.getElementById('cardCmXfire');
  if (xfireBtn) {
    xfireBtn.classList.toggle('active', !!vof?.crossfire);
    xfireBtn.disabled = !vof || VOF_IS_AREA.has(vof?.type);
  }

  // Concentrate Fire ボタン
  const concBtn = document.getElementById('cardCmConcentrate');
  if (concBtn) {
    concBtn.classList.toggle('active', !!vof?.concentrate);
    concBtn.disabled = !vof;
  }

  // Flip → Incoming ボタン（Pending タイプのときのみ有効）
  const flipBtn = document.getElementById('cardCmFlipIncoming');
  if (flipBtn) {
    flipBtn.disabled = !vof || !isPendingVOF(vof?.type);
  }

  // VOF 除去ボタン
  const clearVofBtn = document.getElementById('cardCmClearVOF');
  if (clearVofBtn) clearVofBtn.disabled = !vof;

  // 戦闘解決ボタン（VOFあり かつ ユニットがいる場合のみ有効）
  const combatBtn = document.getElementById('cardCmCombatResolve');
  if (combatBtn) {
    const hasUnits = vof && getUnitIdsOnCard(coord).length > 0;
    combatBtn.disabled = !hasUnits;
    combatBtn.style.background    = hasUnits ? '#3a1a0a' : '#3a1a1a';
    combatBtn.style.borderColor   = hasUnits ? '#aa4422' : '#6a2a2a';
    combatBtn.style.color         = hasUnits ? '#ffaa88' : '#cc9988';
  }

  // NCM 表示も更新
  _refreshNCMDisplay(coord);
}

// ===== NCM 表示更新 =====
function _refreshNCMDisplay(coord) {
  const ncmRow = document.getElementById('cardCmNCMRow');
  if (!ncmRow) return;

  const vof = getVOF(coord);
  if (!vof) {
    ncmRow.style.display = 'none';
    return;
  }

  const result = calcNCM(coord, null, false); // Target Status なし（ユニット非選択）
  const terrainInfo = getTerrainDefInfo(coord);

  if (!result) {
    ncmRow.style.display = 'none';
    return;
  }

  ncmRow.style.display = 'block';

  const v = result.value;
  const sign = v >= 0 ? '+' : '';
  const { bestVOF, crossfire, terrainCover } = result.breakdown;

  const cardLabel = terrainInfo.cardId ?? '?';
  const defLabel  = terrainInfo.defHigh === terrainInfo.defLow
    ? `${terrainInfo.defLow}`
    : `${terrainInfo.defLow}/${terrainInfo.defHigh}`;

  const _s = n => (n >= 0 ? '+' : '') + n;
  let parts = [`VOF${_s(bestVOF)}`];
  if (crossfire !== 0)    parts.push(`Xfire${_s(crossfire)}`);
  if (terrainCover !== 0) parts.push(`地形${_s(terrainCover)}`);

  document.getElementById('cardCmNCMValue').textContent = `NCM ${sign}${v}`;
  document.getElementById('cardCmNCMDetail').textContent =
    `${parts.join(' ')}  [${cardLabel} 防御${defLabel}]`;
}

// ===== カバースロット UI 更新 =====
function _refreshCoverSection(coord) {
  const sec = document.getElementById('cardCmCoverSection');
  if (!sec) return;

  const slotList = document.getElementById('cardCmCoverSlots');
  const addRow   = document.getElementById('cardCmCoverAddRow');
  if (!slotList || !addRow) return;

  // 既存スロット表示
  slotList.innerHTML = '';
  const slots = getCoverSlots(coord);
  if (slots.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:10px;color:#666;padding:2px 0;';
    empty.textContent = 'スロットなし';
    slotList.appendChild(empty);
  } else {
    slots.forEach(slot => {
      const ct = COVER_TYPES[slot.type];
      const row = document.createElement('div');
      row.className = 'cover-slot-row';
      row.innerHTML = `
        <span class="cover-slot-label" style="border-color:${ct.color}">
          ${ct.label} +${ct.value}
        </span>
        <span class="cover-slot-count">${slot.unitIds.size}U</span>
        <button class="cover-slot-remove" data-slot="${slot.slotId}">✕</button>
      `;
      row.querySelector('.cover-slot-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeCoverSlot(coord, slot.slotId);
        _refreshCoverSection(coord);
      });
      slotList.appendChild(row);
    });
  }

  // 追加ボタン表示（上限に達したら非表示）
  const canAdd = canAddCoverSlot(coord);
  addRow.style.display = canAdd ? 'flex' : 'none';
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
        checkCrossfire(_currentCoord);   // PDFが先にある場合の自動検出
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

  // ── Concentrate Fire トグル ──
  document.getElementById('cardCmConcentrate')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!_currentCoord || !getVOF(_currentCoord)) return;
    toggleConcentrate(_currentCoord);
    _refreshVOFButtons(_currentCoord);
  });

  // ── Pending → Incoming フリップ ──
  document.getElementById('cardCmFlipIncoming')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!_currentCoord) return;
    flipToIncoming(_currentCoord);
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
      _refreshNCMDisplay(_currentCoord); // PDF 変更で地形判定が変わる可能性あり
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

  // ── カバースロット追加（select + ＋追加ボタン）──
  document.getElementById('cardCmCoverAddBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!_currentCoord) return;
    const sel = document.getElementById('cardCmCoverTypeSelect');
    const type = sel?.value;
    if (!type) return;
    const result = addCoverSlot(_currentCoord, type);
    if (!result) {
      // スロット上限に達している
      sel.style.borderColor = '#cc4444';
      setTimeout(() => { sel.style.borderColor = ''; }, 800);
    }
    _refreshCoverSection(_currentCoord);
  });

  // ── 戦闘解決ボタン ──
  document.getElementById('cardCmCombatResolve')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!_currentCoord) return;
    const results = resolveCombatCard(_currentCoord);
    if (results) {
      _showCombatResults(results);
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

// ===== 戦闘解決結果を右パネルに表示 =====

const HIT_EFFECT_LABELS = {
  A: 'アサルトチーム', F: 'ファイアチーム', L: 'リッター',
  P: 'パラライズ',     C: 'カジュアルティ',
};

function _hitCodeToLabel(code) {
  if (!code) return '—';
  if (code.length === 1) return HIT_EFFECT_LABELS[code] ?? code;
  const l1 = HIT_EFFECT_LABELS[code[0]] ?? code[0];
  const l2 = HIT_EFFECT_LABELS[code[1]] ?? code[1];
  return `${l1} + ${l2}`;
}

function _showCombatResults(results) {
  const el = document.getElementById('rpUnitInfo');
  if (!el) return;

  const unitLabel = (uid) => {
    const slot = document.querySelector(`.unit-slot[data-unit-id="${uid}"]`);
    return slot?.querySelector('.unit-marker')?.alt ?? uid;
  };
  const expLabel = { vet: 'ベテラン', line: 'ライン', green: '新兵' };

  const entries = results.unitResults.map(r => {
    const cls  = r.result.toLowerCase();
    const sign = r.ncm >= 0 ? '+' : '';
    const name = unitLabel(r.unitId);

    let detail = '';
    if (r.result === 'HIT') {
      const expStr = expLabel[r.experience] ?? r.experience;
      detail = `カード #${r.hitCard.number} → <b>${r.hitCode}</b> [${expStr}] ${_hitCodeToLabel(r.hitCode)}`;
    } else if (r.result === 'PIN') {
      detail = 'Pinned マーカー付与';
    } else {
      detail = '効果なし';
    }

    return `
      <div class="combat-result-entry ${cls}">
        <div class="cr-unit-name">${name}</div>
        <div class="cr-ncm">NCM ${sign}${r.ncm}</div>
        <div class="cr-card">カード #${r.card.number} → <span class="cr-result-${cls}">${r.result}</span></div>
        <div class="cr-detail">${detail}</div>
      </div>
    `.trim();
  }).join('');

  el.innerHTML = `
    <div class="rp-unit-name">⚔ 戦闘解決 — ${results.coord}</div>
    ${entries}
  `.trim();
}
