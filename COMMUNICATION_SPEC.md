# 通信（§4.3）＋ Fire Team 面（§4.1.4）実装計画

コマンド系（§3.3 / §4.1 / §4.2.1a）の実装が一段落した時点での残タスクをまとめたもの。
**ルール調査は完了済み**なので、次セッションは PDF を読み直さずここから着手できる。

---

## 1. 調査済みルール（出典つき）

### §4.1.4 Effect of Combat Hits on HQ & Staff Units（FOF.pdf p.20）

- HQ/Staff が Litter Team / Paralyzed Team / Casualty になったら **保存コマンドは全て失われる**
- **Fire Team 面**に裏返った HQ/Staff は保存コマンドを保持するが、
  command side に rally で戻るまで **自分自身にしか命令できない**
- **Fire Team 面の HQ/Staff は上位HQに Activate されない**（イニシアチブで引くしかない）
- HQ（Staff は不可）は casualty / LAT になってもミッション中に Reconstitute できる（§6.5.2）

> 実装メモ: 「Fire Team 面」は新概念ではなく、既存の強度管理で判定できる。
> `namedFireTeam: true` のユニットで `steps < maxSteps` の状態が B面（`srcReduced` に
> 切り替わっている状態）。[state.js:56-65](js/state.js:56) 参照。

### §4.3 Communication（FOF.pdf p.27-28）

命令を出すには、発令者（Originator）が対象（Recipient）と通信できていること。

#### §4.3.1 Visual-Verbal（基本手段・装備不要）
- **両方が Unpinned** かつ **同じカードの同じエリア**にいること
  - 同じ Cover マーカーの下 / 両方ともカバー外 / 同じ Building Area（§13）
- 例外: Pinned ユニットにも「Attempt to Remove Pinned」命令（と続く Exhort）は出せる
- 例外: Cease Fire / Shift Fire はカード上の全員に届く（Pinned・通信状態を問わない）

#### §4.3.2 Runners
- CO HQ が **翌ターン**に下位HQ/Staff を Activate するための手段
- CO HQ が1コマンドで Dispatch（§4.2.1g）→ 対象の隣に置き Exposed にする
- 途中の Combat Effects Segment で **Hit も Pinned もされなければ**、翌ターンの
  CO HQ インパルスで対象が Activate され、ランナーは自動的に CO HQ の箱へ戻る
- **対象が Fire Team 面だと届かない**（§4.1.4 と同条件）
- 同時に盤上に置けるのは2体まで
- 開始時に持っているかはキャンペーン指示書による。無ければ既存ユニットから
  Line 評価のランナーを作れる（§4.2.1f）

#### §4.3.3 Networks
- **使えるのが電話か無線か両方かはミッション指示書が決める**
- 1つのネットワークは電話か無線のどちらか一方（**混在不可**）
- CO TAC（Company Tactical Network）: CO HQ の RT がハブ。Staff と小隊長が繋がる。
  **FO と連隊 Staff は CO TAC では通信できない**
- RT は割り当てられたネットワークでのみ通信する（カウンターに所属網が印字されている）
- 失った/破壊された RT は、別ネットワークの同型 RT と1コマンドで交換できる（§4.2.1j）

#### §4.3.4 Field Telephones
- Visual-Verbal 圏外との通信を可能にする＝**別カード・盤外・同カードの別エリア
  （別 Cover マーカー）・Pinned ユニット**
- 電話線マーカーまたは他の電話機による**途切れない繋がり**が必要
  （電話機カウンター自体も電話線として働く）
- CO TAC 網は CO HQ の電話が接続に含まれていること。**他の網は Staging Area に接続が必要**
- 電話線マーカーの数はミッション指示書に記載。電話線を持つユニットは
  カードを離れるとき **命令不要で自動的に** 1カードにつき1本敷設する

#### §4.3.5 Radios
電話と同じく Visual-Verbal 圏外と通信できるが、**技術世代で性能が違う**。

| 型 | 例 | 性能 |
|---|---|---|
| A. 初期携帯無線 | SCR536 | **LOS が通る相手のみ**（昼扱い・煙は無視）。**カバーマーカーの下からは機能しない** |
| B. 車載/背負い/VHF-FM | SCR300, SCR610, PRC25/77/119 | 同一網なら**マップ上どこでも・盤外とも**通信可 |
| C. 先進携帯無線 | ICOM, PRR, PRC148/152 | 小隊長だけでなく**分隊まで**同一・隣接カードで通信可 |

### ノルマンディー・キャンペーン固有（FoF_Deluxe_Normandy_Campaign.pdf p.13 "CSR 1. Communications"）

- **CO TAC 網は SCR536**（＝タイプA。カバー下で死ぬ／LOS 必須）
- **攻勢ミッションでは SCR536 を EE8 野戦電話に置き換え可**。選んだ場合
  **電話線マーカー4本**が資産としてつく。他の網は無線のまま
- **Combat Patrol では電話は使用不可**（Mission 3 / 5 は無線固定）
- BN TAC は **SCR300**（タイプB）→ BN HQ からの CO HQ 自動起動はこれに依存
- **ランナーは開始時ゼロ**。必要ならプレイ中に既存ユニットから作る

---

## 2. 実装ステップ（依存順）

見積の目安: S=1セッション未満 / M=1セッション / L=複数セッション

### Step 0: §4.1.4 Fire Team 面チェック 〈S・通信と独立〉 — ✅ 完了
- `command.js` に `isOnCommandSide(unitId)` を追加
  （`namedFireTeam` かつ `steps < maxSteps` なら false。仮想ユニットは常に true）
