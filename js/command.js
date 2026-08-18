// ===== コマンドポイント（AP）管理モジュール =====
//
// AP を保持できるのは commandRole を持つ指揮ユニット（BN/CO HQ・CO staff・PLT HQ）。
//
// 保持するステート:
//   - currentAP: 現在の保有コマンド数（刻々と変わる）
//
// 計算で導出する値（保存しない）:
//   - 繰越上限 getCarryoverMax(): 練度 × 視界 で決まる（CARRYOVER_TABLE）
//   - 消費上限 getExpendLimit(): 1インパルスで使える最大（視界のみ・練度非依存）
//
// ※ 練度は campaign.js（可変ストア）に、視界は getVisibility() に既にあるため、
//    導出値を箱に保存すると二重管理になる。よって都度計算する。

import { getVisibility } from './ncm.js';
import { UNITS } from './data/units-normandy.js';
import { getUnitExperience } from './campaign.js';
import { cardVOFMap } from './vof.js';
import { unitCoordMap, getUnitState, getUnitStrength } from './state.js';
import { getUnitCoverSlot } from './cover.js';
import { getActivityLevel } from './contact.js';

// ===== ルールテーブル =====

/**
 * コマンド繰越上限（Saved Commands）: 練度 × 視界
 * 次のターンへ貯金（Save）できる最大コマンド数。
 */
export const CARRYOVER_TABLE = {
  green: { daylight: 3, limited: 2 },
  line:  { daylight: 6, limited: 4 },
  vet:   { daylight: 9, limited: 6 },
};

/**
 * 消費上限（Expend）: 1インパルスで消費できる最大コマンド数。
 * 練度に関わらず視界のみで決まる。
 */
export const EXPEND_LIMIT = { daylight: 6, limited: 4 };

// ===== 内部ユーティリティ =====

/**
 * 現在の視界モードを返す。
 * getVisibility(): 0=昼間 / それ以外（夜・霧等）=視界制限。
 * @returns {'daylight'|'limited'}
 */
function _visMode() {
  return getVisibility() === 0 ? 'daylight' : 'limited';
}

/**
 * 盤面に駒を持たない仮想の指揮エンティティ。
 * BN HQ は原則マップ外にいるので駒（UNITS）を持たないが、コマンドは保持しうる
 * （盤上に上位HQリーダーが登場した場合。FOF.pdf p.18 §4.1.1 BN HQ Impulse）。
 */
export const VIRTUAL_COMMAND_UNITS = { BN_HQ: 'bn_hq', GENERAL_INIT: 'general' };

/** BN HQ を表す仮想ユニットID */
export const BN_HQ_UNIT_ID = 'BN_HQ';

/** General Initiative の共有プールを表す仮想ユニットID */
export const GENERAL_INIT_UNIT_ID = 'GENERAL_INIT';

/** 繰り越せない（save できない）コマンドを持つ仮想ユニット */
const NO_SAVE_UNIT_IDS = new Set([BN_HQ_UNIT_ID, GENERAL_INIT_UNIT_ID]);

/**
 * ユニットの commandRole を UNITS 定義から引く（なければ null）。
 * @param {string} unitId
 * @returns {string|null}
 */
export function getCommandRole(unitId) {
  if (unitId in VIRTUAL_COMMAND_UNITS) return VIRTUAL_COMMAND_UNITS[unitId];
  for (const units of Object.values(UNITS)) {
    const u = units.find(u => u.id === unitId);
    if (u) return u.commandRole ?? null;
  }
  return null;
}

/**
 * 指定 commandRole を持つ盤面ユニットのIDを列挙する。
 * @param {string} role
 * @returns {string[]}
 */
export function findUnitsByCommandRole(role) {
  const ids = [];
  for (const units of Object.values(UNITS)) {
    for (const u of units) if (u.commandRole === role) ids.push(u.id);
  }
  return ids;
}

/**
 * ユニット定義を引く（分離済み LAT＝Fire Team / Assault Team も探す）。
 * @param {string} unitId
 * @returns {object|null}
 */
export function findUnitDef(unitId) {
  for (const units of Object.values(UNITS)) {
    for (const u of units) {
      if (u.id === unitId) return u;
      if (u.fireteam?.id === unitId)    return u.fireteam;
      if (u.assaultteam?.id === unitId) return u.assaultteam;
    }
  }
  return null;
}

/**
 * そのユニットが属する小隊のキー（'US_1PLT' 等）。中隊直轄・仮想ユニットは null。
 * LAT は親分隊の小隊に属する。
 * @param {string} unitId
 * @returns {string|null}
 */
export function getPlatoonKey(unitId) {
  const m = /^(US_\dPLT)_/.exec(unitId ?? '');
  return m ? m[1] : null;
}

/**
 * AP を保持できるユニットか（commandRole を持つか）。
 * @param {string} unitId
 * @returns {boolean}
 */
export function canHoldCommands(unitId) {
  return getCommandRole(unitId) !== null;
}

// ===== ストア =====

/** unitId → { currentAP: number } */
export const unitCommandMap = new Map();

// ===== 現在AP ゲッター/セッター =====

/**
 * @param {string} unitId
 * @returns {number}
 */
export function getCurrentAP(unitId) {
  return unitCommandMap.get(unitId)?.currentAP ?? 0;
}

/**
 * @param {string} unitId
 * @param {number} n
 */
