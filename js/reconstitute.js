// ===== Removed from Play 分隊プール・Reconstitute Squad（§4.2.3i / §6.5.2）=====
//
// FOF.pdf p.49-50 §6.5.2 Reconstitution:
//   「Squads ... which have been Removed from Play may be Reconstituted」
//   Recipient: 2〜4体の Unpinned Fire/Assault Team。Cost 1・Draw 2(+/-)
//   （VOFの有無に関わらず必ず引く。§4.2.3の他アクションと違い自動成功は無い）。
//   ドロー修正は§6.5.1と同じ「発令者（HQ/Staff）の練度」。"Rally" が出れば成功し、
//   消費したTeamを除去して同じステップ数の Removed from Play 分隊と入れ替える。
//   再編された分隊の練度は「使ったTeamが全て Assault Team なら Line、
//   それ以外は Green」（p.50。詳細な Multi-Step Unit Experience Levels chart は
//   未データ化のため単純化）。
//
// ── 「Removed from Play」の記録元 ──
//   hit.js の各 Hit（A/F/L/P/C・コンボ）で分隊が Fire/Assault Team だけを残して
//   盤上から完全に消える「消滅閾値」分岐（p.47-48「If this was a unit's last step,
//   the original unit is Removed from Play」）。§6.5.1 の Design Note の通り
//   「どの汎用LATが元々どの分隊のものか」は追跡しないが、本実装では汎用の
//   分隊カウンター画像が存在しないため、実用上の簡略化として
//   「消えた分隊そのもの（同じ unitId）」をプールに記録し、Reconstitute 成功時に
//   その定義のまま盤上へ復活させる。同じ maxSteps の分隊が複数消えている場合、
//   どのエントリが戻るかはプールの並び順（先に消えたもの）で決まる。

import {
  unitCoordMap, getUnitState, setUnitSteps, renderUnitBadges,
} from './state.js';
import {
  canGiveOrder, getCurrentAP, canExpendCommand, expendCommand, findUnitDef,
} from './command.js';
import { addUnitToCard, removeUnitFromCard } from './grid.js';
import { setUnitExperience } from './campaign.js';
import { rallyDrawModifier, latKind } from './rally.js';

/** §4.2.3i のコマンド消費量 */
export const RECONSTITUTE_COST = 1;
/** 基本ドロー枚数（§6.5.2「Draw Action cards」＝常に2±練度。VOF無しでも自動にならない） */
export const RECONSTITUTE_BASE_DRAW = 2;

/** Removed from Play になった分隊のプール（{unitId, faction, maxSteps}） */
export const removedSquadPool = [];

/**
 * 分隊が Removed from Play になったことを記録する（hit.js から呼ぶ）。
 * @param {string} unitId
 * @param {string} faction
 * @param {number} maxSteps
 */
export function recordSquadRemoved(unitId, faction, maxSteps) {
  removedSquadPool.push({ unitId, faction, maxSteps });
}

function _takeRemovedSquad(faction, maxSteps) {
  const idx = removedSquadPool.findIndex(e => e.faction === faction && e.maxSteps === maxSteps);
  if (idx === -1) return null;
  return removedSquadPool.splice(idx, 1)[0];
}

