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

### Step 1: 通信の骨格 + Visual-Verbal 〈S〉 — ✅ 完了
- 新規 `js/comm.js`：`canCommunicate(fromId, toId, orderKind) → {ok, via, reason}`
- `getAreaKey(unitId)` が「同じエリア」を `coord#slotId`（カバー外は `coord#open`）で表現。
  同じカードでも別の Cover マーカーなら別エリアになる
- Visual-Verbal: 両者 Unpinned ＆ 同エリア
- 例外は `ORDER_KIND` で受ける
  - `REMOVE_PINNED` / `EXHORT` … Pinned を無視して通る
  - `CEASE_FIRE` / `SHIFT_FIRE` … 同じカードなら別エリア・Pinned でも全員に伝わる
- `COMM_METHOD` に RADIO / PHONE の口を用意済み（Step2/3 でここに足す）
- **まだ `canGiveOrder()` / `canActivateTarget()` からは呼んでいない**（統合は Step5）。
  今つなぐと無線未実装のため「同じカードにいないと何もできない」状態になるため

### Step 2: 無線ネットワークと機器データ 〈M〉 — ✅ 完了
- `js/data/radios.js`：`RT_MODELS`（SCR536=A / SCR300・SCR610・PRC25=B / ICOM=C / EE8=電話）と
  `NETWORK_DEF`（CO TAC / BN TAC / ARTY FD / MTR FD / AIR CTL）を定義
- `comm.js`：`unitRTMap` に RT の保有を持たせ（`assignRT` / `getRTs` / `clearRTs`）、
  `canReachByRadio()` と `canUseNetwork()` を追加。`canCommunicate()` は
  Visual-Verbal → 無線 の順に試す
- 世代ごとの到達条件（§4.3.5）
  - A: **両端がカバー外** ＆ `los.hasLOS()` が通ること ＆ 盤上どうし
  - B: 同一網なら無条件（盤外とも可）
  - C: `los.cardDistance()` が 1 以下（同一・隣接カード）
- ネットワーク資格（§4.3.3）: BN TAC は CO HQ・BN HQ・BN Staff のみ、
  ARTY FD は Arty FO のみ… を `canUseNetwork()` でチェック。
  ユニット定義側は `radioRole`（'arty_fo' 等）で表現する
- RT は play 層に保存し、`resetPlay()` で消える（Step6 でシナリオから再投入する）

**解釈の判断（要注意）**
- §4.3.3-1 の「CO HQ の RT がハブで、他の RT はここに繋がる必要がある」を
  **どちらか一方の端が CO HQ であること** と実装した。
  PLT HQ ↔ PLT HQ の直接通信は不可（CO HQ 経由が必要）という読み。
- 両端で機種が違う場合は **厳しい方の世代** を適用する（A > C > B）。
  ルールに明記が無いので、弱い側の無線に引きずられる自然な読みを採った。

### Step 3: 電話と電話線 〈L〉 — ✅ 完了
- 新規 `js/phone.js`。`phoneLineMap`（coord → {cut}）＋ 在庫 `phoneLineStock`
- 接続判定 `getPhoneNodes()` / `reachableThroughLines()`：8方向隣接をたどる幅優先探索。
  電話線として機能するノードは
  ①生きた電話線マーカーのカード ②電話機を持つユニットのいるカード
  （電話機自体が電話線として働く・§4.3.4）③スタートエリア（電話線が組み込まれている）
- `canReachByPhone()`：CO TAC は **CO HQ の電話が接続に含まれる**こと、
  それ以外の網は **スタートエリアに到達**することを要求
- `comm.js` の `canCommunicate()` は Visual-Verbal → 無線 → **電話** の順に試す
- 戦闘損害 `checkPhoneLineCombatDamage()`（§4.3.4 p.29）
  - Incoming!/Air Strike! の VOF があるカード → **R#1/2** で切断
  - Good Order の敵がいて Good Order の友軍がいないカード → **R#1-2/3** で切断
  - R# は `scenario-tables.js` の `rollR()`＝共有デッキから実際に1枚引く方式
- §4.2.1k 修理（切れた線を表に戻す）と、敷設・回収をカード右クリックメニューに実装
- 描画は `Asset - Phone Line.png` / `Asset - Phone Line - cut.png`
- 状態は play 層に保存。`resetPlay()` で消える（Step6 でシナリオから再投入）

