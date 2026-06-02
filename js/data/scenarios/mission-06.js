// ===== Mission 6 =====
// ノルマンディー・キャンペーン 第6ミッション。
// ※ 正式名称・内容は未確定（TODO）。

export default {
  id: 'normandy-06',
  missionNumber: 6,
  title: { en: 'Vire Offensive', ja: 'ヴィール攻勢' },
  missionType: 'offensive',            // 'offensive' | 'defensive'

  visibility: 'daylight',              // 'daylight' | 'limited'  ※TODO

  forces: {
    friendly: {},                      // TODO
    enemy: {},                         // TODO
  },

  map: {
    rows: 3,
    cols: 4,
    deck: 'normandy',
  },

  turns: null,                         // TODO
  victory: { ja: '' },                 // TODO
  specialRules: [],                    // TODO
};
