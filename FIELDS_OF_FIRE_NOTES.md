# Fields of Fire デジタル化メモ

> 作業ディレクトリ: `C:\Users\7600144\ミニ作業\`
> 最終更新: 2026-05-15

---

## ゲーム概要

**Fields of Fire**（GMT Games）はソロプレイのカード駆動型ウォーゲーム。  
WW2ノルマンディー・ベトナム等のシナリオで米軍小隊〜中隊レベルの戦闘を再現する。

**カード駆動の核心**: 1枚のカードが複数の用途に使われる
- コマンド数の決定（AP付与）
- 戦闘解決（命中判定）
- 地形（マップタイル）
- イベント判定（HQアイコン）
- カバー探索（枚数）
- 敵活動チェック

---

## 完成済みJSONファイル

### 1. `cards.json` — アクションカード（A01〜A50）

**構造:**
```json
{
  "metadata": {
    "deck": "Action Cards",
    "card_back": "Card - Keep Up The Fire.jpg"
  },
  "cards": [
    {
      "card_number": 1,
      "activated_commands": 4,
      "initiative_commands": 2,
      "type": "Contact",
      "action_attempt": {
        "icons": ["spot_concentrate", "grenade"],
        "at": 0
      },
      "combat_resolution": {
        "-4": "MISS", "-3": "MISS", "-2": "MISS", "-1": "MISS",
        "0": "MISS", "+1": "MISS", "+2": "HIT", "+3": "HIT",
        "+4": "HIT", "+5": "HIT", "+6": "HIT"
      },
      "hit_effect": {
        "vet": "A",
        "line": "B",
        "green": "C"
      }
    }
  ]
}
```

**フィールド説明:**

| フィールド | 説明 |
|-----------|------|
| `activated_commands` | CO HQに指名されたときのAP数 |
| `initiative_commands` | 自発起動したときのAP数 |
| `type` | "Contact" / "Cover" / "Rally" |
| `action_attempt.icons` | アクション試行アイコン一覧 |
| `action_attempt.at` | AT値（対戦車戦闘用） |
| `combat_resolution` | "-4"〜"+6" の各値でMISS/HIT/他 |
| `hit_effect` | 練度(vet/line/green)別の命中効果 |

**action_attempt iconsの種類:**
- `spot_concentrate` / `infiltrate` / `grenade`
- `call_for_fire` / `call_for_fire_battalion`
- `hq` / `jam` / `short`

---

### 2. `terrain_cards.json` — ノルマンディー地形カード（N01〜N55）

**構造:**
```json
{
  "metadata": {
    "campaign": "Normandy",
    "card_back": "Card Back - Normandy.jpg"
  },
  "cards": [
    {
      "card_id": "N01",
      "terrain_type": "Hill",
      "defense_value_blocked": 0,
      "defense_value_open": null,
      "elevation": 1,
      "explosion_modifier": null,
      "no_indirect_fire": false,
      "cover_positions": null,
      "cover_draw": null,
      "slow": false,
      "multi_story": false,
      "special": "place_card_on_top",
      "los": {
        "top": false, "top_right": false, "right": false, "bottom_right": false,
        "bottom": false, "bottom_left": false, "left": false, "top_left": false
      }
    }
  ]
}
```

**フィールド説明:**

| フィールド | 説明 |
|-----------|------|
| `defense_value_blocked` | LOSが切れている方角から攻撃された時の防御値（大きい方） |
| `defense_value_open` | LOSが通っている方角から攻撃された時の防御値（小さい方） |
| `elevation` | 標高（丘=1、その他=0） |
| `explosion_modifier` | 爆発攻撃への修正値（-1=樹木で弱まる、+1=泥炭で増幅） |
| `no_indirect_fire` | true=間接射撃不可 |
| `cover_positions` | カバーできる部隊数 |
| `cover_draw` | カバー探索時に引くカード枚数 |
| `slow` | true=車両の移動力低下 |
| `multi_story` | true=多層建築（上階から観測可能） |
| `special` | 特殊ルール文字列 |
| `los` | 8方向のLOS（true=通る、false=遮断） |

**防御値のルール:**
- 全方向緑枠（LOS遮断）→ `defense_value_blocked`のみ、`defense_value_open: null`
- 白枠方向あり（LOS通過）→ 両方の値を持つ（blocked > open）
- 全方向白枠（Open Fields等）→ `defense_value_blocked: null`、`defense_value_open`のみ

**カード別内訳:**

| カード | 地形 | 防御値 | 特徴 |
|--------|------|--------|------|
| N01〜N06 | Hill | 0 | elevation=1, place_card_on_top |
| N07〜N08 | Marsh | 1 | explosion+1, 間接射撃不可 |
| N09〜N16 | Orchard/Grove | 1 | explosion-1 |
| N17〜N24 | Woods | 2 | explosion-1, 間接射撃不可 |
| N25〜N26 | Hedgerow/Bocage | 2 | slow, 全LOS遮断 |
| N27〜N36 | Hedgerow/Bocage | 2/1 | slow, 方向別LOS（下記参照） |
| N37〜N40 | Village | 3 | slow, 全LOS遮断, multi_story混在 |
| N41〜N44 | Open Fields | 0 | 全LOS開放 |
| N45〜N46 | Gully/Draw | 2/1 | 間接射撃不可, LOS上下 |
| N47〜N48 | Gully/Draw | 2/1 | 間接射撃不可, LOS左右 |
| N49〜N52 | Farm | 2 | slow |
| N53 | Farm | 2 | slow, multi_story |
| N54 | Church | 3 | slow, multi_story, observation_post |
| N55 | Cemetery | 1 | slow, 全LOS開放 |

**Hedgerow/Bocage LOS詳細（N27〜N36）:**

| カード | LOS通る方向 |
|--------|------------|
| N27, N28 | right, left |
| N29, N30 | right, bottom_right, bottom |
| N31, N32 | left, bottom_left, bottom |
| N33, N34 | top, bottom |
| N35, N36 | right, bottom_right, bottom, bottom_left, left |

**Village multi_story:**

| カード | multi_story |
|--------|------------|
| N37 | true |
| N38 | false |
| N39 | true |
| N40 | false |

---

## ゲームシステム理解

### ターン構造

12ターン制。各ターンで以下の8フェーズを順に実行：

```
1. Friendly Higher HQ Event Phase
2. Enemy Activity Phase (Defensives)
3. Friendly Command Phase          ← メインフェーズ
4. Enemy Activity Phase (Offensives/Patrols)
5. Mutual Capture & Retreat Phase
6. AT Combat & Vehicle Movement Phase
7. Mutual Combat Phase
8. Clean Up Phase
```

### コマンドフェーズ（3.3）の詳細

APの流れ：

```
CO HQ
 └→ 起動する小隊を選ぶ（Activation）
     └→ カード引く → card.activated_commands = 小隊長のAP
         └→ APを使って分隊に命令を出す
             └→ 残りAPはSave可能（上限あり）

