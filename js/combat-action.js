// ===== 戦闘アクション（§4.2.4）Tier1 =====
//
// FOF.pdf p.24-26 §4.2.4「Combat Actions」（Use Recipient's Experience Level for
// Command draw modifier＝移動 §4.2.2 と同じく対象の練度で修正。ただし a. Spot は
// スポッター自身の練度で修正＝§8.5 Spotting Attempt Draw Modifiers Table 参照）。
//
// 13アクション中、既存の VOF/PDF マーカー基盤（card-level・ユニット非帰属）で
// 完結できる6つ＋ a. Spot の計7つを実装する。残り（Demo/Flamethrower/Call for Fire/
// On-Map Mortar/FPF/FPL）は弾薬管理・Fire Mission ログ等の新規下位システムが要るため見送り
// （Call for Fire は fire-mission.js で別途実装。ACTION_SPEC.md 参照）。
//
// ── 実装した7アクション ──
//   a. Attempt to Spot                          — Draw 2(+/-)。§8.5 Draw Modifiers Table
//   k. Cease Fire                              — Auto。カードの VOF/PDF を除去
//   l. Shift Fire                               — Auto。VOF を別カードへ移す（PDF は移動先で人間が再設置）
//   b. Attempt to Concentrate Fire              — Draw 2(+/-)。成功で Concentrated Fire マーカー
//   c. Attempt to have a Platoon Concentrate Fire — b を小隊全員で（対象は同じカード）
//   d. Attempt to make a Grenade Attack          — Draw 2(+/-)。成功で Grenade VOF、失敗で Grenade Miss
//   h. Attempt to have a Platoon make a Grenade Attack — d を小隊全員で
//
// ── 既知の簡略化 ──
//   - VOF はカード単位（cardVOFMap）で、特定ユニットに帰属しない。そのため
//     「VOF を exert しているユニット」を要求する Cease Fire/Shift Fire の Recipient 判定は、
//     発令者が HQ/Staff であること以外は行わない（＝ canGiveOrder の通信/指揮系統チェックを
//     あえて経由しない。詳細は各関数のコメント）。
//   - Concentrate Fire の Recipient 資格「S/A/A/S/H VOF レーティングを持つユニット」は、
//     units-normandy.js に該当フィールド（vof/tripod）が無いため判定していない
//     （move.js の浸透における三脚/H除外チェックと同じ既知のデータ欠如）。
//   - Grenade Attack は Point Blank（同カード）のみ対応。Ranged Grenade Attack（G!レーティング・
//     射程・PDF追従）はユニットの G! レーティングデータが無いため未対応。
//   - Critical Hit（icons 2枚以上）・Jam・弾薬消費・Free Grenade Attack Response（7.10.5）は未実装。
//   - Grenade/Concentrate の対象は「カード全体」（既存の Grenade=VOF_IS_AREA 分類と整合）。
//     ルールの「カバー下のスタック or 露天から1駒」という対象選択の粒度は再現していない。
//   - Spot の「対象カードの Cover & Concealment 値」修正は terrain-data.js の defLow 固定で判定する
//     （ncm.js の _getTerrainDef と同様、白/黒境界どちら越しの視認かで defHigh/defLow を
//     使い分けるべきだが、Spot 方向専用の判定は未実装。既知の簡略化）。
//   - Spot の「対象ユニットの VOF レーティングが A / H・G!」修正は、Concentrate Fire と同じ理由
//     （該当フィールド無し）で未対応。「Sniper」判定も同様（プロジェクトに S! VOF は無い）。
//     「FO」判定のみ units-normandy.js の `fo:true` タグで対応（GE_Spotter_Mtr2/Arty1）。

import {
  canGiveOrder, getCurrentAP, canExpendCommand, expendCommand,
  getCommandRole, getPlatoonKey, findUnitDef,
  getSpentThisImpulse, getExpendLimit,
} from './command.js';
import { isGoodOrder } from './runner.js';
import { unitCoordMap, getUnitState, renderUnitBadges } from './state.js';
import { cardVOFMap, setVOFType, setConcentrate, setGrenadeMiss, clearVOF } from './vof.js';
import { clearAllPDFs } from './pdf.js';
import { hasLOS, getElevation } from './los.js';
import { getTerrainDefInfo } from './ncm.js';
import { getUnitCoverSlot } from './cover.js';
import { isStagingArea } from './phone.js';
import { getUnitExperience } from './campaign.js';
import { hasAmmoTracking, expendAmmo } from './ammo.js';

const BASE_DRAW = 2;

