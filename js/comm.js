// ===== 通信（§4.3 Communication）=====
//
// FOF.pdf p.27 §4.3
//   「To order a unit to perform an action, the Originator (the ordering HQ or Staff)
//     must be able to communicate with the Recipient unit.」
//
// 通信手段は4つ。このモジュールはまず **Visual-Verbal（§4.3.1）** だけを実装し、
// 無線（§4.3.5）・電話（§4.3.4）・ランナー（§4.3.2）は後続ステップで足す。
// 実装計画は COMMUNICATION_SPEC.md（Step1〜4）を参照。
//
// ── §4.3.1 Visual-Verbal（装備不要の基本手段）──
//   ・両者が **Unpinned** であること
//   ・両者が **同じカードの同じエリア** にいること
//       - 同じ Cover マーカーの下
//       - どちらもカバー外
//       - 同じ Building Area（§13 Urban。**当面対象外**）
//   ・例外: Pinned ユニットにも「Attempt to Remove Pinned marker」命令
//     （およびそれに続く Exhort）は Visual-Verbal で出せる。Pinned は無視される
//   ・Note: Cease Fire（§4.2.4k）と Shift Fire（§4.2.4l）は、Visual-Verbal の
//     可否や Pinned 状態に関係なく **そのカードの全員** に伝わる

import { unitCoordMap, getUnitState } from './state.js';
import { getUnitCoverSlot } from './cover.js';

/** 通信手段 */
export const COMM_METHOD = {
  SELF:          'self',           // 自分自身への命令
  VISUAL_VERBAL: 'visual_verbal',  // §4.3.1
  SAME_CARD:     'same_card',      // §4.3.1 Note（Cease Fire / Shift Fire）
  RADIO:         'radio',          // §4.3.5（Step2）
  PHONE:         'phone',          // §4.3.4（Step3）
};

/**
 * 命令の種別。通信の例外に関わるものだけを区別する。
 * 通常の命令は NORMAL でよい。
 */
export const ORDER_KIND = {
  NORMAL:        'normal',
  REMOVE_PINNED: 'remove_pinned',  // §4.2.3a Attempt to Remove a Pinned marker
  EXHORT:        'exhort',         // §4.2.1b Exhort（Remove Pinned に続くもの）
  CEASE_FIRE:    'cease_fire',     // §4.2.4k
  SHIFT_FIRE:    'shift_fire',     // §4.2.4l
};

/** Pinned を無視して Visual-Verbal が通る命令（§4.3.1 例外） */
const IGNORES_PINNED = new Set([ORDER_KIND.REMOVE_PINNED, ORDER_KIND.EXHORT]);

/** カード上の全員に伝わる命令（§4.3.1 Note） */
const REACHES_WHOLE_CARD = new Set([ORDER_KIND.CEASE_FIRE, ORDER_KIND.SHIFT_FIRE]);

/**
 * そのユニットがいる「エリア」の識別子を返す。
 * 同じカードでも別の Cover マーカーの下なら別エリアになる（§4.3.1）。
 * @param {string} unitId
 * @returns {string|null} エリアID（盤上にいなければ null）
 */
export function getAreaKey(unitId) {
  const coord = unitCoordMap.get(unitId);
  if (!coord) return null;
  // ※ §13 Urban の Building Area は未実装。実装時はここにエリア種別を足す
  const slot = getUnitCoverSlot(unitId);
  return slot ? `${coord}#${slot.slotId}` : `${coord}#open`;
}

/**
 * 発令者が対象と通信できるか（§4.3）。
 * @param {string} fromId - 発令者（Originator）
 * @param {string} toId   - 対象（Recipient）
 * @param {string} [orderKind=ORDER_KIND.NORMAL] - 命令の種別（例外判定用）
 * @returns {{ok:boolean, via:string|null, reason:string}}
 */
export function canCommunicate(fromId, toId, orderKind = ORDER_KIND.NORMAL) {
  if (fromId === toId) {
    return { ok: true, via: COMM_METHOD.SELF, reason: '自分自身' };
  }

  const fromCoord = unitCoordMap.get(fromId);
  const toCoord   = unitCoordMap.get(toId);

  // §4.3.1 Note: Cease Fire / Shift Fire は同じカードなら全員に伝わる
  // （Visual-Verbal の可否も Pinned も問わない）
  if (REACHES_WHOLE_CARD.has(orderKind) && fromCoord && fromCoord === toCoord) {
    return { ok: true, via: COMM_METHOD.SAME_CARD, reason: '同じカードの全員に伝わる命令' };
  }

  if (!fromCoord) return { ok: false, via: null, reason: '発令者が盤上にいない（無線・電話が必要）' };
  if (!toCoord)   return { ok: false, via: null, reason: '対象が盤上にいない（無線・電話が必要）' };

  // ── §4.3.1 Visual-Verbal ──
  const fromArea = getAreaKey(fromId);
  const toArea   = getAreaKey(toId);
  if (fromArea !== toArea) {
    const sameCard = fromCoord === toCoord;
    return {
      ok: false, via: null,
      reason: sameCard
        ? '同じカードだが別エリア（別のカバーマーカー）なので声が届かない'
        : '別のカードなので声が届かない',
    };
  }

  // 例外に該当しない限り、両者とも Unpinned であること
  if (!IGNORES_PINNED.has(orderKind)) {
    if (getUnitState(fromId).pinned) return { ok: false, via: null, reason: '発令者が Pinned' };
    if (getUnitState(toId).pinned)   return { ok: false, via: null, reason: '対象が Pinned' };
  }

  return { ok: true, via: COMM_METHOD.VISUAL_VERBAL, reason: '同じカードの同じエリア' };
}

/**
 * 通信手段の表示名。
 * @param {string|null} via
 * @returns {string}
 */
export function commMethodLabel(via) {
  switch (via) {
    case COMM_METHOD.SELF:          return '自分自身';
    case COMM_METHOD.VISUAL_VERBAL: return 'Visual-Verbal';
    case COMM_METHOD.SAME_CARD:     return '同カード伝達';
    case COMM_METHOD.RADIO:         return '無線';
    case COMM_METHOD.PHONE:         return '電話';
    default:                        return '通信不能';
  }
}
