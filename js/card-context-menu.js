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
import { getPCResolutionPlan, startPCResolution, resolvePCDrawStep, finishPCResolution } from './pc-resolve.js';
import { resolveEnemyContactType } from './enemy-contact.js';
import { resolveDirection, placeResolvedUnits } from './enemy-placement.js';
import { isDrawLocked, setDrawLock } from './context-menu.js';
import {
  phoneLineMap, getPhoneLineStock, isStagingArea,
  layPhoneLine, removePhoneLine, cutPhoneLine,
  canRepairPhoneLine, repairPhoneLineAction,
} from './phone.js';
import { droppedRTMap, canPickUpRT, pickUpRT } from './comm.js';
import { unitCoordMap, getUnitState, renderUnitBadges } from './state.js';
import { UNITS } from './data/units-normandy.js';

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
  _refreshPCButton(coord);
  _refreshPhoneLineSection(coord);
  _refreshDroppedRTSection(coord);

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

// ===== 落ちている RT（§4.2.2h Pick up）=====
function _refreshDroppedRTSection(coord) {
  const sec  = document.getElementById('cardCmRTSection');
  const info = document.getElementById('cardCmRTInfo');
  const sel  = document.getElementById('cardCmRTPicker');
  const btn  = document.getElementById('cardCmRTPickUp');
  if (!sec) return;

  const dropped = droppedRTMap.get(coord) ?? [];
  if (!dropped.length) { sec.style.display = 'none'; return; }
  sec.style.display = '';
  if (info) info.textContent = `（${dropped.map(r => r.model).join(', ')}）`;

  // 拾える駒＝そのカードにいる Good Order のユニット
  const pickers = [...unitCoordMap].filter(([id, c]) => c === coord && !getUnitState(id).pinned)
    .map(([id]) => id);
  if (sel) {
    sel.innerHTML = pickers.map(id => `<option value="${id}">${_unitLabelOf(id)}</option>`).join('');
  }
  const first = pickers[0];
  const check = first ? canPickUpRT(first, coord) : { ok: false, reason: 'そのカードに拾える駒がいない' };
  if (btn) {
    btn.disabled = !check.ok;
    btn.title = check.ok
      ? `§4.2.2h 拾う（${check.originatorId} が1コマンド消費・拾った駒は Exposed）`
      : `拾えない: ${check.reason}`;
  }
}

/** ユニットIDの表示名 */
function _unitLabelOf(unitId) {
  for (const arr of Object.values(UNITS)) {
    const u = arr.find(x => x.id === unitId);
    if (u) return u.label;
  }
  return unitId;
}

// ===== 電話線セクション（§4.3.4）=====
//
// 敷設は本来「電話線を割り当てられたユニットがカードを離れるときに自動で1本置く」
// （命令不要・§4.3.4）。移動フックはまだ無いので、当面は手動で置く/回収する。
function _refreshPhoneLineSection(coord) {
  const stockEl  = document.getElementById('cardCmPhoneStock');
  const layBtn   = document.getElementById('cardCmPhoneLay');
  const cutBtn   = document.getElementById('cardCmPhoneCut');
  const repBtn   = document.getElementById('cardCmPhoneRepair');
  const rmBtn    = document.getElementById('cardCmPhoneRemove');
  if (!layBtn) return;

  const line = phoneLineMap.get(coord);
  if (stockEl) stockEl.textContent = `（残り ${getPhoneLineStock()}本）${line ? (line.cut ? ' — このカード: 切断' : ' — このカード: 敷設済み') : ''}`;
  layBtn.disabled = !!line || getPhoneLineStock() <= 0 || isStagingArea(coord);
  cutBtn.disabled = !line || line.cut;
  rmBtn.disabled  = !line;
  // §4.2.1k: 同カードの HQ/Staff が1コマンド払い、同カードの Good Order ユニットが直す
  const rep = canRepairPhoneLine(coord);
  repBtn.disabled = !rep.ok;
  repBtn.title = rep.ok
    ? `§4.2.1k 修理（${rep.originatorId} が1コマンド消費 / 実行: ${rep.recipientId}）`
    : `修理不可: ${rep.reason}`;
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

// ===== PC（Potential Contact）解決ボタン =====
function _refreshPCButton(coord) {
  const btn = document.getElementById('cardCmPCResolve');
  if (!btn) return;
  const plan = getPCResolutionPlan(coord);
  btn.disabled = !plan;
  btn.style.background  = plan ? '#3a2a1a' : '#2a2a1a';
  btn.style.borderColor = plan ? '#8a6a2a' : '#4a4a2a';
  btn.style.color       = plan ? '#d4a05a' : '#8a8a6a';
  btn.textContent = plan
    ? `❓ PC解決: ${plan.letter}${plan.revealed ? '' : '（?側）'}`
    : '❓ PC解決（対象なし）';
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

  // ── 電話線（§4.3.4）──
  const phoneAction = (fn) => (e) => {
    e.stopPropagation();
    if (!_currentCoord) return;
    fn(_currentCoord);
    _refreshPhoneLineSection(_currentCoord);
    document.dispatchEvent(new CustomEvent('board:changed'));
  };
  // ── 落ちている RT を拾う（§4.2.2h）──
  document.getElementById('cardCmRTPickUp')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!_currentCoord) return;
    const sel = document.getElementById('cardCmRTPicker');
    const r = pickUpRT(sel?.value, _currentCoord, 0);
    if (!r.ok) return;
    renderUnitBadges(sel.value);            // Exposed バッジを反映
    _refreshDroppedRTSection(_currentCoord);
    document.dispatchEvent(new CustomEvent('board:changed'));
  });

  document.getElementById('cardCmPhoneLay')?.addEventListener('click', phoneAction(layPhoneLine));
  document.getElementById('cardCmPhoneCut')?.addEventListener('click', phoneAction(cutPhoneLine));
  document.getElementById('cardCmPhoneRepair')?.addEventListener('click', phoneAction(repairPhoneLineAction));
  document.getElementById('cardCmPhoneRemove')?.addEventListener('click', phoneAction(removePhoneLine));

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

  // ── PC解決ボタン ──
  document.getElementById('cardCmPCResolve')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!_currentCoord) return;
    _startPCFlow(_currentCoord);
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

