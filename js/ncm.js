// ===== NCM（Net Combat Modifier）計算モジュール =====
//
// NCM = [1. Best VOF] + [2. VOF Modifiers] + [3. Visibility（Best VOF選定時のみ使用）]
//       + [4. Target Status] + [5. Terrain & Cover]
//
// NCM が低い（マイナス）ほど命中しやすく強力。
//
// 実装済み:
//   - 直接射撃 VOF: S / A / H / P
//   - エリアファイア VOF: Grenade / Incoming-3〜7 / AirStrike
//   - カバーマーカー（スロット割り当て・収容上限）
//   - 地形防御（PDF方向による高低判定）
//   - Burst ペナルティ（Incoming / AirStrike）
//   - スタックペナルティ（3ステップ超 × Grenade/Incoming/Aerial）
// 未実装:
//   - Visibility UI（setVisibility は実装済み、シナリオヘッダーから呼ぶ）
//   - Concentrate Fire / Grenade Miss / Demo Miss フラグ
//   - Best VOF 自動選択（複数 VOF）

import { cardVOFMap, VOF_NCM, VOF_DEF } from './vof.js';
import { cardPDFMap } from './pdf.js';
import { getUnitState, getNCMAdjust } from './state.js';
import { getTerrainData } from './data/terrain-data.js';
import { getUnitCoverDef, getStepsUnderCover } from './cover.js';

// ===== VOF カテゴリ定義 =====
// VOF_NCM は vof.js の VOF_DEF から自動生成されるため、ここでは定義しない。

/** Visibility 修正を無視するカテゴリ */
export const VOF_IGNORES_VISIBILITY = new Set([
  'grenade', 'demo', 'incoming', 'aerial', 'mines', 'wp', 'pending', 'pending-wp', 'illum',
]);

/** VOF タイプ → カテゴリ */
export const VOF_CATEGORY = {
  // 直接射撃
  'S': 'direct', 'A': 'direct', 'H': 'direct', 'P': 'direct', 'S!': 'sniper',
  // 爆発物（直接）
  'Grenade': 'grenade', 'Demo': 'demo', 'Mines': 'mines', 'BoobyTrap': 'mines',
  // 航空支援
  'AirStrike': 'aerial', 'AirStrike-8': 'aerial',
  // 砲撃 HE
  'Incoming-3': 'incoming', 'Incoming-4': 'incoming', 'Incoming-5': 'incoming',
  'Incoming-6': 'incoming', 'Incoming-7': 'incoming',
  // 砲撃 HE Pending
  'Pending-3': 'pending', 'Pending-4': 'pending', 'Pending-5': 'pending',
  'Pending-6': 'pending', 'Pending-7': 'pending',
  // WP
  'WP-3': 'wp', 'WP-4': 'wp',
  'Pending-WP-3': 'pending-wp', 'Pending-WP-4': 'pending-wp',
  // 照明弾
  'Illum-Arty': 'illum', 'Illum-Mtr': 'illum',
};

// ===== グローバル Visibility =====
let _visibility = 0; // 0=昼, +1=夜, +2=霧

export function setVisibility(val) { _visibility = val; }
export function getVisibility()    { return _visibility; }

// ===== 内部ユーティリティ =====

/**
 * coord からカードIDを取得（DOM 参照）
 * @param {string} coord
 * @returns {string|null}
 */
function _getCardId(coord) {
  return document.querySelector(`.terrain-card[data-coord="${coord}"]`)?.dataset.cardId ?? null;
}

/**
 * PDF の方向キー（hyphen形式）を LOS キー（underscore形式）に変換
 * 例: 'top-left' → 'top_left'
 */
function _dirToLosKey(dir) {
  return dir.replace(/-/g, '_');
}

/**
 * PDF 進入方向に基づいて地形防御値を決定
 * - dark border（los[dir]=true かつ defHigh ≠ defLow）からの PDF → defHigh
 * - それ以外（white border / 同カード内 / Incoming）→ defLow
 * @param {string} coord
 * @returns {number}
 */
function _getTerrainDef(coord) {
  const cardId = _getCardId(coord);
  const td = getTerrainData(cardId);
  if (!td) return 0;

  // defHigh === defLow のカードは方向を確認する必要なし
  if (td.defHigh === td.defLow) return td.defLow;

  const pdfs = cardPDFMap.get(coord);
  if (!pdfs || pdfs.size === 0) {
    // PDF なし（Incoming や同カード間戦闘）→ defLow
    return td.defLow;
  }

  // いずれかの PDF が dark border から来ていれば defHigh
  const hasDarkBorder = [...pdfs].some(dir => td.los[_dirToLosKey(dir)] === true);
  return hasDarkBorder ? td.defHigh : td.defLow;
}

