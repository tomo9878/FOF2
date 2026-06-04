# コンタクトレベル（Current Activity Level）仕様

Fields of Fire Deluxe ~ Series Rules 3rd Edition の §8.1 / §1.2.6（用語集）に基づく設計。

---

## 1. 概要

**コンタクトレベル（Current Activity Level / 現在活動レベル）**は、
ミッション中の戦況の「激しさ」を表す動的な指標。盤面の状態から**自動的に算出**される。

- 4段階：`No Contact` < `Contact` < `Engaged` < `Heavily Engaged`
- 2つのことに影響する：
  1. **指揮能力**（HQ のコマンド取得判定の修正）
  2. **敵増援の登場ペース**（PC マーカー解決時のドロー枚数）
- 状況が変わるたびに**即座に**再計算する（マーカーを上部の視界マーカー隣に置く）
- 画面では既にヘッダーに「活動レベル」表示枠がある（現在は静的な数字）

---

## 2. 4つのレベルと判定条件

増加順（弱→強）。**上から順に強いレベルを判定し、最初に該当したものを採用**する。

| Lv | 名称 | 日本語 | 判定条件 |
|----|------|--------|---------|
| 3 | **Heavily Engaged** | 激戦 | VOF 下にある占有カードが**2枚以上**、かつ**そのうち1枚以上に敵と友軍の両方**がいる |
| 2 | **Engaged** | 交戦 | VOF 下にある占有カードが**2枚以上**（友軍占有・敵占有を含む） |
| 1 | **Contact** | 接触 | VOF 下にある占有カードが**1枚**、**または** Spotted な敵ユニットが**1体以上** |
| 0 | **No Contact** | 接触なし | VOF下の占有カードが**0枚** **かつ** Spotted な敵が**いない** |

### 用語
- **占有カード（occupied card）**：友軍または敵ユニットが1体以上いるカード
- **VOF 下にある（under a VOF marker）**：そのカードに VOF マーカーが置かれている
- **VOF/PDF マーカー**：直接射撃・エリアファイア・PDF・未起動地雷・Pending 砲撃を含む
- **Spotted な敵**：`unspotted` 状態でない敵ユニット

---

## 3. 自動算出ロジック（擬似コード）

```
function computeActivityLevel():
    # Spotted な敵ユニットの有無
    spottedEnemy = (unspotted でない敵ユニットが1体以上いる)

    # VOF 下にある「占有カード」の集合
    occupiedUnderVOF = VOFがあり、かつ友軍or敵ユニットがいるカードの集合

    # --- 強い順に判定 ---
    if occupiedUnderVOF.size >= 2:
        mixed = occupiedUnderVOF の中に「敵と友軍が同居するカード」が1枚以上あるか
        return mixed ? 'heavily_engaged' : 'engaged'

    if occupiedUnderVOF.size == 1 or spottedEnemy:
        return 'contact'

    # 占有カード下の VOF も Spotted 敵もない → No Contact
    return 'no_contact'
```

### 設計判断：ルールの隙間の埋め方
「占有していないカードにだけ VOF がある（例：空カードへの Incoming! 砲撃や、
ユニット未配置時のテスト操作）」場合、ルール文の No Contact 条件（VOF/PDF が皆無）を
厳密に取ると No Contact ではなくなるが、Contact の条件（占有カードが VOF 下）も満たさない。

本実装では **判定の実体を「占有カード下の VOF」と「Spotted 敵」だけに置き**、
誰も巻き込んでいない空カードの VOF/PDF は活動レベルに影響させない（→ No Contact のまま）。
VOF は本来ユニットのいるカードに対して置かれるため、この扱いが実態に合う。
（PDF も単独では活動レベルに影響しない。）

---

## 4. ゲームへの影響

### 4.1 指揮能力（§4.1.2 C）
- **活動レベルが No Contact のとき、HQ のコマンド取得判定に +1** の修正。
- （他の修正：Veteran +1 / Cover下 +1 / VOF を浴びている HQ は VOF種別に応じ −1〜−3）

### 4.2 敵増援ペース（§8.2.4 PC マーカー解決）
- PC マーカー（A/B/C）を解決する際、**マーカーの文字 × 活動レベル**を
  「Potential Contact Draw Chart」で参照する。
  - 結果が **"Auto"** → カードを引かず即接触成立
  - 結果が **数字 N** → アクションカードを N 枚引き、`Contact` の語が出れば接触成立

