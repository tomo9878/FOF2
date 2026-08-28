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
import { resolveStep1, resolveStep2 } from './combat.js';
import { UNITS } from './data/units-normandy.js';
import { getUnitExperience, EXPERIENCE_LABELS } from './campaign.js';
import {
  canHoldCommands, getCommandRole, getCurrentAP, changeCurrentAP,
  getCarryoverMax, getExpendLimit, getActivated, setActivated,
  hasFixedInitiative, CO_STAFF_INITIATIVE_COMMANDS, applyCommandModifiers,
  getCommandsDrawn, setCommandsDrawn, getActivatorRole, COMMAND_ROLE_LABELS,
  finishImpulse, expendCommand, undoExpendCommand, canExpendCommand,
  getSpentThisImpulse, isUnitEligibleNow, listActivationTargets,
  activateSubordinate, ACTIVATE_COST, isOnCommandSide, canGiveOrder,
} from './command.js';
import {
  listRunners, RUNNER_STATUS, RUNNER_ACTION_COST, MAX_RUNNERS,
  canCreateRunner, createRunner, canDispatchRunner, dispatchRunner,
  canDismissRunner, dismissRunner, isGoodOrder,
} from './runner.js';
import { getAreaKey } from './comm.js';
import { setHighlightOrigin } from './order-highlight.js';
import {
  listRallyActions, planRallyAction, payRallyCost, isRallySuccess,
  applyRallyAction, RALLY_ACTIONS, RALLY_COST,
} from './rally.js';
import {
  listMoveTargets, moveToAdjacent, moveWithinCard, movePlatoonToAdjacent,
  MOVE_COST, PLATOON_MOVE_COST,
} from './move.js';
import {
  canGrenadeAttack, planGrenadeAttack, isGrenadeSuccess, payGrenadeCost, applyGrenadeAttack, GRENADE_COST,
  listPlatoonGrenadeTargets, canPlatoonGrenadeAttack, payPlatoonGrenadeCost, PLATOON_GRENADE_COST,
  planConcentrateFire, isConcentrateFireSuccess, payConcentrateFireCost, applyConcentrateFire, CONCENTRATE_COST,
  listPlatoonConcentrateTargets, canPlatoonConcentrateFire, payPlatoonConcentrateFireCost, PLATOON_CONCENTRATE_COST,
  listConcentrateFireTargetCoords,
} from './combat-action.js';
import { getUnitCoverSlot as _coverSlotOf, getCoverSlots as _coverSlotsOf, COVER_TYPES as _COVER_TYPES } from './cover.js';
import { drawActionCard } from './deck.js';
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
  // カード引き中は右クリックメニューを開かせない
  if (_isDrawLocked()) return;

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
  // ── 戦闘解決ボタン → ステップ制フローを開始 ──
  document.getElementById('cmCombatResolve')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!cmCurrentUnit) return;
    const coord = unitCoordMap.get(cmCurrentUnit.id);
    if (!coord) return;
    const ncmResult = calcNCM(coord, cmCurrentUnit.id, false);
    if (!ncmResult) return;
    _startCombatFlow(cmCurrentUnit, coord, ncmResult.value);
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

/** 経験レベルを campaign 状態から返す（成長要素のため可変）。 */
function _getExpLabel(unitId) {
  const exp = getUnitExperience(unitId);
  return { key: exp, label: EXPERIENCE_LABELS[exp] ?? exp };
}

/** ユニット種別を日本語ラベルに変換 */
const TYPE_LABELS = {
  squad:       '分隊',
  weapon_team: '火器チーム',
  hq:          'HQ',
  lat:         'LAT',
};

/** 右パネルに今表示しているユニット（インパルス変更時の再描画用） */
let _rpUnit = null;

// インパルスが進んだら、表示中ユニットの取得ボタン可否を描き直す
document.addEventListener('impulse:changed', () => {
  if (_rpUnit) updateRightPanelUnit(_rpUnit);
});

/**
 * 右パネルの「選択ユニット」セクションを更新する。
 * showContextMenu() から自動で呼ばれる。
 * @param {object} unit - context-menu.js の cmCurrentUnit と同じオブジェクト
 */
