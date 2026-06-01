# Fields of Fire デジタル実装計画書

作成日: 2026-05-22  
ベース: Series Rules 3rd Edition (GMT Games)

---

## 1. ルールから理解した「完全な戦闘ループ」

### 1.1 アクションカードの構造（2.8節）

```
┌─────────────────────────────────────────┐
│ [6] ヘルメット  │   Action Type          │
│ [4] スター      │   (Cover/Contact/Rally)│
│                 │  Action Attempt Area   │
│ -4  HIT/PIN/MISS│  (Spotted/Rally/etc)   │
│ -3  HIT/PIN/MISS│                        │
│ -2  HIT/PIN/MISS│  HQ [radio]  AT [#]    │
│ -1  HIT/PIN/MISS├────────────────────────│
│  0  HIT/PIN/MISS│   HIT EFFECT           │
│ +1  HIT/PIN/MISS│  Vet  Line  Green      │
│ +2  HIT/PIN/MISS│  CC   CC    CC         │
│ +3  HIT/PIN/MISS│                        │
│ +4  HIT/PIN/MISS├────────────────────────│
│ +5  HIT/PIN/MISS│ R# 2 3 4 5 6 7 8...   │
│ +6  HIT/PIN/MISS│                        │
└─────────────────────────────────────────┘
```

各カードは以下を持つ：
- **起動コマンド数** (Activated Commands) ヘルメット内の数字
- **自発コマンド数** (Initiative Commands) スター内の数字
- **アクション種別** Cover / Contact / Rally / なし
- **Combat Resolution表** NCM -4〜+6 → HIT / PIN / MISS
- **Hit Effect表** Vet/Line/Green → 1〜2文字 (C/P/L/F/A)
- **ランダム数** R#

### 1.2 戦闘解決の手順（6.4節）

VOFマーカーがあるカード上の各ユニットに対して：

```
[Step 1] NCM計算（すでに実装済み）
   NCM = 最良VOF + 修正合計（Crossfire/Concentrate/地形/カバー/状態/手動）
   範囲: -4 〜 +6

[Step 2] カードを1枚引く
   そのカードの Combat Resolution 表で NCM 行を検索
   → HIT / PIN / MISS

[Step 3-a] MISS の場合
   効果なし。ただし Pinned 状態なら回復（Pinned 除去）

[Step 3-b] PIN の場合
   ユニットに Pinned マーカーを置く

[Step 3-c] HIT の場合
   ① ユニットに Pinned マーカーを置く（必ず）
   ② カードをもう1枚引く
   ③ そのカードの Hit Effect 表でユニットの経験レベル列を参照
   ④ 1文字（単発）または2文字（コンボ）の結果を適用
      C = Casualty（除去）
      P = Paralyzed Team（麻痺）
      L = Litter Team（担架）
      F = Fire Team（分離・Fire Team化）
      A = Assault Team（分離・Assault Team化）
```

### 1.3 フェーズ全体構造（3章）

```
Turn N
├── 3.1 友軍上位HQイベントフェーズ
│     カードを1枚引く → HQアイコンあれば上位HQイベント表
│
├── 3.2 敵活動フェーズ（防衛ミッションのみ）
│
├── 3.3 友軍コマンドフェーズ（メイン）
│   ├── 3.3.1 起動セグメント（BN/CO/PLT HQ順に起動→コマンド取得→消費）
│   │   ├── BN HQ Impulse → CO HQを起動
│   │   ├── CO HQ Impulse → カード引き→起動コマンド取得→PLT/CO Staffに配分
│   │   └── PLT HQ Impulse → カード引き→コマンド取得→部下ユニットへ
│   └── 3.3.2 自発セグメント（起動されなかったHQが自発コマンドで行動）
│
├── 3.4 敵活動フェーズ（攻撃ミッション）
│
├── 3.5 相互捕虜・退却フェーズ
│   ├── 捕虜（Paralyzed/Litter が敵と同カードで単独の場合）
│   └── 退却（Unpinned Paralyzed/Litter が VOF下にある場合）
│
├── 3.6 AT戦闘・車両移動フェーズ
│
├── 3.7 相互戦闘フェーズ ←★最重要★
│   ├── 3.7.1 Potential Contact解決セグメント
│   ├── 3.7.2 砲兵解決セグメント
│   ├── 3.7.3 工兵・地雷解決セグメント
│   ├── 3.7.4 Combat Effects セグメント ← ここで戦闘解決を実行
│   └── 3.7.5 Pinned回復セグメント
│
└── 3.8 クリーンアップフェーズ
```

