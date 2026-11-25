import { test } from "node:test";
import assert from "node:assert/strict";
import { createEvents, formValues } from "../../js/core/events.js";

// akar palsu: menyimpan listener per jenis event; elemen palsu dengan dataset dan closest(selector)
function fakeRoot() {
  const listeners = {};
  return {
    listeners,
    addEventListener(type, listener) {
      (listeners[type] ||= []).push(listener);
    },
    fire(type, event) {
      for (const listener of listeners[type] || []) listener(event);
    },
  };
}

// el(dataset, parent): closest() mencari dirinya lalu induknya, cocok bila salah satu atribut data-* di selector ada
function el(dataset, parent = null, tagName = "BUTTON") {
  const element = {
    dataset,
    tagName,
    parent,
    closest(selector) {
      const keys = [...selector.matchAll(/\[data-([a-z-]+)\]/g)].map(match => match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
      for (let node = element; node; node = node.parent) {
        if (keys.some(key => key in node.dataset)) return node;
      }
      return null;
    },
  };
  return element;
}

function fakeEvent(target, extra = {}) {
  const event = {
    target,
    button: 0,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
    stopPropagation() {
      event.propagationStopped = true;
    },
    ...extra,
  };
  return event;
}

function setup(options) {
  const logs = [];
  const logger = { warn: (...args) => logs.push(["warn", ...args]), error: (...args) => logs.push(["error", ...args]) };
  const events = createEvents({ logger, ...options });
  const root = fakeRoot();
  const calls = [];
  const record = name => (dataset, event) => calls.push([name, dataset, event]);
  events.registerActions({
    "booking:pick": record("booking:pick"),
    "payment:setMethod": record("payment:setMethod"),
    "booking:setDetail": record("booking:setDetail"),
    "auth:login": record("auth:login"),
    "account:save": record("account:save"),
    "studio:open": record("studio:open"),
    "studio:bookmark": record("studio:bookmark"),
  });
  events.startEvents(root);
  return { root, calls, logs, events };
}

test("satu listener per jenis event", () => {
  const { root } = setup();
  assert.deepEqual(Object.keys(root.listeners).sort(), ["change", "click", "input", "keydown", "submit"]);
  for (const list of Object.values(root.listeners)) assert.equal(list.length, 1);
});

test("data-action pada klik memanggil aksinya dengan dataset dan event", () => {
  const { root, calls } = setup();
  const button = el({ action: "booking:pick", id: "12" });
  const inner = el({}, button, "SPAN");
  const event = fakeEvent(inner);
  root.fire("click", event);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "booking:pick");
  assert.equal(calls[0][1].id, "12");
  assert.equal(calls[0][2], event);
});

test("data-change, data-input, data-enter dan data-submit", () => {
  const { root, calls } = setup();
  root.fire("change", fakeEvent(el({ change: "payment:setMethod" }, null, "SELECT")));
  root.fire("input", fakeEvent(el({ input: "booking:setDetail" }, null, "TEXTAREA")));
  root.fire("keydown", fakeEvent(el({ enter: "auth:login" }, null, "INPUT"), { key: "a" }));
  root.fire("keydown", fakeEvent(el({ enter: "auth:login" }, null, "INPUT"), { key: "Enter" }));
  const submit = fakeEvent(el({ submit: "account:save" }, null, "FORM"));
  root.fire("submit", submit);
  assert.deepEqual(calls.map(call => call[0]), ["payment:setMethod", "booking:setDetail", "auth:login", "account:save"]);
  assert.equal(submit.defaultPrevented, true);
});

test("klik tidak memicu data-change dan sebaliknya", () => {
  const { root, calls } = setup();
  root.fire("click", fakeEvent(el({ change: "payment:setMethod" }, null, "SELECT")));
  root.fire("change", fakeEvent(el({ action: "booking:pick" })));
  assert.equal(calls.length, 0);
});

test("data-route memanggil navigate dan mencegah navigasi bawaan", () => {
  const visited = [];
  const { root } = setup({ navigate: path => visited.push(path) });
  const event = fakeEvent(el({ route: "/packages" }, null, "A"));
  root.fire("click", event);
  assert.deepEqual(visited, ["/packages"]);
  assert.equal(event.defaultPrevented, true);
});

