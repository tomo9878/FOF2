# Fields of Fire デジタルボードゲーム

> 全体の実装状況・未実装項目の棚卸し・優先度は **ROADMAP.md**（ルールブック全13章 × 実装状況マトリクス）を参照。

## ドキュメント同期ルール（明文化・必須）

ルール実装に関わるファイル（`js/data/*`・`los.js`・`placement.js`・`enemy-contact.js`・
`pc-resolve.js`・`command.js`・その他ルールブックの節を実装するモジュール）を変更したら、
**同じ作業の中で**以下を必ず更新する。「あとでまとめて更新」は禁止：

1. **ROADMAP.md** の該当章・節のステータス（✅/🟡/⬜/⛔）とメモ欄
2. **roadmap.html** の同じ項目のデータ（ROADMAP.mdとステータス・メモがズレないようにする）
3. ルールブック（FOF.pdf / campaign PDF等）を参照して確認した内容は、結論だけでなく
   **どのページ・どの節で確認したか**をメモ欄か仕様書（CONTACT_LEVEL_SPEC.md 等）に残す
   → 次回セッションで同じ調査をやり直さずに済むようにするため

このルールの目的: 仕様書（ROADMAP.md）とコードの実装状況が常に一致している状態を保ち、
別タスクに戻ったときの調査コスト・文脈のズレを防ぐ。

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
- コマンドポイント(AP)管理 command.js：現在AP保持＋繰越上限/消費上限の計算＋**CO HQに起動された(Activated)/イニシアチブの判別**（未起動ユニットはイニシアチブで自動的に起動扱い）：完成
- 練度(experience)を campaign.js で可変管理（成長要素対応・シナリオ初期練度投入・昇格）：完成
- キャンペーン7シナリオ定義スケルトン（視界/練度/部隊/マップ/勝利条件の器・攻勢/防衛タイプ）：完成
- Mission 1（Trévières）コア投入（視界Daylight・10ターン・全部隊初期練度・勝利条件）：完成
- マップ生成（シナリオ rows×cols 配置・Hillカードは下にもう1枚ずらし重ね）：完成
- 動作チェック用の無造作なユニット/マーカー配置を除去（初期配置は後日）：完成
- コンタクトレベル（活動レベル4段階: 接触なし/接触/交戦/激戦）を盤面から自動算出・ヘッダー表示・盤面操作で自動更新：完成（仕様書 CONTACT_LEVEL_SPEC.md）
- PC（Potential Contact）マーカーシステム（配置・A/B/C表示・?裏対応）＋ Mission 1 のPC配置（Row1:C / Row2:A / Row3:B）：完成
- PCドローチャート（活動レベル×A/B/C→Auto/ドロー枚数）データ設定：完成（pc.js PC_DRAW_CHART / getPCDraw）
- PC解決ロジック §8.2.4（pc-resolve.js）：接触するかの判定をカード右クリック「PC解決」から実行。Auto/N枚ドロー（人間が1枚ずつ引く）に対応：完成
- 敵接触タイプ判定 §8.3（enemy-contact.js）：シナリオ別R#テーブル汎用エンジン(scenario-tables.js) + Mission1のEnemy Force Package/Higher HQ Eventデータ投入。武器種別(LMG/HMG)・FO種別(Artillery/Mortar)等の追加ランダム判定（choices）にも対応：完成
- Squad袋引き・装備プール（enemy-contact.js drawSquadFromPool/equipmentPools）：Grenadier分隊(Gp1-4, rating A/A/A/S)はカード画像で確認した「Draw one at random each time a squad is placed」を実装（ランダム袋引き・使用済み管理）。HMG/LMG/迫撃砲/スポッターは同一性能の複数個体を順番割当（ランダムではない）：完成
- 敵ユニット実配置 §8.4.3（enemy-placement.js）：§8.4.2方向ドロー→§8.4.1距離解決→addUnitToCardで実際に盤面配置。Squad袋引き/装備プールで解決できたものだけ自動配置し、Sniper・FLAK 36・Patrol等まだ駒が無いものは「手動配置してください」と明示。PC解決フロー（card-context-menu.js）に「配置方向ドロー」ボタンとして接続済み：完成（cover探索・友軍重なり回避・PDF/VOF自動付与は未）
- R#の実カード化：カード番号から `floor((n-1)*denom/50)+1` でR#を再現し、共有デッキから実際に1枚引く方式に統一（Math.random不使用）：完成
- LOS/距離判定 §5.2.1（los.js）：8方向・Close/Long/Very Longレンジ・Hill標高越え対応。副産物としてncm.jsの地形防御(defHigh/defLow)判定の逆転バグを修正：完成
- 配置距離判定 §8.4.1（placement.js）とマップ拡張 §8.4.5（grid.js expandMapEdge / terrain-deck.js）：Max LOS/Range配置がマップ外に出る場合、地形カードを引いて行/列を拡張：完成
- roadmap.html：ROADMAP.mdの内容を見て操作できるインタラクティブなダッシュボード（ステータス切替・優先度チェックリスト・Markdown書き出し）：完成
- 初期配置: 未配置部隊プール（スタートエリア下）→ドラッグでスタートエリア/盤面へ配置、プール空で行が消える：完成
- 拡大率: 初期139%固定・マウスホイールズーム無効（ズームはヘッダー操作のみ）：完成
- コマンド(AP)取得UI：HQ選択→右パネルでAP表示＋手動±＋「カード引いてコマンド取得」：完成（取得=自動／消費=人間が±）
  - §4.1.2 の修正を全実装（Pinned−1 / Green−1 / Vet+1 / Cover+1 / VOF S−1・A−2・H/S!/Grenade/Incoming/AirStrike−3 / No Contact+1）＋最低値クランプ（起動=1・イニシアチブ=0）。取得時に内訳を表示
  - CO Staff のイニシアチブは例外で**カードを引かず固定1・修正適用外**（FOF.pdf p.19 §4.1.1 / p.20 §4.1.2）
  - 指揮系統 `CAN_ACTIVATE`（§4.1.1 Command Reference Table p.18）: BN HQ→CO HQ／CO HQ→CO Staff・全下位HQ／CO Staff・PLT HQ は誰も起動できない。右パネルの起動チェックは起動されうる役職にだけ出る
  - `activated`（上位HQに起動された）と `drawn`（このターン取得済み）は別フラグ。クリーンアップフェーズで `resetImpulseFlags()` が両方を落とす（保有APは残す）
  - 「⏹ インパルス終了（残りを Save）」で `finishImpulse()` が残りAPを繰越上限（§4.1.3）で切り捨て保存。超過分は破棄
  - 1インパルス消費上限（昼6・夜4／§4.1.3）：`expendCommand()` が消費カウンタを持ち、上限で「－」を無効化。＋は取り消し（カウンタも戻る）。General Initiative は対象外
