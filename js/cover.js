// ===== カバーマーカー管理 =====
//
// 物理ゲームの構造:
//   カードに cover_positions 個のカバーマーカーを配置できる
//   各マーカーの下に複数部隊が入れる（スタック）
//   スタック 3ステップ超 → Grenade/Incoming/Aerial 時にペナルティ
//
// データモデル:
//   cardCoverSlotMap: coord → [CoverSlot, ...]
//   CoverSlot = { slotId, type, unitIds: Set<unitId> }
//
//   _unitSlotIndex: unitId → { coord, slotId }  ← 逆引き用

import { getUnitStrength } from './state.js';
import { COVER_POSITIONS } from './data/terrain-data.js';

// ===== カバー種別定義 =====
//
// capacity: そのカバーに収容できる最大ステップ数
//   NCMスタックペナルティの閾値は常に3ステップ超（capacity とは別）
// noFire: true の場合、内部から射撃不可（Deep Bunker ルール）
//
export const COVER_TYPES = {
  // ── 基本カバー（地形捜索で発見）──
  basic:       { label: 'Basic Cover',     value: 1, capacity: 3, img: 'Cover - Standard +1.png',         badge: 'BC', color: '#6b7355' },
  // ── 野戦築城（Cover Search アクションで獲得）──
  foxhole:     { label: 'Foxholes',        value: 1, capacity: 3, img: 'Cover - Foxholes +1.png',          badge: 'FH', color: '#8b7355' },
  trench:      { label: 'Trench',          value: 2, capacity: 3, img: 'Cover - Trench +2.png',            badge: 'TC', color: '#5a7a5a' },
  bunker:      { label: 'Bunker',          value: 3, capacity: 4, img: 'Cover - Bunker +3.png',            badge: 'BK', color: '#4a4a6a' },
  pillbox:     { label: 'Pillbox',         value: 4, capacity: 2, img: 'Cover - Pillbox +4.png',           badge: 'PB', color: '#3a3a5a' },
  deep_bunker: { label: 'Deep Bunker',     value: 5, capacity: 3, img: 'Deep Bunker.png',                  badge: 'DB', color: '#2a2a4a', noFire: true },
  // ── 建物（Village / Farm カードで発生）──
  light_bldg:  { label: 'Light Building',  value: 2, capacity: 3, img: 'Cover - Light Building +2.png',   badge: 'LB', color: '#7a5a3a' },
  strong_bldg: { label: 'Strong Building', value: 3, capacity: 3, img: 'Cover - Strong Building +3.png',  badge: 'SB', color: '#5a4a3a' },
  // ── 上層階（multi_story カードで利用可能）──
  upper_2:     { label: 'Upper Story +2',  value: 2, capacity: 3, img: 'Cover - Upper Story +2.png',      badge: 'U2', color: '#7a5a3a' },
  upper_3:     { label: 'Upper Story +3',  value: 3, capacity: 3, img: 'Cover - Upper Story +3.png',      badge: 'U3', color: '#5a4a3a' },
  // ── 教会の塔（収容上限: 1ステップ）──
  church_2:    { label: 'Church Tower +2', value: 2, capacity: 1, img: 'Cover - Church Tower +2.png',     badge: 'CT', color: '#7a6a5a' },
  church_3:    { label: 'Church Tower +3', value: 3, capacity: 1, img: 'Cover - Church Tower +3.png',     badge: 'CT', color: '#5a5a4a' },
};

// ===== ストア =====

/** coord → Array<{ slotId:string, type:string, unitIds:Set<string> }> */
export const cardCoverSlotMap = new Map();

/** unitId → { coord:string, slotId:string }  逆引きインデックス */
const _unitSlotIndex = new Map();

// スロット ID 生成用カウンター
let _slotCounter = 0;

// ===== カード上の最大スロット数 =====

/**
 * coord のカードが持てるカバースロット最大数を返す
 * @param {string} coord
 * @returns {number}
 */
