// ===== ランナー（伝令・§4.3.2 / §4.2.1f-h）=====
//
// FOF.pdf p.27 §4.3.2「Runners」／ p.22 アクション表 f・g・h
//
// ランナーは無線・電話が無い（届かない）ときに、**翌ターン**の起動を届ける手段。
//   ・盤上には最初から居ない。CO HQ Assets ボックスに入れておき、CO HQ と一緒に動く
//   ・キャンペーン指示書に「最初から持っているか」が書かれる。無ければプレイ中に作る
//   ・**同時に盤上に置けるのは2体まで**
//
// ── §4.2.1f Create a Runner（コスト1・Auto・発令者 CO HQ）──
//   対象: Good Order のユニット、または Unpinned の Assault Team / Fire Team
//   効果: **対象を1ステップ減らし**、Line 評価のランナーを CO HQ Assets ボックスに置く
//   → ランナーを作ると戦力が減る。電話が使えるなら電話の方が安い
//
// ── §4.2.1g Dispatch a Runner（コスト1・Auto・発令者 CO HQ）──
//   翌ターン起動したい PLT HQ / CO Staff がいるカードにランナーを置き、Exposed にする
//
// ── §4.2.1h Dismiss a Runner（コスト1・Auto・発令者 CO HQ）──
//   「add a step to a Good Order unit that can absorb at least one step and that is
//     located on the same area of a card as the CO HQ」
//   ＝ ①Good Order ②満タンでない ③**CO HQ と同じカードの同じエリア**（§4.3.1 のエリア）
//   ※ ランナー作成時に1ステップ払ったユニットである必要は無い。
//     受け取り手は CO HQ の隣にいる別のユニットでよい。
//
// ── 配達の解決（§4.3.2）──
//   間の Combat Effects Segment で Hit も Pinned もされなければ、翌ターンの
//   CO HQ インパルスで対象が Activate され、ランナーは自動的に箱へ戻る。
//   対象が居なくなった／Fire Team 面になった／ランナーと同じカードに居ない場合は失敗し、
//   ランナーは Good Order に戻った最初の CO HQ インパルスで箱へ帰る。

import { unitCoordMap, getUnitState, getUnitStrength, setUnitSteps } from './state.js';
import { addUnitToCard, removeUnitFromCard } from './grid.js';
import {
  getCommandRole, setActivated, isOnCommandSide,
  expendCommand, canExpendCommand, getCurrentAP, findUnitDef,
} from './command.js';
import { setUnitExperience } from './campaign.js';
import { getAreaKey } from './comm.js';

/** 盤上に同時に置けるランナーの数（§4.3.2） */
export const MAX_RUNNERS = 2;

/** アクションのコマンド消費量（§4.2.1f-h はいずれも1） */
export const RUNNER_ACTION_COST = 1;

/** ランナーとして使う駒（units-normandy.js に定義済み） */
export const RUNNER_UNIT_IDS = ['US_RUNNER_1', 'US_RUNNER_2'];

/** ランナーの状態 */
export const RUNNER_STATUS = {
  NONE:       'none',        // まだ作られていない
  IN_BOX:     'in_box',      // CO HQ Assets ボックス
  DISPATCHED: 'dispatched',  // 盤上（配達中）
};

/**
 * runnerId → { status, targetId, failed }
 * failed: 配達に失敗済み（Pinned 等）。Good Order に戻ったら箱へ帰るだけで、後から届いたりはしない
 */
export const runnerMap = new Map();

/**
 * @param {string} runnerId
 * @returns {{status:string, targetId:string|null, failed:boolean}}
 */
export function getRunner(runnerId) {
  if (!runnerMap.has(runnerId)) {
    runnerMap.set(runnerId, { status: RUNNER_STATUS.NONE, targetId: null, failed: false });
  }
  return runnerMap.get(runnerId);
}

/** ランナー状態を全消去（リセット用） */
export function clearRunners() { runnerMap.clear(); }

