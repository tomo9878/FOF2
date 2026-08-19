// ===== 移動アクション（§4.2.2 / §5.1）=====
//
// FOF.pdf p.23 §4.2.2「Movement Actions」
// 見出し: **Use Recipient's Experience Level for Command draw modifier**
//   ＝ ドロー修正は Rally（発令者基準）と逆で **対象の練度**。
//
// | | アクション | コスト | Draw |
// |a| Move to an Adjacent Card              | 1 | Auto |
// |b| Move a Platoon to an Adjacent Card    | 2 | Auto（PLT HQ） |
// |c| Attempt to Infiltrate an Adjacent Card| 1 | 2 (+/−) |
// |d| Attempt to have a Platoon Infiltrate  | 2 | 2 (+/−)（PLT HQ） |
// |e| Attempt to Seek Cover                 | 1 | Cover # (+/−) |
// |f| Move within a Card                    | 1 | Auto |
// |g| Attempt to Infiltrate within a Card   | 1 | 2 (+/−) |
// |h| Pick up, load, unload, embark         | 1 | Auto（comm.js に実装済み）|
//
// **a / b / f（Auto）に加えて、c / g（浸透）と e（カバー捜索）も実装する。**
//   判定用データは元から `cards.json` / `terrain_cards.json` にあり、
//   JS モジュール側へ取り込んだ:
//     - `CARD_ICONS`（cards.js）… `infiltrate` アイコンを持つカードは10枚
//     - `COVER_DRAW`（terrain-data.js）… 地形ごとのカバー捜索の引き枚数（2〜4）
//   d（小隊浸透）は b と c の組み合わせなので後回し。
//
// ── §4.2.2c 浸透（隣接カード）──
//   出発地か目的地のどちらかに VOF が必要。三脚シンボル/H VOF の駒は不可。
//   カードを引いて Infiltrate アイコンを探し、成功すると **Exposed が付かずに**移動。
//   失敗したら通常の「隣接カードへ移動」を行う（＝Exposed 付きで移動する）。
// ── §4.2.2g 浸透（カード内）──
//   カードに VOF が必要。成功で Exposed 無しの カード内移動、失敗で通常のカード内移動。
// ── §4.2.2e カバー捜索 ──
//   そのカードの Cover Draw 番号だけ引き "Cover" を探す。
//   成功すると新しいカバーマーカーの下に入り **Exposed** になる。
//
// ── §4.2.2a の効果 ──
//   隣接カードへ移動し **Exposed** にする。移動先にカバーマーカーがあれば入れてよい。
//   **例外**: 塹壕・バンカー・トーチカのカバーから、移動先の同種カバーへ移る場合は
//   Exposed が付かない（§5.1.2）。Urban の Attached Buildings 間も同様（§13.7・未対応）。
//   対象は「**Exposed が付いていない** Good Order ユニット」。
//
// ── §4.2.5 Pinned の制限 ──
//   Pinned ユニットが隣接カードへ動けるのは、移動先が
//   **スタートエリア** または **VOF の無い友軍占有カード** の場合だけ。
//   さらに運んでいる物資・死傷者を**捨ててから**でないと動けない（§5.1.6E・未対応）。

import {
  canGiveOrder, getCurrentAP, canExpendCommand, expendCommand,
  getCommandRole, getPlatoonKey, findUnitDef,
  getSpentThisImpulse, getExpendLimit,
} from './command.js';
import { unitCoordMap, getUnitState, getUnitStrength, renderUnitBadges } from './state.js';
import { moveUnitToCard } from './grid.js';
import { cardDistance } from './los.js';
import { cardVOFMap } from './vof.js';
import {
  getUnitCoverSlot, removeUnitFromCover, assignUnitToCover, getCoverSlots, COVER_TYPES,
  addCoverSlot, canAddCoverSlot,
} from './cover.js';
import { COVER_DRAW } from './data/terrain-data.js';
import { getUnitExperience } from './campaign.js';
import { isStagingArea, phoneLineMap, layPhoneLine, getPhoneLineStock } from './phone.js';
import { getRTs } from './comm.js';
import { RT_MODELS } from './data/radios.js';

/** §4.2.2a / f のコスト */
export const MOVE_COST = 1;
/** §4.2.2b 小隊移動のコスト */
export const PLATOON_MOVE_COST = 2;

/**
 * Exposed が付かないカバー種別（§5.1.2「Trench, Bunker or Pillbox」）。
 * 出発地と目的地の両方がこのいずれかのカバーなら Exposed にならない。
 */
