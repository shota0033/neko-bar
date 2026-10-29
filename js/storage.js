// =============================================================
// storage.js … 続きから遊べるように、ゲームの状態を保存する（localStorage）
//
// プライベートモードなどで保存できない環境でも、ゲームが止まらないように
// 失敗したときは何もしないようにしています。
// =============================================================

const SaveData = {
  load() {
    try {
      const text = localStorage.getItem(CONFIG.saveKey);
      return text ? JSON.parse(text) : null;
    } catch (e) {
      return null;
    }
  },

  save(state) {
    try {
      localStorage.setItem(CONFIG.saveKey, JSON.stringify(state));
    } catch (e) {
      // 保存できなくてもゲームは続ける
    }
  },

  clear() {
    try {
      localStorage.removeItem(CONFIG.saveKey);
    } catch (e) {
      // 消せなくても続ける
    }
  },
};
