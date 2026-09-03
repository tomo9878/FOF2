# アクション（§4.2）実装計画

コマンド系（§3.3 / §4.1）と通信（§4.3）が完成した時点で、**残る最大の穴**が §4.2。
コマンドを「何に使うか」が無いため、`canGiveOrder()` / `canCommunicate()` /
`isOnCommandSide()` が実装済みなのに呼ばれていない。

---

## 1. 操作モデルの決定

**これまでの「APを人間が減らして駒は自由に動かす」方式は採らない。**
指揮系統・通信・Fire Team 面・消費上限のチェックが全部あるため、
自由移動だと制約が効かず、実装済みの判定が意味を持たなくなる。

代わりに **「命令を出す → 判定 → 1コマンド消費 → 効果を適用」** に統一する。

### 分類の軸は「移動かどうか」ではなく **「Auto かカードを引くか」**

移動側にも Auto とドローの両方があり、移動しないアクションにも両方ある。
「駒が動かないから自動で進めてよい」は**誤り**（Spot もカバー捜索もカードを引く）。

プロジェクトの核心方針「**カードを引く操作は必ず人間が行う**」に直結するので、
ドロー型を自動化してはいけない。

### 実装の型は4種類

| 型 | 内容 | 状況 |
|---|---|---|
| ① Auto ＋ 対象=駒 | 命令→消費→効果 | **実装済**（Activate §4.2.1a / Runner f-h / 修理 k / 拾う 4.2.2h / 網載せ替え j） |
| ② ドロー ＋ 対象=駒 | 命令→消費→**人間が1枚ずつ引く**→成否→効果 | **実装済**（Rally §4.2.3・`rally.js`） |
| ③ 対象=カード（行き先選択あり） | 命令→行き先選択→消費→移動＋Exposed | **実装済**（移動 §4.2.2a/b/f・`move.js`） |
| ④ ドロー ＋ 対象=敵/カード | ③＋専用修正表・弾薬・マーカー | 戦闘 §4.2.4 |

ドロー型は戦闘解決・PC解決で使っている **手動ドロー＋ドローロック機構**をそのまま流用する。

---

## 2. 着手順（推奨）

**Rally（§4.2.3）→ 移動（§4.2.2）→ 戦闘（§4.2.4）**
→ **Rally・移動（Auto分）は完了。戦闘（§4.2.4）は8アクション（k/l/b/c/d/h/a/i）を実装済み**
　（`combat-action.js`・`fire-mission.js`・弾薬管理は`ammo.js`）。残りは e-g（Demo・Flamethrower）/
　j（On-Map Mortar・Battalion/FPF/Illumination/TOT/AirStrike）/ m（FPF/FPL）— いずれも新規の下位システムが要る

Rally を先にする理由:
1. 8アクションが**ほぼ同じ形**（「VOF があれば2枚引いて "Rally" を探す／無ければ自動成功」）。
   1つ作れば残りはデータ差分だけ
2. **空間選択が要らない**ので、ドロー型の型づくりに集中できる
3. **§4.2.3f「Fire Team 面を表に戻す試み」**が含まれる。
   → 既知の課題「rally で command side に戻す手段が無い」がここで埋まる

**§4.2.2 c/g（浸透）・e（カバー捜索）の UI 接続（2026-09-03）**: ロジックは元々 `move.js` に
実装済みだったが、右パネルへのボタン配線が無く未使用だった。`context-menu.js` の `_moveHtml`/
`_bindMoveButtons` に追加接続した。
- c（隣接カードへ浸透）: `listMoveTargets` で得た通常移動可能な隣接カードのうち、
  `planInfiltrate(unitId, coord).ok` なもの全てに「浸透」ボタンを併記（コスト・発令者は通常移動と共用）
- g（カード内浸透）: `planInfiltrate(unitId, null).ok` かつ移動先エリアがある場合のみ表示
- e（カバー捜索）: `planSeekCover(unitId).ok` なら表示。成功時は Rally と同じ「ドローロック→人間が
  1枚ずつ引く」方式（`_startInfiltrate`/`_drawInfiltrateCard`・`_startSeekCover`/`_drawSeekCoverCard`）。
  カバー捜索が成功した場合、**発見したカバーの種別は人間が `COVER_TYPES` から選んで配置**する
  （物理カードのカバー種別チャートまではデータ化していないための簡略化。NCM手動調整やAmmo補給と
  同じ「人間の裁量に委ねる」設計方針を踏襲）
- 浸透失敗時は`applyInfiltrate`が自動的に通常移動（Exposed付き）にフォールバックする、既存の`move.js`の
  仕様通り。ローカルサーバー（`npx serve`）で実機動作確認済み（隣接浸透の成功/失敗フォールバック・
  カバー捜索の成功→種別選択→配置まで一通り）

