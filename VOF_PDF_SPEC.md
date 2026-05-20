# VOF / PDF ルール理解メモ（改訂版）

> 作成: 2026-05-20 / 改訂: 2026-05-20  
> 出典: buildFile.xml（VASSALモジュール）＋ ユーザーによるルールブック確認済み情報

---

## 用語整理

| 略語 | 正式名称 | 意味 |
|------|---------|------|
| VOF | Volume of Fire | 地形カードに置かれる「火力マーカー」。そのカードに向けられた火力の強度を示す |
| PDF | **Primary Direction of Fire** | 「どの方向からVOFが飛んできているか」を示す**方向矢印マーカー**。プレイヤーの能動操作ではない |
| NCM | Net Combat Modifier | 命中判定時の最終修正値（マイナスほど命中しやすく強力） |

---

## VOF マーカー種類と NCM（命中修正値）

VOFは「攻撃側の火力の強さ」を示すマーカー。  
**数値が低い（マイナス）ほど強力**。防御側の地形値と合算してNCMを算出する。

| 記号 | 画像ファイル | 名称 | NCM修正値 | 備考 |
|------|------------|------|:---------:|------|
| **S** | `VOF - S.png` | Small Arms | **+0** | 小火器（ライフル等） |
| **A** | `VOF - A.png` | Automatic Weapons | **−1** | 自動火器（LMG等） |
| **H** | `VOF - H.png` | Heavy Weapons | **−3** | 重火器（HMG・迫撃砲・砲） |
| **P** | `VOF - P.png` | All Pinned | **+2** | **攻撃側が全員PINNED状態**の火力（最弱）。対象が自動Pinnedになるわけではない ⚠️ |
| **S!** | `VOF - S!.png` | Sniper | **−3** | 狙撃兵。対象カード全体に通常S（+0）も同時に適用 |

> ⚠️ **重要な誤解訂正:**  
> `VOF - P.png` は「対象を全員Pinnedにする最強マーカー」**ではない**。  
> 「射撃している側が全員Pinned状態（＝火力が激減している）」ことを示すマーカーで、NCM **+2** の最弱火力。

### 特殊修正マーカー（基本VOFへの追加ペナルティ）

| 記号 | 画像ファイル | 効果 | 発生条件 |
|------|------------|------|---------|
| **Xfire** | `VOF - Crossfire.png` | カード全体に **−1** 追加 | 2方向以上からPDFが同一カードに入った時、**自動配置** |
| **Conc** | `VOF - Concentrate.png` | 特定ユニット1体に **−1** 追加（複数スタック可） | AP消費＋カードドロー成功（Crosshairsアイコン）で配置 |
| **Gren** | `VOF - Grenade.png` | 特殊ルールで処理 | 個別ルール参照 |
| G! / M! / F! 等 | 各種 | 特殊攻撃（地雷・火炎放射器等） | 個別ルール参照 |

### Circled VOFバリアント

`Circled -1` / `Circled -2` / `Circled -4` → 火力支援時の追加NCM修正値。

---

## PDF（Primary Direction of Fire）

### 概要

PDFは「火力が**どの方向から来ているか**」を示す**矢印マーカー**。  
プレイヤーが能動的に撃つ場所を選ぶものでは**なく**、ユニットが敵を発見して射撃した際に自動的に配置される。

### 特徴（VASSALより）

- 画像: `VOF - PDF.png`（Single矢印）/ `VOF - PDF - flip.png`（Dual両矢印）
- **8方向**に配置可能（Top / Top-Right / Right / Bottom-Right / Bottom / Bottom-Left / Left / Top-Left）
- **Single / Dual の違い:**  
  - **Dual（両矢印）** = 互いに撃ち合っている（Reciprocal PDF）状態  
  - マップの煩雑さを減らすためのUI上の工夫であり、**ゲーム上の特殊効果はない**

### 配置ルール

- PDFは**置くだけでPinチェックは発動しない**
- 戦闘解決は後述の Combat Effects Segment でまとめて行われる
- 複数方向からPDFが同一カードに向かう → **Crossfireマーカーが自動配置**される

---

## VOF の発生メカニズム

### ① 自動発生（APコスト不要）

