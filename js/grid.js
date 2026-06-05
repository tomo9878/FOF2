import {
  unitCoordMap,
  unitStrengthMap,
} from './state.js';
import { showContextMenu, hideContextMenu } from './context-menu.js';
import { showCardContextMenu, hideCardContextMenu } from './card-context-menu.js';

// 座標ラベル（列A〜D、行1〜3）
export const COLS = ['A','B','C','D'];
export const ROWS = ['1','2','3'];

export let selectedCard = null;

// 現在のマップ配置（保存・復元用）: [{ coord, cardId, underCardId }]
export const placedCards = [];

// ===== ドラッグ&ドロップ状態 =====
let _dragUnitId = null;

// ===== ユニットスロット生成（buildGrid・動的追加共用） =====
export function createUnitSlot(u) {
  // シャローコピーして元の UNITS 定義を保護する。
  // hit.js が unit.src / unit.label を書き換えても UNITS 定義は汚染されない。
  const unit = { ...u };

  const slot = document.createElement('div');
  slot.className = 'unit-slot';
  slot.dataset.unitId  = unit.id;
  slot.dataset.faction = unit.faction || 'neutral';
  slot.dataset.type    = unit.type || ''; // 復元用（context-menu の判定にも使える）

  const uImg = document.createElement('img');
  uImg.className = 'unit-marker';
  uImg.src = unit.src;
  uImg.alt = unit.label;
  uImg.title = unit.label;
  uImg.draggable = false;
  slot.appendChild(uImg);

  // EXPOSED / PINNED オーバーレイ帯
  ['exposed', 'pinned'].forEach(key => {
    const ov = document.createElement('img');
    ov.className = 'state-overlay';
    ov.dataset.overlayUnit = unit.id;
    ov.dataset.overlayKey  = key;
    ov.src = `images/Layer_${key.toUpperCase()}_new.png`;
    slot.appendChild(ov);
  });

  const badges = document.createElement('div');
  badges.className = 'state-badges';
  badges.dataset.unit = unit.id;
  slot.appendChild(badges);

  slot.draggable = true;
  slot.addEventListener('dragstart', (e) => {
    _dragUnitId = unit.id;
    hideContextMenu();
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => slot.classList.add('dragging'));
  });
  slot.addEventListener('dragend', () => {
    slot.classList.remove('dragging');
    document.querySelectorAll('.terrain-card.drag-over').forEach(c => c.classList.remove('drag-over'));
    _dragUnitId = null;
  });

  slot.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, unit); // コピー側を渡す（hit.js の mutation がここに留まる）
  });
  slot.addEventListener('click', (e) => e.stopPropagation());

  return slot;
}

// ===== カードへ動的にユニットを追加 =====
export function addUnitToCard(coord, unitDef) {
  let layer = document.querySelector(`.unit-layer[data-coord="${coord}"]`);
  if (!layer) {
    const card = document.querySelector(`.terrain-card[data-coord="${coord}"]`);
    if (!card) return;
    const overlay = card.querySelector('.card-overlay');
    if (!overlay) return;
    layer = document.createElement('div');
    layer.className = 'unit-layer';
    layer.dataset.coord = coord;
    overlay.appendChild(layer);
  }

  unitCoordMap.set(unitDef.id, coord);
  const slot = createUnitSlot(unitDef);
  layer.appendChild(slot);
  document.dispatchEvent(new CustomEvent('board:changed')); // 活動レベル再計算
}

// ===== カードからユニットスロットを削除 =====
export function removeUnitFromCard(unitId) {
  const slot = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
  if (slot) slot.remove();
  unitCoordMap.delete(unitId);
  unitStrengthMap.delete(unitId);
  document.dispatchEvent(new CustomEvent('board:changed')); // 活動レベル再計算
}

// カードへユニットスロットを移動（ドラッグ&ドロップ完了時）
export function moveUnitToCard(unitId, newCoord) {
  const oldCoord = unitCoordMap.get(unitId);
  if (oldCoord === newCoord) return;

  let targetLayer = document.querySelector(`.unit-layer[data-coord="${newCoord}"]`);
  if (!targetLayer) {
    const card = document.querySelector(`.terrain-card[data-coord="${newCoord}"]`);
    if (!card) return;
    const overlay = card.querySelector('.card-overlay');
    if (!overlay) return;
    targetLayer = document.createElement('div');
    targetLayer.className = 'unit-layer';
    targetLayer.dataset.coord = newCoord;
    overlay.appendChild(targetLayer);
  }

  const slot = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
  if (!slot) return;
  targetLayer.appendChild(slot);
  unitCoordMap.set(unitId, newCoord);

  if (oldCoord) {
    const oldLayer = document.querySelector(`.unit-layer[data-coord="${oldCoord}"]`);
    if (oldLayer && oldLayer.children.length === 0) oldLayer.remove();
  }
  document.dispatchEvent(new CustomEvent('board:changed')); // 活動レベル再計算

  // プール（未配置部隊）が空になったらプール行を隠す → スタートエリアが最下段に
  const pool = document.getElementById('unitPool');
  if (pool && pool.children.length === 0) {
    pool.style.display = 'none';
    const pd = document.getElementById('unitPoolDivider');
    if (pd) pd.style.display = 'none';
  }
}

