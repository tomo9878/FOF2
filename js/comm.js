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
import {
  getCommandRole, findUnitsByCommandRole, findUnitDef,
  getCurrentAP, canExpendCommand, expendCommand, canGiveOrder,
} from './command.js';
import { rollR } from './data/scenario-tables.js';
import { RT_MODELS, NETWORK_DEF, RADIO_TYPE, TYPE_STRICTNESS } from './data/radios.js';
import { canReachByPhone, setPhoneLineStock, isStagingArea } from './phone.js';

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

/** その座標が row 1（スタートエリアに接する行）か */
function _isRow1(coord) {
  return /^[A-Z]+1$/.test(coord ?? '');
}

/**
 * §2.5A のスタートエリア LOS 例外に当たるか。
 *   ・スタートエリア内どうし → 常に LOS あり
 *   ・スタートエリア ⇔ 隣接する row 1 のカード → LOS あり
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function _stagingLOS(a, b) {
  const sa = isStagingArea(a), sb = isStagingArea(b);
  if (sa && sb) return true;                       // スタートエリア内は自動で LOS
  if (!sa && !sb) return false;
  const mapCoord = sa ? b : a;
  return _isRow1(mapCoord) && cardDistance(a, b) === 1;
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
    // §2.5A（p.12）スタートエリアの LOS 例外
    //   「A Line of Sight exists for communication purposes between all cards in the
    //     Main Staging Area … you may automatically use all radios that require LOS」
    //   「LOS for radio communication exists between cards in the Staging Area and
    //     adjacent map cards on row 1」
    if (_stagingLOS(fromCoord, toCoord)) return { ok: true, reason: '' };
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

// ===== RT の戦闘損害・遺棄・回収・網の載せ替え =====
//
// FOF.pdf p.29 §4.3.4「Combat Damage to Field Phones」／ p.30 §4.3.5「Combat Damage to Radios」
//   電話・無線とも同じ規定:
//   「If the last or only step of a unit with a radio/phone becomes a Casualty,
//     there is a 1-in-2 chance (R#1/2) that it will be destroyed.
//     If destroyed, remove it from play, otherwise place the marker on the map.
//     You can have another unit pick it up and use it if commanded to do so (4.2.2h).」
//
// §4.2.2h Pick up（p.23・コスト1・Auto・発令者 Any HQ or Staff・対象 Any Good Order unit）
//   「Have an infantry unit pick up items from the card」。拾った駒は **Exposed** になる。
//
// §4.2.1j Switch Radio/Phone to a Different Network（p.22・コスト1・Auto）
//   「Replace the same kind of radio or phone with one that has been Removed from Play.」
//   例: SCR300 BN TAC が破壊されたら、SCR300 Mtr FD NET を BN TAC に載せ替えられる。
//   → **同じ機種**で、**破壊されて Removed from Play になった網**にだけ移せる。

/** coord → [{model, network}] 盤上に落ちている RT */
export const droppedRTMap = new Map();

/** Removed from Play になった RT（§4.2.1j の載せ替え先になる） */
export const removedRTs = [];

/** 遺棄/破壊の状態をクリア（リセット用） */
export function clearRTDamage() { droppedRTMap.clear(); removedRTs.length = 0; }

/**
 * RT カウンターの画像パス（images/Net - {網} - {機種}.png）。
 * @param {{model:string, network:string}} rt
 * @returns {string}
 */
export function rtImage(rt) {
  const netLabel = NETWORK_DEF[rt.network]?.label ?? rt.network;
  return `images/Net - ${netLabel} - ${rt.model}.png`;
}

/**
 * §4.3.4 / §4.3.5 戦闘損害チェック。
 * 「最後の（唯一の）ステップが Casualty になった」ユニットについて呼ぶ。
 * 持っている RT ごとに R#1/2 を振り、破壊なら Removed from Play、
 * 残れば同じカードに落とす。どちらでもそのユニットからは失われる。
 * @param {string} unitId
 * @returns {Array<{model:string, network:string, r:number, destroyed:boolean, card:object}>}
 */