**§4.2.2d（小隊浸透）の実装（2026-09-03）**: FOF.pdf p.23の原文を`pdftotext`で確認したところ、
d は b（movePlatoonToAdjacent）のような「小隊全員で1回だけ判定」ではなく、
**"Have each unit in the platoon perform an Attempt to Infiltrate an Adjacent Card action"**
＝「小隊の各駒が個別に c（Attempt to Infiltrate）を行う」仕組みだった。つまり対象選定（同カード・
Good Order・非Exposed・通信可）は b と同じだが、判定は駒ごとに独立した2(+/-)ドロー
（枚数は各駒自身の練度で変わる）になる。`move.js`に`planPlatoonInfiltrate`を追加し
（対象集めのみ・コスト消費や移動はしない）、`context-menu.js`に`combat-action.js`の
プラトーン系キュー（Grenade/Concentrate Fire）と同型の「1体ずつドロー→次へ」キュー
（`_startPlatoonInfiltrate`/`_drawPlatoonInfCard`/`_advancePlatoonInf`）を新設して接続した。
コストは b と同じく小隊まとめて2（`expendCommand`を2回）。通信できない駒はその場に残る。
カバースロット選択は b と同じ簡略化（移動先は常にカバー外）。ローカルサーバーで、
1体が浸透失敗→通常移動+Exposed、別の1体が浸透成功→Exposedなし、という個別結果が
同一の小隊浸透アクション内で両立することを実機確認済み。

---

## 3. 調査済みデータ（出典: FOF.pdf p.22-26）

### §4.2.2 Movement Actions（p.23）— 🟡 a / b / f を実装（move.js）

**移動は「盤内カバー移動」と「カード間移動」の2種類ではなく8種類ある。**
- a / b / f（Auto）… 実装済み
- **c / g（浸透）… 実装済み**（`CARD_ICONS` の `infiltrate` で判定）
- **e（カバー捜索）… 実装済み**（`COVER_DRAW` の枚数を引き `type==='cover'` を探す）
- **d（小隊浸透）… 実装済み**（`planPlatoonInfiltrate`。b の対象集め＋c の個別ドローの組み合わせ）
- h（拾う）… comm.js に実装済み

> 当初「Infiltrate アイコンと Cover Draw のデータが無い」と書いたが**誤り**だった。
> どちらも元データ（`cards.json` の `action_attempt.icons` / `terrain_cards.json` の
> `cover_draw`）に最初から入っており、JS モジュールへ取り込まれていなかっただけ。

**移動後の更新処理**（moveToAdjacent がまとめて行う）
1. 1コマンド消費（小隊移動は2）
2. **カードを離れる瞬間に電話線を1本敷設**（§4.3.4）
   ※ 誰が電話線を携行しているかは未データ化のため、
     **電話（EE8等）を持つ駒が電話線も携行している**とみなしている
3. 出発地のカバースロットから外す
4. 駒を移動（`moveUnitToCard`）
5. 移動先のカバースロットへ入れる（選択時）
6. **Exposed 付与**（§5.1.2 の例外あり）
7. `board:changed` 発火 → 活動レベル再計算・命令範囲の再描画・自動保存


見出しに **「Use Recipient's Experience Level for Command draw modifier」**
＝ ドロー修正は発令者ではなく**対象の練度**を使う。

| | アクション | コスト | Draw | 備考 |
|---|---|---|---|---|
| a | Move to an Adjacent Card | 1 | **Auto** | 移動先で **Exposed**。移動先にカバーがあれば入れてよい。**塹壕/バンカー/トーチカ間**（5.1.2）と Attached Buildings 間（13.7）は Exposed が付かない。対象は「Exposed でない Good Order 駒」 |
| b | Move a Platoon to an Adjacent Card | **2** | Auto | 発令者は **PLT HQ**。同カードにいる自小隊の Good Order・非Exposed 駒が全部同じカードへ。**発令者と通信できていない駒はその場に残る** |
| c | Attempt to Infiltrate an Adjacent Card | 1 | **2 (+/−)** | 出発地か目的地に VOF が必要。三脚シンボル/H VOF は不可。成功すると **Exposed が付かない** |
| d | Attempt to have a Platoon Infiltrate an Adjacent Card | **2** | **2 (+/−)** | PLT HQ。c を小隊全員で行う。通信できない駒は残る |
| e | Attempt to Seek Cover | 1 | **Cover Draw 枚数** | カードの Cover Draw 数だけ引き "Cover" を探す。成功で新しいカバーマーカーの下へ＋**Exposed** |
| f | Move within a Card | 1 | **Auto** | 同じカードの別エリアへ。**Exposed** |
| g | Attempt to Infiltrate within a Card | 1 | **2 (+/−)** | カードに VOF が必要。成功で Exposed 無し。**失敗したら通常の Move within a Card を行う** |
| h | Pick up, load, unload, embark | 1 | Auto | 実装済み（RT 回収で使用）。**Exposed** |

