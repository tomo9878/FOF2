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

// ===== ドラッグ&ドロップ状態 =====
let _dragUnitId = null;

// ===== ユニットスロット生成（buildGrid・動的追加共用） =====
export function createUnitSlot(u) {
  const slot = document.createElement('div');
  slot.className = 'unit-slot';
  slot.dataset.unitId  = u.id;
  slot.dataset.faction = u.faction || 'neutral';

  const uImg = document.createElement('img');
  uImg.className = 'unit-marker';
  uImg.src = u.src;
  uImg.alt = u.label;
  uImg.title = u.label;
  uImg.draggable = false;
  slot.appendChild(uImg);

  // EXPOSED / PINNED オーバーレイ帯
  ['exposed', 'pinned'].forEach(key => {
    const ov = document.createElement('img');
    ov.className = 'state-overlay';
    ov.dataset.overlayUnit = u.id;
    ov.dataset.overlayKey  = key;
    ov.src = `images/Layer_${key.toUpperCase()}_new.png`;
    slot.appendChild(ov);
  });

  const badges = document.createElement('div');
  badges.className = 'state-badges';
  badges.dataset.unit = u.id;
  slot.appendChild(badges);

  slot.draggable = true;
  slot.addEventListener('dragstart', (e) => {
    _dragUnitId = u.id;
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
    showContextMenu(e, u);
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
}

// ===== カードからユニットスロットを削除 =====
export function removeUnitFromCard(unitId) {
  const slot = document.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
  if (slot) slot.remove();
  unitCoordMap.delete(unitId);
  unitStrengthMap.delete(unitId);
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

// 内部実装（placed 配列確定後）
function _buildGridWithPlaced(placed, units, markers) {
  const grid = document.getElementById('cardGrid');
  grid.innerHTML = '';

  placed.forEach((card, i) => {
    const col = COLS[i % 4];
    const row = ROWS[Math.floor(i / 4)];
    const coord = col + row;

    const div = document.createElement('div');
    div.className = 'terrain-card';
    div.dataset.coord = coord;
    div.dataset.cardId = card.id;
    div.title = `${coord}: ${card.id} ${card.name}`;

    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = `images/${card.file}`;
    img.alt = card.name;
    div.appendChild(img);

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

  // ===== スタートエリア行（行4）=====
  const divider = document.createElement('div');
  divider.className = 'staging-row-divider';
  divider.textContent = 'スタートエリア';
  grid.appendChild(divider);

  COLS.forEach((col) => {
    const coord = col + '4';

    const div = document.createElement('div');
    div.className = 'terrain-card staging-area';
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

// buildGrid は (terrainCards, units, markers) を引数で受け取る
// shuffle 関数も引数で受け取る（map.js から渡す）
export function buildGrid(terrainCards, units, markers, shuffle) {
  const placed = shuffle(terrainCards).slice(0, 12);
  _buildGridWithPlaced(placed, units, markers);
}
