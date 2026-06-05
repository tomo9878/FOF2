// ===== 状態保存・復元（localStorage）=====
//
// 2層構成:
//   setup 層: マップ配置・駒の位置/戦力/練度（滅多に変わらない＝ずっと保持したい）
//   play  層: VOF/PDF/PC/カバー/状態/AP/視界（機能追加で壊れやすい＝リセット対象）
//
// version 不一致時の挙動:
//   SETUP_VERSION 不一致 → 復元せず全初期化（駒も並べ直し）
//   PLAY_VERSION  不一致 → play 層だけ破棄（マップ・駒配置は残る）
//
// ★ スキーマを変えたら該当 VERSION を +1 すること。
//    プレイ層のスキーマ変更は PLAY_VERSION を上げれば、駒配置を保ったまま play だけ破棄される。

import { TERRAIN_CARDS, shuffle } from './data/cards.js';
import { UNITS } from './data/units-normandy.js';
import { buildGrid, addUnitToCard, buildUnitPool, placedCards } from './grid.js';
import {
  unitCoordMap, unitStrengthMap, unitStateMap, detachedLATsMap, unitNCMAdjustMap,
  getUnitStrength, renderUnitBadges,
} from './state.js';
import { cardVOFMap, renderCardVOF } from './vof.js';
import { cardPDFMap, renderCardPDFs } from './pdf.js';
import { cardPCMap, renderCardPC } from './pc.js';
import { serializeCover, restoreCover, clearAllCover } from './cover.js';
import { unitCommandMap } from './command.js';
import { unitExperienceMap } from './campaign.js';
import { getVisibility, setVisibility } from './ncm.js';
import { recomputeActivityLevel } from './contact.js';

const KEY = 'fof_save';
const SETUP_VERSION = 1;
const PLAY_VERSION  = 1;

// ===== 内部 =====

function _findDef(unitId) {
  for (const arr of Object.values(UNITS)) {
    const u = arr.find(x => x.id === unitId);
    if (u) return u;
  }
  return null;
}

// DOM から全駒を収集（配置済み=coord / プール=null）
function _collectUnits() {
  const out = [];
  document.querySelectorAll('.unit-slot[data-unit-id]').forEach(slot => {
    const id  = slot.dataset.unitId;
    const img = slot.querySelector('.unit-marker');
    const inPool = !!slot.closest('#unitPool');
    const coord = inPool ? null : (unitCoordMap.get(id) ?? null);
    const str = getUnitStrength(id);
    out.push({
      id, coord,
      src:        img ? img.getAttribute('src') : '',
      label:      img ? img.alt : id,
      faction:    slot.dataset.faction || 'neutral',
      type:       slot.dataset.type || '',
      steps:      str?.steps ?? null,
      maxSteps:   str?.maxSteps ?? null,
      fullSrc:    str?.fullSrc ?? null,
      reducedSrc: str?.reducedSrc ?? null,
    });
  });
  return out;
}

// ===== シリアライズ / 保存 =====

export function serialize() {
  return {
    setupVersion: SETUP_VERSION,
    playVersion:  PLAY_VERSION,
    setup: {
      placed:     [...placedCards],
      units:      _collectUnits(),
      experience: [...unitExperienceMap],
    },
    play: {
      vof:      [...cardVOFMap],
      pdf:      [...cardPDFMap].map(([c, set]) => [c, [...set]]),
      pc:       [...cardPCMap],
      cover:    serializeCover(),
      states:   [...unitStateMap],
      ncmAdj:   [...unitNCMAdjustMap],
      ap:       [...unitCommandMap],
      detached: [...detachedLATsMap],
      visibility: getVisibility(),
    },
  };
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(serialize())); } catch (e) { /* quota等は無視 */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearStorage() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}

// ===== 復元 =====