- インパルス順序制御 §3.3.1/§3.3.2（右パネル「🎖 インパルス」）：7インパルス（BN HQ→CO HQ起動→PLT/Staff起動→CO HQ Init→PLT Init→CO Staff Init→General Init）を順に進める。該当しないユニットの取得ボタンは理由つきで無効化。クリーンアップで先頭へ戻る：完成
- 起動アクション §4.2.1a（CO HQ/BN HQ の右パネル）：1コマンド消費・自動成功で下位HQ/Staffを起動。分隊・武器チーム・LAT・上位HQ・自分自身は起動不可、二重起動不可、AP不足/消費上限で不可：完成
- 通信 §4.3.1 Visual-Verbal（comm.js `canCommunicate`）：同エリア（`coord#slotId`／カバー外は `coord#open`）かつ両者 Unpinned。Remove Pinned・Exhort は Pinned 無視、Cease Fire・Shift Fire は同カード全員に伝達。**まだ命令判定には繋いでいない（統合は COMMUNICATION_SPEC.md Step5）**：完成
- Fire Team 面 §4.1.4（`isOnCommandSide()`）：`namedFireTeam` の駒が1ステップ失うとB面＝Fire Team 面。**発令者・対象のどちらかがB面だと Activate 不可**（§4.2.1a）、B面のHQは自分にしか命令できない、BN HQ の自動起動も対象がB面ならスキップ。L/P/C ヒットで LAT に置き換わった HQ/Staff は保存コマンドを全喪失（`loseSavedCommands()` を hit.js から呼ぶ）：完成
- 命令の発令可否 `canGiveOrder()` §4.1.1（Command Reference Table 右列）：BN HQ=全員／CO HQ・CO XO・1st Sgt・GySgt=自分より下位のみ／PLT HQ=自小隊＋全LAT／HQ以外は発令不可。CO Staff の序列は `staffRank`（xo/1sgt）で細分：完成
- General Initiative インパルス §3.3.2d（右パネル「⭐ General Initiative」）：人間がカードを引き★をそのまま取得（§4.1.2の修正なし）。単一小隊ミッションは半分・切り捨て。HQ不要・通信不要・繰越不可。共有プールは仮想ユニット `GENERAL_INIT`：完成
- BN HQ インパルス §3.3.1a/§4.1.1（右パネル「🏛 BN HQ インパルス」）：状態4種から解決。盤外＋通信可→CO HQ自動起動（カード非消費）／盤上→最大6・4を仮想ユニット `BN_HQ` に付与（繰越不可・クリーンアップで破棄）／通信不通・使用不能→起動なし：完成
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
- [x] ~~コマンドシステム簡略版UI（HQ選択→AP表示＋手動±＋カード引き取得）~~ 完成
- [x] ~~コマンドフェーズの起動セグメント（HQ起動順・配下への配分・消費上限チェック）~~ 完成
- [ ] **§4.3 通信と §4.1.4 Fire Team 面 → 実装計画は COMMUNICATION_SPEC.md（ルール調査済み・Step0〜6）**
- [x] ~~駒の表裏（command side / Fire Team side・§1.2.3B / §4.1.4）~~ 完成（Step0。`isOnCommandSide()` = `namedFireTeam` かつ `steps === maxSteps`）
- [ ] rally で Fire Team 面から command side に戻す手段（§6.5 / §4.2.3）— 今は手動で強度を戻すしかない
- [ ] Attachment の小隊割当（§2.3.2 Mission Log）— PLT HQ の命令範囲判定に必要（今はユニットIDの `US_nPLT_` 接頭辞で小隊を判定している）
- [x] ~~BN HQ の箱~~ 完成（盤面駒ではなく仮想ユニット `BN_HQ` として実装。盤上に上位HQリーダーの駒が要る場合は別途ユニット定義が必要）
- [x] ~~PC解決ロジック（§8.2.4接触判定＋§8.3タイプ判定）~~ 完成
- [x] ~~§8.4.3 実際の敵ユニット生成・配置（§8.4.2方向＋§8.4.1距離→addUnitToCard）~~ 完成（cover探索・友軍重なり回避・PDF/VOF自動付与は未）
- [x] ~~§8.4.2 方向判定と§8.4.1距離判定の実戦UI接続~~ 完成（PC解決フローの「配置方向ドロー」ボタン）
- [ ] Sniper・FLAK 36 AA Gun・Patrol Squad のユニット定義追加（units-normandy.jsに未定義。placeResolvedUnitsは「駒が未定義」と表示するのみで配置しない）
- [ ] 配置後のcover探索・友軍ユニットとの重なり回避（§8.4.3詳細）・PDF/VOF自動付与
- [x] ~~活動レベル No Contact 時の HQ コマンド判定 +1~~ 完成（コマンド取得時に+1）

