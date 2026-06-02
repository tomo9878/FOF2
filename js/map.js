import { TERRAIN_CARDS, shuffle } from './data/cards.js';
import { UNITS, MARKERS } from './data/units-normandy.js'; // 初期配置は後日（現在マップのみ生成）
import { buildGrid } from './grid.js';
import { getScenario } from './data/scenarios/index.js';
import { initZoom, calcFitZoom, applyZoom, changeZoom, setZoom, resetZoom } from './zoom.js';
import { hideContextMenu, clearAllUnitStatesCM, initContextMenu } from './context-menu.js';
import { initCardContextMenu, hideCardContextMenu } from './card-context-menu.js';
import { drawActionCard, getDeckCount } from './deck.js';

// ===== window へ公開（HTML の onclick から呼ぶため） =====
window.changeZoom = changeZoom;
window.setZoom = setZoom;
window.resetZoom = resetZoom;
window.clearAllUnitStatesCM = clearAllUnitStatesCM;

// ===== アクションカード（UIボタン用） =====
// デッキ管理は deck.js に移管。ここは UI 更新のみ担当。

function drawCard() {
  const c = drawActionCard();
  document.getElementById('drawnCardImg').src = `images/${c.file}`;
  document.getElementById('statActivated').textContent = c.activated;
  document.getElementById('statInitiative').textContent = c.initiative;
  document.getElementById('statType').textContent = c.type;

  // カード枚数更新
  document.getElementById('deckCountBtn').innerHTML =
    `山残り <span style="color:#e8d87a">${getDeckCount()}</span>`;
}
window.drawCard = drawCard;

// ===== フェーズ =====
const PHASES = ['友軍上位HQイベント','敵活動（防衛）','友軍コマンド','敵活動（攻撃）','相互捕虜・退却','AT・車両移動','相互戦闘','クリーンアップ'];
let phaseIdx = 2;
function nextPhase() {
  phaseIdx = (phaseIdx + 1) % PHASES.length;
  document.querySelector('.phase-indicator').textContent = '▶ ' + PHASES[phaseIdx];
}
window.nextPhase = nextPhase;

// ===== ブラウザ標準右クリックを全面抑制（キャプチャフェーズ最優先） =====
document.addEventListener('contextmenu', (e) => e.preventDefault(), true);

// 外クリックで閉じる（ユニットメニュー）
document.addEventListener('click', (e) => {
  const menu = document.getElementById('contextMenu');
  if (menu.style.display !== 'none' && !menu.contains(e.target)) {
    hideContextMenu();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideContextMenu();
});

// ===== 初期化 =====
// マップ生成: シナリオ指定の rows×cols で地形カードを配置（Hill は下にもう1枚重ねる）。
// ユニット/マーカーの初期配置は後日実装するため、現在は空で生成する。
const scenario = getScenario(1);
buildGrid(TERRAIN_CARDS, {}, {}, shuffle, { rows: scenario.map.rows, cols: scenario.map.cols });
initContextMenu();
initCardContextMenu();
initZoom();

// 初期ズーム 115% で開始→中央スクロール
setTimeout(() => {
  applyZoom(1.15);
  const area = document.getElementById('mapArea');
  area.scrollLeft = (area.scrollWidth - area.clientWidth) / 2;
  area.scrollTop  = (area.scrollHeight - area.clientHeight) / 2;
}, 80);