// ドラッグ&ドロップ受け入れハンドラを terrain-card に付与
function _addDropHandlers(cardEl, coord) {
  cardEl.addEventListener('dragover', (e) => {
    if (!_dragUnitId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    cardEl.classList.add('drag-over');
  });
  cardEl.addEventListener('dragleave', (e) => {
    if (cardEl.contains(e.relatedTarget)) return;
    cardEl.classList.remove('drag-over');
  });
  cardEl.addEventListener('drop', (e) => {
    e.preventDefault();
    cardEl.classList.remove('drag-over');
    if (!_dragUnitId) return;
    moveUnitToCard(_dragUnitId, coord);
    _dragUnitId = null;
  });
}

function selectCard(el, card, coord) {
  document.querySelectorAll('.terrain-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedCard = { card, coord };
}

// Hill カード判定（地形名 '丘' または ファイル名に Hill を含む）
function isHillCard(card) {
  return card?.name === '丘' || /Hill/i.test(card?.file ?? '');
}

// 列番号 → 列レターの配列（cols 個ぶん A,B,C,...）
function _colLetters(cols) {
  return Array.from({ length: cols }, (_, i) => String.fromCharCode(65 + i));
}

// 内部実装（placed 配列確定後）
// placed: [{ card, underCard }] の配列（underCard は Hill の下に重ねる地形、無ければ null）
function _buildGridWithPlaced(placed, units, markers, rows, cols) {
  const grid = document.getElementById('cardGrid');
  grid.innerHTML = '';

  const colLetters = _colLetters(cols);

  // グリッドのレイアウトを rows/cols に合わせて設定（テレイン rows 行 + 区切り 64px + スタートエリア 1行）
  grid.style.gridTemplateColumns = `repeat(${cols}, 210px)`;
  grid.style.gridTemplateRows    = `repeat(${rows}, 276px) 64px 276px`;

  // マップ配置の記録をリセット（保存・復元用）
  placedCards.length = 0;

  placed.forEach((cell, i) => {
    const card = cell.card;
    const col = colLetters[i % cols];
    const row = String(Math.floor(i / cols) + 1);
    const coord = col + row;

    // 配置を記録
    placedCards.push({ coord, cardId: card.id, underCardId: cell.underCard?.id ?? null });

    const div = document.createElement('div');
    div.className = 'terrain-card';
    div.dataset.coord = coord;
    div.dataset.cardId = card.id;
    div.title = cell.underCard
      ? `${coord}: ${card.id} ${card.name}（下: ${cell.underCard.id} ${cell.underCard.name}）`
      : `${coord}: ${card.id} ${card.name}`;

    // Hill 本体は通常エリア（セルの正規位置）に置く
    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = `images/${card.file}`;
    img.alt = card.name;
    div.appendChild(img);

    // Hill の場合、2枚目を斜め右上にずらして上（前面）に重ねる
    if (cell.underCard) {
      div.classList.add('has-hill');
      const overImg = document.createElement('img');
      overImg.className = 'card-img card-img-over';
      overImg.src = `images/${cell.underCard.file}`;
      overImg.alt = cell.underCard.name;
      div.appendChild(overImg);
    }

    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';

    const coordLabel = document.createElement('div');
    coordLabel.className = 'card-coord';
    coordLabel.textContent = coord;
    overlay.appendChild(coordLabel);

    // VOF/PCマーカー
    if (markers[coord] === 'vof') {
      const vof = document.createElement('div');
      vof.className = 'vof-marker';
      vof.textContent = '2';
      overlay.appendChild(vof);
    } else if (markers[coord] === 'pc') {
      const pc = document.createElement('div');
      pc.className = 'pc-marker';
      pc.textContent = 'PC';
      overlay.appendChild(pc);
    }

    // ユニットマーカー
    if (units[coord]) {
      const unitLayer = document.createElement('div');
      unitLayer.className = 'unit-layer';
      unitLayer.dataset.coord = coord;
      units[coord].forEach(u => {
        unitCoordMap.set(u.id, coord);
        unitLayer.appendChild(createUnitSlot(u));
      });
      overlay.appendChild(unitLayer);
    }

    div.appendChild(overlay);

    div.addEventListener('click', () => selectCard(div, card, coord));
    div.addEventListener('contextmenu', (e) => {
      // unit-slot の contextmenu は stopPropagation 済みなので
      // ここに来るのはカード地面への右クリックのみ
      e.preventDefault();
      e.stopPropagation();
      hideContextMenu();
      showCardContextMenu(e, coord);
    });
    _addDropHandlers(div, coord);
    grid.appendChild(div);
  });

  // ===== スタートエリア行（テレイン行の次の行）=====
  const stagingRowNum = rows + 1;          // 座標の行番号
  const dividerRow    = rows + 1;           // グリッド上の区切り行
  const stagingRow    = rows + 2;           // グリッド上のスタートエリア行

  const divider = document.createElement('div');
  divider.className = 'staging-row-divider';
  divider.style.gridRow = dividerRow;
  divider.textContent = 'スタートエリア';
  grid.appendChild(divider);

  colLetters.forEach((col) => {
    const coord = col + stagingRowNum;

    const div = document.createElement('div');
    div.className = 'terrain-card staging-area';
    div.style.gridRow = stagingRow;
    div.dataset.coord = coord;
    div.dataset.cardId = 'STAGING';
    div.title = `${coord}: スタートエリア`;

    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = 'images/Vol3 - Card - Staging Area 01.png';
    img.alt = 'スタートエリア';
    div.appendChild(img);

    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';

    const coordLabel = document.createElement('div');
    coordLabel.className = 'card-coord';
    coordLabel.textContent = coord;
    overlay.appendChild(coordLabel);

    div.appendChild(overlay);
    div.addEventListener('click', () => selectCard(div, { id: 'STAGING', name: 'スタートエリア' }, coord));
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideContextMenu();
      showCardContextMenu(e, coord);
    });
    _addDropHandlers(div, coord);
    grid.appendChild(div);
  });
}

