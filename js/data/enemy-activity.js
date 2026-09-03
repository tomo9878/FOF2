// ===== 敵活動チェック階層表（§8.6.2 Activity Checks）データ =====
//
// FOF.pdf §8.6（p.66-67・pdftotext で原文確認）は、実際の判定チャート本体を
// 「Charts and Tables player aid」という別コンポーネントに委ねており、
// ルールブック本文には表の中身が印字されていない。
// 3枚の実物チャート画像（images/Chart - Hierarchy - *.png）を目視で確認し、
// 以下へ書き起こした。
//
// ── 表の読み方（§8.6.2 原文）──
//   各カードごとに Pinned/LAT ユニット → Good Order ユニット → Leader の順で判定。
//   Pinned または LAT（Fire/Assault/Litter/Paralyzed Team）は戦術を問わず
//   常に PINNED_LAT_HIERARCHY を使う。それ以外の Good Order ユニットは
//   ミッションの enemyTactics（mission-0X.js）で指定された
//   hierarchy（'offensive'|'defensive'）× column を使う。
//   各表は上から順に見て「最初に条件が当てはまるセクション」を採用し、
//   そのセクション内でカードを1枚引いて印字 R# と比較する。
//
// ── セル値の形式 ──
//   [lo, hi, denom] … その範囲に入れば成立（denom分のR#）
//   'auto'          … ドロー不要で自動成立
//   null            … そのセクション・列では起こらない（"-"）
//
// ⚠ 密なチャート画像の目視書き起こしのため、まれに数字を読み違えている
//    可能性がある（特に Defensive の「Not under fire but has valid target
//    along PDF」「Under fire from a different direction」「Trading fire」
//    セクションと、Pinned/LAT の「Litter Team with Casualty in LOS」セクションは
//    列の合計値が綺麗に揃わず読み取りに自信が低い）。AIの挙動が明らかに
//    おかしい場合は images/Chart - Hierarchy - *.png を直接見て該当セルを
//    再確認すること。

