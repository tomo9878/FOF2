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
import { unitCoordMap, getUnitState } from './state.js';
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
  for (const [unitId, entry] of unitCommandMap) {
    entry.activated = false;
    entry.drawn = false;
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
    for (const id of findUnitsByCommandRole('co_hq')) {
      setActivated(id, true);
      result.activatedCOHQ.push(id);
    }
    result.note = 'BN HQ は盤外だが通信可のため CO HQ を自動起動（カードは引かない）';
    return result;
  }

  result.note = status === BN_HQ_STATUS.UNAVAILABLE
    ? 'BN HQ 使用不能。CO HQ は起動されず、CO HQ イニシアチブ・インパルスから開始'
    : 'BN HQ と通信できず CO HQ は起動されない。CO HQ イニシアチブ・インパルスから開始';
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
  return { before, saved, lost: before - saved, max };
}
