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
| ③ 対象=カード（行き先選択あり） | 命令→行き先クリック→消費→移動＋Exposed | 移動 §4.2.2 |
| ④ ドロー ＋ 対象=敵/カード | ③＋専用修正表・弾薬・マーカー | 戦闘 §4.2.4 |

ドロー型は戦闘解決・PC解決で使っている **手動ドロー＋ドローロック機構**をそのまま流用する。

---

## 2. 着手順（推奨）

**Rally（§4.2.3）→ 移動（§4.2.2）→ 戦闘（§4.2.4）**
→ **Rally は完了。次は移動（§4.2.2）**

Rally を先にする理由:
1. 8アクションが**ほぼ同じ形**（「VOF があれば2枚引いて "Rally" を探す／無ければ自動成功」）。
   1つ作れば残りはデータ差分だけ
2. **空間選択が要らない**ので、ドロー型の型づくりに集中できる
3. **§4.2.3f「Fire Team 面を表に戻す試み」**が含まれる。
   → 既知の課題「rally で command side に戻す手段が無い」がここで埋まる

---

## 3. 調査済みデータ（出典: FOF.pdf p.22-26）

### §4.2.2 Movement Actions（p.23）
見出しに **「Use Recipient's Experience Level for Command draw modifier」**
＝ ドロー修正は発令者ではなく**対象の練度**を使う。

| | アクション | コスト | Draw | 備考 |
|---|---|---|---|---|
| a | Move to an Adjacent Card | 1 | **Auto** | 移動先で **Exposed**。移動先にカバーがあれば入れてよい。**塹壕/バンカー/トーチカ間**（5.1.2）と Attached Buildings 間（13.7）は Exposed が付かない。対象は「Exposed でない Good Order 駒」 |
| b | Move a Platoon to an Adjacent Card | **2** | Auto | 発令者は **PLT HQ**。同カードにいる自小隊の Good Order・非Exposed 駒が全部同じカードへ。**発令者と通信できていない駒はその場に残る** |
| c | Attempt to Infiltrate an Adjacent Card | 1 | **2 (+/−)** | 出発地か目的地に VOF が必要。三脚シンボル/H VOF は不可。成功すると **Exposed が付かない** |
| d | （未確認） | | | 抽出できていない。次に触るとき p.23 を再確認する |
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

**実装状況**: a〜f と j を `rally.js` に実装。
g（Detach）は既存の `detach.js` があるので未統合、
h（Supplement）と i（Reconstitute）は分隊のステップ／
「Removed from Play になった分隊」の管理が要るため未実装。

### §4.2.4 Combat Actions（p.25-26）
**13アクション（a〜m）**。ほとんどがドロー付きで、周辺ルールを芋づるで引く。

a. Attempt to Spot（1／2枚＋**Spotting Attempt Draw Modifiers Chart**／Crosshairs を探す・§8.5）
b. Attempt to Concentrate Fire（1／2(+/−)／**弾薬を2消費**・§7.11）
c. Attempt to have a Platoon Concentrate Fire（**2**／PLT HQ）
d. Attempt to make a Grenade Attack（1／2(+/−)）
e〜i（未抽出）／ j. Call for Indirect Fire（§7.16）／ k. Cease Fire ／ l. Shift Fire ／ m. Fire FPF/FPL

対象の選び方が独特: **「カバー下のスタック」か「露天からランダムに1駒」**を選ぶ。

---

## 4. 実装で気をつける点

- **Exposed の付与と例外**が移動のあちこちに絡む。付ける/付けないを一箇所にまとめる
- §4.2.2b の「通信できない駒は置き去り」は `canGiveOrder()` がそのまま答えを出せる。
  命令範囲の可視化（🔦）で暗く見えている駒がそのまま置き去りになる駒
- ドロー修正は**対象の練度**（§4.2.2 見出し）。`applyCommandModifiers()` は
  コマンド取得用で発令者基準なので、**別関数にする**こと
- Rally 系の「VOF が無ければ Auto」は `cardVOFMap` を見るだけ
- §4.2.5 に Pinned・LAT のアクション制限がある（未抽出）。Rally 実装時に確認する