export function setCurrentAP(unitId, n) {
  if (!unitCommandMap.has(unitId)) unitCommandMap.set(unitId, { currentAP: 0 });
  unitCommandMap.get(unitId).currentAP = Math.max(0, n);
}

/**
 * @param {string} unitId
 * @param {number} delta - 正で加算、負で消費
 */
export function changeCurrentAP(unitId, delta) {
  setCurrentAP(unitId, getCurrentAP(unitId) + delta);
}

// ===== 指揮系統（Command Reference Table）=====
//
// FOF.pdf p.18「Command Reference Table」
//   BN HQ    : Activate できるのは CO HQ のみ（盤外時は BN TAC 網で通信できる場合だけ・§4.3.3）
//   CO HQ    : Activate できるのは CO Staff と全ての下位HQ（PLT HQ 等）
//   CO XO / 1st Sgt / GySgt : Activate できるユニットなし
//   PLT HQ / Weapon Team HQ / Tank HQ : Activate できるユニットなし
// ※ Activate 自体は CO HQ のコマンド消費を伴うアクション（§4.2.1a）。
//    「誰を起動するか」の選択は人間が行う（このモジュールは可否だけを持つ）。

/** commandRole → その役職が Activate できる commandRole の一覧 */
export const CAN_ACTIVATE = {
  bn_hq:    ['co_hq'],
  co_hq:    ['co_staff', 'plt_hq'],
  co_staff: [],
  plt_hq:   [],
};

/** commandRole の表示名 */
export const COMMAND_ROLE_LABELS = {
  bn_hq: 'BN HQ', co_hq: 'CO HQ', co_staff: 'CO Staff', plt_hq: 'PLT HQ',
};

/**
 * このユニットを Activate できる上位の commandRole を返す（起動されない役職は null）。
 * @param {string} unitId
 * @returns {string|null}
 */
export function getActivatorRole(unitId) {
  const role = getCommandRole(unitId);
  if (!role) return null;
  const entry = Object.entries(CAN_ACTIVATE).find(([, targets]) => targets.includes(role));
  return entry ? entry[0] : null;
}

/**
 * 上位HQに起動されうるユニットか（BN HQ は誰にも起動されないので false）。
 * @param {string} unitId
 * @returns {boolean}
 */
export function canBeActivated(unitId) {
  return getActivatorRole(unitId) !== null;
}

// ===== §4.1.4 Fire Team 面 / command side =====
//
// FOF.pdf p.20 §4.1.4「Effect of Combat Hits on HQ & Staff Units」
//   ・Litter Team / Paralyzed Team / Casualty になった HQ・Staff の
//     **保存コマンドは全て失われる**（§6.4.3）
//   ・**Fire Team 面**に裏返った HQ・Staff は保存コマンドを保持するが、
//     command side に rally で戻るまで **自分自身にしか命令できない**
//   ・**Fire Team 面の HQ・Staff は上位HQに Activate されない**
//     （イニシアチブで引くしかない）
// また §4.2.1a（p.22）は Activate について
//   「Both the Originator and the Recipient must be on their command sides」
// と定めており、起動する側・される側の両方が command side である必要がある。
//
// 実装メモ: 「Fire Team 面」は新しい状態ではなく、既存の強度管理の裏面そのもの。
// namedFireTeam を持つ駒が steps を1つ失うと state.js が srcReduced（B面）に
// 差し替える（state.js setUnitSteps）。よって steps < maxSteps が Fire Team 面。

/**
 * その駒が command side（表面）を向いているか。
 * 裏面を持たない駒・仮想ユニットは常に true。
 * @param {string} unitId
 * @returns {boolean}
 */
export function isOnCommandSide(unitId) {
  if (unitId in VIRTUAL_COMMAND_UNITS) return true;  // 盤面に駒を持たない
  const s = getUnitStrength(unitId);
  if (!s?.namedFireTeam) return true;                // 裏面（Fire Team 面）が無い駒
  return s.steps === s.maxSteps;
}

/**
 * Litter / Paralyzed / Casualty 化した HQ・Staff の保存コマンドを失わせる（§4.1.4）。
 * hit.js から呼ぶ。
 * @param {string} unitId
 */
export function loseSavedCommands(unitId) {
  if (!unitCommandMap.has(unitId)) return;
  const entry = unitCommandMap.get(unitId);
  entry.currentAP = 0;
  entry.activated = false;
  entry.drawn = false;
  entry.spent = 0;
}

// ===== §4.3 通信の注入口 =====
//
// FOF.pdf p.27 §4.3「To order a unit to perform an action, the Originator …
// must be able to communicate with the Recipient unit.」
// 通信判定は comm.js が持つが、comm.js は役職判定のために command.js を import しており
// 直接 import すると循環参照になる。そこで **関数を注入する** 形にし、
// map.js の初期化で `setCommunicationChecker(canCommunicate)` を呼んで繋ぐ。

let _commChecker = null;

/**
 * 通信判定関数を差し込む（map.js の初期化から呼ぶ）。
 * @param {(from:string, to:string, orderKind?:string)=>{ok:boolean, reason:string, via:string|null}} fn
 */
export function setCommunicationChecker(fn) { _commChecker = fn; }

/**
 * 通信できるか。未注入なら「判定なし」として通す（テスト単体実行時の保険）。
 * @param {string} fromId
 * @param {string} toId
 * @returns {{ok:boolean, reason:string, via:string|null}}
 */
