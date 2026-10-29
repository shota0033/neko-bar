// =============================================================
// game.js … ゲームの中身（状態と、時間の進み方と、プレイヤーの操作）
//
// 画面には関わらず、状態（Game.state）を変えるだけです。
// 何か起きたら Game.emit('名前', {...}) で知らせ、
// 画面（view.js）と音（sound.js）がそれを受け取って反応します。
//
// 時間はすべて state.time（ゲームの秒）で数えます。
// 「〜秒後に注文する」などは、その時刻を覚えておき、state.time が追いついたら起こします。
// state.time はゲームを開いて画面が見えているときだけ進むので、
// 閉じている間は配達の残り時間なども止まります。
// =============================================================

const Game = {
  state: null,
  listeners: [],

  // ---------------------------------------------------------
  // 知らせ
  // ---------------------------------------------------------
  on(fn) {
    this.listeners.push(fn);
  },
  emit(type, data = {}) {
    for (const fn of this.listeners) fn(type, data);
  },
  // プレイヤーへの小さなお知らせ（画面の下に少しだけ出る）
  hint(text) {
    this.emit('hint', { text });
  },

  // min〜max のランダムな整数
  rand(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  },
  pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  },

  // ---------------------------------------------------------
  // 始め方
  // ---------------------------------------------------------
  newStove() {
    const comps = [];
    for (let i = 0; i < CONFIG.compartments; i++) {
      // state: empty（空） / water（水が入った） / simmer（煮出し中） / ready（完成・保温中）
      comps.push({ state: 'empty', dashi: null, doneAt: null, servings: 0 });
    }
    return { comps };
  },

  newState() {
    const st = CONFIG.start;
    const seats = [];
    for (let i = 0; i < CONFIG.seats; i++) {
      // dirty: 帰ったあとで片付け前、coins: 置いていった小判、leftover: 残っている食器など、hair: 抜け毛
      seats.push({ catId: null, dirty: false, coins: 0, leftover: { glass: 0, dish: 0, oshibori: 0 }, hair: false });
    }
    return {
      v: 1,
      time: 0,
      open: false,
      coins: st.coins,
      nextArrivalAt: null,
      nextCatId: 1,
      nextDeliveryId: 1,
      seats,
      waiting: [], // 入口で待っている猫のid（来た順）
      cats: {},
      stock: { ...st.stock },
      glasses: { clean: st.glasses, total: st.glasses },
      dishes: { clean: st.dishes, total: st.dishes },
      sink: { glasses: 0, dishes: 0, washing: null }, // washing: { glasses, dishes, doneAt }
      warmer: CONFIG.warmerMax,
      basket: 0, // 洗濯かごのおしぼり
      washer: { count: 0, doneAt: null, notified: false },
      stoves: [this.newStove()],
      toilet: { clumps: 0, litter: CONFIG.litterMax },
      grass: { units: CONFIG.grassMax, lastWaterAt: null },
      scratcher: { uses: 0 },
      deliveries: [], // { id, items: { 品目id: 個数 }, arriveAt }
      tray: [],       // お盆の上の物 { kind: 'glass', drink } / { kind: 'dish' } / { kind: 'oshibori' }
      selected: -1,   // お盆で選んでいる物の番号（-1 は選んでいない）
    };
  },

  // 保存データがあれば続きから、なければ最初から
  init(saved) {
    const fresh = this.newState();
    if (saved && saved.v === 1) {
      // 後から増えた項目が保存データになくても動くように、足りない分は最初の値で補う
      this.state = Object.assign(fresh, saved);
      this.state.stock = Object.assign({ ...CONFIG.start.stock }, saved.stock);
    } else {
      this.state = fresh;
    }
    if (this.state.selected >= this.state.tray.length) this.state.selected = -1;
  },

  // ---------------------------------------------------------
  // 数える
  // ---------------------------------------------------------
  catList() {
    return Object.values(this.state.cats);
  },
  // 店内の猫の数（入口で待っている猫も含む）
  catCount() {
    return Object.keys(this.state.cats).length;
  },
  seatedCats() {
    return this.catList().filter((c) => c.seat !== null);
  },
  freeSeats() {
    const list = [];
    this.state.seats.forEach((seat, i) => {
      if (seat.catId === null && !seat.dirty) list.push(i);
    });
    return list;
  },

  // ---------------------------------------------------------
  // 時間を進める（main.js から毎フレーム呼ばれる）
  // ---------------------------------------------------------
  tick(dt) {
    const s = this.state;
    s.time += dt;
    const t = s.time;

    // 来店
    if (s.open && s.nextArrivalAt !== null && t >= s.nextArrivalAt) {
      this.arrive();
      s.nextArrivalAt = t + this.rand(CONFIG.arrival.min, CONFIG.arrival.max);
    }

    // 配達
    for (const d of s.deliveries.slice()) {
      if (t >= d.arriveAt) {
        for (const [id, n] of Object.entries(d.items)) {
          const item = CONFIG.orderItems.find((o) => o.id === id);
          s.stock[id] = (s.stock[id] || 0) + item.amount * n;
        }
        s.deliveries = s.deliveries.filter((x) => x !== d);
        this.emit('delivered', { delivery: d });
      }
    }

    // 洗い物
    if (s.sink.washing && t >= s.sink.washing.doneAt) {
      s.glasses.clean += s.sink.washing.glasses;
      s.dishes.clean += s.sink.washing.dishes;
      s.sink.washing = null;
      this.emit('washDone');
    }

    // 洗濯
    if (s.washer.count > 0 && !s.washer.notified && t >= s.washer.doneAt) {
      s.washer.notified = true;
      this.emit('laundryDone');
    }

    // だし
    s.stoves.forEach((stove) => {
      for (const c of stove.comps) {
        if (c.state === 'simmer' && t >= c.doneAt) {
          c.state = 'ready';
          c.servings = CONFIG.dashiServings;
          c.doneAt = null;
          this.emit('dashiDone', { dashi: c.dashi });
        }
      }
    });

    // 猫
    for (const cat of this.catList()) this.tickCat(cat);
  },

  tickCat(cat) {
    const s = this.state;
    const t = s.time;

    // 入口で待っている猫には何も起きない（できごとの判定の時刻だけ進める）
    if (cat.seat === null) {
      while (t >= cat.nextCheckAt) cat.nextCheckAt += CONFIG.eventInterval;
      return;
    }

    // 席に戻ってくる
    if (cat.away && t >= cat.away.until) {
      cat.away = null;
      this.emit('catBack', { cat });
    }

    // 滞在中のできごと（10秒ごとに判定）
    while (t >= cat.nextCheckAt) {
      cat.nextCheckAt += CONFIG.eventInterval;
      if (!cat.away) this.rollEvent(cat);
    }

    // 注文
    if (cat.order === null && cat.orderAt !== null && t >= cat.orderAt) {
      cat.order = this.pick(CONFIG.drinks).id;
      cat.orderedAt = t;
      cat.orderAt = null;
      this.emit('order', { cat });
    }

    // 食べ終わる
    if (cat.food === 'eating' && t >= cat.foodUntil) {
      cat.food = 'done';
    }

    // 帰る（席を離れているときは、戻ってから）
    if (cat.leaveAt !== null && t >= cat.leaveAt && !cat.away) {
      this.leave(cat);
    }
  },

  // 滞在中のできごと：起きるものがあれば1つだけ起こす
  rollEvent(cat) {
    const s = this.state;
    for (const ev of CONFIG.events) {
      if (cat.done[ev.id]) continue;
      if (ev.id === 'grass' && s.grass.units <= 0) continue;
      if (Math.random() >= ev.chance) continue;

      cat.done[ev.id] = true;
      cat.away = { kind: ev.id, until: s.time + CONFIG.awaySec, yada: false };
      if (ev.id === 'toilet') {
        // 汚れていても使う。ちょっと嫌そうな顔をするだけ
        cat.away.yada = s.toilet.clumps > 0 || s.toilet.litter <= 0;
        s.toilet.clumps++;
      } else if (ev.id === 'grass') {
        s.grass.units--;
      } else if (ev.id === 'scratch') {
        s.scratcher.uses++;
      }
      this.emit('catAway', { cat, kind: ev.id });
      return;
    }
  },

  // ---------------------------------------------------------
  // 来店・着席・帰る
  // ---------------------------------------------------------
  pickCups() {
    let r = Math.random() * 100;
    for (const row of CONFIG.cupsTable) {
      r -= row.percent;
      if (r < 0) return row.cups;
    }
    return 1;
  },

  arrive() {
    const s = this.state;
    const free = this.freeSeats();
    // 空席がなく、入口もいっぱいなら来ない
    if ((free.length === 0 || s.waiting.length > 0) && s.waiting.length >= CONFIG.waitMax) return;

    const cat = {
      id: s.nextCatId++,
      color: this.pick(CONFIG.catColors).id,
      cups: this.pickCups(), // この猫が飲む杯数（内部だけで使う）
      served: 0,             // 出してもらった杯数
      order: null,           // 今の注文（まだ出していないドリンクのid）
      orderedAt: null,
      orderAt: null,         // 次に注文する時刻
      leaveAt: null,         // 帰る時刻
      lastServedAt: null,
      glass: null,           // 席にあるグラス { drink, until: 飲み終わる時刻 }
      oshibori: false,
      wipeUntil: null,
      food: 'none',          // none / eating / done
      foodUntil: null,
      bill: 0,               // お会計（帰るときに席に置く小判）
      done: {},              // 起きたできごと（猫ごとに1回まで）
      away: null,            // 席を離れている { kind, until, yada }
      arrivedAt: s.time,
      nextCheckAt: s.time + CONFIG.eventInterval,
      seat: null,
    };
    s.cats[cat.id] = cat;

    if (free.length > 0 && s.waiting.length === 0) {
      this.seatCat(cat, this.pick(free));
    } else {
      s.waiting.push(cat.id);
    }
    this.emit('arrive', { cat });
  },

  seatCat(cat, seatIndex) {
    const s = this.state;
    cat.seat = seatIndex;
    s.seats[seatIndex].catId = cat.id;
    cat.orderAt = s.time + this.rand(CONFIG.firstOrder.min, CONFIG.firstOrder.max);
    this.emit('seated', { cat });
  },

  // 席が空いたら、入口で待っている猫を待った順に座らせる
  seatWaiting() {
    const s = this.state;
    while (s.waiting.length > 0) {
      const free = this.freeSeats();
      if (free.length === 0) return;
      const cat = s.cats[s.waiting.shift()];
      this.seatCat(cat, this.pick(free));
    }
  },

  leave(cat) {
    const s = this.state;
    const seat = s.seats[cat.seat];
    seat.catId = null;
    seat.dirty = true;
    seat.coins = cat.bill;
    seat.leftover = {
      glass: cat.glass ? 1 : 0,
      dish: cat.food !== 'none' ? 1 : 0,
      oshibori: cat.oshibori ? 1 : 0,
    };
    seat.hair = true;
    delete s.cats[cat.id];
    this.emit('leave', { cat });

    // 営業中に店が空になったら、次の猫は早めに来る
    if (s.open && this.catCount() === 0) {
      const soon = s.time + this.rand(CONFIG.arrivalEmpty.min, CONFIG.arrivalEmpty.max);
      s.nextArrivalAt = s.nextArrivalAt === null ? soon : Math.min(s.nextArrivalAt, soon);
    }
  },

  // ---------------------------------------------------------
  // オープン／クローズ
  // ---------------------------------------------------------
  toggleOpen() {
    const s = this.state;
    s.open = !s.open;
    if (s.open) {
      const empty = this.catCount() === 0;
      const r = empty ? CONFIG.arrivalEmpty : CONFIG.arrival;
      s.nextArrivalAt = s.time + this.rand(r.min, r.max);
      // まだ飲める猫は、おかわりの注文を再開する
      for (const cat of this.catList()) {
        if (cat.served >= 1 && cat.served < cat.cups && cat.order === null && cat.leaveAt !== null) {
          cat.leaveAt = null;
          cat.orderAt = Math.max(s.time, cat.lastServedAt + CONFIG.refillAfter);
        }
      }
    } else {
      s.nextArrivalAt = null;
      // おかわりはしない。今の1杯（または注文済みの1杯）を飲んだら帰る
      for (const cat of this.catList()) {
        if (cat.served >= 1 && cat.order === null && cat.leaveAt === null) {
          cat.orderAt = null;
          cat.leaveAt = cat.lastServedAt + CONFIG.leaveAfter;
        }
      }
    }
    this.emit(s.open ? 'opened' : 'closed');
  },

  // ---------------------------------------------------------
  // お盆
  // ---------------------------------------------------------
  trayFull() {
    return this.state.tray.length >= CONFIG.trayMax;
  },
  addToTray(item) {
    if (this.trayFull()) {
      this.hint('お盆がいっぱい（3つまで）');
      return false;
    }
    this.state.tray.push(item);
    return true;
  },
  removeFromTray(index) {
    const s = this.state;
    s.tray.splice(index, 1);
    s.selected = -1;
  },
  selectTray(index) {
    const s = this.state;
    s.selected = s.selected === index ? -1 : index;
  },
  // 選んでいる物（なければ null）
  selectedItem() {
    const s = this.state;
    return s.selected >= 0 ? s.tray[s.selected] : null;
  },

  // ---------------------------------------------------------
  // カウンター裏の操作
  // ---------------------------------------------------------

  // 食器置き場のグラス：取る（空のグラスを選んでいるなら戻す）
  tapGlassRack() {
    const s = this.state;
    const sel = this.selectedItem();
    if (sel && sel.kind === 'glass' && sel.drink === null) {
      this.removeFromTray(s.selected);
      s.glasses.clean++;
      this.emit('putBack');
      return;
    }
    if (s.glasses.clean <= 0) {
      this.hint('きれいなグラスがないにゃ（流しで洗おう）');
      return;
    }
    if (!this.addToTray({ kind: 'glass', drink: null })) return;
    s.glasses.clean--;
    this.emit('take');
  },

  // お通し：小皿にキャットフードを盛ってお盆へ（お通しを選んでいるなら戻す）
  tapFood() {
    const s = this.state;
    const sel = this.selectedItem();
    if (sel && sel.kind === 'dish') {
      this.removeFromTray(s.selected);
      s.dishes.clean++;
      s.stock.food++;
      this.emit('putBack');
      return;
    }
    if (s.dishes.clean <= 0) {
      this.hint('きれいな小皿がないにゃ（流しで洗おう）');
      return;
    }
    if (s.stock.food <= 0) {
      this.hint('キャットフードがないにゃ（発注しよう）');
      return;
    }
    if (!this.addToTray({ kind: 'dish' })) return;
    s.dishes.clean--;
    s.stock.food--;
    this.emit('food');
  },

  // おしぼりウォーマー：取る（おしぼりを選んでいるなら戻す）
  tapWarmer() {
    const s = this.state;
    const sel = this.selectedItem();
    if (sel && sel.kind === 'oshibori') {
      this.removeFromTray(s.selected);
      s.warmer++;
      this.emit('putBack');
      return;
    }
    if (s.warmer <= 0) {
      this.hint('おしぼりがないにゃ（洗濯しよう）');
      return;
    }
    if (!this.addToTray({ kind: 'oshibori' })) return;
    s.warmer--;
    this.emit('take');
  },

  // 中身を入れる空のグラスを探す（選んでいる空のグラス → お盆の最初の空のグラス）
  emptyGlassIndex() {
    const s = this.state;
    const sel = this.selectedItem();
    if (sel && sel.kind === 'glass' && sel.drink === null) return s.selected;
    return s.tray.findIndex((it) => it.kind === 'glass' && it.drink === null);
  },
  fillGlass(drinkId) {
    const i = this.emptyGlassIndex();
    if (i < 0) {
      this.hint('先に食器置き場からグラスを取ってね');
      return false;
    }
    this.state.tray[i].drink = drinkId;
    this.state.selected = -1;
    return true;
  },

  // 蛇口：水を注ぐ（無料・無制限）
  tapFaucet() {
    if (this.fillGlass('water')) this.emit('pour', { drink: 'water' });
  },

  // 冷蔵庫：ミルクを注ぐ
  tapFridge(drinkId) {
    const s = this.state;
    const drink = CONFIG.drink(drinkId);
    if (s.stock[drink.stock] <= 0) {
      this.hint(drink.name + 'がないにゃ（発注しよう）');
      return;
    }
    if (this.emptyGlassIndex() < 0) {
      this.hint('先に食器置き場からグラスを取ってね');
      return;
    }
    this.fillGlass(drinkId);
    s.stock[drink.stock]--;
    this.emit('pour', { drink: drinkId });
  },

  // 鍋の仕切り：空 → 水を入れる → 材料を選ぶ（画面が選ぶ窓を出す） → 煮出し → 完成ならすくう
  tapCompartment(si, ci) {
    const s = this.state;
    const c = s.stoves[si].comps[ci];
    if (c.state === 'empty') {
      c.state = 'water';
      this.emit('potWater');
    } else if (c.state === 'water') {
      this.emit('chooseIngredient', { si, ci });
    } else if (c.state === 'simmer') {
      this.hint('煮出し中… あと ' + Math.ceil(c.doneAt - s.time) + ' 秒');
    } else if (c.state === 'ready') {
      const dashi = c.dashi;
      if (!this.fillGlass(dashi)) return;
      c.servings--;
      if (c.servings <= 0) {
        c.state = 'empty';
        c.dashi = null;
      }
      this.emit('ladle', { drink: dashi });
    }
  },

  // 水を入れた仕切りに材料を入れて煮出しを始める
  addIngredient(si, ci, ingredient) {
    const s = this.state;
    const c = s.stoves[si].comps[ci];
    if (c.state !== 'water') return;
    if ((s.stock[ingredient] || 0) <= 0) {
      this.hint('材料がないにゃ');
      return;
    }
    s.stock[ingredient]--;
    c.state = 'simmer';
    c.dashi = ingredient;
    c.doneAt = s.time + CONFIG.simmerSec;
    this.emit('simmerStart');
  },

  // 流し：選んでいる物があれば下げる。なければ洗う
  tapSink() {
    const s = this.state;
    const sel = this.selectedItem();
    if (sel) {
      if (sel.kind === 'glass') s.sink.glasses++;
      else if (sel.kind === 'dish') s.sink.dishes++;
      else if (sel.kind === 'oshibori') s.basket++;
      this.removeFromTray(s.selected);
      this.emit('toSink');
      return;
    }
    if (s.sink.washing) {
      this.hint('いま洗っているにゃ');
      return;
    }
    if (s.sink.glasses + s.sink.dishes === 0) {
      this.hint('洗うものはないにゃ');
      return;
    }
    s.sink.washing = { glasses: s.sink.glasses, dishes: s.sink.dishes, doneAt: s.time + CONFIG.washSec };
    s.sink.glasses = 0;
    s.sink.dishes = 0;
    this.emit('wash');
  },

  // ---------------------------------------------------------
  // 席の操作
  // ---------------------------------------------------------
  tapSeat(i) {
    const s = this.state;
    const seat = s.seats[i];
    if (seat.catId !== null) {
      this.serve(s.cats[seat.catId]);
    } else if (seat.dirty) {
      this.cleanSeat(i);
    }
  },

  // 猫に合う物をお盆から選ぶ（注文と同じドリンク → ほかのドリンク → おしぼり → お通し）
  autoPick(cat) {
    const tray = this.state.tray;
    if (cat.order !== null) {
      let i = tray.findIndex((it) => it.kind === 'glass' && it.drink === cat.order);
      if (i < 0) i = tray.findIndex((it) => it.kind === 'glass' && it.drink !== null);
      if (i >= 0) return i;
    }
    if (!cat.oshibori) {
      const i = tray.findIndex((it) => it.kind === 'oshibori');
      if (i >= 0) return i;
    }
    if (cat.food === 'none') {
      const i = tray.findIndex((it) => it.kind === 'dish');
      if (i >= 0) return i;
    }
    return -1;
  },

  serve(cat) {
    const s = this.state;
    if (s.tray.length === 0) return;
    const index = s.selected >= 0 ? s.selected : this.autoPick(cat);
    if (index < 0) {
      // お盆に物はあるが、この猫に出せるものがない
      const hasDrink = s.tray.some((it) => it.kind === 'glass' && it.drink !== null);
      if (hasDrink && cat.order === null) this.say(cat, 'いまはいいにゃ');
      else if (s.tray.some((it) => it.kind === 'glass' && it.drink === null)) this.hint('グラスに中身を入れてね');
      else this.say(cat, 'もうもらったにゃ');
      return;
    }
    const item = s.tray[index];

    if (item.kind === 'glass') {
      if (item.drink === null) {
        this.hint('からっぽのグラスだにゃ');
        return;
      }
      if (cat.order === null) {
        this.say(cat, 'いまはいいにゃ');
        return;
      }
      const drink = CONFIG.drink(item.drink);
      const match = item.drink === cat.order;
      // おかわりは新しいグラスで。前のグラスはそのとき下げる
      if (cat.glass) s.sink.glasses++;
      cat.glass = { drink: item.drink, until: s.time + CONFIG.drinkSec };
      cat.bill += drink.price;
      cat.order = null;
      cat.orderedAt = null;
      cat.served++;
      cat.lastServedAt = s.time;
      if (cat.served < cat.cups && s.open) {
        cat.orderAt = s.time + CONFIG.refillAfter;
        cat.leaveAt = null;
      } else {
        cat.orderAt = null;
        cat.leaveAt = s.time + CONFIG.leaveAfter;
      }
      this.removeFromTray(index);
      this.say(cat, match ? 'にゃ〜♪' : 'これじゃないけど まあいいにゃ', match ? 'happy' : 'sit');
      this.emit('serve', { cat, match });
    } else if (item.kind === 'oshibori') {
      if (cat.oshibori) {
        this.say(cat, 'もうもらったにゃ');
        return;
      }
      cat.oshibori = true;
      cat.wipeUntil = s.time + CONFIG.wipeSec;
      this.removeFromTray(index);
      this.say(cat, 'ふきふき…', 'happy');
      this.emit('oshibori', { cat });
    } else if (item.kind === 'dish') {
      if (cat.food !== 'none') {
        this.say(cat, 'もうもらったにゃ');
        return;
      }
      cat.food = 'eating';
      cat.foodUntil = s.time + CONFIG.eatSec;
      cat.bill += CONFIG.foodPrice;
      this.removeFromTray(index);
      this.say(cat, 'カリカリ…おいしいにゃ', 'happy');
      this.emit('serveFood', { cat });
    }
  },

  // 猫のひとこと（見た目だけなので保存しない。画面が表示する）
  say(cat, text, face = 'sit') {
    this.emit('say', { cat, text, face });
  },

  // 片付け：小判の回収と、食器・おしぼりの片付けをまとめて
  cleanSeat(i) {
    const s = this.state;
    const seat = s.seats[i];
    const coins = seat.coins;
    s.coins += coins;
    s.sink.glasses += seat.leftover.glass;
    s.sink.dishes += seat.leftover.dish;
    s.basket += seat.leftover.oshibori;
    seat.coins = 0;
    seat.leftover = { glass: 0, dish: 0, oshibori: 0 };
    seat.dirty = false;
    this.emit('clean', { seat: i, coins });
    this.seatWaiting();
  },

  // コロコロで抜け毛を取る（なぞり終わったときに画面から呼ばれる）
  removeHair(i) {
    const seat = this.state.seats[i];
    if (!seat.hair || seat.catId !== null) return;
    seat.hair = false;
    this.emit('hairRemoved', { seat: i });
  },

  // ---------------------------------------------------------
  // 洗濯
  // ---------------------------------------------------------
  laundryDone() {
    const w = this.state.washer;
    return w.count > 0 && this.state.time >= w.doneAt;
  },
  startLaundry() {
    const s = this.state;
    if (s.washer.count > 0) {
      this.hint(this.laundryDone() ? '先に取り出してね' : 'いま洗濯中だにゃ');
      return;
    }
    if (s.basket <= 0) {
      this.hint('洗濯かごは空っぽだにゃ');
      return;
    }
    s.washer = { count: s.basket, doneAt: s.time + CONFIG.laundrySec, notified: false };
    s.basket = 0;
    this.emit('laundryStart');
  },
  takeOutLaundry() {
    const s = this.state;
    if (!this.laundryDone()) return;
    s.warmer += s.washer.count;
    s.washer = { count: 0, doneAt: null, notified: false };
    this.emit('laundryOut');
  },

  // ---------------------------------------------------------
  // トイレ
  // ---------------------------------------------------------
  scoop() {
    const s = this.state;
    if (s.toilet.clumps <= 0) return;
    s.toilet.clumps--;
    s.toilet.litter = Math.max(0, s.toilet.litter - 1);
    this.emit('scoop');
  },
  refillLitter() {
    const s = this.state;
    if (s.toilet.litter >= CONFIG.litterMax) {
      this.hint('猫砂はたっぷりあるにゃ');
      return;
    }
    if (s.stock.litter <= 0) {
      this.hint('猫砂の袋がないにゃ（発注しよう）');
      return;
    }
    s.stock.litter--;
    s.toilet.litter = CONFIG.litterMax;
    this.emit('refill');
  },

  // ---------------------------------------------------------
  // 猫草・爪とぎ
  // ---------------------------------------------------------
  // 次に水やりできるまでの秒数（0 ならすぐできる）
  grassWaterWait() {
    const g = this.state.grass;
    if (g.lastWaterAt === null) return 0;
    return Math.max(0, g.lastWaterAt + CONFIG.grassWaterCooldown - this.state.time);
  },
  waterGrass() {
    const s = this.state;
    if (s.grass.units <= 0) {
      this.hint('食べ尽くされちゃった。交換しよう');
      return;
    }
    if (s.grass.units >= CONFIG.grassMax) {
      this.hint('猫草はもう伸びきっているにゃ');
      return;
    }
    if (this.grassWaterWait() > 0) return;
    s.grass.units++;
    s.grass.lastWaterAt = s.time;
    this.emit('waterGrass');
  },
  replaceGrass() {
    const s = this.state;
    if (s.stock.grass <= 0) {
      this.hint('交換用の鉢がないにゃ（発注しよう）');
      return;
    }
    s.stock.grass--;
    s.grass.units = CONFIG.grassMax;
    this.emit('replace');
  },
  replaceScratcher() {
    const s = this.state;
    if (s.stock.scratcher <= 0) {
      this.hint('交換用の爪とぎがないにゃ（発注しよう）');
      return;
    }
    s.stock.scratcher--;
    s.scratcher.uses = 0;
    this.emit('replace');
  },

  // ---------------------------------------------------------
  // 発注・お店の買い物
  // ---------------------------------------------------------
  orderTotal(qty) {
    let total = 0;
    for (const item of CONFIG.orderItems) total += (qty[item.id] || 0) * item.price;
    return total;
  },
  placeOrder(qty) {
    const s = this.state;
    const total = this.orderTotal(qty);
    if (total <= 0 || total > s.coins) return false;
    const items = {};
    for (const [id, n] of Object.entries(qty)) if (n > 0) items[id] = n;
    s.coins -= total;
    s.deliveries.push({ id: s.nextDeliveryId++, items, arriveAt: s.time + CONFIG.deliverySec });
    this.emit('ordered');
    return true;
  },

  // お店の買い物：買えるかどうか（買えないときは理由の文字、買えるときは null）
  shopBlocked(id) {
    const s = this.state;
    const item = CONFIG.shopItems.find((x) => x.id === id);
    if (id === 'stove2' && s.stoves.length >= 2) return '購入済み';
    if (id === 'stove3') {
      if (s.stoves.length >= 3) return '購入済み';
      if (s.stoves.length < 2) return '2口目のあとで';
    }
    if (s.coins < item.price) return '小判が足りない';
    return null;
  },
  buy(id) {
    const s = this.state;
    if (this.shopBlocked(id)) return;
    const item = CONFIG.shopItems.find((x) => x.id === id);
    s.coins -= item.price;
    if (id === 'stove2' || id === 'stove3') {
      s.stoves.push(this.newStove());
    } else if (id === 'glasses') {
      s.glasses.clean += item.add;
      s.glasses.total += item.add;
    } else if (id === 'dishes') {
      s.dishes.clean += item.add;
      s.dishes.total += item.add;
    }
    this.emit('bought', { id });
  },
};