起動されなかった小隊（Initiative）
 └→ カード引く → card.initiative_commands = 小隊長のAP
     └→ General Initiative分を加算（Saveは不可）
```

**AP Save上限は練度×視界条件で変わる（Command Display参照）**

### ユニット管理（デジタル設計方針）

物理ボードのマーカー模倣はせず、**値そのものをデータとして持つ**方針：

```json
{
  "unit_id": "plt_1",
  "type": "PLT_HQ",
  "experience": "line",
  "ap": 3,
  "ap_saved": 1,
  "activated": false,
  "skills": [
    { "name": "smoke", "qty": 1 },
    { "name": "signal_red", "qty": 1 }
  ],
  "equipment": ["radio_company"],
  "squads": ["1_1", "2_1", "3_1"]
}
```

### 部隊構成

```
中隊
├── CO HQ（指揮官）
├── XO（副官）
├── 1st SGT（先任軍曹）
├── 1st PLT HQ → 分隊 1/1, 2/1, 3/1
├── 2nd PLT HQ → 分隊 1/2, 2/2, 3/2
├── 3rd PLT HQ → 分隊 1/3, 2/3, 3/3
├── MTR SEC（迫撃砲）
├── HMG PLT（重機関銃）
└── Tank PLT（戦車）※シナリオ依存
```

分隊番号の読み方: `分隊番号/小隊番号`（例: 2/1 = 第1小隊の第2分隊）

---

## 画像ファイル一覧

| ファイル | 内容 |
|---------|------|
| `images/A01.jpg` 〜 `A50.jpg` | アクションカード |
| `images/N01 Hill.jpg` 〜 `N55 Cemetery.jpg` | ノルマンディー地形カード |
| `images/Card - Keep Up The Fire.jpg` | アクションカード裏面 |
| `images/Card Back - Normandy.jpg` | ノルマンディー地形カード裏面 |
| `images/Card Back - Vietnam.jpg` | ベトナム地形カード裏面（未着手） |
| `images/Vol3 - Player Aid - Sequence of Play - Deluxe.png` | プレイ順序サマリー |

---

## 今後の作業

- [ ] `game_state.json` の設計・実装
- [ ] ユニット定義JSON（`units.json`）の作成
- [ ] ゲームエンジンのロジック実装
- [ ] ベトナムキャンペーン地形カードのJSON化
- [ ] コマンドフェーズのAP Save上限テーブルのJSON化

---

## 設計メモ・決定事項

- **LOSは8方向**（top/top_right/right/bottom_right/bottom/bottom_left/left/top_left）
- **白枠=LOS通る(true)、緑枠=LOS遮断(false)**
- **防御値2つある場合**：遮断側が大きい値、開放側が小さい値
- **丘の防御値は0**：実際は上にカードを重ねてその地形の防御値を使うため
- **Slowは車両専用**：歩兵には影響しない（デジタルでは車両実装時まで無視でOK）
- **action_attempt iconsは有るものだけ配列に入れる**（無いものは含めない）
- **JSON構造**: `{ metadata: {...}, cards: [...] }` の形式で統一
