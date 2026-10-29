// =============================================================
// art.js … 仮の絵（SVG）と、画像への差し替え
//
// assets/images/ に「決められた名前.png」の画像を置くと、
// ゲームを開いたときに自動でその画像に差し替わります。
// 画像がない（または読み込みに失敗した）ときは、ここで描く SVG の仮の絵を使います。
// 決められた名前の一覧は ASSETS.md を見てください。
//
// 画面側は必ず Art.pic() を通して絵を出すので、このファイルだけで差し替えが完結します。
// =============================================================

const Art = {
  folder: 'assets/images/',
  available: {}, // 読み込めた画像の名前 → true

  // 差し替えられる画像の名前の一覧
  keys() {
    const keys = ['glass_empty', 'dish_full', 'dish_empty', 'oshibori', 'oshibori_used', 'koban', 'hair', 'bg_seats', 'bg_back'];
    for (const c of CONFIG.catColors) {
      for (const face of ['sit', 'happy', 'sleep', 'yada']) keys.push('cat_' + c.id + '_' + face);
    }
    for (const d of CONFIG.drinks) keys.push('drink_' + d.id);
    return keys;
  },

  // ゲーム開始前に、置いてある画像を全部読み込んでみる（全部終わったら done を呼ぶ）
  preload(done) {
    const keys = this.keys();
    let remaining = keys.length;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done();
    };
    for (const key of keys) {
      const img = new Image();
      img.onload = () => {
        this.available[key] = true;
        if (--remaining <= 0) finish();
      };
      img.onerror = () => {
        if (--remaining <= 0) finish();
      };
      img.src = this.folder + key + '.png';
    }
    // 念のため、3秒たっても終わらなければ先に進む
    setTimeout(finish, 3000);
  },

  // 絵を表示するHTML。画像があれば画像、なければ SVG
  //   key: 画像の名前、svg: 仮の絵、cls: 大きさなどを決めるCSSクラス
  pic(key, svg, cls = '') {
    if (this.available[key]) {
      return `<span class="pic ${cls}"><img src="${this.folder}${key}.png" alt="" draggable="false"></span>`;
    }
    return `<span class="pic ${cls}">${svg}</span>`;
  },

  // 背景画像（あれば CSS の url、なければ null）
  bg(key) {
    return this.available[key] ? `url("${this.folder}${key}.png")` : null;
  },

  // ---------------------------------------------------------
  // 猫
  // ---------------------------------------------------------
  line: '#5b4636', // 輪郭の色

  // 毛色ごとの色
  palette(color) {
    const p = {
      white: { base: '#fbf8f3', ear: '#fbf8f3', tail: '#fbf8f3', dark: false },
      black: { base: '#3d3a40', ear: '#3d3a40', tail: '#3d3a40', dark: true },
      tabby: { base: '#f0a65a', ear: '#f0a65a', tail: '#f0a65a', dark: false, stripe: '#c8782f' },
      calico: { base: '#fbf8f3', ear: '#f0a65a', ear2: '#3d3a40', tail: '#f0a65a', dark: false },
      hachi: { base: '#fbf8f3', ear: '#3d3a40', tail: '#3d3a40', dark: true, cap: '#3d3a40' },
    };
    return p[color] || p.white;
  },

  // 座っている猫（正面）。face: sit / happy / sleep / yada
  cat(color, face = 'sit') {
    if (face === 'sleep') return this.pic('cat_' + color + '_sleep', this.catCurled(color), 'cat-pic curled');
    return this.pic('cat_' + color + '_' + face, this.catSitting(color, face), 'cat-pic');
  },

  catSitting(color, face) {
    const p = this.palette(color);
    const L = this.line;
    const dark = p.dark; // 顔のまわりが黒っぽい（目や口を明るい色で描く）
    const faceLine = dark ? '#e9dcc0' : '#4a382c';
    let svg = `<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">`;

    // しっぽ
    svg += `<path d="M90,118 Q120,110 112,80 Q109,70 101,76" fill="none" stroke="${L}" stroke-width="12" stroke-linecap="round"/>`;
    svg += `<path d="M90,118 Q120,110 112,80 Q109,70 101,76" fill="none" stroke="${p.tail}" stroke-width="7" stroke-linecap="round"/>`;

    // からだ
    const bodyColor = color === 'hachi' ? p.cap : p.base;
    svg += `<ellipse cx="60" cy="102" rx="36" ry="30" fill="${bodyColor}" stroke="${L}" stroke-width="2.5"/>`;
    if (color === 'hachi') svg += `<ellipse cx="60" cy="106" rx="21" ry="24" fill="${p.base}"/>`;
    if (color === 'tabby') {
      svg += `<path d="M30,96 Q38,98 36,108 M88,96 Q80,98 84,108 M34,112 Q42,114 40,122 M86,112 Q78,114 80,122" fill="none" stroke="${p.stripe}" stroke-width="4" stroke-linecap="round"/>`;
    }
    if (color === 'calico') {
      svg += `<ellipse cx="78" cy="98" rx="13" ry="11" fill="#f0a65a"/>`;
      svg += `<ellipse cx="44" cy="114" rx="10" ry="8" fill="#3d3a40"/>`;
    }
    // 前足
    const paw = color === 'black' ? p.base : '#fbf8f3';
    svg += `<ellipse cx="48" cy="130" rx="9" ry="5.5" fill="${color === 'tabby' ? p.base : paw}" stroke="${L}" stroke-width="2"/>`;
    svg += `<ellipse cx="72" cy="130" rx="9" ry="5.5" fill="${color === 'tabby' ? p.base : paw}" stroke="${L}" stroke-width="2"/>`;

    // 耳
    const ear2 = p.ear2 || p.ear;
    svg += `<path d="M28,44 L32,14 L54,32 Z" fill="${p.ear}" stroke="${L}" stroke-width="2.5" stroke-linejoin="round"/>`;
    svg += `<path d="M92,44 L88,14 L66,32 Z" fill="${ear2}" stroke="${L}" stroke-width="2.5" stroke-linejoin="round"/>`;
    svg += `<path d="M34,36 L35,22 L46,31 Z" fill="#f2b8c0"/>`;
    svg += `<path d="M86,36 L85,22 L74,31 Z" fill="#f2b8c0"/>`;

    // 頭
    svg += `<ellipse cx="60" cy="54" rx="34" ry="28" fill="${p.base}" stroke="${L}" stroke-width="2.5"/>`;
    if (color === 'hachi') {
      // 頭の上が黒く、まんなかが白い「ハ」の字
      svg += `<path d="M26.4,58 A34,28 0 1 1 93.6,58 Q80,50 65,58 L60,66 L55,58 Q40,50 26.4,58 Z" fill="${p.cap}"/>`;
    }
    if (color === 'tabby') {
      svg += `<path d="M54,30 L54,38 M60,28 L60,38 M66,30 L66,38" stroke="${p.stripe}" stroke-width="3.5" stroke-linecap="round"/>`;
    }
    if (color === 'calico') {
      svg += `<path d="M30,44 Q34,28 50,28 Q50,40 36,48 Z" fill="#f0a65a"/>`;
      svg += `<path d="M90,44 Q86,28 72,28 Q72,40 84,48 Z" fill="#3d3a40"/>`;
    }
    // 顔の輪郭をもう一度なぞる（模様の上から）
    svg += `<ellipse cx="60" cy="54" rx="34" ry="28" fill="none" stroke="${L}" stroke-width="2.5"/>`;

    // 目
    if (face === 'happy') {
      svg += `<path d="M42,56 Q47,50 52,56 M68,56 Q73,50 78,56" fill="none" stroke="${faceLine}" stroke-width="3" stroke-linecap="round"/>`;
      svg += `<ellipse cx="38" cy="63" rx="5" ry="3" fill="#f39aa8" opacity="0.5"/><ellipse cx="82" cy="63" rx="5" ry="3" fill="#f39aa8" opacity="0.5"/>`;
    } else if (face === 'yada') {
      svg += `<path d="M42,54 L52,56 M68,56 L78,54" fill="none" stroke="${faceLine}" stroke-width="3" stroke-linecap="round"/>`;
      svg += `<path d="M92,30 Q96,38 92,40 Q88,38 92,30 Z" fill="#9fd4f0" stroke="#5a8fb0" stroke-width="1"/>`;
    } else {
      const eye = dark ? '#f2cf4a' : '#3a2a20';
      svg += `<ellipse cx="47" cy="55" rx="4" ry="5" fill="${eye}"/><ellipse cx="73" cy="55" rx="4" ry="5" fill="${eye}"/>`;
      if (dark) svg += `<ellipse cx="47" cy="55" rx="1.6" ry="4" fill="#222"/><ellipse cx="73" cy="55" rx="1.6" ry="4" fill="#222"/>`;
      svg += `<circle cx="48.5" cy="53" r="1.3" fill="#fff"/><circle cx="74.5" cy="53" r="1.3" fill="#fff"/>`;
    }
    // 鼻と口
    svg += `<path d="M57,62 L63,62 L60,65.5 Z" fill="#e8899a"/>`;
    if (face === 'yada') {
      svg += `<path d="M54,69 Q60,65 66,69" fill="none" stroke="${faceLine}" stroke-width="2" stroke-linecap="round"/>`;
    } else {
      svg += `<path d="M54,66 Q57,70 60,66 Q63,70 66,66" fill="none" stroke="${faceLine}" stroke-width="2" stroke-linecap="round"/>`;
    }
    // ひげ
    svg += `<path d="M38,63 L22,60 M38,67 L22,69 M82,63 L98,60 M82,67 L98,69" stroke="${faceLine}" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/>`;
    svg += `</svg>`;
    return svg;
  },

  // 丸まって寝ている猫
  catCurled(color) {
    const p = this.palette(color);
    const L = this.line;
    const faceLine = p.dark ? '#e9dcc0' : '#4a382c';
    let svg = `<svg viewBox="0 0 140 90" xmlns="http://www.w3.org/2000/svg">`;
    // からだ
    const bodyColor = color === 'hachi' ? p.cap : p.base;
    svg += `<ellipse cx="76" cy="56" rx="52" ry="28" fill="${bodyColor}" stroke="${L}" stroke-width="2.5"/>`;
    if (color === 'tabby') {
      svg += `<path d="M70,30 Q76,40 72,48 M88,30 Q94,40 90,48 M106,36 Q110,44 106,50" fill="none" stroke="${p.stripe}" stroke-width="4" stroke-linecap="round"/>`;
    }
    if (color === 'calico') {
      svg += `<ellipse cx="90" cy="44" rx="18" ry="11" fill="#f0a65a"/><ellipse cx="112" cy="60" rx="9" ry="8" fill="#3d3a40"/>`;
    }
    if (color === 'hachi') svg += `<ellipse cx="66" cy="72" rx="30" ry="9" fill="${p.base}"/>`;
    // しっぽ（からだの前に巻きつける）
    svg += `<path d="M120,66 Q100,90 50,80" fill="none" stroke="${L}" stroke-width="12" stroke-linecap="round"/>`;
    svg += `<path d="M120,66 Q100,90 50,80" fill="none" stroke="${p.tail}" stroke-width="7" stroke-linecap="round"/>`;
    // 耳
    const ear2 = p.ear2 || p.ear;
    svg += `<path d="M20,50 L18,30 L34,40 Z" fill="${p.ear}" stroke="${L}" stroke-width="2.5" stroke-linejoin="round"/>`;
    svg += `<path d="M46,38 L58,28 L60,46 Z" fill="${ear2}" stroke="${L}" stroke-width="2.5" stroke-linejoin="round"/>`;
    // 頭
    svg += `<ellipse cx="40" cy="58" rx="25" ry="20" fill="${p.base}" stroke="${L}" stroke-width="2.5"/>`;
    if (color === 'hachi') svg += `<path d="M15.5,58 A25,20 0 0 1 64.5,58 Q52,52 42,60 L40,64 L38,60 Q28,52 15.5,58 Z" fill="${p.cap}"/>`;
    if (color === 'tabby') svg += `<path d="M36,40 L36,46 M42,39 L42,46" stroke="${p.stripe}" stroke-width="3" stroke-linecap="round"/>`;
    if (color === 'calico') svg += `<path d="M18,52 Q22,40 34,40 Q32,50 22,56 Z" fill="#f0a65a"/>`;
    svg += `<ellipse cx="40" cy="58" rx="25" ry="20" fill="none" stroke="${L}" stroke-width="2.5"/>`;
    // 閉じた目・鼻
    svg += `<path d="M27,60 Q31,64 35,60 M45,60 Q49,64 53,60" fill="none" stroke="${faceLine}" stroke-width="2.5" stroke-linecap="round"/>`;
    svg += `<path d="M38,66 L42,66 L40,68.5 Z" fill="#e8899a"/>`;
    svg += `</svg>`;
    return svg;
  },

  // ---------------------------------------------------------
  // 食器など
  // ---------------------------------------------------------

  // グラス。drinkId が null なら空。full=false なら飲み終わり（少しだけ残る）
  glass(drinkId, full = true) {
    const key = drinkId && full ? 'drink_' + drinkId : 'glass_empty';
    const color = drinkId ? CONFIG.drink(drinkId).color : null;
    let svg = `<svg viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">`;
    if (color && full) svg += `<path d="M9.2,17 L30.8,17 L28.4,46 L11.6,46 Z" fill="${color}"/>`;
    if (color && !full) svg += `<path d="M11.2,41 L28.8,41 L28.4,46 L11.6,46 Z" fill="${color}" opacity="0.7"/>`;
    svg += `<path d="M7,6 L33,6 L29.5,48 L10.5,48 Z" fill="rgba(255,255,255,0.28)" stroke="#6f8796" stroke-width="2.2" stroke-linejoin="round"/>`;
    svg += `<path d="M12,11 L14,40" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`;
    svg += `</svg>`;
    return this.pic(key, svg, 'glass-pic');
  },

  // 小皿。state: full（盛ってある） / eating（食べかけ） / empty
  dish(state = 'full') {
    const key = state === 'empty' ? 'dish_empty' : 'dish_full';
    let svg = `<svg viewBox="0 0 60 32" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<ellipse cx="30" cy="20" rx="27" ry="10" fill="#fdfbf5" stroke="#8b7a6a" stroke-width="2"/>`;
    svg += `<ellipse cx="30" cy="19" rx="17" ry="5.5" fill="none" stroke="#c9b9a4" stroke-width="1.5"/>`;
    const dots = state === 'full'
      ? [[22, 16], [28, 13], [34, 15], [38, 18], [25, 19], [31, 18], [19, 19], [35, 12], [29, 9]]
      : state === 'eating' ? [[24, 18], [31, 17], [36, 19]] : [];
    for (const [x, y] of dots) svg += `<circle cx="${x}" cy="${y}" r="3.2" fill="#a8683a" stroke="#7a4824" stroke-width="1"/>`;
    svg += `</svg>`;
    return this.pic(key, svg, 'dish-pic');
  },

  oshibori(used = false) {
    let svg = `<svg viewBox="0 0 52 28" xmlns="http://www.w3.org/2000/svg">`;
    if (used) {
      svg += `<path d="M6,20 Q4,10 14,9 Q20,3 28,8 Q38,4 44,12 Q50,18 44,22 Q30,26 6,20 Z" fill="#f4f1ea" stroke="#9a9086" stroke-width="2"/>`;
      svg += `<path d="M16,14 Q22,18 30,13 M32,17 Q38,15 40,18" fill="none" stroke="#b9afa4" stroke-width="1.5"/>`;
    } else {
      svg += `<rect x="4" y="6" width="40" height="17" rx="8" fill="#ffffff" stroke="#9a9086" stroke-width="2"/>`;
      svg += `<ellipse cx="44" cy="14.5" rx="5" ry="8.5" fill="#f4f1ea" stroke="#9a9086" stroke-width="2"/>`;
      svg += `<path d="M44,11 Q47,14.5 44,18 Q42,14.5 44,12" fill="none" stroke="#9a9086" stroke-width="1.3"/>`;
    }
    svg += `</svg>`;
    return this.pic(used ? 'oshibori_used' : 'oshibori', svg, 'oshibori-pic');
  },

  koban() {
    const svg = `<svg viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="15" cy="20" rx="12" ry="17" fill="#f5cd52" stroke="#a87c1e" stroke-width="2"/>
      <ellipse cx="15" cy="20" rx="8" ry="12.5" fill="none" stroke="#d6a632" stroke-width="1.3"/>
      <path d="M10,15 L20,15 M10,20 L20,20 M10,25 L20,25" stroke="#c4952a" stroke-width="1.4"/>
    </svg>`;
    return this.pic('koban', svg, 'koban-pic');
  },

  hair() {
    const svg = `<svg viewBox="0 0 80 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M8,18 q4,-6 8,0 t8,0 M30,10 q3,-5 6,0 t6,0 M50,20 q4,-6 8,0 t8,0 M20,24 q3,-4 6,0 M60,8 q3,-4 6,0" fill="none" stroke="#8d8578" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`;
    return this.pic('hair', svg, 'hair-pic');
  },
};