---

## 2. 現状の実装状況

### ✅ 完成済み
| 機能 | ファイル |
|------|----------|
| マップ描画・カード配置 | grid.js |
| ユニット配置・ドラッグ移動 | grid.js |
| VOFマーカー全種（直接射撃+エリアファイア） | vof.js |
| PDFマーカー（カード間ギャップに配置） | pdf.js |
| NCM計算（VOF+地形+カバー+状態+Crossfire+Concentrate+手動） | ncm.js |
| カバーマーカーシステム（12種） | cover.js |
| ユニット状態管理（7種） | state.js |
| Hit結果適用（A/F/L/P/C + 10コンボ） | hit.js |
| Detach/Supplement | detach.js |
| 右パネルレイアウト | map.html |

### ❌ 未実装（優先順）
| 機能 | 依存 | 難度 |
|------|------|------|
| **P0: カードデータ整備** | なし | ★☆☆ 単純作業 |
| **P1: 戦闘解決エンジン** | P0 | ★★☆ |
| **P2: 戦闘解決UI** | P1 | ★★☆ |
| **P3: ユニット詳細（右パネル）** | なし | ★☆☆ |
| **P4: コマンドシステム** | P0 | ★★★ |
| **P5: Visibility UI** | state.js | ★☆☆ |
| **P6: Crossfire自動検出** | pdf.js | ★★☆ |
| **P7: フェーズ自動化** | P4 | ★★★ |

---

## 3. 実装フェーズ詳細

### Phase 0: カードデータ整備（前提条件）

**目的**: cards.js に Combat Resolution データを追加する

**発見した構造**: カードの Combat Resolution 表は2値で表現できる

```js
// 現在: hit データのみ
{ n:25, hit:{vet:'PF', line:'PF', green:'PP'} }

// 追加が必要: combat データ（hitMax / pinMax の2値で表現）
// hitMax: これ以下のNCMはHIT
// pinMax: hitMax超〜これ以下のNCMはPIN
// pinMax超: MISS
{ n:25, hit:{vet:'PF', ...}, combat:{ hitMax:-2, pinMax:+2 } }
// → -4〜-2: HIT, -1〜+2: PIN, +3〜+6: MISS

// 全MISSの場合（例: A01）
{ combat:{ hitMax:-99, pinMax:-99 } }

// 全PIN or 全HITの場合
{ combat:{ hitMax:+1, pinMax:+6 } }  // -4〜+1:HIT, +2〜+6:PIN, MISS無し
```

**また、コマンドシステム用にも追加が必要**:
```js
{ n:25, activated:3, initiative:2, type:'none',
  hit:{...}, combat:{...} }
```

**作業**: 50枚のカード画像を読んで数値を記録  
→ Claudeが画像読み取りで実施可能

---

**確認済みサンプル（画像スキャン）**:
| カード | activated | initiative | type | hitMax | pinMax |
|--------|-----------|------------|------|--------|--------|
| A01 | 6 | 4 | Cover | -99 | -99 |
| A10 | 5 | 3 | Cover | -99 | -1 |
| A25 | 3 | 2 | - | -2 | +2 |
| A40 | 2 | 1 | Contact | +1 | +6 |

---

### Phase 1: 戦闘解決エンジン（`js/combat.js`）