export function updateRightPanelUnit(unit) {
  const el = document.getElementById('rpUnitInfo');
  if (!el) return;
  _rpUnit = unit;   // インパルスが進んだときに描き直せるよう覚えておく
  setHighlightOrigin(unit.id);   // HQ を選んだら命令範囲の可視化の基準にする

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

  // コマンド（AP）セクション — commandRole を持つ HQ/Staff のみ
  let cmdHtml = '';
  if (canHoldCommands(unit.id)) {
    const ap        = getCurrentAP(unit.id);
    const carryMax  = getCarryoverMax(unit.id);
    const expendMax = getExpendLimit();
    const activated = getActivated(unit.id);
    const drawn     = getCommandsDrawn(unit.id);
    const eligible  = isUnitEligibleNow(unit.id);   // 今のインパルスで取得できるか
    // 起動チェックは「上位HQに起動されうる役職」にだけ出す（§4.1.1 Command Reference Table）
    const actRole   = getActivatorRole(unit.id);
    const activatedHtml = actRole
      ? `<label class="rp-cmd-activated-label">
          <input type="checkbox" id="rpCmdActivated" ${activated ? 'checked' : ''}>
          ${COMMAND_ROLE_LABELS[actRole]}に起動された
        </label>`
      : `<div class="rp-cmd-info">${COMMAND_ROLE_LABELS[getCommandRole(unit.id)] ?? ''} は起動されない（自前のインパルス）</div>`;
    cmdHtml = `
      <div class="rp-cmd">
        <div class="rp-cmd-title">コマンド (AP)</div>
        <div class="rp-cmd-ap">
          <button class="rp-cmd-btn" id="rpCmdMinus">－</button>
          <span class="rp-cmd-val" id="rpCmdVal">${ap}</span>
          <button class="rp-cmd-btn" id="rpCmdPlus">＋</button>
        </div>
        <div class="rp-cmd-info">繰越上限 ${carryMax} / 1インパルス消費上限 ${expendMax}</div>
        <div class="rp-cmd-spent" id="rpCmdSpent"></div>
        ${isOnCommandSide(unit.id) ? '' : '<div class="rp-cmd-ftside">⚠ Fire Team 面：起動されず、自分にしか命令できない（§4.1.4）</div>'}
        ${activatedHtml}
        ${_activationTargetsHtml(unit.id)}
        ${_runnerHtml(unit.id)}
        <button class="rp-draw-btn" id="rpCmdDraw" ${drawn || !eligible.ok ? 'disabled' : ''}>${_cmdDrawLabel(unit.id)}</button>
        ${!drawn && !eligible.ok ? `<div class="rp-act-reason">${eligible.reason}</div>` : ''}
        <button class="rp-finish-btn" id="rpCmdFinish">⏹ インパルス終了（残りを Save）</button>
      </div>
    `;
  }

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
    ${_moveHtml(unit.id)}
    ${_rallyHtml(unit.id)}
    ${_combatActionHtml(unit.id)}
    ${cmdHtml}
  `.trim();

  // コマンドセクションのボタンをバインド
  if (cmdHtml) _bindCommandButtons(unit.id);
  _bindMoveButtons(unit.id);
  _bindRallyButtons(unit.id);
  _bindCombatActButtons(unit.id);
}

// ===== コマンド（AP）ボタン =====

function _bindCommandButtons(unitId) {
  const valEl = document.getElementById('rpCmdVal');
  // AP 表示と「このインパルス消費 n/上限」表示、－ボタンの有効/無効をまとめて更新する
  const refresh = () => {
    if (valEl) valEl.textContent = getCurrentAP(unitId);
    const spentEl = document.getElementById('rpCmdSpent');
    const minusEl = document.getElementById('rpCmdMinus');
    const spent = getSpentThisImpulse(unitId);
    const limit = getExpendLimit();
    if (spentEl) {
      const capped = spent >= limit;
      spentEl.textContent = `このインパルス消費 ${spent} / ${limit}${capped ? '（上限）' : ''}`;
      spentEl.classList.toggle('rp-cmd-spent-max', capped);
    }
    if (minusEl) minusEl.disabled = !canExpendCommand(unitId);
  };
  _bindFinishButton(unitId, refresh);
  _bindRunnerButtons(unitId, refresh);

  // §4.2.1a 起動ボタン（CO HQ・BN HQ のみ表示される）
  document.querySelectorAll('[data-activate]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = activateSubordinate(unitId, btn.dataset.activate);
      if (!r.ok) return;
      refresh();
      updateRightPanelUnit(_rpUnit);   // 起動済み表示・残AP・消費カウンタを反映
      document.dispatchEvent(new CustomEvent('board:changed'));
    });
  });

  document.getElementById('rpCmdMinus')?.addEventListener('click', (e) => {
    e.stopPropagation();
    // 命令1つ分を人間が消費。§4.1.3 の消費上限（昼6・夜4）を超えたら受け付けない
    if (!expendCommand(unitId).ok) return;
    refresh();
    document.dispatchEvent(new CustomEvent('board:changed')); // 自動保存
  });
  document.getElementById('rpCmdPlus')?.addEventListener('click', (e) => {
    e.stopPropagation();
    undoExpendCommand(unitId);   // 押し間違いの取り消し（消費カウンタも戻す）
    refresh();
    document.dispatchEvent(new CustomEvent('board:changed'));
  });

  refresh();
  // 「CO HQに起動された」チェック（誰を起動するかは人間が管理）
  document.getElementById('rpCmdActivated')?.addEventListener('change', (e) => {
    e.stopPropagation();
    setActivated(unitId, e.target.checked);
    // CO Staff は起動/イニシアチブでカードの要否が変わるのでラベルを更新
    const draw = document.getElementById('rpCmdDraw');
    if (draw) draw.textContent = _cmdDrawLabel(unitId);
    document.dispatchEvent(new CustomEvent('board:changed'));
  });
  // コマンド取得（取得量の計算は自動・カードを引く操作は人間）
  // 起動済みなら activated 値、未起動ならイニシアチブ値（引いた時点で自動的に起動済みになる）
  // 例外: CO Staff のイニシアチブはカードを引かず固定1（§4.1.1 / §4.1.2 修正適用外）
  document.getElementById('rpCmdDraw')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasActivated = getActivated(unitId);
    let gained, modeLabel, srcLabel, breakdown = '';

    if (wasActivated) {
      const card = drawActionCard();
      const r = applyCommandModifiers(unitId, card.activated ?? 0, 'activation');
      gained = r.total;
      modeLabel = '起動';
      srcLabel = `カード #${card.number}`;
      breakdown = _fmtCommandMods(r);
    } else if (hasFixedInitiative(unitId)) {
      // CO Staff Initiative Impulse: カードを引かない・§4.1.2 の修正も乗らない
      gained = CO_STAFF_INITIATIVE_COMMANDS;
      modeLabel = 'イニシアチブ(CO Staff固定)';
      srcLabel = 'カード不要';
    } else {
      const card = drawActionCard();
      const r = applyCommandModifiers(unitId, card.initiative ?? 0, 'initiative');
      gained = r.total;
      modeLabel = 'イニシアチブ';
      srcLabel = `カード #${card.number}`;
      breakdown = _fmtCommandMods(r);
    }

    // 取得はターン内1回だけ（Activation Completed 相当）。
    // ここで activated は触らない（起動されたかどうかとは別概念）。
    setCommandsDrawn(unitId, true);
    changeCurrentAP(unitId, gained);
    refresh();
    // 取得内訳を一時表示
    const draw = document.getElementById('rpCmdDraw');
    if (draw) {
      draw.textContent = `${srcLabel} [${modeLabel}]${breakdown} → +${gained}`;
      draw.disabled = true;
      setTimeout(() => { if (draw) draw.textContent = _cmdDrawLabel(unitId); }, 4000);
    }
    document.dispatchEvent(new CustomEvent('board:changed'));
  });
}

