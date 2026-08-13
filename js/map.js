import { TERRAIN_CARDS, shuffle } from './data/cards.js';
import { UNITS, MARKERS } from './data/units-normandy.js'; // 初期配置は後日（現在マップのみ生成）
import { buildGrid, buildUnitPool } from './grid.js';
import { getScenario } from './data/scenarios/index.js';
import { initContactLevel } from './contact.js';
import { placePC } from './pc.js';
import { applyScenarioExperience } from './campaign.js';
import { setVisibility } from './ncm.js';
import { restoreFromSave, save, clearStorage, resetPlay } from './persistence.js';
import { initZoom, calcFitZoom, applyZoom, changeZoom, setZoom, resetZoom, INITIAL_ZOOM } from './zoom.js';
import { hideContextMenu, clearAllUnitStatesCM, initContextMenu } from './context-menu.js';
import { initCardContextMenu, hideCardContextMenu } from './card-context-menu.js';
import { drawActionCard, getDeckCount } from './deck.js';
import {
  resetImpulseFlags, resolveBNHQImpulse, getBNHQStatus, setBNHQStatus,
  BN_HQ_STATUS_LABELS, resolveGeneralInitiative, getSinglePlatoonMission,
  applyScenarioCommandSettings, getCurrentAP, changeCurrentAP,
  getCommandsDrawn, setCommandsDrawn, GENERAL_INIT_UNIT_ID,
} from './command.js';

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
  // クリーンアップ（§3.8）で全HQの起動・取得済みフラグを落とす（保有コマンドは残す）
  if (PHASES[phaseIdx] === 'クリーンアップ') {
    resetImpulseFlags();
    syncGeneralInitPanel();
    document.dispatchEvent(new CustomEvent('board:changed'));
  }
}
window.nextPhase = nextPhase;

// ===== BN HQ インパルス（§3.3.1a / §4.1.1）=====
// カードは引かない。盤外・通信可なら CO HQ を自動起動、盤上なら最大コマンドを付与する。
function initBNHQPanel() {
  const sel  = document.getElementById('bnHQStatus');
  const btn  = document.getElementById('bnHQResolveBtn');
  const note = document.getElementById('bnHQNote');
  if (!sel || !btn) return;

  sel.innerHTML = Object.entries(BN_HQ_STATUS_LABELS)
    .map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
  sel.value = getBNHQStatus();

  sel.addEventListener('change', () => {
    setBNHQStatus(sel.value);
    document.dispatchEvent(new CustomEvent('board:changed'));
  });

  btn.addEventListener('click', () => {
    const r = resolveBNHQImpulse();
    const extra = r.activatedCOHQ.length ? `（${r.activatedCOHQ.join(', ')} を起動）` : '';
    note.textContent = r.note + extra;
    document.dispatchEvent(new CustomEvent('board:changed'));
  });
}

/** 復元・リセット後に BN HQ パネルの表示を状態へ合わせ直す */
function syncBNHQPanel() {
  const sel  = document.getElementById('bnHQStatus');
  const note = document.getElementById('bnHQNote');
  if (sel)  sel.value = getBNHQStatus();
  if (note) note.textContent = '起動セグメントの最初に実行する（カードは引かない）';
  syncGeneralInitPanel();
}