function _communicates(fromId, toId, orderKind) {
  if (!_commChecker) return { ok: true, reason: '通信判定が未接続', via: null };
  return _commChecker(fromId, toId, orderKind);
}

// ===== 命令の発令可否（Command Reference Table の「Can give other orders to」列）=====
//
// FOF.pdf p.18「Command Reference Table」右列
//   BN HQ    : Any unit
//   CO HQ    : Any unit except higher HQs
//   CO XO    : Any unit except higher HQs
//   1st Sgt  : Any unit except higher HQs and the CO XO
//   GySgt    : Any unit except higher HQs, CO XO and 1st Sgt
//   PLT HQ / Weapon Team HQ / Tank HQ : Any Unit attached to their own platoons. Any LAT.
// ここでの「higher HQs」は自分より上位のHQユニットを指す（CO XO から見れば BN HQ と CO HQ）。
// CO XO・1st Sgt・GySgt が個別に名指しで除外されているのは、これらが HQ ではなく Staff だから。
// → 結果として「自分より階級が下のユニットにだけ命令できる」という単純な序列で再現できる。
// また各インパルスの本文（p.18-19）に「orders to **itself** or any friendly subordinate units」
// とあるとおり、自分自身への命令は常に可能。

/** 命令系統の階級（小さいほど上位）。役職に無い一般ユニットは UNIT_RANK_OTHER。 */
export const COMMAND_RANK = {
  bn_hq: 0,
  co_hq: 1,
  co_xo: 2,
  co_1sgt: 3,
  co_gysgt: 4,
  plt_hq: 5,
};

/** HQ/Staff ではない一般ユニットの階級 */
export const UNIT_RANK_OTHER = 99;

/**
 * 命令系統上の階級を返す。CO Staff は staffRank（xo / 1sgt / gysgt）で細分する。
 * @param {string} unitId
 * @returns {number}
 */
export function getCommandRank(unitId) {
  const role = getCommandRole(unitId);
  if (!role) return UNIT_RANK_OTHER;
  if (role === 'co_staff') {
    const rank = findUnitDef(unitId)?.staffRank;
    return COMMAND_RANK[`co_${rank}`] ?? COMMAND_RANK.co_xo;
  }
  return COMMAND_RANK[role] ?? UNIT_RANK_OTHER;
}

/** LAT（分離した Fire Team / Assault Team）か */
function _isLAT(unitId) {
  return findUnitDef(unitId)?.type === 'lat';
}

/**
 * originator が target に命令（Activate 以外の通常アクション）を出せるか。
 * @param {string} originatorId
 * @param {string} targetId
 * @param {string} [orderKind] - comm.js の ORDER_KIND。§4.3.1 の例外
 *        （Pinned でも通る Remove Pinned / Exhort、カード全員に届く Cease Fire / Shift Fire）
 *        を判定に反映したい場合に渡す
 * @returns {{ok:boolean, reason:string}}
 */
export function canGiveOrder(originatorId, targetId, orderKind) {
  const role = getCommandRole(originatorId);
  if (!role) return { ok: false, reason: 'HQ/Staff ではないので発令者になれない' };
  if (originatorId === targetId) return { ok: true, reason: '自分自身への命令' };
  // §4.1.4: Fire Team 面の HQ/Staff は command side に戻るまで自分にしか命令できない
  if (!isOnCommandSide(originatorId)) {
    return { ok: false, reason: 'Fire Team 面のため自分自身にしか命令できない（rally で表に戻す）' };
  }
  // ① 指揮系統（Command Reference Table）を満たしているか
  let chainReason;
  if (role === 'general') {
    chainReason = 'General Initiative（HQ不要）';
  } else if (role === 'bn_hq') {
    chainReason = 'BN HQ は全ユニットに命令できる';
  } else if (role === 'plt_hq') {
    // 「自分の小隊に属するユニット」＋「あらゆる LAT」
    const mine = getPlatoonKey(originatorId);
    if (_isLAT(targetId)) {
      chainReason = 'LAT には小隊を問わず命令できる';
    } else if (mine && mine === getPlatoonKey(targetId)) {
      chainReason = '自分の小隊のユニット';
    } else {
      return { ok: false, reason: 'PLT HQ は自分の小隊のユニットと LAT にしか命令できない' };
    }
  } else if (getCommandRank(targetId) > getCommandRank(originatorId)) {
    chainReason = '下位のユニット';
  } else {
    return { ok: false, reason: '自分と同格以上のHQ/Staffには命令できない' };
  }

  // ② §4.3 通信できるか（指揮系統を満たしていても通信できなければ命令は出せない）
  const comm = _communicates(originatorId, targetId, orderKind);
  if (!comm.ok) return { ok: false, reason: `通信できない（${comm.reason}）` };

  return { ok: true, reason: `${chainReason}／${comm.via ?? '通信OK'}` };
}

// ===== 起動(Activated) / 取得済み(Drawn) =====
//
// この2つはルール上まったく別の概念なので別フラグで持つ:
//   activated : 起動セグメントで上位HQに Activate された（→ カードの activated 値を使う）
//   drawn     : このターンのインパルスでコマンドを取得し終えた（Activation Completed 相当）
// 起動されなかったユニットはイニシアチブセグメントで自分のインパルスを持ち、
// カードの initiative 値（CO Staff は固定1）を取得する。イニシアチブで引いても
// 「上位HQに起動された」ことにはならない。

/**
 * 上位HQに起動されたか。
 * @param {string} unitId
 * @returns {boolean}
 */