const NO_EXPOSE_COVER = new Set(['trench', 'bunker', 'pillbox']);

/**
 * そのカードが「友軍が占有していて VOF が無い」か（§4.2.5 Pinned の移動先条件）。
 * @param {string} coord
 * @param {string} movingUnitId - 判定から除外する（自分自身は数えない）
 * @returns {boolean}
 */
function _friendlyOccupiedNoVOF(coord, movingUnitId) {
  if (cardVOFMap.get(coord)?.type) return false;
  for (const [id, c] of unitCoordMap) {
    if (c !== coord || id === movingUnitId) continue;
    if (findUnitDef(id)?.faction === 'friendly') return true;
  }
  return false;
}

/**
 * 移動できるか（§4.2.2a）。
 * @param {string} originatorId - 発令者（HQ/Staff）
 * @param {string} unitId       - 動く駒
 * @param {string} toCoord      - 移動先
 * @returns {{ok:boolean, reason:string}}
 */
export function canMoveToAdjacent(originatorId, unitId, toCoord) {
  const from = unitCoordMap.get(unitId);
  if (!from) return { ok: false, reason: '駒が盤上にいない' };
  if (from === toCoord) return { ok: false, reason: '同じカード' };
  if (cardDistance(from, toCoord) !== 1) return { ok: false, reason: '隣接カードではない' };

  const st = getUnitState(unitId);
  if (st.exposed) return { ok: false, reason: 'Exposed の駒は移動できない（§4.2.2a）' };

  // §4.2.5: Pinned はスタートエリアか「VOF の無い友軍占有カード」へしか動けない
  if (st.pinned && !isStagingArea(toCoord) && !_friendlyOccupiedNoVOF(toCoord, unitId)) {
    return { ok: false, reason: 'Pinned はスタートエリアか VOF の無い友軍占有カードにしか動けない（§4.2.5）' };
  }

  if (getCurrentAP(originatorId) < MOVE_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(originatorId)) return { ok: false, reason: 'このインパルスの消費上限に達している' };

  const order = canGiveOrder(originatorId, unitId);
  if (!order.ok) return { ok: false, reason: order.reason };
  return { ok: true, reason: '' };
}

/**
 * Exposed を付けるべきか判定する（§5.1.2 の例外つき）。
 * @param {string} fromSlotType - 出発時のカバー種別（カバー外は null）
 * @param {string|null} toSlotType - 到着時のカバー種別
 * @returns {boolean}
 */
export function shouldMarkExposed(fromSlotType, toSlotType) {
  return !(NO_EXPOSE_COVER.has(fromSlotType) && NO_EXPOSE_COVER.has(toSlotType));
}

/**
 * カードを離れるときの電話線の自動敷設（§4.3.4）。
 * 「電話線を割り当てられたユニットは1カードにつき1本置ける。命令不要で、
 *   そのカードを離れるときに自動的に行われる」
 * ※ どの駒が電話線を持つかはデータ化していないため、
 *    **電話（EE8等）を持っている駒が電話線も携行している**とみなす。
 * @param {string} unitId
 * @param {string} fromCoord
 * @returns {{laid:boolean, reason:string}}
 */
export function autoLayPhoneLineOnLeave(unitId, fromCoord) {
  const hasPhone = getRTs(unitId).some(rt => RT_MODELS[rt.model]?.kind === 'phone');
  if (!hasPhone) return { laid: false, reason: '電話を持っていない' };
  if (getPhoneLineStock() <= 0) return { laid: false, reason: '電話線の残りがない' };
  if (phoneLineMap.has(fromCoord)) return { laid: false, reason: 'このカードには既に電話線がある' };
  if (isStagingArea(fromCoord)) return { laid: false, reason: 'スタートエリアには不要' };
  const r = layPhoneLine(fromCoord);
  return { laid: r.ok, reason: r.ok ? '離れたカードに電話線を1本敷設' : r.reason };
}

/**
 * §4.2.2a を実行する。移動後の更新（Exposed・カバー・電話線）もここで行う。
 * @param {string} originatorId
 * @param {string} unitId
 * @param {string} toCoord
 * @param {string|null} [toSlotId=null] - 移動先で入るカバースロット（入らないなら null）
 * @returns {{ok:boolean, reason:string, exposed:boolean, phoneLine:object}}
 */
