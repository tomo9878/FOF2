// ===== 敵活動チェック（§8.6 Enemy Behavior）エンジン =====
//
// §8.6.2: 各カードをランダム順で見て、Pinned/LAT → Good Order → Leader の順に
// ユニットを1体ずつ判定する。Pinned/LAT は常に PINNED_LAT_HIERARCHY、それ以外は
// シナリオの enemyTactics（hierarchy×column）で決まる表を使う。
// 各表は上から順に条件を見て最初に当てはまるセクションを採用し、
// そのセクション・列でカードを1枚引いて R# と照合する（§8.6.2 原文どおり
// 「カードを引く操作」は本アプリでも人間が行う＝1枚ずつdrawActionCard）。
//
// 条件判定（同じカードに敵がいるか・カバー下か等）は盤面状態から自動判定するが、
// 「被弾方向とPDFの一致」「VOFレーティングの優劣比較」は現状のデータモデルでは
// 厳密に追えないため簡略化した近似判定にしている（各判定関数のコメント参照）。
// 自動判定が明らかに間違っていそうな場合に備え、UI側で人間がセクションを
// 上書き選択できるようにする。

import { unitCoordMap, getUnitState, getUnitStrength, renderUnitBadges } from './state.js';
import { removeUnitFromCard, moveUnitToCard } from './grid.js';
import { getUnitCoverSlot, removeUnitFromCover, getCoverSlots, COVER_TYPES } from './cover.js';
import { cardPCMap, placePC } from './pc.js';
import { findUnitDef } from './command.js';
import { hasLOS, cardDistance } from './los.js';
import { cardVOFMap } from './vof.js';
import { cardPDFMap } from './pdf.js';
import { latKind } from './rally.js';
import { rollR } from './data/scenario-tables.js';
import { PINNED_LAT_HIERARCHY, HIERARCHIES, ACTION_LABELS } from './data/enemy-activity.js';
import { getScenario } from './data/scenarios/index.js';

function _allCoords() {
  return [...document.querySelectorAll('.terrain-card[data-coord]')].map(el => el.dataset.coord);
}

function _oppositeFaction(faction) {
  return faction === 'german' ? 'friendly' : 'german';
}

