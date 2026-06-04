// ===== VOF（Volume of Fire）マーカー管理 =====
//
// cardVOFMap: coord → { type: string, crossfire: boolean, concentrate: boolean }
//
// VOF_DEF に全タイプの定義・画像・NCM値を集約。
// テキストバッジは廃止し、全タイプ画像表示に統一。

export const cardVOFMap = new Map();

/** 全 VOF タイプの定義 */
export const VOF_DEF = {
  // ── 直接射撃 ──
  'S':     { ncm:  0, img: 'VOF - S.png',                      label: 'Small Arms'    },
  'A':     { ncm: -1, img: 'VOF - A.png',                      label: 'Automatic'     },
  'H':     { ncm: -3, img: 'VOF - H.png',                      label: 'Heavy'         },
  'P':     { ncm: +2, img: 'VOF - P.png',                      label: 'All Pinned'    },
  'S!':    { ncm: -3, img: 'VOF - S!.png',                     label: 'Sniper'        },
  // ── 爆発物（直接） ──
  'Grenade':   { ncm: -4, img: 'VOF - Grenade.png',            label: 'Grenade'       },
  'Demo':      { ncm: -5, img: 'VOF - Demo.png',               label: 'Demo Attack'   },
  'Mines':     { ncm: -3, img: 'VOF - Mines.png',              label: 'Mines'         },
  'BoobyTrap': { ncm: -4, img: 'VOF - Booby Trap -4.png',      label: 'Booby Trap'   },
  // ── 航空支援 ──
  'AirStrike':   { ncm: -7, img: 'VOF - Airstrike -7.png',     label: 'Air Strike -7' },
  'AirStrike-8': { ncm: -8, img: 'VOF - Airstrike -8.png',     label: 'Air Strike -8' },
  // ── 砲撃 HE Incoming ──
  'Incoming-3':  { ncm: -3, img: 'Fire Mission -3 Incoming.png',  label: 'HE Inc -3' },
  'Incoming-4':  { ncm: -4, img: 'Fire Mission -4 Incoming.png',  label: 'HE Inc -4' },
  'Incoming-5':  { ncm: -5, img: 'Fire Mission -5 Incoming.png',  label: 'HE Inc -5' },
  'Incoming-6':  { ncm: -6, img: 'Fire Mission -6 Incoming.png',  label: 'HE Inc -6' },
  'Incoming-7':  { ncm: -7, img: 'Fire Mission -7 Iincoming.png', label: 'HE Inc -7' }, // ファイル名 typo は意図的
  // ── 砲撃 HE Pending（NCM=0 着弾待ち、裏が Incoming）──
  'Pending-3':   { ncm: 0, img: 'VOF - -3 Incoming pending.png',  label: 'HE Pend -3' },
  'Pending-4':   { ncm: 0, img: 'VOF - -4 Incoming pending.png',  label: 'HE Pend -4' },
  'Pending-5':   { ncm: 0, img: 'VOF - -5 Incoming pending.png',  label: 'HE Pend -5' },
  'Pending-6':   { ncm: 0, img: 'VOF - -6 Incoming pending.png',  label: 'HE Pend -6' },
  'Pending-7':   { ncm: 0, img: 'VOF - -7 Incoming pending.png',  label: 'HE Pend -7' },
  // ── 砲撃 WP Incoming ──
  'WP-3': { ncm: -3, img: 'VOF - -3WP incoming.png',            label: 'WP Inc -3'   },
  'WP-4': { ncm: -4, img: 'VOF - -4WP incoming.png',            label: 'WP Inc -4'   },
  // ── 砲撃 WP Pending ──
  'Pending-WP-3': { ncm: 0, img: 'VOF - -3WP pending.png',      label: 'WP Pend -3'  },
  'Pending-WP-4': { ncm: 0, img: 'VOF - -4WP pending.png',      label: 'WP Pend -4'  },
  // ── 照明弾（NCM=0 視界効果のみ）──
  'Illum-Arty':  { ncm: 0, img: 'Marker - Illum - Artillery.png', label: 'Illum Arty' },
  'Illum-Mtr':   { ncm: 0, img: 'Marker - Illum - Mortar.png',    label: 'Illum Mtr'  },
};

