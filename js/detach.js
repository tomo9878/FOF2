import {
  unitCoordMap,
  unitStrengthMap,
  detachedLATsMap,
  getUnitStrength,
  setUnitSteps,
  _trackLAT,
} from './state.js';
import { addUnitToCard, removeUnitFromCard } from './grid.js';

// ===== Detach 操作 =====

export function detachFireTeam(unit) {
  const coord = unitCoordMap.get(unit.id);
  if (!coord || !unit.fireteam) return;
  const s = getUnitStrength(unit.id);
  setUnitSteps(unit.id, (s?.steps ?? 3) - 1);
  // シャローコピーして元の fireteam 定義を保護する
  addUnitToCard(coord, { ...unit.fireteam });
  _trackLAT(unit.id, unit.fireteam.id);
}

export function detachAssaultTeam(unit) {
  const coord = unitCoordMap.get(unit.id);
  if (!coord || !unit.assaultteam) return;
  const s = getUnitStrength(unit.id);
  setUnitSteps(unit.id, (s?.steps ?? 3) - 1);
  // シャローコピーして元の assaultteam 定義を保護する
  addUnitToCard(coord, { ...unit.assaultteam });
  _trackLAT(unit.id, unit.assaultteam.id);
}

export function detachStep(unit) {
  const s = getUnitStrength(unit.id);
  setUnitSteps(unit.id, (s?.steps ?? 3) - 1);
}

export function supplementUnit(unit) {
  // maxSteps に戻し、分離した LAT を除去
  const s = getUnitStrength(unit.id);
  setUnitSteps(unit.id, s?.maxSteps ?? 3);
  const lats = detachedLATsMap.get(unit.id) || [];
  lats.forEach(latId => removeUnitFromCard(latId));
  detachedLATsMap.delete(unit.id);
}