/** Pinned/LAT 階層表（§8.6・常にこちらを使う。戦術を問わない） */
export const PINNED_LAT_HIERARCHY = {
  columns: ['withLeader', 'noLeader'],
  columnLabels: { withLeader: 'Leaderあり', noLeader: 'Leaderなし' },
  sections: [
    {
      key: 'pinned_samecard_nocover',
      label: 'Pinned・敵ユニットと同じカード・カバー下にいない',
      rows: [
        { action: 'no_action',    label: 'No Action',              cols: { withLeader: null,        noLeader: [1, 1, 5] } },
        { action: 'seek_cover',   label: 'Move into or Seek Cover', cols: { withLeader: [1, 2, 4],   noLeader: [2, 2, 5] } },
        { action: 'rally',        label: 'Rally',                   cols: { withLeader: [3, 3, 4],   noLeader: [3, 3, 5] } },
        { action: 'fall_back',    label: 'Fall Back (8.6.3)',       cols: { withLeader: [4, 4, 4],   noLeader: [4, 5, 5] } },
      ],
    },
    {
      key: 'pinned_samecard_cover',
      label: 'Pinned・敵ユニットと同じカード・カバー下にいる',
      rows: [
        { action: 'no_action', label: 'No Action',        cols: { withLeader: [1, 1, 3], noLeader: [1, 2, 5] } },
        { action: 'rally',     label: 'Rally',             cols: { withLeader: [2, 3, 3], noLeader: [3, 3, 5] } },
        { action: 'fall_back', label: 'Fall Back (8.6.3)', cols: { withLeader: null,      noLeader: [4, 5, 5] } },
      ],
    },
    {
      key: 'pinned_nocover',
      label: 'Pinned・カバー下にいない（敵ユニットと同じカードではない）',
      rows: [
        { action: 'no_action',  label: 'No Action',               cols: { withLeader: [1, 1, 3], noLeader: [1, 2, 5] } },
        { action: 'seek_cover', label: 'Move into or Seek Cover', cols: { withLeader: [2, 2, 3], noLeader: [3, 3, 5] } },
        { action: 'rally',      label: 'Rally',                    cols: { withLeader: [3, 3, 3], noLeader: [4, 4, 5] } },
        { action: 'fall_back',  label: 'Fall Back (8.6.3)',        cols: { withLeader: null,      noLeader: [5, 5, 5] } },
      ],
    },
    {
      key: 'pinned_cover',
      label: 'Pinned・カバー下にいる（敵ユニットと同じカードではない）',
      rows: [
        { action: 'no_action', label: 'No Action',        cols: { withLeader: null,   noLeader: [1, 2, 4] } },
        { action: 'rally',     label: 'Rally',             cols: { withLeader: 'auto', noLeader: [3, 3, 4] } },
        { action: 'fall_back', label: 'Fall Back (8.6.3)', cols: { withLeader: null,   noLeader: [4, 4, 4] } },
      ],
    },
    {
      key: 'teams_reconstitute',
      label: 'Fire/Assault Teamが2体以上あり、敵ユニットのカードではない',
      rows: [
        { action: 'reconstitute', label: 'Attempt to Reconstitute Squad', cols: { withLeader: 'auto', noLeader: null } },
      ],
    },
    {
      key: 'assault_on_enemy_card',
      label: 'Assault Team・敵ユニットのカード上',
      rows: [
        { action: 'no_action', label: 'No Action',                        cols: { withLeader: null,   noLeader: [1, 1, 2] } },
        { action: 'grenade',   label: 'Attempt to make a Grenade Attack', cols: { withLeader: 'auto', noLeader: [2, 2, 2] } },
      ],
    },
    {
      key: 'assault_off_enemy_card',
      label: 'Assault Team・敵ユニットのカードではない',
      rows: [
        { action: 'no_action',   label: 'No Action',                            cols: { withLeader: [1, 1, 3], noLeader: [1, 1, 2] } },
        { action: 'infiltrate',  label: 'Infiltrate towards closest opposing unit', cols: { withLeader: [2, 3, 3], noLeader: [2, 2, 2] } },
      ],
    },
    {
      key: 'fireteam_nocover_on_enemy_card',
      label: 'Fire Team・カバー下にいない・敵ユニットのカード上',
      rows: [
        { action: 'no_action',  label: 'No Action',               cols: { withLeader: [1, 1, 4], noLeader: [1, 1, 5] } },
        { action: 'seek_cover', label: 'Move into or Seek Cover', cols: { withLeader: [2, 3, 4], noLeader: [2, 2, 5] } },
        { action: 'fall_back',  label: 'Fall Back (8.6.3)',       cols: { withLeader: [4, 4, 4], noLeader: [3, 5, 5] } },
      ],
    },
    {
      key: 'fireteam_cover_on_enemy_card',
      label: 'Fire Team・カバー下にいる・敵ユニットのカード上',
      rows: [
        { action: 'no_action', label: 'No Action',                        cols: { withLeader: [1, 1, 3], noLeader: [1, 2, 5] } },
        { action: 'grenade',   label: 'Attempt to make a Grenade Attack', cols: { withLeader: [2, 2, 3], noLeader: [3, 3, 5] } },
        { action: 'fall_back', label: 'Fall Back (8.6.3)',                cols: { withLeader: [3, 3, 3], noLeader: [4, 5, 5] } },
      ],
    },
    {
      key: 'leader_on_ft_side',
      label: 'Leader・Fire Team面',
      rows: [
        { action: 'no_action', label: 'No Action', cols: { withLeader: null,   noLeader: [1, 1, 3] } },
        { action: 'rally',     label: 'Rally',       cols: { withLeader: 'auto', noLeader: [2, 3, 3] } },
      ],
    },
    {
      key: 'spotter_sniper_weapon_on_ft_side',
      label: 'Spotter/Sniper/武器チーム・Fire Team面',
      rows: [
        { action: 'no_action', label: 'No Action', cols: { withLeader: null,   noLeader: [1, 1, 2] } },
        { action: 'rally',     label: 'Rally',       cols: { withLeader: 'auto', noLeader: [2, 2, 2] } },
      ],
    },
    {
      key: 'litter_with_casualty_same_area',
      label: 'Litter Team・Casualtyと同エリア（カバー下/外とも）',
      rows: [
        { action: 'no_action', label: 'No Action',                       cols: { withLeader: null,   noLeader: [1, 1, 3] } },
        { action: 'fall_back', label: 'Fall Back with Casualty (8.6.3)', cols: { withLeader: 'auto', noLeader: [2, 3, 3] } },
      ],
    },
    {
      key: 'litter_casualty_in_los',
      label: 'Litter Team・視界内にCasualtyがいる（同エリアではない）',
      note: '⚠ 列合計が綺麗に揃わず読み取り自信が低い。images/Chart - Hierarchy - Pinned_LAT で要再確認',
      rows: [
        { action: 'no_action',       label: 'No Action',                       cols: { withLeader: [1, 1, 2], noLeader: [1, 1, 2] } },
        { action: 'move_to_casualty', label: 'Move towards closest Casualty', cols: { withLeader: [2, 2, 2], noLeader: [2, 3, 3] } },
      ],
    },
    {
      key: 'litter_no_casualty_in_los',
      label: 'Litter Team・視界内にCasualtyがいない',
      rows: [
        { action: 'no_action', label: 'No Action', cols: { withLeader: [1, 1, 2], noLeader: [1, 2, 3] } },
        { action: 'rally',     label: 'Rally',       cols: { withLeader: [2, 2, 2], noLeader: [3, 3, 3] } },
      ],
    },
    {
      key: 'paralyzed_off_enemy_card',
      label: 'Paralyzed Team・敵ユニットのカードではない',
      rows: [
        { action: 'no_action', label: 'No Action', cols: { withLeader: [1, 1, 2], noLeader: 'auto' } },
        { action: 'rally',     label: 'Rally',       cols: { withLeader: [2, 2, 2], noLeader: null } },
      ],
    },
  ],
};

