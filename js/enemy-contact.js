// ===== 敵接触タイプ判定（§8.3 Determining Type of Enemy Contact）=====
//
// PC解決（pc-resolve.js, §8.2.4）で接触が成立した後、
// 「どの敵パッケージが出現するか」をミッション定義の R# テーブルから判定する。
//
// 手順（ルール §8.3）:
//   1. R# を1回判定する（denom はミッションの enemyContactPackages.denom）
//   2. 接触の元になった PC マーカーの文字(A/B/C)の列でパッケージ番号を引く
//   3. パッケージ番号を enemyForcePackages 詳細リストで解決し、内容を返す
//
// ミッション選択UIは未実装のため、現状は map.js と同様 Mission 1 固定。
// シナリオ選択UI実装時に MISSION_NUMBER を可変にする。

import { getScenario } from './data/scenarios/index.js';
import { resolveTable, resolveValueSpec, rollR } from './data/scenario-tables.js';
import { UNITS } from './data/units-normandy.js';

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

// ===== Squad 袋引き（"Draw one at random each time a squad is placed."）=====
//
// 一度引いた分隊は（戦闘不能で盤上から除去された後も）同じミッション中は再度引かない、
// という物理コンポーネント（固有カウンター）の性質を反映するため、盤上にいるかどうかではなく
// 専用の「使用済み」セットで管理する。

const _usedSquads = new Set();

/** プレイ状態リセット時に呼ぶ（新しいミッション開始相当）。 */
export function resetSquadPools() {
  _usedSquads.clear();
}

/**
 * §8.3 の Enemy Force Package が汎用の "Squad" を要求する場合に、
 * ミッション定義の squadPools から未使用の1体をランダムに引く。
 * @param {string} poolKey - 例 'grenadier'
 * @returns {{ unitId:string, rating:string|null, label:string, r:number, card:object }|null}
 *   プールが尽きている/未定義の場合は null
 */
export function drawSquadFromPool(poolKey) {
  const pool = _tables()?.squadPools?.[poolKey];
  if (!pool || pool.length === 0) return null;

  const available = pool.filter(id => !_usedSquads.has(id));
  if (available.length === 0) return null; // 使い切り

  const { r, card } = rollR(available.length);
  const unitId = available[r - 1];
  _usedSquads.add(unitId);

  const def = _findUnitDef(unitId);
  return { unitId, rating: def?.rating ?? null, label: def?.label ?? unitId, r, card };
}

/**
 * HMG/LMG/迫撃砲/スポッター等、同一性能の複数個体からなる装備プールから
 * 「次の未使用個体」を順番に割り当てる（袋引きと違い、番号にルール上の意味は無いため
 * ランダム抽選ではない＝カードを引かない）。
 * @param {string} poolKey - 例 'hmg'/'lmg'/'mortar'/'spotter_arty'/'spotter_mtr'
 * @returns {{ unitId:string, label:string }|null} プールが尽きている/未定義の場合は null
 */
function _drawFromEquipmentPool(poolKey) {
  const pool = _tables()?.equipmentPools?.[poolKey];
  if (!pool || pool.length === 0) return null;

  const available = pool.filter(id => !_usedSquads.has(id));
  if (available.length === 0) return null; // 使い切り

  const unitId = available[0];
  _usedSquads.add(unitId);
  const def = _findUnitDef(unitId);
  return { unitId, label: def?.label ?? unitId };
}

