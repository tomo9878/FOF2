# Fields of Fire 実装ロードマップ（ルールブック全13章 × 実装状況）

Series Rules 3rd Edition の目次と現状実装を照合した棚卸し。
凡例： ✅ 完成 ／ 🟡 部分実装 ／ ⬜ 未実装 ／ ⛔ 当面対象外

---

## 章別 実装状況マトリクス

### 1.0 Introduction（概念・コンポーネント）
| 節 | 状況 | メモ |
|----|------|------|
| 1.1〜1.2 概念・コンポーネント | ✅ | 実装不要（理解のみ） |

### 2.0 Preparing for a Mission（ミッション準備）
| 節 | 状況 | メモ |
|----|------|------|
| 2.1 キャンペーン/ミッション選択 | 🟡 | シナリオ定義7本あり。**選択UIなし**（Mission1固定） |
| 2.2 マップ設定 | ✅ | rows×cols配置・Hill重ね |
| 2.3 中隊編成 | 🟡 | 駒プール初期配置あり。**HQへの編成割当(Mission Log)なし** |
| 2.4 戦術参照点(LOD/LOA/境界/Objective) | ⬜ | 勝利条件テキストのみ。マーカー表示なし |
| 2.5 スタートエリア | ✅ | 表示あり |
| 2.6 戦闘パトロール | ⛔ | Mission1は通常攻勢。Mission3/5がCombat Patrolタイプ（PDF確認済）。MSRで「General Initiativeの全ドローを半分・切り捨て（3.3.2d）」という唯一のコマンドフェーズ計算式の変更あり |
| 2.7 空挺/上陸計画 | ⛔ | シナリオ固有 |
| 2.8 アクションカードデッキ | ✅ | deck.js（50枚） |
| 2.9 プレイ開始 | 🟡 | 状態保存で開始状態は復元 |

### 3.0 Sequence of Play（ターン進行）— ★コアループの骨格
| 節 | 状況 | メモ |
|----|------|------|
| 3.1 友軍上位HQイベント | 🟡 | カード引き→HQイベント表。ミッションごとに内容が違う（PDF確認済＝FoF_Deluxe_Normandy_Campaign.pdf）。攻勢系(1,2,4,6,7)はほぼ共通テンプレ＋確率差、Combat Patrol系(3,5)は全く別イベントセット。**Mission1データは`scenario-tables.js`汎用エンジン＋`mission-01.js`の`tables.friendlyHigherHQEvents`/`enemyHigherHQEvents`に投入済み**。フェーズ処理・UI接続は未 |
| 3.2 敵活動フェーズ(防衛) | ⬜ | 防衛ミッション用 |
| 3.3 友軍コマンドフェーズ | ✅ | 7インパルスの順序制御を右パネル「🎖 インパルス」で実装（BN HQ→CO HQ起動→PLT/Staff起動→CO HQ Init→PLT Init→CO Staff Init→General Init）。該当しないユニットの取得ボタンは理由つきで無効化。クリーンアップで先頭へ戻る。 **ゲームの心臓部**。起動→コマンド取得→消費。インパルス順序を FOF.pdf p.15-16（§3.3.1/§3.3.2）で確認済：**起動セグメント**①BN HQ→②CO HQ→③PLT HQ/CO Staff（CO HQに起動された分のみ）／**イニシアチブセグメント**④CO HQ Init→⑤PLT HQ Init→⑥CO Staff Init（**カードを引かず固定1・修正なし**）→⑦General Initiative（HQ不要・誰にでも使える・save不可・単一小隊ミッションは半減）。実装は現状インパルス概念なし（ユニット個別に引くだけ） |
| 3.4 敵活動フェーズ(攻撃) | ⬜ | |
| 3.5 相互捕虜・退却 | ⬜ | |
| 3.6 AT戦闘・車両移動 | ⛔ | 車両は対象外 |
| 3.7 相互戦闘 | 🟡 | 戦闘解決(6.4)は手動ドローで実装済。PC解決(§8.2.4)・接触タイプ判定(§8.3)は実装済。Pinned回復は未 |
| 3.8 クリーンアップ | ⬜ | マーカー除去・Exposed解除・AP繰越 |
| 3.9 再挑戦 | ⬜ | データに reattempts:1 のみ |
| （フェーズ全体） | 🟡 | **名前表示だけ**。各フェーズ処理は未 |

