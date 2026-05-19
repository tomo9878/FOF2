import {
  unitCoordMap,
  getUnitStrength,
  setUnitStrength,
  pinUnit,
  _trackLAT,
} from './state.js';
import { addUnitToCard, removeUnitFromCard } from './grid.js';

// ===== Combo Hit Helpers =====
export const _HIT_INFO = {
  A: { src: 'images/LAT_Assault Team-W.png',       label: 'アサルトチーム',  tag: 'AT' },
  F: { src: 'images/LAT_Fire Team-W.png',           label: 'ファイアチーム',  tag: 'FT' },
  L: { src: 'images/LAT_Litter-W.png',              label: 'リッター',        tag: 'LT' },
  P: { src: 'images/Counter LAT - Paralyzed.png',   label: 'パラライズ',      tag: 'PT' },
  C: { src: 'images/Counter LAT - Casualty.png',    label: 'カジュアルティ',  tag: 'CT' },
};
let _comboSeq = 0;
const _cid = (uid, tag) => `${uid}_CMB_${tag}_${++_comboSeq}`;

/**
 * Hit: A（Assault Team ヒット）
 */
export function hitA(unit) {
  // ── LAT：どんな種類でもアサルトチームに変化 ──
  if (unit.type === 'lat') {
    const slot = document.querySelector(`.unit-slot[data-unit-id="${unit.id}"]`);
    if (slot) {
      const img = slot.querySelector('.unit-marker');
      if (img) {
        img.src   = 'images/LAT_Assault Team-W.png';
        img.alt   = 'アサルトチーム';
        img.title = 'アサルトチーム';
      }
    }
    unit.src   = 'images/LAT_Assault Team-W.png';
    unit.label = 'アサルトチーム';
    pinUnit(unit.id);
    return;
  }

  const coord = unitCoordMap.get(unit.id);
  if (!coord) return;

  const s = getUnitStrength(unit.id);

  // ── named Fire Team 持ち（1戦力ユニット）──
  if (s?.namedFireTeam) {
    if (s.strength === 'full') setUnitStrength(unit.id, 'reduced');
    pinUnit(unit.id);
    return;
  }

  // ── 戦力3（フル）：reduced化 ＋ Assault Team LAT を追加 ──
  if (!s || s.strength === 'full') {
    setUnitStrength(unit.id, 'reduced');
    const atId  = unit.id + '_HIT_AT';
    const atDef = unit.assaultteam
      ? { ...unit.assaultteam, id: atId }
      : { id: atId, src: 'images/LAT_Assault Team-W.png', label: 'アサルトチーム', type: 'lat', faction: unit.faction };
    addUnitToCard(coord, atDef);
    _trackLAT(unit.id, atId);
    pinUnit(unit.id);
    pinUnit(atId);
    return;
  }

  // ── 戦力2（reduced）：分隊除去 → Fire Team LAT ＋ Assault Team LAT ──
  if (s.strength === 'reduced') {
    const ftId  = unit.id + '_HIT_FT';
    const atId  = unit.id + '_HIT_AT';
    const ftDef = unit.fireteam
      ? { ...unit.fireteam,    id: ftId }
      : { id: ftId, src: 'images/LAT_Fire Team-W.png',    label: 'ファイアチーム',   type: 'lat', faction: unit.faction };
    const atDef = unit.assaultteam
      ? { ...unit.assaultteam, id: atId }
      : { id: atId, src: 'images/LAT_Assault Team-W.png', label: 'アサルトチーム',   type: 'lat', faction: unit.faction };
    removeUnitFromCard(unit.id);
    addUnitToCard(coord, ftDef);
    addUnitToCard(coord, atDef);
    pinUnit(ftId);
    pinUnit(atId);
  }
}

/**
 * Hit: F（Fire Team ヒット）
 */
