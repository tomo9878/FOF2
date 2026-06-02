// モック用のユニット配置
export const UNITS = {
  'A1': [
    {
      id: 'US_1PLT_1SQ', type: 'squad', faction: 'friendly',
      src: 'images/2nd_1-1.png', srcReduced: 'images/2nd_1-1b.png',
      label: '第1小隊 第1分隊',
      fireteam:   { id:'US_1PLT_1SQ_FT', src:'images/LAT_Fire Team-W.png',    label:'第1分隊 ファイアチーム',  type:'lat', faction:'friendly' },
      assaultteam:{ id:'US_1PLT_1SQ_AT', src:'images/LAT_Assault Team-W.png', label:'第1分隊 突撃チーム',      type:'lat', faction:'friendly' },
    }
  ],
  'B2': [
    {
      id: 'US_2PLT_1SQ', type: 'squad', faction: 'friendly',
      src: 'images/2nd_2-1.png', srcReduced: 'images/2nd_2-1b.png',
      label: '第2小隊 第1分隊',
      fireteam:   { id:'US_2PLT_1SQ_FT', src:'images/LAT_Fire Team-W.png',    label:'第2分隊 ファイアチーム', type:'lat', faction:'friendly' },
      assaultteam:{ id:'US_2PLT_1SQ_AT', src:'images/LAT_Assault Team-W.png', label:'第2分隊 突撃チーム',     type:'lat', faction:'friendly' },
    },
    {
      id: 'US_2PLT_W1', type: 'weapon_team', faction: 'friendly',
      src: 'images/Weapon_2-W-1.png',
      label: '第2小隊 武器チーム1（LMG）',
    }
  ],
  'C1': [
    {
      id: 'US_3PLT_1SQ', type: 'squad', faction: 'friendly',
      src: 'images/2nd_3-1.png', srcReduced: 'images/2nd_3-1b.png',
      label: '第3小隊 第1分隊',
      fireteam:   { id:'US_3PLT_1SQ_FT', src:'images/LAT_Fire Team-W.png',    label:'第3分隊 ファイアチーム', type:'lat', faction:'friendly' },
      assaultteam:{ id:'US_3PLT_1SQ_AT', src:'images/LAT_Assault Team-W.png', label:'第3分隊 突撃チーム',     type:'lat', faction:'friendly' },
    }
  ],
  // ── named Fire Team 持ちユニット（namedFireTeam: true）──
  // Hit: A / Hit: F 受けた時、除去せず Pin のみ（B面 = Fire Team面 が裏にある）
  'A2': [
    { id:'US_CO_HQ',    type:'weapon_team', faction:'friendly', namedFireTeam:true, commandRole:'co_hq',
      src:'images/HQ_04-CO.png',       srcReduced:'images/HQ_04-COb.png',      label:'CO HQ' },
    { id:'US_CO_XO',    type:'weapon_team', faction:'friendly', namedFireTeam:true, commandRole:'co_staff',
      src:'images/HQ_05-XO.png',       srcReduced:'images/HQ_05-XOb.png',      label:'CO XO' },
    { id:'US_CO_1SGT',  type:'weapon_team', faction:'friendly', namedFireTeam:true, commandRole:'co_staff',
      src:'images/HQ_06-1SGT.png',     srcReduced:'images/HQ_06-1SGTb.png',    label:'CO 1st SGT' },
  ],
  'B1': [
    { id:'US_RUNNER_1', type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/1_Runner-N-K.png',   srcReduced:'images/1_Runner-N-Kb.png',  label:'Runner (1)' },
    { id:'US_RUNNER_2', type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/2_Runner-N-K.png',   srcReduced:'images/2_Runner-N-Kb.png',  label:'Runner (2)' },
  ],
  'A3': [
    { id:'US_1PLT_HQ',  type:'weapon_team', faction:'friendly', namedFireTeam:true, commandRole:'plt_hq',
      src:'images/HQ_07-1PLT.png',     srcReduced:'images/HQ_07-1PLTb.png',    label:'1st PLT HQ' },
    { id:'US_2PLT_HQ',  type:'weapon_team', faction:'friendly', namedFireTeam:true, commandRole:'plt_hq',
      src:'images/HQ_08-2PLT.png',     srcReduced:'images/HQ_08-2PLTb.png',    label:'2nd PLT HQ' },
    { id:'US_3PLT_HQ',  type:'weapon_team', faction:'friendly', namedFireTeam:true, commandRole:'plt_hq',
      src:'images/HQ_09-3PLT.png',     srcReduced:'images/HQ_09-3PLTb.png',    label:'3rd PLT HQ' },
  ],
  'C2': [
    { id:'US_HMG50',    type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/US HMG 50cal.png',   srcReduced:'images/Weapon_HMG50-1b.png', label:'.50 cal HMG' },
    { id:'US_LMG_1',    type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/Weapon_LMG-1.png',   srcReduced:'images/Weapon_LMG-1b.png',  label:'1/LMG (30 cal)' },
    { id:'US_LMG_2',    type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/Weapon_LMG-2.png',   srcReduced:'images/Weapon_LMG-2b.png',  label:'2/LMG (30 cal)' },
  ],
  'D1': [
    { id:'US_AT_1',     type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/Weapon_AT-1.png',    srcReduced:'images/Weapon_AT-1b.png',   label:'1/AT (Bazooka)' },
    { id:'US_AT_2',     type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/Weapon_AT-2.png',    srcReduced:'images/Weapon_AT-2b.png',   label:'2/AT (Bazooka)' },
    { id:'US_AT_3',     type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/Weapon_AT-3.png',    srcReduced:'images/Weapon_AT-3b.png',   label:'3/AT (Bazooka)' },
  ],
  'D2': [
    { id:'US_MTR60_1',  type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/1_Mtr 60mm.png',     srcReduced:'images/1_Mtr 60mm b.png',  label:'1/60mm Tm' },
    { id:'US_MTR60_2',  type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/2_Mtr 60mm.png',     srcReduced:'images/2_Mtr 60mm b.png',  label:'2/60mm Tm' },
    { id:'US_MTR60_3',  type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/3_Mtr 60mm.png',     srcReduced:'images/3_Mtr 60mm b.png',  label:'3/60mm Tm' },
  ],

  // ──────────────────────────────────────────────────────────────────────────────
  // ドイツ軍ユニット（ノルマンディーキャンペーン）
  // Hit / Pin / Exposed はアメリカ軍と同一ロジック（faction:'german' のみ異なる）
  // LAT画像はドイツ軍専用を使用：
  //   ・歩兵分隊 (GR)  … fireteam: GE_LAT_Fireteam_SC  / assaultteam: GE_LAT_Assault Team
  //   ・落下傘猟兵(FJ)  … fireteam: GE_LAT_Fireteam_ASC / assaultteam: GE_LAT_Assault Team_FG42
  // ──────────────────────────────────────────────────────────────────────────────

  // ── Heer Grenadier 分隊（擲弾兵）──
  'B3': [
    {
      id: 'GE_GR_1', type: 'squad', faction: 'german',
      src: 'images/GE_GR_1Gp.png', srcReduced: 'images/GE_GR_1Gp b.png',
      label: '擲弾兵 第1分隊',
      fireteam:    { id:'GE_GR_1_FT', src:'images/GE_LAT_Fireteam_SC.png',        label:'GR ファイアチーム',  type:'lat', faction:'german' },
      assaultteam: { id:'GE_GR_1_AT', src:'images/GE_LAT_Assault Team.png',        label:'GR 突撃チーム',      type:'lat', faction:'german' },
    },
    {
      id: 'GE_GR_2', type: 'squad', faction: 'german',
      src: 'images/GE_GR_2Gp.png', srcReduced: 'images/GE_GR_2Gp b.png',
      label: '擲弾兵 第2分隊',
      fireteam:    { id:'GE_GR_2_FT', src:'images/GE_LAT_Fireteam_SC.png',        label:'GR ファイアチーム',  type:'lat', faction:'german' },
      assaultteam: { id:'GE_GR_2_AT', src:'images/GE_LAT_Assault Team.png',        label:'GR 突撃チーム',      type:'lat', faction:'german' },
    },
    {
      id: 'GE_GR_3', type: 'squad', faction: 'german',
      src: 'images/GE_GR_3Gp.png', srcReduced: 'images/GE_GR_3Gp b.png',
      label: '擲弾兵 第3分隊',
      fireteam:    { id:'GE_GR_3_FT', src:'images/GE_LAT_Fireteam_SC.png',        label:'GR ファイアチーム',  type:'lat', faction:'german' },
      assaultteam: { id:'GE_GR_3_AT', src:'images/GE_LAT_Assault Team.png',        label:'GR 突撃チーム',      type:'lat', faction:'german' },
    },
    {
      id: 'GE_GR_4', type: 'squad', faction: 'german',
      src: 'images/GE_GR_4Gp.png', srcReduced: 'images/GE_GR_4Gp b.png',
      label: '擲弾兵 第4分隊',
      fireteam:    { id:'GE_GR_4_FT', src:'images/GE_LAT_Fireteam_SC.png',        label:'GR ファイアチーム',  type:'lat', faction:'german' },
      assaultteam: { id:'GE_GR_4_AT', src:'images/GE_LAT_Assault Team.png',        label:'GR 突撃チーム',      type:'lat', faction:'german' },
    },
  ],

  // ── Fallschirmjäger 分隊（落下傘猟兵）──
  'C3': [
    {
      id: 'GE_FJ_1', type: 'squad', faction: 'german',
      src: 'images/GE_FJ_1Gp.png', srcReduced: 'images/GE_FJ_1Gp b.png',
      label: '落下傘猟兵 第1分隊',
      fireteam:    { id:'GE_FJ_1_FT', src:'images/GE_LAT_Fireteam_ASC.png',       label:'FJ ファイアチーム',  type:'lat', faction:'german' },
      assaultteam: { id:'GE_FJ_1_AT', src:'images/GE_LAT_Assault Team_FG42.png',  label:'FJ 突撃チーム(FG42)',type:'lat', faction:'german' },
    },
    {
      id: 'GE_FJ_2', type: 'squad', faction: 'german',
      src: 'images/GE_FJ_2Gp.png', srcReduced: 'images/GE_FJ_2Gp b.png',
      label: '落下傘猟兵 第2分隊',
      fireteam:    { id:'GE_FJ_2_FT', src:'images/GE_LAT_Fireteam_ASC.png',       label:'FJ ファイアチーム',  type:'lat', faction:'german' },
      assaultteam: { id:'GE_FJ_2_AT', src:'images/GE_LAT_Assault Team_FG42.png',  label:'FJ 突撃チーム(FG42)',type:'lat', faction:'german' },
    },
    {
      id: 'GE_FJ_3', type: 'squad', faction: 'german',
      src: 'images/GE_FJ_3Gp.png', srcReduced: 'images/GE_FJ_3Gp b.png',
      label: '落下傘猟兵 第3分隊',
      fireteam:    { id:'GE_FJ_3_FT', src:'images/GE_LAT_Fireteam_ASC.png',       label:'FJ ファイアチーム',  type:'lat', faction:'german' },
      assaultteam: { id:'GE_FJ_3_AT', src:'images/GE_LAT_Assault Team_FG42.png',  label:'FJ 突撃チーム(FG42)',type:'lat', faction:'german' },
    },
    {
      id: 'GE_FJ_4', type: 'squad', faction: 'german',
      src: 'images/GE_FJ_4Gp.png', srcReduced: 'images/GE_FJ_4Gp b.png',
      label: '落下傘猟兵 第4分隊',
      fireteam:    { id:'GE_FJ_4_FT', src:'images/GE_LAT_Fireteam_ASC.png',       label:'FJ ファイアチーム',  type:'lat', faction:'german' },
      assaultteam: { id:'GE_FJ_4_AT', src:'images/GE_LAT_Assault Team_FG42.png',  label:'FJ 突撃チーム(FG42)',type:'lat', faction:'german' },
    },
    {
      id: 'GE_FJ_5', type: 'squad', faction: 'german',
      src: 'images/GE_FJ_5Gp.png', srcReduced: 'images/GE_FJ_5Gp b.png',
      label: '落下傘猟兵 第5分隊',
      fireteam:    { id:'GE_FJ_5_FT', src:'images/GE_LAT_Fireteam_ASC.png',       label:'FJ ファイアチーム',  type:'lat', faction:'german' },
      assaultteam: { id:'GE_FJ_5_AT', src:'images/GE_LAT_Assault Team_FG42.png',  label:'FJ 突撃チーム(FG42)',type:'lat', faction:'german' },
    },
    {
      id: 'GE_FJ_6', type: 'squad', faction: 'german',
      src: 'images/GE_FJ_6Gp.png', srcReduced: 'images/GE_FJ_6Gp b.png',
      label: '落下傘猟兵 第6分隊',
      fireteam:    { id:'GE_FJ_6_FT', src:'images/GE_LAT_Fireteam_ASC.png',       label:'FJ ファイアチーム',  type:'lat', faction:'german' },
      assaultteam: { id:'GE_FJ_6_AT', src:'images/GE_LAT_Assault Team_FG42.png',  label:'FJ 突撃チーム(FG42)',type:'lat', faction:'german' },
    },
  ],

  // ── ドイツ軍 支援ユニット（namedFireTeam:true）──
  // Hit: A / F → Pin のみ（B面 = Fire Team 面）/ Hit: L/P/C → 除去 ＋ LAT
  'D3': [
    { id:'GE_Leader_1', type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_Leader-1.png',    srcReduced:'images/GE_Leader-1b.png',  label:'ドイツ軍指揮官 1' },
    { id:'GE_Leader_2', type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_Leader-2.png',    srcReduced:'images/GE_Leader-2b.png',  label:'ドイツ軍指揮官 2' },
    { id:'GE_Leader_3', type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_Leader-3.png',    srcReduced:'images/GE_Leader-3b.png',  label:'ドイツ軍指揮官 3' },
    { id:'GE_LMG_1',   type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_LMG_1.png',       srcReduced:'images/GE_LMG_1 b.png',   label:'LMG チーム 1' },
    { id:'GE_LMG_2',   type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_LMG_2.png',       srcReduced:'images/GE_LMG_2 b.png',   label:'LMG チーム 2' },
    { id:'GE_LMG_3',   type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_LMG_3.png',       srcReduced:'images/GE_LMG_3 b.png',   label:'LMG チーム 3' },
    { id:'GE_LMG_4',   type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_LMG_4.png',       srcReduced:'images/GE_LMG_4 b.png',   label:'LMG チーム 4' },
    { id:'GE_LMG_5',   type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_LMG_5.png',       srcReduced:'images/GE_LMG_5 b.png',   label:'LMG チーム 5' },
    { id:'GE_HMG_3',   type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_HMG_3.png',       srcReduced:'images/GE_HMG_3 b.png',   label:'HMG チーム 3' },
    { id:'GE_HMG_4',   type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_HMG_4.png',       srcReduced:'images/GE_HMG_4 b.png',   label:'HMG チーム 4' },
    { id:'GE_PzSchrk_1', type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_PzSchrk 1.png',   srcReduced:'images/GE_PzSchrk 1 b.png', label:'パンツァーシュレック 1' },
    { id:'GE_Mtr81_1', type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_81mm Mtr 1.png',  srcReduced:'images/GE_81mm Mtr 1 b.png', label:'81mm 迫撃砲 1' },
    { id:'GE_AT75_1',  type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_75mmAT 1.png',    srcReduced:'images/GE_75mmAT 1 b.png', label:'75mm 対戦車砲 1' },
    { id:'GE_IG75_2',  type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_75mmIG 2.png',    srcReduced:'images/GE_75mmIG 1 b.png', label:'75mm 歩兵砲' },
    { id:'GE_Spotter_Mtr2', type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_Spotter_Mtr2.png', srcReduced:'images/GE_Spotter_Mtr1 b.png', label:'迫撃砲スポッター 1' },
    { id:'GE_Spotter_Arty1', type:'weapon_team', faction:'german', namedFireTeam:true,
      src:'images/GE_Spotter_Arty1.png', srcReduced:'images/GE_Spotter_Arty2 b.png', label:'砲兵スポッター 1' },
  ],
};

// モック用マーカー
export const MARKERS = {
  'B2': 'vof',
  'D3': 'pc',
};
