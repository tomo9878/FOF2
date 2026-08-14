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
import { hasLOS, cardDistance } from './los.js';
import { getCommandRole, findUnitsByCommandRole, findUnitDef } from './command.js';
import { RT_MODELS, NETWORK_DEF, RADIO_TYPE, TYPE_STRICTNESS } from './data/radios.js';
import { canReachByPhone } from './phone.js';

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

// ===== RT（無線・電話）の保有管理 =====
//
// unitId → [{ model:'SCR536', network:'CO_TAC', dead:false }, ...]
// 1ユニットが複数の網の RT を持つこともある（例: FO が MTR FD と CO TAC）。

/** unitId → RT の配列 */
export const unitRTMap = new Map();

/**
 * ユニットに RT を持たせる。
 * @param {string} unitId
 * @param {string} model   - RT_MODELS のキー
 * @param {string} network - NETWORK のキー
 */
export function assignRT(unitId, model, network) {
  if (!RT_MODELS[model] || !NETWORK_DEF[network]) return false;
  if (!unitRTMap.has(unitId)) unitRTMap.set(unitId, []);
  unitRTMap.get(unitId).push({ model, network, dead: false });
  return true;
}

/**
 * @param {string} unitId
 * @returns {Array<{model:string, network:string, dead:boolean}>}
 */
export function getRTs(unitId) {
  return (unitRTMap.get(unitId) ?? []).filter(rt => !rt.dead);
}

/** 全 RT を消す（リセット用） */
export function clearRTs() { unitRTMap.clear(); }

/**
 * その網をそのユニットが使えるか（§4.3.3 のネットワークごとの制限）。
 * ユニット定義の `radioRole`（'arty_fo' 等）と commandRole の両方を見る。
 * @param {string} unitId
 * @param {string} network
 * @returns {boolean}
 */
export function canUseNetwork(unitId, network) {
  const def = NETWORK_DEF[network];
  if (!def) return false;
  const role = getCommandRole(unitId);
  const tag  = findUnitDef(unitId)?.radioRole ?? null;
  if (def.denyRoleTags?.includes(tag)) return false;
  if (def.allowRoles?.includes(role)) return true;
  if (def.allowRoleTags?.includes(tag)) return true;
  // 役職の指定が無い網（＝タグでのみ判定する網）は上で弾かれている
  return false;
}

/**
 * その世代の無線で2ユニット間が届くか。
 * @param {string} type - RADIO_TYPE
 * @param {string} fromId
 * @param {string} toId
 * @returns {{ok:boolean, reason:string}}
 */
function _radioReach(type, fromId, toId) {
  const fromCoord = unitCoordMap.get(fromId);
  const toCoord   = unitCoordMap.get(toId);

  if (type === RADIO_TYPE.B) {
    // 同一網ならマップ上どこでも・盤外とも通信できる
    return { ok: true, reason: '' };
  }

  if (type === RADIO_TYPE.A) {
    // カバーマーカーの下からは機能しない（どちらの端でも不可）
    if (getUnitCoverSlot(fromId)) return { ok: false, reason: '発令者がカバーの下（初期携帯無線は使えない）' };
    if (getUnitCoverSlot(toId))   return { ok: false, reason: '対象がカバーの下（初期携帯無線は使えない）' };
    if (!fromCoord || !toCoord)   return { ok: false, reason: '初期携帯無線は盤外とは通信できない' };
    // LOS が通ること（昼として扱い、煙は無視 → los.js の素の判定をそのまま使う）
    if (!hasLOS(fromCoord, toCoord)) return { ok: false, reason: '視線が通らない（初期携帯無線は LOS 内のみ）' };
    return { ok: true, reason: '' };
  }

  if (type === RADIO_TYPE.C) {
    if (!fromCoord || !toCoord) return { ok: false, reason: '先進携帯無線は盤外とは通信できない' };
    const d = cardDistance(fromCoord, toCoord);
    if (d === null || d > 1) return { ok: false, reason: '先進携帯無線は同一カードと隣接カードまで' };
    return { ok: true, reason: '' };
  }

  return { ok: false, reason: '不明な無線種別' };
}