/**
 * §4.2.1a Activate: 起動できる役職なら、対象一覧と「起動(1)」ボタンを組み立てる。
 * 起動できない役職（PLT HQ・CO Staff・一般ユニット）では何も出さない。
 * @param {string} unitId
 * @returns {string}
 */
function _activationTargetsHtml(unitId) {
  const targets = listActivationTargets(unitId);
  if (!targets.length) return '';
  const rows = targets.map(t => {
    if (t.activated) {
      return `<div class="rp-act-row"><span class="rp-act-name">${t.label}</span><span class="rp-act-done">✔ 起動済み</span></div>`;
    }
    return `<div class="rp-act-row">
      <span class="rp-act-name">${t.label}</span>
      <button class="rp-act-btn" data-activate="${t.id}" ${t.ok ? '' : `disabled title="${t.reason}"`}>起動 (${ACTIVATE_COST})</button>
    </div>`;
  }).join('');
  return `<div class="rp-act-title">§4.2.1a 下位HQ/Staff を起動（1コマンド・自動成功）</div>${rows}`;
}

/**
 * 盤上にいるユニットを列挙する（LAT・敵は除く）。
 * @param {(u:object)=>boolean} pred
 * @returns {Array<{id:string,label:string}>}
 */
function _boardUnits(pred) {
  const out = [];
  for (const arr of Object.values(UNITS)) {
    for (const u of arr) {
      if (u.faction !== 'friendly') continue;
      if (!unitCoordMap.has(u.id)) continue;
      if (pred(u)) out.push({ id: u.id, label: u.label });
    }
  }
  return out;
}

/** select 要素を組み立てる */
function _selectHtml(id, items, empty) {
  if (!items.length) return `<div class="rp-act-reason">${empty}</div>`;
  return `<select class="rp-bnhq-select" id="${id}">`
    + items.map(i => `<option value="${i.id}">${i.label}</option>`).join('')
    + '</select>';
}

// ===== 移動アクション（§4.2.2）=====
//
// 隣接カードのボタンを並べ、押すと「1コマンド消費 → 移動 → Exposed 付与」まで通す。
// 移動先にカバーがある場合は「カバーに入るか」を選べる（§4.2.2a）。

/** その駒に移動を命令できる HQ/Staff を探す */
function _findMoveOriginator(unitId) {
  for (const [id] of unitCoordMap) {
    if (!getCommandRole(id)) continue;
    if (getCurrentAP(id) < MOVE_COST || !canExpendCommand(id)) continue;
    if (canGiveOrder(id, unitId).ok) return id;
  }
  return null;
}

/**
 * 移動セクションを組み立てる。
 * @param {string} unitId
 * @returns {string}
 */
function _moveHtml(unitId) {
  if (!unitCoordMap.has(unitId)) return '';
  const originator = _findMoveOriginator(unitId);
  if (!originator) return '';

  const targets = listMoveTargets(originator, unitId).filter(t => t.ok);
  const coord = unitCoordMap.get(unitId);
  const curSlot = _coverSlotOf(unitId)?.slotId ?? null;
  const areas = [
    { slotId: '', label: 'カバー外' },
    ..._coverSlotsOf(coord).map(s => ({ slotId: s.slotId, label: _COVER_TYPES[s.type]?.label ?? s.type })),
  ].filter(a => (a.slotId || null) !== curSlot);

  const isPlt = getCommandRole(unitId) === 'plt_hq';
  const pltOk = isPlt && getCurrentAP(unitId) >= PLATOON_MOVE_COST && canExpendCommand(unitId);

  if (!targets.length && !areas.length) return '';

  const cardBtns = targets.map(t => {
    const opts = [{ slotId: '', label: 'カバー外' },
      ...t.covers.map(c => ({ slotId: c.slotId, label: c.label }))];
    const sel = opts.length > 1
      ? `<select class="rp-bnhq-select" id="mvCover_${t.coord}" style="flex:1">${opts.map(o => `<option value="${o.slotId}">${o.label}</option>`).join('')}</select>`
      : '';
    return `<div class="rp-act-row">
      <span class="rp-act-name">→ ${t.coord}</span>${sel}
      <button class="rp-act-btn" data-move-to="${t.coord}" data-move-from="${originator}">移動 (${MOVE_COST})</button>
    </div>`;
  }).join('');

  const areaBtns = areas.length ? `
    <div class="rp-act-reason">カード内移動（§4.2.2f・常に Exposed）</div>
    <div class="rp-act-row">
      <select class="rp-bnhq-select" id="mvAreaSel" style="flex:1">
        ${areas.map(a => `<option value="${a.slotId}">${a.label}</option>`).join('')}
      </select>
      <button class="rp-act-btn" data-move-area="1" data-move-from="${originator}">移動 (${MOVE_COST})</button>
    </div>` : '';

  const pltBtns = pltOk && targets.length ? `
    <div class="rp-act-reason">小隊で移動（§4.2.2b・通信できない駒は置き去り）</div>
    <div class="rp-act-row">
      <select class="rp-bnhq-select" id="mvPltSel" style="flex:1">
        ${targets.map(t => `<option value="${t.coord}">→ ${t.coord}</option>`).join('')}
      </select>
      <button class="rp-act-btn" data-move-platoon="1">小隊移動 (${PLATOON_MOVE_COST})</button>
    </div>` : '';

  return `<div class="rp-act-title">§4.2.2 移動（発令: ${originator}）</div>
    ${cardBtns}${areaBtns}${pltBtns}
    <div class="rp-rally-result" id="rpMoveResult"></div>`;
}