export function hitF(unit) {
  // ── LAT：どんな種類でもファイアチームに変化 ──
  if (unit.type === 'lat') {
    const slot = document.querySelector(`.unit-slot[data-unit-id="${unit.id}"]`);
    if (slot) {
      const img = slot.querySelector('.unit-marker');
      if (img) {
        img.src   = 'images/LAT_Fire Team-W.png';
        img.alt   = 'ファイアチーム';
        img.title = 'ファイアチーム';
      }
    }
    unit.src   = 'images/LAT_Fire Team-W.png';
    unit.label = 'ファイアチーム';
    pinUnit(unit.id);
    return;
  }

  const coord = unitCoordMap.get(unit.id);
  if (!coord) return;

  const s = getUnitStrength(unit.id);

  // ── named Fire Team 持ち（1戦力ユニット）──
  if (s?.namedFireTeam) {
    if (s.strength === 'full') setUnitStrength(unit.id, 'reduced');
    pinUnit(unit.id);
    return;
  }

  // ── 戦力3（フル）：reduced化 ＋ Fire Team LAT を追加 ──
  if (!s || s.strength === 'full') {
    setUnitStrength(unit.id, 'reduced');
    const ftId  = unit.id + '_HIT_FT';
    const ftDef = unit.fireteam
      ? { ...unit.fireteam, id: ftId }
      : { id: ftId, src: 'images/LAT_Fire Team-W.png', label: 'ファイアチーム', type: 'lat', faction: unit.faction };
    addUnitToCard(coord, ftDef);
    _trackLAT(unit.id, ftId);
    pinUnit(unit.id);
    pinUnit(ftId);
    return;
  }

  // ── 戦力2（reduced）：分隊除去 → Fire Team LAT ×2 ──
  if (s.strength === 'reduced') {
    const ft1Id  = unit.id + '_HIT_FT1';
    const ft2Id  = unit.id + '_HIT_FT2';
    const ft1Def = unit.fireteam
      ? { ...unit.fireteam, id: ft1Id }
      : { id: ft1Id, src: 'images/LAT_Fire Team-W.png', label: 'ファイアチーム', type: 'lat', faction: unit.faction };
    const ft2Def = { id: ft2Id, src: 'images/LAT_Fire Team-W.png', label: 'ファイアチーム', type: 'lat', faction: unit.faction };
    removeUnitFromCard(unit.id);
    addUnitToCard(coord, ft1Def);
    addUnitToCard(coord, ft2Def);
    pinUnit(ft1Id);
    pinUnit(ft2Id);
  }
}

/**
 * Hit: L（Litter ヒット）
 */
export function hitL(unit) {
  const LITTER_SRC   = 'images/LAT_Litter-W.png';
  const LITTER_LABEL = 'リッター';

  // ── LAT：どんな種類でも Litter に変化 ──
  if (unit.type === 'lat') {
    const slot = document.querySelector(`.unit-slot[data-unit-id="${unit.id}"]`);
    if (slot) {
      const img = slot.querySelector('.unit-marker');
      if (img) {
        img.src   = LITTER_SRC;
        img.alt   = LITTER_LABEL;
        img.title = LITTER_LABEL;
      }
    }
    unit.src   = LITTER_SRC;
    unit.label = LITTER_LABEL;
    pinUnit(unit.id);
    return;
  }

  const coord = unitCoordMap.get(unit.id);
  if (!coord) return;

  const s = getUnitStrength(unit.id);

  // ── named Fire Team 持ち（1戦力ユニット）──
  if (s?.namedFireTeam) {
    const ltId  = unit.id + '_HIT_LT';
    const ltDef = { id: ltId, src: LITTER_SRC, label: LITTER_LABEL, type: 'lat', faction: unit.faction };
    removeUnitFromCard(unit.id);
    addUnitToCard(coord, ltDef);
    pinUnit(ltId);
    return;
  }

  // ── 戦力3（フル）：reduced化 ＋ Litter LAT を追加 ──
  if (!s || s.strength === 'full') {
    setUnitStrength(unit.id, 'reduced');
    const ltId  = unit.id + '_HIT_LT';
    const ltDef = { id: ltId, src: LITTER_SRC, label: LITTER_LABEL, type: 'lat', faction: unit.faction };
    addUnitToCard(coord, ltDef);
    _trackLAT(unit.id, ltId);
    pinUnit(unit.id);
    pinUnit(ltId);
    return;
  }

  // ── 戦力2（reduced）：分隊除去 → Litter LAT ＋ Fire Team LAT ──
  if (s.strength === 'reduced') {
    const ltId  = unit.id + '_HIT_LT';
    const ftId  = unit.id + '_HIT_FT';
    const ltDef = { id: ltId, src: LITTER_SRC, label: LITTER_LABEL, type: 'lat', faction: unit.faction };
    const ftDef = unit.fireteam
      ? { ...unit.fireteam, id: ftId }
      : { id: ftId, src: 'images/LAT_Fire Team-W.png', label: 'ファイアチーム', type: 'lat', faction: unit.faction };
    removeUnitFromCard(unit.id);
    addUnitToCard(coord, ltDef);
    addUnitToCard(coord, ftDef);
    pinUnit(ltId);
    pinUnit(ftId);
  }
}

/**
 * Hit: P（Paralyze ヒット）
 */
