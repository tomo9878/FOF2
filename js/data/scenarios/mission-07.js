// ===== Mission 7 =====
// ノルマンディー・キャンペーン 第7ミッション（最終）。
// ※ 正式名称・内容は未確定（TODO）。

export default {
  id: 'normandy-07',
  missionNumber: 7,
  title: { en: 'Tinchebray Offensive', ja: 'タンシュブレー攻勢' },
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