### 4.0 Command & Control（指揮）— ★コアループ
| 節 | 状況 | メモ |
|----|------|------|
| 4.1 コマンド | ✅ | AP箱(command.js)＋取得UI(HQ選択→カード引き自動加算/手動±)＋No Contact+1 ✅。消費上限6/4・繰越上限(Green3/2・Line6/4・Vet9/6)のテーブル値は §4.1.3(p.20) と一致 ✅。**FOF.pdf p.18-20(§4.1.1〜4.1.3)と突き合わせた未実装/ズレ**：(a)~~起動の階層が無い~~ **修正済**：§4.1.1 Command Reference Table(p.18)を `CAN_ACTIVATE` としてデータ化（BN HQ→CO HQ／CO HQ→CO Staff・全下位HQ／CO Staff・PLT HQ→起動不可）。右パネルのチェックは起動されうる役職にだけ出し、ラベルも「BN HQに起動された」「CO HQに起動された」と役職別に切替 (b)~~BN HQインパルス~~ **修正済**：右パネルに「🏛 BN HQ インパルス」枠を追加し、状態4種（盤外・通信可／盤外・通信不通／盤上／使用不能）から解決。盤外＋通信可→CO HQを自動起動（カード非消費）、盤上→最大6/4を`BN_HQ`仮想ユニットへ付与、使用不能/通信不通→起動なし。BN HQは繰越不可（`getCarryoverMax`=0）でクリーンアップ時に使い残しを破棄。状態はplay層に保存 (c)~~CO Staffのイニシアチブ~~ **修正済**：カードを引かず固定1・修正適用外にした（command.js `hasFixedInitiative`/`CO_STAFF_INITIATIVE_COMMANDS`。デッキ非消費をブラウザで確認） (d)~~`setActivated(true)`の意味がルールとズレ~~ **修正済**：`activated`（上位HQに起動された）と `drawn`（このターン取得済み＝Activation Completed相当）を別フラグに分離。イニシアチブで引いても activated は立たない。取得後はボタンを無効化し二重取得を防止。クリーンアップフェーズ（§3.8）で `resetImpulseFlags()` により両フラグを落とす（保有コマンドは残す）。※`activated`の意味が変わるため persistence.js の PLAY_VERSION を 2 に更新 (e)~~General Initiative Impulse 未実装~~ **修正済**：右パネルに「⭐ General Initiative」枠を追加。人間がカードを引き、★（イニシアチブ値）をそのまま取得（§4.1.2の修正は乗らない）。単一小隊ミッションは半分・切り捨て（シナリオの`singlePlatoon`／`missionType==='combat_patrol'`から判定）。繰越不可でクリーンアップ時に破棄。共有プールは仮想ユニット`GENERAL_INIT` (f)~~修正はNo Contact+1のみ~~ **修正済**：§4.1.2 A/B/C 全部（Pinned-1/Green-1/Vet+1/Cover+1/VOF S-1・A-2・H/S!/Grenade/Incoming/AirStrike-3/No Contact+1）＋最低値クランプ（起動=1・イニシアチブ=0）を command.js `getCommandModifiers`/`applyCommandModifiers` に実装。UIに内訳を表示。※ルール本文に列挙の無いVOF（Mines/BoobyTrap/Demo/Pending/Illum/P）は修正0として扱う (g)~~Saved Commandsゾーンが無い~~ **修正済**：右パネルに「⏹ インパルス終了（残りを Save）」を追加。`finishImpulse()` が残りコマンドを繰越上限（§4.1.3 Green3/2・Line6/4・Vet9/6）で切り捨てて保存し、超過分の破棄数を表示。保存分はクリーンアップを跨いで残る（`resetImpulseFlags`はフラグだけ落とす）。BN HQ・General Initiativeは上限0なので全部破棄。**消費上限（1インパルス6/4・§4.1.3 p.20）のチェックも実装済**：`expendCommand`/`canExpendCommand`/`getSpentThisImpulse` で消費カウンタを持ち、上限に達したら右パネルの「－」を無効化。＋は取り消し扱いでカウンタも戻す。インパルス終了・クリーンアップでカウンタをリセット。General Initiative は "any HQ or Staff" の文言に該当しないため上限の対象外。**起動セグメントの順序制御・配下への配分も実装済**：(1) §4.2.1a Activate（1コマンド・自動成功）を CO HQ / BN HQ の右パネルにボタン化。分隊・武器チーム・LAT・上位HQ・自分自身は起動不可、二重起動不可、AP不足/消費上限で不可。(2) 命令の発令可否 `canGiveOrder()` を Command Reference Table の「Can give other orders to」列から実装（BN HQ=全員／CO HQ・CO XO・1st Sgt・GySgt=自分より下位のみ／PLT HQ=自小隊＋全LAT／HQ以外は発令不可）。CO Staff の序列は `staffRank`（xo/1sgt）で細分。(3) インパルス順序 `IMPULSE_SEQUENCE`（BN HQ→CO HQ起動→PLT/Staff起動→CO HQ Init→PLT Init→CO Staff Init→General Init）を右パネルで制御し、該当しないユニットの取得ボタンを理由つきで無効化。クリーンアップで先頭へ戻る。**§4.1.4 の Fire Team 面チェックも実装済**（COMMUNICATION_SPEC.md Step0）：`isOnCommandSide()`＝`namedFireTeam` かつ `steps === maxSteps`。発令者・対象のどちらかがB面なら Activate 不可（§4.2.1a）、B面のHQは自分にしか命令できない、BN HQ の自動起動もB面ならスキップ、L/P/C ヒットで LAT 化した HQ/Staff は保存コマンド全喪失。**残る未実装は Attachment の小隊割当（§2.3.2 Mission Log）と、B面から表へ戻す rally（§6.5）** |
| 4.2 アクション | 🟡 | §4.2.1 C&C アクションは実装済（Activate a / Runner f-h / 網載せ替え j / 電話線修理 k / 拾う 4.2.2h）。**§4.2.3 Rally も実装済**（rally.js・a〜f と j。VOF無しなら自動成功／あれば「2±発令者の練度」枚引いて `type:'rally'` を探す・§6.5.1）。**§4.2.2 移動も a（隣接カード）/ b（小隊移動・通信できない駒は置き去り）/ f（カード内移動）を実装済**（move.js。Exposed 付与と §5.1.2 の塹壕/バンカー/トーチカ例外、カバーの出入り、離脱時の電話線自動敷設まで）。移動の **c/g（浸透）と e（カバー捜索）はロジックのみ move.js に実装済み**（`planInfiltrate`/`applyInfiltrate`/`planSeekCover`/`applySeekCover`。当初「Infiltrate アイコン/Cover Draw 番号が未データ化」と書いたが誤りで、元データ `cards.json`/`terrain_cards.json` に最初から入っていた）が、**右パネルへの UI 接続（ドローロック連動のカードドローフロー）はまだ無い**（`context-menu.js` は a/b/f のみ呼んでいる）。d（小隊浸透）は未実装。Rally の g/h/i も未。**§4.2.4 戦闘は Tier1（k/l/b/c/d/h の6アクション）を実装済み**（`combat-action.js`）：k. Cease Fire／l. Shift Fire（Auto・card-context-menu.js の射撃統制セクション）、b/c. Concentrate Fire（単体/小隊・2(+/−)枚引きCrosshairs判定→Concentratedマーカー）、d/h. Grenade Attack（単体/小隊・Point Blankのみ・2(+/−)枚引きGrenade判定→成功でGrenade VOF／失敗でGrenade Missマーカー）。UIは context-menu.js の「§4.2.4 戦闘アクション」セクション（ブラウザで動作確認済み・エラーなし）。**既知の簡略化**: VOFがカード単位でユニット非帰属のためCease Fire/Shift Fireの通信チェックは発令者のHQ/Staff判定のみ、Concentrate Fireの資格（S/A/A/S/H VOFレーティング）はunits-normandy.jsに該当フィールドが無く未チェック、対象は「カード全体」（本来はカバー下スタック/露天1駒）。**未実装（a・e-g・i-j・m）は§8.5スポット修正表・弾薬管理・Fire Missionログ等の新規下位システムが要るため見送り**。**調査済みの実装計画は ACTION_SPEC.md**（Auto/ドローの4類型・着手順 Rally→移動→戦闘・各アクションのコスト/Draw表つき） |
| 4.3 通信(無線/電話/ランナー) | ✅ | **§4.3.1 Visual-Verbal を `comm.js` に実装済**（Step1）：`canCommunicate(from,to,orderKind)`。同エリア判定は `coord#slotId`（カバー外は `coord#open`）で、同じカードでも別カバーなら別エリア。Pinned 例外（Remove Pinned / Exhort）と同カード伝達（Cease Fire / Shift Fire）も対応。**§4.3.3 ネットワーク＋§4.3.5 無線も実装済**（Step2）：`data/radios.js` に RT 機種（SCR536=A / SCR300・SCR610=B / ICOM=C / EE8=電話）と5ネットワーク（CO TAC / BN TAC / ARTY FD / MTR FD / AIR CTL）を定義。`canReachByRadio()` が A=両端カバー外＋LOS、B=同一網なら盤外含め無条件、C=同・隣接カードを判定。網の資格（BN TAC は CO HQ・BN HQ・BN Staff のみ 等）も `canUseNetwork()` でチェック。CO TAC は CO HQ をハブとして経由必須と解釈。機種混在時は厳しい方の世代を適用。**§4.3.2 ランナーも実装済**（Step4・`runner.js`）：作成(§4.2.1f・対象を1ステップ減らす)／派遣(§4.2.1g・Exposed)／解散(§4.2.1h・1ステップ戻す。受け取り手は**CO HQ と同じカードの同じエリア**にいる Good Order の非満タンユニット。払ったユニットである必要は無い)、同時2体まで。CO HQ 起動インパルスに入った瞬間に `resolveRunnerDeliveries()` で配達を解決し、成功なら対象を Activate。Pinned・Fire Team 面・対象不在/別カードは**その時点で失敗確定**（`failed` フラグ。後から届いたりはしない）。**§4.3.4 電話も実装済**（Step3・`phone.js`）：電話線マーカー（在庫つき）＋8方向隣接の接続グラフ。電話機自体とスタートエリアも電話線として機能する。CO TAC は CO HQ の電話が接続に含まれること、他網はスタートエリア到達が必要。カバー下・Pinned でも通る。戦闘損害（Incoming/AirStrike で R#1/2 切断、Good Order の敵のみのカードで R#1-2/3 切断）と §4.2.1k 修理、敷設・回収をカード右クリックに実装。**§4.3 全体を指揮判定に統合済**（Step5）：`canGiveOrder()` は ①指揮系統 → ②通信 の2段判定、`canActivateTarget()` も §4.1.1「in play and in communication」を要求、`resolveBNHQImpulse()` は BN TAC で実際に CO HQ と通信できるかを確認する。循環参照を避けるため `setCommunicationChecker()` で comm.js を注入（map.js が接続）。**Mission1 の通信資産も投入済**（Step6・campaign p.12 TO&E ＋ p.13 CSR1）：CO HQ=SCR300 BN TAC＋SCR536 CO TAC／CO XO・PLT HQ=SCR536／**CO 1st Sgt は無線なし**／BN HQ=SCR300 BN TAC／右パネルで CO TAC を EE8 電話（線4本）へ切替可（Combat Patrol は不可）。§2.5A のスタートエリア LOS 例外（内どうし・隣接row1 は SCR536 でも通信可）も実装済。**RT の損害〜復旧の一連も実装済**：最後のステップが Casualty になると R#1/2 で RT が破壊（Removed from Play）、残ればカードに落ちる（§4.3.4/§4.3.5）。§4.2.2h で1コマンド払って拾う（拾った駒は Exposed）、§4.2.1j で同型 RT を「破壊された網」へ載せ替える。hit.js の Casualty 経路3か所から自動で判定が走る。**未実装は COMMUNICATION_SPEC.md「3.5 棚卸し」の4件**（移動時の自動敷設／防御ミッションの事前敷設と Reattempt 再配置／盤外電話／BN Staff の CO TAC 条件）。ルール調査は完了し実装計画を COMMUNICATION_SPEC.md にまとめた（FOF.pdf p.27-28 §4.3.1〜4.3.5 ＋ campaign PDF p.13 CSR1）。要点: Visual-Verbal=両者Unpinned＆同カード同エリア／SCR536(タイプA)はLOS必須かつ**カバー下で機能しない**／SCR300(タイプB)は同一網ならどこでも／ノルマンディーはCO TAC=SCR536・攻勢ミッションのみEE8電話(電話線4本)に置換可・Combat Patrolは電話禁止・ランナー開始時0。Step0〜6の実装順も同ファイル |
| 4.4 発煙・照明(Pyrotechnics) | ⬜ | |

