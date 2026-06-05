# Fields of Fire デジタルボードゲーム

> 全体の実装状況・未実装項目の棚卸し・優先度は **ROADMAP.md**（ルールブック全13章 × 実装状況マトリクス）を参照。

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
- Mission 1（Trévières）コア投入（視界Daylight・10ターン・全部隊初期練度・勝利条件）：完成
- マップ生成（シナリオ rows×cols 配置・Hillカードは下にもう1枚ずらし重ね）：完成
- 動作チェック用の無造作なユニット/マーカー配置を除去（初期配置は後日）：完成
- コンタクトレベル（活動レベル4段階: 接触なし/接触/交戦/激戦）を盤面から自動算出・ヘッダー表示・盤面操作で自動更新：完成（仕様書 CONTACT_LEVEL_SPEC.md）
- PC（Potential Contact）マーカーシステム（配置・A/B/C表示・?裏対応）＋ Mission 1 のPC配置（Row1:C / Row2:A / Row3:B）：完成（解決ロジックは未実装）
- PCドローチャート（活動レベル×A/B/C→Auto/ドロー枚数）データ設定：完成（pc.js PC_DRAW_CHART / getPCDraw）
- 初期配置: 未配置部隊プール（スタートエリア下）→ドラッグでスタートエリア/盤面へ配置、プール空で行が消える：完成
- 拡大率: 初期139%固定・マウスホイールズーム無効（ズームはヘッダー操作のみ）：完成
- 状態保存・復元（localStorage・persistence.js）：完成。リロードで駒配置・マーカー・状態が残る
  - 2層version（setup層=マップ/駒/練度・保持／play層=VOF/PC/状態/AP・壊れやすい）
  - ★スキーマ変更時は persistence.js の SETUP_VERSION / PLAY_VERSION を +1（PLAY上げれば駒配置は残しplay層だけ破棄）
  - ヘッダー「状態リセット」（駒残し）/「新規ゲーム」（全初期化）ボタン

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
- [ ] 複数駒を同じカードに置いたときのスタック表示（ずらし重ね等）
- [ ] シナリオ適用フロー（getScenario→applyScenarioExperience＋視界セット）を初期化に組み込む
- [ ] Visibility UI（シナリオヘッダーエリアに Daylight/Night/Fog トグル）
- [ ] Concentrate Fire / Grenade Miss / Demo Miss フラグ（cardVOFMap 拡張）
- [ ] コマンドシステム簡略版UI（command.js の箱は完成 → HQ選択時に右パネルでAP表示＋手動±、カード引きでAP付与）
- [ ] BN HQ ユニット定義の追加（commandRole:'bn_hq' を付けるだけで箱が機能する）
- [ ] PC解決ロジック（ドローチャート: images/Chart - Potential Contact Draw - Deluxe.png から A/B/C×活動レベルの数値を抽出 → ドロー/Auto判定 → 敵パッケージ出現）
- [ ] 活動レベル No Contact 時の HQ コマンド判定 +1 を command 計算に接続

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
    ├── contact.js    コンタクトレベル（活動レベル）自動算出・ヘッダー表示
    ├── command.js    コマンドポイント(AP)管理（現在AP保持＋繰越/消費上限の計算）
    ├── campaign.js   キャンペーン状態（練度の可変管理・成長・シナリオ投入）
    ├── state.js      ユニット状態管理
    ├── vof.js        VOF マーカー管理（直接射撃＋エリアファイア）
    ├── pdf.js        PDF マーカー管理
    ├── pc.js         PC（Potential Contact）マーカー管理（配置・表示）
    ├── persistence.js 状態保存・復元（localStorage・2層version）
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
