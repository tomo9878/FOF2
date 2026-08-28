// ===== 弾薬管理（§7.18 Ammunition）=====
//
// FOF.pdf p.59-61 §7.18
//
// units-normandy.js の unit定義に `ammo:{type,points,capacity}` を持つユニットだけを追跡する。
// S/A/S VOF レーティングの分隊・Assault Team・手榴弾は弾薬を管理しない（§7.18 冒頭・原文通り対象外）。
//
// ── 実装したもの ──
//   - ユニットごとの現在弾薬ポイント（unitAmmoMap）。初期値は unit定義の points（capacity が上限）。
//   - expendAmmo(unitId, n=1)：消費。0 になったら Out of Ammo 状態にする（§7.18.2）。
//   - resupplyAmmo(unitId, points)：補給（§7.18.3）。capacity で頭打ち・Out of Ammo 解除。
//   - Concentrate Fire 成功時の追加1消費（§7.11.3・§7.18.1.A）は combat-action.js から呼ぶ。
//   - 右パネルの手動 -1/補給ボタン（§7.18.4「いつ更新するかは厳密でなくてよい」を踏まえ、
//     基本 VOF を出しているだけのユニットの消費は人間が判断してボタンを押す、既存の
//     NCM手動調整(+/-)と同じ「人間の裁量に委ねる」設計）。
//
// ── 既知の簡略化 ──
//   - §7.18.2 の分岐①「1ステップ・Fire Team面が S/A/S VOF ならその面へ反転」は、
//     Fire Team 面側の VOF レーティングデータが無い（Concentrate Fire 資格判定と同じ既知のデータ欠如）
//     ため判定できない。そのため弾薬切れは常に分岐②の Out of Ammo マーカー扱いとする。
//   - Out of Ammo 中の「VOF レーティングが S・レンジが Close に強制される」効果は、
//     このアプリでは VOF がカード単位で人間が手動選択するため、コード側での強制はできない
//     （bad-order 表示で人間に判断を委ねる）。
//   - 輸送上限超過分を「移動時に置いていく」処理（5.1.6・§7.18 note）は未対応。
//   - 敵ユニットの弾薬（§8.11）は未対応（campaign PDF内の敵TO&E弾薬数値を未確認のため）。
//   - FPL・AT Fire・Ranged Grenade Attack の消費（§7.18.4）は該当アクション自体が未実装のため
//     呼び出し元が無い。

import { findUnitDef } from './command.js';
import { getUnitState, renderUnitBadges } from './state.js';

/** unitId → { type, points, capacity } */
export const unitAmmoMap = new Map();

/** そのユニットが弾薬を管理する種別か（unit定義に ammo フィールドがあるか） */
export function hasAmmoTracking(unitId) {
  return !!findUnitDef(unitId)?.ammo;
}

/**
 * 現在弾薬を返す（初回アクセス時に unit定義の初期値を投入）。
 * @param {string} unitId
 * @returns {{type:string, points:number, capacity:number}|null}
 */
export function getAmmo(unitId) {
  if (!unitAmmoMap.has(unitId)) {
    const def = findUnitDef(unitId)?.ammo;
    if (!def) return null;
    unitAmmoMap.set(unitId, { type: def.type, points: def.points, capacity: def.capacity });
  }
  return unitAmmoMap.get(unitId) ?? null;
}

/**
 * 弾薬を消費する。0 になったら Out of Ammo 状態にする（§7.18.2）。
 * @param {string} unitId
 * @param {number} n
 * @returns {{ok:boolean, depleted?:boolean, remaining?:number, reason?:string}}
 */
export function expendAmmo(unitId, n = 1) {
  const ammo = getAmmo(unitId);
  if (!ammo) return { ok: false, reason: '弾薬を管理しないユニット' };
  ammo.points = Math.max(0, ammo.points - n);
  const depleted = ammo.points === 0;
  if (depleted) {
    const s = getUnitState(unitId);
    if (!s.outOfAmmo) { s.outOfAmmo = true; renderUnitBadges(unitId); }
  }
  return { ok: true, depleted, remaining: ammo.points };
}

/**
 * 補給する（§7.18.3）。capacity で頭打ち。Out of Ammo を解除する。
 * @param {string} unitId
 * @param {number} points
 * @returns {{ok:boolean, points?:number, reason?:string}}
 */
export function resupplyAmmo(unitId, points) {
  const ammo = getAmmo(unitId);
  if (!ammo) return { ok: false, reason: '弾薬を管理しないユニット' };
  ammo.points = Math.min(ammo.capacity, ammo.points + points);
  const s = getUnitState(unitId);
  if (ammo.points > 0 && s.outOfAmmo) { s.outOfAmmo = false; renderUnitBadges(unitId); }
  return { ok: true, points: ammo.points };
}

/** リセット用：全弾薬状態をクリア（unit定義の初期値に戻る） */
export function clearAmmo() { unitAmmoMap.clear(); }
