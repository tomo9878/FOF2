import { UNITS } from './data/units-normandy.js';

// ===== ユニット状態定義 =====
export const UNIT_STATES_DEF = [
  { key:'exposed',    label:'露出',     badge:'EX', color:'#d06010' },
  { key:'pinned',     label:'制圧',     badge:'PN', color:'#cc2222' },
  { key:'finished',   label:'行動完了', badge:'FN', color:'#505050' },
  { key:'unspotted',  label:'未発見',   badge:'US', color:'#2244bb' },
  { key:'unaware',    label:'無警戒',   badge:'UA', color:'#0088aa' },
  { key:'fanatic',    label:'狂信的',   badge:'FA', color:'#990099' },
  { key:'human_wave', label:'人海戦術', badge:'HW', color:'#bb6600' },
];

// ===== ユニット位置・強度トラッキング =====
// unitId → coord
export const unitCoordMap = new Map();

// unitId → { strength:'full'|'reduced', fullSrc, reducedSrc }
export const unitStrengthMap = new Map();

// unitId → { exposed:bool, pinned:bool, ... } の状態ストア
export const unitStateMap = new Map();

// detachedLATs: parentUnitId → [latId, ...]  (Supplement 時に除去する)
export const detachedLATsMap = new Map();

// NCM手動調整値: unitId → number（+/-の整数、特殊ルール対応の逃げ弁）
export const unitNCMAdjustMap = new Map();

// ===== ユニット強度ゲッター/セッター =====
// steps: 残りステップ数（整数）。消滅閾値は steps===2（maxSteps 問わず共通）。
// 4戦力以上のユニットは unit 定義に steps:4 を指定する（省略時は 3）。
export function getUnitStrength(unitId) {
  if (!unitStrengthMap.has(unitId)) {
    // UNITS からデフォルト値を探す
    for (const units of Object.values(UNITS)) {
      const u = units.find(u => u.id === unitId);
      if (u) {
        const maxSteps = u.steps ?? 3;
        unitStrengthMap.set(unitId, {
          steps:         maxSteps,
          maxSteps:      maxSteps,
          fullSrc:       u.src,
          reducedSrc:    u.srcReduced || u.src,
          namedFireTeam: !!u.namedFireTeam,
        });
        break;
      }
    }
  }
  return unitStrengthMap.get(unitId);
}

// steps を更新し、画像を切り替える。
// steps === maxSteps → fullSrc、それ以外 → reducedSrc
export function setUnitSteps(unitId, newSteps) {
  const s = getUnitStrength(unitId);
  if (!s) return;
  s.steps = Math.max(0, newSteps);
  const src = (s.steps === s.maxSteps) ? s.fullSrc : s.reducedSrc;
  const slot = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
  if (slot) {
    const img = slot.querySelector('.unit-marker');
    if (img) img.src = src;
  }
}

// ===== ユニット状態ゲッター/トグル =====
export function getUnitState(unitId) {
  if (!unitStateMap.has(unitId)) {
    const s = {};
    UNIT_STATES_DEF.forEach(d => s[d.key] = false);
    unitStateMap.set(unitId, s);
  }
  return unitStateMap.get(unitId);
}

export function toggleUnitState(unitId, key) {
  const s = getUnitState(unitId);
  s[key] = !s[key];
  renderUnitBadges(unitId);
  // refreshCmToggles は context-menu.js 側で呼ぶこと（循環インポート回避）
  // context-menu.js の cm-toggle クリックハンドラから呼ばれるため、ここでは呼ばない
}

export function clearAllUnitStates(unitId) {
  const s = getUnitState(unitId);
  UNIT_STATES_DEF.forEach(d => s[d.key] = false);
  renderUnitBadges(unitId);
  // refreshCmToggles は context-menu.js 側で呼ぶこと（循環インポート回避）
}

export function renderUnitBadges(unitId) {
  const s = getUnitState(unitId);

  // バッジ（小アイコン）更新
  const container = document.querySelector(`.state-badges[data-unit="${unitId}"]`);
  if (container) {
    container.innerHTML = '';
    UNIT_STATES_DEF.forEach(d => {
      if (!s[d.key]) return;
      // exposed / pinned はオーバーレイ帯で表示するのでバッジ不要
      if (d.key === 'exposed' || d.key === 'pinned') return;
      const b = document.createElement('div');
      b.className = `state-badge ${d.key}`;
      b.title = d.label;
      b.textContent = d.badge;
      container.appendChild(b);
    });
  }

  // EXPOSED / PINNED オーバーレイ帯の表示切り替え
  document.querySelectorAll(`.state-overlay[data-overlay-unit="${unitId}"]`).forEach(el => {
    const key = el.dataset.overlayKey;
    el.classList.toggle('active', !!s[key]);
  });

  // 両方 ON の場合は split クラスで上下に分割表示
  const slotEl = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
  if (slotEl) {
    slotEl.classList.toggle('both-exposed-pinned', !!(s.exposed && s.pinned));
  }
}

export function pinUnit(unitId) {
  const s = getUnitState(unitId);
  s.pinned = true;
  renderUnitBadges(unitId);
}

// ===== NCM 手動調整 =====
export function getNCMAdjust(unitId) {
  return unitNCMAdjustMap.get(unitId) ?? 0;
}

export function changeNCMAdjust(unitId, delta) {
  const cur = getNCMAdjust(unitId);
  const next = cur + delta;
  if (next === 0) {
    unitNCMAdjustMap.delete(unitId);
  } else {
    unitNCMAdjustMap.set(unitId, next);
  }
}

export function _trackLAT(parentId, latId) {
  if (!detachedLATsMap.has(parentId)) detachedLATsMap.set(parentId, []);
  detachedLATsMap.get(parentId).push(latId);
}
