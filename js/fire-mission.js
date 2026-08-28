// ===== 間接砲撃（§7.16 Indirect Fire Missions / §4.2.4i Call for Fire）=====
//
// FOF.pdf p.57-59 §7.16
//
// ミッションごとの Fire Support Available Table（種類・VOF・観測者・draw枚数・使用可能回数）は
// scenario.fireSupport にデータとして持たせ、applyScenarioFireSupport() で投入する。
// Pending→Active（Incoming!）のフリップは既存の vof.js flipToIncoming() が
// card-context-menu.js の手動ボタンで既に実装済みなので、ここでは
// 「成功判定 → Pending マーカー設置 → Fire Mission 残数を1減らす」だけを扱う。
//
// ── 実装した種類 ──
//   HE / WP（Mission 1 の Fire Support Available Table のみ。Battalion/FPF/Illumination/
//   TOT/Air Strike は新規下位システム（3-Burst選択・複数カード指定・マーク前提等）が
//   要るため見送り。§7.16.4 Short Rounds のみ実装）。
//
// ── 通信の扱い（§7.16.1）──
//   観測者は mission.observers の spec（radioRole or commandRole）にマッチし、かつ
//   その spec が指定する network 上で有効な RT を持っていること（comm.js の
//   canUseNetwork+getRTs を直接使う。「相手」が盤外の砲兵部隊なので canReachByRadio の
//   両端実在ユニット前提は使わず、観測者側の資格だけで判定する — 既知の簡略化。
//   ARTY_FD/BN_TAC の RT は全てタイプB（SCR610/SCR300）なので通信範囲は無条件で届くという
//   前提と一致する）。
//
// ── 既知の簡略化 ──
//   - draws は §7.16.3 Note「Experience Level 込みなので二重修正しない」を厳守し、
//     _expMod 等の練度修正を一切適用しない。
//   - Critical Hit（3-Burst時の詳細処理）・Registered Targets（§7.16.5）・
//     Battalion Fire Mission（隣接2枚への同時着弾）は未実装。
//   - Short Round（§7.16.4）の「観測者に向かって1枚寄せる」は、8方向の行/列差分から
//     方向を求める簡易実装（los.js と同じ8方向モデル）。観測者が着弾カードにいる場合は
//     隣接カードをランダム（rollR）に選ぶ。
//   - Jam は判定しない（§7.12 の対象は Concentrate Fire / Ranged Grenade のみで、
//     Call for Fire の観測者は対象外）。

import { unitCoordMap, getUnitState } from './state.js';
import { findUnitDef, getCommandRole, canGiveOrder, getCurrentAP, canExpendCommand, expendCommand } from './command.js';
import { getRTs, canUseNetwork } from './comm.js';
import { isGoodOrder } from './runner.js';
import { hasLOS } from './los.js';
import { setVOFType } from './vof.js';
import { rollR } from './data/scenario-tables.js';

export const CALL_FOR_FIRE_COST = 1;

/** missionKey → { kind, label, vofMod, available, observers } */
let _missionDefs = {};
/** missionKey → 残り Fire Mission 回数 */
export const fireMissionRemaining = new Map();

/**
 * シナリオの Fire Support Available Table を投入する（マップ初期化時に一度呼ぶ）。
 * @param {object} scenario
 */
export function applyScenarioFireSupport(scenario) {
  _missionDefs = scenario?.fireSupport?.missions ?? {};
  fireMissionRemaining.clear();
  for (const [key, def] of Object.entries(_missionDefs)) {
    fireMissionRemaining.set(key, def.available);
  }
}

/** リセット用：残数を初期値へ戻す */
export function resetFireMissions() {
  for (const [key, def] of Object.entries(_missionDefs)) {
    fireMissionRemaining.set(key, def.available);
  }
}

export function listFireMissionKeys() {
  return Object.keys(_missionDefs);
}

export function getMissionDef(missionKey) {
  return _missionDefs[missionKey] ?? null;
}

export function getFireMissionsRemaining(missionKey) {
  return fireMissionRemaining.get(missionKey) ?? 0;
}

/** そのユニットが observer spec にマッチするか */
function _matchesObserver(unitId, match) {
  if (match.commandRole && getCommandRole(unitId) !== match.commandRole) return false;
  if (match.radioRole && findUnitDef(unitId)?.radioRole !== match.radioRole) return false;
  return true;
}

/** そのユニットに対応する observer spec を返す（無ければ null） */
function _findObserverSpec(missionKey, unitId) {
  const def = getMissionDef(missionKey);
  if (!def) return null;
  return def.observers.find(spec => _matchesObserver(unitId, spec) && _hasNetworkRT(unitId, spec.network)) ?? null;
}

/** そのユニットが指定網の生きた RT を持ち、かつその網を使う資格があるか */
function _hasNetworkRT(unitId, network) {
  return canUseNetwork(unitId, network) && getRTs(unitId).some(rt => rt.network === network);
}

/**
 * §7.16.1 Eligibility：この Fire Mission を要請できる盤上ユニット一覧。
 * @param {string} missionKey
 * @returns {string[]}
 */
export function listEligibleObservers(missionKey) {
  const def = getMissionDef(missionKey);
  if (!def) return [];
  return [...unitCoordMap.keys()].filter(id => _findObserverSpec(missionKey, id) && isGoodOrder(id));
}

/** 有効な着弾目標か（HE: Spotted な敵がいるカード／WP: 無条件） */
function _isValidTarget(missionKey, targetCoord) {
  const def = getMissionDef(missionKey);
  if (!def) return false;
  if (def.kind === 'WP') return true; // §7.16.2C: 無人・Unspotted カードにも可
  return [...unitCoordMap].some(([id, c]) => c === targetCoord
    && findUnitDef(id)?.faction !== 'friendly' && !getUnitState(id).unspotted);
}