// ===== PC解決ステップ制フロー（§8.2.4） =====
//
// 設計方針: カードを引く操作は必ず人間が行う（combat.js の resolveStep1/2 と同じ）。
// 'auto' 判定はドロー不要のため確認ボタン1回で確定する。

/** 現在進行中のPC解決ステート（null = 未実行）*/
let _pcState = null;

function _startPCFlow(coord) {
  const start = startPCResolution(coord);
  if (!start) return;

  _pcState = (start.drawSpec === 'auto')
    ? { coord, letter: start.letter, mode: 'auto', step: 'ready' }
    : { coord, letter: start.letter, mode: 'draw', drawsNeeded: start.drawSpec, drawsDone: 0, contactFound: false, cards: [], step: 'ready' };

  setDrawLock(true);
  hideCardContextMenu();
  _renderPCPanel();
}

function _renderPCPanel() {
  const el = document.getElementById('rpUnitInfo');
  if (!el || !_pcState) return;

  const { coord, letter, mode, step } = _pcState;
  let html = `<div class="rp-unit-name">❓ PC解決 — ${coord}（${letter}）</div>`;

  if (mode === 'auto') {
    if (step === 'ready') {
      html += `
        <div class="rp-cs-card">現在の活動レベルでは Auto（自動接触）</div>
        <button class="rp-draw-btn" id="pcResolveBtn">✓ 接触成立を確定</button>
      `;
    } else {
      html += `<div class="rp-cs-effect">⚠ 接触成立！</div>`;
      html += _typeStepHtml(_pcState);
    }
  } else {
    const { drawsNeeded, drawsDone, contactFound, cards } = _pcState;
    html += `<div class="rp-cs-ncm">ドロー ${drawsDone} / ${drawsNeeded}</div>`;
    html += cards.map(c => `
      <div class="rp-cs-card">カード #${c.number}${c.type === 'contact' ? ' → <b>Contact!</b>' : ''}</div>
    `).join('');

    if (step === 'ready') {
      html += `<button class="rp-draw-btn" id="pcDrawBtn">🃏 カードを引く</button>`;
    } else if (!contactFound) {
      html += `<div class="rp-cs-done" style="color:#7ab4d4">接触なし</div><div class="rp-cs-done">✓ 解決完了</div>`;
    } else {
      html += `<div class="rp-cs-effect">⚠ 接触成立！</div>`;
      html += _typeStepHtml(_pcState);
    }
  }

  el.innerHTML = html.trim();
  document.getElementById('pcResolveBtn')?.addEventListener('click', _onPCAutoConfirm);
  document.getElementById('pcDrawBtn')?.addEventListener('click', _onPCDraw);
  document.getElementById('pcTypeDrawBtn')?.addEventListener('click', _onPCTypeDraw);
  document.getElementById('pcPlaceBtn')?.addEventListener('click', _onPlaceUnits);
}

/** 接触成立後（§8.3種類判定→§8.4配置）のステップ表示 */
function _typeStepHtml(state) {
  if (state.step === 'contact_made') {
    return `<button class="rp-draw-btn" id="pcTypeDrawBtn">🃏 カードを引く（種類判定 §8.3）</button>`;
  }

  let html = _enemyTypeHtml(state.enemyType);
  if (state.step === 'type_resolved') {
    html += `<button class="rp-draw-btn" id="pcPlaceBtn">🃏 カードを引く（配置方向 §8.4.2）</button>`;
  } else if (state.step === 'done') {
    html += _placementsHtml(state.direction, state.placements);
    html += `<div class="rp-cs-done">✓ 解決完了</div>`;
  }
  return html;
}

