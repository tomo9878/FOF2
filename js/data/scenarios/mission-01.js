// ===== Mission 1: Trévières Offensive（トレヴィエール攻勢）=====
//
// Fields of Fire ノルマンディー・キャンペーン 第1ミッション。
//
// ▼ シナリオ定義スキーマ（全ミッション共通）
//   セットアップで確定する「視界」「練度」をここに集約する。
//   視界 → AP繰越上限/消費上限/NCM に影響
//   練度 → AP繰越上限に影響
//
// ※ 数値・部隊・勝利条件は未確定（TODO）。シナリオ1の資料を見て順次埋める。

export default {
  id: 'normandy-01',
  missionNumber: 1,
  title: { en: 'Trévières Offensive', ja: 'トレヴィエール攻勢' },
  missionType: 'offensive',      // 'offensive' | 'defensive'

  // ── セットアップ変数（AP/NCM に直結）──
  visibility: 'daylight',        // 'daylight' | 'limited'  ※TODO: 要確認（仮: 昼間）

  // ── 参加部隊と初期練度 ──
  // unitId → { experience: 'vet'|'line'|'green' }。
  // ここに書くのは「ミッション開始時の初期練度」。
  // キャンペーン開始時に campaign.js の applyScenarioExperience() で
  // 可変ストアへ投入される。以降は成長要素として書き換わり次ミッションへ引き継がれる。
  // 配置座標は当面 units-normandy.js のモック配置を流用。
  forces: {
    friendly: {
      // 例: 'US_1PLT_1SQ': { experience: 'line' },   // TODO
    },
    enemy: {
      // 例: 'GE_GR_1': { experience: 'line' },        // TODO
    },
  },

  // ── マップ構成 ──
  map: {
    rows: 3,
    cols: 4,
    deck: 'normandy',            // 使用地形デッキ
    // TODO: 固定配置カード・配置パターン・スタートエリア等
  },

  // ── 進行・勝利条件 ──
  turns: null,                   // TODO: 制限ターン数
  victory: { ja: '' },           // TODO: 勝利条件
  specialRules: [],              // TODO: 特殊ルール
};