/** Good Order（Offensive）階層表（§8.6・Assault/Overrun 戦術） */
export const OFFENSIVE_HIERARCHY = {
  columns: ['assault', 'overrun'],
  columnLabels: { assault: 'Assault', overrun: 'Overrun' },
  sections: [
    {
      key: 'samecard_nocover',
      label: '敵ユニットと同じカード・カバー下にいない',
      rows: [
        { action: 'no_action',  label: 'No Action',               cols: { assault: [1, 1, 5], overrun: [1, 1, 6] } },
        { action: 'seek_cover', label: 'Move into or Seek Cover', cols: { assault: [2, 3, 5], overrun: null } },
        { action: 'fall_back',  label: 'Fall Back (8.6.3)',       cols: { assault: [4, 4, 5], overrun: [2, 6, 6] } },
        { action: 'advance',    label: 'Advance Straight Ahead',  cols: { assault: null,      overrun: [3, 4, 6] } },
        { action: 'grenade',    label: 'Attempt to make a Grenade Attack', cols: { assault: [5, 5, 5], overrun: [5, 6, 6] } },
      ],
    },
    {
      key: 'samecard_cover',
      label: '敵ユニットと同じカード・カバー下にいる',
      rows: [
        { action: 'no_action', label: 'No Action',              cols: { assault: [1, 1, 5], overrun: [1, 1, 6] } },
        { action: 'fall_back', label: 'Fall Back (8.6.3)',      cols: { assault: [2, 5, 5], overrun: [2, 6, 6] } },
        { action: 'advance',   label: 'Advance Straight Ahead', cols: { assault: null,      overrun: null } },
        { action: 'grenade',   label: 'Attempt to make a Grenade Attack', cols: { assault: [3, 5, 5], overrun: [5, 6, 6] } },
      ],
    },
    {
      key: 'out_of_ammo',
      label: 'A→、G!、H VOF ユニットで Out of Ammo マーカーあり',
      rows: [
        { action: 'no_action', label: 'No Action',              cols: { assault: [1, 2, 3], overrun: [1, 1, 2] } },
        { action: 'fall_back', label: 'Fall Back (8.6.3)',      cols: { assault: [3, 3, 3], overrun: null } },
        { action: 'advance',   label: 'Advance Straight Ahead', cols: { assault: null,      overrun: [2, 2, 2] } },
      ],
    },
    {
      key: 'pdf_valid_target',
      label: 'A→、G!、H VOF ユニットで PDF 沿いに有効な目標がいる',
      rows: [
        { action: 'no_action', label: 'No Action',                        cols: { assault: null,      overrun: [1, 1, 4] } },
        { action: 'grenade',   label: 'Grenade Attack (or Concentrate Fire)', cols: { assault: 'auto', overrun: [2, 3, 4] } },
        { action: 'advance',   label: 'Advance Straight Ahead',           cols: { assault: null,      overrun: [4, 4, 4] } },
      ],
    },
    {
      key: 'all_other',
      label: 'それ以外の状況',
      rows: [
        { action: 'no_action',   label: 'No Action',                              cols: { assault: [1, 1, 4], overrun: null } },
        { action: 'infiltrate',  label: 'Infiltrate towards closest opposing unit', cols: { assault: [2, 3, 4], overrun: [1, 1, 3] } },
        { action: 'advance',     label: 'Advance Straight Ahead',                 cols: { assault: [4, 4, 4], overrun: [2, 3, 3] } },
      ],
    },
  ],
};