/** そのユニットの faction（動的LAT ID にも対応：DOMの data-faction を見る） */
function _factionOf(unitId) {
  return document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`)?.dataset.faction
    ?? findUnitDef(unitId)?.faction ?? null;
}

function _unitsOnCard(coord, faction) {
  const out = [];
  for (const [id, c] of unitCoordMap) {
    if (c !== coord) continue;
    if (faction && _factionOf(id) !== faction) continue;
    out.push(id);
  }
  return out;
}

function _isSameCardAsOpposing(unitId) {
  const coord = unitCoordMap.get(unitId);
  if (!coord) return false;
  const mine = _factionOf(unitId);
  return _unitsOnCard(coord, _oppositeFaction(mine)).length > 0;
}

function _isUnderCover(unitId) {
  return !!getUnitCoverSlot(unitId);
}

function _isOutOfAmmo(unitId) {
  return !!getUnitState(unitId).outOfAmmo;
}

/** そのカードが被弾中か（アクティブなVOFがある＝そこにいるユニットは"under fire"） */
function _isUnderFire(unitId) {
  const coord = unitCoordMap.get(unitId);
  return !!(coord && cardVOFMap.get(coord)?.type);
}

/** LOSが通る、敵対勢力が占有するカードが1つでもあるか */
function _hasLOSToOpposing(unitId) {
  const coord = unitCoordMap.get(unitId);
  if (!coord) return false;
  const mine = _factionOf(unitId);
  const opp = _oppositeFaction(mine);
  return _allCoords().some(c => c !== coord && hasLOS(coord, c) && _unitsOnCard(c, opp).length > 0);
}

/**
 * PDF沿いに有効な目標がいるか（簡略化）。
 * 本来は「そのユニット自身が設置したPDFの方向」だが、VOF/PDFはカード単位で
 * ユニット非帰属のため管理していない（既知の簡略化・ROADMAP.md参照）。
 * ここではそのカードに設置されているPDF方向のうち、LOSが通り敵対勢力がいる
 * ものが1つでもあれば「有効な目標あり」とみなす。
 */
function _hasValidPDFTarget(unitId) {
  const coord = unitCoordMap.get(unitId);
  if (!coord) return false;
  const dirs = cardPDFMap.get(coord);
  if (!dirs || !dirs.size) return false;
  const mine = _factionOf(unitId);
  const opp = _oppositeFaction(mine);
  return _allCoords().some(c => c !== coord && hasLOS(coord, c) && _unitsOnCard(c, opp).length > 0
    && [...dirs].some(d => _directionMatches(coord, c, d)));
}

/** coord から見て target がおおよそその方角にあるか（8方向の粗い判定） */
function _directionMatches(coord, target, dir) {
  // 簡略化：方角の厳密な計算はせず、PDFが1方向でも設置されていればLOSが通る
  // 敵カードを候補とみなす（複数方向の管理はしていないため）
  return true;
}

function _isLeaderUnit(unitId) {
  return !!findUnitDef(unitId)?.isLeader;
}

/** そのカードに Good Order の敵Leaderがいるか（§8.9 の簡略化：同カードのみで判定） */
function _leaderPresentOn(coord, faction) {
  return _unitsOnCard(coord, faction).some(id => {
    if (!_isLeaderUnit(id)) return false;
    const st = getUnitState(id);
    if (st.pinned) return false;
    const s = getUnitStrength(id);
    return !s || s.steps === s.maxSteps; // Fire Team面ではない
  });
}

/** Fire/Assault Team が2体以上、敵ユニットのカードではない場所にいるか（同faction） */
function _hasTwoOrMoreTeamsOffEnemyCard(unitId) {
  const faction = _factionOf(unitId);
  const opp = _oppositeFaction(faction);
  let count = 0;
  for (const [id, coord] of unitCoordMap) {
    if (_factionOf(id) !== faction) continue;
    const k = latKind(id);
    if (k !== 'fireteam' && k !== 'assault') continue;
    if (_unitsOnCard(coord, opp).length > 0) continue; // 敵ユニットのカード上は数えない
    count++;
  }
  return count >= 2;
}

/** そのカード・faction の中で最も近いCasualtyへのLOS/距離があるか */
function _nearestCasualtyInfo(unitId) {
  // Casualty は type:'lat' で src に "Casualty" を含む駒として state.js/hit.js が生成する
  const coord = unitCoordMap.get(unitId);
  const faction = _factionOf(unitId);
  let best = null;
  for (const [id, c] of unitCoordMap) {
    if (_factionOf(id) !== faction) continue;
    const slot = document.querySelector(`.unit-slot[data-unit-id="${id}"] .unit-marker`);
    if (!slot?.getAttribute('src')?.includes('Casualty')) continue;
    if (c === coord) return { sameArea: true, coord: c, id };
    if (hasLOS(coord, c)) {
      const d = cardDistance(coord, c);
      if (!best || d < best.distance) best = { sameArea: false, coord: c, id, distance: d };
    }
  }
  return best;
}

/**
 * このユニットが使うべき階層表と列を決める。
 * @param {string} unitId
 * @returns {{ isPinnedLat:boolean, hierarchyKey:string|null, columnKey:string, def:object }}
 */
export function getHierarchyContext(unitId) {
  const st = getUnitState(unitId);
  const k = latKind(unitId);
  const isPinnedLat = !!st.pinned || !!k;
  if (isPinnedLat) {
    const coord = unitCoordMap.get(unitId);
    const faction = _factionOf(unitId);
    const columnKey = coord && _leaderPresentOn(coord, faction) ? 'withLeader' : 'noLeader';
    return { isPinnedLat: true, hierarchyKey: null, columnKey, def: PINNED_LAT_HIERARCHY };
  }
  // ミッション選択UIが無く現状 Mission 1 固定のため決め打ち（§2.1・ROADMAP.md既知の課題）
  const scenario = getScenario(1);
  const tactics = scenario?.enemyTactics ?? { hierarchy: 'defensive', column: 'deliberate' };
  return { isPinnedLat: false, hierarchyKey: tactics.hierarchy, columnKey: tactics.column, def: HIERARCHIES[tactics.hierarchy] };
}

/** セクションの条件が今のユニットに当てはまるか（自動判定・ベストエフォート） */
function _sectionMatches(sectionKey, unitId, isPinnedLat) {
  const sameCard = _isSameCardAsOpposing(unitId);
  const cover = _isUnderCover(unitId);
  const k = latKind(unitId);

  if (isPinnedLat) {
    const pinned = getUnitState(unitId).pinned;
    switch (sectionKey) {
      case 'pinned_samecard_nocover': return pinned && sameCard && !cover;
      case 'pinned_samecard_cover':   return pinned && sameCard && cover;
      case 'pinned_nocover':          return pinned && !sameCard && !cover;
      case 'pinned_cover':            return pinned && !sameCard && cover;
      case 'teams_reconstitute':      return !pinned && (k === 'fireteam' || k === 'assault') && _hasTwoOrMoreTeamsOffEnemyCard(unitId) && !sameCard;
      case 'assault_on_enemy_card':   return !pinned && k === 'assault' && sameCard;
      case 'assault_off_enemy_card':  return !pinned && k === 'assault' && !sameCard;
      case 'fireteam_nocover_on_enemy_card': return !pinned && k === 'fireteam' && sameCard && !cover;
      case 'fireteam_cover_on_enemy_card':   return !pinned && k === 'fireteam' && sameCard && cover;
      case 'leader_on_ft_side': {
        if (pinned || !_isLeaderUnit(unitId)) return false;
        const s = getUnitStrength(unitId);
        return !!s && s.steps < s.maxSteps;
      }
      case 'spotter_sniper_weapon_on_ft_side': {
        if (pinned || _isLeaderUnit(unitId) || k) return false;
        const s = getUnitStrength(unitId);
        return !!s?.namedFireTeam && s.steps < s.maxSteps;
      }
      case 'litter_with_casualty_same_area': {
        if (pinned || k !== 'litter') return false;
        const info = _nearestCasualtyInfo(unitId);
        return !!info?.sameArea;
      }
      case 'litter_casualty_in_los': {
        if (pinned || k !== 'litter') return false;
        const info = _nearestCasualtyInfo(unitId);
        return !!info && !info.sameArea;
      }
      case 'litter_no_casualty_in_los': {
        if (pinned || k !== 'litter') return false;
        return !_nearestCasualtyInfo(unitId);
      }
      case 'paralyzed_off_enemy_card': return !pinned && k === 'paralyzed' && !sameCard;
      default: return false;
    }
  }

  // Good Order（Offensive/Defensive）
  const outOfAmmo = _isOutOfAmmo(unitId);
  const underFire = _isUnderFire(unitId);
  const pdfTarget = _hasValidPDFTarget(unitId);
  switch (sectionKey) {
    case 'samecard_nocover': return sameCard && !cover;
    case 'samecard_cover':   return sameCard && cover;
    case 'out_of_ammo':      return !sameCard && outOfAmmo;
    case 'no_fire_no_los':   return !sameCard && !outOfAmmo && !underFire && !_hasLOSToOpposing(unitId);
    case 'pdf_valid_target': return !sameCard && !outOfAmmo && !underFire && pdfTarget;
    case 'under_fire_nocover': return !sameCard && !outOfAmmo && underFire && !cover;
    // 以下2セクションは被弾方向/VOF優劣比較の簡略化のため実質使用しない
    // （under_fire_nocover / all_other で代替する）。§8.6詳細は既知の簡略化。
    case 'under_fire_diff_direction': return false;
    case 'opened_fire':      return false;
    case 'trading_fire_better': return false;
    case 'trading_fire_worse':  return false;
    case 'all_other':        return !sameCard && !outOfAmmo && !underFire && !pdfTarget;
    default: return false;
  }
}

/**
 * ユニットに適用する階層表のセクションを自動判定する。
 * @param {string} unitId
 * @returns {{ isPinnedLat:boolean, def:object, columnKey:string, section:object|null }}
 */
export function classifyUnit(unitId) {
  const ctx = getHierarchyContext(unitId);
  const section = ctx.def.sections.find(s => _sectionMatches(s.key, unitId, ctx.isPinnedLat)) ?? null;
  return { ...ctx, section };
}

/**
 * 判定に使う枚数（常に1枚。R#はカード1枚の印字値をそのまま使う）を引き、
 * セクション・列から行動を決定する。
 * @param {object} section - classifyUnit() の section（人間が上書きしたものでも可）
 * @param {string} columnKey
 * @returns {{ ok:boolean, reason:string, auto:boolean, action:string|null, label:string, card:object|null, r:number|null }}
 */
export function rollActivity(section, columnKey) {
  if (!section) return { ok: false, reason: '該当するセクションが無い（このユニットは今回 No Action）', auto: true, action: 'no_action', label: ACTION_LABELS.no_action, card: null, r: null };

  for (const row of section.rows) {
    const cell = row.cols[columnKey];
    if (cell === 'auto') {
      return { ok: true, reason: '', auto: true, action: row.action, label: row.label, card: null, r: null };
    }
  }
  // 数値レンジの行が1つでもあれば実際にドローする
  const numericRows = section.rows.filter(r => Array.isArray(r.cols[columnKey]));
  if (!numericRows.length) {
    return { ok: false, reason: `${section.label}: この列では起こらない`, auto: true, action: 'no_action', label: ACTION_LABELS.no_action, card: null, r: null };
  }
  const denom = numericRows[0].cols[columnKey][2];
  const { r, card } = rollR(denom);
  const hit = numericRows.find(row => {
    const [lo, hi] = row.cols[columnKey];
    return r >= lo && r <= hi;
  });
  if (!hit) {
    return { ok: true, reason: `R#${r}/${denom} は該当なし → No Action`, auto: false, action: 'no_action', label: ACTION_LABELS.no_action, card, r };
  }
  return { ok: true, reason: '', auto: false, action: hit.action, label: hit.label, card, r };
}

