// ===== シナリオ別 R# テーブル汎用エンジン =====
//
// Fields of Fire はミッションごとに内容が異なる「R#（ランダムナンバー）表」を多用する。
//   例: 友軍/敵 上位HQイベント表（§3.1）、敵接触タイプ判定表（§8.3）、
//       PC文字別クロスリファレンス、部隊配置方向表（§8.4.2）…
// これらは形が共通（denom分の1でR#を引き、範囲に応じた行を採用する）なので、
// 1つの汎用エンジンで扱い、今後増えるテーブル種別にもコード変更なしで対応する。
//
// ── テーブルの形 ──
//   table = {
//     denom: 10,                 // アクションカード下部の「/N」列（何分のRか）
//     rows: [
//       {
//         ...任意の識別・説明フィールド（label / packageId / effect など）,
//         ranges: {
//           default:     [lo, hi],   // 列が1つだけのテーブル
//           A:           [lo, hi],   // 列が複数あるテーブル（PC文字別など）
//           turns_2_6:   [lo, hi],   // ターン範囲別テーブル（HQイベント表など）
//         },
//       },
//       ...
//     ],
//   }
// 「列」の意味（PC文字か、ターン範囲か、等）はテーブルごとに自由。エンジン側は
// ranges のキー文字列を渡された column と突き合わせるだけで、意味には関知しない。
//
// ── R# そのものについて ──
// カード下部の「ランダムナンバー」欄（1.2.7 / 2.8.5）は、50枚のアクションカードに
// カード番号順で均等に割り振られた固定の印字値。全50枚の画像を実際に確認し、
// 以下の式で正確に再現できることを確認済み（R#/10列は5枚ずつ完全に均等＝10%）:
//
//   R#(denom, cardNumber) = floor((cardNumber - 1) * denom / 50) + 1
//
// そのため rollR() は Math.random ではなく、共有デッキ（deck.js）から実際に
// カードを1枚引いてこの式で計算する。他の場面（戦闘解決・コマンド取得等）と
// 同じ1つのデッキを消費するため、デッキの減り方・リシャッフルタイミングも
// 物理ゲームと一致する。

import { drawActionCard } from '../deck.js';

/**
 * R# を1つ引く（実際にアクションカードを1枚引き、カード番号から計算する）。
 * @param {number} denom
 * @returns {{ r:number, card:object }}
 */
export function rollR(denom) {
  const card = drawActionCard();
  const r = Math.floor((card.number - 1) * denom / 50) + 1;
  return { r, card };
}

/**
 * 引いた R# から該当行を引く（ロールはしない・純粋な参照のみ）。
 * @param {object} table
 * @param {number} r
 * @param {string} [column='default']
 * @returns {object|null}
 */
export function lookupRow(table, r, column = 'default') {
  return table.rows.find(row => {
    const range = row.ranges[column];
    return !!range && r >= range[0] && r <= range[1];
  }) ?? null;
}

/**
 * R#を引いて該当行を返す（単一列 or 列指定のテーブル用）。
 * @param {object} table
 * @param {string} [column='default']
 * @returns {{ r:number, row:object|null, card:object }}
 */
export function resolveTable(table, column = 'default') {
  const { r, card } = rollR(table.denom);
  return { r, card, row: lookupRow(table, r, column) };
}

/**
 * 「値そのもの」または「R#条件テーブル」のどちらかで書かれた spec を解決する汎用ヘルパー。
 * §8.4.1 の距離（point_blank/max_los_range等）だけでなく、§8.3 の武器種別選択
 * （LMG or HMG）や FO種別選択（Arty FO or Mtr FO）等、R#明記なしの2択（§1.2.7の一般則で
 * denom=2を引く）や、R#が明記された条件分岐にも共通して使える。
 * @param {string|object} spec - 固定値の文字列、または {denom, rows:[{value, ranges}]} テーブル
 * @param {string} [column='default']
 * @returns {{ value:string|null, r?:number, card?:object }}
 */
export function resolveValueSpec(spec, column = 'default') {
  if (typeof spec === 'string') return { value: spec };
  const { r, card, row } = resolveTable(spec, column);
  return { value: row?.value ?? null, r, card };
}

/**
 * ターン範囲別テーブル用（ranges のキーが "turns_2_6" のような形の表）。
 * 指定ターンが属する範囲キーを自動で見つけて解決する。
 * @param {object} table
 * @param {number} turnNumber
 * @returns {{ r:number, row:object|null, card:object }}
 */
export function resolveTurnTable(table, turnNumber) {
  const { r, card } = rollR(table.denom);
  const row = table.rows.find(row => {
    const key = Object.keys(row.ranges).find(k => {
      const m = k.match(/^turns_(\d+)_(\d+)$/);
      if (!m) return false;
      return turnNumber >= Number(m[1]) && turnNumber <= Number(m[2]);
    });
    if (!key) return false;
    const range = row.ranges[key];
    return r >= range[0] && r <= range[1];
  }) ?? null;
  return { r, card, row };
}
