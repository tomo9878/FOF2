import {
  UNIT_STATES_DEF,
  getUnitState,
  getUnitStrength,
  toggleUnitState,
  clearAllUnitStates,
} from './state.js';
import { hitA, hitF, hitL, hitP, hitC, hitCombo } from './hit.js';
import { detachFireTeam, detachAssaultTeam, detachStep, supplementUnit } from './detach.js';

// ===== コンテキストメニュー制御 =====
export let cmCurrentUnit = null;

export function showContextMenu(e, unit) {
  cmCurrentUnit = unit;
  const menu = document.getElementById('contextMenu');

  document.getElementById('cmUnitName').textContent = unit.label;
  refreshDetachSubmenu(unit);
  refreshHitSubmenu(unit);
  refreshCmToggles(unit.id);

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
    addDetachMenuItem(sub, `${code} Hit: ${code}`, () => { hideContextMenu(); hitCombo(unit, l1, l2); });
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