### 5.0 Movement, LOS & Terrain
| 節 | 状況 | メモ |
|----|------|------|
| 5.1 移動 | 🟡 | ドラッグ移動可。**§4.2.2 の命令としての移動を実装**（move.js）：1コマンド消費・隣接判定・**Exposed化と §5.1.2 の例外**（塹壕/バンカー/トーチカ間は付かない）・カバーの出入り・§4.2.5 Pinned の移動先制限・§4.3.4 離脱時の電話線自動敷設。**浸透 c/g・カバー捜索 e はロジックのみ実装済みで UI 未接続**（詳細は 4.2 アクションの行を参照）。**§5.1.6E の物資投棄・Jitter/Stagger は未** |
| 5.2 地形・LOS | 🟡 | 地形防御データ✅。**LOS(射線)判定エンジン実装済み(los.js)**：8方向・Close/Long/VeryLongレンジ・Hill標高越え対応。副産物としてncm.jsの地形防御バグ（open/dark border判定が逆だった）を修正。**§8.4等への実戦投入・Urban例外は未** |
| 5.3 カバー | ✅ | 12種・スロット・収容上限 |
| 5.4 煙幕・LOS遮断 | ⬜ | |

### 6.0 Combat（戦闘）
| 節 | 状況 | メモ |
|----|------|------|
| 6.1 交戦/射撃開始(Opening Fire) | ⬜ | **誰が撃つか・射撃開始判定**。今はVOF手動配置 |
| 6.2 VOFマーカー | ✅ | 直接・エリア全種 |
| 6.3 PDFマーカー | ✅ | 8方向・Crossfire自動 |
| 6.4 戦闘解決・効果 | ✅ | NCM→HIT/PIN/MISS→Hit効果（手動ドロー） |
| 6.5 Rally・再編 | 🟡 | **§6.5.1 Rally 実装済**（rally.js）：VOF無しなら自動成功／あれば「2±発令者の練度」枚引いて `type:'rally'` を探す。Pinned解除・LAT変換(Paralyzed→Litter→FT→AT)・Fire Team面の表裏に対応。**§6.5.2 Reconstitute（分隊/HQの再編）は未** |

