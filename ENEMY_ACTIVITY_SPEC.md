# §8.6 Enemy Behavior（敵活動チェック）実装仕様

## 出典
- FOF.pdf p.66-67 §8.6.1〜8.6.5（`pdftotext -layout` で原文確認）
- 判定チャート本体（Activity Check Hierarchy Tables）はルールブック本文には
  印字されておらず、別コンポーネント「Charts and Tables player aid」の実物画像
  （`images/Chart - Hierarchy - Offensive/Defensive/Pinned_LAT Deluxe 2024.png`・
  `images/Chart - Fall Back.png`）を目視で書き起こした
- Mission 1 の enemyTactics（`defensive` / `deliberate`）は
  `FoF_Deluxe_Normandy_Campaign.pdf` p.17「Enemy: Tactics: Deliberate Defense」

## 実装ファイル
- `js/data/enemy-activity.js` — 3枚の階層表データ（Pinned/LAT・Offensive・Defensive）
- `js/enemy-activity.js` — 判定エンジン（階層表選択・セクション自動判定・R#ドロー・行動適用）
- `js/enemy-activity-ui.js` — 右パネルUI（`🎯 敵活動チェック`セクション・map.htmlに追加）
- `js/data/scenarios/mission-01.js` の `enemyTactics` フィールド（新規）
- `js/data/units-normandy.js` の `GE_Leader_1/2/3` に `isLeader:true` を追加

## 設計方針

### §8.6.2 の手順とアプリの対応
1. 敵ユニットをカード単位でグルーピングし、カードの順序をランダム化
2. カード内は Pinned/LAT → Good Order → Leader の順（`buildActivityCheckQueue`）
3. 1体ずつ：
   - Pinned または LAT（Fire/Assault/Litter/Paralyzed Team）→ 常に Pinned/LAT 表
   - それ以外 → シナリオの `enemyTactics.hierarchy`（'offensive'|'defensive'）×
     `enemyTactics.column` で決まる表
4. 該当する表を上から見て最初に条件が当てはまるセクションを**自動判定**
   （`classifyUnit`）。盤面から機械的に判定できる条件（同じカードに敵がいるか・
   カバー下か・Out of Ammoか・LOSがあるか・被弾中か等）は自動、判定が難しい
   ものは人間が右パネルのセレクトで上書きできる
5. セクションが決まったら「判定する」ボタンでカードを1枚引き、R#を照合して
   行動を決定（カードを引く操作は本アプリの一貫した方針通り人間が行う）
6. 自動適用できる行動（No Action・Fall Back・除去してPC設置）はその場で盤面へ反映。
   それ以外（Rally・Grenade Attack・Concentrate Fire・浸透・Reconstitute・
   PDFシフト等）は行動名を表示するのみで、既存の人間向けUI
   （ユニット右クリックの各アクションパネル）で手動実行する前提

### 自動化した行動 / 手動に留めた行動
| 行動 | 対応 |
|---|---|
| No Action | 自動（何もしない） |
| Fall Back (8.6.3) | 自動（`planFallBack`：盤外なら Removed from Play、それ以外は自陣側優先→LOS外優先→カバー価値優先で移動先を決定し、Exposedを付与） |
| Remove unit; place PC marker | 自動（除去＋そのカードにPCマーカーが無ければ設置。既存PCがあれば追加しない。**どの文字のPCを置くかは元パッケージの追跡をしていないため、暫定的に'A'固定**——原文にも「自信が無ければR#を引いて決めてよい」とあるため簡略化として許容） |
| Move into or Seek Cover / Rally / Grenade Attack / Concentrate Fire / Infiltrate / Reconstitute Squad / Shift PDF / Move towards Casualty | **手動**：右パネルに指示だけ表示し、既存の各アクションUIで人間が実行する |

### 既知の簡略化（自動判定の精度が粗い箇所）
- 「PDF沿いに有効な目標がいるか」は、そのユニットのカードに設置されている
  PDF方向のうち**いずれか1つでも**LOSが通り敵対勢力がいれば真とする近似判定。
  本来は特定の1方向ずつ精密に追う必要があるが、VOF/PDFはカード単位で
  ユニット非帰属というアプリの既存データモデル（§7章の既知の簡略化と同根）の
  ため、方向単位の厳密な一致判定は行っていない
- Defensive表の「Under fire from a different direction」「A→/H VOFが開いたPDF」
  「Trading fire（VOFレーティング優劣比較）」の4セクションは、被弾方向の
  追跡・VOFレーティング比較のインフラが無いため**自動分類の対象外**にし、
  常に false を返す（＝これらのセクションが選ばれることは無く、より単純な
  `under_fire_nocover`/`all_other`等にフォールバックする）。人間が右パネルの
  セレクトから該当セクションを手動選択すればR#表自体は使える
- Leaderの有無は「同じカードにいる Good Order の isLeader ユニット」で判定。
  原文の「同じエリア（カバー/カバー外/建物エリア単位）かつ Visual-Verbal
  通信」までは見ていない（同カードであれば足りるとみなす簡略化）
- Litter Team関連3セクションのうち「Litter Team with Casualty in LOS」は
  チャート画像の列合計が綺麗に揃わず、書き起こしの確信度が低い
  （`js/data/enemy-activity.js` 内に `note` として明記）

### ⚠ チャートデータの確信度について
3枚の密なチャート画像を目視で書き起こしたため、特に以下のセルは要再確認：
- Defensive「同じカード・カバー下にいない」セクションの Deliberate 列
  （No Action / Grenade Attack の割り振り。合計が1マス余る）
- Defensive「PDF沿いに有効な目標」「被弾方向不一致」「Trading fire」の3セクション
- Pinned/LAT「Litter Team with Casualty in LOS」セクション

AIの挙動が明らかにおかしい（該当なしが多発する・アクションの偏りが不自然等）
場合は、該当の `images/Chart - Hierarchy - *.png` を直接見てセルの数値を
`js/data/enemy-activity.js` で修正すること。データのみの修正で済む設計にしてある。

## 未実装（今回のスコープ外）
- §8.7 Mines/Booby Traps、§8.8 Enemy Snipers、§8.9 Enemy Leaders の派生ルール
  （通信+1ドロー・Fire Team面での自動フリップ等）、§8.10 Enemy Spotters、
  §8.11 Out of Ammo の VOF強制ダウングレード、§8.12 Enemy Vehicle Movement
- 上記の「手動」行動群の自動適用（Rally/Grenade/Concentrate/Infiltrate/
  Reconstituteは既存の各システムがAP経済前提のため、敵ユニット用に
  AP不要の直接適用パスを別途作る必要がある）
- ミッション選択UIが無いため `enemyTactics` は Mission 1 固定で読んでいる
  （`enemy-activity.js` の `getHierarchyContext` 内に明記）
