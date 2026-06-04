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
  visibility: 'daylight',        // 'daylight' | 'limited'（確定: Daylight +0）

  // ── 参加部隊と初期練度 ──
  // unitId → { experience: 'vet'|'line'|'green' }。
  // ここに書くのは「ミッション開始時の初期練度」。
  // キャンペーン開始時に campaign.js の applyScenarioExperience() で
  // 可変ストアへ投入される。以降は成長要素として書き換わり次ミッションへ引き継がれる。
  // 配置座標は当面 units-normandy.js のモック配置を流用。
  // 練度パターン: HQ系・XO=Green / 先任曹長=Veteran / 戦闘部隊=Line / 敵擲弾兵=Line
  forces: {
    friendly: {
      US_CO_HQ:    { experience: 'green' },
      US_CO_XO:    { experience: 'green' },
      US_CO_1SGT:  { experience: 'vet'   },   // 古参の先任曹長
      US_1PLT_HQ:  { experience: 'green' },
      US_2PLT_HQ:  { experience: 'green' },
      US_3PLT_HQ:  { experience: 'green' },
      US_1PLT_1SQ: { experience: 'line'  },
      US_2PLT_1SQ: { experience: 'line'  },
      US_3PLT_1SQ: { experience: 'line'  },
      US_2PLT_W1:  { experience: 'line'  },   // LMG
      US_HMG50:    { experience: 'line'  },
      US_LMG_1:    { experience: 'line'  },
      US_LMG_2:    { experience: 'line'  },
      US_AT_1:     { experience: 'line'  },
      US_AT_2:     { experience: 'line'  },
      US_AT_3:     { experience: 'line'  },
      // 60mm 迫撃砲は「班(Section)でまとめる」か「3チームに分割」を選択できる（CSR2）。
      // 現状モックは3チーム形態。班としてまとめる場合は別途 Section ユニットを定義し line を振る。
      US_MTR60_1:  { experience: 'line'  },
      US_MTR60_2:  { experience: 'line'  },
      US_MTR60_3:  { experience: 'line'  },
      // ※ Arty FO（砲兵前進観測員, Line）は Additional Attachments。ユニット未定義のため後日追加。
    },
    enemy: {
      // 敵: 352nd Division 擲弾兵分隊（ランダムドロー）。FJ は Mission 2 以降。
      GE_GR_1: { experience: 'line' },
      GE_GR_2: { experience: 'line' },
      GE_GR_3: { experience: 'line' },
      GE_GR_4: { experience: 'line' },
    },
  },

  // ── マップ構成 ──
  map: {
    rows: 3,
    cols: 4,
    deck: 'normandy',            // 使用地形デッキ
    // TODO: 固定配置カード・配置パターン・スタートエリア等
  },

  // ── PC（Potential Contact）配置（§8.2.1）──
  // 各行の全カードに指定文字のPCマーカーを letter side（表）で配置する。
  // 行番号 → 文字（A=最severe / C=最穏やか）
  pcPlacement: { 1: 'C', 2: 'A', 3: 'B' },

  // ── 進行・勝利条件 ──
  turns: 10,                     // 10 Turns
  reattempts: 1,                 // 1回まで再挑戦可（ルール 3.9）
  victory: {
    ja: 'Primary／Secondary Objective を確保し、Row 1・2 を制圧する',
    en: 'Secure the Primary and Secondary Objectives and Clear Rows 1 and 2.',
  },
  specialRules: [],              // TODO: PC配置・火力支援・HQイベント表は対応機能の実装後に追加
};