/** Pending → Incoming フリップマップ */
export const VOF_FLIP = {
  'Pending-3': 'Incoming-3', 'Pending-4': 'Incoming-4',
  'Pending-5': 'Incoming-5', 'Pending-6': 'Incoming-6',
  'Pending-7': 'Incoming-7',
  'Pending-WP-3': 'WP-3', 'Pending-WP-4': 'WP-4',
};

/** 全 VOF タイプの基本 NCM 値（ncm.js との後方互換）*/
export const VOF_NCM = Object.fromEntries(
  Object.entries(VOF_DEF).map(([k, v]) => [k, v.ncm])
);

/** エリアファイア（Crossfire 不可）タイプ集合 */
export const VOF_IS_AREA = new Set([
  'Grenade', 'Demo', 'Mines', 'BoobyTrap',
  'AirStrike', 'AirStrike-8',
  'Incoming-3', 'Incoming-4', 'Incoming-5', 'Incoming-6', 'Incoming-7',
  'Pending-3',  'Pending-4',  'Pending-5',  'Pending-6',  'Pending-7',
  'WP-3', 'WP-4', 'Pending-WP-3', 'Pending-WP-4',
  'Illum-Arty', 'Illum-Mtr',
]);

/** Pending タイプか判定 */
export function isPendingVOF(type) { return type in VOF_FLIP; }

// ===== 操作関数 =====

export function setVOFType(coord, type) {
  const existing = cardVOFMap.get(coord);
  if (existing) {
    existing.type = type;
    if (VOF_IS_AREA.has(type)) existing.crossfire = false; // エリアは Crossfire 無効
  } else {
    cardVOFMap.set(coord, { type, crossfire: false, concentrate: false });
  }
  renderCardVOF(coord);
}

export function clearVOF(coord) {
  cardVOFMap.delete(coord);
  renderCardVOF(coord);
}

export function toggleCrossfire(coord) {
  const vof = cardVOFMap.get(coord);
  if (!vof || VOF_IS_AREA.has(vof.type)) return;
  vof.crossfire = !vof.crossfire;
  renderCardVOF(coord);
}

export function toggleConcentrate(coord) {
  const vof = cardVOFMap.get(coord);
  if (!vof) return;
  vof.concentrate = !vof.concentrate;
  renderCardVOF(coord);
}

/** Pending → Incoming にフリップ */
export function flipToIncoming(coord) {
  const vof = cardVOFMap.get(coord);
  if (!vof || !isPendingVOF(vof.type)) return;
  vof.type = VOF_FLIP[vof.type];
  renderCardVOF(coord);
}

export function getVOF(coord) {
  return cardVOFMap.get(coord) ?? null;
}

// ===== 描画 =====

export function renderCardVOF(coord) {
  const overlay = document.querySelector(`.terrain-card[data-coord="${coord}"] .card-overlay`);
  if (!overlay) return;

  overlay.querySelectorAll(
    '.vof-marker-img, .xfire-marker-img, .concentrate-marker-img, .vof-area-badge'
  ).forEach(el => el.remove());

  // 活動レベル再計算をトリガ（VOF の増減・変更を捕捉）
  document.dispatchEvent(new CustomEvent('board:changed'));

  const vof = cardVOFMap.get(coord);
  if (!vof) return;

  const def    = VOF_DEF[vof.type];
  const ncmVal = def?.ncm ?? 0;
  const sign   = ncmVal >= 0 ? '+' : '';

  // VOF マーカー本体
  const vofImg = document.createElement('img');
  vofImg.className = 'vof-marker-img';
  vofImg.src   = `images/${def?.img ?? 'VOF - S.png'}`;
  vofImg.title = `VOF: ${def?.label ?? vof.type}  NCM ${sign}${ncmVal}`;
  overlay.appendChild(vofImg);

  // Concentrate Fire マーカー（VOF の右隣）
  if (vof.concentrate) {
    const concImg = document.createElement('img');
    concImg.className = 'concentrate-marker-img';
    concImg.src   = 'images/VOF - Concentrate.png';
    concImg.title = 'Concentrate Fire  NCM -1';
    overlay.appendChild(concImg);
  }

  // Crossfire マーカー（Concentrate の右隣 or VOF の右隣）
  if (vof.crossfire) {
    const xfireImg = document.createElement('img');
    xfireImg.className = 'xfire-marker-img';
    xfireImg.src   = 'images/VOF - Crossfire.png';
    xfireImg.title = 'Crossfire  NCM -1';
    overlay.appendChild(xfireImg);
  }
}
