// ===== 野戦電話と電話線（§4.3.4 Field Telephones）=====
//
// FOF.pdf p.28-29 §4.3.4
//
// ── 何ができるか ──
//   電話は Visual-Verbal 圏外との通信を可能にする。すなわち
//   **別のカード・盤外・同じカードの別エリア（別カバーマーカー）・Pinned ユニット**。
//   ＝ 無線と違ってカバーの下でも Pinned でも通る。
//
// ── 接続（Connecting Phone Lines）──
//   電話機どうしは、**途切れない電話線マーカーまたは他の電話機の連なり**で
//   繋がっている必要がある（電話機カウンター自体も電話線として働く）。
//   1本の電話線は何本のネットワークでも同時に支えられる（他網の電話機も含む）。
//   ・CO TAC 網が機能するには **CO HQ の電話が接続の一部**であること
//   ・それ以外の網は **スタートエリアに接続**していること
//     （スタートエリアには電話線が組み込まれている）
//
// ── 敷設 ──
//   電話線マーカーの数はミッション指示書に書かれている（ノルマンディーは電話選択時に4本）。
//   電話線を割り当てられたユニットは **1カードにつき1本** 置ける。
//   これは命令不要で、**そのカードを離れるときに自動的に**行われる。
//
// ── 戦闘による損害（Combat Effects Segment）──
//   ・電話線マーカーのあるカードに Incoming! または Air Strike! の VOF があると、
//     **R#1/2（2分の1）で切断**。切れたら裏返す。§4.2.1k のアクションで修理できる
//   ・電話線マーカーのカードに **Good Order の敵がいて Good Order の友軍がいない**場合、
//     **R#1-2/3（3分の2）で敵に発見され切断**される
//
// ── 電話機そのものの損害 ──
//   電話を持つユニットの最後の1ステップが Casualty になると、1/2 で電話は破壊される。
//   壊れなければ盤上に置かれ、別のユニットが拾って使える（§4.2.2h）。※本実装は未対応

import { unitCoordMap, getUnitState } from './state.js';
import { cardVOFMap } from './vof.js';
import { rollR } from './data/scenario-tables.js';
import { RT_MODELS, NETWORK_DEF } from './data/radios.js';
import { UNITS } from './data/units-normandy.js';
import { getCommandRole, getCurrentAP, canExpendCommand, expendCommand } from './command.js';

/** coord → { cut:boolean } 電話線マーカー（1カードにつき1本） */
export const phoneLineMap = new Map();

/** 未使用の電話線マーカーの残数（ミッション指示書で決まる） */
let _phoneLineStock = 0;

/** @param {number} n */
export function setPhoneLineStock(n) { _phoneLineStock = Math.max(0, n | 0); }
/** @returns {number} */
export function getPhoneLineStock() { return _phoneLineStock; }

/** 電話線マーカーを全消去（リセット用） */
export function clearPhoneLines() { phoneLineMap.clear(); _phoneLineStock = 0; }

/**
 * そのカードがスタートエリアか（電話線が組み込まれている・§4.3.4）。
 * @param {string} coord
 * @returns {boolean}
 */
export function isStagingArea(coord) {
  return !!document.querySelector(`.terrain-card.staging-area[data-coord="${coord}"]`);
}

// ===== 敷設・切断・修理 =====

/**
 * 電話線マーカーを1本置く（1カードにつき1本まで）。
 * @param {string} coord
 * @returns {{ok:boolean, reason:string}}
 */
export function layPhoneLine(coord) {
  if (phoneLineMap.has(coord)) return { ok: false, reason: 'このカードには既に電話線がある' };
  if (_phoneLineStock <= 0)    return { ok: false, reason: '電話線マーカーの残りがない' };
  if (isStagingArea(coord))    return { ok: false, reason: 'スタートエリアには電話線が組み込まれている' };
  phoneLineMap.set(coord, { cut: false });
  _phoneLineStock--;
  renderPhoneLine(coord);
  return { ok: true, reason: '' };
}