export function moveToAdjacent(originatorId, unitId, toCoord, toSlotId = null) {
  const check = canMoveToAdjacent(originatorId, unitId, toCoord);
  if (!check.ok) return { ...check, exposed: false, phoneLine: null };

  const from = unitCoordMap.get(unitId);
  const fromSlotType = getUnitCoverSlot(unitId)?.type ?? null;
  const toSlotType = toSlotId
    ? (getCoverSlots(toCoord).find(s => s.slotId === toSlotId)?.type ?? null)
    : null;

  expendCommand(originatorId);

  // カードを離れる時点で電話線を落とす（§4.3.4）
  const phoneLine = autoLayPhoneLineOnLeave(unitId, from);

  removeUnitFromCover(unitId);          // 出発地のカバーから出す
  moveUnitToCard(unitId, toCoord);
  if (toSlotId) assignUnitToCover(unitId, toCoord, toSlotId);

  const exposed = shouldMarkExposed(fromSlotType, toSlotType);
  if (exposed) getUnitState(unitId).exposed = true;
  renderUnitBadges(unitId);

  document.dispatchEvent(new CustomEvent('board:changed'));
  return { ok: true, reason: '', exposed, phoneLine };
}

/**
 * §4.2.2f カード内移動。エリア（カバースロット／カバー外）を変えて Exposed にする。
 * @param {string} originatorId
 * @param {string} unitId
 * @param {string|null} toSlotId - 入るカバースロット（カバー外なら null）
 * @returns {{ok:boolean, reason:string}}
 */
export function moveWithinCard(originatorId, unitId, toSlotId) {
  const coord = unitCoordMap.get(unitId);
  if (!coord) return { ok: false, reason: '駒が盤上にいない' };
  const cur = getUnitCoverSlot(unitId)?.slotId ?? null;
  if (cur === toSlotId) return { ok: false, reason: '同じエリア' };
  if (getCurrentAP(originatorId) < MOVE_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(originatorId)) return { ok: false, reason: 'このインパルスの消費上限に達している' };

  const order = canGiveOrder(originatorId, unitId);
  if (!order.ok) return { ok: false, reason: order.reason };

  expendCommand(originatorId);
  removeUnitFromCover(unitId);
  if (toSlotId) {
    const ok = assignUnitToCover(unitId, coord, toSlotId);
    if (!ok) return { ok: false, reason: 'そのカバーに入れない（収容上限）' };
  }
  getUnitState(unitId).exposed = true;   // §4.2.2f は常に Exposed
  renderUnitBadges(unitId);
  document.dispatchEvent(new CustomEvent('board:changed'));
  return { ok: true, reason: '' };
}

/**
 * §4.2.2b 小隊で隣接カードへ移動（コスト2・PLT HQ のみ）。
 * 「同じカードにいる自小隊の Good Order・非Exposed の駒が全員同じカードへ。
 *   **発令者と通信できていない駒はその場に残る**」
 * @param {string} pltHqId
 * @param {string} toCoord
 * @returns {{ok:boolean, reason:string, moved:string[], stayed:Array<{id:string, reason:string}>}}
 */
export function movePlatoonToAdjacent(pltHqId, toCoord) {
  const NG = (reason) => ({ ok: false, reason, moved: [], stayed: [] });
  if (getCommandRole(pltHqId) !== 'plt_hq') return NG('PLT HQ にしか出せない');
  const from = unitCoordMap.get(pltHqId);
  if (!from) return NG('PLT HQ が盤上にいない');
  if (cardDistance(from, toCoord) !== 1) return NG('隣接カードではない');
  if (getCurrentAP(pltHqId) < PLATOON_MOVE_COST) return NG('コマンドが足りない');
  // 1インパルスの消費上限（§4.1.3）は2コマンド分まとめて収まる必要がある
  if (getSpentThisImpulse(pltHqId) + PLATOON_MOVE_COST > getExpendLimit()) {
    return NG('このインパルスの消費上限に達している');
  }

  const platoon = getPlatoonKey(pltHqId);
  const candidates = [...unitCoordMap]
    .filter(([id, c]) => c === from && getPlatoonKey(id) === platoon)
    .map(([id]) => id);

  // ⚠ 可否は**誰も動く前に**まとめて判定する。
  //    先に PLT HQ を動かしてしまうと、残りの駒が「HQ が別カードへ行ったので
  //    通信できない」と誤判定されて全員置き去りになる。
  const eligible = [], stayed = [];
  for (const id of candidates) {
    const st = getUnitState(id);
    if (st.exposed) { stayed.push({ id, reason: 'Exposed' }); continue; }
    if (st.pinned && !isStagingArea(toCoord) && !_friendlyOccupiedNoVOF(toCoord, id)) {
      stayed.push({ id, reason: 'Pinned で移動先の条件を満たさない' }); continue;
    }
    // 発令者自身は通信不要。それ以外は通信できないと置き去り（§4.2.2b）
    if (id !== pltHqId && !canGiveOrder(pltHqId, id).ok) {
      stayed.push({ id, reason: '発令者と通信できない（§4.2.2b）' }); continue;
    }
    eligible.push(id);
  }

  expendCommand(pltHqId);   // §4.2.2b は小隊まとめて2コマンド
  expendCommand(pltHqId);

  const moved = [];
  for (const id of eligible) {
    const fromSlotType = getUnitCoverSlot(id)?.type ?? null;
    autoLayPhoneLineOnLeave(id, from);
    removeUnitFromCover(id);
    moveUnitToCard(id, toCoord);
    if (shouldMarkExposed(fromSlotType, null)) getUnitState(id).exposed = true;
    renderUnitBadges(id);
    moved.push(id);
  }
  document.dispatchEvent(new CustomEvent('board:changed'));
  return { ok: true, reason: '', moved, stayed };
}