function _maxSlots(coord) {
  const cardId = document.querySelector(`.terrain-card[data-coord="${coord}"]`)?.dataset.cardId;
  return COVER_POSITIONS[cardId] ?? 0;
}

// ===== スロット操作 =====

/**
 * カバースロットを追加する
 * @param {string} coord
 * @param {'foxhole'|'trench'|'bunker'} type
 * @returns {string|null} 追加されたスロット ID、失敗時は null
 */
export function addCoverSlot(coord, type) {
  const max = _maxSlots(coord);
  if (max === 0) return null; // このカードはカバー配置不可

  if (!cardCoverSlotMap.has(coord)) cardCoverSlotMap.set(coord, []);
  const slots = cardCoverSlotMap.get(coord);

  if (slots.length >= max) return null; // スロット上限に達した

  const slotId = `${coord}_cs${++_slotCounter}`;
  slots.push({ slotId, type, unitIds: new Set() });
  renderCardCovers(coord);
  return slotId;
}

/**
 * カバースロットを除去する（スロット内のユニットはカバー外に戻る）
 * @param {string} coord
 * @param {string} slotId
 */
export function removeCoverSlot(coord, slotId) {
  const slots = cardCoverSlotMap.get(coord);
  if (!slots) return;
  const slot = slots.find(s => s.slotId === slotId);
  if (!slot) return;
  // このスロットにいたユニットのインデックスを削除
  slot.unitIds.forEach(uid => _unitSlotIndex.delete(uid));
  // スロット除去
  cardCoverSlotMap.set(coord, slots.filter(s => s.slotId !== slotId));
  renderCardCovers(coord);
  // スロット内ユニットのバッジを更新
  slot.unitIds.forEach(uid => renderUnitCoverBadge(uid));
}

// ===== ユニット割り当て =====

/**
 * ユニットを特定のカバースロットに割り当てる
 * @param {string} unitId
 * @param {string} coord
 * @param {string} slotId
 */
/**
 * ユニットを特定のカバースロットに割り当てる
 * @param {string} unitId
 * @param {string} coord
 * @param {string} slotId
 * @returns {boolean} 割り当て成功 true / 収容上限超えで失敗 false
 */
export function assignUnitToCover(unitId, coord, slotId) {
  const slots = cardCoverSlotMap.get(coord);
  if (!slots) return false;
  const slot = slots.find(s => s.slotId === slotId);
  if (!slot) return false;

  // 収容上限チェック（自分自身が既にいる場合は除いて計算）
  const ct = COVER_TYPES[slot.type];
  const capacity = ct?.capacity ?? 3;
  const currentSteps = [...slot.unitIds]
    .filter(uid => uid !== unitId)                        // 再割り当て時は自分を除外
    .reduce((sum, uid) => sum + (getUnitStrength(uid)?.steps ?? 1), 0);
  const mySteps = getUnitStrength(unitId)?.steps ?? 1;
  if (currentSteps + mySteps > capacity) return false;  // 上限超え → 拒否

  // 既存の割り当てを解除（上限チェック後に実施）
  removeUnitFromCover(unitId);

  // 再取得（removeUnitFromCover 後にスロット参照が変わっていないか確認）
  const slots2 = cardCoverSlotMap.get(coord);
  const slot2  = slots2?.find(s => s.slotId === slotId);
  if (!slot2) return false;

  slot2.unitIds.add(unitId);
  _unitSlotIndex.set(unitId, { coord, slotId });
  renderCardCovers(coord);
  renderUnitCoverBadge(unitId);
  return true;
}

/**
 * ユニットをカバーから出す
 * @param {string} unitId
 */