/** 練度による引き枚数修正（Vet+1 / Green-1。§4.2.4 見出しどおり対象の練度） */
function _expMod(unitId) {
  const exp = getUnitExperience(unitId);
  return exp === 'vet' ? +1 : exp === 'green' ? -1 : 0;
}

/** そのカードにいる敵ユニット一覧 */
function _enemiesOn(coord) {
  return [...unitCoordMap].filter(([id, c]) => c === coord && findUnitDef(id)?.faction !== 'friendly').map(([id]) => id);
}

// ===== a. Attempt to Spot =====

export const SPOT_COST = 1;

/**
 * §8.5 Spotting Attempt Draw Modifiers Table（練度以外の修正）。
 * @param {string} spotterId
 * @param {string} targetId
 * @returns {{mod:number, reasons:string[]}}
 */
function _spotModifiers(spotterId, targetId) {
  const reasons = [];
  let mod = 0;
  const spotterCoord = unitCoordMap.get(spotterId);
  const targetCoord  = unitCoordMap.get(targetId);

  const spotterExp = getUnitExperience(spotterId);
  if (spotterExp === 'green') { mod -= 1; reasons.push('スポッターGreen -1'); }
  if (spotterExp === 'vet')   { mod += 1; reasons.push('スポッターVeteran +1'); }

  // 対象カードの Cover & Concealment 値（簡略化: defLow 固定。ヘッダーコメント参照）
  const def = getTerrainDefInfo(targetCoord);
  if (def.defLow >= 3)      { mod -= 1; reasons.push('対象カード C&C値+3以上 -1'); }
  else if (def.defLow === 0){ mod += 1; reasons.push('対象カード C&C値+0 +1'); }

  if (spotterCoord && targetCoord && getElevation(targetCoord) > getElevation(spotterCoord)) {
    mod += 1; reasons.push('対象が高標高 +1');
  }

  if (getUnitCoverSlot(targetId)) { mod -= 1; reasons.push('対象がカバー下 -1'); }
  if (spotterCoord && spotterCoord === targetCoord) { mod += 1; reasons.push('スポッターと同じカード +1'); }
  if (findUnitDef(targetId)?.fo) { mod -= 1; reasons.push('対象がSniper/FO -1'); }
  if (getUnitState(targetId).exposed) { mod += 2; reasons.push('対象がExposed +2'); }

  const targetExp = getUnitExperience(targetId);
  if (targetExp === 'vet')   { mod -= 1; reasons.push('対象Veteran -1'); }
  if (targetExp === 'green') { mod += 1; reasons.push('対象Green +1'); }

  return { mod, reasons };
}

/**
 * §4.2.4a Spot を試みられるか。
 * @param {string} originatorId
 * @param {string} spotterId - Spot を行うユニット（Recipient）
 * @param {string} targetId  - Unspotted な敵ユニット
 * @returns {{ok:boolean, reason:string}}
 */
export function canSpot(originatorId, spotterId, targetId) {
  if (!getUnitState(targetId).unspotted) return { ok: false, reason: '対象は既に Spotted' };
  const spotterCoord = unitCoordMap.get(spotterId);
  if (!spotterCoord) return { ok: false, reason: 'スポッターが盤外' };
  if (isStagingArea(spotterCoord)) return { ok: false, reason: 'スタートエリアから Spot はできない（§8.5）' };
  const targetCoord = unitCoordMap.get(targetId);
  if (spotterCoord !== targetCoord && !hasLOS(spotterCoord, targetCoord)) {
    return { ok: false, reason: 'LOS が届かない' };
  }
  if (!isGoodOrder(spotterId)) return { ok: false, reason: 'Good Order ではない（盤外／Pinned／LAT）' };
  if (getCurrentAP(originatorId) < SPOT_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(originatorId)) return { ok: false, reason: 'このインパルスの消費上限に達している' };
  const order = canGiveOrder(originatorId, spotterId);
  if (!order.ok) return { ok: false, reason: order.reason };
  return { ok: true, reason: '' };
}

/** そのユニットから Spot を狙える Unspotted 敵ユニット一覧（LOS 内 or 同カード）*/
export function listSpotTargets(spotterId) {
  const coord = unitCoordMap.get(spotterId);
  if (!coord || isStagingArea(coord)) return [];
  return [...unitCoordMap]
    .filter(([id, c]) => findUnitDef(id)?.faction !== 'friendly' && getUnitState(id).unspotted
      && (c === coord || hasLOS(coord, c)))
    .map(([id]) => id);
}

/** 引く枚数（スポッター自身の練度で修正。§8.5 は Recipient=対象ではなくスポッター基準）*/
export function planSpot(spotterId, targetId) {
  const { mod, reasons } = _spotModifiers(spotterId, targetId);
  return { draws: Math.max(1, BASE_DRAW + mod), reasons };
}