ユニットが次の条件を満たすと、**AP（コマンド）消費なしに自動的に**射撃してVOFとPDFが配置される：

1. 射程内に敵ユニットが存在する
2. LOS（視線）が通っている
3. 対象ユニットがSpotted（発見済み）状態である

配置されるVOFタイプはユニットの基本武装による（小火器=S、自動火器=A、重火器=H）。

### ② AP消費が必要な特殊アクション

以下は自動発生ではなく、APを消費してカードドローが必要：

| アクション | 内容 |
|-----------|------|
| **Concentrate Fire** | Crosshairsアイコン成功 → Concマーカー配置（特定ユニットに−1追加） |
| **Grenade Attack** | 手榴弾投擲（射程1カード？） |
| **Fire Mission** | 砲撃・空爆の要請（FO経由） |

---

## 戦闘解決フロー（Combat Effects Segment / フェーズ7）

VOFが置かれても**即座に判定はしない**。フェーズ7の Combat Effects Segment でまとめて解決する。

### NCM の算出

```
NCM = 最高のVOF値（例: A=-1）
    + 地形防御値（例: 森=+2）
    + 追加修正（Crossfire=-1, Concentrate=-1 等）
```

### 命中判定（Hit Check）

```
各歩兵ユニットに対して個別に判定：
  1. アクションカードを1枚引く
  2. NCM値でカード左端の表を参照
  3. 結果に応じて処理：
     MISS → 何も起きない
     PIN  → Pinnedマーカーを置く
     HIT  → さらにカードを1枚引いてHit Effect適用
               （ユニット熟練度 × Hit Effect表 → Casualty / Pinned 等）
```

---

## VOF / PDF の更新・除去タイミング

### 即時更新（フェーズ問わず）

以下の状況変化が起きたら**その時点で即座**にVOF/PDFを見直し・更新・除去する：

- ユニットが移動した
- 煙幕などでLOSが遮断された
- 対象ユニットが全滅した
- 射撃側ユニットがPinnedなどで射撃不能になった

### Clean Up Phase（フェーズ8）で除去するもの

| マーカー | 除去タイミング |
|---------|--------------|
| Concentrate Fire | Clean Up Phase |
| Grenade Miss / Demo Miss | Clean Up Phase |
| 煙幕、照明弾 | Clean Up Phase |
| 基本VOF（S/A/H等） | **交戦継続中は次ターンに持ち越し**。状況変化時は即時更新 |

---

## Fire Mission（火力支援）の解決フロー

```
ターンN:
  FO（観測手）が通信成功
  → 対象カードに "Pending Fire Mission" マーカー配置

ターンN+1の Mutual Combat Phase 開始時（Fire Mission Update Segment）:
  → Pendingマーカーを裏返し "Active（Incoming! / Air Strike!）" 状態に変化

ターンN+1の Combat Effects Segment:
  → Active状態の強力なVOF（NCM: -3〜-7等）が適用される
```

---

## 現在の実装状態と今後の対応

### 実装済み（表示のみ）

| 機能 | コード |
|------|------|
| VOFマーカー表示（固定値） | `grid.js` → `.vof-marker` |
| PCマーカー表示 | `grid.js` → `.pc-marker` |

### 今後の実装優先度

| # | 機能 | 優先度 | 備考 |
|---|------|:------:|------|
| 1 | **VOFの自動発生ロジック** | 🔴高 | ユニットがLOS内にSpotted敵を持つ場合、武装種別（S/A/H）に基づいてVOF・PDFを自動配置 |
| 2 | **Combat Effects Segment処理** | 🔴高 | ボタン一押しで各カードのNCM計算 → カードドロー → Hit/Pin/Miss判定を一括実行 |
| 3 | **状況変化時のVOF即時更新** | 🟡中 | ユニット移動・LOS遮断を検知してVOF/PDFをリアクティブに更新・除去 |
| 4 | **PDFの方向表示（8方向矢印）** | 🟡中 | `VOF - PDF.png` を回転させてカード端に表示 |
| 5 | **Crossfire自動配置** | 🟡中 | 複数方向PDFを検知して自動追加 |
| 6 | **Concentrate Fire（AP消費）** | 🟢低 | コンテキストメニューからAP消費でConcマーカー配置 |
| 7 | **Fire Mission（Pending→Active）** | 🟢低 | フェーズ管理と連動 |

