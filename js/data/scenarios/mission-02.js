// ===== Mission 2 =====
// ノルマンディー・キャンペーン 第2ミッション。
// ※ 正式名称・内容は未確定（TODO）。

export default {
  id: 'normandy-02',
  missionNumber: 2,
  title: { en: 'Cerisy Offensive', ja: 'スリジー攻勢' },
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
