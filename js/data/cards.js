// ノルマンディー地形カード一覧
export const TERRAIN_CARDS = [
  { id:'N01', name:'丘',          file:'N01 Hill.jpg' },
  { id:'N02', name:'丘',          file:'N02 Hill.jpg' },
  { id:'N03', name:'丘',          file:'N03 Hill.jpg' },
  { id:'N04', name:'丘',          file:'N04 Hill.jpg' },
  { id:'N05', name:'丘',          file:'N05 Hill.jpg' },
  { id:'N06', name:'丘',          file:'N06 Hill.jpg' },
  { id:'N07', name:'湿地',        file:'N07 Marsh.jpg' },
  { id:'N08', name:'湿地',        file:'N08 Marsh.jpg' },
  { id:'N09', name:'果樹園',      file:'N09 Orchard Grove.jpg' },
  { id:'N10', name:'果樹園',      file:'N10 Orchard Grove.jpg' },
  { id:'N11', name:'果樹園',      file:'N11 Orchard Grove.jpg' },
  { id:'N12', name:'果樹園',      file:'N12 Orchard Grove.jpg' },
  { id:'N13', name:'果樹園',      file:'N13 Orchard Grove.jpg' },
  { id:'N14', name:'果樹園',      file:'N14 Orchard Grove.jpg' },
  { id:'N15', name:'果樹園',      file:'N15 Orchard Grove.jpg' },
  { id:'N16', name:'果樹園',      file:'N16 Orchard Grove.jpg' },
  { id:'N17', name:'森',          file:'N17 Woods.jpg' },
  { id:'N18', name:'森',          file:'N18 Woods.jpg' },
  { id:'N19', name:'森',          file:'N19 Woods.jpg' },
  { id:'N20', name:'森',          file:'N20 Woods.jpg' },
  { id:'N21', name:'森',          file:'N21 Woods.jpg' },
  { id:'N22', name:'森',          file:'N22 Woods.jpg' },
  { id:'N23', name:'森',          file:'N23 Woods.jpg' },
  { id:'N24', name:'森',          file:'N24 Woods.jpg' },
  { id:'N25', name:'ボカージュ',  file:'N25 Hedgerow Bocage.jpg' },
  { id:'N26', name:'ボカージュ',  file:'N26 Hedgerow Bocage.jpg' },
  { id:'N27', name:'ボカージュ',  file:'N27 Hedgerow Bocage.jpg' },
  { id:'N28', name:'ボカージュ',  file:'N28 Hedgerow Bocage.jpg' },
  { id:'N29', name:'ボカージュ',  file:'N29 Hedgerow Bocage.jpg' },
  { id:'N30', name:'ボカージュ',  file:'N30 Hedgerow Bocage.jpg' },
  { id:'N31', name:'ボカージュ',  file:'N31 Hedgerow Bocage.jpg' },
  { id:'N32', name:'ボカージュ',  file:'N32 Hedgerow Bocage.jpg' },
  { id:'N33', name:'ボカージュ',  file:'N33 Hedgerow Bocage.jpg' },
  { id:'N34', name:'ボカージュ',  file:'N34 Hedgerow Bocage.jpg' },
  { id:'N35', name:'ボカージュ',  file:'N35 Hedgerow Bocage.jpg' },
  { id:'N36', name:'ボカージュ',  file:'N36 Hedgerow Bocage.jpg' },
  { id:'N37', name:'村',          file:'N37 Village.jpg' },
  { id:'N38', name:'村',          file:'N38 Village.jpg' },
  { id:'N39', name:'村',          file:'N39 Village.jpg' },
  { id:'N40', name:'村',          file:'N40 Village.jpg' },
  { id:'N41', name:'開けた野原',  file:'N41 Open Fields.jpg' },
  { id:'N42', name:'開けた野原',  file:'N42 Open Fields.jpg' },
  { id:'N43', name:'開けた野原',  file:'N43 Open Fields.jpg' },
  { id:'N44', name:'開けた野原',  file:'N44 Open Fields.jpg' },
  { id:'N45', name:'谷',          file:'N45 Gully Draw.jpg' },
  { id:'N46', name:'谷',          file:'N46 Gully Draw.jpg' },
  { id:'N47', name:'谷',          file:'N47 Gully Draw.jpg' },
  { id:'N48', name:'谷',          file:'N48 Gully Draw.jpg' },
  { id:'N49', name:'農場',        file:'N49 Farm.jpg' },
  { id:'N50', name:'農場',        file:'N50 Farm.jpg' },
  { id:'N51', name:'農場',        file:'N51 Farm.jpg' },
  { id:'N52', name:'農場',        file:'N52 Farm.jpg' },
  { id:'N53', name:'農場',        file:'N53 Farm.jpg' },
  { id:'N54', name:'教会',        file:'N54 Church.jpg' },
  { id:'N55', name:'墓地',        file:'N55 Cemetery.jpg' },
];

