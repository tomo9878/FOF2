// ===== Mission 5 =====
// ノルマンディー・キャンペーン 第5ミッション。
// ※ 正式名称・内容は未確定（TODO）。

export default {
  id: 'normandy-05',
  missionNumber: 5,
  title: { en: "St. Germain d'Elle - la Croix Rouge - le Soulaire Defensive", ja: 'サン＝ジェルマン＝デル〜ラ・クロワ・ルージュ〜ル・スレール防衛戦' },
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