/**
 * 電話線マーカーを取り除いて在庫へ戻す。
 * @param {string} coord
 */
export function removePhoneLine(coord) {
  if (!phoneLineMap.has(coord)) return;
  phoneLineMap.delete(coord);
  _phoneLineStock++;
  renderPhoneLine(coord);
}

/**
 * 電話線を切断する（裏返す）。
 * @param {string} coord
 */
export function cutPhoneLine(coord) {
  const l = phoneLineMap.get(coord);
  if (!l) return false;
  l.cut = true;
  renderPhoneLine(coord);
  return true;
}

/**
 * 電話線を修理する（表に戻す）。ルール上の可否は canRepairPhoneLine() で判定する。
 * @param {string} coord
 */
export function repairPhoneLine(coord) {
  const l = phoneLineMap.get(coord);
  if (!l || !l.cut) return false;
  l.cut = false;
  renderPhoneLine(coord);
  return true;
}

// ===== §4.2.1k Repair a Cut Phone Line =====
//
// FOF.pdf p.22 アクション表 k.
//   コスト1 ／ Auto ／ 発令者「Any HQ or Staff **on the same card as the cut line**」
//   対象「A Good Order unit **on the same card as** a cut phone line」

/** そのカードにいるユニットIDを列挙する */
function _unitsOnCard(coord) {
  const ids = [];
  for (const [id, c] of unitCoordMap) if (c === coord) ids.push(id);
  return ids;
}

/** Good Order Unit か（用語集 p.7: LAT でなく Pinned でない） */
function _isGoodOrderUnit(unitId) {
  for (const arr of Object.values(UNITS)) {
    for (const u of arr) {
      if (u.id === unitId) return u.type !== 'lat' && !getUnitState(unitId).pinned;
      if (u.fireteam?.id === unitId || u.assaultteam?.id === unitId) return false; // LAT
    }
  }
  return false;   // 定義に無い駒（LAT カウンター等）は Good Order とみなさない
}

/**
 * そのカードの切れた電話線を修理できるか（§4.2.1k）。
 * @param {string} coord
 * @returns {{ok:boolean, reason:string, originatorId:string|null, recipientId:string|null}}
 */
export function canRepairPhoneLine(coord) {
  const NG = (reason) => ({ ok: false, reason, originatorId: null, recipientId: null });
  const line = phoneLineMap.get(coord);
  if (!line)     return NG('このカードに電話線がない');
  if (!line.cut) return NG('この電話線は切れていない');

  const onCard = _unitsOnCard(coord);
  // 発令者: 同じカードにいる HQ/Staff で、コマンドが払えること
  const originatorId = onCard.find(id =>
    getCommandRole(id) && getCurrentAP(id) >= 1 && canExpendCommand(id));
  if (!originatorId) {
    return NG(onCard.some(id => getCommandRole(id))
      ? '同じカードの HQ/Staff にコマンドが無い（または消費上限）'
      : '同じカードに HQ/Staff がいない');
  }
  // 対象: 同じカードの Good Order ユニット
  const recipientId = onCard.find(id => _isGoodOrderUnit(id));
  if (!recipientId) return NG('同じカードに Good Order のユニットがいない');

  return { ok: true, reason: '', originatorId, recipientId };
}

/**
 * §4.2.1k を実行する（1コマンド消費・自動成功）。
 * @param {string} coord
 * @returns {{ok:boolean, reason:string, originatorId:string|null}}
 */
export function repairPhoneLineAction(coord) {
  const check = canRepairPhoneLine(coord);
  if (!check.ok) return { ok: false, reason: check.reason, originatorId: null };
  expendCommand(check.originatorId);
  repairPhoneLine(coord);
  return { ok: true, reason: '', originatorId: check.originatorId };
}

/**
 * そのカードに生きた電話線があるか。
 * @param {string} coord
 * @returns {boolean}
 */
