# Fields of Fire デジタル実装 進捗ドキュメント

最終更新: 2026-05-19（C案 ESモジュール分割）

---

## プロジェクト概要

Fields of Fire（ソロカード駆動型ウォーゲーム）のブラウザ実装。  
VASSALモジュールの画像・ルールを参考に `map.html` 単体で動作するマップ画面を構築中。

**メインファイル:** `C:\Users\7600144\ミニ作業\map.html`  
**参照資料:** `C:\Users\7600144\ミニ作業\buildFile.xml`（VASSALモジュール定義）

---

## 実装済み機能

### マップ表示
- [x] ノルマンディー地形カード 55種をシャッフルして 4×3 グリッドに配置
- [x] スタートエリア行（4行目）の表示
- [x] カード座標ラベル（A1〜D3、A4〜D4）
- [x] カード選択（クリックでハイライト）
- [x] VOF マーカー / PC マーカーの表示
- [x] マウスホイール＋ズームスライダーによるズーム（ピボット中心）
- [x] 画面フィットズームで自動開始・中央スクロール

### ユニット表示
- [x] VASSAL実画像をユニットマーカーとして表示（48×48px）
- [x] 分隊（3戦力・A面 / 2戦力・B面）の画像切り替え
- [x] LAT（Large Area Token）: Fire Team / Assault Team 等の画像表示
- [x] EXPOSED オーバーレイ帯（`Layer_EXPOSED_new.png`）
- [x] PINNED オーバーレイ帯（`Layer_PINNED_new.png`）
- [x] 状態バッジ（EX / PN / FN / US / UA / FA / HW）
- [x] **ファクション別カラーバー**（ユニット下部 3px ライン）
  - `friendly`: 緑、`enemy`: 赤、`nk`: オレンジ、`nva`: 黄、`vc`: 茶

### ユニット状態管理（内部データ）
- [x] `unitCoordMap`    — ユニットID → カード座標
- [x] `unitStrengthMap` — ユニットID → `{ strength:'full'|'reduced', fullSrc, reducedSrc }`
- [x] `unitStateMap`    — ユニットID → `{ exposed, pinned, finished, unspotted, unaware, fanatic, human_wave }`
- [x] `detachedLATsMap` — 親ユニットID → [分離した LAT ID 一覧]

### 右クリック コンテキストメニュー
- [x] 2戦力（reduced）ユニットはメニュー非表示
- [x] LAT はメニュー表示あり（strength が未登録のため reduced 判定をスキップ）
- [x] **全ファクション共通**（friendly / enemy / nk / nva / vc 全て同一処理）

#### Detach Step サブメニュー（分隊・武器チームのみ）
- [x] 🔫 Fire Team を分離 → reduced化 ＋ Fire Team LAT 追加 ＋ LAT追跡登録
- [x] ⚔ Assault Team を分離 → reduced化 ＋ Assault Team LAT 追加 ＋ LAT追跡登録
- [x] 👤 Step を消費（Guard 等）→ reduced化のみ

#### Hit Results サブメニュー（2026-05-19 実装）

**共通ルール:**
- ヒット処理で変化・生成した**全部隊を自動的に PINNED 状態**にする
- `pinUnit(unitId)` ヘルパーで一括適用

| ヒット | LAT | フル分隊（3戦力）| reduced分隊（2戦力）|
|--------|-----|-----------------|---------------------|
| **Hit: A** Assault Team | → Assault Team に変化 | reduced 分隊 ＋ Assault Team LAT | 除去 → Fire Team LAT ＋ Assault Team LAT |
| **Hit: F** Fire Team | → Fire Team に変化 | reduced 分隊 ＋ Fire Team LAT | 除去 → Fire Team LAT × 2 |
| **Hit: L** Litter | → Litter に変化 | reduced 分隊 ＋ Litter LAT | 除去 → Litter LAT ＋ Fire Team LAT |
| **Hit: P** Paralyze | → Paralyze に変化 | reduced 分隊 ＋ Paralyze LAT | 除去 → Paralyze LAT ＋ Fire Team LAT |
| **Hit: C** Casualty | → Casualty に変化 | reduced 分隊 ＋ Casualty LAT | 除去 → Casualty LAT ＋ Fire Team LAT |

