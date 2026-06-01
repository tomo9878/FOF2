// ===== 地形防御データ（terrain_cards.json より抽出）=====
//
// defHigh    : PDF が dark border（los=true）方向から進入する場合の防御値
// defLow     : PDF がすべて white border / 同カード内 / Incoming の場合の防御値
// burstPenalty: Incoming! / Air Strike! 時に defHigh から減算する値
//               正値 = 爆発が地形を突き抜けやすい（防御値減）
//               負値 = 樹冠が爆発を吸収（防御値増）
// los        : { top, top_right, right, bottom_right, bottom, bottom_left, left, top_left }
//              true = その方向が dark border（bocage/gully の壁など）
//              ※ defHigh === defLow のカードでは los の値は無効（どちらも同じ防御値）

// 共通定数
const _N = Object.freeze({
  top: false, top_right: false, right: false, bottom_right: false,
  bottom: false, bottom_left: false, left: false, top_left: false,
});
const _A = Object.freeze({
  top: true, top_right: true, right: true, bottom_right: true,
  bottom: true, bottom_left: true, left: true, top_left: true,
});

/** @type {Record<string, {defHigh:number, defLow:number, burstPenalty:number, los:object}>} */
export const TERRAIN_DB = {
  // ── Hill（N01-N06）: elevation=1, cover なし ──
  N01: { defHigh: 0, defLow: 0, burstPenalty: 0, los: _N },
  N02: { defHigh: 0, defLow: 0, burstPenalty: 0, los: _N },
  N03: { defHigh: 0, defLow: 0, burstPenalty: 0, los: _N },
  N04: { defHigh: 0, defLow: 0, burstPenalty: 0, los: _N },
  N05: { defHigh: 0, defLow: 0, burstPenalty: 0, los: _N },
  N06: { defHigh: 0, defLow: 0, burstPenalty: 0, los: _N },

  // ── Marsh（N07-N08）: burstPenalty=+1（低木でも炸裂が貫通しやすい）──
  N07: { defHigh: 1, defLow: 1, burstPenalty: 1, los: _N },
  N08: { defHigh: 1, defLow: 1, burstPenalty: 1, los: _N },

  // ── Orchard/Grove（N09-N16）: burstPenalty=-1（樹冠が爆発を吸収）──
  N09: { defHigh: 1, defLow: 1, burstPenalty: -1, los: _N },
  N10: { defHigh: 1, defLow: 1, burstPenalty: -1, los: _N },
  N11: { defHigh: 1, defLow: 1, burstPenalty: -1, los: _N },
  N12: { defHigh: 1, defLow: 1, burstPenalty: -1, los: _N },
  N13: { defHigh: 1, defLow: 1, burstPenalty: -1, los: _N },
  N14: { defHigh: 1, defLow: 1, burstPenalty: -1, los: _N },
  N15: { defHigh: 1, defLow: 1, burstPenalty: -1, los: _N },
  N16: { defHigh: 1, defLow: 1, burstPenalty: -1, los: _N },

  // ── Woods（N17-N24）: burstPenalty=-1 ──
  N17: { defHigh: 2, defLow: 2, burstPenalty: -1, los: _N },
  N18: { defHigh: 2, defLow: 2, burstPenalty: -1, los: _N },
  N19: { defHigh: 2, defLow: 2, burstPenalty: -1, los: _N },
  N20: { defHigh: 2, defLow: 2, burstPenalty: -1, los: _N },
  N21: { defHigh: 2, defLow: 2, burstPenalty: -1, los: _N },
  N22: { defHigh: 2, defLow: 2, burstPenalty: -1, los: _N },
  N23: { defHigh: 2, defLow: 2, burstPenalty: -1, los: _N },
  N24: { defHigh: 2, defLow: 2, burstPenalty: -1, los: _N },

  // ── Hedgerow/Bocage（N25-N36）──
  // N25-N26: 単純ボカージュ（LOSバリエーションなし）
  N25: { defHigh: 2, defLow: 2, burstPenalty: 0, los: _N },
  N26: { defHigh: 2, defLow: 2, burstPenalty: 0, los: _N },
  // N27-N36: 方向によって防御値が変わる（dark=2, open=1）
  N27: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, right: true, left: true } },
  N28: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, right: true, left: true } },
  N29: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, right: true, bottom_right: true, bottom: true } },
  N30: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, right: true, bottom_right: true, bottom: true } },
  N31: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, bottom: true, bottom_left: true, left: true } },
  N32: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, bottom: true, bottom_left: true, left: true } },
  N33: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, top: true, bottom: true } },
  N34: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, top: true, bottom: true } },
  N35: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, right: true, bottom_right: true, bottom: true, bottom_left: true, left: true } },
  N36: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, right: true, bottom_right: true, bottom: true, bottom_left: true, left: true } },

  // ── Village（N37-N40）──
  N37: { defHigh: 3, defLow: 3, burstPenalty: 0, los: _N },
  N38: { defHigh: 3, defLow: 3, burstPenalty: 0, los: _N },
  N39: { defHigh: 3, defLow: 3, burstPenalty: 0, los: _N },
  N40: { defHigh: 3, defLow: 3, burstPenalty: 0, los: _N },

  // ── Open Fields（N41-N44）: 遮蔽なし、全方向 LOS 開放 ──
  N41: { defHigh: 0, defLow: 0, burstPenalty: 0, los: _A },
  N42: { defHigh: 0, defLow: 0, burstPenalty: 0, los: _A },
  N43: { defHigh: 0, defLow: 0, burstPenalty: 0, los: _A },
  N44: { defHigh: 0, defLow: 0, burstPenalty: 0, los: _A },

  // ── Gully/Draw（N45-N48）: 方向で防御値が変わる（壁=2, 開口=1）──
  N45: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, top: true, bottom: true } },
  N46: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, top: true, bottom: true } },
  N47: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, right: true, left: true } },
  N48: { defHigh: 2, defLow: 1, burstPenalty: 0, los: { ..._N, right: true, left: true } },

  // ── Farm（N49-N53）──
  N49: { defHigh: 2, defLow: 2, burstPenalty: 0, los: _N },
  N50: { defHigh: 2, defLow: 2, burstPenalty: 0, los: _N },
  N51: { defHigh: 2, defLow: 2, burstPenalty: 0, los: _N },
  N52: { defHigh: 2, defLow: 2, burstPenalty: 0, los: _N },
  N53: { defHigh: 2, defLow: 2, burstPenalty: 0, los: _N },

  // ── Church（N54）・Cemetery（N55）──
  N54: { defHigh: 3, defLow: 3, burstPenalty: 0, los: _N },
  N55: { defHigh: 1, defLow: 1, burstPenalty: 0, los: _A },
};

