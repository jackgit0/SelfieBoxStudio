import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createRenderer, layoutOf, shellMarkup, composeOutlet, installShellActions } from "../../js/core/render.js";
import { ROUTES } from "../../js/core/router.js";
import { html } from "../../js/core/html.js";

// elemen palsu: mencatat setiap penulisan innerHTML; root.querySelector("#outlet") memberi outlet yang dibuat saat shell dipasang
function fakeDom() {
  const writes = { root: 0, outlet: 0 };
  let outlet = null;
  const root = {
    markup: "",
    get innerHTML() {
      return this.markup;
    },
    set innerHTML(value) {
      writes.root++;
      this.markup = value;
      outlet = value.includes('id="outlet"') ? fakeOutlet() : null;
    },
    querySelector(selector) {
      return selector === "#outlet" ? outlet : null;
    },
  };
  function fakeOutlet() {
    return {
      markup: "",
      set innerHTML(value) {
        writes.outlet++;
        this.markup = value;
      },
      get innerHTML() {
        return this.markup;
      },
    };
  }
  return { root, writes, outlet: () => outlet };
}

const routeOf = path => ROUTES.find(route => route.path === path);

function setup({ path = "/browse", afterHook = null } = {}) {
  const dom = fakeDom();
  const store = createStore({ runtime: { count: 0 }, persisted: { name: "Dewi" } });
  let current = { route: { ...routeOf(path), after: afterHook }, path, params: {}, query: {} };
  const calls = { before: 0, after: 0 };
  const renderer = createRenderer({
    root: dom.root,
    resolve: () => current,
    before: () => calls.before++,
    shell: match => html`<header>${store.get().persisted.name}</header><main id="outlet" data-path="${match.path}"></main>`,
    outlet: () => html`<p>${store.get().runtime.count}</p>`,
    after: () => calls.after++,
  });
  return { dom, store, renderer, calls, go: (next, after = null) => (current = { route: { ...routeOf(next), after }, path: next, params: {}, query: {} }) };
}

test("render pertama memasang shell lalu mengisi outlet", () => {
  const { dom, renderer, calls } = setup();
  renderer.render();
  assert.equal(dom.writes.root, 1);
  assert.equal(dom.writes.outlet, 1);
  assert.equal(dom.outlet().innerHTML, "<p>0</p>");
  assert.deepEqual(calls, { before: 1, after: 1 });
});

test("perubahan store hanya merender ulang outlet", () => {
  const { dom, store, renderer } = setup();
  renderer.start(store);
  renderer.render();
  const outletBefore = dom.outlet();
  store.update("runtime", { count: 5 });
  assert.equal(dom.writes.root, 1);
  assert.equal(dom.writes.outlet, 2);
  assert.equal(dom.outlet(), outletBefore); // elemen yang sama: fokus di shell tidak hilang
  assert.equal(dom.outlet().innerHTML, "<p>5</p>");
  store.update("runtime", { count: 6 }, { silent: true });
  assert.equal(dom.writes.outlet, 2);
});

test("pindah rute memasang ulang shell", () => {
  const { dom, renderer, go } = setup();
  renderer.render();
  go("/bookings");
  renderer.render();
  assert.equal(dom.writes.root, 2);
  assert.match(dom.root.innerHTML, /data-path="\/bookings"/);
});

test("isi shell yang berubah (mis. nama di navbar) memasang ulang shell di rute yang sama", () => {
  const { dom, store, renderer } = setup();
  renderer.start(store);
  renderer.render();
  store.update("persisted", { name: "Dewi Baru" });
  assert.equal(dom.writes.root, 2);
  assert.match(dom.root.innerHTML, /Dewi Baru/);
});

test("renderOutlet tidak pernah memasang ulang shell", () => {
  const { dom, store, renderer } = setup();
  renderer.render();
  store.update("persisted", { name: "Lain" }, { silent: true });
  renderer.renderOutlet();
  assert.equal(dom.writes.root, 1);
  assert.equal(dom.writes.outlet, 2);
});

test("after() milik rute dijalankan setelah outlet terisi", () => {
  const seen = [];
  const { dom, renderer } = setup({ afterHook: match => seen.push([match.path, dom.outlet().innerHTML]) });
  renderer.render();
  assert.deepEqual(seen, [["/browse", "<p>0</p>"]]);
});

test("layoutOf: landing, form masuk, admin, customer", () => {
  assert.equal(layoutOf("landing", { admin: false }), "landing");
  assert.equal(layoutOf("auth", { admin: false }), "auth");
  assert.equal(layoutOf("adash", { admin: true }), "admin");
  assert.equal(layoutOf("home", { admin: false }), "customer");
});

test("shellMarkup: setiap layout punya satu outlet; customer dengan navbar dan bilah bawah, admin dengan sidebar", () => {
  const session = { user: { name: "Dewi" }, staff: false };
  const count = markup => (String(markup).match(/id="outlet"/g) || []).length;
  const landing = shellMarkup({ layout: "landing", route: routeOf("/"), session });
  const auth = shellMarkup({ layout: "auth", route: routeOf("/login"), session });
  const customer = shellMarkup({ layout: "customer", route: routeOf("/browse"), session });
  const admin = shellMarkup({ layout: "admin", route: routeOf("/admin"), session });
  for (const markup of [landing, auth, customer, admin]) assert.equal(count(markup), 1);
  assert.equal(String(landing), '<div id="outlet"></div>');
  assert.equal(String(auth), '<main id="outlet" class="authwrap"></main>');
  assert.match(String(customer), /^<header class="top">[^]*<main id="outlet" class="page"><\/main>\n<nav class="bottom">/);
  assert.match(String(admin), /^<div class="adm"><aside class="side">[^]*<\/aside><main id="outlet" class="amain"><\/main><\/div>$/);
});

test("composeOutlet: toast di atas isi; admin dengan header lebih dulu", () => {
  const content = html`<p>isi</p>`;
  const toast = { message: "OK", error: "" };
  assert.equal(String(composeOutlet({ layout: "landing", content, toast })), "<p>isi</p>");
  assert.equal(String(composeOutlet({ layout: "auth", content, toast })), "<p>isi</p>");
  assert.equal(String(composeOutlet({ layout: "customer", content, toast })), '<div class="toast">OK</div><p>isi</p>');
  assert.equal(String(composeOutlet({ layout: "admin", content, toast, header: html`<h1>H</h1>` })), '<h1>H</h1><div class="toast">OK</div><p>isi</p>');
});

test("ui:toggleMenu membuka/menutup menu akun; klik di luar menutupnya", () => {
  const menu = { hidden: true };
  const avatar = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, closest: () => avatar };
  const listeners = [];
  const doc = { querySelector: selector => (selector === "#menu" ? menu : selector === '[data-action="ui:toggleMenu"]' ? avatar : null), addEventListener: (type, listener) => listeners.push([type, listener]) };
  const actions = {};
  installShellActions({ registerActions: map => Object.assign(actions, map), document: doc });
  actions["ui:toggleMenu"]({}, { target: avatar });
  assert.equal(menu.hidden, false);
  assert.equal(avatar.attributes["aria-expanded"], "true");
  // klik pada tombol avatar sendiri tidak dihitung "di luar"
  listeners[0][1]({ target: avatar });
  assert.equal(menu.hidden, false);
  listeners[0][1]({ target: { closest: () => null } });
  assert.equal(menu.hidden, true);
  assert.equal(avatar.attributes["aria-expanded"], "false");
});