export function getActivated(unitId) {
  return unitCommandMap.get(unitId)?.activated ?? false;
}

/**
 * @param {string} unitId
 * @param {boolean} v
 */
export function setActivated(unitId, v) {
  if (!unitCommandMap.has(unitId)) unitCommandMap.set(unitId, { currentAP: 0 });
  unitCommandMap.get(unitId).activated = !!v;
}

/**
 * このターン、既にコマンドを取得済みか。
 * @param {string} unitId
 * @returns {boolean}
 */
export function getCommandsDrawn(unitId) {
  return unitCommandMap.get(unitId)?.drawn ?? false;
}

/**
 * @param {string} unitId
 * @param {boolean} v
 */
export function setCommandsDrawn(unitId, v) {
  if (!unitCommandMap.has(unitId)) unitCommandMap.set(unitId, { currentAP: 0 });
  unitCommandMap.get(unitId).drawn = !!v;
}

/**
 * クリーンアップフェーズ（§3.8）で全HQの起動・取得済みフラグを落とす。
 * 保有コマンド（Saved Commands）はここでは消さない。
 */
export function resetImpulseFlags() {
  resetImpulse();   // インパルスを BN HQ に戻す
  for (const [unitId, entry] of unitCommandMap) {
    entry.activated = false;
    entry.drawn = false;
    entry.spent = 0;
    // save できないコマンド（BN HQ・General Initiative）は使い残しても消える
    if (NO_SAVE_UNIT_IDS.has(unitId)) entry.currentAP = 0;
  }
}

// ===== イニシアチブの例外: CO Staff =====
//
// CO Staff Initiative Impulse だけは**カードを引かず固定1コマンド**で、
// §4.1.2 の修正（Pinned/練度/カバー/VOF/No Contact）も一切適用されない。
//   FOF.pdf p.19 §4.1.1「CO Staff Initiative Impulse」
//     "…give it one Command. This number is not modified."
//   FOF.pdf p.20 §4.1.2 冒頭
//     "…(but never in the CO Staff Initiative Impulse or General Initiative Impulse)"
// ※ CO Staff でも CO HQ に「起動された」場合は通常どおりカードを引き activated 値を取る。

/** CO Staff がイニシアチブで得る固定コマンド数 */
export const CO_STAFF_INITIATIVE_COMMANDS = 1;

/**
 * このユニットのイニシアチブがカードドロー不要（固定値）かどうか。
 * @param {string} unitId
 * @returns {boolean}
 */
export function hasFixedInitiative(unitId) {
  return getCommandRole(unitId) === 'co_staff';
}

// ===== §3.3.1a / §4.1.1 BN HQ インパルス =====
//
// FOF.pdf p.15 §3.3.1a ／ p.18-19 §4.1.1「BN HQ Impulse」
//   ・BN HQ はミッション指定が無い限りマップ外から始まる。
//     盤上に上位HQリーダー（連隊長・大隊長等）が現れた場合は「盤上」扱いになる。
//   ・盤外 かつ CO HQ が BN TAC 無線／電話で通信可 → **自動的に CO HQ を起動**
//     （カードは引かない）。
//   ・盤上 → 最上級の上位HQユニットに**最大コマンド（昼6／夜4）を自動付与**。
//     カードは引かない。**BN HQ のコマンドは繰り越せない（save 不可）**。
//   ・BN HQ が使用不能（無線破損・電話線切断 §4.3.4・上位HQイベント・
//     盤上の上位HQリーダー戦死 §6.5.2）→ CO HQ は起動されず、
//     ターンは CO HQ イニシアチブ・インパルスから始まる（前ターンからの
//     ランナーが盤上にいる場合を除く §4.3.2）。

/** BN HQ の状態 */
export const BN_HQ_STATUS = {
  OFF_MAP_COMM:    'off_map_comm',    // 盤外・BN TAC で通信可 → CO HQ を自動起動
  OFF_MAP_NO_COMM: 'off_map_no_comm', // 盤外・通信不通 → 起動なし
  ON_MAP:          'on_map',          // 盤上（上位HQリーダー登場）→ 最大コマンド付与
  UNAVAILABLE:     'unavailable',     // 使用不能 → 起動なし
};

/** BN HQ 状態の表示ラベル */
export const BN_HQ_STATUS_LABELS = {
  [BN_HQ_STATUS.OFF_MAP_COMM]:    '盤外・通信可（BN TAC）',
  [BN_HQ_STATUS.OFF_MAP_NO_COMM]: '盤外・通信不通',
  [BN_HQ_STATUS.ON_MAP]:          '盤上（上位HQリーダー登場）',
  [BN_HQ_STATUS.UNAVAILABLE]:     '使用不能（無線破損・戦死等）',
};

let _bnHQStatus = BN_HQ_STATUS.OFF_MAP_COMM;

/** @returns {string} */
export function getBNHQStatus() { return _bnHQStatus; }

/** @param {string} s */
export function setBNHQStatus(s) {
  if (s in BN_HQ_STATUS_LABELS) _bnHQStatus = s;
}

/**
 * BN HQ インパルスを解決する（カードは引かない）。
 * @returns {{status:string, activatedCOHQ:string[], bnCommands:number, note:string}}
 */