export function checkRTCombatDamage(unitId) {
  const rts = unitRTMap.get(unitId);
  if (!rts?.length) return [];
  const coord = unitCoordMap.get(unitId);
  const results = [];

  for (const rt of rts) {
    if (rt.dead) continue;
    const { r, card } = rollR(2);
    const destroyed = r === 1;                 // R#1/2
    if (destroyed) {
      removedRTs.push({ model: rt.model, network: rt.network });
    } else if (coord) {
      if (!droppedRTMap.has(coord)) droppedRTMap.set(coord, []);
      droppedRTMap.get(coord).push({ model: rt.model, network: rt.network });
    }
    rt.dead = true;
    results.push({ model: rt.model, network: rt.network, r, destroyed, card });
  }
  unitRTMap.delete(unitId);
  if (coord) renderDroppedRTs(coord);
  return results;
}

/**
 * §4.2.2h 落ちている RT を拾えるか。
 * @param {string} recipientId - 拾う駒（同じカードの Good Order ユニット）
 * @param {string} coord
 * @returns {{ok:boolean, reason:string, originatorId:string|null}}
 */
export function canPickUpRT(recipientId, coord) {
  const NG = (reason) => ({ ok: false, reason, originatorId: null });
  if (!(droppedRTMap.get(coord) ?? []).length) return NG('このカードに落ちている RT がない');
  if (unitCoordMap.get(recipientId) !== coord)  return NG('拾う駒がそのカードにいない');
  if (getUnitState(recipientId).pinned)         return NG('Pinned の駒は拾えない');

  // 発令者: 同カードに限らないが、対象と通信できる HQ/Staff で、コマンドが払えること
  const originatorId = _findOriginatorFor(recipientId);
  if (!originatorId) return NG('命令できる HQ/Staff がいない（通信・コマンドを確認）');
  return { ok: true, reason: '', originatorId };
}

/**
 * §4.2.2h 実行。1コマンド消費、拾った駒は Exposed になる。
 * @param {string} recipientId
 * @param {string} coord
 * @param {number} [index=0] - 落ちている RT のインデックス
 * @returns {{ok:boolean, reason:string, rt:object|null}}
 */
export function pickUpRT(recipientId, coord, index = 0) {
  const check = canPickUpRT(recipientId, coord);
  if (!check.ok) return { ...check, rt: null };
  const list = droppedRTMap.get(coord);
  const rt = list[index];
  if (!rt) return { ok: false, reason: '対象の RT がない', rt: null };

  expendCommand(check.originatorId);
  list.splice(index, 1);
  if (!list.length) droppedRTMap.delete(coord);
  assignRT(recipientId, rt.model, rt.network);
  getUnitState(recipientId).exposed = true;    // §4.2.2h「Mark any infantry units involved Exposed」
  renderDroppedRTs(coord);
  return { ok: true, reason: '', rt };
}

/**
 * §4.2.1j 網の載せ替え先の候補（同じ機種で Removed from Play になった網）。
 * @param {string} unitId
 * @param {number} rtIndex
 * @returns {string[]} 載せ替え可能なネットワークのキー
 */
export function switchableNetworks(unitId, rtIndex) {
  const rt = (unitRTMap.get(unitId) ?? [])[rtIndex];
  if (!rt || rt.dead) return [];
  return removedRTs
    .filter(x => x.model === rt.model && x.network !== rt.network)
    .map(x => x.network);
}

/**
 * §4.2.1j 実行。1コマンド消費し、同じ機種のまま網を載せ替える。
 * @param {string} unitId
 * @param {number} rtIndex
 * @param {string} toNetwork
 * @returns {{ok:boolean, reason:string}}
 */
export function switchRTNetwork(unitId, rtIndex, toNetwork) {
  const rt = (unitRTMap.get(unitId) ?? [])[rtIndex];
  if (!rt || rt.dead) return { ok: false, reason: 'その RT が無い' };
  const slot = removedRTs.findIndex(x => x.model === rt.model && x.network === toNetwork);
  if (slot < 0) {
    return { ok: false, reason: `${NETWORK_DEF[toNetwork]?.label ?? toNetwork} の同型 RT が Removed from Play になっていない` };
  }
  const originatorId = _findOriginatorFor(unitId);
  if (!originatorId) return { ok: false, reason: '命令できる HQ/Staff がいない（通信・コマンドを確認）' };

  expendCommand(originatorId);
  removedRTs.splice(slot, 1);
  rt.network = toNetwork;
  return { ok: true, reason: '' };
}