function _restoreUnits(units, rows) {
  unitStrengthMap.clear();
  const poolDefs = [];
  (units ?? []).forEach(u => {
    if (u.steps != null) {
      unitStrengthMap.set(u.id, {
        steps: u.steps, maxSteps: u.maxSteps ?? u.steps,
        fullSrc: u.fullSrc, reducedSrc: u.reducedSrc,
        namedFireTeam: !!_findDef(u.id)?.namedFireTeam,
      });
    }
    const def = _findDef(u.id);
    const merged = def
      ? { ...def, src: u.src, label: u.label, faction: u.faction, type: u.type || def.type }
      : { id: u.id, src: u.src, label: u.label, faction: u.faction, type: u.type || 'lat' };
    if (u.coord) addUnitToCard(u.coord, merged);
    else         poolDefs.push(merged);
  });
  buildUnitPool(poolDefs, rows);
}

function _applyPlay(play) {
  cardVOFMap.clear();
  (play.vof ?? []).forEach(([c, v]) => cardVOFMap.set(c, v));
  cardPDFMap.clear();
  (play.pdf ?? []).forEach(([c, arr]) => cardPDFMap.set(c, new Set(arr)));
  cardPCMap.clear();
  (play.pc ?? []).forEach(([c, v]) => cardPCMap.set(c, v));
  restoreCover(play.cover);
  (play.states   ?? []).forEach(([id, s]) => unitStateMap.set(id, s));
  (play.ncmAdj   ?? []).forEach(([id, n]) => unitNCMAdjustMap.set(id, n));
  (play.ap       ?? []).forEach(([id, n]) => unitCommandMap.set(id, n));
  (play.detached ?? []).forEach(([p, l]) => detachedLATsMap.set(p, l));
  setVisibility(play.visibility ?? 0);
  // 描画
  cardVOFMap.forEach((_, c) => renderCardVOF(c));
  cardPDFMap.forEach((_, c) => renderCardPDFs(c));
  cardPCMap.forEach((_, c) => renderCardPC(c));
  (play.states ?? []).forEach(([id]) => renderUnitBadges(id));
}

/**
 * 保存データから復元する。
 * @returns {boolean} 復元したか（false なら呼び出し側で通常初期化）
 */
export function restoreFromSave(scenario) {
  const snap = load();
  if (!snap || snap.setupVersion !== SETUP_VERSION) return false; // setup 壊れ → 通常初期化

  // 1. マップ（固定配置）
  buildGrid(TERRAIN_CARDS, {}, {}, shuffle, {
    rows: scenario.map.rows, cols: scenario.map.cols, placed: snap.setup.placed,
  });
  // 2. 練度
  unitExperienceMap.clear();
  (snap.setup.experience ?? []).forEach(([id, exp]) => unitExperienceMap.set(id, exp));
  // 3. 駒
  _restoreUnits(snap.setup.units, scenario.map.rows);
  // 4. play 層（version 一致時のみ。不一致なら破棄＝駒配置だけ残る）
  if (snap.playVersion === PLAY_VERSION) _applyPlay(snap.play);

  recomputeActivityLevel();
  save(); // play を破棄した場合に整合させて再保存
  return true;
}

// ===== リセット =====

/** プレイ層だけ初期化（マップ・駒は残す）。PC はシナリオ初期配置に戻す。 */
export function resetPlay(scenario) {
  cardVOFMap.clear();
  cardPDFMap.clear();
  cardPCMap.clear();
  clearAllCover();
  unitStateMap.clear();
  unitNCMAdjustMap.clear();
  unitCommandMap.clear();
  detachedLATsMap.clear();
  setVisibility(scenario.visibility === 'limited' ? 1 : 0);

  // 全カード・全駒のマーカー/バッジを再描画（消去を反映）
  document.querySelectorAll('.terrain-card[data-coord]').forEach(card => {
    const c = card.dataset.coord;
    renderCardVOF(c); renderCardPDFs(c); renderCardPC(c);
  });
  document.querySelectorAll('.unit-slot[data-unit-id]').forEach(s => renderUnitBadges(s.dataset.unitId));

  // PC をシナリオ初期配置に戻す
  for (const [row, letter] of Object.entries(scenario.pcPlacement ?? {})) {
    for (let i = 0; i < scenario.map.cols; i++) {
      cardPCMap.set(String.fromCharCode(65 + i) + row, { letter, revealed: true });
    }
  }
  cardPCMap.forEach((_, c) => renderCardPC(c));

  recomputeActivityLevel();
  save();
}