/** 移動ボタンを束ねる */
function _bindMoveButtons(unitId) {
  const show = (msg) => {
    const el = document.getElementById('rpMoveResult');
    if (el) el.innerHTML = `<div class="rp-cs-card">${msg}</div>`;
  };
  document.querySelectorAll('[data-move-to]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const to = btn.dataset.moveTo;
      const slot = document.getElementById(`mvCover_${to}`)?.value || null;
      const r = moveToAdjacent(btn.dataset.moveFrom, unitId, to, slot);
      if (!r.ok) { show(`移動できない: ${r.reason}`); return; }
      show(`${to} へ移動${r.exposed ? '（Exposed）' : '（塹壕/バンカー間なので Exposed なし）'}`
        + (r.phoneLine?.laid ? ' ／ 電話線を1本敷設' : ''));
      updateRightPanelUnit(_rpUnit);
    });
  });
  document.querySelector('[data-move-area]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const slot = document.getElementById('mvAreaSel')?.value || null;
    const r = moveWithinCard(btn.dataset.moveFrom, unitId, slot);
    if (!r.ok) { show(`移動できない: ${r.reason}`); return; }
    show('カード内で移動（Exposed）');
    updateRightPanelUnit(_rpUnit);
  });
  document.querySelector('[data-move-platoon]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const to = document.getElementById('mvPltSel')?.value;
    const r = movePlatoonToAdjacent(unitId, to);
    if (!r.ok) { show(`小隊移動できない: ${r.reason}`); return; }
    const stayed = r.stayed.map(s => `${s.id}(${s.reason})`).join(', ');
    show(`${to} へ ${r.moved.length}体が移動${stayed ? ` ／ 置き去り: ${stayed}` : ''}`);
    updateRightPanelUnit(_rpUnit);
  });
}

// ===== Rally アクション（§4.2.3 / §6.5.1）=====
//
// 対象の駒を右クリックすると、その駒に出せる Rally アクションが並ぶ。
// 発令者（HQ/Staff）は「その駒に命令できてコマンドを払える駒」を自動で選ぶ。
// VOF が無ければ自動成功、あれば人間が1枚ずつカードを引く（ドローロックをかける）。

let _rallyState = null;   // { targetId, actionKey, need, cards[], done }

/** その駒に Rally を命令できる HQ/Staff を探す */
function _findRallyOriginator(targetId, actionKey) {
  const def = RALLY_ACTIONS[actionKey];
  for (const [unitId] of unitCoordMap) {
    if (!getCommandRole(unitId)) continue;
    if (getCurrentAP(unitId) < RALLY_COST || !canExpendCommand(unitId)) continue;
    if (canGiveOrder(unitId, targetId, def?.orderKind).ok) return unitId;
  }
  return null;
}

/**
 * 選択中の駒に対する Rally セクションを組み立てる。
 * @param {string} unitId
 * @returns {string}
 */
function _rallyHtml(unitId) {
  if (!unitCoordMap.has(unitId)) return '';

  // アクションごとに発令者を探して可否を出す
  const rows = Object.keys(RALLY_ACTIONS).map(key => {
    const originator = _findRallyOriginator(unitId, key);
    const list = originator ? listRallyActions(originator, unitId) : [];
    const info = list.find(a => a.key === key)
      ?? { key, label: RALLY_ACTIONS[key].label, ref: RALLY_ACTIONS[key].ref, ok: false, reason: '命令できる HQ/Staff がいない', auto: false, draws: 0 };
    return { ...info, originator };
  });
  if (!rows.some(r => r.ok)) return '';   // 1つも出せないなら枠ごと出さない

  const items = rows.filter(r => r.ok).map(r => `
    <div class="rp-act-row">
      <span class="rp-act-name">${r.label}<span class="rp-act-reason"> ${r.ref}</span></span>
      <button class="rp-act-btn" data-rally="${r.key}" data-rally-from="${r.originator}"
        title="発令: ${r.originator} / ${r.auto ? '自動成功' : `${r.draws}枚引いて Rally を探す`}">
        ${r.auto ? `実行 (${RALLY_COST})` : `試みる (${RALLY_COST})`}
      </button>
    </div>`).join('');

  return `<div class="rp-act-title">§4.2.3 Rally（VOF が無ければ自動成功）</div>${items}
    <div class="rp-rally-result" id="rpRallyResult"></div>`;
}

/** Rally ボタンを束ねる */
function _bindRallyButtons(unitId) {
  document.querySelectorAll('[data-rally]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_isDrawLocked()) return;
      _startRally(btn.dataset.rallyFrom, unitId, btn.dataset.rally);
    });
  });
  document.getElementById('rpRallyDraw')?.addEventListener('click', (e) => {
    e.stopPropagation();
    _drawRallyCard();
  });
}

/** Rally 開始: コストを払い、自動成功ならその場で適用、ドローなら人間に引かせる */
function _startRally(originatorId, targetId, actionKey) {
  const plan = planRallyAction(originatorId, targetId, actionKey);
  payRallyCost(originatorId);

  if (plan.auto) {
    applyRallyAction(targetId, actionKey);
    _rallyState = { targetId, actionKey, need: 0, cards: [], done: true, success: true, note: plan.reason };
    _renderRally();
    document.dispatchEvent(new CustomEvent('board:changed'));
    return;
  }
  _rallyState = { targetId, actionKey, need: plan.draws, cards: [], done: false, success: false, note: plan.reason };
  _setDrawLock(true);
  _renderRally();
}