```js
// ── カードを1枚引く（既存のdrawCard相当、但しデッキ共有）──
function drawActionCard() { ... }  // cards.jsのdeck管理と統合

// ── Step 2: NCM → HIT/PIN/MISS ──
function getCombatResult(ncm, card) {
  const clampedNcm = Math.max(-4, Math.min(6, ncm));
  if (clampedNcm <= card.combat.hitMax) return 'HIT';
  if (clampedNcm <= card.combat.pinMax) return 'PIN';
  return 'MISS';
}

// ── Step 3c: HIT → hit effect 適用 ──
function getHitEffect(card, experience) {
  return card.hit[experience]; // 'CC', 'PF', 'A', etc.
}

// ── メイン: 1ユニットの戦闘解決 ──
export function resolveCombatUnit(unitId, ncm) {
  const card1 = drawActionCard();
  const result = getCombatResult(ncm, card1);
  
  if (result === 'MISS') {
    // Pinned なら回復
    return { result, card: card1 };
  }
  if (result === 'PIN') {
    toggleUnitState(unitId, 'pinned', true);
    return { result, card: card1 };
  }
  // HIT
  toggleUnitState(unitId, 'pinned', true);
  const card2 = drawActionCard();
  const exp = getUnitExperience(unitId); // 'vet'/'line'/'green'
  const hitCode = getHitEffect(card2, exp);
  applyHitCode(unitId, hitCode); // hitCombo() or hitA/F/L/P/C()
  return { result, card: card1, hitCard: card2, hitCode };
}

// ── カード上の全ユニットを一括解決 ──
export function resolveCombatCard(coord) {
  const ncm = calcNCM(coord, null, false); // 全体VOF基準
  const units = getUnitsOnCard(coord);
  return units.map(u => resolveCombatUnit(u.id, ncm.value));
}
```

---

### Phase 2: 戦闘解決UI

**カード右クリックメニューに追加**:
```html
<!-- VOFがある場合のみ有効化 -->
<button id="cardCmCombatResolve">⚔ 戦闘解決</button>
```

**右パネルに解決結果を表示**（右パネルの「選択ユニット」セクションを活用）:
```
⚔ 戦闘解決 — カード B3
━━━━━━━━━━━━━━━━━
NCM: -2
[カード #25を引く]
結果: HIT

1/1 Squad (Line)
[カード #33を引く]
Hit Effect: C → Pinned + Casualty

2/W/1 MG Team (Vet)
[カード #41を引く]  
Hit Effect: L → Pinned + Litter Team
```

**ステップ実行 vs 一括実行** の2モード:
- 「⚔ 一括解決」→ 全ユニット自動処理
- 「⚔ ステップ実行」→ 1ユニットずつ確認しながら

---

### Phase 3: ユニット詳細（右パネル）

`showContextMenu()` 呼び出し時に右パネルも更新：

```js
// context-menu.js の showContextMenu() 末尾に追加
export function updateRightPanelUnit(unit) {
  const el = document.getElementById('rpUnitInfo');
  const s  = getUnitState(unit.id);
  const str = getUnitStrength(unit.id);
  
  el.innerHTML = `
    <div class="rp-unit-name">${unit.label}</div>
    <div class="rp-unit-type">${unit.type}</div>
    <div class="rp-unit-steps">戦力: ${str?.steps ?? 1}/${str?.maxSteps ?? 1}</div>
    <div class="rp-unit-exp">経験: ${unit.experience ?? 'line'}</div>
    <!-- 状態バッジ -->
    ...
  `;
}
```

**また**: ユニット右クリックで NCM も表示（VOFがある場合）

---

### Phase 4: コマンドシステム（簡略版）

**方針**: フル自動化は後回し、まず「コマンド表示＋手動消費トラッキング」

**状態管理** (`js/command.js`):
```js
// HQ別コマンド残数
const hqCommandMap = new Map(); // unitId → remaining commands

export function setHQCommands(unitId, n) { ... }
export function spendCommand(unitId) { ... }
export function getHQCommands(unitId) { ... }
```

**UI**: 右パネルにコマンド表示
```
[HQ ユニット選択時]
━━━━━━━━━━━━━
1st PLT HQ (Line)
コマンド残り: ████░░ 4/6
[─] [＋]
```

**カードを引く = HQのコマンド取得**:
```
カードを引く → activated:5 → 1st PLT HQに5コマンド付与
```

