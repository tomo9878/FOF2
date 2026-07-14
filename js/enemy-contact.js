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
import { resolveTable, resolveValueSpec } from './data/scenario-tables.js';

const MISSION_NUMBER = 1;

function _tables() {
  return getScenario(MISSION_NUMBER)?.tables ?? null;
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
 * @param {object} pkg - enemyForcePackages の1行
 * @returns {{ choiceResults:Record<string,{value,r?,card?}>, resolvedUnits:object[] }}
 */
export function resolvePackageChoices(pkg) {
  const choiceResults = {};
  (pkg.choices ?? []).forEach(c => {
    choiceResults[c.key] = resolveValueSpec(c.spec);
  });

  const resolvedUnits = (pkg.units ?? []).filter(u => {
    if (!u.variantOf) return true;
    return choiceResults[u.variantOf]?.value === u.whenValue;
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