補足: Pinned 駒は隣接カードへ移動する前に、運んでいる物資・死傷者を**捨てる**必要がある（§5.1.6E）。

### §4.2.3 Rally Actions（p.24）— ✅ 実装済（rally.js）
判定の本体は **§6.5.1（p.48）**:
> success is automatic if there is **no VOF on the card**, otherwise draw 2 cards,
> modified by the **Experience of the unit giving the order**
> (HQ, or Self if attempting in General Initiative),
> and look for the word **"Rally"** in the Action Attempt Section.

- 対象のカードに VOF が無ければ **自動成功**
- VOF があれば **2枚 ± 発令者の練度**（Vet +1 / Green −1）を引き、
  `type === 'rally'` のカードが1枚でもあれば成功
- 見出しは「Use **Originator's** Experience Level」＝ **発令者**の練度。
  移動（§4.2.2）が **Recipient** なのと逆なので注意


ほぼ全部が **「Draw 2 (+/−)、ただしそのカードに VOF が無ければ Auto」** で、
引いたカードに **"Rally"** の語があれば成功、無ければ何も起きない（§6.5.1）。

| | アクション | コスト | Draw | 対象 |
|---|---|---|---|---|
| a | Attempt to Remove a Pinned marker | 1 | 2 (+/−) / VOF無ければAuto | Pinned マーカーの下の任意の駒 |
| b | Attempt to Convert a Paralyzed Team to a Litter Team | 1 | 同上 | Unpinned な Paralyzed Team |
| c | Attempt to Convert a Litter Team to a Fire Team | 1 | 同上 | Unpinned な Litter Team |
| d | Attempt to Convert a Fire Team to an Assault Team | 1 | 同上 | Unpinned な Fire Team |
| e | Convert an Assault Team to a Fire Team | 1 | **Auto** | Unpinned な Assault Team |
| f | **Attempt to Flip a unit with a Fire Team Side to Front** | 1 | 同上 | Unpinned な named Fire Team（**発令者HQ自身も対象にできる**） |
| g | Detach Team | 1 | **Auto** | Good Order の3-4ステップ分隊 or 2ステップ武器チーム |
| h | Supplement Squad | 1 | **Auto** | Good Order の2-3ステップ分隊＋Unpinned な Fire/Assault Team → Team を除去して分隊に1ステップ足す |
| i | Attempt to Reconstitute Squad | 1 | **2 (+/−)**（VOF無しでも自動にならない） | 2〜4個の Unpinned な Assault/Fire Team → 以前に Removed from Play になった同ステップ数の分隊と入れ替える。§4.1.3 の「HQ/Staff が発令者必須」 |
| j | Flip a unit with a Fire Team side to its Fire Team side | 1 | **Auto** | Good Order の named Fire Team 持ち → 裏（Fire Team 面）へ |

**実装状況**: a〜j 全て `rally.js`/`reconstitute.js` に実装（2026-08-31 g/h、2026-09-03 i）。
g（Detach Team）は `detachFireTeam`/`detachAssaultTeam`（detach.js）を Rally 経由（AP消費・HQ通信チェック込み）で
呼び出す形に統合。従来 context-menu.js の右クリックメニューにあった無料の分離/Supplementボタンは
AP消費を回避できてしまうため削除し、Rally パネル経由の実装に一本化した。
h（Supplement Squad）は既存 `supplementUnit`（detach.js）を流用。対象は「1ステップだけ分離済みの分隊」
（`detachedLATsMap` に1件登録されている状態）かつ分離先 Team が Unpinned であることを条件化。

