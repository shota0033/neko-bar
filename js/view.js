// =============================================================
// view.js … 画面の表示と、タップの受け取り
//
// ・画面は「席」「カウンター裏」「トイレ」「洗濯」「猫草」「爪とぎ」「発注」「お店の買い物」の8つ。
//   下のボタンで切り替える（席とカウンター裏はワンタップで行き来できる）
// ・各画面は「枠（layout）」と、その中の「差し込み口（slot）」でできている。
//   差し込み口の中身は毎回作り直すが、前回と同じなら書き換えない
//   （湯気などの動きが途中で止まらないように、変わったところだけ書き換える）
// ・タップは data-act の付いた要素で受け取り、Game の操作を呼ぶ
// =============================================================

const View = {
  screen: 'seats',
  slots: {},      // 差し込み口の名前 → 要素
  lastHtml: {},   // 差し込み口に前回入れた中身
  layoutKey: '',  // 枠を作り直す必要があるかどうかを見分ける
  badges: { seats: false, toilet: false, laundry: false, order: false },
  says: {},       // 猫のひとこと { 猫のid: { text, face, until（現実のミリ秒） } }
  toast: null,    // 画面下のお知らせ { text, until }
  picker: null,   // 材料を選ぶ窓 { si, ci }
  modal: null,    // 'reset'（リセットの確認）
  orderQty: {},   // 発注画面で選んでいる数
  rolling: false, // コロコロを持っているか
  rollDrag: null, // なぞっている途中 { x, y }
  hairProgress: {}, // 席ごとのコロコロの進み具合（0〜1）
  debug: false,

  screens: [
    { id: 'seats', label: '席', icon: '🐾' },
    { id: 'back', label: 'カウンター裏', icon: '🍶' },
    { id: 'toilet', label: 'トイレ', icon: '🚽' },
    { id: 'laundry', label: '洗濯', icon: '🫧' },
    { id: 'grass', label: '猫草', icon: '🌱' },
    { id: 'scratch', label: '爪とぎ', icon: '🪵' },
    { id: 'order', label: '発注', icon: '☎️' },
    { id: 'shop', label: 'お店の買い物', icon: '🛒' },
  ],

  // ---------------------------------------------------------
  // 準備
  // ---------------------------------------------------------
  init(stage, debug) {
    this.debug = debug;
    this.stage = stage;
    for (const name of ['top', 'nav', 'toast', 'modal']) {
      this.slots[name] = document.getElementById(name);
    }
    stage.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', () => (this.rollDrag = null));
    window.addEventListener('pointercancel', () => (this.rollDrag = null));
    stage.addEventListener('contextmenu', (e) => e.preventDefault());
    Game.on((type, data) => this.onGameEvent(type, data));
    this.go('seats');
  },

  // 画面を切り替える
  go(screen) {
    this.screen = screen;
    this.picker = null;
    if (screen !== 'seats') this.rolling = false;
    if (this.badges[screen] !== undefined) this.badges[screen] = false;
    this.buildLayout();
    this.update();
  },

  buildLayout() {
    const main = document.getElementById('main');
    this.layoutKey = this.screen + ':' + Game.state.stoves.length;
    main.innerHTML = this.layout();
    main.className = 'scr-' + this.screen;
    const bg = Art.bg(this.screen === 'seats' ? 'bg_seats' : this.screen === 'back' ? 'bg_back' : '');
    main.style.backgroundImage = bg || '';
    // 画面ごとの差し込み口を集め直す（共通の差し込み口は残す）
    for (const name of Object.keys(this.slots)) {
      if (!['top', 'nav', 'toast', 'modal'].includes(name)) delete this.slots[name];
    }
    this.lastHtml = {};
    main.querySelectorAll('[data-slot]').forEach((el) => {
      this.slots[el.dataset.slot] = el;
    });
  },

  // 中身を更新する（main.js から何度も呼ばれる）
  update() {
    if (this.layoutKey !== this.screen + ':' + Game.state.stoves.length) this.buildLayout();
    const map = Object.assign(
      { top: this.topHtml(), nav: this.navHtml(), toast: this.toastHtml(), modal: this.modalHtml() },
      this.slotsHtml()
    );
    for (const [name, html] of Object.entries(map)) this.patch(name, html);
  },

  patch(name, html) {
    if (this.lastHtml[name] === html) return;
    const el = this.slots[name];
    if (!el) return;
    el.innerHTML = html;
    this.lastHtml[name] = html;
  },

  // ---------------------------------------------------------
  // ゲームからの知らせ
  // ---------------------------------------------------------
  onGameEvent(type, data) {
    const here = this.screen;
    switch (type) {
      case 'hint':
        this.showToast(data.text);
        break;
      case 'say':
        this.says[data.cat.id] = { text: data.text, face: data.face, until: performance.now() + 3000 };
        Sound.play(data.face === 'happy' ? 'nyaHappy' : 'nya');
        break;
      case 'order':
        // 席の画面にいないときは、席のボタンに印を付ける（音は鳴らさない）
        if (here !== 'seats') this.badges.seats = true;
        else Sound.play('soft');
        break;
      case 'arrive':
        if (here === 'seats') Sound.play('door');
        break;
      case 'catAway':
        if (data.kind === 'toilet' && here !== 'toilet') this.badges.toilet = true;
        break;
      case 'delivered':
        if (here !== 'order') this.badges.order = true;
        else Sound.play('deliver');
        this.showToast('配達が届いたにゃ');
        break;
      case 'laundryDone':
        if (here !== 'laundry') this.badges.laundry = true;
        else Sound.play('done');
        break;
      case 'washDone':
      case 'dashiDone':
        if (here === 'back') Sound.play('done');
        break;
      case 'chooseIngredient':
        this.picker = { si: data.si, ci: data.ci };
        Sound.play('tap');
        break;
      case 'clean':
        if (data.coins > 0) {
          Sound.play('coin');
          this.showToast('チャリン！ ＋' + data.coins + ' 小判');
        } else {
          Sound.play('take');
        }
        break;
      case 'hairRemoved':
        Sound.play('done');
        break;
      case 'take':
      case 'putBack':
      case 'pour':
      case 'ladle':
      case 'potWater':
      case 'simmerStart':
      case 'wash':
      case 'scoop':
      case 'refill':
        Sound.play(type);
        break;
      case 'food':
      case 'toSink':
      case 'replace':
      case 'laundryOut':
        Sound.play('take');
        break;
      case 'laundryStart':
        Sound.play('wash');
        break;
      case 'waterGrass':
        Sound.play('water');
        break;
      case 'ordered':
        Sound.play('buy');
        this.showToast('注文したにゃ。10分後に届くよ');
        break;
      case 'bought':
        Sound.play('buy');
        break;
      case 'opened':
        Sound.play('door');
        this.showToast('お店をオープンしたにゃ');
        break;
      case 'closed':
        Sound.play('soft');
        this.showToast('お店をクローズ。店内の猫は飲み終えたら帰るにゃ');
        break;
    }
  },

  showToast(text) {
    this.toast = { text, until: performance.now() + 2500 };
  },

  // 猫のひとことが出ているか
  activeSay(catId) {
    const say = this.says[catId];
    if (!say) return null;
    if (performance.now() > say.until) {
      delete this.says[catId];
      return null;
    }
    return say;
  },

  // ---------------------------------------------------------
  // タップ
  // ---------------------------------------------------------
  onDown(e) {
    Sound.unlock();
    const el = e.target.closest('[data-act]');

    // コロコロ中：席をなぞって抜け毛を取る（ボタンは普通に押せる）
    if (this.rolling && this.screen === 'seats' && (!el || el.dataset.act === 'seat')) {
      this.rollDrag = { x: e.clientX, y: e.clientY };
      this.rollAt(e.clientX, e.clientY, 0);
      return;
    }
    if (!el || el.disabled) return;
    this.act(el.dataset.act, el.dataset);
    this.update();
  },

  onMove(e) {
    if (!this.rollDrag) return;
    const dx = e.clientX - this.rollDrag.x;
    const dy = e.clientY - this.rollDrag.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.rollDrag = { x: e.clientX, y: e.clientY };
    this.rollAt(e.clientX, e.clientY, dist);
  },

  // コロコロ：指の下に抜け毛があれば、なぞった長さだけ取れていく
  rollAt(x, y, dist) {
    const target = document.elementFromPoint(x, y);
    const seatEl = target && target.closest('[data-act="seat"]');
    if (!seatEl) return;
    const i = Number(seatEl.dataset.i);
    const seat = Game.state.seats[i];
    if (!seat.hair || seat.catId !== null) return;
    const scale = this.stage.getBoundingClientRect().width / CONFIG.stageWidth;
    const p = (this.hairProgress[i] || 0) + dist / scale / 260;
    if (Math.floor(p * 6) > Math.floor((this.hairProgress[i] || 0) * 6)) Sound.play('roll');
    this.hairProgress[i] = p;
    if (p >= 1) {
      this.hairProgress[i] = 0;
      Game.removeHair(i);
    }
    this.update();
  },

  act(act, d) {
    switch (act) {
      case 'nav':
        this.go(d.to);
        Sound.play('tap');
        return;
      case 'toggleOpen':
        Game.toggleOpen();
        SaveData.save(Game.state);
        return;
      case 'sound':
        Sound.toggle();
        return;
      case 'tray':
        Game.selectTray(Number(d.i));
        Sound.play('tap');
        return;
      case 'seat':
        Game.tapSeat(Number(d.i));
        return;
      case 'roll':
        this.rolling = !this.rolling;
        Sound.play('tap');
        return;

      // カウンター裏
      case 'glassRack': Game.tapGlassRack(); return;
      case 'food': Game.tapFood(); return;
      case 'warmer': Game.tapWarmer(); return;
      case 'faucet': Game.tapFaucet(); return;
      case 'fridge': Game.tapFridge(d.d); return;
      case 'sink': Game.tapSink(); return;
      case 'comp': Game.tapCompartment(Number(d.s), Number(d.c)); return;
      case 'pick':
        if (this.picker) Game.addIngredient(this.picker.si, this.picker.ci, d.ing);
        this.picker = null;
        return;
      case 'pickCancel':
        this.picker = null;
        return;

      // トイレ・洗濯・猫草・爪とぎ
      case 'scoop': Game.scoop(); return;
      case 'refill': Game.refillLitter(); return;
      case 'laundryStart': Game.startLaundry(); return;
      case 'laundryOut': Game.takeOutLaundry(); return;
      case 'water': Game.waterGrass(); return;
      case 'grassReplace': Game.replaceGrass(); return;
      case 'scratchReplace': Game.replaceScratcher(); return;

      // 発注・お店の買い物
      case 'qty': {
        const n = Math.max(0, (this.orderQty[d.id] || 0) + Number(d.n));
        this.orderQty[d.id] = Math.min(n, 99);
        Sound.play('tap');
        return;
      }
      case 'placeOrder':
        if (Game.placeOrder(this.orderQty)) this.orderQty = {};
        return;
      case 'buy': Game.buy(d.id); return;

      // 開発用
      case 'reset':
        this.modal = 'reset';
        return;
      case 'resetYes':
        Main.reset();
        this.modal = null;
        return;
      case 'resetNo':
        this.modal = null;
        return;
    }
  },

  // ---------------------------------------------------------
  // 共通の部分（上の帯・下のボタン・お知らせ・確認の窓）
  // ---------------------------------------------------------
  topHtml() {
    const s = Game.state;
    let html = `<button class="open-btn ${s.open ? 'is-open' : ''}" data-act="toggleOpen">
      <span class="open-lamp"></span>
      <span class="open-text">${s.open ? '営業中' : '準備中'}<small>${s.open ? 'OPEN' : 'CLOSED'}</small></span>
      <span class="open-hint">${s.open ? 'タップでクローズ' : 'タップでオープン'}</span>
    </button>`;

    // お盆
    html += `<div class="tray"><span class="tray-label">お盆</span>`;
    for (let i = 0; i < CONFIG.trayMax; i++) {
      const item = s.tray[i];
      if (!item) {
        html += `<div class="tray-slot empty"></div>`;
        continue;
      }
      html += `<button class="tray-slot ${s.selected === i ? 'selected' : ''}" data-act="tray" data-i="${i}">
        ${this.itemPic(item)}<span>${this.itemName(item)}</span></button>`;
    }
    html += `</div>`;

    html += `<div class="coins">${Art.koban()}<b>${s.coins}</b><span>小判</span></div>`;
    html += `<button class="sound-btn" data-act="sound">${Sound.enabled ? '🔊' : '🔈'}<small>${Sound.enabled ? '音 ON' : '音 OFF'}</small></button>`;
    if (this.debug) {
      html += `<div class="debug-box"><span>×${CONFIG.debugSpeed}</span><button data-act="reset">リセット</button></div>`;
    }
    html += `<div class="version">ver.${CONFIG.version}</div>`;
    return html;
  },

  itemPic(item) {
    if (item.kind === 'glass') return Art.glass(item.drink);
    if (item.kind === 'dish') return Art.dish('full');
    return Art.oshibori();
  },
  itemName(item) {
    if (item.kind === 'glass') return item.drink ? CONFIG.drink(item.drink).name : 'からのグラス';
    if (item.kind === 'dish') return 'お通し';
    return 'おしぼり';
  },

  navHtml() {
    let html = '';
    for (const sc of this.screens) {
      const badge = this.badges[sc.id] ? `<span class="badge">にゃ</span>` : '';
      html += `<button class="nav-btn nav-${sc.id} ${this.screen === sc.id ? 'active' : ''}" data-act="nav" data-to="${sc.id}">
        <span class="nav-icon">${sc.icon}</span><span class="nav-label">${sc.label}</span>${badge}</button>`;
    }
    return html;
  },

  toastHtml() {
    if (!this.toast) return '';
    if (performance.now() > this.toast.until) {
      this.toast = null;
      return '';
    }
    return `<div class="toast-msg">${this.toast.text}</div>`;
  },

  modalHtml() {
    if (this.picker) {
      const s = Game.state;
      let html = `<div class="modal-back"><div class="modal-box"><h3>どのだしにする？</h3><div class="pick-list">`;
      for (const d of CONFIG.drinks.filter((x) => x.source === 'pot')) {
        const n = s.stock[d.ingredient] || 0;
        const item = CONFIG.orderItems.find((o) => o.id === d.ingredient);
        html += `<button class="pick-btn" data-act="pick" data-ing="${d.ingredient}" ${n <= 0 ? 'disabled' : ''}>
          ${Art.glass(d.id)}<b>${d.name}</b><span>${item.name} 残り ${n}</span></button>`;
      }
      html += `</div><button class="btn sub" data-act="pickCancel">やめる</button></div></div>`;
      return html;
    }
    if (this.modal === 'reset') {
      return `<div class="modal-back"><div class="modal-box"><h3>データを消して最初から始めますか？</h3>
        <p>小判・在庫・お店の様子がすべて最初に戻ります。</p>
        <div class="modal-row"><button class="btn" data-act="resetYes">消して最初から</button>
        <button class="btn sub" data-act="resetNo">やめる</button></div></div></div>`;
    }
    return '';
  },

  // 残り時間の表示（例：9:42）
  fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const ss = sec % 60;
    return m + ':' + String(ss).padStart(2, '0');
  },

  // ---------------------------------------------------------
  // 画面ごとの枠
  // ---------------------------------------------------------
  layout() {
    switch (this.screen) {
      case 'seats': {
        let html = `<div class="seats-deco">
          <div class="window"><div class="moon"></div></div>
          <div class="lamp l1"></div><div class="lamp l2"></div><div class="lamp l3"></div>
        </div>
        <div class="door-area"><div class="door" data-slot="door"></div><div class="wait" data-slot="wait"></div></div>
        <div class="counter-top"></div><div class="counter-front"></div>`;
        for (let i = 0; i < CONFIG.seats; i++) {
          html += `<div class="seat" data-act="seat" data-i="${i}" data-slot="seat${i}" style="left:${196 + i * 154}px"></div>`;
        }
        html += `<div class="seat-tools" data-slot="tools"></div>`;
        return html;
      }
      case 'back': {
        let stoves = '';
        Game.state.stoves.forEach((_, si) => {
          stoves += `<div class="stove-card"><div class="stove-title">コンロ${si + 1}</div>
            <div class="pot-box"><div class="steam-layer" data-slot="steam${si}"></div><div data-slot="pot${si}"></div></div></div>`;
        });
        return `<div class="col col-a">
            <div class="card"><h3>食器置き場</h3><div data-slot="rack"></div></div>
            <div class="card"><h3>お通し</h3><div data-slot="food"></div></div>
            <div class="card"><h3>おしぼりウォーマー</h3><div data-slot="warmer"></div></div>
          </div>
          <div class="col col-b">
            <div class="card stoves"><h3>コンロ（だし鍋）<small>仕切りをタップ：水 → 材料 → ${CONFIG.simmerSec}秒で完成</small></h3>
              <div class="stove-row n${Game.state.stoves.length}">${stoves}</div>
              <div data-slot="pantry"></div></div>
          </div>
          <div class="col col-c">
            <div class="card"><h3>冷蔵庫</h3><div data-slot="fridge"></div></div>
            <div class="card"><h3>蛇口と流し</h3><div data-slot="sink"></div></div>
            <div data-slot="phone"></div>
          </div>
          <div class="col col-d"><div class="card orders"><h3>ご注文</h3><div data-slot="orders"></div></div></div>`;
      }
      case 'toilet':
        return `<div class="room"><h2>猫用トイレ</h2><div class="room-body"><div data-slot="box"></div><div data-slot="side"></div></div></div>`;
      case 'laundry':
        return `<div class="room"><h2>洗濯</h2><div data-slot="body"></div></div>`;
      case 'grass':
        return `<div class="room"><h2>窓際の猫草</h2><div data-slot="body"></div></div>`;
      case 'scratch':
        return `<div class="room"><h2>店の隅の爪とぎ</h2><div data-slot="body"></div></div>`;
      case 'order':
        return `<div class="room"><h2>発注（電話の注文帳）</h2><div class="order-body"><div data-slot="list"></div><div data-slot="side"></div></div></div>`;
      case 'shop':
        return `<div class="room"><h2>お店の買い物</h2><div data-slot="body"></div></div>`;
    }
    return '';
  },

  // 画面ごとの差し込み口の中身
  slotsHtml() {
    switch (this.screen) {
      case 'seats': return this.seatsSlots();
      case 'back': return this.backSlots();
      case 'toilet': return this.toiletSlots();
      case 'laundry': return { body: this.laundryHtml() };
      case 'grass': return { body: this.grassHtml() };
      case 'scratch': return { body: this.scratchHtml() };
      case 'order': return this.orderSlots();
      case 'shop': return { body: this.shopHtml() };
    }
    return {};
  },

  // 席を離れている猫を、その場所の画面に描く
  awayCatHtml(kind) {
    const cat = Game.catList().find((c) => c.away && c.away.kind === kind);
    if (!cat) return '';
    const text = { toilet: cat.away.yada ? '…ちょっと汚れてるにゃ' : 'すっきりにゃ', grass: 'もしゃもしゃ', scratch: 'バリバリ' }[kind];
    return `<div class="away-cat">${Art.cat(cat.color, cat.away.yada ? 'yada' : 'happy')}<div class="bubble say">${text}</div><div class="away-seat">${cat.seat + 1}番の猫</div></div>`;
  },

  // ---------------------------------------------------------
  // 席の画面
  // ---------------------------------------------------------
  seatsSlots() {
    const s = Game.state;
    const map = {};
    for (let i = 0; i < CONFIG.seats; i++) map['seat' + i] = this.seatHtml(i);

    // 入口：待っている猫（丸まって待つ）
    let wait = '';
    s.waiting.forEach((id) => {
      const cat = s.cats[id];
      wait += `<div class="wait-cat">${Art.cat(cat.color, 'sleep')}<div class="zzz">z<span>z</span></div></div>`;
    });
    map.wait = wait;
    map.door = `<div class="door-sign ${s.open ? 'is-open' : ''}">${s.open ? 'OPEN' : 'CLOSED'}</div>`;

    const hairCount = s.seats.filter((x) => x.hair && x.catId === null).length;
    map.tools = `<button class="tool-btn ${this.rolling ? 'active' : ''}" data-act="roll">🧻 コロコロ${this.rolling ? 'を置く' : ''}</button>
      <div class="tool-hint">${this.rolling ? '抜け毛のある席をなぞってね' : hairCount > 0 ? '抜け毛のある席：' + hairCount : ''}</div>`;
    return map;
  },

  seatHtml(i) {
    const s = Game.state;
    const t = s.time;
    const seat = s.seats[i];
    let bubble = '';
    let body = '';
    let items = '';
    let note = '';

    const cushion = () => {
      const p = this.hairProgress[i] || 0;
      const hair = seat.hair ? `<div class="hair" style="opacity:${(1 - p * 0.8).toFixed(1)}">${Art.hair()}</div>` : '';
      return `<div class="cushion">${hair}</div>`;
    };

    if (seat.catId !== null) {
      const cat = s.cats[seat.catId];
      const say = this.activeSay(cat.id);
      const orderTag = cat.order !== null ? `<div class="order-tag">${Art.glass(cat.order)}<span>${CONFIG.drink(cat.order).name}</span></div>` : '';
      if (cat.away) {
        const where = { toilet: 'トイレ', grass: '猫草', scratch: '爪とぎ' }[cat.away.kind];
        bubble = `<div class="bubble away">${where}に行ってるにゃ${orderTag}</div>`;
        body = cushion();
      } else {
        const sleeping = cat.order !== null && t - cat.orderedAt >= CONFIG.sleepAfter;
        let face = 'sit';
        if (say) face = say.face;
        else if (sleeping) face = 'sleep';
        else if (cat.wipeUntil && t < cat.wipeUntil) face = 'happy';
        body = `<div class="cat-wrap">${Art.cat(cat.color, face)}${face === 'sleep' ? '<div class="zzz">z<span>z</span><span>Z</span></div>' : ''}</div>`;
        if (say) bubble = `<div class="bubble say">${say.text}</div>`;
        else if (cat.order !== null) bubble = `<div class="bubble order">${orderTag}</div>`;
      }
      if (cat.glass) items += Art.glass(cat.glass.drink, t < cat.glass.until);
      if (cat.food !== 'none') {
        const half = cat.food === 'eating' && t > cat.foodUntil - CONFIG.eatSec / 2;
        items += Art.dish(cat.food === 'done' ? 'empty' : half ? 'eating' : 'full');
      }
      if (cat.oshibori) items += Art.oshibori(!(cat.wipeUntil && t < cat.wipeUntil));
    } else if (seat.dirty) {
      body = cushion();
      if (seat.leftover.glass) items += Art.glass(null);
      if (seat.leftover.dish) items += Art.dish('empty');
      if (seat.leftover.oshibori) items += Art.oshibori(true);
      if (seat.coins > 0) items += `<span class="seat-coins">${Art.koban()}<b>${seat.coins}</b></span>`;
      note = `<div class="seat-note">タップで片付け</div>`;
    } else {
      body = cushion();
    }
    return `<div class="seat-bubble">${bubble}</div><div class="seat-body">${body}</div>
      <div class="seat-items">${items}</div>${note}<div class="seat-no">${i + 1}</div>`;
  },

  // ---------------------------------------------------------
  // カウンター裏
  // ---------------------------------------------------------
  backSlots() {
    const s = Game.state;
    const low = CONFIG.lowStock;
    const map = {};
    const lowCls = (n, limit) => (n <= limit ? 'low' : '');

    map.rack = `<div class="tile-row">
      <button class="tile ${lowCls(s.glasses.clean, low.glasses)}" data-act="glassRack">${Art.glass(null)}<b>グラス</b><span>${s.glasses.clean} / ${s.glasses.total}</span></button>
      <div class="tile static ${lowCls(s.dishes.clean, low.dishes)}">${Art.dish('empty')}<b>小皿</b><span>${s.dishes.clean} / ${s.dishes.total}</span></div>
    </div>`;
    map.food = `<button class="tile wide ${lowCls(s.stock.food, low.food)}" data-act="food">${Art.dish('full')}<b>お通しを盛る</b><span>フード 残り ${s.stock.food}皿</span></button>`;
    map.warmer = `<button class="tile wide ${lowCls(s.warmer, low.warmer)}" data-act="warmer">${Art.oshibori()}<b>おしぼりを取る</b><span>${s.warmer}本</span></button>`;

    map.fridge = `<div class="tile-row">
      <button class="tile ${lowCls(s.stock.milk, low.milk)}" data-act="fridge" data-d="milk">${Art.glass('milk')}<b>猫用ミルク</b><span>${s.stock.milk}杯</span></button>
      <button class="tile ${lowCls(s.stock.goat, low.goat)}" data-act="fridge" data-d="goat">${Art.glass('goat')}<b>ヤギミルク</b><span>${s.stock.goat}杯</span></button>
    </div>`;

    const sel = Game.selectedItem();
    const washing = s.sink.washing;
    const sinkCount = s.sink.glasses + s.sink.dishes;
    let sinkText;
    if (sel) sinkText = `<b>ここに下げる</b><span>${this.itemName(sel)}を流しへ</span>`;
    else if (washing) sinkText = `<b>ジャブジャブ…</b><span>洗っています</span>`;
    else sinkText = `<b>${sinkCount > 0 ? '洗う' : '流し'}</b><span>グラス ${s.sink.glasses}・小皿 ${s.sink.dishes}</span>`;
    map.sink = `<div class="tile-row">
      <button class="tile" data-act="faucet">${Art.glass('water')}<b>蛇口（水）</b><span>無料</span></button>
      <button class="tile sink ${washing ? 'washing' : ''}" data-act="sink"><span class="sink-icon">${washing ? '<i class="bub b1"></i><i class="bub b2"></i><i class="bub b3"></i>' : ''}🚰</span>${sinkText}</button>
    </div>`;

    map.phone = `<button class="phone-btn" data-act="nav" data-to="order">☎️ 電話で発注<span>${s.deliveries.length > 0 ? '配達中 ' + s.deliveries.length + '件' : ''}</span>${this.badges.order ? '<span class="badge">にゃ</span>' : ''}</button>`;

    // 鍋
    const hasEmptyGlass = Game.emptyGlassIndex() >= 0;
    s.stoves.forEach((stove, si) => {
      map['pot' + si] = this.potSvg(stove, si, hasEmptyGlass);
      const simmer = stove.comps.some((c) => c.state === 'simmer');
      const warm = stove.comps.some((c) => c.state === 'ready');
      map['steam' + si] = simmer || warm
        ? `<div class="steam ${simmer ? 'boil' : ''}"><i></i><i></i><i></i></div>`
        : '';
    });

    // 材料の在庫
    let pantry = '<div class="pantry"><span class="pantry-title">だしの材料（仕切りの数）</span>';
    for (const d of CONFIG.drinks.filter((x) => x.source === 'pot')) {
      const item = CONFIG.orderItems.find((o) => o.id === d.ingredient);
      const n = s.stock[d.ingredient];
      pantry += `<span class="pantry-item ${n <= 0 ? 'none' : ''}"><i style="background:${d.color}"></i>${item.name} ${n}<small>${item.place}</small></span>`;
    }
    pantry += '</div>';
    map.pantry = pantry;

    // 注文の一覧
    const orders = Game.seatedCats().filter((c) => c.order !== null).sort((a, b) => a.seat - b.seat);
    map.orders = orders.length === 0
      ? '<div class="orders-none">いまは注文はないにゃ</div>'
      : orders.map((c) => {
        const d = CONFIG.drink(c.order);
        const zzz = s.time - c.orderedAt >= CONFIG.sleepAfter ? '<small>💤</small>' : '';
        return `<div class="order-row"><b>${c.seat + 1}番</b><i style="background:${d.color}"></i><span>${d.name}</span>${zzz}</div>`;
      }).join('');
    return map;
  },

  // 火鍋型の鍋（5つの仕切り）
  potSvg(stove, si, hasEmptyGlass) {
    const t = Game.state.time;
    const cx = 90;
    const cy = 90;
    const r = 76;
    let svg = `<svg class="pot" viewBox="0 0 180 214" xmlns="http://www.w3.org/2000/svg">`;
    // 火
    svg += `<g class="fire" transform="translate(0,16)"><path d="M60,196 Q55,180 66,172 Q66,184 74,186 Q72,170 86,162 Q86,178 96,182 Q100,170 112,172 Q120,184 116,196 Z" fill="#f08a3c"/>
      <path d="M72,196 Q70,186 78,182 Q80,190 88,190 Q90,180 100,182 Q106,190 102,196 Z" fill="#f8d35a"/></g>`;
    // 鍋のふち
    svg += `<circle cx="${cx}" cy="${cy}" r="${r + 9}" fill="#8a7e74" stroke="#4a403a" stroke-width="3"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="#3b3532"/>`;
    const n = stove.comps.length;
    stove.comps.forEach((c, ci) => {
      const a0 = (-90 + (ci * 360) / n) * (Math.PI / 180);
      const a1 = (-90 + ((ci + 1) * 360) / n) * (Math.PI / 180);
      const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
      const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      let fill = '#55504b';
      let line1 = '空';
      let line2 = 'タップ';
      if (c.state === 'water') {
        fill = '#a9d8ee';
        line1 = '水';
        line2 = '材料は？';
      } else if (c.state === 'simmer') {
        const d = CONFIG.drink(c.dashi);
        fill = d.color;
        line1 = d.short;
        line2 = 'あと' + Math.ceil(c.doneAt - t);
      } else if (c.state === 'ready') {
        const d = CONFIG.drink(c.dashi);
        fill = d.color;
        line1 = d.short;
        line2 = '×' + c.servings;
      }
      const glow = c.state === 'ready' && hasEmptyGlass ? ' can-ladle' : '';
      svg += `<path class="comp comp-${c.state}${glow}" data-act="comp" data-s="${si}" data-c="${ci}"
        d="M${cx},${cy} L${p0[0].toFixed(1)},${p0[1].toFixed(1)} A${r},${r} 0 0 1 ${p1[0].toFixed(1)},${p1[1].toFixed(1)} Z"
        fill="${fill}" stroke="#3b3532" stroke-width="4"/>`;
      const am = (a0 + a1) / 2;
      const lx = cx + 47 * Math.cos(am);
      const ly = cy + 47 * Math.sin(am);
      const dark = c.state === 'empty';
      svg += `<text class="comp-label" x="${lx.toFixed(1)}" y="${(ly - 2).toFixed(1)}" fill="${dark ? '#d8d0c8' : '#4a382c'}">${line1}</text>`;
      svg += `<text class="comp-label sub" x="${lx.toFixed(1)}" y="${(ly + 13).toFixed(1)}" fill="${dark ? '#b0a69c' : '#6a5444'}">${line2}</text>`;
    });
    svg += `<circle cx="${cx}" cy="${cy}" r="9" fill="#8a7e74" stroke="#3b3532" stroke-width="3"/>`;
    svg += `</svg>`;
    return svg;
  },

  // ---------------------------------------------------------
  // トイレ
  // ---------------------------------------------------------
  toiletSlots() {
    const s = Game.state;
    const tl = s.toilet;
    const level = tl.litter / CONFIG.litterMax; // 猫砂の量
    // 塊の位置（いつも同じ場所に出るように決めておく）
    // 横の位置と、砂の表面からの深さ（砂が減ると塊も一緒に下がる）
    const sandTop = 230 - 120 * level;
    const spots = [[150, 10], [250, 22], [350, 8], [200, 34], [300, 40], [400, 28], [120, 38], [450, 14], [230, 6], [380, 46], [170, 24], [330, 26]]
      .map(([x, depth]) => [x, Math.min(232, sandTop + 4 + depth)]);
    let svg = `<svg class="litter-box" viewBox="0 0 560 280" xmlns="http://www.w3.org/2000/svg">
      <path d="M40,90 L520,90 L490,250 L70,250 Z" fill="#9cc9d8" stroke="#5a8696" stroke-width="4" stroke-linejoin="round"/>
      <path d="M58,${sandTop.toFixed(0)} L502,${sandTop.toFixed(0)} L486,240 L74,240 Z" fill="${level > 0 ? '#e9dcc3' : '#cfd8dc'}"/>
      <ellipse cx="280" cy="90" rx="240" ry="8" fill="#b7dbe6" stroke="#5a8696" stroke-width="3"/>`;
    for (let i = 0; i < Math.min(tl.clumps, spots.length); i++) {
      const [x, y] = spots[i];
      svg += `<g class="clump" data-act="scoop"><circle cx="${x}" cy="${y}" r="30" fill="transparent"/>
        <ellipse cx="${x}" cy="${y}" rx="17" ry="11" fill="#b59a74" stroke="#8a7050" stroke-width="2"/></g>`;
    }
    svg += `</svg>`;
    const more = tl.clumps > spots.length ? `<div class="more">ほかにも ${tl.clumps - spots.length} こ</div>` : '';
    const box = `<div class="box-wrap">${svg}${more}${this.awayCatHtml('toilet')}
      <div class="box-hint">${tl.clumps > 0 ? '塊をタップしてスコップですくおう（1つ1タップ）' : 'きれいだにゃ'}</div></div>`;

    const lowBox = tl.litter <= CONFIG.lowStock.litterBox;
    const side = `<div class="side-panel">
      <div class="meter-label">猫砂の量 <b>${tl.litter} / ${CONFIG.litterMax}</b></div>
      <div class="meter ${lowBox ? 'low' : ''}"><i style="width:${level * 100}%"></i></div>
      <button class="btn ${s.stock.litter <= 0 ? 'off' : ''}" data-act="refill">猫砂を補充する</button>
      <div class="stock-line ${s.stock.litter <= CONFIG.lowStock.litter ? 'low' : ''}">猫砂の袋：残り補充 ${s.stock.litter}回分</div>
      <div class="trash">🗑️ ゴミ箱</div>
    </div>`;
    return { box, side };
  },

  // ---------------------------------------------------------
  // 洗濯
  // ---------------------------------------------------------
  laundryHtml() {
    const s = Game.state;
    const w = s.washer;
    const done = Game.laundryDone();
    let basket = '';
    for (let i = 0; i < Math.min(s.basket, 10); i++) basket += Art.oshibori(true);
    let status;
    let button;
    if (w.count === 0) {
      status = '止まっています';
      button = `<button class="btn ${s.basket <= 0 ? 'off' : ''}" data-act="laundryStart">洗濯かごの中身を入れて回す</button>`;
    } else if (!done) {
      status = `洗濯中（おしぼり ${w.count}本） あと ${Math.ceil(w.doneAt - s.time)} 秒`;
      button = `<button class="btn off" data-act="laundryStart">洗濯中…</button>`;
    } else {
      status = `洗い上がり！（おしぼり ${w.count}本）`;
      button = `<button class="btn" data-act="laundryOut">取り出してウォーマーへ</button>`;
    }
    return `<div class="laundry">
      <div class="basket-box"><div class="basket">${basket || '<span class="empty-text">空っぽ</span>'}</div><div class="cap">洗濯かご：おしぼり ${s.basket}本</div></div>
      <div class="arrow">➜</div>
      <div class="washer-box"><div class="washer ${w.count > 0 && !done ? 'running' : ''}"><div class="drum"><i></i></div></div>
        <div class="cap">${status}</div>${button}</div>
      <div class="arrow">➜</div>
      <div class="warmer-box">${Art.oshibori()}<div class="cap">おしぼりウォーマー：${s.warmer}本</div></div>
    </div>`;
  },

  // ---------------------------------------------------------
  // 猫草
  // ---------------------------------------------------------
  grassHtml() {
    const s = Game.state;
    const g = s.grass;
    let blades = '';
    for (let i = 0; i < g.units; i++) {
      const x = 70 + (i * 260) / CONFIG.grassMax + ((i * 37) % 11);
      const h = 90 + ((i * 53) % 40);
      const lean = ((i * 29) % 21) - 10;
      blades += `<path d="M${x},200 Q${x + lean / 2},${200 - h / 2} ${x + lean},${200 - h}" stroke="${i % 2 ? '#6fbf5a' : '#5aa848'}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    }
    const svg = `<svg class="planter" viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg">
      ${blades}
      <path d="M50,195 L350,195 L330,255 L70,255 Z" fill="#c9875a" stroke="#8a5634" stroke-width="4" stroke-linejoin="round"/>
      <rect x="44" y="188" width="312" height="16" rx="6" fill="#d89a6c" stroke="#8a5634" stroke-width="3"/>
    </svg>`;
    const wait = Game.grassWaterWait();
    let waterBtn;
    if (g.units <= 0) waterBtn = `<button class="btn off" data-act="water">水やり（食べ尽くされた）</button>`;
    else if (g.units >= CONFIG.grassMax) waterBtn = `<button class="btn off" data-act="water">水やり（伸びきっている）</button>`;
    else if (wait > 0) waterBtn = `<button class="btn off" data-act="water">次の水やりまで あと ${this.fmt(wait)}</button>`;
    else waterBtn = `<button class="btn" data-act="water">💧 水やり（1単位伸びる）</button>`;
    const status = g.units <= 0 ? '完全に食べられちゃった。交換しよう' : g.units <= CONFIG.lowStock.grass ? 'だいぶ減ってきたにゃ' : 'わさわさ';
    return `<div class="goods">
      <div class="goods-pic">${svg}${this.awayCatHtml('grass')}</div>
      <div class="side-panel">
        <div class="meter-label">猫草 <b>${g.units} / ${CONFIG.grassMax}</b>　${status}</div>
        <div class="meter green ${g.units <= CONFIG.lowStock.grass ? 'low' : ''}"><i style="width:${(g.units / CONFIG.grassMax) * 100}%"></i></div>
        ${waterBtn}
        <button class="btn ${s.stock.grass <= 0 ? 'off' : ''}" data-act="grassReplace">新しい鉢に交換する</button>
        <div class="stock-line">交換用の鉢：${s.stock.grass}鉢（発注で届く）</div>
      </div></div>`;
  },

  // ---------------------------------------------------------
  // 爪とぎ
  // ---------------------------------------------------------
  scratchHtml() {
    const s = Game.state;
    const uses = s.scratcher.uses;
    const left = Math.max(0, CONFIG.scratcherMax - uses);
    const worn = Math.min(1, uses / CONFIG.scratcherMax);
    let marks = '';
    for (let i = 0; i < Math.min(uses, 30); i++) {
      const x = 110 + ((i * 47) % 170);
      const y = 40 + ((i * 31) % 150);
      marks += `<path d="M${x},${y} l14,26" stroke="#8a6440" stroke-width="2.5" stroke-linecap="round"/>`;
    }
    const svg = `<svg class="scratcher" viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg">
      <rect x="90" y="20" width="220" height="200" rx="14" fill="${worn >= 1 ? '#c8a578' : '#dcb98a'}" stroke="#8a6440" stroke-width="4"/>
      ${[50, 80, 110, 140, 170, 200].map((y) => `<path d="M96,${y} L304,${y}" stroke="#c49a68" stroke-width="2"/>`).join('')}
      ${marks}
      ${worn >= 1 ? '<path d="M100,60 l20,10 l-14,10 M280,120 l18,8 l-16,12 M150,180 l22,6" stroke="#a07a50" stroke-width="3" fill="none"/>' : ''}
      <rect x="70" y="220" width="260" height="22" rx="8" fill="#9a7a5a" stroke="#6a4e34" stroke-width="3"/>
    </svg>`;
    const status = left > 0 ? `あと ${left} 回で交換の目安` : 'ボロボロ！交換が必要（猫は気にせず使うにゃ）';
    return `<div class="goods">
      <div class="goods-pic ${left <= 0 ? 'worn' : ''}">${svg}${this.awayCatHtml('scratch')}</div>
      <div class="side-panel">
        <div class="meter-label">使われた回数 <b>${uses} / ${CONFIG.scratcherMax}</b></div>
        <div class="meter wood ${left <= CONFIG.lowStock.scratcher ? 'low' : ''}"><i style="width:${(1 - worn) * 100}%"></i></div>
        <div class="stock-line ${left <= 0 ? 'alert' : ''}">${status}</div>
        <button class="btn ${s.stock.scratcher <= 0 ? 'off' : ''}" data-act="scratchReplace">新しい爪とぎに交換する</button>
        <div class="stock-line">交換用の爪とぎ：${s.stock.scratcher}個（発注で届く）</div>
      </div></div>`;
  },

  // ---------------------------------------------------------
  // 発注
  // ---------------------------------------------------------
  orderSlots() {
    const s = Game.state;
    let list = `<table class="order-table"><tr><th>品目</th><th>1回の量</th><th>価格</th><th>在庫</th><th>数</th></tr>`;
    for (const item of CONFIG.orderItems) {
      const q = this.orderQty[item.id] || 0;
      list += `<tr class="${q > 0 ? 'picked' : ''}"><td><b>${item.name}</b><small>${item.place}</small></td><td>${item.amountText}</td>
        <td>${item.price}小判</td><td>${this.stockText(item.id)}</td>
        <td class="qty"><button data-act="qty" data-id="${item.id}" data-n="-1">－</button><b>${q}</b><button data-act="qty" data-id="${item.id}" data-n="1">＋</button></td></tr>`;
    }
    list += `</table>`;

    const total = Game.orderTotal(this.orderQty);
    const can = total > 0 && total <= s.coins;
    let side = `<div class="order-sum">
      <div>合計 <b>${total}</b> 小判</div>
      <div>所持 <b>${s.coins}</b> 小判</div>
      <button class="btn big ${can ? '' : 'off'}" data-act="placeOrder" ${can ? '' : 'disabled'}>注文する</button>
      ${total > s.coins ? '<div class="warn">小判が足りないにゃ</div>' : ''}
    </div><div class="deliveries"><h3>配達中</h3>`;
    if (s.deliveries.length === 0) side += '<div class="none">配達中のものはないにゃ</div>';
    for (const d of s.deliveries) {
      const names = Object.entries(d.items).map(([id, n]) => CONFIG.orderItems.find((o) => o.id === id).name + (n > 1 ? '×' + n : '')).join('、');
      side += `<div class="delivery"><b>あと ${this.fmt(d.arriveAt - s.time)}</b><span>${names}</span></div>`;
    }
    side += '</div>';
    return { list, side };
  },

  // 今の在庫の表示（品目ごとに単位が違う）
  stockText(id) {
    const n = Game.state.stock[id] || 0;
    const unit = { milk: '杯', goat: '杯', katsuo: '仕切り', niboshi: '仕切り', sasami: '仕切り', hotate: '仕切り', maguro: '仕切り', food: '皿', litter: '回', scratcher: '個', grass: '鉢' }[id];
    return n + unit;
  },

  // ---------------------------------------------------------
  // お店の買い物
  // ---------------------------------------------------------
  shopHtml() {
    const s = Game.state;
    let html = `<div class="shop-now">いまの設備：コンロ ${s.stoves.length}口　グラス ${s.glasses.total}個　小皿 ${s.dishes.total}枚</div><div class="shop-list">`;
    const icons = { stove2: '🔥', stove3: '🔥', glasses: Art.glass(null), dishes: Art.dish('empty') };
    for (const item of CONFIG.shopItems) {
      const blocked = Game.shopBlocked(item.id);
      html += `<div class="shop-card ${blocked === '購入済み' ? 'bought' : ''}"><div class="shop-icon">${icons[item.id]}</div>
        <b>${item.name}</b><span>${item.price} 小判</span>
        <button class="btn ${blocked ? 'off' : ''}" data-act="buy" data-id="${item.id}" ${blocked ? 'disabled' : ''}>${blocked || '買う'}</button></div>`;
    }
    html += '</div>';
    return html;
  },
};