/**
 * カードIDからTerrainデータを取得（未知カードはnullを返す）
 * @param {string|null} cardId
 * @returns {{defHigh:number, defLow:number, burstPenalty:number, coverPositions:number, los:object}|null}
 */
export function getTerrainData(cardId) {
  if (!cardId) return null;
  return TERRAIN_DB[cardId] ?? null;
}

/** terrain_cards.json の cover_positions をカードIDから直接引く簡易テーブル */
export const COVER_POSITIONS = {
  // Hill: カバー配置不可
  N01:0, N02:0, N03:0, N04:0, N05:0, N06:0,
  // Marsh
  N07:1, N08:1,
  // Orchard/Grove
  N09:2, N10:2, N11:2, N12:2, N13:2, N14:2, N15:2, N16:2,
  // Woods
  N17:3, N18:3, N19:3, N20:3, N21:3, N22:3, N23:3, N24:3,
  // Hedgerow/Bocage
  N25:2, N26:2, N27:2, N28:2, N29:2, N30:2,
  N31:2, N32:2, N33:2, N34:2, N35:2, N36:2,
  // Village
  N37:3, N38:3, N39:3, N40:3,
  // Open Fields
  N41:1, N42:1, N43:1, N44:1,
  // Gully/Draw
  N45:1, N46:1, N47:1, N48:1,
  // Farm
  N49:1, N50:1, N51:1, N52:1, N53:1,
  // Church, Cemetery
  N54:1, N55:1,
};
