import {
  UNIT_STATES_DEF,
  getUnitState,
  getUnitStrength,
  toggleUnitState,
  clearAllUnitStates,
  getNCMAdjust,
  changeNCMAdjust,
  unitCoordMap,
} from './state.js';
import { hitA, hitF, hitL, hitP, hitC, hitCombo } from './hit.js';
import { detachFireTeam, detachAssaultTeam, detachStep, supplementUnit } from './detach.js';
import { calcNCM } from './ncm.js';
import { cardVOFMap } from './vof.js';
import { resolveCombatUnit } from './combat.js';
import { UNITS } from './data/units-normandy.js';
import {
  COVER_TYPES,
  getCoverSlots,
  getUnitCoverSlot,
  assignUnitToCover,
  removeUnitFromCover,
} from './cover.js';

// ===== コンテキストメニュー制御 =====
export let cmCurrentUnit = null;

export function showContextMenu(e, unit) {
  cmCurrentUnit = unit;
  const menu = document.getElementById('contextMenu');

  document.getElementById('cmUnitName').textContent = unit.label;
  refreshDetachSubmenu(unit);
  refreshHitSubmenu(unit);
  refreshCmToggles(unit.id);
  refreshCoverSubmenu(unit.id);
  refreshNCMDisplay(unit.id);
  refreshNCMAdjustDisplay(unit.id);
  refreshCombatResolveBtn(unit.id);
  updateRightPanelUnit(unit);

  // 一旦表示してサイズ取得
  menu.style.display = 'block';
  const mw = menu.offsetWidth, mh = menu.offsetHeight;

  // 画面端はみ出し防止
  let x = e.clientX, y = e.clientY;
  if (x + mw > window.innerWidth  - 8) x = window.innerWidth  - mw - 8;
  if (y + mh > window.innerHeight - 8) y = window.innerHeight - mh - 8;

  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
}

export function hideContextMenu() {
  document.getElementById('contextMenu').style.display = 'none';
  cmCurrentUnit = null;
}

// ===== Detach Step サブメニュー更新 =====
export function refreshDetachSubmenu(unit) {
  const container = document.getElementById('cmDetachContainer');
  const sub       = document.getElementById('cmDetachSub');

  // squad / weapon_team のみ表示
  const show = unit.type === 'squad' || unit.type === 'weapon_team';
  if (!show) { container.style.display = 'none'; return; }

  // ルール: 戦力低下済み（reduced）は自発的な分割操作不可 → サブメニュー非表示
  const s = getUnitStrength(unit.id);
  const isReduced = s && s.steps < s.maxSteps;
  container.style.display = isReduced ? 'none' : 'block';
  if (isReduced) return;

  sub.innerHTML = '';

  if (unit.fireteam) {
    addDetachMenuItem(sub, '🔫 Fire Team を分離', () => {
      hideContextMenu();
      detachFireTeam(unit);
    });
  }
  if (unit.assaultteam) {
    addDetachMenuItem(sub, '⚔ Assault Team を分離', () => {
      hideContextMenu();
      detachAssaultTeam(unit);
    });
  }
  addDetachMenuItem(sub, '👤 Step を消費（Guard 等）', () => {
    hideContextMenu();
    detachStep(unit);
  });
  addDetachMenuItem(sub, '🔄 Supplement（補充）', () => {
    hideContextMenu();
    supplementUnit(unit);
  });
}

// ===== Hit Results サブメニュー更新 =====
export function refreshHitSubmenu(unit) {
  const sub = document.getElementById('cmHitSub');
  sub.innerHTML = '';

  // ── 単発ヒット ──
  addDetachMenuItem(sub, '🅐 Hit: A（Assault Team）', () => { hideContextMenu(); hitA(unit); });
  addDetachMenuItem(sub, '🅕 Hit: F（Fire Team）',    () => { hideContextMenu(); hitF(unit); });
  addDetachMenuItem(sub, '🅛 Hit: L（Litter）',       () => { hideContextMenu(); hitL(unit); });
  addDetachMenuItem(sub, '🅟 Hit: P（Paralyze）',     () => { hideContextMenu(); hitP(unit); });
  addDetachMenuItem(sub, '🅒 Hit: C（Casualty）',     () => { hideContextMenu(); hitC(unit); });

  // ── コンボヒット（アクションカードに実在する10種） ──
  const sep = document.createElement('div');
  sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.2);margin:4px 0;font-size:10px;color:#aaa;padding:2px 8px;';
  sep.textContent = '── 2ステップヒット ──';
  sub.appendChild(sep);

  const COMBOS = [
    ['CC', 'C','C'], ['CP', 'C','P'], ['CL', 'C','L'], ['CF', 'C','F'],
    ['PC', 'P','C'], ['PP', 'P','P'], ['PL', 'P','L'], ['PF', 'P','F'],
    ['LC', 'L','C'], ['FC', 'F','C'],
  ];
  COMBOS.forEach(([code, l1, l2]) => {
    addDetachMenuItem(sub, `Hit: ${code}`, () => { hideContextMenu(); hitCombo(unit, l1, l2); });
  });
}

