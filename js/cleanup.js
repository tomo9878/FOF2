// ===== クリーンアップ（§3.7.3 Pinned Recovery ／ §3.8 Clean Up Phase）=====
//
// FOF.pdf p.17
//   §3.7.3 Pinned Recovery Segment
//     「Remove Pinned markers from any vehicle or infantry units that are
//       not under a VOF marker (including Mines whether activated or not).」
//   §3.8 Clean Up Phase
//     「Remove Pyrotechnic, Smoke, Illumination, Exposed, Moved/Fired,
//       Concentrated Fire, Booby Trap, Grenade and Grenade Miss markers.」
//     （以下、実装対象外の項目は末尾の「対象外」参照）
//
// このプロジェクトは §3.7 Mutual Combat Phase をセグメント単位に分割しておらず、
// フェーズ送りは大分類の8フェーズ（friendlyHigherHQ 〜 クリーンアップ）のままなので、
// 本来は §3.8 より前のセグメントである §3.7.3 Pinned Recovery も、
// 実装上は「クリーンアップ」フェーズに進んだ瞬間にまとめて処理する。
//
// ── 実装したもの ──
//   ・§3.7.3 Pinned Recovery: VOF の無いカードにいるユニットの Pinned を解除
//   ・§3.8 Exposed マーカーの除去
//   ・§3.8 Concentrated Fire / Grenade / Grenade Miss マーカーの除去
//     （Grenade は「持続する S/A/H 系VOF」ではなく単発の攻撃効果なので、
//       他の VOF 種別と違って毎ターン消える。crossfire は道連れにしない）
//
// ── 対象外（新規の下位システムが要るため未実装。ROADMAP 参照）──
//   ・Pyrotechnic/Smoke/Illumination マーカー除去（§4.4・9.2 未実装）
//   ・Casualty Evacuation（§5.1.7 CCP 未実装）
//   ・VOFを持たない敵へのCease Fire自動発令（§8.6 敵AI 未実装）
//   ・防御ミッションの未解決PC除去（§3.2 防御フェーズ未実装）
//   ・Mine マーカーの Draw 面反転／Sniper VOF の移動（§8.7・§7.15/8.8 未実装）

import { unitStateMap, unitCoordMap, getUnitState, renderUnitBadges } from './state.js';
import { cardVOFMap, renderCardVOF } from './vof.js';

/** §3.8 で除去する VOF 種別（単発の攻撃効果。持続射撃の S/A/H 等は対象外） */
const CLEANUP_VOF_TYPES = new Set(['Grenade', 'BoobyTrap']);

/**
 * クリーンアップを実行する（フェーズが「クリーンアップ」に入った瞬間に呼ぶ）。
 * @returns {{pinnedRecovered:string[], exposedCleared:string[], vofCleared:string[]}}
 */
export function runCleanupPhase() {
  const pinnedRecovered = [];
  const exposedCleared = [];
  const vofCleared = [];

  // §3.7.3 Pinned Recovery: VOF の無いカードにいるユニットの Pinned を解除
  for (const [unitId, s] of unitStateMap) {
    if (!s.pinned) continue;
    const coord = unitCoordMap.get(unitId);
    if (coord && cardVOFMap.get(coord)?.type) continue;   // VOF 下は回復しない
    s.pinned = false;
    pinnedRecovered.push(unitId);
    renderUnitBadges(unitId);
  }

  // §3.8 Exposed 除去
  for (const [unitId, s] of unitStateMap) {
    if (!s.exposed) continue;
    s.exposed = false;
    exposedCleared.push(unitId);
    renderUnitBadges(unitId);
  }

  // §3.8 Concentrated Fire / Grenade / Grenade Miss 除去
  for (const [coord, vof] of cardVOFMap) {
    let changed = false;
    if (vof.concentrate) { vof.concentrate = false; changed = true; }
    if (vof.grenadeMiss) { vof.grenadeMiss = false; changed = true; }
    if (CLEANUP_VOF_TYPES.has(vof.type)) { vof.type = null; changed = true; }
    if (changed) {
      vofCleared.push(coord);
      if (!vof.type && !vof.crossfire && !vof.concentrate && !vof.grenadeMiss) {
        cardVOFMap.delete(coord);
      }
      renderCardVOF(coord);
    }
  }

  document.dispatchEvent(new CustomEvent('board:changed'));
  return { pinnedRecovered, exposedCleared, vofCleared };
}