### 7.0 Weapons & Fire Support（武器・火力支援）
| 節 | 状況 | メモ |
|----|------|------|
| 7.1-7.9 各種武器 | 🟡 | VOF種別で表現。固有ルールは未 |
| 7.10 Grenade Attack | 🟡 | VOF種別あり。**§4.2.4d/h Attempt to make a Grenade Attack を実装**（combat-action.js）：Point Blank（同カード）のみ・2(+/−)枚引きGrenadeアイコン判定・成功でGrenade VOF・失敗でGrenade Missマーカー（vof.js `setGrenadeMiss`・ncm.js で-1加算、単独なら実質-1 VOF扱い）。**Ranged Grenade Attack（射程・PDF追従・G!レーティング）・Critical Hit・Jam・弾薬消費・Free Grenade Attack Response(7.10.5)は未** |
| 7.11 Concentrated Fire | 🟡 | NCMに口あり。**§4.2.4b/c Attempt to Concentrate Fire を実装**（combat-action.js）：2(+/−)枚引きCrosshairsアイコン判定・成功でConcentratedFireマーカー（vof.js `setConcentrate`）。対象はカード全体（本来はカバー下スタック/露天ランダム1駒）。**Recipientの資格チェック（S/A/A/S/H VOFレーティング）はunits-normandy.jsに該当フィールドが無いため未対応。弾薬消費・Critical Hit・Jamは未** |
| 7.12 Jam | 🟡 | カードに jam あり。処理未 |
| 7.13 Demolition Charge | ⬜ | |
| 7.14 Flamethrower | ⬜ | |
| 7.15 Sniper | ⬜ | VOF S! は一旦除去済 |
| 7.16 間接砲撃(Fire Mission) | ⬜ | 砲兵・迫撃・観測員。Mission1にArty FOデータあり |
| 7.17 WP煙幕/CSガス | ⬜ | |
| 7.18 弾薬(Ammunition) | ⬜ | HMG/迫撃砲の残弾管理 |