// ===== Mark As トグルメニュー更新 =====
export function refreshCmToggles(unitId) {
  const sub = document.getElementById('cmMarkAsSub');
  if (!sub) return;
  const s = getUnitState(unitId);
  sub.innerHTML = '';

  UNIT_STATES_DEF.forEach(def => {
    const row = document.createElement('div');
    const isOn = s[def.key];
    row.className = `cm-toggle ${def.key}${isOn ? ' is-on' : ''}`;
    row.dataset.key = def.key;

    const dot = document.createElement('span');
    dot.className = 'toggle-indicator';
    dot.style.background = isOn ? def.color : 'transparent';
    dot.style.borderColor = isOn ? def.color : '#5a5a30';
    row.appendChild(dot);

    row.appendChild(document.createTextNode(def.label));

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      if (cmCurrentUnit) {
        toggleUnitState(cmCurrentUnit.id, def.key);
        refreshCmToggles(cmCurrentUnit.id);
      }
    });

    sub.appendChild(row);
  });
}

export function addDetachMenuItem(parent, label, callback) {
  const item = document.createElement('div');
  item.className = 'cm-item';
  item.textContent = label;
  item.addEventListener('click', (e) => { e.stopPropagation(); callback(); });
  parent.appendChild(item);
}

export function clearAllUnitStatesCM() {
  if (cmCurrentUnit) {
    clearAllUnitStates(cmCurrentUnit.id);
    refreshCmToggles(cmCurrentUnit.id);
  }
}

// ===== 初期化（NCM 調整ボタン等）=====
export function initContextMenu() {
  // ── 戦闘解決ボタン ──
  document.getElementById('cmCombatResolve')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!cmCurrentUnit) return;
    const coord = unitCoordMap.get(cmCurrentUnit.id);
    if (!coord) return;
    const ncmResult = calcNCM(coord, cmCurrentUnit.id, false);
    if (!ncmResult) return;
    const result = resolveCombatUnit(cmCurrentUnit.id, ncmResult.value);
    _showUnitCombatResult(cmCurrentUnit, coord, result);
    hideContextMenu();
  });

  document.getElementById('cmNCMAdjMinus')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!cmCurrentUnit) return;
    changeNCMAdjust(cmCurrentUnit.id, -1);
    refreshNCMAdjustDisplay(cmCurrentUnit.id);
    refreshNCMDisplay(cmCurrentUnit.id);
  });

  document.getElementById('cmNCMAdjPlus')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!cmCurrentUnit) return;
    changeNCMAdjust(cmCurrentUnit.id, +1);
    refreshNCMAdjustDisplay(cmCurrentUnit.id);
    refreshNCMDisplay(cmCurrentUnit.id);
  });
}

// ===== NCM 表示 =====
export function refreshNCMDisplay(unitId) {
  const el = document.getElementById('cmNCMDisplay');
  if (!el) return;

  const coord = unitCoordMap.get(unitId);
  if (!coord) { el.style.display = 'none'; return; }

  const result = calcNCM(coord, unitId, false);
  if (!result) { el.style.display = 'none'; return; }

  el.style.display = 'block';
  const v = result.value;
  const sign = v >= 0 ? '+' : '';
  const b = result.breakdown;

  const _s = n => (n >= 0 ? '+' : '') + n;
  const parts = [`VOF${_s(b.bestVOF)}`];
  if (b.crossfire)     parts.push(`Xfire${_s(b.crossfire)}`);
  if (b.concentrate)   parts.push(`Conc${_s(b.concentrate)}`);
  if (b.targetStatus)  parts.push(`状態${_s(b.targetStatus)}`);
  if (b.terrainDef)    parts.push(`地形${_s(b.terrainDef)}`);
  if (b.coverDef)      parts.push(`カバー${_s(b.coverDef)}`);
  if (b.burstPenalty)  parts.push(`曳火${_s(-b.burstPenalty)}`);
  if (b.stackPenalty)  parts.push(`スタック${_s(-b.stackPenalty)}`);
  if (b.manualAdj)     parts.push(`手動${_s(b.manualAdj)}`);

  document.getElementById('cmNCMValue').textContent  = `NCM ${sign}${v}`;
  document.getElementById('cmNCMDetail').textContent = parts.join(' ');
}