/**
 * パッケージ内の追加判定（choices）を解決する。
 * 例: MG Nest の LMG/HMG どちら、Incoming! の Artillery FO/Mtr FO どちら、
 *     Mines! の Sniper 追加有無、Strong Point のHMGをどちらの分隊に追加するか等。
 * R#が明記されているものはその比率、明記なしのものは§1.2.7の一般則で denom=2（50/50）を引く。
 *
 * units に variantOf/whenValue が付いている場合、resolvedUnits はその選択結果で
 * フィルタする（例: MG Nest は LMG と HMG の両方が units にあるが、選択結果に
 * 応じてどちらか一方だけが resolvedUnits に残る）。
 *
 * さらに各ユニットの実体解決を行う:
 *   - squadPool              → drawSquadFromPool()（ランダム袋引き）の結果を squadDraw に格納
 *   - equipmentPool          → _drawFromEquipmentPool()（順番割当）の結果を equipmentDraw に格納
 *   - equipmentPoolByChoice  → choices の結果に応じてプールを選んでから同様に解決
 *   - vofTypeByChoice        → choices の結果に応じてVOF種別（Incoming-3/-4等）を vofType に格納
 * どのプールも未定義/未実装（Sniper・FLAK 36・Patrol等）なユニットは unitId が付かないままなので、
 * 呼び出し側で「まだ駒が無い＝手動対応」と判定できる。
 * @param {object} pkg - enemyForcePackages の1行
 * @returns {{ choiceResults:Record<string,{value,r?,card?}>, resolvedUnits:object[] }}
 */
export function resolvePackageChoices(pkg) {
  const choiceResults = {};
  (pkg.choices ?? []).forEach(c => {
    choiceResults[c.key] = resolveValueSpec(c.spec);
  });

  // パッケージ共有の距離判定（Strong Point等）は「両ユニットとも同じ1回のR#判定を共有する」ため、
  // ここで1回だけ解決し、個別 distanceSpec の無いユニット全員に同じ結果を適用する
  // （各ユニットの resolveDistanceCode() に丸投げすると、ユニットごとに別のR#が引かれてしまう）。
  const sharedDistance = pkg.distanceSpec ? resolveValueSpec(pkg.distanceSpec) : null;

  const resolvedUnits = (pkg.units ?? [])
    .filter(u => {
      if (!u.variantOf) return true;
      return choiceResults[u.variantOf]?.value === u.whenValue;
    })
    .map(u => {
      const resolved = { ...u };
      if (!resolved.distanceSpec && sharedDistance) {
        resolved.distanceSpec = sharedDistance.value; // 既に解決済みの固定コード（再ロールされない）
        resolved.distanceShared = { r: sharedDistance.r, card: sharedDistance.card };
      }
      if (u.squadPool) {
        resolved.squadDraw = drawSquadFromPool(u.squadPool);
      }
      if (u.equipmentPool) {
        resolved.equipmentDraw = _drawFromEquipmentPool(u.equipmentPool);
      }
      if (u.equipmentPoolByChoice) {
        const choiceVal = choiceResults[u.equipmentPoolByChoice.key]?.value;
        const poolKey = u.equipmentPoolByChoice.map[choiceVal];
        resolved.equipmentDraw = poolKey ? _drawFromEquipmentPool(poolKey) : null;
      }
      if (u.vofTypeByChoice) {
        const choiceVal = choiceResults[u.vofTypeByChoice.key]?.value;
        resolved.vofType = u.vofTypeByChoice.map[choiceVal] ?? null;
      }
      return resolved;
    });

  return { choiceResults, resolvedUnits };
}

/**
 * §8.3 判定を1回行う。実際にアクションカードを1枚引く（scenario-tables.js の rollR）。
 * パッケージが決まったら、その場で追加判定（choices）も解決する。
 * @param {'A'|'B'|'C'} letter - 接触を成立させた PC マーカーの文字
 * @returns {{ r:number, card:object, packageId:number|null, package:object|null,
 *             choiceResults?:object, resolvedUnits?:object[] }|null}
 *   - packageId が無い（表の "-"）場合、その回では敵パッケージなし（packageId:null）
 *   - テーブル未定義のミッションでは null
 */
export function resolveEnemyContactType(letter) {
  const tables = _tables();
  const crossRef = tables?.enemyContactPackages;
  if (!crossRef) return null;

  const { r, card, row } = resolveTable(crossRef, letter);
  if (!row) return { r, card, packageId: null, package: null };

  const pkg = tables.enemyForcePackages?.rows.find(p => p.id === row.packageId) ?? null;
  if (!pkg) return { r, card, packageId: row.packageId, package: null };

  const { choiceResults, resolvedUnits } = resolvePackageChoices(pkg);
  return { r, card, packageId: row.packageId, package: pkg, choiceResults, resolvedUnits };
}