---

### Phase 5: Visibility UI

**実装**: ヘッダーinfo-chipに追加（またはシナリオ設定パネル）

```html
<div class="info-chip">
  視界
  <select onchange="setVisibility(this.value)">
    <option value="daylight">昼間</option>
    <option value="limited">薄暮 (-1)</option>
    <option value="night">夜間 (-2)</option>
    <option value="fog">霧 (+2)</option>
  </select>
</div>
```

`state.js` に `getVisibility()` / `setVisibility()` はすでに実装済み  
→ NCM計算に接続するだけ

---

### Phase 6: Crossfire自動検出

**ルール**: 同一カードへ向かうPDFが2方向以上 → Crossfire自動ON

**実装** (`pdf.js` 拡張):
```js
// PDF追加・削除時に呼ぶ
export function checkCrossfire(coord) {
  const pdfs = getCardPDFs(coord);    // このカードに向かうPDF一覧
  const incoming = pdfs.filter(p => p.targetCoord === coord);
  const hasXfire = incoming.length >= 2;
  // cardVOFMap の crossfire フラグを更新
  if (getVOF(coord)) {
    getVOF(coord).crossfire = hasXfire;
    renderCardVOF(coord);
  }
}
```

---

## 4. 実装順の推奨ロードマップ

```
今日〜来週
┌────────────────────────────────────────────┐
│ Phase 0: カードデータ整備                   │
│   → 50枚の画像をスキャン→cards.js に追記   │
│   → 作業時間: 1〜2時間（機械的作業）        │
└────────────────────┬───────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
┌─────────────────┐   ┌─────────────────────┐
│ Phase 3: 右パネル│   │ Phase 5: Visibility │
│ ユニット詳細表示 │   │ UI（超シンプル）     │
│ 30分             │   │ 20分                │
└─────────────────┘   └─────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ Phase 1: 戦闘解決エンジン (combat.js)        │
│   → NCM→結果→Hit適用の自動化               │
│   → 1〜2時間                               │
└─────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ Phase 2: 戦闘解決UI                         │
│   → 右パネルでステップ表示                  │
│   → 1〜2時間                               │
└─────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ Phase 6: Crossfire自動検出                  │
│   → 30分                                   │
└─────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ Phase 4: コマンドシステム（簡略版）          │
│   → HQコマンド残数トラッキング              │
│   → 2〜4時間                               │
└─────────────────────────────────────────────┘
```

---

## 5. 最初にやること（Phase 0の具体的手順）

`cards.js` に以下フィールドを追加する:
```js
{ n:1, activated:6, initiative:4, type:'cover',
  combat: { hitMax:-99, pinMax:-99 },  // 全MISS
  hit: {vet:'CC', line:'CC', green:'CC'} }
```

`hitMax` / `pinMax` の読み取りルール：
- カード左列を上から読んで最初の HIT → PIN → MISS の区切りを記録
- 例: `HIT HIT HIT PIN PIN PIN MISS MISS MISS MISS MISS`  
  → hitMax = -2, pinMax = +0

**既知データ（確認済み）**:
| # | activated | initiative | type | hitMax | pinMax |
|---|-----------|------------|------|--------|--------|
| 1 | 6 | 4 | cover | -99 | -99 |
| 10 | 5 | 3 | cover | -99 | -1 |
| 25 | 3 | 2 | - | -2 | +2 |
| 40 | 2 | 1 | contact | +1 | +6 |

残り46枚をスキャンして記録する。

---

## 6. 対象外・後回し

| 機能 | 理由 |
|------|------|
| 敵AI自動行動（8章） | 複雑すぎ・手動でOK |
| 車両・AT戦闘（10章） | ノルマンディーシナリオ依存 |
| ヘリ・上陸作戦（11章） | シナリオ固有 |
| キャンペーン経験値（12章） | 後フェーズ |
| Jitter/Stagger移動（5章） | 手動でOK |
| 通信ルール詳細（4.3章） | 手動でOK |

---

*このドキュメントは実装が進むにつれて更新する*