/** 引いたカードに Crosshairs（spot_concentrate）アイコンがあるか */
export function isSpotSuccess(cards) {
  return cards.some(c => (c?.icons ?? []).includes('spot_concentrate'));
}

export function paySpotCost(originatorId) { expendCommand(originatorId); }

/** 成功: 対象を Spotted にする（unspotted=false）。失敗: 何もしない。 */
export function applySpot(targetId, success) {
  if (!success) return { ok: true, reason: '失敗（何も起きない）' };
  const s = getUnitState(targetId);
  s.unspotted = false;
  renderUnitBadges(targetId);
  return { ok: true, reason: 'Spotted にした' };
}

// ===== k. Cease Fire =====

export const CEASE_FIRE_COST = 1;

/**
 * §4.2.4k Cease Fire できるか。
 * 「Any unit in communication exerting a VOF regardless of the chain of command」＝
 * 誰が VOF を出しているかを問わない命令。この実装では VOF がユニットに帰属しないため、
 * 発令者が HQ/Staff でコマンドを払えることだけを条件にする（既知の簡略化）。
 * @param {string} originatorId
 * @param {string} coord
 * @returns {{ok:boolean, reason:string}}
 */
export function canCeaseFire(originatorId, coord) {
  if (!getCommandRole(originatorId)) return { ok: false, reason: 'HQ/Staff ではないので発令者になれない' };
  if (!cardVOFMap.get(coord)) return { ok: false, reason: 'このカードに VOF が無い' };
  if (getCurrentAP(originatorId) < CEASE_FIRE_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(originatorId)) return { ok: false, reason: 'このインパルスの消費上限に達している' };
  return { ok: true, reason: '' };
}

/**
 * §4.2.4k を実行する（Auto・カードを引かない）。
 * @param {string} originatorId
 * @param {string} coord
 * @returns {{ok:boolean, reason:string}}
 */
export function ceaseFire(originatorId, coord) {
  const check = canCeaseFire(originatorId, coord);
  if (!check.ok) return check;
  expendCommand(originatorId);
  clearVOF(coord);
  clearAllPDFs(coord);
  return { ok: true, reason: '' };
}

// ===== l. Shift Fire =====

export const SHIFT_FIRE_COST = 1;

/**
 * §4.2.4l Shift Fire できるか。
 * 「engaging any other eligible card in the Originator's LOS, including an
 *   unoccupied card (but not one with Unspotted opposing units)」
 * @param {string} originatorId
 * @param {string} fromCoord - 現在 VOF がある元カード
 * @param {string} toCoord   - 移す先
 * @returns {{ok:boolean, reason:string}}
 */
export function canShiftFire(originatorId, fromCoord, toCoord) {
  if (!getCommandRole(originatorId)) return { ok: false, reason: 'HQ/Staff ではないので発令者になれない' };
  if (fromCoord === toCoord) return { ok: false, reason: '同じカード' };
  if (!cardVOFMap.get(fromCoord)) return { ok: false, reason: '元のカードに VOF が無い' };
  if (!hasLOS(fromCoord, toCoord)) return { ok: false, reason: 'LOS が届かない' };
  const enemies = _enemiesOn(toCoord);
  if (enemies.length > 0 && enemies.every(id => getUnitState(id).unspotted)) {
    return { ok: false, reason: '移動先が Unspotted な敵のみのカード' };
  }
  if (getCurrentAP(originatorId) < SHIFT_FIRE_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(originatorId)) return { ok: false, reason: 'このインパルスの消費上限に達している' };
  return { ok: true, reason: '' };
}

/**
 * §4.2.4l を実行する（Auto）。VOF タイプを移す。
 * PDF は「移動先での実際の方向」が新規に決まるため自動移設しない
 * （既存の元カードの PDF は除去するので、移動先は人間が右クリックで再設置する）。
 * @param {string} originatorId
 * @param {string} fromCoord
 * @param {string} toCoord
 * @returns {{ok:boolean, reason:string}}
 */
export function shiftFire(originatorId, fromCoord, toCoord) {
  const check = canShiftFire(originatorId, fromCoord, toCoord);
  if (!check.ok) return check;
  expendCommand(originatorId);
  const type = cardVOFMap.get(fromCoord)?.type;
  clearVOF(fromCoord);
  clearAllPDFs(fromCoord);
  if (type) setVOFType(toCoord, type);
  return { ok: true, reason: 'PDF は移動先で手動再設置してください' };
}

// ===== b/c. Attempt to Concentrate Fire =====