// ===== NCM 手動調整 =====
export function refreshNCMAdjustDisplay(unitId) {
  const el = document.getElementById('cmNCMAdjustRow');
  if (!el) return;
  const val = getNCMAdjust(unitId);
  const sign = val >= 0 ? '+' : '';
  document.getElementById('cmNCMAdjustVal').textContent = `${sign}${val}`;
}

// ===== カバーサブメニュー =====
export function refreshCoverSubmenu(unitId) {
  const sub = document.getElementById('cmCoverSub');
  if (!sub) return;
  sub.innerHTML = '';

  const coord = unitCoordMap.get(unitId);
  const slots = coord ? getCoverSlots(coord) : [];
  const currentSlot = getUnitCoverSlot(unitId);

  // 「カバー外」オプション
  const nocover = document.createElement('div');
  nocover.className = `cm-item cm-cover-opt${!currentSlot ? ' active' : ''}`;
  nocover.textContent = '— カバー外';
  nocover.addEventListener('click', (e) => {
    e.stopPropagation();
    removeUnitFromCover(unitId);
    refreshCoverSubmenu(unitId);
    refreshNCMDisplay(unitId);
  });
  sub.appendChild(nocover);

  if (slots.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cm-item';
    empty.style.cssText = 'opacity:0.4;font-size:10px;';
    empty.textContent = 'このカードにカバーマーカーなし';
    sub.appendChild(empty);
    return;
  }

  slots.forEach(slot => {
    const ct = COVER_TYPES[slot.type];
    if (!ct) return;
    const isActive = currentSlot?.slotId === slot.slotId;
    const row = document.createElement('div');
    row.className = `cm-item cm-cover-opt${isActive ? ' active' : ''}`;
    const steps = [...slot.unitIds].reduce((sum, uid) => {
      const s = getUnitStrength(uid);
      return sum + (s?.steps ?? 1);
    }, 0);
    const cap = ct.capacity ?? 3;
    const capLabel = `${steps}/${cap}st`;
    const noFireMark = ct.noFire ? ' 🚫射撃不可' : '';
    row.textContent = `${ct.label} +${ct.value}  (${capLabel})${noFireMark}`;
    row.style.borderLeft = `3px solid ${ct.color}`;
    if (steps >= cap) row.style.opacity = '0.5'; // 満員は薄く
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      if (coord) {
        const ok = assignUnitToCover(unitId, coord, slot.slotId);
        if (!ok) {
          // 収容上限超え → 行を一時的に赤くフィードバック
          row.style.color = '#ee6644';
          row.textContent += ' ← 収容上限';
          return; // サブメニューは閉じない
        }
      }
      refreshCoverSubmenu(unitId);
      refreshNCMDisplay(unitId);
    });
    sub.appendChild(row);
  });
}

// ===== 右パネル：選択ユニット表示 =====

/** ユニット定義から経験レベルを返す（UNITS に experience フィールドがあれば）。 */
function _getExpLabel(unitId) {
  for (const units of Object.values(UNITS)) {
    const u = units.find(u => u.id === unitId);
    if (u) {
      const exp = u.experience ?? 'line';
      return { key: exp, label: { vet: 'ベテラン', line: 'ライン', green: '新兵' }[exp] ?? exp };
    }
  }
  return { key: 'line', label: 'ライン' };
}

/** ユニット種別を日本語ラベルに変換 */
const TYPE_LABELS = {
  squad:       '分隊',
  weapon_team: '火器チーム',
  hq:          'HQ',
  lat:         'LAT',
};

/**
 * 右パネルの「選択ユニット」セクションを更新する。
 * showContextMenu() から自動で呼ばれる。
 * @param {object} unit - context-menu.js の cmCurrentUnit と同じオブジェクト
 */