/**
 * ターゲットの状態修正（Exposed / Pinned）
 * @param {string|null} unitId
 * @returns {number}
 */
function _calcTargetStatus(unitId) {
  if (!unitId) return 0;
  const state = getUnitState(unitId);
  if (!state) return 0;
  let mod = 0;
  if (state.exposed) mod -= 2;
  if (state.pinned)  mod += 1;
  return mod;
}

// ===== メイン計算関数 =====

/**
 * 指定ユニットに対する NCM を計算する
 *
 * @param {string}      coord      - 対象カードの座標
 * @param {string|null} unitId     - 対象ユニットID（null の場合 Target Status・カバー = 0）
 * @param {boolean}     isCritical - クリティカルヒット（地形・カバー無効化）
 * @returns {{ value: number, breakdown: object }|null} - VOF なし → null
 */
export function calcNCM(coord, unitId = null, isCritical = false) {
  const vof = cardVOFMap.get(coord);
  if (!vof) return null;

  // 1. Best VOF
  const vofType     = vof.type;
  const vofBase     = VOF_NCM[vofType] ?? 0;
  const vofCategory = VOF_CATEGORY[vofType] ?? 'direct';
  const visibility  = _visibility;
  const visAdj      = VOF_IGNORES_VISIBILITY.has(vofCategory) ? 0 : visibility;
  const bestVOF     = vofBase + visAdj;

  // 2. VOF Modifiers（Crossfire / Concentrate）
  const crossfire   = vof.crossfire   ? -1 : 0;
  const concentrate = vof.concentrate ? -1 : 0;

  // 3. Visibility は Best VOF 選定時にのみ使用（合算には含まない）
  //    → 上記 bestVOF に組み込み済み

  // 4. Target Status
  const targetStatus = _calcTargetStatus(unitId);

  // 5. Terrain & Cover
  let terrainDef   = 0;
  let coverDef     = 0;
  let burstPenalty = 0;
  let stackPenalty = 0;

  if (!isCritical) {
    terrainDef = _getTerrainDef(coord);

    if (unitId) {
      coverDef = getUnitCoverDef(unitId);

      // Burst ペナルティ（Incoming / AirStrike / WP 時のみ）
      if (['incoming', 'aerial', 'wp'].includes(vofCategory)) {
        const cardId = _getCardId(coord);
        const td = getTerrainData(cardId);
        burstPenalty = td?.burstPenalty ?? 0;
      }

      // スタック制限ペナルティ（Grenade / Demo / Incoming / Aerial / WP 時のみ）
      if (['grenade', 'demo', 'incoming', 'aerial', 'wp'].includes(vofCategory) && coverDef > 0) {
        const stepsInCover = getStepsUnderCover(unitId);
        if (stepsInCover > 3) {
          stackPenalty = stepsInCover - 3; // 超過1ステップにつき -1（攻撃側有利）
        }
      }
    }
  }

  const terrainCover = terrainDef + coverDef - burstPenalty - stackPenalty;

  // 6. 手動調整（ゲームルール外の特殊ケース対応）
  const manualAdj = unitId ? getNCMAdjust(unitId) : 0;

  const value = bestVOF + crossfire + concentrate + targetStatus + terrainCover + manualAdj;

  return {
    value,
    breakdown: {
      vofType,
      bestVOF,
      crossfire,
      concentrate,
      visibility: visAdj,
      targetStatus,
      terrainDef,
      coverDef,
      burstPenalty,
      stackPenalty,
      terrainCover,
      manualAdj,
    },
  };
}

/**
 * カード上の地形防御値を取得（表示用）
 * @param {string} coord
 * @returns {{ defHigh: number, defLow: number, actual: number, cardId: string|null }}
 */
export function getTerrainDefInfo(coord) {
  const cardId = _getCardId(coord);
  const td = getTerrainData(cardId);
  const actual = _getTerrainDef(coord);
  return {
    cardId,
    defHigh: td?.defHigh ?? 0,
    defLow:  td?.defLow  ?? 0,
    actual,
  };
}