## 既知の課題・ブロッカー
- Visibility は setVisibility()/getVisibility() 実装済みだが UI なし（シナリオヘッダーと合わせて実装予定）
- Best VOF 自動選択（複数 VOF）は Phase 2 以降

## プロジェクト専用スキル（.claude/skills/）
- **verify-rule**: ルールブック(FOF.pdf/campaign PDF)確認→実装突き合わせ→ROADMAP.md/roadmap.html同期を一気通貫で行う
- **scaffold-mission**: campaign PDFのミッション章からmission-01.jsと同じスキーマでmission-0X.jsを埋める（Mission2〜7投入用）

## ファイル構成
```
ミニ作業/
├── map.html          メインHTML（CSS込み）
├── roadmap.html       ROADMAP.md内容の操作可能ダッシュボード
└── js/
    ├── map.js        初期化・フェーズ制御
    ├── deck.js       アクションカードデッキ管理（共有）
    ├── terrain-deck.js 地形カード補充（マップ拡張§8.4.5用）
    ├── combat.js     戦闘解決エンジン（NCM→HIT/PIN/MISS→Hit適用）
    ├── contact.js    コンタクトレベル（活動レベル）自動算出・ヘッダー表示
    ├── command.js    コマンドポイント(AP)管理（現在AP保持＋繰越/消費上限の計算＋起動/イニシアチブ判別）
    ├── campaign.js   キャンペーン状態（練度の可変管理・成長・シナリオ投入）
    ├── state.js      ユニット状態管理
    ├── vof.js        VOF マーカー管理（直接射撃＋エリアファイア）
    ├── pdf.js        PDF マーカー管理
    ├── pc.js         PC（Potential Contact）マーカー管理（配置・表示・ドローチャート）
    ├── pc-resolve.js PC解決エンジン（§8.2.4 接触するかの判定）
    ├── enemy-contact.js 敵接触タイプ判定（§8.3 パッケージ判定＋武器/FO種別等の追加判定＋Squad袋引き/装備プール）
    ├── enemy-placement.js 敵ユニット実配置（§8.4.3 方向ドロー→距離解決→addUnitToCardで盤面配置）
    ├── comm.js       通信（§4.3。現状 Visual-Verbal のみ。無線/電話/ランナーは未）
    ├── los.js        LOS/距離判定（§5.2.1 8方向・レンジ・Hill標高越え）
    ├── placement.js  敵配置の距離・方向解決（§8.4.1/8.4.2）
    ├── persistence.js 状態保存・復元（localStorage・2層version）
    ├── ncm.js        NCM 計算
    ├── cover.js      カバーマーカー管理
    ├── context-menu.js      ユニット右クリックメニュー（右パネル連動）
    ├── card-context-menu.js カード右クリックメニュー（戦闘解決・PC解決ボタン）
    ├── hit.js        ヒット処理
    ├── detach.js     分離処理
    └── data/
        ├── cards.js         アクションカードデータ（全50枚・combat/hit込み）
        ├── terrain-data.js  地形防御データ（全55カード）
        ├── units-normandy.js ユニット定義
        ├── scenario-tables.js シナリオ別R#テーブル汎用エンジン
        └── scenarios/       キャンペーン7ミッション定義（mission-01〜07 ＋ index。mission-01にtables追加）
```