function _factionOf(unitId) {
  return document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`)?.dataset.faction ?? null;
}

/**
 * そのカード上の Unpinned Fire/Assault Team LAT を列挙する。
 * @param {string} coord
 * @returns {Array<{id:string, kind:'fireteam'|'assault', faction:string}>}
 */
export function listReconstituteTeams(coord) {
  return [...unitCoordMap]
    .filter(([id, c]) => c === coord)
    .map(([id]) => id)
    .filter(id => !getUnitState(id).pinned)
    .map(id => ({ id, kind: latKind(id), faction: _factionOf(id) }))
    .filter(t => t.kind === 'fireteam' || t.kind === 'assault');
}

/**
 * そのカードで今 Reconstitute できるステップ数の一覧
 * （faction 別に、Team が2体以上揃い、かつプールに同ステップ数の分隊があるもの）。
 * @param {string} coord
 * @returns {Array<{faction:string, steps:number, teamIds:string[]}>}
 */
export function listReconstituteOptions(coord) {
  const teams = listReconstituteTeams(coord);
  const byFaction = new Map();
  teams.forEach(t => {
    if (!byFaction.has(t.faction)) byFaction.set(t.faction, []);
    byFaction.get(t.faction).push(t);
  });

  const out = [];
  for (const [faction, list] of byFaction) {
    for (let n = 2; n <= 4 && n <= list.length; n++) {
      if (removedSquadPool.some(e => e.faction === faction && e.maxSteps === n)) {
        out.push({ faction, steps: n, teamIds: list.slice(0, n).map(t => t.id) });
      }
    }
  }
  return out;
}

/**
 * 発令できるか判定する（カードは引かない）。
 * @param {string} originatorId
 * @param {string} coord
 * @param {number} steps
 * @returns {{ok:boolean, reason:string, teamIds:string[], faction:string}}
 */
export function canReconstitute(originatorId, coord, steps) {
  const opt = listReconstituteOptions(coord).find(o => o.steps === steps);
  if (!opt) return { ok: false, reason: `${steps}ステップの分隊を再編できる条件が揃っていない`, teamIds: [], faction: null };
  if (getCurrentAP(originatorId) < RECONSTITUTE_COST) return { ok: false, reason: 'コマンドが足りない', teamIds: [], faction: null };
  if (!canExpendCommand(originatorId)) return { ok: false, reason: 'このインパルスの消費上限に達している', teamIds: [], faction: null };
  for (const teamId of opt.teamIds) {
    const order = canGiveOrder(originatorId, teamId);
    if (!order.ok) return { ok: false, reason: `${teamId} に命令できない（${order.reason}）`, teamIds: [], faction: null };
  }
  return { ok: true, reason: '', teamIds: opt.teamIds, faction: opt.faction };
}

/**
 * 引く枚数を返す（§6.5.2「発令者の練度で修正」）。
 * @param {string} originatorId
 * @returns {number}
 */
export function planReconstitute(originatorId) {
  return Math.max(0, RECONSTITUTE_BASE_DRAW + rallyDrawModifier(originatorId));
}

/** 1コマンド消費する（アクション開始時に呼ぶ） */
export function payReconstituteCost(originatorId) { expendCommand(originatorId); }

/**
 * 引いたカード群から成否を判定する。
 * @param {Array<{type:string}>} cards
 * @returns {boolean}
 */
export function isReconstituteSuccess(cards) {
  return cards.some(c => c?.type === 'rally');
}

/**
 * 成功時の効果を適用する：Team を除去し、プールから同ステップ数の分隊を1つ取り出して配置する。
 * @param {string} coord
 * @param {string} faction
 * @param {number} steps
 * @param {string[]} teamIds
 * @returns {{ok:boolean, reason:string, revivedId:string|null}}
 */
export function applyReconstitute(coord, faction, steps, teamIds) {
  const picked = _takeRemovedSquad(faction, steps);
  if (!picked) return { ok: false, reason: 'プールから該当ステップの分隊が見つからない（他の判定と競合した可能性）', revivedId: null };

  // §6.5.2: 使った Team が全て Assault Team なら Line、それ以外は Green
  const allAssault = teamIds.every(id => latKind(id) === 'assault');

  teamIds.forEach(id => removeUnitFromCard(id));

  const def = findUnitDef(picked.unitId);
  if (!def) return { ok: false, reason: `分隊定義が見つからない（${picked.unitId}）`, revivedId: null };
  addUnitToCard(coord, { ...def });
  setUnitSteps(picked.unitId, steps);
  setUnitExperience(picked.unitId, allAssault ? 'line' : 'green');
  renderUnitBadges(picked.unitId);
  document.dispatchEvent(new CustomEvent('board:changed'));
  return { ok: true, reason: '', revivedId: picked.unitId };
}
