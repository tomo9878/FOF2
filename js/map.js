import { TERRAIN_CARDS, ACTION_CARDS, shuffle } from './data/cards.js';
import { UNITS, MARKERS } from './data/units-normandy.js';
import { buildGrid } from './grid.js';
import { initZoom, calcFitZoom, applyZoom, changeZoom, setZoom, resetZoom } from './zoom.js';
import { hideContextMenu, clearAllUnitStatesCM } from './context-menu.js';
import { initCardContextMenu, hideCardContextMenu } from './card-context-menu.js';

// ===== window へ公開（HTML の onclick から呼ぶため） =====
window.changeZoom = changeZoom;
window.setZoom = setZoom;
window.resetZoom = resetZoom;
window.clearAllUnitStatesCM = clearAllUnitStatesCM;

// ===== アクションカード =====
let actionDeck = shuffle(ACTION_CARDS);
let deckIdx = 0;

function drawCard() {
  if (deckIdx >= actionDeck.length) { deckIdx = 0; actionDeck = shuffle(ACTION_CARDS); }
  const c = actionDeck[deckIdx++];
  document.getElementById('drawnCardImg').src = `images/${c.file}`;
  document.getElementById('statActivated').textContent = c.activated;
  document.getElementById('statInitiative').textContent = c.initiative;
  document.getElementById('statType').textContent = c.type;

  // カード枚数更新
  document.querySelector('.footer-right .btn').innerHTML =
    `カード山 残り <span style="color:#e8d87a">${50 - deckIdx}</span>`;
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
buildGrid(TERRAIN_CARDS, UNITS, MARKERS, shuffle);
initCardContextMenu();
initZoom();

// 画面フィットズームで開始→中央スクロール
setTimeout(() => {
  const fit = calcFitZoom();
  applyZoom(fit);
  const area = document.getElementById('mapArea');
  area.scrollLeft = (area.scrollWidth - area.clientWidth) / 2;
  area.scrollTop  = (area.scrollHeight - area.clientHeight) / 2;
}, 80);
