// ===== Mission 3 =====
// ノルマンディー・キャンペーン 第3ミッション。
// ※ 正式名称・内容は未確定（TODO）。

export default {
  id: 'normandy-03',
  missionNumber: 3,
  title: { en: "St. Georges d'Elle - le Parc Defensive", ja: 'サン＝ジョルジュ＝デル〜ル・パルク防衛戦' },
  missionType: 'defensive',            // 'offensive' | 'defensive'

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
