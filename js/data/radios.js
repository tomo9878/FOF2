// ===== 無線・電話（RT）とネットワークの定義（§4.3.3 / §4.3.5）=====
//
// FOF.pdf p.27-28 §4.3.3「Networks」／ p.28 §4.3.5「Radios」
//
// ── ネットワーク（§4.3.3）──
//   RT（無線・電話）は割り当てられたネットワーク上でしか通信できない。
//   カウンターに所属網が印字されている。
//   1) CO TAC  中隊戦術網。CO HQ が Staff と小隊長と通信する。
//              **CO HQ の RT がハブ**で、他の RT はここに繋がる必要がある。
//              FO と連隊 Staff はこの網を使えない。
//              大隊 Staff は CO HQ と同じ場所にいれば使える。
//   2) BN TAC  大隊戦術網。**CO HQ・BN HQ・BN Staff だけ**が使える。
//              「CO HQ が BN HQ と通信できていなければ CO HQ は Activate されない」
//   3) ARTY FD 砲兵射撃指揮網。**Arty FO だけ**が使える。
//   4) MTR FD  迫撃砲射撃指揮網。**Mtr FO だけ**が使える。
//   5) AIR CTL 航空support統制網。**FAC だけ**が使える。
//
// ── 無線の世代（§4.3.5）──
//   A. 初期携帯無線（SCR536 等）
//      LOS が通る相手にしか届かない（昼として扱い、煙は無視）。
//      **カバーマーカーの下からは機能しない。**
//   B. 車載・背負い・VHF-FM（SCR300 / SCR610 / PRC25 / PRC77 / PRC119 等）
//      同一網ならマップ上どこでも・盤外とも通信できる。
//   C. 先進携帯無線（ICOM / PRR / PRC148 / PRC152 等）
//      小隊長だけでなく**分隊も**、同一カードと隣接カードで通信できる。
//
// 電話（EE8 等・§4.3.4）は Step3 で実装する。ここでは種別だけ持たせておく。

/** 無線の世代 */
export const RADIO_TYPE = { A: 'A', B: 'B', C: 'C' };

/** RT の機種定義 */
export const RT_MODELS = {
  SCR536: { label: 'SCR536',      kind: 'radio', type: RADIO_TYPE.A },
  SCR300: { label: 'SCR300',      kind: 'radio', type: RADIO_TYPE.B },
  SCR610: { label: 'SCR610',      kind: 'radio', type: RADIO_TYPE.B },
  PRC25:  { label: 'PRC25',       kind: 'radio', type: RADIO_TYPE.B },
  ICOM:   { label: 'ICOM',        kind: 'radio', type: RADIO_TYPE.C },
  EE8:    { label: 'EE8 野戦電話', kind: 'phone', type: null },   // Step3
};

/** ネットワーク */
export const NETWORK = {
  CO_TAC:  'CO_TAC',
  BN_TAC:  'BN_TAC',
  ARTY_FD: 'ARTY_FD',
  MTR_FD:  'MTR_FD',
  AIR_CTL: 'AIR_CTL',
};

/**
 * ネットワークごとの定義。
 *   label     表示名
 *   hubRole   ハブとなる commandRole（CO TAC のみ。§4.3.3-1）
 *   allowRoles   この網を使える commandRole（未指定なら role 制限なし）
 *   allowRoleTags この網を使える役割タグ（ユニット定義の radioRole）
 *   note      ルール上の注記
 */
export const NETWORK_DEF = {
  [NETWORK.CO_TAC]: {
    label: 'CO TAC',
    hubRole: 'co_hq',
    allowRoles: ['co_hq', 'co_staff', 'plt_hq'],
    allowRoleTags: ['bn_staff'],   // BN Staff は CO HQ と同じ場所にいる場合のみ（下の同席チェック）
    denyRoleTags: ['arty_fo', 'mtr_fo', 'fac', 'regimental_staff'],
    note: 'CO HQ の RT がハブ。FO と連隊 Staff は使用不可',
  },
  [NETWORK.BN_TAC]: {
    label: 'BN TAC',
    allowRoles: ['bn_hq', 'co_hq'],
    allowRoleTags: ['bn_staff'],
    note: 'CO HQ・BN HQ・BN Staff のみ',
  },
  [NETWORK.ARTY_FD]: {
    label: 'ARTY FD',
    allowRoles: [],
    allowRoleTags: ['arty_fo', 'arty_battery'],
    note: 'Arty FO のみ',
  },
  [NETWORK.MTR_FD]: {
    label: 'MTR FD',
    allowRoles: [],
    allowRoleTags: ['mtr_fo', 'mtr_battery'],
    note: 'Mtr FO のみ',
  },
  [NETWORK.AIR_CTL]: {
    label: 'AIR CTL',
    allowRoles: [],
    allowRoleTags: ['fac', 'aircraft'],
    note: 'FAC のみ',
  },
};

/**
 * 無線の世代の厳しさ。両端で機種が違う場合は**厳しい方**を適用する。
 * A（LOS＋カバー不可）が最も厳しく、C（同・隣接カード）、B（無制限）の順。
 */
export const TYPE_STRICTNESS = { [RADIO_TYPE.A]: 3, [RADIO_TYPE.C]: 2, [RADIO_TYPE.B]: 1 };
