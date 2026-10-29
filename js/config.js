// =============================================================
// config.js … ゲームの数値や名前の設定
//
// 数値の調整は、基本的にこのファイルだけで済むようにしています。
// 時間はすべて「ゲームの秒」です（?debug を付けると10倍速で進みます）。
// =============================================================

const CONFIG = {
  title: '猫が来るバー',
  version: 1, // 画面の隅に出る版番号（bump-version.sh で書き換える）

  stageWidth: 1280,
  stageHeight: 720,

  saveKey: 'nekobar_save_v1',
  autoSaveSec: 10, // 何秒ごとに自動保存するか（現実の秒）

  // ---- 座席・来店 ----
  seats: 7,
  waitMax: 3,                       // 入口で待てる猫の数
  arrival: { min: 75, max: 100 },   // 来店間隔
  arrivalEmpty: { min: 20, max: 40 }, // 店内が0匹のときの来店間隔
  firstOrder: { min: 5, max: 10 },  // 着席から1杯目の注文まで
  refillAfter: 200,                 // 提供からおかわりの注文まで
  leaveAfter: 300,                  // 最後の提供から帰るまで
  cupsTable: [                      // 杯数の確率（%）
    { cups: 1, percent: 40 },
    { cups: 2, percent: 30 },
    { cups: 3, percent: 20 },
    { cups: 4, percent: 10 },
  ],

  // ---- 猫の見た目 ----
  catColors: [
    { id: 'white', name: '白' },
    { id: 'black', name: '黒' },
    { id: 'tabby', name: '茶トラ' },
    { id: 'calico', name: '三毛' },
    { id: 'hachi', name: 'ハチワレ' },
  ],

  // ---- 滞在中のできごと ----
  eventInterval: 10, // 何秒ごとに判定するか
  events: [
    { id: 'toilet', name: 'トイレ', chance: 0.01 },
    { id: 'grass', name: '猫草', chance: 0.007 },
    { id: 'scratch', name: '爪とぎ', chance: 0.007 },
  ],
  awaySec: 10, // 席を離れている時間

  // ---- 演出の時間 ----
  drinkSec: 20,  // ドリンクを飲み終わるまで（グラスが空になる見た目）
  eatSec: 30,    // お通しを食べ終わるまで
  wipeSec: 5,    // おしぼりで拭いている時間
  sleepAfter: 15, // 注文してから何秒で寝てしまうか（見た目だけ）

  // ---- ドリンク ----
  // source: tap（蛇口） / fridge（冷蔵庫） / pot（鍋）
  // stock: 冷蔵庫から注ぐときに減る在庫、ingredient: 鍋に入れる材料
  drinks: [
    { id: 'water', name: '水', short: '水', price: 1, source: 'tap', color: '#bfe6f5' },
    { id: 'milk', name: '猫用ミルク', short: 'ミルク', price: 2, source: 'fridge', stock: 'milk', color: '#fffdf6' },
    { id: 'goat', name: 'ヤギミルク', short: 'ヤギ', price: 2, source: 'fridge', stock: 'goat', color: '#f6efd9' },
    { id: 'katsuo', name: 'かつおだし', short: 'かつお', price: 2, source: 'pot', ingredient: 'katsuo', color: '#e9b860' },
    { id: 'niboshi', name: '煮干しだし', short: '煮干し', price: 2, source: 'pot', ingredient: 'niboshi', color: '#d9c48a' },
    { id: 'sasami', name: '鶏ささみスープ', short: 'ささみ', price: 3, source: 'pot', ingredient: 'sasami', color: '#f3e3b0' },
    { id: 'hotate', name: 'ホタテスープ', short: 'ホタテ', price: 4, source: 'pot', ingredient: 'hotate', color: '#f1d6c0' },
    { id: 'maguro', name: 'まぐろスープ', short: 'まぐろ', price: 6, source: 'pot', ingredient: 'maguro', color: '#eaa49a' },
  ],
  foodPrice: 1, // お通し1皿

  // ---- だし鍋 ----
  stoveMax: 3,
  compartments: 5,   // 1つの鍋の仕切りの数
  dashiServings: 12, // 仕切り1つで何杯分
  simmerSec: 60,     // 煮出しにかかる時間

  // ---- 食器・おしぼり・洗濯 ----
  trayMax: 3,
  warmerMax: 10,
  washSec: 5,     // 洗い物
  laundrySec: 30, // 洗濯

  // ---- トイレ・猫草・爪とぎ ----
  litterMax: 10,
  grassMax: 15,
  grassWaterCooldown: 600, // 水やりの間隔（10分）
  scratcherMax: 15,

  // ---- 発注 ----
  deliverySec: 600, // 10分
  // amount: 1回の発注で増える在庫の量（stock の単位で数える）
  orderItems: [
    { id: 'milk', name: '猫用ミルク', amountText: '6杯分', amount: 6, price: 6, place: '冷蔵庫' },
    { id: 'goat', name: 'ヤギミルク', amountText: '4杯分', amount: 4, price: 6, place: '冷蔵庫' },
    { id: 'katsuo', name: 'かつお節', amountText: '仕切り2つ分（24杯）', amount: 2, price: 12, place: '棚' },
    { id: 'niboshi', name: '煮干し', amountText: '仕切り2つ分（24杯）', amount: 2, price: 12, place: '棚' },
    { id: 'sasami', name: 'ささみ', amountText: '仕切り1つ分（12杯）', amount: 1, price: 15, place: '冷蔵庫' },
    { id: 'hotate', name: 'ホタテ', amountText: '仕切り1つ分（12杯）', amount: 1, price: 24, place: '冷蔵庫' },
    { id: 'maguro', name: 'まぐろ', amountText: '仕切り1つ分（12杯）', amount: 1, price: 40, place: '冷蔵庫' },
    { id: 'food', name: 'キャットフード', amountText: '20皿分', amount: 20, price: 10, place: '棚' },
    { id: 'litter', name: '猫砂', amountText: '補充10回分', amount: 10, price: 10, place: '棚' },
    { id: 'scratcher', name: '爪とぎ', amountText: '1個', amount: 1, price: 10, place: '—' },
    { id: 'grass', name: '猫草', amountText: '1鉢（15単位）', amount: 1, price: 10, place: '—' },
  ],

  // ---- お店の買い物 ----
  shopItems: [
    { id: 'stove2', name: 'コンロ2口目＋鍋', price: 200 },
    { id: 'stove3', name: 'コンロ3口目＋鍋', price: 400 },
    { id: 'glasses', name: 'グラス追加（5個）', price: 30, add: 5 },
    { id: 'dishes', name: '小皿追加（5枚）', price: 20, add: 5 },
  ],

  // ---- 開始時の状態 ----
  start: {
    coins: 100,
    // 在庫の単位：ミルク類は杯、だしの材料は仕切りの数、フードは皿、猫砂は補充の回数、爪とぎ・猫草は個
    stock: { milk: 6, goat: 4, katsuo: 2, niboshi: 2, sasami: 1, hotate: 1, maguro: 0, food: 20, litter: 10, scratcher: 0, grass: 0 },
    glasses: 12,
    dishes: 10,
  },

  // ---- 「少なくなった」として在庫のアイコンを揺らす目安（この数以下） ----
  lowStock: { milk: 2, goat: 1, food: 3, litter: 0, warmer: 2, glasses: 2, dishes: 2, litterBox: 3, grass: 3, scratcher: 3 },

  // ---- 開発用 ----
  debugSpeed: 10, // ?debug のときの倍速
};

// 名前（id）からドリンクの設定を探す
CONFIG.drink = (id) => CONFIG.drinks.find((d) => d.id === id);
