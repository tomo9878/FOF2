import {
  unitCoordMap,
  unitStrengthMap,
  detachedLATsMap,
  setUnitStrength,
  _trackLAT,
} from './state.js';
import { addUnitToCard, removeUnitFromCard } from './grid.js';

// ===== Detach 操作 =====

export function detachFireTeam(unit) {
  const coord = unitCoordMap.get(unit.id);
  if (!coord || !unit.fireteam) return;
  setUnitStrength(unit.id, 'reduced');
  // シャローコピーして元の fireteam 定義を保護する
  addUnitToCard(coord, { ...unit.fireteam });
  _trackLAT(unit.id, unit.fireteam.id);
}

export function detachAssaultTeam(unit) {
  const coord = unitCoordMap.get(unit.id);
  if (!coord || !unit.assaultteam) return;
  setUnitStrength(unit.id, 'reduced');
  // シャローコピーして元の assaultteam 定義を保護する
  addUnitToCard(coord, { ...unit.assaultteam });
  _trackLAT(unit.id, unit.assaultteam.id);
}

export function detachStep(unit) {
  setUnitStrength(unit.id, 'reduced');
}

export function supplementUnit(unit) {
  // reduced → full に戻し、分離した LAT を除去
  setUnitStrength(unit.id, 'full');
  const lats = detachedLATsMap.get(unit.id) || [];
  lats.forEach(latId => removeUnitFromCard(latId));
  detachedLATsMap.delete(unit.id);
}
