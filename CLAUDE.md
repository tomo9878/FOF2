# Fields of Fire デジタルボードゲーム

## 現在の状態
- マップ描画・ユニット配置・ドラッグ移動：完成
- VOF マーカー（直接射撃 S/A/H/P）：完成
- VOF マーカー（エリアファイア Grenade/Incoming-3〜7/AirStrike）：完成
- PDF（Primary Direction of Fire）マーカー：完成
- NCM 計算モジュール：完成（地形防御・カバー・Burst・スタックペナルティ込み）
- カバーマーカーシステム（スロット管理・ユニット割り当て・収容上限）：完成
- 12種カバータイプ（Basic/Foxhole/Trench/Bunker/Pillbox/DeepBunker/Building×2/UpperStory×2/ChurchTower×2）：完成
- ユニット状態（Exposed/Pinned/Finished 等 7種）：完成
- Exposed+Pinned 同時表示（clip-path 分割）：完成
- Hit Results メニュー（A/F/L/P/C + 10コンボ）：完成
- Detach Step / Fire Team / Assault Team 分離：完成
- NCM 手動調整（+/-）：完成
- 右パネルレイアウト（フェーズ制御・アクションカード・選択ユニット枠）：完成
- アクションカードデータ整備（全50枚: activated/initiative/type/combat/hit）：完成
- deck.js デッキ管理モジュール（map.js と combat.js で共有）：完成
- combat.js 戦闘解決エンジン（NCM→HIT/PIN/MISS→Hit Effect適用）：完成
- 右パネル「選択ユニット」詳細表示（右クリック連動）：完成
- カード右クリック「⚔ 戦闘解決」ボタン → 一括解決 + 右パネル結果表示：完成
- ユニット右クリック「⚔ 戦闘解決」→ 1ユニットずつ手動カードドロー方式：完成
- 戦闘解決ステップ制（NCM表示→人間がカード引く→HIT/PIN/MISS→人間がHit Effectカード引く）：完成
- ドローロック機構（カード引き中は他操作を封鎖）：完成
- Crossfire 自動検出（PDF 2方向以上で自動 ON）：完成
- コマンドポイント(AP)管理 command.js：箱のみ完成（現在AP保持＋繰越上限/消費上限の計算）
- 練度(experience)を campaign.js で可変管理（成長要素対応・シナリオ初期練度投入・昇格）：完成
- キャンペーン7シナリオ定義スケルトン（視界/練度/部隊/マップ/勝利条件の器・攻勢/防衛タイプ）：完成

## 設計方針

### カードを引く操作は必ず人間が行う
このゲームの肝は「カードを指定枚数引いてその結果に一喜一憂する」体験にある。
カードドローは自動化せず、必ず人間がボタンを押して引く。

- 戦闘解決①（HIT/PIN/MISS判定）→ 人間が「カードを引く」ボタンを押す
- 戦闘解決②（Hit Effect判定）→ 人間が「もう1枚引く」ボタンを押す
- アクションカードフェーズ → 既存の手動「引く」ボタンを維持
- 将来的に3枚以上引く判定が生じた場合も同様に1枚ずつ手動

### カード引き中は他の操作をロックする
HIT判定カードと結果判定カードの間など、連続ドロー中は途中で別操作が割り込めないようにする。

実装方針：
- カード引き中は `document.body` に `data-draw-lock="true"` を付与
- ロック中はユニット右クリック・カード右クリックを無効化
- 全てのドローが完了（またはキャンセル）したらロック解除
- 将来のN枚ドロー判定（Fire Mission等）でも同じロック機構を使い回す

## 次やること
- [ ] シナリオ1（Trévières）の中身を投入（視界・参加部隊・初期練度・マップ・勝利条件）
- [ ] Visibility UI（シナリオヘッダーエリアに Daylight/Night/Fog トグル）
- [ ] Concentrate Fire / Grenade Miss / Demo Miss フラグ（cardVOFMap 拡張）
- [ ] コマンドシステム簡略版UI（command.js の箱は完成 → HQ選択時に右パネルでAP表示＋手動±、カード引きでAP付与）
- [ ] BN HQ ユニット定義の追加（commandRole:'bn_hq' を付けるだけで箱が機能する）

## 既知の課題・ブロッカー
- Visibility は setVisibility()/getVisibility() 実装済みだが UI なし（シナリオヘッダーと合わせて実装予定）
- Best VOF 自動選択（複数 VOF）は Phase 2 以降

## ファイル構成
```
ミニ作業/
├── map.html          メインHTML（CSS込み）
└── js/
    ├── map.js        初期化・フェーズ制御
    ├── deck.js       アクションカードデッキ管理（共有）
    ├── combat.js     戦闘解決エンジン（NCM→HIT/PIN/MISS→Hit適用）
    ├── command.js    コマンドポイント(AP)管理（現在AP保持＋繰越/消費上限の計算）
    ├── campaign.js   キャンペーン状態（練度の可変管理・成長・シナリオ投入）
    ├── state.js      ユニット状態管理
    ├── vof.js        VOF マーカー管理（直接射撃＋エリアファイア）
    ├── pdf.js        PDF マーカー管理
    ├── ncm.js        NCM 計算
    ├── cover.js      カバーマーカー管理
    ├── context-menu.js      ユニット右クリックメニュー（右パネル連動）
    ├── card-context-menu.js カード右クリックメニュー（戦闘解決ボタン）
    ├── hit.js        ヒット処理
    ├── detach.js     分離処理
    └── data/
        ├── cards.js         アクションカードデータ（全50枚・combat/hit込み）
        ├── terrain-data.js  地形防御データ（全55カード）
        ├── units-normandy.js ユニット定義
        └── scenarios/       キャンペーン7ミッション定義（mission-01〜07 ＋ index）
```