/**
 * ランナー一覧（UI 用）。
 * @returns {Array<{id:string, label:string, status:string, targetId:string|null}>}
 */
export function listRunners() {
  return RUNNER_UNIT_IDS.map(id => {
    const r = getRunner(id);
    return { id, label: findUnitDef(id)?.label ?? id, status: r.status, targetId: r.targetId };
  });
}

/** 盤上（配達中）のランナー数。§3.3.1a の「ランナーが盤上にいるか」判定に使う */
export function runnersOnMapCount() {
  return RUNNER_UNIT_IDS.filter(id => getRunner(id).status === RUNNER_STATUS.DISPATCHED).length;
}

/** 作成済み（箱＋盤上）のランナー数。§4.3.2 の上限2はこちらで数える */
export function runnersInPlayCount() {
  return RUNNER_UNIT_IDS.filter(id => getRunner(id).status !== RUNNER_STATUS.NONE).length;
}

/**
 * Good Order Unit か。
 * FOF.pdf p.7 用語集「Good Order Unit: This is any infantry unit that is not a
 * Limited Action Team and is not Pinned.」
 * ＝ LAT ではなく、Pinned でもないこと。加えて盤上にいることを条件に含める。
 * @param {string} unitId
 * @returns {boolean}
 */
export function isGoodOrder(unitId) {
  if (findUnitDef(unitId)?.type === 'lat') return false;  // LAT は Good Order ではない
  if (!unitCoordMap.has(unitId)) return false;
  return !getUnitState(unitId).pinned;
}

// ===== §4.2.1f Create a Runner =====

/**
 * @param {string} coHqId
 * @param {string} recipientId - 1ステップ払うユニット
 * @returns {{ok:boolean, reason:string}}
 */
export function canCreateRunner(coHqId, recipientId) {
  if (getCommandRole(coHqId) !== 'co_hq') return { ok: false, reason: 'CO HQ にしか作れない' };
  if (!isOnCommandSide(coHqId))           return { ok: false, reason: 'CO HQ が Fire Team 面' };
  if (getCurrentAP(coHqId) < RUNNER_ACTION_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(coHqId))          return { ok: false, reason: 'このインパルスの消費上限に達している' };
  if (runnersInPlayCount() >= MAX_RUNNERS) return { ok: false, reason: `ランナーは同時に ${MAX_RUNNERS} 体まで` };

  const def = findUnitDef(recipientId);
  const isLAT = def?.type === 'lat';
  if (isLAT) {
    if (getUnitState(recipientId).pinned) return { ok: false, reason: 'Pinned の LAT は使えない' };
  } else {
    if (!isGoodOrder(recipientId)) return { ok: false, reason: '対象が Good Order ではない' };
    const s = getUnitStrength(recipientId);
    // 消滅閾値（steps===2）を割らない範囲でのみ払わせる安全側の実装
    if (!s || s.steps <= 2) return { ok: false, reason: '払えるステップがない' };
  }
  return { ok: true, reason: '' };
}

/**
 * ランナーを1体作る（対象を1ステップ減らす）。
 * @param {string} coHqId
 * @param {string} recipientId
 * @returns {{ok:boolean, reason:string, runnerId:string|null}}
 */
export function createRunner(coHqId, recipientId) {
  const check = canCreateRunner(coHqId, recipientId);
  if (!check.ok) return { ...check, runnerId: null };

  const runnerId = RUNNER_UNIT_IDS.find(id => getRunner(id).status === RUNNER_STATUS.NONE);
  if (!runnerId) return { ok: false, reason: 'ランナーの駒が足りない', runnerId: null };

  // 対価: 対象を1ステップ減らす（LAT は駒ごと除去）
  const def = findUnitDef(recipientId);
  if (def?.type === 'lat') {
    removeUnitFromCard(recipientId);
    unitCoordMap.delete(recipientId);
  } else {
    const s = getUnitStrength(recipientId);
    setUnitSteps(recipientId, s.steps - 1);
  }

  expendCommand(coHqId);
  setUnitExperience(runnerId, 'line');       // Line 評価のランナー（§4.2.1f）
  const rr = getRunner(runnerId);
  rr.status = RUNNER_STATUS.IN_BOX;
  rr.targetId = null;
  rr.failed = false;
  return { ok: true, reason: '', runnerId };
}