export function resolveBNHQImpulse() {
  const status = _bnHQStatus;
  const result = { status, activatedCOHQ: [], bnCommands: 0, note: '' };

  if (status === BN_HQ_STATUS.ON_MAP) {
    // 最上級の上位HQユニットに最大コマンドを付与（繰り越し不可）
    result.bnCommands = getExpendLimit();
    setCurrentAP(BN_HQ_UNIT_ID, result.bnCommands);
    setCommandsDrawn(BN_HQ_UNIT_ID, true);
    result.note = `BN HQ に最大 ${result.bnCommands} コマンド（save 不可）。`
      + 'CO HQ の起動にもここから消費する';
    return result;
  }

  if (status === BN_HQ_STATUS.OFF_MAP_COMM) {
    const blocked = [];
    const noComm = [];
    for (const id of findUnitsByCommandRole('co_hq')) {
      // §4.1.4: Fire Team 面の CO HQ は上位HQに起動されない
      if (!isOnCommandSide(id)) { blocked.push(id); continue; }
      // §4.1.1「if the CO HQ is in communication via a BN TAC radio or phone」
      const comm = _communicates(BN_HQ_UNIT_ID, id);
      if (!comm.ok) { noComm.push(`${id}: ${comm.reason}`); continue; }
      setActivated(id, true);
      result.activatedCOHQ.push(id);
    }
    if (result.activatedCOHQ.length) {
      result.note = 'BN HQ は盤外だが BN TAC で通信可のため CO HQ を自動起動（カードは引かない）';
    } else if (blocked.length) {
      result.note = 'CO HQ が Fire Team 面のため起動されない。CO HQ イニシアチブ・インパルスで引く';
    } else {
      result.note = `BN TAC で CO HQ と通信できない（${noComm[0] ?? '不明'}）。CO HQ イニシアチブ・インパルスから開始`;
    }
    if (blocked.length) result.blockedFireTeamSide = blocked;
    if (noComm.length)  result.blockedNoComm = noComm;
    return result;
  }

  // §3.3.1a / §4.1.1: BN HQ が使えない場合はターンが CO HQ イニシアチブから始まる。
  // ただし**前ターンからのランナーが盤上にいる**場合は例外（§4.3.2）。
  // ランナーの有無は runner.js が持つが、command.js から参照すると循環参照になるため、
  // 呼び出し側（map.js）が runnersOnMapCount() を見て注記を補う。
  result.noBNHQ = true;
  result.note = status === BN_HQ_STATUS.UNAVAILABLE
    ? 'BN HQ 使用不能。CO HQ は起動されない。'
    : 'BN HQ と通信できず CO HQ は起動されない。';
  return result;
}

// ===== §3.3.2d / §4.1.1 General Initiative インパルス =====
//
// FOF.pdf p.16 §3.3.2d ／ p.20 §4.1.1「General Initiative Impulse」
//   ・アクションカードを1枚引き、**星アイコンの数字（＝イニシアチブ値）**をそのまま使う。
//   ・単一小隊ミッション（Combat Patrol 等、実質1個小隊しか出ないもの）なら
//     **半分にして端数切り捨て**。それ以外の修正（§4.1.2）は一切乗らない。
//   ・盤上のどのユニットへの命令にも使える。**HQ/Staff は不要で、通信も不要**
//     （§4.1.3 の「必ずHQ/Staffが発令者でなければならないアクション」だけは例外）。
//   ・**繰り越せない**（save 不可）。

let _singlePlatoonMission = false;

/** @returns {boolean} 単一小隊ミッションか（§3.3.2d の半減対象） */
export function getSinglePlatoonMission() { return _singlePlatoonMission; }

/** @param {boolean} v */
export function setSinglePlatoonMission(v) { _singlePlatoonMission = !!v; }

/**
 * シナリオ定義から単一小隊ミッションかどうかを取り込む。
 * 明示の singlePlatoon が無ければ missionType==='combat_patrol' を単一小隊とみなす。
 * @param {object} scenario
 */
export function applyScenarioCommandSettings(scenario) {
  _singlePlatoonMission = scenario?.singlePlatoon ?? scenario?.missionType === 'combat_patrol';
}

/**
 * General Initiative の取得数を計算する（カードのドロー自体は呼び出し側=人間が行う）。
 * @param {number} cardInitiative - 引いたカードの星アイコンの数字
 * @returns {{base:number, halved:boolean, total:number}}
 */
export function resolveGeneralInitiative(cardInitiative) {
  const base = cardInitiative ?? 0;
  const halved = _singlePlatoonMission;
  return { base, halved, total: halved ? Math.floor(base / 2) : base };
}

// ===== §4.1.2 コマンドドローの修正 =====
//
// FOF.pdf p.20 §4.1.2「Modifications to the Command Draw」
//   A. HQ/Staff が: Pinned −1 ／ Green −1 ／ Veteran +1 ／ カバーマーカー下 +1
//   B. HQ/Staff が VOF 下: Small Arms −1 ／ Automatic −2
//      ／ Heavy・Sniper・Grenade・Incoming!・Air Strike! −3
//      （複数ある場合は最も強い＝最も低い1つだけを見る）
//   C. 現在の活動レベルが No Contact: +1
// 適用対象は起動セグメントとイニシアチブセグメントのドローのみ。
// **CO Staff Initiative Impulse と General Initiative Impulse には一切適用しない。**
// 最低値: 起動セグメント=1（p.18）／イニシアチブセグメント=0（p.19）。