export const CONCENTRATE_COST = 1;
export const PLATOON_CONCENTRATE_COST = 2;

/** 対象カードに Spotted な敵がいるか */
function _hasSpottedEnemy(coord) {
  return _enemiesOn(coord).some(id => !getUnitState(id).unspotted);
}

/**
 * §4.2.4b Concentrate Fire できるか。
 * @param {string} originatorId - 発令する HQ/Staff
 * @param {string} unitId       - 実際に撃つ Good Order ユニット（Recipient）
 * @param {string} targetCoord  - Spotted な敵がいる対象カード
 * @returns {{ok:boolean, reason:string}}
 */
export function canConcentrateFire(originatorId, unitId, targetCoord) {
  if (!isGoodOrder(unitId)) return { ok: false, reason: 'Good Order ではない（盤外／Pinned／LAT）' };
  if (!_hasSpottedEnemy(targetCoord)) return { ok: false, reason: '対象カードに Spotted な敵がいない' };
  const coord = unitCoordMap.get(unitId);
  if (!hasLOS(coord, targetCoord)) return { ok: false, reason: 'LOS が届かない' };
  if (getCurrentAP(originatorId) < CONCENTRATE_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(originatorId)) return { ok: false, reason: 'このインパルスの消費上限に達している' };
  const order = canGiveOrder(originatorId, unitId);
  if (!order.ok) return { ok: false, reason: order.reason };
  return { ok: true, reason: '' };
}

/** 引く枚数（対象ユニットの練度で修正） */
export function planConcentrateFire(unitId) {
  return { draws: Math.max(0, BASE_DRAW + _expMod(unitId)) };
}

/** 引いたカードに Crosshairs（spot_concentrate）アイコンがあるか */
export function isConcentrateFireSuccess(cards) {
  return cards.some(c => (c?.icons ?? []).includes('spot_concentrate'));
}

export function payConcentrateFireCost(originatorId) { expendCommand(originatorId); }

/** 盤上の全カード座標（DOM から取得。move.js の listMoveTargets 等と同じ方式） */
function _allCoords() {
  return [...document.querySelectorAll('.terrain-card[data-coord]')].map(el => el.dataset.coord);
}

/**
 * その駒から Concentrate Fire を狙える対象カード一覧（LOS が通り、Spotted な敵がいるカード）。
 * @param {string} unitId
 * @returns {Array<string>}
 */
export function listConcentrateFireTargetCoords(unitId) {
  const coord = unitCoordMap.get(unitId);
  if (!coord) return [];
  return _allCoords().filter(c => c !== coord && hasLOS(coord, c) && _hasSpottedEnemy(c));
}

/**
 * 成功時：対象カードに Concentrated Fire マーカーを立てる。失敗時：何もしない（7.11.2）。
 * @param {string} targetCoord
 * @param {boolean} success
 */
/**
 * @param {string} targetCoord
 * @param {boolean} success
 * @param {string} [unitId] - 実際に撃ったユニット（§7.11.3 弾薬消費用。渡されなければ消費しない）
 */
export function applyConcentrateFire(targetCoord, success, unitId = null) {
  if (!success) return { ok: true, reason: '失敗（何も起きない）' };
  setConcentrate(targetCoord, true);
  if (unitId && hasAmmoTracking(unitId)) expendAmmo(unitId, 1); // §7.11.3
  return { ok: true, reason: 'Concentrated Fire マーカーを配置' };
}

/**
 * §4.2.4c 小隊 Concentrate Fire の対象一覧（同じカードの自小隊 Good Order units で
 * targetCoord に LOS が通る者）。コストは2固定でまとめて払う。
 * @param {string} pltHqId
 * @param {string} targetCoord
 * @returns {Array<string>}
 */
export function listPlatoonConcentrateTargets(pltHqId, targetCoord) {
  if (getCommandRole(pltHqId) !== 'plt_hq') return [];
  if (!_hasSpottedEnemy(targetCoord)) return [];
  const coord = unitCoordMap.get(pltHqId);
  const platoon = getPlatoonKey(pltHqId);
  return [...unitCoordMap]
    .filter(([id, c]) => c === coord && getPlatoonKey(id) === platoon && isGoodOrder(id) && hasLOS(coord, targetCoord))
    .map(([id]) => id);
}