export function hasLivePhoneLine(coord) {
  const l = phoneLineMap.get(coord);
  return !!l && !l.cut;
}

// ===== 接続判定 =====

/** coord → {row, col} */
function _rc(coord) {
  const m = /^([A-Z]+)(\d+)$/.exec(coord ?? '');
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: parseInt(m[2], 10), col };
}

/** 隣接（8方向）か */
function _isAdjacent(a, b) {
  const ra = _rc(a), rb = _rc(b);
  if (!ra || !rb) return false;
  const dr = Math.abs(ra.row - rb.row), dc = Math.abs(ra.col - rb.col);
  return (dr <= 1 && dc <= 1) && (dr + dc > 0);
}

/**
 * 電話線として機能しているカードを列挙する。
 *   ・生きた電話線マーカーのあるカード
 *   ・電話機を持つユニットがいるカード（電話機自体が電話線として働く）
 *   ・スタートエリア（電話線が組み込まれている）
 * @param {Map} unitRTMap - comm.js の RT 保有マップ
 * @returns {Set<string>}
 */
export function getPhoneNodes(unitRTMap) {
  const nodes = new Set();
  for (const [coord, l] of phoneLineMap) if (!l.cut) nodes.add(coord);
  for (const [unitId, rts] of unitRTMap) {
    if (!rts.some(rt => !rt.dead && RT_MODELS[rt.model]?.kind === 'phone')) continue;
    const c = unitCoordMap.get(unitId);
    if (c) nodes.add(c);
  }
  document.querySelectorAll('.terrain-card.staging-area[data-coord]')
    .forEach(el => nodes.add(el.dataset.coord));
  return nodes;
}

/**
 * 起点カードから、電話線の連なりで到達できるカードの集合を返す。
 * @param {string} startCoord
 * @param {Set<string>} nodes
 * @returns {Set<string>}
 */
export function reachableThroughLines(startCoord, nodes) {
  const seen = new Set();
  if (!nodes.has(startCoord)) return seen;   // 起点自体が電話線として機能していない
  const queue = [startCoord];
  seen.add(startCoord);
  while (queue.length) {
    const cur = queue.shift();
    for (const n of nodes) {
      if (seen.has(n)) continue;
      if (_isAdjacent(cur, n)) { seen.add(n); queue.push(n); }
    }
  }
  return seen;
}

/**
 * 電話で通信できるか（§4.3.4）。
 * @param {string} fromId
 * @param {string} toId
 * @param {Map} unitRTMap - comm.js の RT 保有マップ
 * @param {(unitId:string, network:string)=>boolean} canUseNetwork
 * @param {(role:string)=>string[]} findUnitsByCommandRole
 * @returns {{ok:boolean, network:string|null, reason:string}}
 */
export function canReachByPhone(fromId, toId, unitRTMap, canUseNetwork, findUnitsByCommandRole) {
  const phonesOf = id => (unitRTMap.get(id) ?? [])
    .filter(rt => !rt.dead && RT_MODELS[rt.model]?.kind === 'phone');
  const fromPhones = phonesOf(fromId);
  const toPhones   = phonesOf(toId);
  if (!fromPhones.length) return { ok: false, network: null, reason: '発令者が電話を持っていない' };
  if (!toPhones.length)   return { ok: false, network: null, reason: '対象が電話を持っていない' };

  const fromCoord = unitCoordMap.get(fromId);
  const toCoord   = unitCoordMap.get(toId);
  if (!fromCoord || !toCoord) return { ok: false, network: null, reason: '盤外の電話は未対応' };

  const nodes = getPhoneNodes(unitRTMap);
  const reach = reachableThroughLines(fromCoord, nodes);

  let lastReason = '同じネットワークの電話が無い';
  for (const a of fromPhones) {
    for (const b of toPhones) {
      if (a.network !== b.network) continue;
      const net = a.network;
      const def = NETWORK_DEF[net];

      if (!canUseNetwork(fromId, net) || !canUseNetwork(toId, net)) {
        lastReason = `${def.label} はこのユニットが使えない網（${def.note}）`;
        continue;
      }
      if (!reach.has(toCoord)) {
        lastReason = `${def.label}: 電話線が繋がっていない`;
        continue;
      }
      // CO TAC は CO HQ の電話が接続に含まれること
      if (def.hubRole) {
        const hubIds = findUnitsByCommandRole(def.hubRole);
        const hubOnLine = hubIds.some(id => {
          const c = unitCoordMap.get(id);
          return c && reach.has(c) && phonesOf(id).some(rt => rt.network === net);
        });
        if (!hubOnLine) { lastReason = `${def.label}: CO HQ の電話が接続に入っていない`; continue; }
      } else {
        // それ以外の網はスタートエリアに接続していること
        const touchesStaging = [...reach].some(c => isStagingArea(c));
        if (!touchesStaging) { lastReason = `${def.label}: スタートエリアに接続していない`; continue; }
      }
      return { ok: true, network: net, reason: `${def.label}（電話）` };
    }
  }
  return { ok: false, network: null, reason: lastReason };
}

