// ===== キャンペーン状態管理モジュール =====
//
// 練度（experience）はユニット定義の固定値ではなく、
// キャンペーンを通じて成長する「可変状態」としてここで一元管理する。
//
// フロー:
//   1. シナリオ開始時に applyScenarioExperience() で初期練度を投入
//      （Mission 1 や、各ミッションで新規登場する増援部隊）
//   2. プレイ中・ミッション間で promoteUnit() により成長
//   3. 次ミッションへはこの状態がそのまま引き継がれる
//
// 練度を参照したい箇所（combat.js / command.js / context-menu.js）は
// すべてこの getUnitExperience() を使うこと（単一の真実）。

/** 練度レベル（低→高） */
export const EXPERIENCE_LEVELS = ['green', 'line', 'vet'];

/** 練度の日本語ラベル */
export const EXPERIENCE_LABELS = { green: '新兵', line: 'ライン', vet: 'ベテラン' };

/** unitId → 'green'|'line'|'vet'（現在練度・可変） */
export const unitExperienceMap = new Map();

/**
 * ユニットの現在練度を返す。未設定なら 'line'。
 * @param {string} unitId
 * @returns {'green'|'line'|'vet'}
 */
export function getUnitExperience(unitId) {
  return unitExperienceMap.get(unitId) ?? 'line';
}

/**
 * 練度を直接セットする。
 * @param {string} unitId
 * @param {'green'|'line'|'vet'} exp
 */
export function setUnitExperience(unitId, exp) {
  if (!EXPERIENCE_LEVELS.includes(exp)) return;
  unitExperienceMap.set(unitId, exp);
}

/**
 * 1段階昇格する（green→line→vet）。vet は据え置き。
 * @param {string} unitId
 * @returns {string} 昇格後の練度
 */
export function promoteUnit(unitId) {
  const cur = getUnitExperience(unitId);
  const i = EXPERIENCE_LEVELS.indexOf(cur);
  if (i >= 0 && i < EXPERIENCE_LEVELS.length - 1) {
    unitExperienceMap.set(unitId, EXPERIENCE_LEVELS[i + 1]);
  }
  return getUnitExperience(unitId);
}

/**
 * シナリオ定義の forces から初期練度を投入する。
 * @param {object} scenario - シナリオ定義（forces.friendly / forces.enemy を持つ）
 * @param {object} [opts]
 * @param {boolean} [opts.overwrite=true]
 *   true:  シナリオの練度で上書き（Mission 1・キャンペーン初期化用）
 *   false: 既に練度を持つユニットは温存（成長を引き継ぎつつ増援だけ投入）
 */
export function applyScenarioExperience(scenario, { overwrite = true } = {}) {
  if (!scenario?.forces) return;
  for (const side of ['friendly', 'enemy']) {
    const units = scenario.forces[side] ?? {};
    for (const [unitId, cfg] of Object.entries(units)) {
      if (cfg?.experience == null) continue;
      if (!overwrite && unitExperienceMap.has(unitId)) continue;
      setUnitExperience(unitId, cfg.experience);
    }
  }
}

/** 全練度状態をクリア（キャンペーン初期化用） */
export function resetExperience() {
  unitExperienceMap.clear();
}