**ドローチャート（確定値・`pc.js` の `PC_DRAW_CHART` に実装済み）:**

| PCマーカー | 接触なし | 接触 | 交戦 | 激戦 |
|-----------|---------|------|------|------|
| **A** | Auto | 7 | 5 | 3 |
| **B** | Auto | 5 | 3 | 2 |
| **C** | 4 | 3 | 2 | 1 |

→ 活動レベルが弱い（接触なし側）ほど引く枚数が多く接触しにくい。
　 A ほど severe（枚数が多い＝接触判定の機会が多い／No Contact では Auto で即接触）。

---

## 5. 更新タイミング

活動レベルは**マップが更新されるたびに即再計算**する。具体的には：

- **敵活動チェック**後
- **コマンドフェーズの友軍移動**後
- **PC マーカー解決ごと**（§3.7.2：1つ解決するたびに即更新）
- **戦闘効果セグメント（§3.7.4）の最中は更新しない** → そのセグメント終了後とクリーンアップで一括調整
- VOF/PDF マーカーの増減時、ユニットの配置・除去時、Spotted/Unspotted 状態の変化時

実装上は **「盤面を変える操作のたびに `recomputeActivityLevel()` を呼ぶ」** か、
**VOF/PDF/ユニット/状態の各操作の末尾でフックする**形にする。

---

## 6. 実装方針（既存データとの接続）

| 必要な情報 | 既存データソース |
|-----------|-----------------|
| VOF のあるカード | `cardVOFMap`（vof.js） |
| PDF のあるカード | `cardPDFMap`（pdf.js） |
| ユニットの居るカード | `unitCoordMap`（state.js） |
| ユニットの敵味方 | ユニット定義 `faction` / DOM `slot.dataset.faction` |
| Spotted/Unspotted | `unitStateMap` の `unspotted`（state.js） |

### モジュール案：`js/contact.js`
```
export const ACTIVITY_LEVELS = ['no_contact','contact','engaged','heavily_engaged'];
export const ACTIVITY_LABELS = { no_contact:'接触なし', contact:'接触', engaged:'交戦', heavily_engaged:'激戦' };

let _level = 'no_contact';
export function getActivityLevel()        { return _level; }
export function computeActivityLevel()     { /* §3 のロジック */ }
export function recomputeActivityLevel()   { _level = computeActivityLevel(); renderActivityLevel(); return _level; }
function renderActivityLevel()             { /* ヘッダー「活動レベル」表示を更新 */ }
```
- 敵味方の判定に「占有カードに敵/友軍がいるか」を引くヘルパーが要る
  （`unitCoordMap` を逆引きし、各 unitId の faction を見る）。
- ヘッダーの「活動レベル」表示（現状は静的数字）をこの値に差し替える。

---

## 7. 確定事項・残タスク

1. ~~Potential Contact Draw Chart の数値~~ → **確定**（§4.2 の表・`pc.js` に実装済み）
2. **「敵 faction」の定義** → **確定**：`friendly` 以外はすべて敵側とみなす
3. **活動レベルの自動算出・表示・自動更新** → **実装済み**（`contact.js`）
4. **PC マーカーの配置** → **実装済み**（`pc.js`・Mission 1 の Row1:C/Row2:A/Row3:B）
5. **PC ドローチャート（枚数データ）** → **実装済み**（`pc.js` `PC_DRAW_CHART` / `getPCDraw`）

### 残タスク
- **PC 解決ロジック**：友軍が PC のカードに到達 → `getPCDraw(letter, level)` で
  Auto または N 枚ドロー → 引いたカードに `Contact` があれば接触 → 敵パッケージ出現
  （§8.3 Enemy Force Package・人間がカードを引く方式）
- **No Contact 時の HQ コマンド判定 +1** を command 計算へ接続（§4.1.2 C）

---

## 8. 推奨する実装の第一歩

§6 の `js/contact.js` を作り、**活動レベルの自動算出＋ヘッダー表示＋盤面操作時の再計算フック**を実装する。
これは既存の `cardVOFMap` / `cardPDFMap` / `unitCoordMap` / `unitStateMap` だけで完結し、
PC マーカーシステムが無くても動く。ドローチャート（敵増援ペース）は PC 実装時に後付けする。
