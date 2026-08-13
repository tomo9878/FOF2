// ===== 敵ユニット実配置（§8.4.3 の最小実装）=====
//
// enemy-contact.js（§8.3）で解決したパッケージの各ユニットについて、
// §8.4.2（方向）+ §8.4.1（距離、placement.js）で座標を決め、実際に盤面へ配置する。
//
// 対応できるのは「実体のあるユニット（squadPool/equipmentPoolで実際のunitIdまで
// 解決できたもの）」と「VOFマーカー（kind:'marker'）」のみ。
// Sniper・FLAK 36・Patrol Squad等、まだ駒（unitDef）が定義されていないユニットは
// 「手動配置が必要」として結果に含め、実際には置かない（座標・距離は表示する）。
//
// カード引き（§8.4.2 方向のR#）は他の判定と同じく人間がボタンを押して行う。

import { getScenario } from './data/scenarios/index.js';
import { resolveTable } from './data/scenario-tables.js';
import { resolveDistanceCode, resolvePlacementCoord } from './placement.js';
import { UNITS } from './data/units-normandy.js';
import { addUnitToCard } from './grid.js';
import { setVOFType } from './vof.js';

const MISSION_NUMBER = 1;

function _tables() {
  return getScenario(MISSION_NUMBER)?.tables ?? null;
}

function _findUnitDef(unitId) {
  for (const units of Object.values(UNITS)) {
    const u = units.find(u => u.id === unitId);
    if (u) return u;
  }
  return null;
}

/**
 * §8.4.2 方向判定を1回行う（実際にアクションカードを1枚引く。scenario-tables.js の rollR）。
 * @returns {{ r:number|null, card:object|null, direction:('front'|'left_front'|'right_front')|null }}
 */
export function resolveDirection() {
  const table = _tables()?.unitPlacementDirection;
  if (!table) return { r: null, card: null, direction: null };
  const { r, card, row } = resolveTable(table);
  return { r, card, direction: row?.direction ?? null };
}

/**
 * enemy-contact.js の resolvePackageChoices() が返した resolvedUnits を、
 * §8.4.1（距離）+ 指定方向で実際の座標に解決し、可能なものは盤面へ配置する。
 * @param {string} triggerCoord - PCマーカーがあったカード（接触の起点）
 * @param {'front'|'left_front'|'right_front'} directionKey
 * @param {object[]} resolvedUnits
 * @returns {Array<{
 *   name:string, coord:string|null, distance:number|null, placed:boolean,
 *   reason?:string, unitId?:string, label?:string, vofType?:string,
 * }>}
 */
export function placeResolvedUnits(triggerCoord, directionKey, resolvedUnits) {
  return (resolvedUnits ?? []).map(u => {
    const { code } = resolveDistanceCode(u.distanceSpec);
    const { coord, distance } = resolvePlacementCoord(triggerCoord, directionKey, code);

    if (!coord) {
      return { name: u.name, coord: null, distance: null, placed: false,
        reason: '配置先が決まらない（マップ端 / LOS遮断）' };
    }

    if (u.kind === 'marker') {
      if (!u.vofType) {
        return { name: u.name, coord, distance, placed: false, reason: 'VOF種別が未決定' };
      }
      setVOFType(coord, u.vofType);
      return { name: u.name, coord, distance, placed: true, vofType: u.vofType };
    }

    const draw = u.squadDraw ?? u.equipmentDraw;
    if (!draw?.unitId) {
      const hasPool = u.squadPool || u.equipmentPool || u.equipmentPoolByChoice;
      const reason = hasPool
        ? 'プールの駒を使い切りました（手動で配置してください）'
        : 'このユニット種別はまだ駒が未定義です（手動で配置してください）';
      return { name: u.name, coord, distance, placed: false, reason };
    }
    const def = _findUnitDef(draw.unitId);
    if (!def) {
      return { name: u.name, coord, distance, placed: false, reason: `ユニット定義が見つからない: ${draw.unitId}` };
    }

    addUnitToCard(coord, def);
    return { name: u.name, coord, distance, placed: true, unitId: draw.unitId, label: draw.label ?? def.label };
  });
}