/**
 * 無線で通信できるか（§4.3.3 / §4.3.5）。
 * 両端が同じ網の無線を持ち、その網を使う資格があり、世代ごとの到達条件を満たすこと。
 * 両端で機種が違う場合は**厳しい方**の世代を適用する。
 * @param {string} fromId
 * @param {string} toId
 * @returns {{ok:boolean, network:string|null, type:string|null, reason:string}}
 */
export function canReachByRadio(fromId, toId) {
  const fromRTs = getRTs(fromId).filter(rt => RT_MODELS[rt.model]?.kind === 'radio');
  const toRTs   = getRTs(toId).filter(rt => RT_MODELS[rt.model]?.kind === 'radio');
  if (!fromRTs.length) return { ok: false, network: null, type: null, reason: '発令者が無線を持っていない' };
  if (!toRTs.length)   return { ok: false, network: null, type: null, reason: '対象が無線を持っていない' };

  let lastReason = '同じネットワークの無線が無い';
  for (const a of fromRTs) {
    for (const b of toRTs) {
      if (a.network !== b.network) continue;
      const net = a.network;
      const def = NETWORK_DEF[net];

      if (!canUseNetwork(fromId, net) || !canUseNetwork(toId, net)) {
        lastReason = `${def.label} はこのユニットが使えない網（${def.note}）`;
        continue;
      }

      // §4.3.3-1 CO TAC は CO HQ の RT がハブ。どちらかの端がハブであること
      if (def.hubRole) {
        const hubIds = findUnitsByCommandRole(def.hubRole);
        if (!hubIds.includes(fromId) && !hubIds.includes(toId)) {
          lastReason = `${def.label} は ${def.hubRole.toUpperCase()} を経由する必要がある`;
          continue;
        }
      }

      // 世代は厳しい方を採用
      const ta = RT_MODELS[a.model].type;
      const tb = RT_MODELS[b.model].type;
      const type = TYPE_STRICTNESS[ta] >= TYPE_STRICTNESS[tb] ? ta : tb;

      const reach = _radioReach(type, fromId, toId);
      if (reach.ok) return { ok: true, network: net, type, reason: `${def.label}（${type}型）` };
      lastReason = `${def.label}: ${reach.reason}`;
    }
  }
  return { ok: false, network: null, type: null, reason: lastReason };
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

  // ── §4.3.1 Visual-Verbal ──
  const vv = _tryVisualVerbal(fromId, toId, orderKind);
  if (vv.ok) return vv;

  // ── §4.3.5 無線 ──
  // 無線は Visual-Verbal 圏外（別カード・別エリア・盤外・Pinned）でも通る
  const radio = canReachByRadio(fromId, toId);
  if (radio.ok) {
    return { ok: true, via: COMM_METHOD.RADIO, reason: radio.reason };
  }

  // ── §4.3.4 電話 ──
  // 電話も Visual-Verbal 圏外（別カード・別エリア・Pinned）で通る。カバー下でも使える
  const phone = canReachByPhone(fromId, toId, unitRTMap, canUseNetwork, findUnitsByCommandRole);
  if (phone.ok) {
    return { ok: true, via: COMM_METHOD.PHONE, reason: phone.reason };
  }

  // ※ ランナー（§4.3.2）は「通信」ではなく翌ターンの起動を届ける手段なので
  //    canCommunicate() の経路には含めない（runner.js が別に扱う）

  return {
    ok: false, via: null,
    reason: `${vv.reason} ／ 無線: ${radio.reason} ／ 電話: ${phone.reason}`,
  };
}

/**
 * §4.3.1 Visual-Verbal の判定。
 * @param {string} fromId
 * @param {string} toId
 * @param {string} orderKind
 * @returns {{ok:boolean, via:string|null, reason:string}}
 */
function _tryVisualVerbal(fromId, toId, orderKind) {
  const fromCoord = unitCoordMap.get(fromId);
  const toCoord   = unitCoordMap.get(toId);
  if (!fromCoord || !toCoord) {
    return { ok: false, via: null, reason: '盤上にいないので声は届かない' };
  }

  const fromArea = getAreaKey(fromId);
  const toArea   = getAreaKey(toId);
  if (fromArea !== toArea) {
    return {
      ok: false, via: null,
      reason: fromCoord === toCoord
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