// ===== §4.2.1g Dispatch a Runner =====

/**
 * @param {string} coHqId
 * @param {string} runnerId
 * @param {string} targetId - 翌ターン起動したい PLT HQ / CO Staff
 * @returns {{ok:boolean, reason:string}}
 */
export function canDispatchRunner(coHqId, runnerId, targetId) {
  if (getCommandRole(coHqId) !== 'co_hq') return { ok: false, reason: 'CO HQ にしか派遣できない' };
  if (!isOnCommandSide(coHqId))           return { ok: false, reason: 'CO HQ が Fire Team 面' };
  if (getCurrentAP(coHqId) < RUNNER_ACTION_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(coHqId))          return { ok: false, reason: 'このインパルスの消費上限に達している' };
  if (getRunner(runnerId).status !== RUNNER_STATUS.IN_BOX) return { ok: false, reason: 'ランナーが箱にいない' };

  const role = getCommandRole(targetId);
  if (role !== 'plt_hq' && role !== 'co_staff') return { ok: false, reason: '派遣先は PLT HQ か CO Staff' };
  if (!unitCoordMap.has(targetId)) return { ok: false, reason: '派遣先が盤上にいない' };
  return { ok: true, reason: '' };
}

/**
 * ランナーを盤上の対象のカードへ送る（Exposed になる）。
 * @param {string} coHqId
 * @param {string} runnerId
 * @param {string} targetId
 * @returns {{ok:boolean, reason:string}}
 */
export function dispatchRunner(coHqId, runnerId, targetId) {
  const check = canDispatchRunner(coHqId, runnerId, targetId);
  if (!check.ok) return check;

  const coord = unitCoordMap.get(targetId);
  const def = findUnitDef(runnerId);
  addUnitToCard(coord, def);
  getUnitState(runnerId).exposed = true;     // §4.2.1g「Mark the Runner as Exposed」
  expendCommand(coHqId);

  const r = getRunner(runnerId);
  r.status = RUNNER_STATUS.DISPATCHED;
  r.targetId = targetId;
  r.failed = false;
  return { ok: true, reason: '' };
}

// ===== §4.2.1h Dismiss a Runner =====

/**
 * @param {string} coHqId
 * @param {string} runnerId
 * @param {string} recipientId - 1ステップ受け取るユニット（CO HQ と同じエリア）
 * @returns {{ok:boolean, reason:string}}
 */
export function canDismissRunner(coHqId, runnerId, recipientId) {
  if (getCommandRole(coHqId) !== 'co_hq') return { ok: false, reason: 'CO HQ にしか解散できない' };
  if (getCurrentAP(coHqId) < RUNNER_ACTION_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(coHqId))          return { ok: false, reason: 'このインパルスの消費上限に達している' };

  const r = getRunner(runnerId);
  if (r.status === RUNNER_STATUS.NONE) return { ok: false, reason: 'そのランナーは存在しない' };
  if (!isGoodOrder(runnerId) && r.status === RUNNER_STATUS.DISPATCHED) {
    return { ok: false, reason: 'Good Order のランナーでないと解散できない' };
  }
  if (!isGoodOrder(recipientId)) return { ok: false, reason: 'ステップを受け取る側が Good Order ではない' };

  const s = getUnitStrength(recipientId);
  if (!s || s.steps >= s.maxSteps) return { ok: false, reason: 'ステップを受け取れない（満タン）' };

  // §4.2.1h「located on the same area of a card as the CO HQ」
  if (getAreaKey(recipientId) !== getAreaKey(coHqId)) {
    return { ok: false, reason: 'CO HQ と同じカードの同じエリアにいるユニットにしか戻せない' };
  }
  return { ok: true, reason: '' };
}