export function updateRightPanelUnit(unit) {
  const el = document.getElementById('rpUnitInfo');
  if (!el) return;

  const s      = getUnitStrength(unit.id);
  const state  = getUnitState(unit.id);
  const coord  = unitCoordMap.get(unit.id);
  const exp    = _getExpLabel(unit.id);
  const typeLabel = TYPE_LABELS[unit.type] ?? unit.type;

  // 状態バッジ HTML
  const activeBadges = UNIT_STATES_DEF
    .filter(d => state[d.key])
    .map(d => `<span class="rp-badge" style="background:${d.color}">${d.badge} ${d.label}</span>`)
    .join('');

  // NCM（VOFがある場合のみ）
  let ncmHtml = '';
  if (coord) {
    const ncmResult = calcNCM(coord, unit.id, false);
    if (ncmResult) {
      const v    = ncmResult.value;
      const sign = v >= 0 ? '+' : '';
      const cls  = v <= -2 ? 'rp-ncm-danger' : v <= 1 ? 'rp-ncm-warn' : 'rp-ncm-safe';
      ncmHtml = `<div class="rp-ncm-row"><span class="rp-ncm-label">NCM</span><span class="rp-ncm-val ${cls}">${sign}${v}</span><span class="rp-ncm-coord">@${coord}</span></div>`;
    }
  }

  // ステップ表示
  const stepsHtml = s
    ? `<div class="rp-detail-row"><span class="rp-detail-key">戦力</span><span class="rp-detail-val">${s.steps} / ${s.maxSteps} step</span></div>`
    : '';

  el.innerHTML = `
    <div class="rp-unit-name">${unit.label}</div>
    <div class="rp-detail-row">
      <span class="rp-detail-key">種別</span>
      <span class="rp-detail-val">${typeLabel}</span>
    </div>
    <div class="rp-detail-row">
      <span class="rp-detail-key">経験</span>
      <span class="rp-detail-val rp-exp-${exp.key}">${exp.label}</span>
    </div>
    ${stepsHtml}
    ${ncmHtml}
    ${activeBadges ? `<div class="rp-badges-row">${activeBadges}</div>` : ''}
  `.trim();
}

// ===== 戦闘解決ボタン 有効/無効切り替え =====

/**
 * そのユニットのカードに VOF がある場合のみボタンを有効化する
 * @param {string} unitId
 */
function refreshCombatResolveBtn(unitId) {
  const btn = document.getElementById('cmCombatResolve');
  if (!btn) return;
  const coord  = unitCoordMap.get(unitId);
  const hasVof = !!coord && cardVOFMap.has(coord);
  btn.style.opacity       = hasVof ? '1' : '0.35';
  btn.style.pointerEvents = hasVof ? 'auto' : 'none';
  btn.title = hasVof ? '' : 'このカードに VOF マーカーがありません';
}

// ===== ユニット個別戦闘解決の結果を右パネルに表示 =====

const _HIT_EFFECT_LABELS = {
  A: 'アサルトチーム', F: 'ファイアチーム', L: 'リッター',
  P: 'パラライズ',     C: 'カジュアルティ',
};

/**
 * 1ユニット分の戦闘解決結果を右パネルに表示する
 * @param {object} unit     - cmCurrentUnit
 * @param {string} coord    - カード座標
 * @param {object} r        - resolveCombatUnit() の戻り値
 */
function _showUnitCombatResult(unit, coord, r) {
  const el = document.getElementById('rpUnitInfo');
  if (!el) return;

  const sign   = r.ncm >= 0 ? '+' : '';
  const cls    = r.result.toLowerCase();   // 'hit' / 'pin' / 'miss'
  const expMap = { vet: 'ベテラン', line: 'ライン', green: '新兵' };

  let detailHtml = '';
  if (r.result === 'HIT' && r.hitCode) {
    const effects  = r.hitCode.split('').map(c => _HIT_EFFECT_LABELS[c] ?? c).join(' + ');
    const expLabel = expMap[r.experience] ?? r.experience;
    detailHtml = `
      <div class="cr-card">Hit カード #${r.hitCard.number}（${expLabel}）</div>
      <div class="cr-detail">→ ${effects}</div>
    `;
  }

  el.innerHTML = `
    <div class="rp-unit-name">⚔ 戦闘解決 — ${coord}</div>
    <div class="combat-result-entry ${cls}">
      <div class="cr-unit-name">${unit.label}</div>
      <div class="cr-ncm">NCM ${sign}${r.ncm}</div>
      <div class="cr-card">カード #${r.card.number} → <span class="cr-result-${cls}">${r.result}</span></div>
      ${detailHtml}
    </div>
  `.trim();
}