// ===== 浸透（§4.2.2c / g）とカバー捜索（§4.2.2e）=====

/** 三脚シンボル / H VOF の駒は浸透できない（§4.2.2c/g） */
function _canInfiltrate(unitId) {
  const def = findUnitDef(unitId);
  if (def?.tripod) return { ok: false, reason: '三脚シンボルの駒は浸透できない' };
  if (def?.vof === 'H') return { ok: false, reason: 'H VOF の駒は浸透できない' };
  return { ok: true, reason: '' };
}

/**
 * 浸透の段取りを返す（カードは引かない）。
 * @param {string} unitId
 * @param {string|null} toCoord - 隣接カードへの浸透なら移動先、カード内なら null
 * @returns {{ok:boolean, reason:string, draws:number}}
 */
export function planInfiltrate(unitId, toCoord) {
  const from = unitCoordMap.get(unitId);
  if (!from) return { ok: false, reason: '駒が盤上にいない', draws: 0 };
  const inf = _canInfiltrate(unitId);
  if (!inf.ok) return { ...inf, draws: 0 };
  if (getUnitState(unitId).exposed) return { ok: false, reason: 'Exposed の駒は移動できない', draws: 0 };

  // VOF の条件: 隣接浸透は「出発地か目的地」、カード内浸透は「そのカード」
  const hasVOF = toCoord
    ? !!(cardVOFMap.get(from)?.type || cardVOFMap.get(toCoord)?.type)
    : !!cardVOFMap.get(from)?.type;
  if (!hasVOF) {
    return { ok: false, reason: toCoord ? '出発地か目的地に VOF が必要' : 'カードに VOF が必要', draws: 0 };
  }
  // 「2 (+/−)」。§4.2.2 の見出しどおり **対象の練度** で修正する
  const exp = getUnitExperience(unitId);
  const mod = exp === 'vet' ? +1 : exp === 'green' ? -1 : 0;
  return { ok: true, reason: '', draws: Math.max(0, 2 + mod) };
}

/**
 * 引いたカードに Infiltrate アイコンがあるか。
 * @param {Array<{icons:string[]}>} cards
 * @returns {boolean}
 */
export function isInfiltrateSuccess(cards) {
  return cards.some(c => (c?.icons ?? []).includes('infiltrate'));
}

/**
 * 浸透の結果を適用する。
 * 成功 → Exposed を付けずに移動。失敗 → 通常の移動を行う（§4.2.2c/g）。
 * @param {string} originatorId
 * @param {string} unitId
 * @param {string|null} toCoord
 * @param {boolean} success
 * @param {string|null} [toSlotId=null]
 * @returns {{ok:boolean, reason:string, exposed:boolean}}
 */
export function applyInfiltrate(originatorId, unitId, toCoord, success, toSlotId = null) {
  const from = unitCoordMap.get(unitId);
  if (!success) {
    // 失敗したら通常移動（コストは既に払っているので直接処理する）
    return toCoord
      ? _relocate(unitId, toCoord, toSlotId, true)
      : _relocateWithin(unitId, toSlotId, true);
  }
  return toCoord
    ? _relocate(unitId, toCoord, toSlotId, false)
    : _relocateWithin(unitId, toSlotId, false);
}