// buildGrid は (terrainCards, units, markers, shuffle, opts) を受け取る。
// opts.rows / opts.cols でシナリオ指定の縦横枚数に並べる。
// Hill カードが出たら、デッキからもう1枚引いて下にずらして重ねる（丘の段差表現）。
export function buildGrid(terrainCards, units, markers, shuffle, opts = {}) {
  const rows = opts.rows ?? 3;
  const cols = opts.cols ?? 4;

  let placed;
  if (opts.placed) {
    // 保存された固定配置から復元（cardId / underCardId → カード定義）
    const byId = id => terrainCards.find(c => c.id === id) ?? null;
    placed = opts.placed.map(p => ({
      card:      byId(p.cardId),
      underCard: p.underCardId ? byId(p.underCardId) : null,
    }));
  } else {
    // 通常: シャッフルして配置（Hill が出たらもう1枚重ねる）
    const deck = shuffle(terrainCards);
    let di = 0;
    placed = [];
    for (let i = 0; i < rows * cols; i++) {
      const card = deck[di++] ?? null;
      const cell = { card, underCard: null };
      if (card && isHillCard(card) && di < deck.length) {
        cell.underCard = deck[di++];
      }
      placed.push(cell);
    }
  }

  _buildGridWithPlaced(placed, units, markers, rows, cols);
}

// ===== 未配置部隊プール（スタートエリアの下）=====
// 駒を並べ、ドラッグでスタートエリア/盤面へ配置する。
// プール内の駒は unitCoordMap に登録しない（盤外）。配置時に moveUnitToCard で登録される。
export function buildUnitPool(unitDefs, rows) {
  const grid = document.getElementById('cardGrid');
  if (!grid) return;

  // 既存プールを除去
  document.getElementById('unitPool')?.remove();
  document.getElementById('unitPoolDivider')?.remove();
  if (!unitDefs || unitDefs.length === 0) return;

  // プール用に2行追加（区切り + プール本体）
  grid.style.gridTemplateRows = `repeat(${rows}, 276px) 64px 276px 40px auto`;

  const divider = document.createElement('div');
  divider.id = 'unitPoolDivider';
  divider.className = 'staging-row-divider';
  divider.style.gridRow = String(rows + 3);
  divider.textContent = '未配置部隊（ドラッグでスタートエリアへ）';
  grid.appendChild(divider);

  const pool = document.createElement('div');
  pool.id = 'unitPool';
  pool.className = 'unit-pool';
  pool.style.gridRow    = String(rows + 4);
  pool.style.gridColumn = '1 / -1';
  unitDefs.forEach(def => {
    pool.appendChild(createUnitSlot(def)); // coordMap 未登録 = 盤外
  });
  grid.appendChild(pool);
}