/**
 * §4.2.4i Call for Fire を試みられるか。
 * @param {string} originatorId - 発令する HQ/Staff
 * @param {string} observerId   - 観測者（Recipient）
 * @param {string} missionKey
 * @param {string} targetCoord
 * @returns {{ok:boolean, reason:string}}
 */
export function canCallForFire(originatorId, observerId, missionKey, targetCoord) {
  const def = getMissionDef(missionKey);
  if (!def) return { ok: false, reason: '存在しない Fire Mission' };
  if (getFireMissionsRemaining(missionKey) <= 0) return { ok: false, reason: 'この種類の Fire Mission は使い切った' };
  if (!isGoodOrder(observerId)) return { ok: false, reason: '観測者が Good Order ではない' };
  const spec = _findObserverSpec(missionKey, observerId);
  if (!spec) return { ok: false, reason: 'この観測者はこの Fire Mission を要請する資格/RTが無い' };
  const observerCoord = unitCoordMap.get(observerId);
  if (!observerCoord) return { ok: false, reason: '観測者が盤外' };
  if (observerCoord !== targetCoord && !hasLOS(observerCoord, targetCoord)) {
    return { ok: false, reason: 'LOS が届かない' };
  }
  if (!_isValidTarget(missionKey, targetCoord)) return { ok: false, reason: '有効な目標ではない（Spotted な敵が必要）' };
  if (getCurrentAP(originatorId) < CALL_FOR_FIRE_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(originatorId)) return { ok: false, reason: 'このインパルスの消費上限に達している' };
  const order = canGiveOrder(originatorId, observerId);
  if (!order.ok) return { ok: false, reason: order.reason };
  return { ok: true, reason: '' };
}

/**
 * 引く枚数（§7.16.3 Note：Experience Level 込みなので、これ以上の練度修正はしない）。
 * @param {string} missionKey
 * @param {string} observerId
 * @returns {{draws:number}}
 */
export function planCallForFire(missionKey, observerId) {
  const spec = _findObserverSpec(missionKey, observerId);
  return { draws: spec?.draws ?? 0 };
}

/** Burst（call_for_fire）または 3-Burst（call_for_fire_battalion）アイコンがあるか */
export function isCallForFireSuccess(cards) {
  return cards.some(c => (c?.icons ?? []).includes('call_for_fire') || (c?.icons ?? []).includes('call_for_fire_battalion'));
}

/** §7.16.4 Short Round（jam アイコン枠に入っている short アイコン）があるか */
export function isShortRound(cards) {
  return cards.some(c => (c?.icons ?? []).includes('short'));
}

export function payCallForFireCost(originatorId) { expendCommand(originatorId); }

function _parseCoord(coord) {
  return { col: coord.charCodeAt(0) - 65, row: parseInt(coord.slice(1), 10) };
}
function _formatCoord(col, row) { return String.fromCharCode(65 + col) + row; }

function _cardExists(coord) {
  return !!document.querySelector(`.terrain-card[data-coord="${coord}"]`);
}

function _adjacentCoords(coord) {
  const { col, row } = _parseCoord(coord);
  const deltas = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  return deltas.map(([dc, dr]) => _formatCoord(col + dc, row + dr)).filter(_cardExists);
}

/** targetCoord から observerCoord に向けて1マス寄せた座標（§7.16.4） */
function _stepToward(targetCoord, observerCoord) {
  const a = _parseCoord(targetCoord), b = _parseCoord(observerCoord);
  const dc = Math.sign(b.col - a.col), dr = Math.sign(b.row - a.row);
  const next = _formatCoord(a.col + dc, a.row + dr);
  return _cardExists(next) ? next : targetCoord;
}

/**
 * §7.16.4 Short Round の着弾先を決める。
 * 観測者が目標カードにいる場合はランダムな隣接カード（rollR）、そうでなければ観測者側へ1マス寄せる。
 * @param {string} targetCoord
 * @param {string} observerId
 * @returns {string}
 */
function _resolveShortRoundCoord(targetCoord, observerId) {
  const observerCoord = unitCoordMap.get(observerId);
  if (observerCoord === targetCoord) {
    const adj = _adjacentCoords(targetCoord);
    if (!adj.length) return targetCoord;
    const { r } = rollR(adj.length); // rollR は {card, r} を返す。r は 1..adj.length
    return adj[r - 1];
  }
  return _stepToward(targetCoord, observerCoord);
}

/**
 * 成功時：Pending マーカーを設置し Fire Mission 残数を1減らす（Short なら着弾先をずらす）。
 * 失敗時：何もしない（§7.16.3）。
 * @param {string} targetCoord
 * @param {string} missionKey
 * @param {string} observerId
 * @param {boolean} success
 * @param {boolean} short
 * @returns {{ok:boolean, reason:string, coord?:string}}
 */
export function applyCallForFire(targetCoord, missionKey, observerId, success, short) {
  if (!success) return { ok: true, reason: '失敗（何も起きない）' };
  const def = getMissionDef(missionKey);
  const coord = short ? _resolveShortRoundCoord(targetCoord, observerId) : targetCoord;
  const n = Math.abs(def.vofMod);
  const pendingType = def.kind === 'WP' ? `Pending-WP-${n}` : `Pending-${n}`;
  setVOFType(coord, pendingType);
  fireMissionRemaining.set(missionKey, Math.max(0, getFireMissionsRemaining(missionKey) - 1));
  return { ok: true, reason: short ? `Short Round：${coord} に着弾` : `${coord} に Pending Fire Mission を設置`, coord };
}