export function removeUnitFromCover(unitId) {
  const entry = _unitSlotIndex.get(unitId);
  if (!entry) return;
  const slots = cardCoverSlotMap.get(entry.coord);
  if (slots) {
    const slot = slots.find(s => s.slotId === entry.slotId);
    if (slot) slot.unitIds.delete(unitId);
  }
  const coord2 = entry.coord;
  _unitSlotIndex.delete(unitId);
  renderCardCovers(coord2);  // ユニット数のツールチップを更新
  renderUnitCoverBadge(unitId);
}

// ===== ゲッター =====

/**
 * ユニットが入っているカバースロットを返す
 * @param {string} unitId
 * @returns {{ slotId:string, type:string, unitIds:Set }|null}
 */
export function getUnitCoverSlot(unitId) {
  const entry = _unitSlotIndex.get(unitId);
  if (!entry) return null;
  const slots = cardCoverSlotMap.get(entry.coord);
  return slots?.find(s => s.slotId === entry.slotId) ?? null;
}

/**
 * ユニットのカバー防御値を返す（カバー外は 0）
 * @param {string} unitId
 * @returns {number}
 */
export function getUnitCoverDef(unitId) {
  const slot = getUnitCoverSlot(unitId);
  if (!slot) return 0;
  return COVER_TYPES[slot.type]?.value ?? 0;
}

/**
 * 同じカバースロット内の合計ステップ数を返す（スタックペナルティ計算用）
 * @param {string} unitId
 * @returns {number}
 */
export function getStepsUnderCover(unitId) {
  const slot = getUnitCoverSlot(unitId);
  if (!slot) return 0;
  let total = 0;
  slot.unitIds.forEach(uid => {
    const s = getUnitStrength(uid);
    total += s?.steps ?? 1;
  });
  return total;
}

/**
 * カード上のカバースロット一覧を返す
 * @param {string} coord
 * @returns {Array<{ slotId:string, type:string, unitIds:Set }>}
 */
export function getCoverSlots(coord) {
  return cardCoverSlotMap.get(coord) ?? [];
}

/**
 * そのカードにまだスロットを追加できるか
 * @param {string} coord
 * @returns {boolean}
 */
export function canAddCoverSlot(coord) {
  const slots = cardCoverSlotMap.get(coord) ?? [];
  return slots.length < _maxSlots(coord);
}

// ===== 描画 =====

/**
 * カード上のカバーマーカー画像を再描画
 * @param {string} coord
 */
export function renderCardCovers(coord) {
  const overlay = document.querySelector(`.terrain-card[data-coord="${coord}"] .card-overlay`);
  if (!overlay) return;

  // 既存のカバーマーカーを削除
  overlay.querySelectorAll('.cover-marker-img').forEach(el => el.remove());

  const slots = cardCoverSlotMap.get(coord) ?? [];
  slots.forEach((slot, i) => {
    const ct = COVER_TYPES[slot.type];
    if (!ct) return;

    const img = document.createElement('img');
    img.className = 'cover-marker-img';
    img.src = `images/${ct.img}`;
    img.dataset.slotId = slot.slotId;
    img.style.setProperty('--cover-idx', i);
    const unitCount = slot.unitIds.size;
    img.title = `${ct.label} +${ct.value} (${unitCount}ユニット)`;
    overlay.appendChild(img);
  });
}

/**
 * ユニットのカバーバッジを更新
 * @param {string} unitId
 */
export function renderUnitCoverBadge(unitId) {
  // .state-badges の隣に独立した .cover-badge を管理する
  const slot = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
  if (!slot) return;

  // 既存バッジを除去
  slot.querySelector('.cover-badge')?.remove();

  const coverSlot = getUnitCoverSlot(unitId);
  if (!coverSlot) return;

  const ct = COVER_TYPES[coverSlot.type];
  if (!ct) return;

  const badge = document.createElement('div');
  badge.className = 'cover-badge';
  badge.textContent = ct.badge;
  badge.title = `${ct.label} +${ct.value}`;
  badge.style.background = ct.color;
  slot.appendChild(badge);
}