### 8.0 The Enemy（敵）— ★コンタクトレベルが活きる部分
| 節 | 状況 | メモ |
|----|------|------|
| 8.1 敵接触(活動レベル) | ✅ | 4段階自動算出・表示・更新 |
| 8.2 PCマーカー | 🟡 | 配置✅・ドローチャートデータ✅・**接触するか判定(pc-resolve.js)✅**（カード右クリック「PC解決」） |
| 8.3 接触タイプ判定 | ✅ | 敵パッケージ表(enemy-contact.js)。Mission1データ投入済み（German Contact Packages・Enemy Force Packages）。PC解決フローに接続済み。パッケージ内の追加ランダム判定（武器種別LMG/HMG・FO種別Artillery/Mortar・追加装備有無等）も実装済み（`choices`+`resolveValueSpec`、R#明記時はその比率／なければ§1.2.7の一般則でdenom=2）。**Squad袋引き（Grenadier Gp1-4、"Draw one at random each time a squad is placed."）を実装（rating A/A/A/S を画像確認・units-normandy.jsに反映）。HMG/LMG/迫撃砲/スポッターは装備プール（順番割当）で解決** |
| 8.4 接触位置 | 🟡 | 距離判定(placement.js)実装済み：Point Blank/Close/Long/Very Long固定距離 + Max LOS/Range（los.jsで実際にLOSが届く最遠カードを算出）。R#条件付き距離（Strong Point等の共有ロール）も対応。方向(§8.4.2)はカード右クリックのPC解決フローから「配置方向」ドローとして接続済み（enemy-placement.js resolveDirection）。§8.4.5 マップ拡張も実装済み（grid.js expandMapEdge・terrain-deck.js）。**§8.4.3 実際のユニット生成・配置も実装済み**（enemy-placement.js placeResolvedUnits → addUnitToCard で盤面に実配置。Squad袋引き/装備プールで解決できたものだけ自動配置し、Sniper・FLAK 36・Patrol等の未定義ユニットは「手動配置してください」と明示）。**cover探索・友軍との重なり回避・PDF/VOF自動付与は未** |
| 8.5 敵スポット | ⬜ | unspotted状態はあるがスポット判定なし |
| 8.6 敵の挙動(Behavior) | ⬜ | 敵AI（Activity Check） |
| 8.7 地雷・ブービートラップ | ⬜ | VOF種別あり、パッケージ処理未 |
| 8.8 敵スナイパー | ⬜ | |
| 8.9 敵リーダー | ⬜ | |
| 8.10 敵間接砲撃観測員 | ⬜ | |
| 8.11 敵弾薬 | ⬜ | |
| 8.12 敵車両・AT | ⛔ | |
| 8.13 狂信(Fanaticism) | 🟡 | fanatic状態あり、処理未 |
| 8.14 人海戦術(Human Wave) | 🟡 | human_wave状態あり、処理未 |
| 8.15 捕虜 | ⬜ | |

