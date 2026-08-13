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
 * ユニットの commandRole を UNITS 定義から引く（なければ null）。
 * @param {string} unitId
 * @returns {string|null}
 */
export function getCommandRole(unitId) {
  for (const units of Object.values(UNITS)) {
    const u = units.find(u => u.id === unitId);
    if (u) return u.commandRole ?? null;
  }
  return null;
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

// ===== 起動(Activated) / イニシアチブ 判定 =====
//
// CO HQ が起動を選んだユニットは「起動」扱い（カードの activated 値を取得）。
// 選ばれなかったユニットが自発的にカードを引く場合は「イニシアチブ」扱い
// （カードの initiative 値を取得）で、その時点で自動的に「起動済み」になる。
// どちらで起動するかの判断（誰を選ぶか）は人間が管理する。

/**
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