/** 1枚引く（人間が押す） */
function _drawRallyCard() {
  if (!_rallyState || _rallyState.done) return;
  _rallyState.cards.push(drawActionCard());
  if (_rallyState.cards.length >= _rallyState.need) {
    _rallyState.success = isRallySuccess(_rallyState.cards);
    _rallyState.done = true;
    if (_rallyState.success) applyRallyAction(_rallyState.targetId, _rallyState.actionKey);
    _setDrawLock(false);
    document.dispatchEvent(new CustomEvent('board:changed'));
  }
  _renderRally();
}

/** Rally の進行状況を右パネルに描く */
function _renderRally() {
  const el = document.getElementById('rpRallyResult');
  if (!el || !_rallyState) return;
  const { actionKey, need, cards, done, success, note } = _rallyState;
  const label = RALLY_ACTIONS[actionKey]?.label ?? actionKey;
  const drawn = cards.map(c => `#${c.number}${c.type === 'rally' ? '(Rally)' : ''}`).join(' ');

  let html = `<div class="rp-cs-unit">${label}</div><div class="rp-act-reason">${note}</div>`;
  if (!done) {
    html += `<div class="rp-cs-card">${cards.length} / ${need} 枚${drawn ? '：' + drawn : ''}</div>
             <button class="rp-draw-btn" id="rpRallyDraw">🃏 カードを引く（残り ${need - cards.length}）</button>`;
  } else {
    if (drawn) html += `<div class="rp-cs-card">引いたカード：${drawn}</div>`;
    html += `<div class="rp-cs-done" style="color:${success ? '#66aa66' : '#cc7755'}">${success ? '✓ 成功' : '✕ 失敗（何も起きない）'}</div>`;
  }
  el.innerHTML = html;
  document.getElementById('rpRallyDraw')?.addEventListener('click', (e) => { e.stopPropagation(); _drawRallyCard(); });
}

// ===== 戦闘アクション（§4.2.4 Tier1）: Grenade Attack / Concentrate Fire =====
//
// 単体版はその場でドロー、小隊版（h/c）は対象ユニットを1体ずつ順にドローするキュー方式。
// コストは単体1・小隊2（まとめ払い）。draws は必ず1枚以上なので Rally の "auto" 概念は無い。

let _combatActQueue = null; // { kind:'grenade'|'concentrate', targetCoord, units:[...], idx, current, results:[] }

/** その駒に Grenade Attack / Concentrate Fire を命令できる HQ/Staff を探す */
function _findCombatActOriginator(unitId, cost) {
  for (const [id] of unitCoordMap) {
    if (!getCommandRole(id)) continue;
    if (getCurrentAP(id) < cost || !canExpendCommand(id)) continue;
    if (canGiveOrder(id, unitId).ok) return id;
  }
  return null;
}

/**
 * 選択中の駒に対する §4.2.4 戦闘アクションセクションを組み立てる。
 * @param {string} unitId
 * @returns {string}
 */
function _combatActionHtml(unitId) {
  if (!unitCoordMap.has(unitId)) return '';
  let html = '';

  // --- d. Grenade Attack（単体・同カードのみ）---
  const grenadeOriginator = _findCombatActOriginator(unitId, GRENADE_COST);
  if (grenadeOriginator && canGrenadeAttack(grenadeOriginator, unitId).ok) {
    html += `<div class="rp-act-row">
      <span class="rp-act-name">手榴弾攻撃（同カード）<span class="rp-act-reason"> §4.2.4d</span></span>
      <button class="rp-act-btn" data-grenade-single="1" data-grenade-from="${grenadeOriginator}">試みる (${GRENADE_COST})</button>
    </div>`;
  }

  // --- b. Concentrate Fire（単体・対象カード選択）---
  const concOriginator = _findCombatActOriginator(unitId, CONCENTRATE_COST);
  const concTargets = listConcentrateFireTargetCoords(unitId);
  if (concOriginator && concTargets.length) {
    const opts = concTargets.map(c => `<option value="${c}">${c}</option>`).join('');
    html += `<div class="rp-act-row">
      <span class="rp-act-name">Concentrate Fire<span class="rp-act-reason"> §4.2.4b</span></span>
      <select class="rp-bnhq-select" id="caConcTarget" style="flex:1">${opts}</select>
      <button class="rp-act-btn" data-conc-single="1" data-conc-from="${concOriginator}">試みる (${CONCENTRATE_COST})</button>
    </div>`;
  }

  // --- h/c. 小隊版（PLT HQ のみ）---
  if (getCommandRole(unitId) === 'plt_hq') {
    const grenTargets = listPlatoonGrenadeTargets(unitId);
    if (grenTargets.length) {
      const grenPlt = canPlatoonGrenadeAttack(unitId);
      html += `<div class="rp-act-row">
        <span class="rp-act-name">小隊 手榴弾攻撃（${grenTargets.length}名）<span class="rp-act-reason"> §4.2.4h</span></span>
        <button class="rp-act-btn" data-grenade-platoon="1" ${grenPlt.ok ? '' : `disabled title="${grenPlt.reason}"`}>実行 (${PLATOON_GRENADE_COST})</button>
      </div>`;
    }
    const pltConcCandidates = listConcentrateFireTargetCoords(unitId);
    if (pltConcCandidates.length) {
      const opts = pltConcCandidates.map(c => `<option value="${c}">${c}</option>`).join('');
      html += `<div class="rp-act-row">
        <span class="rp-act-name">小隊 Concentrate Fire<span class="rp-act-reason"> §4.2.4c</span></span>
        <select class="rp-bnhq-select" id="caPltConcTarget" style="flex:1">${opts}</select>
        <button class="rp-act-btn" data-conc-platoon="1">実行 (${PLATOON_CONCENTRATE_COST})</button>
      </div>`;
    }
  }

  if (!html) return '';
  return `<div class="rp-act-title">§4.2.4 戦闘アクション</div>${html}
    <div class="rp-rally-result" id="rpCombatActResult"></div>`;
}

