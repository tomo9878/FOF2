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
  specialRules: [],              // TODO: MSR本文（Counter Attack等）の全文格納は今後

  // ── シナリオ別 R# テーブル群（js/data/scenario-tables.js の汎用エンジンで解決）──
  // 出典: FoF Deluxe Normandy Campaign booklet, Mission 1 - Trévières Offensive
  tables: {

    // §3.1 友軍 上位HQイベント表（denom=10、ターン範囲2列）
    friendlyHigherHQEvents: {
      denom: 10,
      rows: [
        { key: 'situation_report',
          label: 'Situation Report',
          effect: 'CO HQ must spend its first 3 Commands to send a report to the battalion.',
          earnsXpIfCompleted: true,
          ranges: { turns_2_6: [1, 1], turns_7_10: [1, 1] } },
        { key: 'comm_trouble',
          label: 'Comm Trouble',
          effect: 'BN HQ does not Activate CO HQ this turn. CO HQ must spend its first 2 Commands to re-establish communications.',
          earnsXpIfCompleted: true,
          ranges: { turns_2_6: [2, 2], turns_7_10: [2, 2] } },
        { key: 'artillery_displacing',
          label: 'Artillery Displacing',
          effect: '15th Field Artillery Battalion is unavailable this turn.',
          ranges: { turns_2_6: [3, 3], turns_7_10: [3, 3] } },
        { key: 'checking_up',
          label: 'Checking Up',
          effect: 'Randomly select 1 higher HQ Staff and place their counter on the same card as the CO HQ. They remain on the map for 2 turns. BN HQ is now considered "on the map" (4.1.1).',
          ranges: { turns_2_6: [4, 4], turns_7_10: [4, 4] } },
        { key: 'trouble_on_the_flank',
          label: 'Trouble on the Flank',
          effect: 'No unit may move forwards to a new row (further forward than the current lead US unit) this turn.',
          ranges: { turns_2_6: [5, 5], turns_7_10: [5, 5] } },
        { key: 'company_on_flank_ahead',
          label: 'Company on the Flank is Ahead',
          effect: 'You must move at least one unit forward to a new row this turn to close the gap. (Ignore if already on Row 3).',
          earnsXpIfCompleted: true,
          ranges: { turns_2_6: [6, 6], turns_7_10: [6, 6] } },
        { key: 'battalion_screaming_for_action',
          label: 'Battalion is Screaming for Action',
          effect: 'You must move at least one unit forward to a new row with a PC marker this turn. (Ignore if already on Row 3 or no PC markers can be reached).',
          earnsXpIfCompleted: true,
          ranges: { turns_2_6: [7, 8], turns_7_10: [7, 7] } },
        { key: 'ammo_resupply',
          label: 'Ammo Resupply',
          effect: 'Place four of any one type of ammo on any card of your choice on Row 1.',
          ranges: { turns_2_6: [9, 10], turns_7_10: [8, 10] } },
      ],
    },

    // §3.1 敵 上位HQイベント表（denom=10、単一列＝ターン2-10共通）
    enemyHigherHQEvents: {
      denom: 10,
      rows: [
        { key: 'evacuate_casualties',    label: 'Evacuate Casualties',
          effect: 'Remove all on-map casualties on cards with no US troops.',
          ranges: { default: [1, 1] } },
        { key: 'displace_mortars',       label: 'Displace Mortars',
          effect: 'Remove any on-map Mortars on cards with no US troops.',
          ranges: { default: [2, 2] } },
        { key: 'displace_leaders',       label: 'Displace Leaders',
          effect: 'Remove any leaders on cards with no US troops.',
          ranges: { default: [3, 3] } },
        { key: 'displace_hmgs',          label: 'Displace HMGs',
          effect: 'Remove any on-map HMGs on cards with no US troops.',
          ranges: { default: [4, 4] } },
        { key: 'rally',                  label: 'Rally',
          effect: 'Attempt to Rally all Pinned on-map units and upgrade any Unpinned LATs.',
          ranges: { default: [5, 6] } },
        { key: 'fall_back',              label: 'Fall Back',
          effect: 'Move all Unpinned units straight back one card.',
          ranges: { default: [7, 8] } },
        { key: 'counter_attack',         label: 'Counter Attack',
          effect: 'See Mission Special Rules (MSR).',
          ranges: { default: [9, 10] } },
      ],
    },

    // §8.3 敵接触タイプ判定 — 「German Contact Packages」クロスリファレンス
    // denom=10、列は接触を成立させた PC マーカーの文字（A/B/C）。
    // '-'（出目なし）の文字には ranges にそのキーを持たせない。
    enemyContactPackages: {
      denom: 10,
      rows: [
        { packageId: 1,  ranges: { C: [1, 2] } },
        { packageId: 2,  ranges: { B: [1, 2], C: [3, 6] } },
        { packageId: 3,  ranges: { A: [1, 1], C: [7, 7] } },
        { packageId: 4,  ranges: { B: [3, 3], C: [8, 8] } },
        { packageId: 5,  ranges: { A: [2, 3], B: [4, 6], C: [9, 10] } },
        { packageId: 6,  ranges: { A: [4, 4], B: [7, 8] } },
        { packageId: 7,  ranges: { A: [5, 6] } },
        { packageId: 8,  ranges: { A: [7, 7] } },
        { packageId: 9,  ranges: { B: [9, 9] } },
        { packageId: 10, ranges: { A: [8, 8], B: [10, 10] } },
        { packageId: 11, ranges: { A: [9, 10] } },
      ],
    },

    // §8.3 敵接触タイプ判定 — Counter Attack イベント発生中は PC A の代わりにこちらを使う（MSR 1）
    enemyContactPackagesCounterAttack: {
      denom: 4,
      rows: [
        { packageId: 2,  ranges: { default: [1, 2] } },
        { packageId: 11, ranges: { default: [3, 3] } },
        { packageId: 12, ranges: { default: [4, 4] } },
      ],
    },

    // §8.3 敵パッケージ 詳細リスト（内容の説明。enemyContactPackages の packageId で参照する）
    // 出典PDFの列区分（Place/PDF-VOF?/Spotted?）は抽出時に一部曖昧なため、
    // flags は参考値。配置ロジック実装時に原文で要検証。
    enemyForcePackages: {
      notes: [
        'All squads breakdown as per the Grenadier breakdown chart.',
        'Enemy packages are limited by the counter mix. Redraw if the package drawn cannot be placed (8.3).',
        'Mortar Spotters have 2 missions and draw 4 cards for the second mission. Arty Spotters have 2 missions and draw 3 cards for the second mission.',
        'A-rated squads have 6 ammo each.',
        'Weapons teams are only capable of Transporting 6 ammo; any additional will be left behind if the unit moves.',
      ],
      rows: [
        { id: 1,  label: 'Mines!', detail: 'Plus Sniper in Basic +1 Cover on R#1/2',
          flags: { pdfVof: true, spotted: false },
          placement: 'Mines on triggering card. Sniper if drawn at max LOS/Range.',
          // R#明記あり → その比率で判定（§1.2.7）。Sniperは追加有無の2択。
          choices: [
            { key: 'sniper_added', spec: { denom: 2, rows: [
              { value: 'yes', ranges: { default: [1, 1] } },
              { value: 'no',  ranges: { default: [2, 2] } },
            ] } },
          ],
          units: [
            { name: 'Mines',  distanceSpec: 'point_blank' },
            { name: 'Sniper', distanceSpec: 'max_los_range', variantOf: 'sniper_added', whenValue: 'yes' },
          ] },
        { id: 2,  label: 'Incoming!', detail: 'Artillery –4 or Mortar –3. Spotter in Trench',
          flags: { pdfVof: true, spotted: false },
          placement: 'Incoming VOF on triggering card. Spotter at max LOS.',
          // R#明記なし＝§1.2.7の一般則で denom=2（50/50）を引く
          choices: [
            { key: 'fo_type', spec: { denom: 2, rows: [
              { value: 'artillery', ranges: { default: [1, 1] }, vofValue: -4 },
              { value: 'mortar',    ranges: { default: [2, 2] }, vofValue: -3 },
            ] } },
          ],
          units: [
            { name: 'Incoming VOF', distanceSpec: 'point_blank' },
            { name: 'Spotter',      distanceSpec: 'max_los' },
          ] },
        { id: 3,  label: 'Sniper!', detail: 'Sniper in Basic +1 Cover',
          flags: { pdfVof: true, spotted: false },
          placement: 'Max LOS/Range.',
          units: [{ name: 'Sniper', distanceSpec: 'max_los_range' }] },
        { id: 4,  label: 'Mines and HMG Nest', detail: 'Mines / HMG with 8 ammo* in Foxholes',
          flags: { pdfVof: true, spotted: true },
          placement: 'Mines on triggering card. HMG at max LOS/Range.',
          units: [
            { name: 'Mines', distanceSpec: 'point_blank' },
            { name: 'HMG',   distanceSpec: 'max_los_range' },
          ] },
        { id: 5,  label: 'MG Nest', detail: 'LMG with 6 ammo in Foxholes or HMG with 8 ammo* in Foxholes',
          flags: { pdfVof: true },
          placement: 'HMG: Max LOS/Range. LMG: R#1-2/10 - Point Blank. R#3-10/10 - Max LOS/Range.',
          // R#明記なし＝50/50でLMG/HMGどちらか一方のみが出現する（両方同時に出るわけではない）
          choices: [
            { key: 'weapon', spec: { denom: 2, rows: [
              { value: 'lmg', ranges: { default: [1, 1] } },
              { value: 'hmg', ranges: { default: [2, 2] } },
            ] } },
          ],
          units: [
            { name: 'LMG', variantOf: 'weapon', whenValue: 'lmg', spotted: false,
              distanceSpec: { denom: 10, rows: [
                { value: 'point_blank',   ranges: { default: [1, 2] } },
                { value: 'max_los_range', ranges: { default: [3, 10] } },
              ] } },
            { name: 'HMG', variantOf: 'weapon', whenValue: 'hmg', spotted: true,
              distanceSpec: 'max_los_range' },
          ] },
        { id: 6,  label: 'Strong Point', detail: "Squad in Trench / Squad in Trench. Add HMG with 8 ammo* in Bunker to one squad's card on R#1/2",
          flags: { pdfVof: true, spotted: false },
          placement: 'R#1-2/10: Both at Close Range. R#3-10/10: Both at max LOS/Range.',
          // 両ユニットとも同じ1回のR#判定を共有する（個別には引かない）
          distanceSpec: { denom: 10, rows: [
            { value: 'close',         ranges: { default: [1, 2] } },
            { value: 'max_los_range', ranges: { default: [3, 10] } },
          ] },
          // R#明記あり → HMGを追加する分隊をその比率で決める（2択）
          choices: [
            { key: 'hmg_squad', spec: { denom: 2, rows: [
              { value: 'squad1', ranges: { default: [1, 1] } },
              { value: 'squad2', ranges: { default: [2, 2] } },
            ] } },
          ],
          units: [{ name: 'Squad 1' }, { name: 'Squad 2' }] },
        { id: 7,  label: 'Defensive Position', detail: 'Squad in Trench / Squad + Leader (only if available) in Trench',
          flags: { pdfVof: true, spotted: false },
          placement: 'R#1-2/10 Both at Close Range. R#3-10/10 Both at max LOS/Range.',
          distanceSpec: { denom: 10, rows: [
            { value: 'close',         ranges: { default: [1, 2] } },
            { value: 'max_los_range', ranges: { default: [3, 10] } },
          ] },
          units: [{ name: 'Squad' }, { name: 'Squad + Leader' }] },
        { id: 8,  label: 'Pillbox', detail: 'HMG with 8 ammo* in Pillbox',
          flags: { pdfVof: true, spotted: false },
          placement: 'Max LOS/Range.',
          units: [{ name: 'HMG', distanceSpec: 'max_los_range' }] },
        { id: 9,  label: 'Mortar Team', detail: '81mm Mortar Team with 6 ammo in Foxholes',
          flags: { pdfVof: true, spotted: false },
          placement: 'Max LOS/Range.',
          units: [{ name: 'Mortar Team', distanceSpec: 'max_los_range' }] },
        { id: 10, label: 'FLAK 36 AA Gun', detail: '88mm with 6 ammo in Trench',
          flags: { pdfVof: true, spotted: true },
          placement: 'Max LOS/Range.',
          units: [{ name: 'FLAK 36', distanceSpec: 'max_los_range' }] },
        { id: 11, label: 'Patrol', detail: 'Squad infiltration attempt - CSR 6',
          flags: { pdfVof: false, spotted: true },
          placement: 'Max LOS.',
          units: [{ name: 'Patrol Squad', distanceSpec: 'max_los' }] },
        { id: 12, label: 'Base of Fire', detail: 'LMG with 6 ammo out of cover',
          flags: { pdfVof: true, spotted: true },
          placement: 'Max LOS/Range.',
          units: [{ name: 'LMG', distanceSpec: 'max_los_range' }] },
      ],
    },

    // §8.4.2 部隊配置方向表（denom=8、単一列）— 今後の配置ロジック実装時に使用
    unitPlacementDirection: {
      denom: 8,
      rows: [
        { direction: 'front',       ranges: { default: [1, 4] } },
        { direction: 'left_front',  ranges: { default: [5, 6] } },
        { direction: 'right_front', ranges: { default: [7, 8] } },
      ],
    },
  },
};