- `canActivateTarget()`：**発令者・対象のどちらかが Fire Team 面なら起動不可**
  （§4.2.1a「Both the Originator and the Recipient must be on their command sides」＋ §4.1.4）
- `canGiveOrder()`：発令者が Fire Team 面なら自分自身にしか命令できない
- `resolveBNHQImpulse()`：Fire Team 面の CO HQ は BN HQ に自動起動されない
- `loseSavedCommands()` を追加し、`hit.js` の hitL / hitP / hitC と hitCombo の
  L/P/C 分岐（namedFireTeam の駒が LAT に置き換わる箇所）から呼ぶ
- 右パネルに「⚠ Fire Team 面」警告を表示
- 副産物: `hit.js` の Litter 画像パスが `images/LAT_Litter-W.png` で **404** だったのを
  `images/Counter LAT - Litter Team.png`（P/C と同じ Counter LAT シリーズ）に修正

### Step 1: 通信の骨格 + Visual-Verbal 〈S〉
- 新規 `js/comm.js`：`canCommunicate(fromId, toId) → {ok, via, reason}`
- まず Visual-Verbal だけ実装：両者 Unpinned ＆ 同 coord ＆ 同じカバースロット
  （両方カバー外も可）。判定材料は `state.js` の `unitCoordMap` /
  `getUnitState().pinned` と `cover.js` の `getUnitCoverSlot()` で揃っている
- 例外2つ（Attempt to Remove Pinned / Cease Fire・Shift Fire）は
  「命令の種類」を引数で受けて通す口だけ用意する

### Step 2: 無線ネットワークと機器データ 〈M〉
- `js/data/radios.js`：型（A/B/C）・ネットワーク（CO TAC / BN TAC / Arty FD / Mtr FD）の定義
- ユニット→保有 RT の割当（シナリオ資産として持たせる）
- `comm.js` に無線経路を追加
  - タイプA: **両端がカバー外** ＆ `los.js` で LOS が通ること
  - タイプB: 同一網なら無条件（盤外含む）
  - タイプC: 同一・隣接カードまで分隊も対象
- **`los.js` は実装済みなのでタイプAの判定はすぐ書ける**

### Step 3: 電話と電話線 〈L〉
- 電話線マーカー（カード単位）＋ 電話機カウンターの配置
- 接続判定＝隣接カードをたどるグラフ探索。CO TAC は CO HQ の電話を含むこと、
  他網は Staging Area に到達すること
- 敷設は「電話線を持つユニットがカードを離れたら自動で1本置く」
- 切断（§4.3.4 の phone line 切断）と修理（§4.2.1k Repair a Cut Phone）
- **ここが一番重い。Step 2 まで終われば通信の8割は動くので後回しでよい**

### Step 4: ランナー 〈M〉
- `US_RUNNER_1/2` の駒は `units-normandy.js` に定義済み
- CO HQ の Dispatch（§4.2.1g・1コマンド）／ Dismiss（§4.2.1h）アクション
- 「翌ターンの CO HQ インパルスで対象を Activate」の予約状態を持たせる
- Combat Effects Segment で Hit / Pinned を受けたら失敗、対象が Fire Team 面でも失敗
- ノルマンディーは開始時ゼロなので、まず §4.2.1f「既存ユニットからランナーを作る」が要る

### Step 5: 通信条件を指揮判定に組み込む 〈S〉
- `canActivateTarget()` と `canGiveOrder()` に `canCommunicate()` を条件追加
  （§4.1.1 の "in play and **in communication**"）
- BN HQ の状態 select（今は人間が4状態から選ぶ仮実装）を、
  **SCR300 BN TAC の有無・破損から自動判定**する形に置き換える
- 右パネルに「なぜ命令できないか」を表示（既存の理由表示の仕組みに乗せる）

### Step 6: シナリオデータ投入 〈S〉
- `mission-01.js` に通信資産を追加：CO TAC=SCR536（攻勢なので EE8 電話4本の選択肢あり）、
  BN TAC=SCR300、ランナー0
- 電話/無線の選択 UI（攻勢ミッションのみ・Combat Patrol は電話禁止）

---

## 3. 順番の考え方

- **Step 0 は独立**していて小さく、起動フェーズを仕様上閉じられるので最優先候補
- Step 1 → 2 → 5 まで通すと「カバーに隠れた CO HQ は同じ穴の相手にしか
  命令できない」というルール上の緊張が実際に効きはじめる。**ここが体験の山**
- Step 3（電話）は重いわりに、攻勢ミッションで選択したときだけ効く。
  Step 5 まで終えてから着手で問題ない
- Step 4（ランナー）は Step 3 の代替手段なので、電話より先にやる価値がある

---

## 4. 未確認・要調査

- ~~Casualty / Litter Team / Paralyzed Team の実装状況（§6.4.3）と、
  §4.1.4 の「保存コマンド喪失」をどこにフックするか~~
  → 解決。namedFireTeam の駒に L/P/C ヒットが入ると `hit.js` が駒を除去して
  LAT カウンターに置き換えるので、その直前に `loseSavedCommands()` を呼べばよい
- Fire Team 面から command side へ戻す **rally**（§6.5 / §4.2.3）が未実装。
  今は強度を戻す手段が右パネルの手動操作しかない
- §13 Urban の Building Area（Visual-Verbal のエリア判定に影響）は当面対象外でよいか
- 電話線の切断条件（§4.3.4 後半）と §4.2.1k Repair の詳細は未抽出