/** 戦闘アクションのボタンを束ねる */
function _bindCombatActButtons(unitId) {
  document.querySelectorAll('[data-grenade-single]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_isDrawLocked()) return;
      payGrenadeCost(btn.dataset.grenadeFrom);
      _startCombatActQueue('grenade', null, [unitId]);
    });
  });
  document.querySelectorAll('[data-conc-single]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_isDrawLocked()) return;
      const target = document.getElementById('caConcTarget')?.value;
      if (!target) return;
      payConcentrateFireCost(btn.dataset.concFrom);
      _startCombatActQueue('concentrate', target, [unitId]);
    });
  });
  document.querySelectorAll('[data-grenade-platoon]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_isDrawLocked() || btn.disabled) return;
      const targets = listPlatoonGrenadeTargets(unitId);
      if (!targets.length) return;
      payPlatoonGrenadeCost(unitId);
      _startCombatActQueue('grenade', null, targets);
    });
  });
  document.querySelectorAll('[data-conc-platoon]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_isDrawLocked()) return;
      const target = document.getElementById('caPltConcTarget')?.value;
      if (!target || !canPlatoonConcentrateFire(unitId, target).ok) return;
      const targets = listPlatoonConcentrateTargets(unitId, target);
      payPlatoonConcentrateFireCost(unitId);
      _startCombatActQueue('concentrate', target, targets);
    });
  });
  document.getElementById('rpCombatActDraw')?.addEventListener('click', (e) => { e.stopPropagation(); _drawCombatActCard(); });
  document.getElementById('rpCombatActNext')?.addEventListener('click', (e) => { e.stopPropagation(); _advanceCombatActQueue(); });
}

/** コストは呼び出し側で払い済み。ユニットのキューを開始する（1体ずつドロー） */
function _startCombatActQueue(kind, targetCoord, units) {
  _combatActQueue = { kind, targetCoord, units, idx: 0, current: null, results: [] };
  _setDrawLock(true);
  _beginNextCombatActUnit();
}

function _beginNextCombatActUnit() {
  const q = _combatActQueue;
  if (!q) return;
  if (q.idx >= q.units.length) {
    _setDrawLock(false);
    _renderCombatAct();
    return;
  }
  const unitId = q.units[q.idx];
  const plan = q.kind === 'grenade' ? planGrenadeAttack(unitId) : planConcentrateFire(unitId);
  q.current = { unitId, need: plan.draws, cards: [], done: false, success: false };
  _renderCombatAct();
}

function _drawCombatActCard() {
  const q = _combatActQueue;
  if (!q || !q.current || q.current.done) return;
  q.current.cards.push(drawActionCard());
  if (q.current.cards.length >= q.current.need) {
    const success = q.kind === 'grenade'
      ? isGrenadeSuccess(q.current.cards)
      : isConcentrateFireSuccess(q.current.cards);
    q.current.success = success;
    q.current.done = true;
    if (q.kind === 'grenade') applyGrenadeAttack(q.current.unitId, success);
    else applyConcentrateFire(q.targetCoord, success);
    q.results.push({ unitId: q.current.unitId, success });
    document.dispatchEvent(new CustomEvent('board:changed'));
  }
  _renderCombatAct();
}

function _advanceCombatActQueue() {
  const q = _combatActQueue;
  if (!q) return;
  q.idx++;
  q.current = null;
  _beginNextCombatActUnit();
}

/** 戦闘アクションキューの進行状況を右パネルに描く */
function _renderCombatAct() {
  const el = document.getElementById('rpCombatActResult');
  if (!el || !_combatActQueue) return;
  const q = _combatActQueue;
  const label = q.kind === 'grenade' ? '手榴弾攻撃' : 'Concentrate Fire';

  let html = q.results.map(r =>
    `<div class="rp-cs-card">${r.unitId}: ${r.success ? '✓ 成功' : '✕ 失敗'}</div>`
  ).join('');

  if (q.idx >= q.units.length) {
    html = `<div class="rp-cs-unit">${label}</div>${html}<div class="rp-cs-done">✓ 解決完了（${q.results.length}体）</div>`;
    el.innerHTML = html;
    return;
  }

  const cur = q.current;
  const drawn = cur.cards.map(c => `#${c.number}`).join(' ');
  html = `<div class="rp-cs-unit">${label} — ${cur.unitId}</div>${html}`;
  if (!cur.done) {
    html += `<div class="rp-cs-card">${cur.cards.length} / ${cur.need} 枚${drawn ? '：' + drawn : ''}</div>
      <button class="rp-draw-btn" id="rpCombatActDraw">🃏 カードを引く（残り ${cur.need - cur.cards.length}）</button>`;
  } else {
    html += `<div class="rp-cs-done" style="color:${cur.success ? '#66aa66' : '#cc7755'}">${cur.success ? '✓ 成功' : '✕ 失敗'}</div>
      <button class="rp-draw-btn" id="rpCombatActNext">次へ ▶</button>`;
  }

  el.innerHTML = html;
  document.getElementById('rpCombatActDraw')?.addEventListener('click', (e) => { e.stopPropagation(); _drawCombatActCard(); });
  document.getElementById('rpCombatActNext')?.addEventListener('click', (e) => { e.stopPropagation(); _advanceCombatActQueue(); });
}

/**
 * §4.3.2 / §4.2.1f-h ランナー。CO HQ のときだけ表示する。
 * @param {string} unitId
 * @returns {string}
 */