// ===== General Initiative インパルス（§3.3.2d）=====
// カードは人間が引く。星アイコンの数字をそのまま（単一小隊ミッションなら半分・切り捨て）。
function initGeneralInitPanel() {
  const draw = document.getElementById('giDraw');
  if (!draw) return;

  const refresh = () => {
    const v = document.getElementById('giVal');
    if (v) v.textContent = getCurrentAP(GENERAL_INIT_UNIT_ID);
  };

  document.getElementById('giMinus')?.addEventListener('click', () => {
    changeCurrentAP(GENERAL_INIT_UNIT_ID, -1);   // 命令1つ分を人間が消費
    refresh();
    document.dispatchEvent(new CustomEvent('board:changed'));
  });
  document.getElementById('giPlus')?.addEventListener('click', () => {
    changeCurrentAP(GENERAL_INIT_UNIT_ID, +1);   // 手動補正
    refresh();
    document.dispatchEvent(new CustomEvent('board:changed'));
  });

  draw.addEventListener('click', () => {
    if (getCommandsDrawn(GENERAL_INIT_UNIT_ID)) return;
    const card = drawActionCard();
    const r = resolveGeneralInitiative(card.initiative);
    changeCurrentAP(GENERAL_INIT_UNIT_ID, r.total);
    setCommandsDrawn(GENERAL_INIT_UNIT_ID, true);
    refresh();
    const half = r.halved ? ` ÷2(単一小隊)` : '';
    draw.textContent = `カード #${card.number} ★${r.base}${half} → +${r.total}`;
    draw.disabled = true;
    document.dispatchEvent(new CustomEvent('board:changed'));
  });

  syncGeneralInitPanel();
}

/** General Initiative パネルの表示を状態へ合わせ直す */
function syncGeneralInitPanel() {
  const val  = document.getElementById('giVal');
  const draw = document.getElementById('giDraw');
  const note = document.getElementById('giNote');
  if (val)  val.textContent = getCurrentAP(GENERAL_INIT_UNIT_ID);
  if (draw) {
    const done = getCommandsDrawn(GENERAL_INIT_UNIT_ID);
    draw.disabled = done;
    draw.textContent = done ? '✔ このターン取得済み' : '🃏 カードを引いて General Initiative';
  }
  if (note) {
    note.textContent = getSinglePlatoonMission()
      ? 'イニシアチブセグメントの最後に実行する（単一小隊ミッション＝半分・切り捨て）'
      : 'イニシアチブセグメントの最後に実行する';
  }
}

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
const scenario = getScenario(1);
applyScenarioCommandSettings(scenario);   // 単一小隊ミッションか（General Initiative 半減の判定用）

function findUnitDef(unitId) {
  for (const arr of Object.values(UNITS)) {
    const u = arr.find(x => x.id === unitId);
    if (u) return u;
  }
  return null;
}

// 保存があれば復元、なければシナリオから新規初期化
const restored = restoreFromSave(scenario);
if (!restored) {
  buildGrid(TERRAIN_CARDS, {}, {}, shuffle, { rows: scenario.map.rows, cols: scenario.map.cols });
  applyScenarioExperience(scenario);                          // 初期練度を投入
  setVisibility(scenario.visibility === 'limited' ? 1 : 0);   // シナリオ視界

  // シナリオの PC 配置（各行の全カードに letter side）
  for (const [row, letter] of Object.entries(scenario.pcPlacement ?? {})) {
    for (let c = 0; c < scenario.map.cols; c++) {
      placePC(String.fromCharCode(65 + c) + row, letter, true);
    }
  }

  // 未配置部隊プール：シナリオ友軍をスタートエリア下に並べる
  const friendlyDefs = Object.keys(scenario.forces?.friendly ?? {})
    .map(findUnitDef).filter(Boolean);
  buildUnitPool(friendlyDefs, scenario.map.rows);

  save(); // 初回スナップショット
}

initContactLevel();   // 活動レベルの購読開始＋初回算出
document.addEventListener('board:changed', save);  // 盤面変更のたび自動保存

// リセット（HTML ボタンから呼ぶ）
window.resetPlayState = () => { resetPlay(scenario); syncBNHQPanel(); }; // プレイ状態だけ初期化（駒は残す）
window.newGame        = () => { clearStorage(); location.reload(); };  // 全初期化
initContextMenu();
initCardContextMenu();
initBNHQPanel();
initGeneralInitPanel();
initZoom();

// 初期ズームを固定倍率で開始→中央スクロール
setTimeout(() => {
  applyZoom(INITIAL_ZOOM);
  const area = document.getElementById('mapArea');
  area.scrollLeft = (area.scrollWidth - area.clientWidth) / 2;
  area.scrollTop  = (area.scrollHeight - area.clientHeight) / 2;
}, 80);