**i（Reconstitute Squad）の実装（2026-09-03）**: `js/reconstitute.js` を新設。
FOF.pdf p.47-50（`pdftotext`で原文確認）で「Removed from Play」の発生条件を特定：
分隊が Fire/Assault Team だけを残して盤上から完全に消える瞬間（hit.js の各 Hit
A/F/L/P/C・コンボヒットにある「消滅閾値」分岐＝ `steps===2` で `removeUnitFromCard`
する箇所、計6箇所）がこれにあたる。この6箇所に `recordSquadRemoved(unitId, faction, maxSteps)`
を追加し、`{unitId, faction, maxSteps}` を `removedSquadPool`（play層・persistence.js
PLAY_VERSION 3）に積む。§6.5.1 の Design Note「汎用LATの出自は追跡しない」を踏まえつつ、
汎用分隊カウンターの絵が存在しない実装上の制約から、**「消えた分隊そのもの」を復活させる簡略化**
を採用（同じ maxSteps が複数消えている場合、どれが戻るかはプールの並び順で決まる）。
UI はカード右クリックメニュー（`card-context-menu.js`・PC解決と同じ「右パネルへドローロック付き
ステップ制フローを描く」方式）に配置：対象カードの Unpinned Fire/Assault Team 数と
プールの在庫から選べるステップ数(2〜4)をセレクトで示し、発令者HQを選んで「再編を試みる」。
成功時は使った Team の種別（全て Assault Team なら Line、それ以外は Green）で
`setUnitExperience` する（p.50の規定通り）。
**既知の制限**: 動的に生成されるLAT（`unit.id+'_HIT_FT'`等）は`findUnitDef`が解決できないstatic-registry非登録のIDのため、
`command.js`の`_isLAT()`はこれをLAT扱いできない。PLT HQは「自分の小隊のユニットかLAT」にしか命令できない
仕様（Command Reference Table）だが、この`_isLAT`判定漏れにより、**PLT HQは自分の小隊由来（IDが自小隊prefixで
始まる）のTeamしか動かせず、他小隊由来の汎用Teamを使ったReconstitute発令はできない**（CO HQ/BN HQなら
階級ベースの判定経路を通るため問題なく発令できる）。これは本実装固有の問題ではなくcommand.jsの既存仕様
（他のRallyアクションでも同じ制約が理論上ある）だが、Reconstituteは複数Teamを集める性質上、実際にこの
制限に触れやすい。修正には`_isLAT`をID命名規則ベースの判定に拡張する必要があり、今回は見送った。

### §4.2.4 Combat Actions（p.24-26）— 🟡 8アクション（k/l/b/c/d/h/a/i）実装済み（combat-action.js・fire-mission.js）
**13アクション（a〜m）**。ほとんどがドロー付きで、周辺ルールを芋づるで引く。

a. Attempt to Spot（1／2枚＋**Spotting Attempt Draw Modifiers Chart**／Crosshairs を探す・§8.5）— **実装済み**（combat-action.js。C&C値はdefLow固定・対象VOFレーティング修正は未対応の既知の簡略化つき）
b. Attempt to Concentrate Fire（1／2(+/−)／**弾薬を2消費**・§7.11）— **実装済み**（弾薬消費は ammo.js 経由で成功時+1のみ対応。§7.11.3 通り）
c. Attempt to have a Platoon Concentrate Fire（**2**／PLT HQ）— **実装済み**
d. Attempt to make a Grenade Attack（1／2(+/−)）— **実装済み（Point Blank＝同カードのみ。Ranged は未対応）**
e. Attempt to Throw a Demolition Charge／f. Place a Demolition Charge／g. Flamethrower Attack — **未実装**（demo-capable/flamethrower フラグが units-normandy.js に無い）
h. Attempt to have a Platoon make a Grenade Attack — **実装済み**
i. Call for Fire from an Off-Map Firing Agency（§7.16）— **実装済み**（fire-mission.js。Mission1のHE/WPのみ。Battalion Fire Mission・Registered Targetsは未）／ j. Call for Indirect Fire from an On-Map Mortar（§7.16）— **未実装**
k. Cease Fire — **実装済み**（card-context-menu.js の射撃統制セクション）
l. Shift Fire — **実装済み**（PDF は移動先で人間が再設置）
m. Fire FPF/FPL — **未実装**（FPL マーカー機構が無い）

対象の選び方が独特: 本来は**「カバー下のスタック」か「露天からランダムに1駒」**を選ぶが、
Tier1 実装では既存の `cardVOFMap`（1カード1VOF・ユニット非帰属）の簡略化に合わせて
**カード全体を対象**にしている（詳細は combat-action.js 冒頭コメント「既知の簡略化」）。

---

## 4. 実装で気をつける点

- **Exposed の付与と例外**が移動のあちこちに絡む。付ける/付けないを一箇所にまとめる
- §4.2.2b の「通信できない駒は置き去り」は `canGiveOrder()` がそのまま答えを出せる。
  命令範囲の可視化（🔦）で暗く見えている駒がそのまま置き去りになる駒
- ドロー修正は**対象の練度**（§4.2.2 見出し）。`applyCommandModifiers()` は
  コマンド取得用で発令者基準なので、**別関数にする**こと
- Rally 系の「VOF が無ければ Auto」は `cardVOFMap` を見るだけ
- §4.2.5 に Pinned・LAT のアクション制限がある（未抽出）。Rally 実装時に確認する