/**
 * その駒に命令を出せる HQ/Staff を探す（コマンドが払えて通信できること）。
 * @param {string} targetId
 * @returns {string|null}
 */
function _findOriginatorFor(targetId) {
  for (const [unitId] of unitCoordMap) {
    if (!getCommandRole(unitId)) continue;
    if (getCurrentAP(unitId) < 1 || !canExpendCommand(unitId)) continue;
    if (canGiveOrder(unitId, targetId).ok) return unitId;
  }
  return null;
}

/**
 * カード上の「落ちている RT」マーカーを描き直す。
 * @param {string} coord
 */
export function renderDroppedRTs(coord) {
  const card = document.querySelector(`.terrain-card[data-coord="${coord}"]`);
  if (!card) return;
  card.querySelectorAll('.dropped-rt-marker').forEach(el => el.remove());
  (droppedRTMap.get(coord) ?? []).forEach((rt, i) => {
    const img = document.createElement('img');
    img.className = 'dropped-rt-marker';
    img.src = rtImage(rt);
    img.title = `落ちている ${rt.model}（${NETWORK_DEF[rt.network]?.label ?? rt.network}）`;
    img.style.right = `${6 + i * 20}px`;
    card.appendChild(img);
  });
}

/** 全カードの遺棄 RT を描き直す */
export function renderAllDroppedRTs() {
  document.querySelectorAll('.terrain-card[data-coord]').forEach(el => renderDroppedRTs(el.dataset.coord));
}

// ===== シナリオからの通信資産投入 =====
//
// campaign p.12 TO&E の「Assets / Ammo per Mission」＋ p.13 CSR1 を
// シナリオ定義の `comms` として持ち、ここで実際の保有 RT に展開する。

let _coTacMode = 'radio';   // 'radio' | 'phone'

/** @returns {'radio'|'phone'} */
export function getCoTacMode() { return _coTacMode; }

/**
 * セーブ復元用: モードのフラグだけ戻す（RT は保存済みのものを使うので再投入しない）。
 * @param {'radio'|'phone'} mode
 */
export function restoreCoTacMode(mode) {
  if (mode === 'radio' || mode === 'phone') _coTacMode = mode;
}

/**
 * CO TAC 網を無線／電話のどちらで運用するか（§4.3.3「両方使えるなら網ごとに選ぶ」）。
 * Combat Patrol では電話が使えない（campaign p.13 CSR1）。
 * @param {object} scenario
 * @param {'radio'|'phone'} mode
 * @returns {{ok:boolean, reason:string}}
 */
export function setCoTacMode(scenario, mode) {
  if (mode === 'phone' && scenario?.missionType === 'combat_patrol') {
    return { ok: false, reason: 'Combat Patrol では電話は使用不可（campaign p.13 CSR1）' };
  }
  _coTacMode = mode === 'phone' ? 'phone' : 'radio';
  applyScenarioComms(scenario);
  return { ok: true, reason: '' };
}

/**
 * シナリオの通信資産を盤面に投入する（RT の割当と電話線の在庫）。
 * @param {object} scenario
 */
export function applyScenarioComms(scenario) {
  const comms = scenario?.comms;
  clearRTs();
  setPhoneLineStock(0);
  if (!comms) return;

  for (const rt of comms.rts ?? []) {
    // CO TAC を電話運用にした場合、CO TAC の無線を EE8 野戦電話に置き換える
    const model = (rt.coTac && _coTacMode === 'phone') ? 'EE8' : rt.model;
    assignRT(rt.unit, model, rt.network);
  }
  if (_coTacMode === 'phone') setPhoneLineStock(comms.phoneLinesIfPhone ?? 0);
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