### 9.0 Visibility（視界）
| 節 | 状況 | メモ |
|----|------|------|
| 9.0 視界 | 🟡 | setVisibility実装・NCM接続済。**UI(トグル)なし** |
| 9.1 限定視界効果 | 🟡 | NCM/AP上限に反映済 |
| 9.2 照明(Illumination) | ⬜ | |
| 9.3 暗視装置 | ⬜ | |

### 10.0 Vehicle Movement & AT Combat
| 節 | 状況 | メモ |
|----|------|------|
| 10.x 車両・対戦車戦闘 | ⛔ | ノルマンディー基本は歩兵中心。後フェーズ |

### 11.0 Transportation & Assault Planning
| 節 | 状況 | メモ |
|----|------|------|
| 11.x ヘリ・上陸 | ⛔ | シナリオ固有 |

### 12.0 Playing a Campaign（キャンペーン）
| 節 | 状況 | メモ |
|----|------|------|
| 12.1 ミッション中の経験値獲得 | ⬜ | Experience Points |
| 12.2 ミッション間シーケンス | ⬜ | |
| 12.3 経験値の使用(昇格) | 🟡 | campaign.js に promoteUnit あり。獲得・消費フロー未 |
| 12.4 補充(Replacements) | ⬜ | |
| 12.5-12.8 その他損失・スキル・勝利 | ⬜ | |

### 13.0 Urban Warfare（市街戦）
| 節 | 状況 | メモ |
|----|------|------|
| 13.x 市街戦 | ⛔ | 専用ルール。後フェーズ |

---

## 未実装の優先度（コアループを回す順）