function _runnerHtml(unitId) {
  if (getCommandRole(unitId) !== 'co_hq') return '';
  const runners = listRunners();
  const inBox = runners.filter(r => r.status === RUNNER_STATUS.IN_BOX);

  const rows = runners.map(r => {
    if (r.status === RUNNER_STATUS.NONE) {
      return `<div class="rp-act-row"><span class="rp-act-name">${r.label}</span><span class="rp-act-reason">未作成</span></div>`;
    }
    if (r.status === RUNNER_STATUS.IN_BOX) {
      return `<div class="rp-act-row"><span class="rp-act-name">${r.label}</span><span class="rp-act-done">CO HQ 箱</span></div>`;
    }
    const tgt = _unitLabel(r.targetId);
    return `<div class="rp-act-row"><span class="rp-act-name">${r.label}</span><span class="rp-act-done">配達中 → ${tgt}</span></div>`;
  }).join('');

  // 作成の対価を払えるユニット（Good Order・ステップに余裕あり）
  const payers = _boardUnits(u => isGoodOrder(u.id) && (getUnitStrength(u.id)?.steps ?? 0) > 2);
  // 派遣先（盤上の PLT HQ / CO Staff）
  const targets = _boardUnits(u => ['plt_hq', 'co_staff'].includes(u.commandRole));
  // 解散時にステップを受け取れるユニット（§4.2.1h: CO HQ と同じエリアに限る）
  const coArea = getAreaKey(unitId);
  const healers = _boardUnits(u => {
    const s = getUnitStrength(u.id);
    return isGoodOrder(u.id) && s && s.steps < s.maxSteps && getAreaKey(u.id) === coArea;
  });

  return `
    <div class="rp-act-title">§4.3.2 伝令（最大${MAX_RUNNERS}体・各アクション${RUNNER_ACTION_COST}コマンド）</div>
    ${rows}
    <div class="rp-runner-form">
      <div class="rp-act-reason">作成（対象を1ステップ減らす）</div>
      ${_selectHtml('rnCreateSel', payers, '払えるユニットが盤上にいない')}
      <button class="rp-act-btn" id="rnCreateBtn">伝令を作成 (${RUNNER_ACTION_COST})</button>
    </div>
    ${inBox.length ? `
    <div class="rp-runner-form">
      <div class="rp-act-reason">派遣（翌ターン起動したい相手のカードへ）</div>
      ${_selectHtml('rnDispatchSel', targets, '派遣先の PLT HQ / CO Staff が盤上にいない')}
      <button class="rp-act-btn" id="rnDispatchBtn">派遣 (${RUNNER_ACTION_COST})</button>
    </div>
    <div class="rp-runner-form">
      <div class="rp-act-reason">解散（CO HQ と同じエリアのユニットに1ステップ戻す）</div>
      ${_selectHtml('rnDismissSel', healers, 'CO HQ と同じエリアに受け取れるユニットがいない')}
      <button class="rp-act-btn" id="rnDismissBtn">解散 (${RUNNER_ACTION_COST})</button>
    </div>` : ''}
  `;
}

/** ユニットIDから表示名 */
function _unitLabel(unitId) {
  for (const arr of Object.values(UNITS)) {
    const u = arr.find(x => x.id === unitId);
    if (u) return u.label;
  }
  return unitId ?? '―';
}

/**
 * ランナー操作のボタンを束ねる。
 * @param {string} unitId - CO HQ
 * @param {Function} refresh
 */
function _bindRunnerButtons(unitId, refresh) {
  const rerender = () => { refresh(); updateRightPanelUnit(_rpUnit); document.dispatchEvent(new CustomEvent('board:changed')); };
  const firstInBox = () => listRunners().find(r => r.status === RUNNER_STATUS.IN_BOX)?.id ?? null;

  document.getElementById('rnCreateBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const sel = document.getElementById('rnCreateSel');
    if (!sel) return;
    const r = createRunner(unitId, sel.value);
    if (!r.ok) { _flash('rnCreateBtn', r.reason); return; }
    rerender();
  });

  document.getElementById('rnDispatchBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const sel = document.getElementById('rnDispatchSel');
    const runnerId = firstInBox();
    if (!sel || !runnerId) return;
    const r = dispatchRunner(unitId, runnerId, sel.value);
    if (!r.ok) { _flash('rnDispatchBtn', r.reason); return; }
    rerender();
  });

  document.getElementById('rnDismissBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const sel = document.getElementById('rnDismissSel');
    const runnerId = firstInBox();
    if (!sel || !runnerId) return;
    const r = dismissRunner(unitId, runnerId, sel.value);
    if (!r.ok) { _flash('rnDismissBtn', r.reason); return; }
    rerender();
  });
}

/** ボタンに理由を一時表示する */
function _flash(btnId, msg) {
  const b = document.getElementById(btnId);
  if (!b) return;
  const orig = b.textContent;
  b.textContent = msg;
  setTimeout(() => { if (b) b.textContent = orig; }, 2500);
}

/**
 * インパルス終了ボタン: 残りコマンドを繰越上限で切り捨てて保存する（§4.1.1 / §4.1.3）。
 * @param {string} unitId
 * @param {Function} refresh
 */
function _bindFinishButton(unitId, refresh) {
  document.getElementById('rpCmdFinish')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = finishImpulse(unitId);
    refresh();
    const btn = document.getElementById('rpCmdFinish');
    if (btn) {
      btn.textContent = r.lost > 0
        ? `Save ${r.saved}（上限${r.max}／${r.lost} は破棄）`
        : `Save ${r.saved}（上限${r.max}）`;
      setTimeout(() => { if (btn) btn.textContent = '⏹ インパルス終了（残りを Save）'; }, 4000);
    }
    const draw = document.getElementById('rpCmdDraw');
    if (draw) { draw.disabled = true; draw.textContent = _cmdDrawLabel(unitId); }
    document.dispatchEvent(new CustomEvent('board:changed'));
  });
}

/**
 * §4.1.2 の修正内訳を「4 −1(Green) +1(NoContact)」の形に整形する。
 * 最低値クランプが働いた場合はその旨も付ける。
 * @param {{base:number, mods:Array, raw:number, min:number, total:number}} r
 * @returns {string}
 */
