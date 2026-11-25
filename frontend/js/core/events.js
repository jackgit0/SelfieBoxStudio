// Event terdelegasi: satu listener per jenis event di elemen akar, menggantikan atribut handler inline (on…) di HTML.
// <button data-action="payment:confirm" data-id="12"> → aksi "payment:confirm" dipanggil dengan (dataset, event).
// data-change (change), data-input (input), data-enter (keydown Enter), data-submit (submit form, preventDefault),
// data-route="/path" (klik, pindah halaman lewat navigate). data-stop di elemen dalam = klik tidak diteruskan ke elemen luar.

const LISTENERS = {
  click: { selector: "[data-action],[data-route],[data-stop]", attribute: "action" },
  change: { selector: "[data-change]", attribute: "change" },
  input: { selector: "[data-input]", attribute: "input" },
  keydown: { selector: "[data-enter]", attribute: "enter" },
  submit: { selector: "[data-submit]", attribute: "submit" },
};

// klik tautan dengan tombol pengubah (tab baru, unduh) atau tombol tengah dibiarkan ke browser
function opensElsewhere(event) {
  return event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || (event.button !== undefined && event.button !== 0);
}

export function createEvents({ navigate = null, logger = console } = {}) {
  const actions = {};

  function registerActions(map) {
    Object.assign(actions, map);
  }

  function run(name, element, event) {
    const action = actions[name];
    if (!action) {
      logger.warn(`Aksi "${name}" belum terdaftar`);
      return;
    }
    try {
      const result = action(element.dataset, event);
      if (result && typeof result.catch === "function") {
        result.catch(error => logger.error(`Aksi "${name}" gagal`, error));
      }
    } catch (error) {
      logger.error(`Aksi "${name}" gagal`, error);
    }
  }

  function handle(type, event) {
    const { selector, attribute } = LISTENERS[type];
    if (type === "keydown" && event.key !== "Enter") {
      return;
    }
    const target = event.target;
    const element = target && typeof target.closest === "function" ? target.closest(selector) : null;
    if (!element) {
      return;
    }
    const dataset = element.dataset;
    if (type === "submit") {
      event.preventDefault();
    }
    if (type === "click" && "stop" in dataset) {
      event.stopPropagation();
    }
    if (type === "click" && !dataset.action && dataset.route) {
      if (element.tagName === "A" && opensElsewhere(event)) {
        return;
      }
      event.preventDefault();
      if (navigate) {
        navigate(dataset.route);
      } else {
        logger.warn(`Belum ada router untuk "${dataset.route}"`);
      }
      return;
    }
    // tautan dengan data-action (mis. tautan bagian landing) = aksi, bukan pindah ke href
    if (type === "click" && dataset.action && element.tagName === "A") {
      event.preventDefault();
    }
    if (dataset[attribute]) {
      run(dataset[attribute], element, event);
    }
  }

  function startEvents(root) {
    for (const type of Object.keys(LISTENERS)) {
      root.addEventListener(type, event => handle(type, event));
    }
  }

  return { registerActions, startEvents };
}

// isi form sebagai objek biasa { name: value } untuk controller (decisions.md 54): isian bernama yang tidak disabled;
// radio dan checkbox hanya yang dipilih
export function formValues(form) {
  const values = {};
  for (const field of form.elements) {
    const choice = field.type === "radio" || field.type === "checkbox";
    if (field.name && !field.disabled && (!choice || field.checked)) {
      values[field.name] = field.value;
    }
  }
  return values;
}

// instans bawaan untuk aplikasi; tes membuat instans sendiri dengan createEvents()
const appEvents = createEvents();
export const registerActions = appEvents.registerActions;
export const startEvents = appEvents.startEvents;
