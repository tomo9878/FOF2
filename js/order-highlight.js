// ===== 命令範囲の可視化 =====
//
// 「今このHQが命令を出せる駒はどれか」を盤面上で色分けする補助表示。
// ルールそのものではなく、§4.1.1（指揮系統）＋ §4.3（通信）の判定結果を見えるようにするもの。
//
// 判定は `canGiveOrder()` を使う。これは
//   ① 指揮系統（Command Reference Table・PLT HQ は自小隊＋LAT のみ 等）
//   ② §4.3 通信（Visual-Verbal / 無線 / 電話）
// の2段で、Fire Team 面の HQ が自分にしか命令できないこと（§4.1.4）も含む。
// 「通信できるか」だけで塗ると、声は届くが指揮系統外（他小隊の分隊・上位のStaff）が
// 明るく見えてしまうため。
//
// 3段階で表示する:
//   通常          … 今の基準HQが命令できる
//   暗い          … 命令できない（理由は title 属性に出す）
//   暗い＋強調枠  … Pinned。通常の命令は通らないが
//                   「Pinned 解除の試み」とそれに続く Exhort だけは通る（§4.3.1 例外）

import { canGiveOrder, getCommandRole } from './command.js';
import { ORDER_KIND } from './comm.js';
import { unitCoordMap, getUnitState } from './state.js';

const CLS_DIM    = 'order-unreachable';
const CLS_PINNED = 'order-pinned-only';

let _enabled = false;
let _originId = null;

/** @returns {boolean} */
export function isOrderHighlightEnabled() { return _enabled; }

/** @returns {string|null} 基準にしているHQのユニットID */
export function getHighlightOrigin() { return _originId; }

/**
 * 基準となるHQを設定する（右パネルで選択したユニットが HQ/Staff のときに呼ぶ）。
 * HQ 以外を選んだ場合は基準を変えない（分隊を見ただけで表示が消えないように）。
 * @param {string} unitId
 */
export function setHighlightOrigin(unitId) {
  if (!getCommandRole(unitId)) return;
  _originId = unitId;
  refreshOrderHighlight();
}

/**
 * 表示の ON/OFF。
 * @param {boolean} on
 */
export function setOrderHighlightEnabled(on) {
  _enabled = !!on;
  refreshOrderHighlight();
}

/** 盤面（未配置プールは除く）にいるユニットスロットを列挙する */
function _boardUnitSlots() {
  return [...document.querySelectorAll('.terrain-card .unit-slot[data-unit-id]')];
}

/** 全スロットから可視化クラスと tooltip を取り除く */
function _clearAll() {
  _boardUnitSlots().forEach(slot => {
    slot.classList.remove(CLS_DIM, CLS_PINNED);
    if (slot.dataset.orderTitle) {
      slot.removeAttribute('title');
      delete slot.dataset.orderTitle;
    }
  });
}

/**
 * 盤面の色分けを更新する。
 * `board:changed`（移動・カバー・Pinned・電話線・回線切替 …）と
 * `impulse:changed` から呼ばれるので、状態が変わればひとりでに追従する。
 */
export function refreshOrderHighlight() {
  if (!_enabled || !_originId) { _clearAll(); return; }

  for (const slot of _boardUnitSlots()) {
    const id = slot.dataset.unitId;
    slot.classList.remove(CLS_DIM, CLS_PINNED);

    if (id === _originId) {                 // 基準HQ自身は常に通常表示
      slot.removeAttribute('title');
      delete slot.dataset.orderTitle;
      continue;
    }
    if (!unitCoordMap.has(id)) continue;    // 盤上にいない

    const normal = canGiveOrder(_originId, id);
    if (normal.ok) {
      slot.removeAttribute('title');
      delete slot.dataset.orderTitle;
      continue;
    }

    // Pinned で弾かれている場合、Pinned 解除の命令なら通るか確かめる（§4.3.1 例外）
    let cls = CLS_DIM;
    let reason = normal.reason;
    if (getUnitState(id).pinned) {
      const rally = canGiveOrder(_originId, id, ORDER_KIND.REMOVE_PINNED);
      if (rally.ok) {
        cls = CLS_PINNED;
        reason = 'Pinned：通常の命令は通らないが「Pinned 解除の試み」は出せる';
      }
    }
    slot.classList.add(cls);
    slot.title = reason;
    slot.dataset.orderTitle = '1';
  }
}

/**
 * 初期化。ヘッダーのトグルを繋ぎ、盤面変更に追従させる。
 */
export function initOrderHighlight() {
  const cb = document.getElementById('orderHighlightToggle');
  if (cb) {
    cb.addEventListener('change', () => setOrderHighlightEnabled(cb.checked));
    _enabled = cb.checked;
  }
  document.addEventListener('board:changed', refreshOrderHighlight);
  document.addEventListener('impulse:changed', refreshOrderHighlight);
  refreshOrderHighlight();
}
