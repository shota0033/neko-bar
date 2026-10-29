// =============================================================
// main.js … 起動処理と、時間の進め方
//
// ・ゲーム領域（1280×720）をウィンドウの大きさに合わせて拡大縮小する
// ・画面が見えている間だけゲームの時間を進める
//   （ゲームを閉じている間・タブを裏に回している間・スマホの画面を閉じている間は止まる）
// ・10秒ごと、クローズ時、画面が見えなくなるときに自動保存する
// ・URL に ?debug を付けると、時間が10倍速になり、リセットボタンが出る
// =============================================================

const Main = {
  debug: /[?&]debug\b/.test(location.search),
  speed: 1,
  lastFrame: null,
  lastView: 0,
  saveTimer: 0,

  start() {
    this.speed = this.debug ? CONFIG.debugSpeed : 1;
    document.title = CONFIG.title;
    Sound.init();
    Game.init(SaveData.load());
    const isNew = Game.state.time === 0;
    View.init(document.getElementById('stage'), this.debug);
    if (isNew) View.showToast('まずはカウンター裏で、鍋にだしを仕込もう');

    // 画面が見えなくなるときに保存する。見えない間は時間を止める
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
      this.lastFrame = null; // 戻ってきたとき、止まっていた分を進めない
    });
    window.addEventListener('pagehide', () => this.save());

    requestAnimationFrame((now) => this.frame(now));
  },

  frame(now) {
    if (!document.hidden) {
      // 前のフレームからの時間。長く止まっていた分は進めない（最大0.25秒）
      const dt = this.lastFrame === null ? 0 : Math.min((now - this.lastFrame) / 1000, 0.25);
      this.lastFrame = now;
      Game.tick(dt * this.speed);

      this.saveTimer += dt;
      if (this.saveTimer >= CONFIG.autoSaveSec) this.save();

      // 鍋が煮えているあいだ、カウンター裏ではぐつぐつ音
      const simmering = View.screen === 'back' && Game.state.stoves.some((st) => st.comps.some((c) => c.state === 'simmer'));
      Sound.ambient(dt, simmering);

      // 画面の書き換えは 0.1 秒ごと
      if (now - this.lastView >= 100) {
        this.lastView = now;
        View.update();
      }
    }
    requestAnimationFrame((t) => this.frame(t));
  },

  save() {
    this.saveTimer = 0;
    SaveData.save(Game.state);
  },

  // 保存データを消して最初から
  reset() {
    SaveData.clear();
    Game.init(null);
    View.says = {};
    View.orderQty = {};
    View.hairProgress = {};
    View.badges = { seats: false, toilet: false, laundry: false, order: false };
    View.go('seats');
    View.showToast('最初からにしたにゃ。まずはカウンター裏で、鍋にだしを仕込もう');
    this.save();
  },
};

// ゲーム領域をウィンドウに収まる大きさに拡大縮小する
let fittedSize = ''; // 最後に合わせた画面の大きさ（変わっていなければ何もしない）
function fitStage() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w + 'x' + h === fittedSize) return;
  fittedSize = w + 'x' + h;
  const stage = document.getElementById('stage');
  const scale = Math.min(w / CONFIG.stageWidth, h / CONFIG.stageHeight);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

window.addEventListener('DOMContentLoaded', () => {
  fitStage();
  // スマホを横向きにしたまま起動すると、開いた瞬間は縦向きの大きさが返ってきて、
  // そのあと「大きさが変わった」知らせが来ないことがある（わんこ亭で起きた問題）。
  // そのため、いろいろな知らせで合わせ直すほか、0.5秒ごとにも大きさを確かめる。
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', fitStage);
  window.addEventListener('pageshow', fitStage);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitStage);
  setInterval(fitStage, 500);

  // 画像の読み込みが終わってから始める（置いていなければすぐ終わる）
  Art.preload(() => Main.start());
});