// ===== §8.6.3 Fall Back =====

/** 自陣側の方向（行番号が増える方向。座標系の約束：row 1がスタートエリア隣接） */
function _rowOf(coord) { return parseInt(coord.slice(1), 10); }
function _colOf(coord) { return coord.charCodeAt(0) - 65; }

function _adjacentCoords(coord) {
  const row = _rowOf(coord), col = _colOf(coord);
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const c = String.fromCharCode(65 + col + dc) + (row + dr);
    if (document.querySelector(`.terrain-card[data-coord="${c}"]`)) out.push(c);
  }
  return out;
}

/**
 * §8.6.3 Fall Back の移動先を決める。
 * @param {string} unitId
 * @returns {{ offMap:boolean, coord:string|null, reason:string }}
 */
export function planFallBack(unitId) {
  const coord = unitCoordMap.get(unitId);
  if (!coord) return { offMap: false, coord: null, reason: '盤上にいない' };
  const faction = _factionOf(unitId);
  const opp = _oppositeFaction(faction);
  const maxRow = Math.max(...[...document.querySelectorAll('.terrain-card[data-coord]')].map(el => _rowOf(el.dataset.coord)));

  // 優先1: 自陣の端（最終行）にいれば盤外へ（Removed from Play）
  if (_rowOf(coord) >= maxRow) {
    return { offMap: true, coord: null, reason: '自陣の端にいるため盤外へ（Removed from Play）' };
  }

  // 敵ユニットが占有するカードへは後退しない（同じカードに乗り込むのは後退とは言えない）
  const adjacent = _adjacentCoords(coord).filter(c => _unitsOnCard(c, opp).length === 0);
  if (!adjacent.length) return { offMap: false, coord: null, reason: '後退できるカードが無い' };

  // 自陣側（行番号が増える方向）を優先し、無ければ同列（左右）を許容する
  const forward = adjacent.filter(c => _rowOf(c) > _rowOf(coord));
  const candidates = forward.length ? forward : adjacent.filter(c => _rowOf(c) === _rowOf(coord));
  if (!candidates.length) return { offMap: false, coord: null, reason: '自陣側へ後退できるカードが無い' };

  // 優先2: 敵対勢力のLOSが通らないカード
  const outOfLOS = candidates.filter(c => !_allCoords().some(oc => _unitsOnCard(oc, opp).length > 0 && hasLOS(c, oc)));
  const pool = outOfLOS.length ? outOfLOS : candidates;

  // 優先3: 最もカバー価値が高いカード（既存のカバースロットの最大値で比較）
  let best = pool[0], bestVal = -1;
  for (const c of pool) {
    const val = Math.max(0, ...getCoverSlots(c).map(s => COVER_TYPES[s.type]?.value ?? 0));
    if (val > bestVal) { bestVal = val; best = c; }
  }
  return { offMap: false, coord: best, reason: outOfLOS.length ? 'LOSが通らないカードへ後退' : '後退（LOSが通らないカードなし）' };
}

