// UI palsu untuk tes controller: mencatat modal, toast, dan pembaruan teks/tombol di tempat.
// modalAnswers = jawaban berurutan untuk setiap modal (habis = null, seperti modal ditutup).
export function createFakeUi({ modalAnswers = [] } = {}) {
  const answers = [...modalAnswers];
  const ui = {
    modals: [],
    toasts: [],
    texts: [],
    toggles: [],
    async modal(options) {
      ui.modals.push(options);
      return answers.length ? answers.shift() : null;
    },
    toast(message) {
      ui.toasts.push(message);
    },
    text(selector, value) {
      ui.texts.push([selector, value]);
    },
    toggle(selector, flag) {
      ui.toggles.push([selector, flag]);
    },
  };
  return ui;
}
