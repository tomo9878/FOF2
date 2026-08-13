---
name: scaffold-mission
description: >
  FoF_Deluxe_Normandy_Campaign.pdf の指定ミッション章からデータを抽出し、
  mission-01.js と同じスキーマで js/data/scenarios/mission-0X.js の
  forces/map/pcPlacement/tables 等を埋める。「ミッション2を実装して」
  「Mission3のデータ入れて」等の依頼で発動する。
argument-hint: ミッション番号（2〜7）
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Edit
---

# scaffold-mission

`js/data/scenarios/mission-01.js` で確立した構造を型として、他ミッション（現状2〜7はTODOの
スケルトンのみ）にキャンペーンPDFのデータを機械的に流し込む。

## 前提: mission-01.js のスキーマ（このまま踏襲する）

```js
export default {
  id, missionNumber, title:{en,ja}, missionType,   // 'offensive'|'defensive'
  visibility,                                        // 'daylight'|'limited'
  forces: { friendly: { unitId:{experience} }, enemy: { unitId:{experience} } },
  map: { rows, cols, deck },
  pcPlacement: { 行番号: 'A'|'B'|'C' },               // §8.2.1
  turns, reattempts,
  victory: { ja, en },
  specialRules: [],                                  // MSR本文（自由記述、TODO可）
  tables: {
    friendlyHigherHQEvents: { denom, rows:[{key,label,effect,earnsXpIfCompleted?,ranges:{turns_X_Y:[lo,hi],...}}] },
    enemyHigherHQEvents:    { denom, rows:[{key,label,effect,ranges:{default:[lo,hi]}}] },
    enemyContactPackages:   { denom, rows:[{packageId, ranges:{A?:[lo,hi],B?:[lo,hi],C?:[lo,hi]}}] }, // German Contact Packages
    enemyContactPackagesCounterAttack: { denom, rows:[...] },  // MSRでCounter Attack時に使う代替表（あれば）
    enemyForcePackages: {
      notes: [...],  // 脚注（A-rated squad ammo等）
      rows: [{ id, label, detail, flags:{pdfVof,spotted}, placement,
                choices?: [{key, spec:{denom,rows:[{value,ranges}]}}],   // LMG/HMG等の追加ランダム判定
                units: [{name, distanceSpec, variantOf?, whenValue?}] }],
    },
    unitPlacementDirection: { denom, rows:[{direction:'front'|'left_front'|'right_front', ranges:{default:[lo,hi]}}] },
  },
};
```

## 手順

1. **PDFテキストの用意**
   - scratchpadに `campaign_text.txt` が既にあれば流用。無ければ
     `fitz` で `FoF_Deluxe_Normandy_Campaign.pdf` 全ページを `get_text()` して保存する。

2. **対象ミッション章の特定**
   - `Grep` で `Mission {番号}[:\-]` や章タイトルを検索し、次のミッション章の見出しまでの範囲を対象にする。

3. **基本情報の抽出**
   - Situation欄: Type（Offensive/Defensive）, Duration（Turns）, Visibility
   - Map: 列×行（"N columns by M rows"）
   - Attempts: reattempts可否
   - Mission Objective: victory.ja/en
   - Tactical Controls: LOD/LOA等（`specialRules`か別途参考情報として、無理に構造化しない）
   - Potential Contact Placement: 行→A/B/C の対応 → `pcPlacement`
   - Enemy: Tactics/Experience/Historical Enemy → `forces.enemy` の練度・部隊構成の参考にする
     （ユニット定義自体は `units-normandy.js` 参照。未定義の敵ユニットがあれば追加を検討し、
     ユーザーに確認する）

4. **friendly forces**
   - 基本的に9th Infantry Regimentの中隊編成はミッション間で共通（Company Table of Organization）。
     Mission1の `forces.friendly` を土台にし、Additional Attachments欄（Arty FO/Mtr FO/HMGチーム等）が
     あれば追加する。

5. **tables の抽出**（`js/data/scenario-tables.js` の汎用フォーマットに合わせる）
   - **Friendly/Enemy Higher HQ Events**: 表の行ごとに `key`（英語イベント名をsnake_case化）・`label`・
     `effect`（英語原文ママでよい）・R#範囲を転記。Turns区分がある場合は `ranges` のキーを
     `turns_X_Y` 形式にする。
   - **German Contact Packages**（PC文字別クロスリファレンス）: `#`列→`packageId`、
     PC A/B/C列のR#範囲→`ranges.A`/`B`/`C`（"-"の列はrangesにキー自体を作らない）。
   - **Enemy Force Packages**（詳細リスト）: パッケージごとに `label`/`detail`/`placement`を転記し、
     "or"で書かれた選択（LMG or HMG等）があれば `choices` を追加する（**先に verify-rule で
     R#が明記されているか確認**。明記なしなら denom=2 の50/50、明記ありならその比率）。
   - **Unit Placement**（方向表）: front/left_front/right_frontのR#範囲。

6. **書き込み**
   - `Edit` で `mission-0X.js` の該当TODO部分を実データに置き換える。フィールド名・入れ子構造は
     mission-01.js と完全に一致させる（scenario-tables.js の汎用エンジンがこの形を前提にしている）。

7. **ドキュメント同期**
   - ROADMAP.md の「2.1 シナリオ選択」「Mission1固定」等の記述に、対象ミッションが投入済みになった
     旨を追記する。roadmap.html も同様に更新する。

## 注意事項

- ユニット未定義（`units-normandy.js` に無い敵/装備）が出てきたら、勝手に定義を追加せずユーザーに確認する。
- MSR（Mission Special Rules）本文は無理に構造化せず、`specialRules` に自由記述で残すか、
  Combat Patrol等の特殊ルールで挙動が変わる場合のみ個別に相談する。
- データ転記後は必ず `verify-rule` の手順6（ドキュメント同期）を実行する。
