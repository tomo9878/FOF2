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
  「Potential Contact Draw Chart」（ヒントカード #52）で参照する。
  - 結果が **"Auto"** → カードを引かず即接触成立
  - 結果が **数字 N** → アクションカードを N 枚引き、`Contact` の語が出れば接触成立
- ⚠️ **このチャートの具体的な数値（A/B/C × 4レベル → Auto/枚数）はヒントカード #52 にあり、本ルールPDF本文には表が無い。実装前に別途値を確定する必要がある（→ §7 未確定事項）。**

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

## 7. 未確定事項（実装前に要確認）

1. **Potential Contact Draw Chart の数値**
   （A/B/C × No Contact/Contact/Engaged/Heavily Engaged → Auto または ドロー枚数）。
   ヒントカード #52 の現物が必要。
   ※ ただし PC マーカー解決機能自体が未実装なので、**まずは活動レベルの算出・表示・自動更新だけ**先行実装し、ドローチャートは PC システム実装時に組み込むのが妥当。

2. **「敵 faction」の定義**
   現状 faction は `friendly` / `enemy` / `german` / `nk` / `nva` / `vc` 等がある。
   「敵」= `friendly` 以外、という判定でよいか（=友軍以外は全部敵側とみなす）。

3. **今回の実装スコープ**
   - (a) 活動レベルの**自動算出・ヘッダー表示・盤面操作時の自動更新**まで（推奨・PC不要で完結）
   - (b) PC マーカー解決のドローチャートまで含む（ドローチャート数値の確定が前提）

---

## 8. 推奨する実装の第一歩

§6 の `js/contact.js` を作り、**活動レベルの自動算出＋ヘッダー表示＋盤面操作時の再計算フック**を実装する。
これは既存の `cardVOFMap` / `cardPDFMap` / `unitCoordMap` / `unitStateMap` だけで完結し、
PC マーカーシステムが無くても動く。ドローチャート（敵増援ペース）は PC 実装時に後付けする。