// ===== 行動の適用 =====
//
// 敵ユニットはコマンド(AP)経済の外側で動くため（プレイヤー側のような
// HQ発令・コマンド消費は無い）、既存の Rally/Move 等の HQ 発令系関数は使わず、
// ここで直接盤面を操作する。自動適用できるのは以下のみ：
//   no_action / fall_back / remove_pc
// それ以外（Rally・Grenade・Concentrate Fire・浸透・Reconstitute・PDFシフト等）は
// 既存の人間向けUI（右クリックメニュー等）で手動実行することを前提に、
// 「何をすべきか」だけを表示する（v1のスコープ）。

const AUTOMATED_ACTIONS = new Set(['no_action', 'fall_back', 'remove_pc']);

export function isAutomated(actionKey) {
  return AUTOMATED_ACTIONS.has(actionKey);
}

/**
 * 自動適用可能な行動を実際に盤面へ反映する。
 * @param {string} unitId
 * @param {string} actionKey
 * @param {{ pcLetter?: string }} [opts]
 * @returns {{ ok:boolean, reason:string }}
 */
export function applyActivityAction(unitId, actionKey, opts = {}) {
  if (actionKey === 'no_action') return { ok: true, reason: '' };

  if (actionKey === 'fall_back') {
    const plan = planFallBack(unitId);
    if (plan.offMap) {
      removeUnitFromCard(unitId);
      return { ok: true, reason: plan.reason };
    }
    if (!plan.coord) return { ok: false, reason: plan.reason };
    removeUnitFromCover(unitId);
    moveUnitToCard(unitId, plan.coord);
    getUnitState(unitId).exposed = true; // §8.6.1C：移動した敵ユニットはExposed
    renderUnitBadges(unitId);
    document.dispatchEvent(new CustomEvent('board:changed'));
    return { ok: true, reason: `${plan.coord} へ後退（Exposed）` };
  }

  if (actionKey === 'remove_pc') {
    const coord = unitCoordMap.get(unitId);
    if (!coord) return { ok: false, reason: '盤上にいない' };
    const existing = cardPCMap.get(coord);
    removeUnitFromCard(unitId);
    if (!existing) {
      const letter = opts.pcLetter ?? 'A';
      placePC(coord, letter, true);
      return { ok: true, reason: `除去し、PC ${letter} を設置` };
    }
    return { ok: true, reason: '除去（既にPCマーカーがあるため追加設置なし）' };
  }

  return { ok: false, reason: `${ACTION_LABELS[actionKey] ?? actionKey} は手動で実行してください` };
}

// ===== §8.6.2 チェック順序の構築 =====

function _shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 敵活動チェックの対象ユニットを §8.6.2 の順序で並べる：
 * カードはランダム順、カード内は Pinned/LAT → Good Order → Leader の順。
 * ヴィークルは対象外（別途10章で扱う・未実装）。
 * @param {string} [faction='german']
 * @returns {string[]} unitId の配列
 */
export function buildActivityCheckQueue(faction = 'german') {
  const byCoord = new Map();
  for (const [id, coord] of unitCoordMap) {
    if (_factionOf(id) !== faction) continue;
    if (!byCoord.has(coord)) byCoord.set(coord, []);
    byCoord.get(coord).push(id);
  }
  const coords = _shuffle([...byCoord.keys()]);
  const out = [];
  for (const coord of coords) {
    const units = byCoord.get(coord);
    const pinnedLat = units.filter(id => getUnitState(id).pinned || latKind(id));
    const rest = units.filter(id => !pinnedLat.includes(id));
    const leaders = rest.filter(id => _isLeaderUnit(id));
    const goodOrder = rest.filter(id => !_isLeaderUnit(id));
    out.push(...pinnedLat, ...goodOrder, ...leaders);
  }
  return out;
}