// ===== 戦闘による電話線の損害（§4.3.4）=====

/** Incoming! / Air Strike! に相当する VOF 種別 */
const LINE_CUTTING_VOF = new Set([
  'Incoming-3', 'Incoming-4', 'Incoming-5', 'Incoming-6', 'Incoming-7',
  'WP-3', 'WP-4', 'AirStrike', 'AirStrike-8',
]);

/**
 * Combat Effects Segment の電話線チェック。
 *   ① Incoming!/Air Strike! の VOF があるカード → R#1/2 で切断
 *   ② Good Order の敵がいて Good Order の友軍がいないカード → R#1-2/3 で切断
 * @param {(coord:string)=>{enemy:boolean, friendly:boolean}} occupancyFn
 *        そのカードに Good Order の敵／友軍がいるかを返す関数
 * @returns {Array<{coord:string, cause:string, r:number, denom:number, cut:boolean, card:object}>}
 */
export function checkPhoneLineCombatDamage(occupancyFn) {
  const results = [];
  for (const [coord, line] of phoneLineMap) {
    if (line.cut) continue;

    const vof = cardVOFMap.get(coord);
    if (vof && LINE_CUTTING_VOF.has(vof.type)) {
      const { r, card } = rollR(2);
      const cut = r === 1;                      // R#1/2
      if (cut) cutPhoneLine(coord);
      results.push({ coord, cause: `${vof.type} の VOF`, r, denom: 2, cut, card });
      if (cut) continue;
    }

    const occ = occupancyFn ? occupancyFn(coord) : { enemy: false, friendly: false };
    if (occ.enemy && !occ.friendly) {
      const { r, card } = rollR(3);
      const cut = r <= 2;                       // R#1-2/3
      if (cut) cutPhoneLine(coord);
      results.push({ coord, cause: '敵に発見された', r, denom: 3, cut, card });
    }
  }
  return results;
}

// ===== 描画 =====

/**
 * カード上の電話線マーカーを描き直す。
 * @param {string} coord
 */
export function renderPhoneLine(coord) {
  const card = document.querySelector(`.terrain-card[data-coord="${coord}"]`);
  if (!card) return;
  card.querySelector('.phone-line-marker')?.remove();
  const line = phoneLineMap.get(coord);
  if (!line) return;
  const img = document.createElement('img');
  img.className = 'phone-line-marker';
  img.src = line.cut ? 'images/Asset - Phone Line - cut.png' : 'images/Asset - Phone Line.png';
  img.title = line.cut ? '電話線（切断）' : '電話線';
  card.appendChild(img);
}

/** 全カードの電話線を描き直す */
export function renderAllPhoneLines() {
  document.querySelectorAll('.terrain-card[data-coord]').forEach(el => renderPhoneLine(el.dataset.coord));
}