export function hitP(unit) {
  const PARALYZE_SRC   = 'images/Counter LAT - Paralyzed.png';
  const PARALYZE_LABEL = 'パラライズ';

  // ── LAT：どんな種類でも Paralyze に変化 ──
  if (unit.type === 'lat') {
    const slot = document.querySelector(`.unit-slot[data-unit-id="${unit.id}"]`);
    if (slot) {
      const img = slot.querySelector('.unit-marker');
      if (img) {
        img.src   = PARALYZE_SRC;
        img.alt   = PARALYZE_LABEL;
        img.title = PARALYZE_LABEL;
      }
    }
    unit.src   = PARALYZE_SRC;
    unit.label = PARALYZE_LABEL;
    pinUnit(unit.id);
    return;
  }

  const coord = unitCoordMap.get(unit.id);
  if (!coord) return;

  const s = getUnitStrength(unit.id);

  // ── named Fire Team 持ち（1戦力ユニット）──
  if (s?.namedFireTeam) {
    const ptId  = unit.id + '_HIT_PT';
    const ptDef = { id: ptId, src: PARALYZE_SRC, label: PARALYZE_LABEL, type: 'lat', faction: unit.faction };
    removeUnitFromCard(unit.id);
    addUnitToCard(coord, ptDef);
    pinUnit(ptId);
    return;
  }

  // ── 戦力3（フル）：reduced化 ＋ Paralyze LAT を追加 ──
  if (!s || s.strength === 'full') {
    setUnitStrength(unit.id, 'reduced');
    const ptId  = unit.id + '_HIT_PT';
    const ptDef = { id: ptId, src: PARALYZE_SRC, label: PARALYZE_LABEL, type: 'lat', faction: unit.faction };
    addUnitToCard(coord, ptDef);
    _trackLAT(unit.id, ptId);
    pinUnit(unit.id);
    pinUnit(ptId);
    return;
  }

  // ── 戦力2（reduced）：分隊除去 → Paralyze LAT ＋ Fire Team LAT ──
  if (s.strength === 'reduced') {
    const ptId  = unit.id + '_HIT_PT';
    const ftId  = unit.id + '_HIT_FT';
    const ptDef = { id: ptId, src: PARALYZE_SRC, label: PARALYZE_LABEL, type: 'lat', faction: unit.faction };
    const ftDef = unit.fireteam
      ? { ...unit.fireteam, id: ftId }
      : { id: ftId, src: 'images/LAT_Fire Team-W.png', label: 'ファイアチーム', type: 'lat', faction: unit.faction };
    removeUnitFromCard(unit.id);
    addUnitToCard(coord, ptDef);
    addUnitToCard(coord, ftDef);
    pinUnit(ptId);
    pinUnit(ftId);
  }
}

/**
 * Hit: C（Casualty ヒット）
 */
export function hitC(unit) {
  const CASUALTY_SRC   = 'images/Counter LAT - Casualty.png';
  const CASUALTY_LABEL = 'カジュアルティ';

  // ── LAT：どんな種類でも Casualty に変化 ──
  if (unit.type === 'lat') {
    const slot = document.querySelector(`.unit-slot[data-unit-id="${unit.id}"]`);
    if (slot) {
      const img = slot.querySelector('.unit-marker');
      if (img) {
        img.src   = CASUALTY_SRC;
        img.alt   = CASUALTY_LABEL;
        img.title = CASUALTY_LABEL;
      }
    }
    unit.src   = CASUALTY_SRC;
    unit.label = CASUALTY_LABEL;
    pinUnit(unit.id);
    return;
  }

  const coord = unitCoordMap.get(unit.id);
  if (!coord) return;

  const s = getUnitStrength(unit.id);

  // ── named Fire Team 持ち（1戦力ユニット）──
  if (s?.namedFireTeam) {
    const ctId  = unit.id + '_HIT_CT';
    const ctDef = { id: ctId, src: CASUALTY_SRC, label: CASUALTY_LABEL, type: 'lat', faction: unit.faction };
    removeUnitFromCard(unit.id);
    addUnitToCard(coord, ctDef);
    pinUnit(ctId);
    return;
  }

  // ── 戦力3（フル）：reduced化 ＋ Casualty LAT を追加 ──
  if (!s || s.strength === 'full') {
    setUnitStrength(unit.id, 'reduced');
    const ctId  = unit.id + '_HIT_CT';
    const ctDef = { id: ctId, src: CASUALTY_SRC, label: CASUALTY_LABEL, type: 'lat', faction: unit.faction };
    addUnitToCard(coord, ctDef);
    _trackLAT(unit.id, ctId);
    pinUnit(unit.id);
    pinUnit(ctId);
    return;
  }

  // ── 戦力2（reduced）：分隊除去 → Casualty LAT ＋ Fire Team LAT ──
  if (s.strength === 'reduced') {
    const ctId  = unit.id + '_HIT_CT';
    const ftId  = unit.id + '_HIT_FT';
    const ctDef = { id: ctId, src: CASUALTY_SRC, label: CASUALTY_LABEL, type: 'lat', faction: unit.faction };
    const ftDef = unit.fireteam
      ? { ...unit.fireteam, id: ftId }
      : { id: ftId, src: 'images/LAT_Fire Team-W.png', label: 'ファイアチーム', type: 'lat', faction: unit.faction };
    removeUnitFromCard(unit.id);
    addUnitToCard(coord, ctDef);
    addUnitToCard(coord, ftDef);
    pinUnit(ctId);
    pinUnit(ftId);
  }
}