### 実装方針案（暫定）

```javascript
// 各カードのVOF状態
// cardCoord → { type: 'S'|'A'|'H'|'P'|'S!', crossfire: bool, concentrate: number }
const cardVOFMap = new Map();

// PDFマーカー（方向ごと）
// cardCoord → Set<'top'|'top-right'|'right'|'bottom-right'|'bottom'|'bottom-left'|'left'|'top-left'>
const cardPDFMap = new Map();

// NCM計算
function calcNCM(coord) {
  const vof = cardVOFMap.get(coord);
  if (!vof) return null;
  const VOF_NCM = { S: 0, A: -1, H: -3, P: +2, 'S!': -3 };
  const terrainDef = getTerrainDefense(coord); // 地形防御値（+）
  let ncm = VOF_NCM[vof.type] + terrainDef;
  if (vof.crossfire) ncm -= 1;
  if (vof.concentrate) ncm -= vof.concentrate;
  return ncm;
}

// Combat Effects: カード上の全ユニットに判定
function resolveCombatEffects(coord) {
  const ncm = calcNCM(coord);
  if (ncm === null) return;
  getUnitsOnCard(coord).forEach(unitId => {
    const result = drawAndResolve(ncm); // カードドロー＋表参照
    if (result === 'PIN')  pinUnit(unitId);
    if (result === 'HIT')  applyHitEffect(unitId);
  });
}
```

---

## 補足・確認済み事項

### S!（Sniper VOF）の処理手順

S! は対象カード内の**2段階判定**で処理する：

1. **主要ターゲット1体**（指揮官や重火器チームなど最も価値の高い目標）に NCM **−3** を適用して判定
2. **それ以外の歩兵ユニット全員**に NCM **+0**（通常Sと同値）を適用して判定

> 「どこからか狙撃された！」と部隊全体が身を隠すため、カード全体に軽い制圧効果（S+0）が波及する。

```javascript
function resolveSniperVOF(coord) {
  const units = getUnitsOnCard(coord);
  const primaryTarget = selectPrimaryTarget(units); // 最優先ターゲット1体を選択
  // 主要ターゲットに S! (-3) 適用
  const hitResult = drawAndResolve(calcNCM(coord, 'S!')); // terrainDef + (-3)
  applyResult(primaryTarget, hitResult);
  // 残りユニットに S (+0) 適用
  units.filter(id => id !== primaryTarget).forEach(unitId => {
    const result = drawAndResolve(calcNCM(coord, 'S')); // terrainDef + 0
    applyResult(unitId, result);
  });
}
```

---

### Spotted 状態と VOF の関係

- **Unspotted（未発見）の敵ユニットには自動VOFは発生しない**
- 発見（Spot）の手段：
  1. AP消費による **Spotting Attempt**（成功でSpotted状態へ）
  2. 敵の**移動や発砲**（Exposed状態）→ 自動発見
  3. **Recon by Fire**（AP消費の特殊アクション）→ 見えない場所に撃ち込む威力偵察

> 実装上の影響: VOF自動発生ロジックは `unitStateMap` の `unspotted` フラグを参照し、  
> `unspotted === true` のユニットは VOF 発生対象から除外する。

---

### 射程の定義

- **射程はユニットカウンターごとに個別定義**（カード枚数単位）
- 距離計算: 斜め・縦横ともに **1カード = 1距離**（ユークリッド距離ではなくチェビシェフ距離）

| ユニット種別 | 射程の目安 |
|------------|-----------|
| 歩兵分隊（小火器） | 1〜2カード |
| 自動火器（LMG等） | 2〜3カード |
| HMG・迫撃砲等 | 3カード以上、または Max LOS（視線が通る限り） |

> 実装上の影響: ユニット定義（`units-normandy.js`）に `range` プロパティを追加し、  
> VOF自動発生時に `|col差|` と `|row差|` の大きい方（チェビシェフ距離）で射程チェックを行う。

---

## 未解決事項

- [ ] **PC マーカー（Potential Contact）** — 敵出現ルールに関わる別仕様。VOF/PDFとは独立した機能のため、別途設計予定。
