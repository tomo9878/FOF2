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
    { id:'US_CO_HQ',    type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/HQ_04-CO.png',       srcReduced:'images/HQ_04-COb.png',      label:'CO HQ' },
    { id:'US_CO_XO',    type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/HQ_05-XO.png',       srcReduced:'images/HQ_05-XOb.png',      label:'CO XO' },
    { id:'US_CO_1SGT',  type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/HQ_06-1SGT.png',     srcReduced:'images/HQ_06-1SGTb.png',    label:'CO 1st SGT' },
  ],
  'B1': [
    { id:'US_RUNNER_1', type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/1_Runner-N-K.png',   srcReduced:'images/1_Runner-N-Kb.png',  label:'Runner (1)' },
    { id:'US_RUNNER_2', type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/2_Runner-N-K.png',   srcReduced:'images/2_Runner-N-Kb.png',  label:'Runner (2)' },
  ],
  'A3': [
    { id:'US_1PLT_HQ',  type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/HQ_07-1PLT.png',     srcReduced:'images/HQ_07-1PLTb.png',    label:'1st PLT HQ' },
    { id:'US_2PLT_HQ',  type:'weapon_team', faction:'friendly', namedFireTeam:true,
      src:'images/HQ_08-2PLT.png',     srcReduced:'images/HQ_08-2PLTb.png',    label:'2nd PLT HQ' },
    { id:'US_3PLT_HQ',  type:'weapon_team', faction:'friendly', namedFireTeam:true,
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

  // ──────────────────────────────────────────────────────────
  // 敵ユニット（北朝鮮軍・北ベトナム軍等、faction を変えるだけで使い回し可）
  // src / srcReduced は実際の画像パスに差し替えること
  // ──────────────────────────────────────────────────────────
  'B3': [
    {
      id: 'NK_1SQ', type: 'squad', faction: 'nk',
      src: 'images/NK_squad_A.png', srcReduced: 'images/NK_squad_B.png',
      label: '北朝鮮軍 第1分隊',
      fireteam:    { id:'NK_1SQ_FT', src:'images/LAT_Fire Team-W.png',    label:'北朝鮮 ファイアチーム', type:'lat', faction:'nk' },
      assaultteam: { id:'NK_1SQ_AT', src:'images/LAT_Assault Team-W.png', label:'北朝鮮 突撃チーム',     type:'lat', faction:'nk' },
    },
    {
      id: 'NK_1WPN', type: 'weapon_team', faction: 'nk',
      src: 'images/NK_weapon_A.png', srcReduced: 'images/NK_weapon_B.png',
      label: '北朝鮮軍 武器チーム',
    },
  ],
  'C3': [
    {
      id: 'NVA_1SQ', type: 'squad', faction: 'nva',
      src: 'images/NVA_squad_A.png', srcReduced: 'images/NVA_squad_B.png',
      label: '北ベトナム軍 第1分隊',
      fireteam:    { id:'NVA_1SQ_FT', src:'images/LAT_Fire Team-W.png',    label:'NVA ファイアチーム', type:'lat', faction:'nva' },
      assaultteam: { id:'NVA_1SQ_AT', src:'images/LAT_Assault Team-W.png', label:'NVA 突撃チーム',     type:'lat', faction:'nva' },
    },
  ],
};

// モック用マーカー
export const MARKERS = {
  'B2': 'vof',
  'D3': 'pc',
};
