// ===== Rally アクション（§4.2.3 / §6.5.1）=====
//
// FOF.pdf p.24 §4.2.3「Rally Actions」／ p.48 §6.5.1「Rally」
//
// ── 共通の判定（§6.5.1）──
//   「success is automatic if there is **no VOF on the card**, otherwise
//     draw 2 cards, modified by the **Experience of the unit giving the order**
//     (HQ, or Self if attempting in General Initiative),
//     and look for the word "Rally" in the Action Attempt Section.」
//   ＝ 対象のカードに VOF が無ければ自動成功。あれば
//      「2枚 ± 発令者の練度」を引き、`type === 'rally'` のカードが1枚でもあれば成功。
//   ※ §4.2.3 の見出しも「Use **Originator's** Experience Level for Command draw modifier」。
//      移動（§4.2.2）が **Recipient** の練度なのと逆なので注意。
//
// ── コスト ──
//   全アクション1コマンド（§4.2.3i Reconstitute Squad だけは
//   General Initiative でも HQ/Staff が発令者でなければならない・§4.1.3）
//
// ── 通信の例外（§6.5.1 / §4.3.1）──
//   Pinned 解除の命令だけは、Pinned でも Visual-Verbal が通るものとして扱う。
//   → `ORDER_KIND.REMOVE_PINNED` を canGiveOrder に渡す。

import { canGiveOrder, getCurrentAP, canExpendCommand, expendCommand, findUnitDef } from './command.js';
import { ORDER_KIND } from './comm.js';
import { cardVOFMap } from './vof.js';
import {
  unitCoordMap, getUnitState, getUnitStrength, setUnitSteps, renderUnitBadges,
} from './state.js';
import { getUnitExperience } from './campaign.js';

/** Rally アクションのコマンド消費量（§4.2.3 は全て1） */
export const RALLY_COST = 1;

/** 引く枚数の基準（§6.5.1「draw 2 cards」） */
export const RALLY_BASE_DRAW = 2;

/** LAT の見た目（hit.js の _HIT_INFO と同じ画像を使う） */
const LAT_LOOK = {
  assault:   { src: 'images/LAT_Assault Team-W.png',        label: 'アサルトチーム' },
  fireteam:  { src: 'images/LAT_Fire Team-W.png',           label: 'ファイアチーム' },
  litter:    { src: 'images/Counter LAT - Litter Team.png', label: 'リッター' },
  paralyzed: { src: 'images/Counter LAT - Paralyzed.png',   label: 'パラライズ' },
};

/** 盤上の駒の画像・ラベルを差し替える（LAT の種別変更用） */
function _swapLook(unitId, look) {
  const slot = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
  const img = slot?.querySelector('.unit-marker');
  if (img) { img.src = look.src; img.alt = look.label; img.title = look.label; }
}

/** その駒の現在の LAT 種別を画像から判定する */
function _latKind(unitId) {
  const slot = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
  const src = slot?.querySelector('.unit-marker')?.getAttribute('src') ?? '';
  if (src.includes('Assault Team')) return 'assault';
  if (src.includes('Fire Team'))    return 'fireteam';
  if (src.includes('Litter'))       return 'litter';
  if (src.includes('Paralyzed'))    return 'paralyzed';
  return null;
}

/** named Fire Team を持つ駒か（HQ・武器チーム等） */
function _hasFireTeamSide(unitId) {
  return !!getUnitStrength(unitId)?.namedFireTeam;
}

/** Fire Team 面（裏）にいるか */
function _isOnFireTeamSide(unitId) {
  const s = getUnitStrength(unitId);
  return !!s?.namedFireTeam && s.steps < s.maxSteps;
}

/**
 * §4.2.3 のアクション定義。
 *   draw: 'rally' … VOF が無ければ自動、あれば「2±練度」枚引いて "Rally" を探す
 *   draw: 'auto'  … 常に自動成功
 */