### ★P1：ゲームを「回る」状態にする（最優先）
1. ~~**コマンドフェーズのコアループ**（3.3 + 4.1）~~ **完成**（7インパルスの順序制御・取得・修正・消費上限・繰越・起動アクション）
2. ~~**PC解決ロジック**（8.2.4 + 8.3）~~ **完成**
3. ~~**通信**（4.3）~~ **完成**（Visual-Verbal / 無線A・B・C / 電話・電話線 / ランナー ＋ 指揮判定への統合）
4. **アクション体系（4.2）→ 実装計画は ACTION_SPEC.md（調査済み・Rally→移動→戦闘の順）**。
   §4.2.2 移動・§4.2.3 Rally・§4.2.4 戦闘（Tier1: k/l/b/c/d/h）は実装済みで、
   `canGiveOrder()` / `canCommunicate()` を経由してコマンドが「何に使われたか」に繋がった。
   残りは移動d・Rally g/h/i・戦闘の a（Spot）/e-g（Demo/Flamethrower）/i-j（間接砲撃）/m（FPF/FPL）

### ★P2：戦闘の流れを繋ぐ
5. **射撃開始(Opening Fire)/スポット**（6.1 + 8.5）— 誰がいつVOFを出すか
6. **移動ルール**（5.1）— 移動でExposed化、移動とAP消費の連動（4.2.2 と一体）
7. **クリーンアップ処理**（3.8）— Exposed解除・Pinned回復（3.7.3）・電話線の戦闘損害の呼び出し
8. **Visibility UI**（9.0）— 昼/夜トグル（関数は実装済、繋ぐだけ・小さい）

### ★P3：1ターンの完成度を上げる
7. フェーズ自動進行と各フェーズ処理（3.1〜3.8）
8. Rally・再編（6.5）
9. 間接砲撃(Fire Mission)・弾薬管理（7.16 + 7.18）— Mission1にArty FOあり
10. ~~Concentrate/Grenade Miss フラグ（7.11/7.10）~~ **完成**（§4.2.4b/c/d/h・combat-action.js）。Jam（7.12）は未

### ★P4：敵の厚み
11. 敵の挙動(Activity Check)（8.6）
12. 地雷・スナイパー・捕虜・人海・狂信（8.7/8.8/8.15/8.14/8.13）
13. 上位HQイベント表（3.1）

### ★P5：キャンペーン継続
14. 経験値獲得・ミッション間・補充（12.x）
15. シナリオ選択UI・Mission2以降のデータ投入（2.1）
16. 戦術参照点 LOD/LOA/Objective 表示（2.4）

### ⛔ 当面対象外
- 車両・AT戦闘（10）／ヘリ・上陸（11）／市街戦（13）／戦闘パトロール（2.6）
  → ノルマンディー歩兵キャンペーンのコアが固まってから

---

## R#（ランダムナンバー）データ — 解決済み

カード画像50枚を実際に確認し、R#印字値が以下の式で正確に再現できることを確認・実装済み：

```
R#(denom, カード番号) = floor((カード番号-1) × denom / 50) + 1
```

（R#/10列は5枚ずつ完全に均等＝各10%であることを画像から実測で確認）。
`scenario-tables.js` の `rollR()` は Math.random ではなく**共有デッキ(deck.js)から実際に
カードを1枚引いて**この式で計算する。戦闘解決・コマンド取得と同じデッキを消費するため、
デッキの減り方・リシャッフルタイミングも物理ゲームと一致する。

---

## まとめ：今どこにいるか

**指揮系統（誰が誰に命令できるか）と通信（届くか）はルールどおり動くようになった。**
コマンドの取得・修正・消費上限・繰越、7インパルスの順序、敵の出現（PC解決→接触タイプ→配置）
まで通っている。

**残る最大の穴は §4.2 アクション体系**。コマンドを「何に使うか」が無いため、
`canGiveOrder()` / `canCommunicate()` / `isOnCommandSide()` といった判定が
実装済みなのに呼ばれていない。ここを繋ぐと、既存の実装がまとめて動き始める。

次にやるべきは **P1-4（§4.2 アクション）**。「1コマンド払って命令する」形にすれば、
指揮系統・通信・Fire Team 面・消費上限が同時に効き始める。
**着手順は Rally（§4.2.3）→ 移動（§4.2.2）→ 戦闘（§4.2.4）**。
Rally は8アクションがほぼ同じ形で空間選択も要らないため、ドロー型の型づくりに向く。
詳細は ACTION_SPEC.md。