> **PIN 対象まとめ（全ヒット共通）**
> - LAT → その LAT 自身
> - フル分隊 → 元の分隊（reduced後）＋ 新 LAT
> - reduced分隊 → 生成された LAT × 2（元分隊は除去のため対象外）

#### Mark as サブメニュー（状態トグル）
- [x] Exposed（露出）
- [x] Pinned（制圧）
- [x] Finished（行動完了）
- [x] Unspotted（未発見）
- [x] Unaware（無警戒）
- [x] Fanatic（狂信的）
- [x] Human Wave（人海戦術）
- [x] ✕ 全状態をクリア

### アクションカード
- [x] カードを引く（シャッフル済みデッキから1枚）
- [x] フッターに引いたカードのミニ表示（起動コマンド・自発コマンド・種別）
- [x] カード残枚数表示

### フェーズ管理
- [x] 次フェーズボタン（8フェーズサイクル）

---

## 技術メモ

### ファイル構成
```
ミニ作業/
├── map.html                    ← HTML構造 + CSS のみ（JS は js/ に分離済み）
├── PROGRESS.md                 ← 本ドキュメント
├── buildFile.xml               ← VASSALモジュール定義（参照用）
├── js/
│   ├── map.js                  ← エントリポイント（全モジュールを束ねて初期化）
│   ├── state.js                ← ユニット状態管理（Maps・状態操作・バッジ描画）
│   ├── grid.js                 ← グリッド描画・ユニットスロット・D&D
│   ├── context-menu.js         ← 右クリックメニュー全般
│   ├── hit.js                  ← Hit処理（A/F/L/P/C/Combo）
│   ├── detach.js               ← Detach処理（FireTeam/AssaultTeam/Step）
│   ├── zoom.js                 ← ズーム制御
│   └── data/
│       ├── cards.js            ← TERRAIN_CARDS, ACTION_CARDS, shuffle
│       └── units-normandy.js   ← ノルマンディーキャンペーン ユニット定義
└── images/
    ├── 2nd_1-1.png             分隊 A面（フル）
    ├── 2nd_1-1b.png            分隊 B面（reduced）
    ├── LAT_Fire Team-W.png     Fire Team LAT
    ├── LAT_Assault Team-W.png  Assault Team LAT
    ├── LAT_Litter-W.png        Litter LAT
    ├── LAT_Paralyze-W.png      Paralyze LAT
    ├── LAT_Casualty-W.png      Casualty LAT
    ├── Layer_EXPOSED_new.png   Exposed オーバーレイ帯
    ├── Layer_PINNED_new.png    Pinned オーバーレイ帯
    ├── Weapon_2-W-1.png        武器チーム画像
    ├── N01 Hill.jpg 〜         地形カード画像（55種）
    └── ...
```

### キャンペーン切り替え方法
`map.html` の読み込みファイルではなく、`js/map.js` の import 1行を変えるだけ：
```javascript
// ノルマンディー
import { UNITS, MARKERS } from './data/units-normandy.js';

// 朝鮮戦争に切り替え（ファイルを用意したら）
import { UNITS, MARKERS } from './data/units-korea.js';
```
ロジック（hit.js / detach.js / state.js 等）はすべてそのまま再利用可能。

### 重要ルール実装メモ
- **reduced ユニットは右クリックメニュー非表示**
  → `createUnitSlot` の contextmenu リスナーで `getUnitStrength().strength === 'reduced'` をチェック
- **LAT は `unitStrengthMap` 未登録** → `getUnitStrength()` が `undefined` を返すためメニューは表示される
- **Hit 処理後の全関係部隊を PINNED に** → `pinUnit(id)` で `unitStateMap` に `pinned:true` セット → `renderUnitBadges()` でオーバーレイ帯を即時反映
- **`pointer-events: auto`** を `.unit-layer` / `.unit-slot` に明示（親 `.card-overlay` の `pointer-events:none` を上書き）
- **ブラウザ標準右クリック抑制**
  → `document.addEventListener('contextmenu', e => e.preventDefault(), true)` キャプチャフェーズ最優先