/**
 * ランナーを解散し、1ステップを Good Order のユニットに戻す。
 * @param {string} coHqId
 * @param {string} runnerId
 * @param {string} recipientId
 * @returns {{ok:boolean, reason:string}}
 */
export function dismissRunner(coHqId, runnerId, recipientId) {
  const check = canDismissRunner(coHqId, runnerId, recipientId);
  if (!check.ok) return check;

  if (unitCoordMap.has(runnerId)) {
    removeUnitFromCard(runnerId);
    unitCoordMap.delete(runnerId);
  }
  const s = getUnitStrength(recipientId);
  setUnitSteps(recipientId, s.steps + 1);
  expendCommand(coHqId);

  const r = getRunner(runnerId);
  r.status = RUNNER_STATUS.NONE;
  r.targetId = null;
  return { ok: true, reason: '' };
}

// ===== 配達の解決（§4.3.2）=====

/**
 * CO HQ インパルスの冒頭で呼ぶ。配達中のランナーを判定する。
 *   成功 → 対象を Activate し、ランナーは箱へ戻る
 *   失敗 → Good Order なら箱へ戻る（Pinned 等ならその場に留まる）
 * @returns {Array<{runnerId:string, targetId:string|null, delivered:boolean, reason:string}>}
 */
export function resolveRunnerDeliveries() {
  const results = [];
  for (const runnerId of RUNNER_UNIT_IDS) {
    const r = getRunner(runnerId);
    if (r.status !== RUNNER_STATUS.DISPATCHED) continue;

    const targetId = r.targetId;
    const runnerCoord = unitCoordMap.get(runnerId);
    let delivered = false;
    let reason = '';

    if (!runnerCoord) {
      // 盤上から消えている（Hit で除去された）
      reason = 'ランナーが失われた';
      r.status = RUNNER_STATUS.NONE;
      r.targetId = null;
      r.failed = false;
      results.push({ runnerId, targetId, delivered, reason });
      continue;
    }

    const pinned = getUnitState(runnerId).pinned;

    if (r.failed) {
      // 既に配達に失敗している。Good Order に戻った最初の CO HQ インパルスで箱へ帰るだけ
      reason = pinned ? '配達失敗。まだ Good Order でないので留まる' : '配達失敗のまま箱へ戻る';
    } else if (pinned) {
      // §4.3.2「間の Combat Effects Segment で Pinned になったら届かない」
      r.failed = true;
      reason = 'ランナーが Pinned のため配達失敗（Good Order に戻り次第 箱へ帰る）';
    } else if (!isOnCommandSide(runnerId)) {
      r.failed = true;
      reason = 'ランナーが Fire Team 面になったため配達失敗';
    } else if (!targetId || !unitCoordMap.has(targetId)) {
      r.failed = true;
      reason = '対象が盤上にいないため配達失敗';
    } else if (unitCoordMap.get(targetId) !== runnerCoord) {
      r.failed = true;
      reason = '対象がランナーと同じカードにいないため配達失敗';
    } else if (!isOnCommandSide(targetId)) {
      r.failed = true;
      reason = '対象が Fire Team 面のため配達失敗';
    } else {
      setActivated(targetId, true);
      delivered = true;
      reason = 'ランナーが起動を届けた';
    }

    // Good Order（Pinned でない）なら箱へ戻る。Pinned の間はその場に留まる
    if (!pinned) {
      removeUnitFromCard(runnerId);
      unitCoordMap.delete(runnerId);
      getUnitState(runnerId).exposed = false;
      r.status = RUNNER_STATUS.IN_BOX;
      r.targetId = null;
      r.failed = false;
    }
    results.push({ runnerId, targetId, delivered, reason });
  }
  return results;
}