/** 実際の移動処理（コストは呼び出し側で払う） */
function _relocate(unitId, toCoord, toSlotId, markExposed) {
  const from = unitCoordMap.get(unitId);
  const fromSlotType = getUnitCoverSlot(unitId)?.type ?? null;
  const toSlotType = toSlotId
    ? (getCoverSlots(toCoord).find(s => s.slotId === toSlotId)?.type ?? null) : null;
  autoLayPhoneLineOnLeave(unitId, from);
  removeUnitFromCover(unitId);
  moveUnitToCard(unitId, toCoord);
  if (toSlotId) assignUnitToCover(unitId, toCoord, toSlotId);
  const exposed = markExposed && shouldMarkExposed(fromSlotType, toSlotType);
  if (exposed) getUnitState(unitId).exposed = true;
  renderUnitBadges(unitId);
  document.dispatchEvent(new CustomEvent('board:changed'));
  return { ok: true, reason: '', exposed };
}

/** カード内の移動処理（コストは呼び出し側で払う） */
function _relocateWithin(unitId, toSlotId, markExposed) {
  const coord = unitCoordMap.get(unitId);
  removeUnitFromCover(unitId);
  if (toSlotId && !assignUnitToCover(unitId, coord, toSlotId)) {
    return { ok: false, reason: 'そのカバーに入れない（収容上限）', exposed: false };
  }
  if (markExposed) getUnitState(unitId).exposed = true;
  renderUnitBadges(unitId);
  document.dispatchEvent(new CustomEvent('board:changed'));
  return { ok: true, reason: '', exposed: markExposed };
}

/**
 * §4.2.2e カバー捜索の段取り。引く枚数は地形カードの Cover Draw 番号。
 * @param {string} unitId
 * @returns {{ok:boolean, reason:string, draws:number}}
 */
export function planSeekCover(unitId) {
  const coord = unitCoordMap.get(unitId);
  if (!coord) return { ok: false, reason: '駒が盤上にいない', draws: 0 };
  const cardId = document.querySelector(`.terrain-card[data-coord="${coord}"]`)?.dataset.cardId;
  const n = COVER_DRAW[cardId];
  if (!n) return { ok: false, reason: 'この地形ではカバーを捜せない', draws: 0 };
  if (!canAddCoverSlot(coord)) return { ok: false, reason: 'このカードはカバーマーカーの上限に達している', draws: 0 };
  return { ok: true, reason: '', draws: n };
}

/**
 * 引いたカードに "Cover" があるか（type が 'cover'）。
 * @param {Array<{type:string}>} cards
 * @returns {boolean}
 */
export function isSeekCoverSuccess(cards) {
  return cards.some(c => c?.type === 'cover');
}

/**
 * カバー捜索の成功を適用する。新しいカバーマーカーの下に入り Exposed になる。
 * @param {string} unitId
 * @param {string} [type='basic'] - 発見したカバーの種別
 * @returns {{ok:boolean, reason:string}}
 */
export function applySeekCover(unitId, type = 'basic') {
  const coord = unitCoordMap.get(unitId);
  const slotId = addCoverSlot(coord, type);
  if (!slotId) return { ok: false, reason: 'カバーマーカーを置けない' };
  removeUnitFromCover(unitId);
  assignUnitToCover(unitId, coord, slotId);
  getUnitState(unitId).exposed = true;   // §4.2.2e は Exposed になる
  renderUnitBadges(unitId);
  document.dispatchEvent(new CustomEvent('board:changed'));
  return { ok: true, reason: '' };
}

/**
 * その駒が今動ける隣接カードを列挙する（UI のハイライト用）。
 * @param {string} originatorId
 * @param {string} unitId
 * @returns {Array<{coord:string, ok:boolean, reason:string, covers:Array}>}
 */
export function listMoveTargets(originatorId, unitId) {
  const from = unitCoordMap.get(unitId);
  if (!from) return [];
  const out = [];
  document.querySelectorAll('.terrain-card[data-coord]').forEach(el => {
    const coord = el.dataset.coord;
    if (cardDistance(from, coord) !== 1) return;
    const check = canMoveToAdjacent(originatorId, unitId, coord);
    out.push({
      coord, ok: check.ok, reason: check.reason,
      covers: getCoverSlots(coord).map(s => ({ slotId: s.slotId, type: s.type, label: COVER_TYPES[s.type]?.label ?? s.type })),
    });
  });
  return out;
}