export function canPlatoonConcentrateFire(pltHqId, targetCoord) {
  if (getCommandRole(pltHqId) !== 'plt_hq') return { ok: false, reason: 'PLT HQ にしか出せない' };
  if (!listPlatoonConcentrateTargets(pltHqId, targetCoord).length) return { ok: false, reason: '対象になる部隊がいない' };
  if (getCurrentAP(pltHqId) < PLATOON_CONCENTRATE_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (getSpentThisImpulse(pltHqId) + PLATOON_CONCENTRATE_COST > getExpendLimit()) {
    return { ok: false, reason: 'このインパルスの消費上限に達している' };
  }
  return { ok: true, reason: '' };
}

export function payPlatoonConcentrateFireCost(pltHqId) {
  expendCommand(pltHqId);
  expendCommand(pltHqId);
}

// ===== d/h. Attempt to make a Grenade Attack =====

export const GRENADE_COST = 1;
export const PLATOON_GRENADE_COST = 2;

/** 同じカードに Good Order な敵がいるか（Point Blank の対象） */
function _hasEnemyGoodOrderOnSameCard(coord) {
  return _enemiesOn(coord).some(id => !getUnitState(id).pinned);
}

/**
 * §4.2.4d Grenade Attack できるか（Point Blank・同カードのみ。Tier1 の既知の簡略化）。
 * @param {string} originatorId
 * @param {string} unitId - 撃つユニット（Recipient）
 * @returns {{ok:boolean, reason:string}}
 */
export function canGrenadeAttack(originatorId, unitId) {
  if (!isGoodOrder(unitId)) return { ok: false, reason: 'Good Order ではない（盤外／Pinned／LAT）' };
  const coord = unitCoordMap.get(unitId);
  if (!_hasEnemyGoodOrderOnSameCard(coord)) return { ok: false, reason: '同じカードに攻撃対象の敵がいない' };
  if (getCurrentAP(originatorId) < GRENADE_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (!canExpendCommand(originatorId)) return { ok: false, reason: 'このインパルスの消費上限に達している' };
  const order = canGiveOrder(originatorId, unitId);
  if (!order.ok) return { ok: false, reason: order.reason };
  return { ok: true, reason: '' };
}

export function planGrenadeAttack(unitId) {
  return { draws: Math.max(0, BASE_DRAW + _expMod(unitId)) };
}

/** 引いたカードに Grenade アイコンがあるか */
export function isGrenadeSuccess(cards) {
  return cards.some(c => (c?.icons ?? []).includes('grenade'));
}

export function payGrenadeCost(originatorId) { expendCommand(originatorId); }

/**
 * 成功: 対象ユニットのカードに Grenade VOF を配置（既存の cardVOFMap は1カード1VOFの
 * 簡略化のため、既存 VOF があれば上書きになる）。
 * 失敗: Grenade Miss Modifier を配置（7.10.4）。
 * @param {string} unitId
 * @param {boolean} success
 */
export function applyGrenadeAttack(unitId, success) {
  const coord = unitCoordMap.get(unitId);
  if (success) {
    setVOFType(coord, 'Grenade');
    return { ok: true, reason: 'Grenade VOF を配置' };
  }
  setGrenadeMiss(coord, true);
  return { ok: true, reason: 'Grenade Miss Modifier を配置' };
}

/**
 * §4.2.4h 小隊 Grenade Attack の対象一覧（同じカードの自小隊 Good Order units）。
 * コストは2固定でまとめて払い、各ユニットは個別にドローする（h の draw は d をそのまま繰り返す）。
 * @param {string} pltHqId
 * @returns {Array<string>}
 */
export function listPlatoonGrenadeTargets(pltHqId) {
  if (getCommandRole(pltHqId) !== 'plt_hq') return [];
  const coord = unitCoordMap.get(pltHqId);
  if (!_hasEnemyGoodOrderOnSameCard(coord)) return [];
  const platoon = getPlatoonKey(pltHqId);
  return [...unitCoordMap]
    .filter(([id, c]) => c === coord && getPlatoonKey(id) === platoon && isGoodOrder(id))
    .map(([id]) => id);
}

export function canPlatoonGrenadeAttack(pltHqId) {
  if (getCommandRole(pltHqId) !== 'plt_hq') return { ok: false, reason: 'PLT HQ にしか出せない' };
  if (!listPlatoonGrenadeTargets(pltHqId).length) return { ok: false, reason: '対象になる部隊がいない' };
  if (getCurrentAP(pltHqId) < PLATOON_GRENADE_COST) return { ok: false, reason: 'コマンドが足りない' };
  if (getSpentThisImpulse(pltHqId) + PLATOON_GRENADE_COST > getExpendLimit()) {
    return { ok: false, reason: 'このインパルスの消費上限に達している' };
  }
  return { ok: true, reason: '' };
}

export function payPlatoonGrenadeCost(pltHqId) {
  expendCommand(pltHqId);
  expendCommand(pltHqId);
}