// letter を full ユニットに適用: reduced 化 + LAT 配置
function _comboApplyFull(unit, coord, letter) {
  const info = _HIT_INFO[letter];
  if (!info) return;
  setUnitStrength(unit.id, 'reduced');
  const latId = _cid(unit.id, info.tag);
  const latDef = { id: latId, src: info.src, label: info.label, type: 'lat', faction: unit.faction };
  addUnitToCard(coord, latDef);
  _trackLAT(unit.id, latId);
  pinUnit(unit.id);
  pinUnit(latId);
}

// letter を reduced ユニットに適用: ユニット除去 + LAT 2枚配置
function _comboApplyReduced(unit, coord, letter) {
  const info = _HIT_INFO[letter];
  if (!info) return;
  const FT = _HIT_INFO['F'];
  const AT = _HIT_INFO['A'];
  const lat1Id = _cid(unit.id, info.tag);
  const lat2Id = _cid(unit.id, 'FT');
  let def1, def2;
  if (letter === 'A') {
    def1 = unit.fireteam   ? { ...unit.fireteam,   id: lat1Id } : { id: lat1Id, src: FT.src, label: FT.label, type: 'lat', faction: unit.faction };
    def2 = unit.assaultteam ? { ...unit.assaultteam, id: lat2Id } : { id: lat2Id, src: AT.src, label: AT.label, type: 'lat', faction: unit.faction };
  } else if (letter === 'F') {
    def1 = unit.fireteam ? { ...unit.fireteam, id: lat1Id } : { id: lat1Id, src: FT.src, label: FT.label, type: 'lat', faction: unit.faction };
    def2 = { id: lat2Id, src: FT.src, label: FT.label, type: 'lat', faction: unit.faction };
  } else {
    def1 = { id: lat1Id, src: info.src, label: info.label, type: 'lat', faction: unit.faction };
    def2 = unit.fireteam ? { ...unit.fireteam, id: lat2Id } : { id: lat2Id, src: FT.src, label: FT.label, type: 'lat', faction: unit.faction };
  }
  removeUnitFromCard(unit.id);
  addUnitToCard(coord, def1);
  addUnitToCard(coord, def2);
  pinUnit(lat1Id);
  pinUnit(lat2Id);
}

/**
 * Combo Hit: 2文字（l1+l2）をシーケンシャルに適用
 */
export function hitCombo(unit, l1, l2) {
  // ── LAT：l1 でタイプ変更のみ ──
  if (unit.type === 'lat') {
    const info = _HIT_INFO[l1];
    if (info) {
      const slot = document.querySelector(`.unit-slot[data-unit-id="${unit.id}"]`);
      if (slot) {
        const img = slot.querySelector('.unit-marker');
        if (img) { img.src = info.src; img.alt = info.label; img.title = info.label; }
      }
      unit.src = info.src; unit.label = info.label;
      pinUnit(unit.id);
    }
    return;
  }

  const coord = unitCoordMap.get(unit.id);
  if (!coord) return;
  const s = getUnitStrength(unit.id);

  // ── named Fire Team 持ち：l1 のみ ──
  if (s?.namedFireTeam) {
    if (l1 === 'A' || l1 === 'F') {
      if (s.strength === 'full') setUnitStrength(unit.id, 'reduced');
      pinUnit(unit.id);
    } else {
      const info = _HIT_INFO[l1];
      const latId = _cid(unit.id, info.tag);
      removeUnitFromCard(unit.id);
      addUnitToCard(coord, { id: latId, src: info.src, label: info.label, type: 'lat', faction: unit.faction });
      pinUnit(latId);
    }
    return;
  }

  if (!s || s.strength === 'full') {
    _comboApplyFull(unit, coord, l1);     // l1 → reduced
    _comboApplyReduced(unit, coord, l2);  // l2 → 除去 + 2枚
  } else {
    _comboApplyReduced(unit, coord, l1);  // reduced → l1 のみ
  }
}