/** §8.4 配置結果（方向判定＋各ユニットの配置可否）を表示用HTMLに変換する */
function _placementsHtml(direction, placements) {
  if (!direction?.direction || !placements) return '';
  const dirLabel = { front: 'Front', left_front: 'Left Front', right_front: 'Right Front' }[direction.direction]
    ?? direction.direction;
  let html = `
    <div class="rp-cs-card">
      方向判定: カード #${direction.card.number} → R#${direction.r} → <b>${dirLabel}</b>
    </div>
  `;
  html += placements.map(p => {
    if (p.placed) {
      const detail = p.unitId
        ? `${p.label ?? p.unitId} を ${p.coord}（距離${p.distance}）に配置`
        : `${p.vofType} マーカーを ${p.coord}（距離${p.distance}）に配置`;
      return `<div class="rp-cs-card" style="color:#7ad47a">✓ ${p.name}: ${detail}</div>`;
    }
    const where = p.coord ? `（推定 ${p.coord}）` : '';
    return `<div class="rp-cs-card" style="color:#d4a05a">△ ${p.name}: ${p.reason ?? '未配置'}${where}</div>`;
  }).join('');
  return html;
}

/** choiceResults（武器種別・FO種別等の追加判定）を表示用HTMLに変換する */
function _choiceResultsHtml(choiceResults) {
  if (!choiceResults) return '';
  const entries = Object.entries(choiceResults).filter(([, r]) => r?.value);
  if (entries.length === 0) return '';
  const rows = entries.map(([key, r]) => {
    const cardNote = r.card ? ` (カード #${r.card.number} → R#${r.r})` : '';
    return `<div class="rp-cs-card">追加判定 [${key}] → <b>${r.value}</b>${cardNote}</div>`;
  }).join('');
  return rows;
}

/** §8.3 判定結果を表示用HTMLに変換する */
function _enemyTypeHtml(enemyType) {
  if (!enemyType) return '';
  const pkg = enemyType.package;
  const cardLabel = `カード #${enemyType.card.number} → R#${enemyType.r}`;
  if (!pkg) return `<div class="rp-cs-card">${cardLabel} → 該当パッケージなし</div>`;
  return `
    <div class="rp-cs-card">
      ${cardLabel} → <b>#${pkg.id} ${pkg.label}</b>（${pkg.detail}）
    </div>
    <div class="rp-cs-card">${pkg.placement}</div>
    ${_choiceResultsHtml(enemyType.choiceResults)}
  `;
}

function _onPCAutoConfirm() {
  if (!_pcState || _pcState.mode !== 'auto' || _pcState.step !== 'ready') return;
  finishPCResolution(_pcState.coord);
  _pcState.step = 'contact_made'; // 接触成立 → 続けて§8.3の種類判定ドローへ
  _renderPCPanel();
}

function _onPCDraw() {
  if (!_pcState || _pcState.mode !== 'draw' || _pcState.step !== 'ready') return;

  const { card, isContact } = resolvePCDrawStep();
  _pcState.cards.push(card);
  _pcState.drawsDone++;
  if (isContact) _pcState.contactFound = true;

  if (_pcState.drawsDone >= _pcState.drawsNeeded) {
    finishPCResolution(_pcState.coord);
    _pcState.step = _pcState.contactFound ? 'contact_made' : 'done';
    if (!_pcState.contactFound) setDrawLock(false); // 接触なし→ここでロック解除して終了
  }
  _renderPCPanel();
}

/** §8.3 種類判定ドロー（接触成立後、人間がボタンを押して1枚引く） */
function _onPCTypeDraw() {
  if (!_pcState || _pcState.step !== 'contact_made') return;
  _pcState.enemyType = resolveEnemyContactType(_pcState.letter);
  if (_pcState.enemyType?.package) {
    _pcState.step = 'type_resolved'; // 続けて§8.4配置（方向ドロー）へ
  } else {
    _pcState.step = 'done'; // 該当パッケージなし → ここで終了
    setDrawLock(false);
  }
  _renderPCPanel();
}

/** §8.4 配置ドロー（方向R#を1枚引き、距離解決とあわせて実際に配置する） */
function _onPlaceUnits() {
  if (!_pcState || _pcState.step !== 'type_resolved') return;
  const direction = resolveDirection();
  _pcState.direction = direction;
  _pcState.placements = direction.direction
    ? placeResolvedUnits(_pcState.coord, direction.direction, _pcState.enemyType.resolvedUnits)
    : [];
  _pcState.step = 'done';
  setDrawLock(false);
  _renderPCPanel();
}
