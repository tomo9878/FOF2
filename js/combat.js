// ===== 戦闘解決エンジン（Phase 1）=====
//
// ルールブック 6.4節 "Combat Effects" の手順を実装する。
//
// Step 1: NCM計算（calcNCM / ncm.js）← 呼び出し元が計算してから渡す
// Step 2: カードを引く → HIT / PIN / MISS
// Step 3a: MISS → 何もしない
// Step 3b: PIN  → Pinned マーカー
// Step 3c: HIT  → Pinned + 2枚目カード引き → Hit Effect → 適用
//
// 主要エクスポート:
//   resolveCombatUnit(unitId, ncm) → 1ユニット解決
//   resolveCombatCard(coord)       → カード上の全ユニット一括解決

import { getCombatResult } from './data/cards.js';
import { drawActionCard }  from './deck.js';
import { calcNCM }         from './ncm.js';
import { pinUnit, unitCoordMap } from './state.js';
import { hitA, hitF, hitL, hitP, hitC, hitCombo } from './hit.js';
import { UNITS } from './data/units-normandy.js';
import { getUnitExperience } from './campaign.js';

// ===== 内部ユーティリティ =====

// 練度（experience）は campaign.js（可変ストア）で一元管理する。
// 成長要素のため、ユニット定義の固定値ではなくキャンペーン状態を参照する。
// 後方互換のため再エクスポートする。
export { getUnitExperience };

/**
 * 指定座標に配置されているユニットIDを全て返す。
 * unitCoordMap（unitId → coord）を逆引きする。
 * @param {string} coord
 * @returns {string[]}
 */
export function getUnitIdsOnCard(coord) {
  const ids = [];
  unitCoordMap.forEach((c, id) => { if (c === coord) ids.push(id); });
  return ids;
}

/**
 * hit.js が期待するユニットオブジェクトを再構築する。
 * - UNITS 定義に存在するユニット: 元定義をシャローコピーし、現在の img src/label で上書き
 * - LAT など動的生成ユニット: DOM から最低限の情報を復元
 *
 * @param {string} unitId
 * @returns {object|null}
 */
function _getUnitObj(unitId) {
  // 通常ユニット: UNITS 定義を探す
  for (const units of Object.values(UNITS)) {
    const u = units.find(u => u.id === unitId);
    if (u) {
      const slot = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
      const img  = slot?.querySelector('.unit-marker');
      return {
        ...u,
        src:   img?.src   ?? u.src,
        label: img?.alt   ?? u.label,
      };
    }
  }

  // LAT / 動的生成ユニット: DOM から復元
  const slot = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
  if (!slot) return null;
  const img = slot.querySelector('.unit-marker');
  return {
    id:      unitId,
    type:    'lat',
    faction: slot.dataset.faction ?? 'friendly',
    src:     img?.src   ?? '',
    label:   img?.alt   ?? unitId,
  };
}

/**
 * hitCode（'A'/'F'/'L'/'P'/'C' または 2文字コンボ）を hit.js 関数へディスパッチ。
 * @param {object} unit - _getUnitObj() の戻り値
 * @param {string} hitCode
 */
function _applyHitCode(unit, hitCode) {
  if (hitCode.length === 2) {
    hitCombo(unit, hitCode[0], hitCode[1]);
    return;
  }
  const dispatch = { A: hitA, F: hitF, L: hitL, P: hitP, C: hitC };
  const fn = dispatch[hitCode];
  if (fn) fn(unit);
}

// ===== ステップ別 API（手動カードドロー用）=====
//
// 設計方針: カードを引く操作は人間がボタンを押して行う（ゲームの肝）。
// resolveStep1 / resolveStep2 はボタン押下時に呼ばれ、1枚ずつ処理する。

/**
 * ステップ1: カードを1枚引いて HIT/PIN/MISS を判定し、状態を適用する。
 * 人間が「カードを引く」ボタンを押したときに呼ぶ。
 *
 * @param {string} unitId
 * @param {number} ncm    - calcNCM() で計算済みの値
 * @returns {{ card: object, result: 'HIT'|'PIN'|'MISS' }}
 */
export function resolveStep1(unitId, ncm) {
  const card   = drawActionCard();
  const result = getCombatResult(ncm, card);

  // PIN / HIT → Pinned 付与
  if (result === 'PIN' || result === 'HIT') {
    pinUnit(unitId);
  }

  return { card, result };
}

/**
 * ステップ2: カードをもう1枚引いて Hit Effect を判定・適用する。
 * HIT 確定後に人間が「もう1枚引く」ボタンを押したときに呼ぶ。
 *
 * @param {string} unitId
 * @returns {{ card: object, hitCode: string, experience: string }}
 */
export function resolveStep2(unitId) {
  const card       = drawActionCard();
  const experience = getUnitExperience(unitId);
  const hitCode    = card.hit[experience];

  const unit = _getUnitObj(unitId);
  if (unit) _applyHitCode(unit, hitCode);

  return { card, hitCode, experience };
}

// ===== 後方互換（一括解決）=====

/**
 * 1ユニットに対して全ステップを自動で一括解決する。
 * カード右クリックの一括解決ボタンなど、自動化が必要な場面で使用。
 * 通常プレイでは resolveStep1 / resolveStep2 を使うこと。
 */
export function resolveCombatUnit(unitId, ncm) {
  const s1 = resolveStep1(unitId, ncm);
  if (s1.result !== 'HIT') return { result: s1.result, card: s1.card, ncm };

  const s2 = resolveStep2(unitId);
  return { result: s1.result, card: s1.card, ncm, hitCard: s2.card, hitCode: s2.hitCode, experience: s2.experience };
}

/**
 * 指定座標のカード上にいる全ユニットに対して一括戦闘解決を実行する。
 * 各ユニットは個別に NCM を計算する（カバー・状態が異なるため）。
 *
 * @param {string} coord
 * @returns {{
 *   coord:       string,
 *   unitResults: Array<{ unitId:string } & ReturnType<resolveCombatUnit>>
 * } | null}  - ユニットなし / VOFなし の場合は null
 */
export function resolveCombatCard(coord) {
  const unitIds = getUnitIdsOnCard(coord);
  if (unitIds.length === 0) return null;

  // VOF があるか確認（VOFなしは戦闘解決不可）
  const testNCM = calcNCM(coord, null, false);
  if (!testNCM) return null;

  const unitResults = unitIds.map(uid => {
    const ncmResult = calcNCM(coord, uid, false);
    const ncm = ncmResult?.value ?? testNCM.value;
    return { unitId: uid, ...resolveCombatUnit(uid, ncm) };
  });

  return { coord, unitResults };
}