/** Good Order（Defensive）階層表（§8.6・Delay/Hasty/Deliberate 戦術） */
export const DEFENSIVE_HIERARCHY = {
  columns: ['delay', 'hasty', 'deliberate'],
  columnLabels: { delay: 'Delay', hasty: 'Hasty', deliberate: 'Deliberate' },
  sections: [
    {
      key: 'samecard_nocover',
      label: '敵ユニットと同じカード・カバー下にいない',
      note: '⚠ Deliberate列のNo Action/Grenadeの割り振りは読み取り自信が低い（合計が1マス余る）。要再確認',
      rows: [
        { action: 'no_action',  label: 'No Action',                        cols: { delay: [1, 1, 5], hasty: [1, 1, 4], deliberate: [2, 2, 3] } },
        { action: 'seek_cover', label: 'Move into or Seek Cover',          cols: { delay: [2, 2, 5], hasty: [2, 2, 4], deliberate: [1, 1, 3] } },
        { action: 'fall_back',  label: 'Fall Back (8.6.3)',                cols: { delay: [3, 4, 5], hasty: [3, 3, 4], deliberate: null } },
        { action: 'grenade',    label: 'Attempt to make a Grenade Attack', cols: { delay: [5, 5, 5], hasty: [4, 4, 4], deliberate: [3, 3, 3] } },
      ],
    },
    {
      key: 'samecard_cover',
      label: '敵ユニットと同じカード・カバー下にいる',
      rows: [
        { action: 'no_action', label: 'No Action',                        cols: { delay: [1, 1, 3], hasty: [1, 1, 3], deliberate: null } },
        { action: 'fall_back', label: 'Fall Back (8.6.3)',                cols: { delay: [2, 3, 3], hasty: [2, 3, 3], deliberate: null } },
        { action: 'grenade',   label: 'Attempt to make a Grenade Attack', cols: { delay: null,      hasty: null,      deliberate: [1, 3, 3] } },
      ],
    },
    {
      key: 'out_of_ammo',
      label: 'A→、G!、H VOF ユニットで Out of Ammo マーカーあり',
      rows: [
        { action: 'no_action', label: 'No Action',         cols: { delay: null,   hasty: [1, 2, 2] } },
        { action: 'fall_back', label: 'Fall Back (8.6.3)', cols: { delay: 'auto', hasty: [2, 3, 3] } },
      ],
    },
    {
      key: 'no_fire_no_los',
      label: '被弾しておらず、敵ユニットへのLOSも無い',
      rows: [
        { action: 'remove_pc', label: 'Remove unit; place PC marker (8.6.2)', cols: { delay: 'auto', hasty: 'auto', deliberate: 'auto' } },
      ],
    },
    {
      key: 'pdf_valid_target',
      label: '被弾していないが、PDF沿いに有効な目標がいる',
      note: '⚠ 読み取り自信が低い（列合計の整合が取りづらい）。要再確認',
      rows: [
        { action: 'no_action', label: 'No Action',                            cols: { delay: [1, 2, 3], hasty: [1, 1, 2] } },
        { action: 'grenade',   label: 'Grenade Attack (or Concentrate Fire)', cols: { delay: [3, 3, 3], hasty: [2, 2, 2] } },
      ],
    },
    {
      key: 'under_fire_nocover',
      label: '被弾しており、カバー下にいない',
      rows: [
        { action: 'no_action',  label: 'No Action',                            cols: { delay: [1, 1, 5], hasty: [1, 1, 5] } },
        { action: 'seek_cover', label: 'Move into or Seek Cover',              cols: { delay: [2, 3, 5], hasty: [2, 3, 5] } },
        { action: 'grenade',    label: 'Grenade Attack (or Concentrate Fire)', cols: { delay: [4, 5, 5], hasty: [4, 4, 5] } },
        { action: 'fall_back',  label: 'Fall Back (8.6.3)',                    cols: { delay: null,      hasty: [5, 5, 5] } },
      ],
    },
    {
      key: 'under_fire_diff_direction',
      label: '被弾方向が自分のPDFと違う方向',
      note: '⚠ 読み取り自信が低い。要再確認',
      rows: [
        { action: 'no_action',   label: 'No Action',                            cols: { delay: [1, 1, 4], hasty: [1, 2, 5] } },
        { action: 'grenade',     label: 'Grenade Attack (or Concentrate Fire)', cols: { delay: [2, 2, 4], hasty: null } },
        { action: 'shift_pdf',   label: 'Shift PDF to direction of incoming fire', cols: { delay: [3, 4, 4], hasty: [3, 4, 5] } },
        { action: 'fall_back',   label: 'Fall Back (8.6.3)',                    cols: { delay: null,      hasty: [5, 5, 5] } },
      ],
    },
    {
      key: 'opened_fire',
      label: 'A→ または H VOF ユニットで、既に PDF を出している',
      rows: [
        { action: 'no_action',    label: 'No Action',                       cols: { delay: [1, 2, 3], hasty: null } },
        { action: 'concentrate',  label: 'Attempt to Concentrate Fire',     cols: { delay: [3, 3, 3], hasty: [2, 3, 3] } },
      ],
    },
    {
      key: 'trading_fire_better',
      label: '撃ち合い中で自分のVOFが相手より有利',
      note: '⚠ 読み取り自信が低い。要再確認',
      rows: [
        { action: 'no_action', label: 'No Action',                            cols: { delay: [1, 2, 3], hasty: [1, 2, 5] } },
        { action: 'grenade',   label: 'Grenade Attack (or Concentrate Fire)', cols: { delay: [3, 3, 3], hasty: [3, 5, 5] } },
      ],
    },
    {
      key: 'trading_fire_worse',
      label: '撃ち合い中で自分のVOFが相手と同等以下',
      note: '⚠ 読み取り自信が低い。要再確認',
      rows: [
        { action: 'no_action', label: 'No Action',                            cols: { delay: [1, 3, 4], hasty: [1, 3, 5] } },
        { action: 'grenade',   label: 'Grenade Attack (or Concentrate Fire)', cols: { delay: null,      hasty: [4, 5, 5] } },
        { action: 'fall_back', label: 'Fall Back (8.6.3)',                    cols: { delay: [4, 4, 4], hasty: null } },
      ],
    },
  ],
};

export const HIERARCHIES = {
  offensive: OFFENSIVE_HIERARCHY,
  defensive: DEFENSIVE_HIERARCHY,
};

/** 行動キー → 日本語ラベル（右パネル表示用） */
export const ACTION_LABELS = {
  no_action: 'No Action（何もしない）',
  seek_cover: 'カバーへ移動/カバー捜索',
  rally: 'Rally（Pinned解除 or LAT変換）',
  fall_back: 'Fall Back（8.6.3）',
  reconstitute: 'Reconstitute Squad',
  grenade: 'Grenade Attack（またはConcentrate Fire）',
  concentrate: 'Concentrate Fire',
  infiltrate: '浸透（最寄りの敵へ）',
  advance: 'Advance Straight Ahead（前進）',
  remove_pc: '除去してPCマーカーを置く',
  shift_pdf: 'PDFを被弾方向へシフト',
  move_to_casualty: '最寄りのCasualtyへ移動',
};