### Hit ID 命名規則
| 操作 | 生成 LAT の ID |
|------|----------------|
| Hit: A フル→AT | `{unitId}_HIT_AT` |
| Hit: A reduced→FT+AT | `{unitId}_HIT_FT` / `{unitId}_HIT_AT` |
| Hit: F フル→FT | `{unitId}_HIT_FT` |
| Hit: F reduced→FT×2 | `{unitId}_HIT_FT1` / `{unitId}_HIT_FT2` |
| Hit: L フル→LT | `{unitId}_HIT_LT` |
| Hit: L reduced→LT+FT | `{unitId}_HIT_LT` / `{unitId}_HIT_FT` |
| Hit: P フル→PT | `{unitId}_HIT_PT` |
| Hit: P reduced→PT+FT | `{unitId}_HIT_PT` / `{unitId}_HIT_FT` |
| Hit: C フル→CT | `{unitId}_HIT_CT` |
| Hit: C reduced→CT+FT | `{unitId}_HIT_CT` / `{unitId}_HIT_FT` |

---

## 未実装・今後の予定

### Hit Results（追加予定）
- [ ] Hit: B（未定義、ルール確認要）
- [ ] Hit: D（未定義、ルール確認要）
- [ ] Hit: E（未定義、ルール確認要）
- [ ] コンボヒット（CC / CP / CL / CF / PC / PP / PL / PF / LC / FC 等）
- [ ] Named Fire Team ユニットへのヒット処理

### ゲームロジック
- [ ] ユニットのカード間移動
- [ ] Supplement（補充）処理 — reduced → full 復帰、分離 LAT の回収
- [ ] カード間の BroadcastChannel 同期（command.html 連携）
- [ ] 敵ユニット表示

### UI改善
- [ ] ユニットドラッグ＆ドロップ移動
- [ ] React + Vite への移行検討

---

## MOCK_UNITS（現在の配置）

### 友軍（friendly）
| 座標 | ユニットID | 種別 | 説明 |
|------|-----------|------|------|
| A1 | US_1PLT_1SQ | squad | 第1小隊 第1分隊 |
| A2 | US_CO_HQ / XO / 1SGT | weapon_team (namedFT) | CO 指揮部 |
| A3 | US_*PLT_HQ × 3 | weapon_team (namedFT) | 各小隊HQ |
| B1 | US_RUNNER_1/2 | weapon_team (namedFT) | ランナー |
| B2 | US_2PLT_1SQ | squad | 第2小隊 第1分隊 |
| B2 | US_2PLT_W1 | weapon_team | 第2小隊 武器チーム1（LMG）|
| C1 | US_3PLT_1SQ | squad | 第3小隊 第1分隊 |
| C2 | US_HMG50 / LMG_1/2 | weapon_team (namedFT) | 支援火器 |
| D1 | US_AT_1/2/3 | weapon_team (namedFT) | 対戦車チーム |
| D2 | US_MTR60_1/2/3 | weapon_team (namedFT) | 60mm迫撃砲 |

### 敵軍（モック・画像パス要差し替え）
| 座標 | ユニットID | ファクション | 説明 |
|------|-----------|------------|------|
| B3 | NK_1SQ | nk（北朝鮮軍）| 北朝鮮軍 第1分隊 |
| B3 | NK_1WPN | nk（北朝鮮軍）| 北朝鮮軍 武器チーム |
| C3 | NVA_1SQ | nva（北ベトナム軍）| 北ベトナム軍 第1分隊 |

---

## 作業ログ

| 日付 | 作業内容 |
|------|---------|
| 2026-05-19 | マップ表示、ユニット表示基盤、状態管理、コンテキストメニュー基盤 |
| 2026-05-19 | EXPOSED/PINNED オーバーレイ帯実装 |
| 2026-05-19 | Detach Step サブメニュー実装（Fire Team / Assault Team / Step消費） |
| 2026-05-19 | reduced ユニットの右クリックメニュー非表示制御 |
| 2026-05-19 | Hit Results サブメニュー実装（A / F / L / P / C）＋ 全ヒットで自動 PINNED |
| 2026-05-19 | 敵ユニット対応（全ファクション共通処理）＋ ファクション別カラーバー CSS |
| 2026-05-19 | C案 ESモジュール分割（map.html → js/配下9ファイルに分離）|