/**
 * VOF タイプ → コマンド修正値（§4.1.2 B）。
 * ルール本文が列挙しているのは Small Arms / Automatic /
 * Heavy・Sniper・Grenade・Incoming!・Air Strike! のみ。
 * 列挙外（Mines/BoobyTrap/Demo/Pending/Illum/All Pinned）は修正なしとして扱う。
 */
export const VOF_COMMAND_MOD = {
  'S': -1,
  'A': -2,
  'H': -3, 'S!': -3, 'Grenade': -3,
  'Incoming-3': -3, 'Incoming-4': -3, 'Incoming-5': -3,
  'Incoming-6': -3, 'Incoming-7': -3,
  'WP-3': -3, 'WP-4': -3,
  'AirStrike': -3, 'AirStrike-8': -3,
};

/** 起動セグメントの最低コマンド数 */
export const MIN_ACTIVATION_COMMANDS = 1;
/** イニシアチブセグメントの最低コマンド数 */
export const MIN_INITIATIVE_COMMANDS = 0;

/**
 * そのユニットが乗っているカードの VOF による修正（§4.1.2 B）。
 * 1カード1VOF なので「最も強いものだけ」は自動的に満たされる。
 * ※ Sniper VOF は実際の標的に関係なく同カードのHQに影響する（§7.15）が、
 *    カード単位で判定しているのでこれも自動的に満たされる。
 * @param {string} unitId
 * @returns {{label:string, delta:number}|null}
 */
function _vofCommandMod(unitId) {
  const coord = unitCoordMap.get(unitId);
  if (!coord) return null;
  const vof = cardVOFMap.get(coord);
  if (!vof?.type) return null;
  const delta = VOF_COMMAND_MOD[vof.type];
  if (!delta) return null;
  return { label: `VOF ${vof.type}`, delta };
}

/**
 * §4.1.2 の修正一覧を返す（内訳を表示できるよう配列で返す）。
 * @param {string} unitId
 * @returns {Array<{label:string, delta:number}>}
 */
export function getCommandModifiers(unitId) {
  const mods = [];

  if (getUnitState(unitId).pinned) mods.push({ label: 'Pinned', delta: -1 });

  const exp = getUnitExperience(unitId);
  if (exp === 'green') mods.push({ label: 'Green', delta: -1 });
  if (exp === 'vet')   mods.push({ label: 'Veteran', delta: +1 });

  if (getUnitCoverSlot(unitId)) mods.push({ label: 'Cover', delta: +1 });

  const vofMod = _vofCommandMod(unitId);
  if (vofMod) mods.push(vofMod);

  if (getActivityLevel() === 'no_contact') mods.push({ label: 'No Contact', delta: +1 });

  return mods;
}

/**
 * カードの素の値に §4.1.2 の修正と最低値クランプを適用する。
 * @param {string} unitId
 * @param {number} base - カードの activated / initiative の素の値
 * @param {'activation'|'initiative'} segment
 * @returns {{base:number, mods:Array, sum:number, raw:number, min:number, total:number}}
 */
export function applyCommandModifiers(unitId, base, segment) {
  const mods = getCommandModifiers(unitId);
  const sum = mods.reduce((a, m) => a + m.delta, 0);
  const raw = base + sum;
  const min = segment === 'activation' ? MIN_ACTIVATION_COMMANDS : MIN_INITIATIVE_COMMANDS;
  return { base, mods, sum, raw, min, total: Math.max(min, raw) };
}

// ===== 導出値（計算）=====

/**
 * 次ターンへ繰り越せる上限（練度 × 視界）。
 * @param {string} unitId
 * @returns {number}
 */
export function getCarryoverMax(unitId) {
  // BN HQ・General Initiative のコマンドは繰り越せない
  // （p.19「You cannot save BN HQ Commands.」／p.20「General Initiative Commands cannot be saved.」）
  if (NO_SAVE_UNIT_IDS.has(unitId)) return 0;
  const exp = getUnitExperience(unitId);
  return CARRYOVER_TABLE[exp]?.[_visMode()] ?? 0;
}

/**
 * 1インパルスで消費できる上限（視界のみ・全ユニット共通）。
 * @returns {number}
 */
export function getExpendLimit() {
  return EXPEND_LIMIT[_visMode()];
}

// ===== インパルス終了（Saved Commands ゾーンへ）=====
//
// FOF.pdf p.18 §4.1.1 の Note ／ p.19 各インパルス末尾
//   「Track Commands for an HQ in the top zone then slide the marker down into
//    the Saved Commands zone when you are finished.」
//   「…if it has any Commands remaining that can be saved, slide it down into
//    the Saved Commands zone. Otherwise place it in the Activations Completed box.」
// 繰り越せる上限は練度×視界（§4.1.3・CARRYOVER_TABLE）。上限を超えた分は失われる。
// クリーンアップでは resetImpulseFlags() が全HQを Command Tracking ゾーンへ戻す
// （＝起動/取得済みフラグを落とす）。保存済みコマンドはそのまま残る。

/**
 * そのユニットのインパルスを終了し、残ったコマンドを繰越上限で切り捨てて保存する。
 * @param {string} unitId
 * @returns {{before:number, saved:number, lost:number, max:number}}
 */
export function finishImpulse(unitId) {
  const before = getCurrentAP(unitId);
  const max    = getCarryoverMax(unitId);
  const saved  = Math.min(before, max);
  setCurrentAP(unitId, saved);
  setCommandsDrawn(unitId, true);   // このターンのインパルスは終了
  setSpentThisImpulse(unitId, 0);   // 次のインパルスに向けて消費カウンタを戻す
  return { before, saved, lost: before - saved, max };
}

