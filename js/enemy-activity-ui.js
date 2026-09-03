// ===== 敵活動チェック（§8.6）右パネルUI =====
//
// カードをランダム順に見て、カード内は Pinned/LAT → Good Order → Leader の順で
// 1体ずつ判定する（§8.6.2）。セクションは自動判定した上で、盤面を見て
// 人間が違うと思えば上書きできる（VOFレーティング比較・PDF方向の厳密な
// 追跡は簡略化しているため）。「判定する」でカードを1枚引きR#を照合、
// 自動適用できる行動（No Action/Fall Back/除去+PC設置）はその場で盤面へ反映、
// それ以外（Rally・Grenade Attack等）は指示だけ表示し既存の手動UIに委ねる。

import {
  buildActivityCheckQueue, classifyUnit, rollActivity, applyActivityAction, isAutomated,
} from './enemy-activity.js';
import { unitCoordMap } from './state.js';
import { findUnitDef } from './command.js';

let _queue = null; // { units:[], idx, current:{unitId, ctx, sectionKey, rollResult, applyResult} }

function _unitLabel(id) {
  return document.querySelector(`.unit-slot[data-unit-id="${id}"] .unit-marker`)?.alt ?? findUnitDef(id)?.label ?? id;
}

function _startQueue() {
  const units = buildActivityCheckQueue('german');
  _queue = { units, idx: 0, current: null };
  _beginNext();
}

function _beginNext() {
  if (!_queue) return;
  if (_queue.idx >= _queue.units.length) { _render(); return; }
  const unitId = _queue.units[_queue.idx];
  if (!unitCoordMap.has(unitId)) { _queue.idx++; _beginNext(); return; } // 判定順に組んだ後に盤上から消えた場合はスキップ
  const ctx = classifyUnit(unitId);
  _queue.current = { unitId, ctx, sectionKey: ctx.section?.key ?? null, rollResult: null, applyResult: null };
  _render();
}

function _sectionsOf(ctx) { return ctx.def.sections; }

function _currentSection() {
  const cur = _queue?.current;
  if (!cur) return null;
  return _sectionsOf(cur.ctx).find(s => s.key === cur.sectionKey) ?? null;
}

function _onSectionChange(newKey) {
  _queue.current.sectionKey = newKey || null;
  _queue.current.rollResult = null;
  _render();
}

function _onRoll() {
  const cur = _queue.current;
  cur.rollResult = rollActivity(_currentSection(), cur.ctx.columnKey);
  _render();
}

function _onApply() {
  const cur = _queue.current;
  if (!cur.rollResult) return;
  cur.applyResult = applyActivityAction(cur.unitId, cur.rollResult.action);
  document.dispatchEvent(new CustomEvent('board:changed'));
  _render();
}

function _onNext() {
  _queue.idx++;
  _queue.current = null;
  _beginNext();
}

function _render() {
  const el = document.getElementById('enemyActivityResult');
  if (!el || !_queue) return;

  if (_queue.idx >= _queue.units.length) {
    el.innerHTML = `<div class="rp-cs-done">✓ 全${_queue.units.length}体の判定完了</div>`;
    return;
  }

  const cur = _queue.current;
  const label = _unitLabel(cur.unitId);
  const coord = unitCoordMap.get(cur.unitId);
  const hierarchyLabel = cur.ctx.isPinnedLat ? 'Pinned/LAT' : (cur.ctx.hierarchyKey === 'offensive' ? 'Offensive' : 'Defensive');
  const sections = _sectionsOf(cur.ctx);
  const noneOpt = `<option value="">（該当セクション無し → No Action）</option>`;
  const opts = noneOpt + sections.map(s =>
    `<option value="${s.key}" ${s.key === cur.sectionKey ? 'selected' : ''}>${s.label}</option>`).join('');

  let html = `<div class="rp-cs-unit">${label} @ ${coord}</div>
    <div class="rp-act-reason">${hierarchyLabel} 表・列「${cur.ctx.columnKey}」（${_queue.idx + 1}/${_queue.units.length}体目）</div>
    <div class="rp-act-row">
      <select class="rp-bnhq-select" id="eaSectionSel" style="flex:1">${opts}</select>
    </div>`;

  const section = _currentSection();
  if (section?.note) html += `<div class="rp-act-reason" style="color:#d4a05a">${section.note}</div>`;

  if (!cur.rollResult) {
    html += `<button class="rp-draw-btn" id="eaRollBtn">🃏 判定する</button>`;
  } else {
    const r = cur.rollResult;
    html += `<div class="rp-cs-card">${r.auto ? '自動成立' : `R#${r.r} → `}${r.label}</div>`;
    if (!cur.applyResult) {
      if (isAutomated(r.action)) {
        html += `<button class="rp-act-btn" id="eaApplyBtn">適用する</button>`;
      } else {
        html += `<div class="rp-act-reason">👤 手動で実行してください（右クリックメニュー等の既存UIで）</div>`;
      }
    } else {
      html += `<div class="rp-cs-done" style="color:${cur.applyResult.ok ? '#66aa66' : '#cc7755'}">${cur.applyResult.reason}</div>`;
    }
    html += `<button class="rp-draw-btn" id="eaNextBtn">次のユニットへ ▶</button>`;
  }

  el.innerHTML = html;
  document.getElementById('eaSectionSel')?.addEventListener('change', (e) => _onSectionChange(e.target.value));
  document.getElementById('eaRollBtn')?.addEventListener('click', _onRoll);
  document.getElementById('eaApplyBtn')?.addEventListener('click', _onApply);
  document.getElementById('eaNextBtn')?.addEventListener('click', _onNext);
}

export function initEnemyActivityUI() {
  document.getElementById('enemyActivityStartBtn')?.addEventListener('click', _startQueue);
}