function _fmtCommandMods(r) {
  const parts = r.mods.map(m => `${m.delta > 0 ? '+' : '−'}${Math.abs(m.delta)}(${m.label})`);
  let s = ` ${r.base}${parts.length ? ' ' + parts.join(' ') : ''}`;
  if (r.total !== r.raw) s += ` →最低${r.min}`;
  return s;
}

/**
 * コマンド取得ボタンのラベル。
 * CO Staff がイニシアチブで取る場合だけカードを引かないので文言を変える。
 * @param {string} unitId
 * @returns {string}
 */
function _cmdDrawLabel(unitId) {
  if (getCommandsDrawn(unitId)) return '✔ このターン取得済み';
  if (!getActivated(unitId) && hasFixedInitiative(unitId)) {
    return `＋${CO_STAFF_INITIATIVE_COMMANDS} コマンド取得（CO Staff固定・カード不要）`;
  }
  return '🃏 カードを引いてコマンド取得';
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

// ===== ドローロック =====
// カード引き中は他の操作（右クリックメニュー等）を禁止する。

function _isDrawLocked() {
  return document.body.dataset.drawLock === 'true';
}

function _setDrawLock(locked) {
  if (locked) {
    document.body.dataset.drawLock = 'true';
  } else {
    delete document.body.dataset.drawLock;
  }
}

// 他モジュール（card-context-menu.js の PC 解決フロー等）から共有するための公開版
export const isDrawLocked = _isDrawLocked;
export const setDrawLock  = _setDrawLock;

// ===== 戦闘解決ステップ制フロー =====

const _HIT_EFFECT_LABELS = {
  A: 'アサルトチーム', F: 'ファイアチーム', L: 'リッター',
  P: 'パラライズ',     C: 'カジュアルティ',
};

/** 現在進行中の戦闘解決ステート（null = 未実行）*/
let _combatState = null;

/**
 * 戦闘解決フローを開始する。
 * NCM を右パネルに表示し「カードを引く」ボタンを出す。
 */
function _startCombatFlow(unit, coord, ncm) {
  _combatState = { unit, coord, ncm, step: 'ready' };
  _setDrawLock(true);
  _renderCombatPanel();
}

/** 右パネルを現在のステートに合わせて描画 */
function _renderCombatPanel() {
  const el = document.getElementById('rpUnitInfo');
  if (!el || !_combatState) return;

  const { unit, coord, ncm, step, card1, result, card2, hitCode, experience } = _combatState;
  const sign   = ncm >= 0 ? '+' : '';
  const expMap = { vet: 'ベテラン', line: 'ライン', green: '新兵' };

  // ── 共通ヘッダー ──
  let html = `
    <div class="rp-unit-name">⚔ 戦闘解決 — ${coord}</div>
    <div class="rp-cs-unit">${unit.label}</div>
    <div class="rp-cs-ncm">NCM <span class="${ncm <= -2 ? 'rp-ncm-danger' : ncm <= 1 ? 'rp-ncm-warn' : 'rp-ncm-safe'}">${sign}${ncm}</span></div>
  `;

  // ── Step ready: カード1枚目を引く ──
  if (step === 'ready') {
    html += `<button class="rp-draw-btn" id="rpDrawBtn1">🃏 カードを引く</button>`;
  }

  // ── Step drawn1: 1枚目結果を表示 ──
  if (step === 'drawn1' || step === 'done') {
    const resCls = result.toLowerCase();
    html += `
      <div class="rp-cs-card">
        カード <strong>#${card1.number}</strong>
        → <span class="cr-result-${resCls}">${result}</span>
      </div>
    `;

    if (result === 'HIT' && step === 'drawn1') {
      // HITの場合のみ2枚目ボタンを表示
      html += `<button class="rp-draw-btn rp-draw-btn--hit" id="rpDrawBtn2">🃏 Hit Effect を引く</button>`;
    }
  }

  // ── Step done: 最終結果 ──
  if (step === 'done' && result === 'HIT' && hitCode) {
    const effects  = hitCode.split('').map(c => _HIT_EFFECT_LABELS[c] ?? c).join(' + ');
    const expLabel = expMap[experience] ?? experience;
    html += `
      <div class="rp-cs-card">
        カード <strong>#${card2.number}</strong>（${expLabel}）
        → <span class="rp-cs-effect">${effects}</span>
      </div>
    `;
  }

  if (step === 'done') {
    html += `<div class="rp-cs-done">✓ 適用完了</div>`;
  }

  el.innerHTML = html.trim();

  // ── ボタンにイベントをバインド ──
  document.getElementById('rpDrawBtn1')?.addEventListener('click', _onDraw1);
  document.getElementById('rpDrawBtn2')?.addEventListener('click', _onDraw2);
}

/** 「カードを引く」ボタン押下 */
function _onDraw1() {
  if (!_combatState || _combatState.step !== 'ready') return;

  const { unit, ncm } = _combatState;
  const { card, result } = resolveStep1(unit.id, ncm);

  _combatState.card1  = card;
  _combatState.result = result;
  _combatState.step   = (result === 'HIT') ? 'drawn1' : 'done';

  // HIT 以外はここでロック解除
  if (result !== 'HIT') _setDrawLock(false);

  _renderCombatPanel();
}

/** 「Hit Effect を引く」ボタン押下 */
function _onDraw2() {
  if (!_combatState || _combatState.step !== 'drawn1') return;

  const { unit } = _combatState;
  const { card, hitCode, experience } = resolveStep2(unit.id);

  _combatState.card2      = card;
  _combatState.hitCode    = hitCode;
  _combatState.experience = experience;
  _combatState.step       = 'done';

  _setDrawLock(false);
  _renderCombatPanel();
}