// ===== §4.1.3 1インパルスの消費上限 =====
//
// FOF.pdf p.20 §4.1.3「Command Limitations」
//   「During a daytime mission, the maximum number of Commands that any HQ or Staff
//     can expend in one Impulse is six. In any mission with Limited Visibility, the
//     maximum is four.」
// 繰越上限（練度依存・最大9）とは別物で、**貯めた分を1インパルスで吐き切ることはできない**。
// ※ General Initiative は HQ/Staff が消費するものではないので、この上限の対象外として扱う
//    （ルール本文は "any HQ or Staff" と限定しており、General Initiative Impulse は
//      そもそも発令者にHQ/Staffを要求しない・p.20）。

/**
 * このインパルスで既に消費したコマンド数。
 * @param {string} unitId
 * @returns {number}
 */
export function getSpentThisImpulse(unitId) {
  return unitCommandMap.get(unitId)?.spent ?? 0;
}

/**
 * @param {string} unitId
 * @param {number} n
 */
export function setSpentThisImpulse(unitId, n) {
  if (!unitCommandMap.has(unitId)) unitCommandMap.set(unitId, { currentAP: 0 });
  unitCommandMap.get(unitId).spent = Math.max(0, n);
}

/**
 * あと1コマンド消費できるか（保有があり、かつ消費上限に達していない）。
 * @param {string} unitId
 * @returns {boolean}
 */
export function canExpendCommand(unitId) {
  if (unitId === GENERAL_INIT_UNIT_ID) return getCurrentAP(unitId) > 0; // 上限の対象外
  return getCurrentAP(unitId) > 0 && getSpentThisImpulse(unitId) < getExpendLimit();
}

/**
 * コマンドを1つ消費する（上限に達していれば何もしない）。
 * @param {string} unitId
 * @returns {{ok:boolean, spent:number, limit:number, ap:number}}
 */
export function expendCommand(unitId) {
  const limit = getExpendLimit();
  if (!canExpendCommand(unitId)) {
    return { ok: false, spent: getSpentThisImpulse(unitId), limit, ap: getCurrentAP(unitId) };
  }
  changeCurrentAP(unitId, -1);
  setSpentThisImpulse(unitId, getSpentThisImpulse(unitId) + 1);
  return { ok: true, spent: getSpentThisImpulse(unitId), limit, ap: getCurrentAP(unitId) };
}

/**
 * 消費の取り消し（押し間違いの手動補正）。コマンドを戻し消費カウンタも1つ減らす。
 * @param {string} unitId
 */
export function undoExpendCommand(unitId) {
  changeCurrentAP(unitId, +1);
  setSpentThisImpulse(unitId, getSpentThisImpulse(unitId) - 1);
}

// ===== §4.2.1a Activate a subordinate HQ or Staff =====
//
// FOF.pdf p.22 アクション表 a.
//   Cost 1 ／ Draw: Auto（判定不要・必ず成功）
//   Originator: CO HQ, BN HQ ／ Recipient: CO HQ→任意の下位HQ・Staff、BN HQ→CO HQ のみ
//   「Only the BN HQ can Activate the CO HQ. Only the CO HQ can Activate PLT HQs or CO Staff.」
// ※ 同項には「発令者・対象とも command side を向いていること（1.2.3B, 3.3.1）」ともあるが、
//    駒の表裏（command side / Fire Team side）は未実装なのでここではチェックしない。

/** Activate アクションのコマンド消費量 */
export const ACTIVATE_COST = 1;

/**
 * originator が target を Activate できるか。
 * @param {string} originatorId
 * @param {string} targetId
 * @returns {{ok:boolean, reason:string}}
 */
export function canActivateTarget(originatorId, targetId) {
  const role = getCommandRole(originatorId);
  const targets = CAN_ACTIVATE[role] ?? [];
  if (!targets.length) {
    return { ok: false, reason: `${COMMAND_ROLE_LABELS[role] ?? '該当ユニット'} は誰も起動できない` };
  }
  const targetRole = getCommandRole(targetId);
  if (!targetRole) return { ok: false, reason: 'HQ/Staff ではないので起動できない' };
  if (!targets.includes(targetRole)) {
    return { ok: false, reason: `${COMMAND_ROLE_LABELS[role]} が起動できるのは ${targets.map(t => COMMAND_ROLE_LABELS[t]).join('・')} のみ` };
  }
  if (getActivated(targetId)) return { ok: false, reason: 'すでに起動済み' };
  // §4.2.1a: 発令者・対象とも command side であること。
  // §4.1.4: Fire Team 面の HQ/Staff は起動されず、イニシアチブで引くしかない。
  if (!isOnCommandSide(originatorId)) {
    return { ok: false, reason: '自分が Fire Team 面なので起動アクションを出せない' };
  }
  if (!isOnCommandSide(targetId)) {
    return { ok: false, reason: '対象が Fire Team 面（起動されない・イニシアチブで引く）' };
  }
  if (getCurrentAP(originatorId) < ACTIVATE_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(originatorId)) return { ok: false, reason: 'このインパルスの消費上限に達している' };
  // §4.1.1「any friendly subordinate units in play and **in communication**」
  const comm = _communicates(originatorId, targetId);
  if (!comm.ok) return { ok: false, reason: `通信できない（${comm.reason}）` };
  return { ok: true, reason: comm.via ?? '' };
}