// ===== アクションカード =====
//
// フィールド説明:
//   n       : カード番号 (1–50)
//   act     : 起動コマンド数 (Activated Commands)
//   init    : 自発コマンド数 (Initiative Commands)
//   type    : アクション種別 'cover'|'contact'|'rally'|'jam'|'short'
//   hMax    : Combat Resolution — これ以下のNCMはHIT (-99=HITなし)
//   pMax    : Combat Resolution — これ以下のNCM(かつhMaxより大)はPIN (-99=PINなし)
//             → NCM > pMax は MISS
//   hit     : Hit Effect { vet, line, green } — 1〜2文字 (C/P/L/F/A)
//
// hMax / pMax の読み方:
//   NCM ≤ hMax          → HIT
//   hMax < NCM ≤ pMax   → PIN
//   NCM > pMax          → MISS
//   例: hMax:-2, pMax:+2 → -4〜-2:HIT, -1〜+2:PIN, +3〜+6:MISS
//
// スキャン済みカード画像から全フィールドを抽出 (2026-05-22)

export const ACTION_CARDS = [
  // ── カード 1〜10（全MISS or PINのみ、コマンド多め） ──
  { n: 1, act:6, init:4, type:'cover',   hMax:-99, pMax:-99, hit:{vet:'CC', line:'CC', green:'CC'} },
  { n: 2, act:6, init:4, type:'contact', hMax:-99, pMax:-4,  hit:{vet:'CP', line:'CP', green:'CC'} },
  { n: 3, act:5, init:4, type:'rally',   hMax:-99, pMax:-3,  hit:{vet:'CP', line:'CP', green:'CP'} },
  { n: 4, act:5, init:4, type:'contact', hMax:-99, pMax:-2,  hit:{vet:'CL', line:'CL', green:'CP'} },
  { n: 5, act:5, init:3, type:'cover',   hMax:-99, pMax:-2,  hit:{vet:'CL', line:'CL', green:'CP'} },
  { n: 6, act:5, init:3, type:'rally',   hMax:-99, pMax:-1,  hit:{vet:'CF', line:'CL', green:'CL'} },
  { n: 7, act:5, init:3, type:'cover',   hMax:-99, pMax:-1,  hit:{vet:'CF', line:'CF', green:'CL'} },
  { n: 8, act:5, init:3, type:'contact', hMax:-99, pMax:-1,  hit:{vet:'CF', line:'CF', green:'CF'} },
  { n: 9, act:5, init:3, type:'rally',   hMax:-99, pMax:-1,  hit:{vet:'PC', line:'PC', green:'CF'} },
  { n:10, act:5, init:3, type:'cover',   hMax:-99, pMax:-1,  hit:{vet:'PC', line:'PC', green:'PC'} },

  // ── カード 11〜15（-4のみHIT） ──
  { n:11, act:4, init:3, type:'contact', hMax:-4,  pMax: 0,  hit:{vet:'PC', line:'PC', green:'PC'} },
  { n:12, act:4, init:3, type:'rally',   hMax:-4,  pMax: 0,  hit:{vet:'LC', line:'LC', green:'PC'} },
  { n:13, act:4, init:3, type:'cover',   hMax:-4,  pMax: 0,  hit:{vet:'LC', line:'LC', green:'PC'} },
  { n:14, act:4, init:3, type:'contact', hMax:-4,  pMax: 0,  hit:{vet:'LC', line:'LC', green:'PC'} },
  { n:15, act:4, init:3, type:'rally',   hMax:-4,  pMax: 0,  hit:{vet:'FC', line:'LC', green:'LC'} },

  // ── カード 16〜20（-4〜-3がHIT） ──
  { n:16, act:4, init:3, type:'contact', hMax:-3,  pMax: 1,  hit:{vet:'FC', line:'FC', green:'LC'} },
  { n:17, act:4, init:2, type:'contact', hMax:-3,  pMax: 1,  hit:{vet:'FC', line:'FC', green:'LC'} },
  { n:18, act:4, init:2, type:'contact', hMax:-3,  pMax: 1,  hit:{vet:'FC', line:'FC', green:'FC'} },
  { n:19, act:4, init:2, type:'cover',   hMax:-3,  pMax: 1,  hit:{vet:'PP', line:'PP', green:'FC'} },
  { n:20, act:4, init:2, type:'contact', hMax:-3,  pMax: 1,  hit:{vet:'PP', line:'PP', green:'FC'} },

  // ── カード 21〜25（-4〜-2がHIT） ──
  { n:21, act:4, init:2, type:'rally',   hMax:-2,  pMax: 2,  hit:{vet:'PP', line:'PP', green:'PP'} },
  { n:22, act:4, init:2, type:'contact', hMax:-2,  pMax: 2,  hit:{vet:'PL', line:'PL', green:'PP'} },
  { n:23, act:4, init:2, type:'cover',   hMax:-2,  pMax: 2,  hit:{vet:'PL', line:'PL', green:'PP'} },
  { n:24, act:4, init:2, type:'rally',   hMax:-2,  pMax: 2,  hit:{vet:'PL', line:'PL', green:'PP'} },
  { n:25, act:3, init:2, type:'cover',   hMax:-2,  pMax: 2,  hit:{vet:'PF', line:'PF', green:'PP'} },

  // ── カード 26〜30（-4〜-1がHIT） ──
  { n:26, act:3, init:2, type:'contact', hMax:-1,  pMax: 3,  hit:{vet:'PF', line:'PF', green:'PL'} },
  { n:27, act:3, init:2, type:'rally',   hMax:-1,  pMax: 3,  hit:{vet:'PF', line:'PF', green:'PL'} },
  { n:28, act:3, init:2, type:'cover',   hMax:-1,  pMax: 3,  hit:{vet:'PF', line:'PF', green:'PL'} },
  { n:29, act:3, init:2, type:'cover',   hMax:-1,  pMax: 3,  hit:{vet:'C',  line:'C',  green:'PL'} },
  { n:30, act:3, init:2, type:'rally',   hMax:-1,  pMax: 3,  hit:{vet:'C',  line:'C',  green:'PF'} },

  // ── カード 31〜35（-4〜0がHIT） ──
  { n:31, act:3, init:2, type:'cover',   hMax: 0,  pMax: 4,  hit:{vet:'C',  line:'C',  green:'PF'} },
  { n:32, act:3, init:2, type:'contact', hMax: 0,  pMax: 4,  hit:{vet:'C',  line:'C',  green:'PF'} },
  { n:33, act:3, init:2, type:'rally',   hMax: 0,  pMax: 4,  hit:{vet:'C',  line:'C',  green:'C' } },
  { n:34, act:3, init:2, type:'cover',   hMax: 0,  pMax: 4,  hit:{vet:'P',  line:'C',  green:'C' } },
  { n:35, act:3, init:1, type:'cover',   hMax: 0,  pMax: 4,  hit:{vet:'P',  line:'P',  green:'C' } },

  // ── カード 36〜39（-4〜+1がHIT、+6=MISS） ──
  { n:36, act:3, init:1, type:'rally',   hMax: 1,  pMax: 5,  hit:{vet:'P',  line:'P',  green:'C' } },
  { n:37, act:2, init:1, type:'cover',   hMax: 1,  pMax: 5,  hit:{vet:'P',  line:'P',  green:'C' } },
  { n:38, act:2, init:1, type:'contact', hMax: 1,  pMax: 5,  hit:{vet:'P',  line:'P',  green:'C' } },
  { n:39, act:2, init:1, type:'rally',   hMax: 1,  pMax: 5,  hit:{vet:'L',  line:'P',  green:'P' } },

  // ── カード 40（-4〜+1がHIT、MISSなし） ──
  { n:40, act:2, init:1, type:'contact', hMax: 1,  pMax: 6,  hit:{vet:'L',  line:'P',  green:'P' } },

  // ── カード 41〜45（-4〜+2がHIT、MISSなし） ──
  { n:41, act:2, init:1, type:'contact', hMax: 2,  pMax: 6,  hit:{vet:'L',  line:'L',  green:'P' } },
  { n:42, act:2, init:1, type:'contact', hMax: 2,  pMax: 6,  hit:{vet:'L',  line:'L',  green:'P' } },
  { n:43, act:2, init:1, type:'cover',   hMax: 2,  pMax: 6,  hit:{vet:'F',  line:'L',  green:'P' } },
  { n:44, act:2, init:1, type:'contact', hMax: 2,  pMax: 6,  hit:{vet:'F',  line:'L',  green:'P' } },
  { n:45, act:2, init:1, type:'rally',   hMax: 2,  pMax: 6,  hit:{vet:'F',  line:'F',  green:'L' } },

  // ── カード 46〜47（-4〜+3がHIT） ──
  { n:46, act:2, init:1, type:'contact', hMax: 3,  pMax: 6,  hit:{vet:'F',  line:'F',  green:'F' } },
  { n:47, act:1, init:0, type:'contact', hMax: 3,  pMax: 6,  hit:{vet:'F',  line:'F',  green:'F' } },

  // ── カード 48（-4〜+4がHIT） ──
  { n:48, act:1, init:0, type:'contact', hMax: 4,  pMax: 6,  hit:{vet:'A',  line:'F',  green:'F' } },

  // ── カード 49（Jam!）-4〜+5がHIT ──
  { n:49, act:1, init:0, type:'jam',     hMax: 5,  pMax: 6,  hit:{vet:'A',  line:'A',  green:'F' } },

  // ── カード 50（Short!）全NCMがHIT ──
  { n:50, act:1, init:0, type:'short',   hMax: 6,  pMax: 6,  hit:{vet:'A',  line:'A',  green:'A' } },

].map(c => ({
  number:    c.n,
  file:      `A${String(c.n).padStart(2,'0')}.jpg`,
  activated: c.act,
  initiative:c.init,
  type:      c.type,
  combat:    { hitMax: c.hMax, pinMax: c.pMax },
  hit:       c.hit,
}));

// ===== ユーティリティ =====

// Combat Resolution: NCM → 'HIT' | 'PIN' | 'MISS'
export function getCombatResult(ncm, card) {
  const n = Math.max(-4, Math.min(6, ncm));
  if (n <= card.combat.hitMax) return 'HIT';
  if (n <= card.combat.pinMax) return 'PIN';
  return 'MISS';
}

// デッキをシャッフルする汎用関数
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