test("klik tautan data-route dengan Ctrl/Cmd/Shift atau tombol tengah dibiarkan ke browser", () => {
  const visited = [];
  const { root } = setup({ navigate: path => visited.push(path) });
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
    const event = fakeEvent(el({ route: "/packages" }, null, "A"), extra);
    root.fire("click", event);
    assert.equal(event.defaultPrevented, false);
  }
  assert.deepEqual(visited, []);
});

test("data-stop: aksi elemen dalam saja yang jalan, aksi kartu luar tidak, propagasi dihentikan", () => {
  const { root, calls } = setup();
  const card = el({ action: "studio:open", id: "1" }, null, "ARTICLE");
  const star = el({ action: "studio:bookmark", id: "1", stop: "" }, card, "SPAN");
  const event = fakeEvent(star);
  root.fire("click", event);
  assert.deepEqual(calls.map(call => call[0]), ["studio:bookmark"]);
  assert.equal(event.propagationStopped, true);
});

test("data-stop tanpa aksi menahan klik agar kartu luar tidak terbuka", () => {
  const { root, calls } = setup();
  const card = el({ action: "studio:open" }, null, "ARTICLE");
  const wrapper = el({ stop: "" }, card, "DIV");
  const event = fakeEvent(el({}, wrapper, "SELECT"));
  root.fire("click", event);
  assert.equal(calls.length, 0);
  assert.equal(event.propagationStopped, true);
});

test("aksi yang tidak terdaftar dicatat, tidak melempar", () => {
  const { root, calls, logs } = setup();
  assert.doesNotThrow(() => root.fire("click", fakeEvent(el({ action: "nope:missing" }))));
  assert.equal(calls.length, 0);
  assert.equal(logs.length, 1);
  assert.match(String(logs[0][1]), /nope:missing/);
});

test("galat (juga Promise yang ditolak) dari aksi dicatat, tidak melempar", async () => {
  const { root, logs, events } = setup();
  events.registerActions({
    "x:throws": () => {
      throw new Error("pecah");
    },
    "x:rejects": async () => {
      throw new Error("ditolak");
    },
  });
  assert.doesNotThrow(() => root.fire("click", fakeEvent(el({ action: "x:throws" }))));
  root.fire("click", fakeEvent(el({ action: "x:rejects" })));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(logs.map(log => log[0]), ["error", "error"]);
});

test("klik di luar elemen ber-data-* tidak melakukan apa-apa", () => {
  const { root, calls, logs } = setup();
  root.fire("click", fakeEvent(el({}, null, "DIV")));
  root.fire("click", fakeEvent(null));
  assert.equal(calls.length, 0);
  assert.equal(logs.length, 0);
});

test("formValues: isian bernama dan tidak disabled dari form.elements (tombol tanpa name dilewati)", () => {
  const form = { elements: [{ name: "name", value: "Dewi" }, { name: "phone", value: "0812" }, { name: "email", value: "d@x.id", disabled: true }, { name: "", value: "Simpan" }] };
  assert.deepEqual(formValues(form), { name: "Dewi", phone: "0812" });
});

test("tautan <a href> dengan data-action menjalankan aksinya tanpa mengikuti href (fase 7: tautan bagian landing)", () => {
  const { root, calls } = setup();
  const link = el({ action: "studio:open", section: "kontak" }, null, "A");
  const event = fakeEvent(link);
  root.fire("click", event);
  assert.equal(calls.length, 1);
  assert.equal(event.defaultPrevented, true);
  const button = fakeEvent(el({ action: "studio:open" }));
  root.fire("click", button);
  assert.equal(button.defaultPrevented, false);
});

test("formValues: radio dan checkbox hanya yang dipilih (status Ubah Booking admin)", () => {
  const form = { elements: [
    { name: "status", type: "radio", value: "Menunggu Pembayaran", checked: true },
    { name: "status", type: "radio", value: "Dibatalkan", checked: false },
    { name: "agree", type: "checkbox", value: "on", checked: false },
    { name: "package_id", type: "select-one", value: "2" },
  ] };
  assert.deepEqual(formValues(form), { status: "Menunggu Pembayaran", package_id: "2" });
});