export const RALLY_ACTIONS = {
  remove_pinned: {
    label: 'Pinned 解除を試みる', ref: '§4.2.3a', draw: 'rally',
    orderKind: ORDER_KIND.REMOVE_PINNED,
    eligible: (id) => getUnitState(id).pinned
      ? { ok: true } : { ok: false, reason: 'Pinned ではない' },
    apply: (id) => { getUnitState(id).pinned = false; renderUnitBadges(id); },
  },
  paralyzed_to_litter: {
    label: 'Paralyzed → Litter', ref: '§4.2.3b', draw: 'rally',
    eligible: (id) => _latKind(id) !== 'paralyzed' ? { ok: false, reason: 'Paralyzed Team ではない' }
      : getUnitState(id).pinned ? { ok: false, reason: 'Pinned は不可' } : { ok: true },
    apply: (id) => _swapLook(id, LAT_LOOK.litter),
  },
  litter_to_fireteam: {
    label: 'Litter → Fire Team', ref: '§4.2.3c', draw: 'rally',
    eligible: (id) => _latKind(id) !== 'litter' ? { ok: false, reason: 'Litter Team ではない' }
      : getUnitState(id).pinned ? { ok: false, reason: 'Pinned は不可' } : { ok: true },
    apply: (id) => _swapLook(id, LAT_LOOK.fireteam),
  },
  fireteam_to_assault: {
    label: 'Fire Team → Assault Team', ref: '§4.2.3d', draw: 'rally',
    eligible: (id) => _latKind(id) !== 'fireteam' ? { ok: false, reason: 'Fire Team ではない' }
      : getUnitState(id).pinned ? { ok: false, reason: 'Pinned は不可' } : { ok: true },
    apply: (id) => _swapLook(id, LAT_LOOK.assault),
  },
  assault_to_fireteam: {
    label: 'Assault Team → Fire Team', ref: '§4.2.3e', draw: 'auto',
    eligible: (id) => _latKind(id) !== 'assault' ? { ok: false, reason: 'Assault Team ではない' }
      : getUnitState(id).pinned ? { ok: false, reason: 'Pinned は不可' } : { ok: true },
    apply: (id) => _swapLook(id, LAT_LOOK.fireteam),
  },
  flip_to_front: {
    label: 'Fire Team 面を表に戻す', ref: '§4.2.3f', draw: 'rally',
    eligible: (id) => !_hasFireTeamSide(id) ? { ok: false, reason: 'Fire Team 面を持たない駒' }
      : !_isOnFireTeamSide(id) ? { ok: false, reason: 'すでに表（Good Order 面）' }
      : getUnitState(id).pinned ? { ok: false, reason: 'Pinned は不可' } : { ok: true },
    apply: (id) => { const s = getUnitStrength(id); setUnitSteps(id, s.maxSteps); },
  },
  flip_to_fireteam: {
    label: 'Fire Team 面へ裏返す', ref: '§4.2.3j', draw: 'auto',
    eligible: (id) => !_hasFireTeamSide(id) ? { ok: false, reason: 'Fire Team 面を持たない駒' }
      : _isOnFireTeamSide(id) ? { ok: false, reason: 'すでに Fire Team 面' }
      : getUnitState(id).pinned ? { ok: false, reason: 'Pinned は不可' } : { ok: true },
    apply: (id) => { const s = getUnitStrength(id); setUnitSteps(id, s.maxSteps - 1); },
  },
};

/**
 * 発令者の練度による引き枚数の修正（§6.5.1「modified by the Experience of
 * the unit giving the order」）。Veteran は多く、Green は少なく引く。
 * @param {string} originatorId
 * @returns {number}
 */
export function rallyDrawModifier(originatorId) {
  const exp = getUnitExperience(originatorId);
  if (exp === 'vet')   return +1;
  if (exp === 'green') return -1;
  return 0;
}

/**
 * そのアクションを実行できるか。
 * @param {string} originatorId - 発令者（HQ/Staff）
 * @param {string} targetId
 * @param {string} actionKey
 * @returns {{ok:boolean, reason:string}}
 */
export function canDoRallyAction(originatorId, targetId, actionKey) {
  const def = RALLY_ACTIONS[actionKey];
  if (!def) return { ok: false, reason: '不明なアクション' };
  if (!unitCoordMap.has(targetId)) return { ok: false, reason: '対象が盤上にいない' };

  const el = def.eligible(targetId);
  if (!el.ok) return { ok: false, reason: el.reason };

  if (getCurrentAP(originatorId) < RALLY_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(originatorId)) return { ok: false, reason: 'このインパルスの消費上限に達している' };

  // §4.2.3 は全て発令者が HQ or Staff。指揮系統＋通信は canGiveOrder が見る
  const order = canGiveOrder(originatorId, targetId, def.orderKind);
  if (!order.ok) return { ok: false, reason: order.reason };
  return { ok: true, reason: '' };
}

/**
 * 判定の段取りを返す（カードは引かない）。
 * @param {string} originatorId
 * @param {string} targetId
 * @param {string} actionKey
 * @returns {{auto:boolean, draws:number, reason:string}}
 */
export function planRallyAction(originatorId, targetId, actionKey) {
  const def = RALLY_ACTIONS[actionKey];
  if (def.draw === 'auto') return { auto: true, draws: 0, reason: '自動成功のアクション' };

  const coord = unitCoordMap.get(targetId);
  if (!cardVOFMap.get(coord)?.type) {
    return { auto: true, draws: 0, reason: 'カードに VOF が無いので自動成功（§6.5.1）' };
  }
  const draws = Math.max(0, RALLY_BASE_DRAW + rallyDrawModifier(originatorId));
  return { auto: false, draws, reason: `VOF があるので ${draws} 枚引いて "Rally" を探す` };
}

/**
 * 1コマンド消費する（アクション開始時に呼ぶ）。
 * @param {string} originatorId
 */
export function payRallyCost(originatorId) { expendCommand(originatorId); }

/**
 * 引いたカード群から成否を判定する。
 * @param {Array<{type:string}>} cards
 * @returns {boolean} "Rally" があれば成功
 */
export function isRallySuccess(cards) {
  return cards.some(c => c?.type === 'rally');
}

/**
 * 成功時の効果を適用する。
 * @param {string} targetId
 * @param {string} actionKey
 */
export function applyRallyAction(targetId, actionKey) {
  RALLY_ACTIONS[actionKey]?.apply(targetId);
}

/**
 * その駒に対して今出せる Rally アクションを列挙する（不可のものも理由つき）。
 * @param {string} originatorId
 * @param {string} targetId
 * @returns {Array<{key:string, label:string, ref:string, ok:boolean, reason:string, auto:boolean, draws:number}>}
 */
export function listRallyActions(originatorId, targetId) {
  return Object.entries(RALLY_ACTIONS).map(([key, def]) => {
    const check = canDoRallyAction(originatorId, targetId, key);
    const plan = check.ok ? planRallyAction(originatorId, targetId, key) : { auto: false, draws: 0 };
    return { key, label: def.label, ref: def.ref, ok: check.ok, reason: check.reason, ...plan };
  });
}