/**
 * 下位HQ/Staff を Activate する（1コマンド消費・自動成功）。
 * @param {string} originatorId
 * @param {string} targetId
 * @returns {{ok:boolean, reason:string}}
 */
export function activateSubordinate(originatorId, targetId) {
  const check = canActivateTarget(originatorId, targetId);
  if (!check.ok) return check;
  expendCommand(originatorId);
  setActivated(targetId, true);
  return { ok: true, reason: '' };
}

/**
 * originator が今 Activate できる相手を列挙する（できない相手も理由つきで返す）。
 * @param {string} originatorId
 * @returns {Array<{id:string, label:string, ok:boolean, reason:string, activated:boolean}>}
 */
export function listActivationTargets(originatorId) {
  const role = getCommandRole(originatorId);
  const roles = CAN_ACTIVATE[role] ?? [];
  const out = [];
  for (const r of roles) {
    for (const id of findUnitsByCommandRole(r)) {
      const check = canActivateTarget(originatorId, id);
      out.push({
        id,
        label: findUnitDef(id)?.label ?? id,
        ok: check.ok,
        reason: check.reason,
        activated: getActivated(id),
      });
    }
  }
  return out;
}

// ===== §3.3 インパルスの順序 =====
//
// FOF.pdf p.15-16 §3.3.1／§3.3.2。
// 「Complete the instructions for one Segment/Impulse before moving on to the next.」（p.18）
// PLT HQ どうしの順番は自由（p.19「PLT HQs do not need to be selected in number order.」）。

export const IMPULSE_SEQUENCE = [
  { key: 'bn_hq',                label: 'BN HQ インパルス',                    segment: 'activation' },
  { key: 'co_hq_activation',     label: 'CO HQ インパルス（起動）',             segment: 'activation' },
  { key: 'plt_staff_activation', label: 'PLT HQ / CO Staff インパルス（起動）', segment: 'activation' },
  { key: 'co_hq_initiative',     label: 'CO HQ イニシアチブ',                  segment: 'initiative' },
  { key: 'plt_initiative',       label: 'PLT HQ イニシアチブ',                 segment: 'initiative' },
  { key: 'co_staff_initiative',  label: 'CO Staff イニシアチブ',               segment: 'initiative' },
  { key: 'general_initiative',   label: 'General Initiative',                  segment: 'initiative' },
];

let _impulseIdx = 0;

/** @returns {{key:string, label:string, segment:string, index:number, last:boolean}} */
export function getCurrentImpulse() {
  return { ...IMPULSE_SEQUENCE[_impulseIdx], index: _impulseIdx, last: _impulseIdx === IMPULSE_SEQUENCE.length - 1 };
}

/** 次のインパルスへ進む（最後まで来たらそこで止まる） */
export function advanceImpulse() {
  if (_impulseIdx < IMPULSE_SEQUENCE.length - 1) _impulseIdx++;
  return getCurrentImpulse();
}

/** インパルスを先頭（BN HQ）へ戻す */
export function resetImpulse() { _impulseIdx = 0; }

/** @param {number} i */
export function setImpulseIndex(i) {
  if (Number.isInteger(i) && i >= 0 && i < IMPULSE_SEQUENCE.length) _impulseIdx = i;
}

/** @returns {number} */
export function getImpulseIndex() { return _impulseIdx; }

/**
 * 今のインパルスでそのユニットがコマンドを取得できるか。
 * @param {string} unitId
 * @returns {{ok:boolean, reason:string}}
 */
export function isUnitEligibleNow(unitId) {
  const key  = getCurrentImpulse().key;
  const role = getCommandRole(unitId);
  const act  = getActivated(unitId);
  const NG = (r) => ({ ok: false, reason: r });

  switch (key) {
    case 'bn_hq':
      return unitId === BN_HQ_UNIT_ID ? { ok: true, reason: '' } : NG('今は BN HQ インパルス');
    case 'co_hq_activation':
      if (role !== 'co_hq') return NG('今は CO HQ インパルス（起動）');
      return act ? { ok: true, reason: '' } : NG('起動されていない（イニシアチブ・セグメントで取得する）');
    case 'plt_staff_activation':
      if (role !== 'plt_hq' && role !== 'co_staff') return NG('今は PLT HQ / CO Staff インパルス（起動）');
      return act ? { ok: true, reason: '' } : NG('起動されていない（イニシアチブ・セグメントで取得する）');
    case 'co_hq_initiative':
      if (role !== 'co_hq') return NG('今は CO HQ イニシアチブ');
      return act ? NG('起動セグメントで取得済みの扱い（イニシアチブは未起動のみ）') : { ok: true, reason: '' };
    case 'plt_initiative':
      if (role !== 'plt_hq') return NG('今は PLT HQ イニシアチブ');
      return act ? NG('起動セグメントで取得済みの扱い（イニシアチブは未起動のみ）') : { ok: true, reason: '' };
    case 'co_staff_initiative':
      if (role !== 'co_staff') return NG('今は CO Staff イニシアチブ');
      return act ? NG('起動セグメントで取得済みの扱い（イニシアチブは未起動のみ）') : { ok: true, reason: '' };
    case 'general_initiative':
      return unitId === GENERAL_INIT_UNIT_ID ? { ok: true, reason: '' } : NG('今は General Initiative');
    default:
      return NG('不明なインパルス');
  }
}