**未実装として残した点**
- 敷設は本来「電話線を割り当てられたユニットが**カードを離れるときに自動で1本置く**」
  （命令不要・§4.3.4）。移動フックが無いので当面は手動で置く／回収する
- 電話機そのものの損害（最後の1ステップが Casualty → 1/2 で電話破壊、
  壊れなければ盤上に落ちて拾える・§4.2.2h）は未対応
- 盤外ユニットの電話（BN TAC を電話で運用する場合の Staging Area 接続）は未対応
- 防御ミッションの事前敷設（MLR より後方へ配置・p.11）と、
  §3.9 Reattempt 時の Secured カードへの再配置（p.17）は未対応

**外部チェックリストとの突き合わせで確認・修正した点**
- 「Adjacent」は用語集 p.6 で **斜めを含む8方向**と定義されている
  （"Including diagonals, there are eight possible adjacent cards"）。
  電話線の接続も8方向でよい（チェックリストの「直交のみ」は誤り）
- §2.5A（p.12）に **「row 1 の電話機・電話線はスタートエリアのどこの電話とも繋がる」**
  と明記されている。あわせて「スタートエリア内は全カードが電話線で接続済み」
  「スタートエリアと row 1 の隣接カードの間には無線用の LOS がある」も明記
- §4.2.1k 修理に発令者・対象・コストのチェックが無かったので追加
  （`canRepairPhoneLine()` / `repairPhoneLineAction()`）

### Step 4: ランナー 〈M〉 — ✅ 完了（Step3 より先に実施）
- 新規 `js/runner.js`。`US_RUNNER_1/2` の駒は `units-normandy.js` に定義済みのものを使う
- §4.2.1f Create（1コマンド）: **対象を1ステップ減らして** Line 評価のランナーを箱に置く。
  LAT が対象なら駒ごと除去。同時に2体まで（`MAX_RUNNERS`）
- §4.2.1g Dispatch（1コマンド）: 対象（PLT HQ / CO Staff）のカードへ置き Exposed にする
- §4.2.1h Dismiss（1コマンド）: 取り除いて1ステップ戻す。受け取り手の条件は
  ①Good Order ②満タンでない ③**CO HQ と同じカードの同じエリア**（§4.3.1 のエリア）。
  作成時に払ったユニットである必要は無い
- `resolveRunnerDeliveries()` を CO HQ 起動インパルスに入った瞬間に呼ぶ（map.js）
- 状態は play 層に保存。`resetPlay()` で消える（ノルマンディーは開始時0体）

**ルールの読み違いを1回して直した箇所**
- 当初「Pinned の間は留まり、Good Order に戻ったら配達する」と実装したが、
  §4.3.2 を読み直すと **Pinned になった時点で配達は失敗**で、
  「Good Order に戻った最初の CO HQ インパルスで**箱に帰るだけ**」が正しい。
  `failed` フラグを持たせて、失敗後は二度と届かないようにした。
- 同様に **ランナー自身が Fire Team 面**になった場合も失敗（§4.3.2 の文言どおり）

**ゲーム的な含意**: ランナーは作るのに1ステップ払う（解散で1ステップ戻る）ので、
電話が使えるミッションでは電話の方が安い。攻勢ミッションで EE8 が選べる理由がここ。

**外部チェックリストとの突き合わせで判明した点**
- Good Order の定義は用語集 p.7「any infantry unit that is not a Limited Action Team
  and is not Pinned」。LAT を除外していなかったので `isGoodOrder()` を修正した
- §3.3.1a/§4.1.1: BN HQ が使えなくても**盤上にランナーがいれば** CO HQ インパルスを行う
  （＝ CO HQ イニシアチブへ飛ばさない）。BN HQ パネルの注記に反映した
- 「Create の対象は CO HQ と同じカードにいること」という制限は**ルールに無い**。
  §4.2.1f の Recipient は「Any Good Order unit or Unpinned Assault/Fire Team」のみ。
  実際に効くのは §4.3 の一般則「発令者は対象と通信できること」なので、
  無線・電話で届く相手なら別カードでもよい。→ 判定は Step5 の統合で入る

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
