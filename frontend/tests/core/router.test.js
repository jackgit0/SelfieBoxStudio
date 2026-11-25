import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUTES, match, guard, homePath, pathFor, legacyPath, createRouter } from "../../js/core/router.js";

// ---------- match ----------

const expected = [
  ["/", "landing", {}],
  ["/login", "auth", {}, { mode: "login" }],
  ["/register", "auth", {}, { mode: "register" }],
  ["/forgot-password", "auth", {}, { mode: "forgot" }],
  ["/reset-password", "auth", {}, { mode: "reset" }],
  ["/browse", "home", {}],
  ["/packages", "packages", {}],
  ["/studios/3", "studio", { id: "3" }],
  ["/book/time", "time", {}],
  ["/book/pay", "pay", {}],
  ["/bookings/7/reschedule", "time", { id: "7" }],
  ["/bookings/7/success", "success", { id: "7" }],
  ["/bookings/7/rescheduled", "rescheduled", { id: "7" }],
  ["/bookings", "my", {}],
  ["/bookings/12", "bdetail", { id: "12" }],
  ["/bookings/12/cancel", "cancel", { id: "12" }],
  ["/bookings/12/refund", "refund", { id: "12" }],
  ["/account", "account", {}, { tab: "profile" }],
  ["/account/payments", "account", {}, { tab: "pay" }],
  ["/gallery", "gallery", {}],
  ["/sessions/41", "session", { id: "41" }],
  ["/admin", "adash", {}],
  ["/admin/users", "acust", {}],
  ["/admin/studios", "astudio", {}],
  ["/admin/bookings", "abook", {}],
  ["/admin/props", "aprop", {}],
  ["/admin/poses", "apose", {}],
  ["/admin/transactions", "atrx", {}],
  ["/admin/packages", "apkg", {}],
  ["/admin/account", "aacct", {}],
];

test("match: setiap rute di tabel dikenali, dengan parameter path", () => {
  assert.equal(ROUTES.length, expected.length);
  for (const [path, name, params, fixed] of expected) {
    const result = match(path);
    assert.ok(result, path);
    assert.equal(result.route.name, name, path);
    assert.deepEqual(result.params, params, path);
    assert.deepEqual(result.route.params || {}, fixed || {}, path);
    assert.equal(result.path, path);
  }
});

test("match: query string (?tab=history) dan garis miring di akhir", () => {
  const result = match("/bookings?tab=history");
  assert.equal(result.route.name, "my");
  assert.deepEqual(result.query, { tab: "history" });
  assert.equal(result.path, "/bookings");
  assert.equal(match("/browse/").route.name, "home");
  assert.deepEqual(match("/browse").query, {});
});

test("match: path tak dikenal atau parameter kosong → null", () => {
  for (const path of ["/nope", "/studios", "/studios/", "/bookings/12/x", "/admin/nope", "/studios/1/2"]) assert.equal(match(path), null, path);
});

test("setiap rute punya akses yang sah, judul dan tab seperti TITLES/TABGROUP lama", () => {
  for (const route of ROUTES) assert.ok(["public", "guest", "customer", "admin"].includes(route.access), route.path);
  const titles = { home: "Browse", packages: "Pilihan Paket", studio: "Studio", time: "Pilih Waktu", pay: "Pembayaran", my: "Booking Saya", bdetail: "Detail Booking", cancel: "Pembatalan", refund: "Refund", success: "Booking", rescheduled: "Reschedule", gallery: "Galeri", session: "Sesi Foto", account: "Akun" };
  const tabs = { home: ["home", "packages", "studio", "time", "pay", "success", "rescheduled"], my: ["my", "bdetail", "cancel", "refund"], gallery: ["gallery", "session"] };
  for (const route of ROUTES) {
    if (titles[route.name]) assert.equal(route.title, titles[route.name], route.path);
    const tab = Object.keys(tabs).find(key => tabs[key].includes(route.name)) || null;
    assert.equal(route.tab, tab, route.path);
  }
});

// ---------- guard: sama dengan render() lama (core.js sebelum fase 3) ----------

// salinan aturan render() lama: S.view diganti view akhir
const GUEST_VIEWS = ["auth", "landing", "home", "packages", "studio", "time", "pay"];
const ADMIN_VIEWS = ["adash", "acust", "astudio", "abook", "aprop", "apose", "atrx", "apkg", "aacct"];
function oldRender(view, S, AD) {
  if (!S.me && !GUEST_VIEWS.includes(view)) view = "landing";
  if (S.admin && !ADMIN_VIEWS.includes(view)) view = "adash";
  if (S.admin && AD.me && AD.me.must_change && view !== "aacct") view = "aacct";
  if (!S.admin && ADMIN_VIEWS.includes(view)) view = S.me ? "home" : "auth";
  return view;
}
const oldViewPath = { landing: "/", adash: "/admin", aacct: "/admin/account", home: "/browse" };

const sessions = {
  guest: { S: { me: null, admin: false }, AD: {} },
  customer: { S: { me: 5, admin: false }, AD: {} },
  admin: { S: { me: "admin", admin: true }, AD: { me: { must_change: 0 } } },
  "admin-must-change": { S: { me: "admin", admin: true }, AD: { me: { must_change: 1 } } },
  "admin-tanpa-login": { S: { me: null, admin: true }, AD: {} }, // state lama yang tersisa: admin=true tanpa token
};
const sessionOf = ({ S, AD }) => ({ loggedIn: Boolean(S.me), admin: Boolean(S.admin), mustChange: Boolean(S.admin && AD.me && AD.me.must_change) });

test("guard: setiap rute × tamu/customer/admin/admin must_change sama dengan render() lama", () => {
  for (const [label, legacy] of Object.entries(sessions)) {
    for (const [path] of expected) {
      const result = match(path);
      // reschedule memakai view "time" lama (boleh untuk tamu), tetapi hanya bisa dimulai dari booking milik customer:
      // architecture.md → Routes menjadikannya rute customer, jadi dibandingkan dengan view booking customer (bdetail)
      const legacyView = result.route.path === "/bookings/:id/reschedule" ? "bdetail" : result.route.name;
      const view = oldRender(legacyView, legacy.S, legacy.AD);
      let want = view === legacyView ? null : oldViewPath[view];
      // keputusan 37: customer yang sudah masuk tidak membuka halaman Masuk/Daftar/Lupa/Buat Sandi (dulu masih tampil)
      if (label === "customer" && result.route.access === "guest") want = "/browse";
      assert.equal(guard(result, sessionOf(legacy)), want, `${label} ${path}`);
    }
  }
});

test("guard: contoh dari test-map (tamu di /bookings → /, customer di /admin/studios → /browse tanpa popup, admin di /browse → /admin)", () => {
  const guest = { loggedIn: false, admin: false, mustChange: false };
  const customer = { loggedIn: true, admin: false, mustChange: false };
  const admin = { loggedIn: true, admin: true, mustChange: false };
  for (const path of ["/bookings", "/account", "/gallery", "/bookings/3", "/sessions/1", "/admin"]) assert.equal(guard(match(path), guest), "/", path);
  for (const path of ["/browse", "/studios/1", "/packages", "/book/time", "/book/pay", "/login", "/register", "/forgot-password", "/reset-password", "/"]) assert.equal(guard(match(path), guest), null, path);
  assert.equal(guard(match("/admin/studios"), customer), "/browse");
  assert.equal(guard(match("/browse"), admin), "/admin");
  assert.equal(guard(match("/admin/studios"), { ...admin, mustChange: true }), "/admin/account");
  assert.equal(guard(match("/admin/account"), { ...admin, mustChange: true }), null);
});

test("guard: path tak dikenal → beranda sesuai peran", () => {
  assert.equal(guard(null, { loggedIn: false, admin: false, mustChange: false }), "/");
  assert.equal(guard(null, { loggedIn: true, admin: false, mustChange: false }), "/browse");
  assert.equal(guard(null, { loggedIn: true, admin: true, mustChange: false }), "/admin");
  assert.equal(guard(null, { loggedIn: true, admin: true, mustChange: true }), "/admin/account");
  assert.equal(homePath({ loggedIn: true, admin: false }), "/browse");
});

// ---------- pathFor dan shim go() lama ----------

test("pathFor: nama rute + parameter → path", () => {
  assert.equal(pathFor("studio", { id: 3 }), "/studios/3");
  assert.equal(pathFor("auth", { mode: "register" }), "/register");
  assert.equal(pathFor("account", { tab: "pay" }), "/account/payments");
  assert.equal(pathFor("time", {}), "/book/time");
  assert.equal(pathFor("time", { id: 9 }), "/bookings/9/reschedule");
  assert.equal(pathFor("studio", {}), null);
  assert.equal(pathFor("nope", {}), null);
});

test("legacyPath: setiap kunci view lama + parameter → path yang benar", () => {
  const cases = [
    [["landing"], "/"],
    [["home"], "/browse"],
    [["packages"], "/packages"],
    [["studio", { id: 3 }], "/studios/3"],
    [["time"], "/book/time"],
    [["time", {}, { rescheduleId: 12 }], "/bookings/12/reschedule"],
    [["pay"], "/book/pay"],
    [["success", { id: 4 }], "/bookings/4/success"],
    [["rescheduled", { id: 4 }], "/bookings/4/rescheduled"],
    [["my"], "/bookings"],
    [["my", { tab: "up" }], "/bookings"],
    [["my", { tab: "hist" }], "/bookings?tab=history"],
    [["bdetail", { id: 8 }], "/bookings/8"],
    [["cancel", { id: 8 }], "/bookings/8/cancel"],
    [["refund", { id: 8 }], "/bookings/8/refund"],
    [["account"], "/account"],
    [["account", { tab: "profile" }], "/account"],
    [["account", { tab: "pay" }], "/account/payments"],
    [["gallery"], "/gallery"],
    [["session", {}, { sessionId: 41 }], "/sessions/41"],
    [["session"], "/gallery"],
    [["auth"], "/login"],
    [["auth", {}, { loginMode: "register" }], "/register"],
    [["auth", { mode: "forgot" }, { loginMode: "register" }], "/forgot-password"],
    [["auth", {}, { loginMode: "reset" }], "/reset-password"],
    [["adash"], "/admin"],
    [["acust"], "/admin/users"],
    [["astudio"], "/admin/studios"],
    [["abook"], "/admin/bookings"],
    [["aprop"], "/admin/props"],
    [["apose"], "/admin/poses"],
    [["atrx"], "/admin/transactions"],
    [["apkg"], "/admin/packages"],
    [["aacct"], "/admin/account"],
    [["nope"], "/"],
  ];
  for (const [[view, params, context], path] of cases) assert.equal(legacyPath(view, params, context), path, `${view} ${JSON.stringify(params || {})}`);
});

// ---------- createRouter: navigate, popstate, guard saat resolve, #reset= ----------

function fakeBrowser(url = "/") {
  const [pathname, search = ""] = url.split("?");
  const location = { pathname, search: search ? "?" + search : "", hash: "" };
  const calls = [];
  const setUrl = target => {
    const [path, query = ""] = target.split("?");
    location.pathname = path;
    location.search = query ? "?" + query : "";
    location.hash = "";
  };
  const history = {
    pushState: (state, title, target) => {
      calls.push(["push", target]);
      setUrl(target);
    },
    replaceState: (state, title, target) => {
      calls.push(["replace", target]);
      setUrl(target);
    },
  };
  return { location, history, calls, events: new EventTarget() };
}

function routerFor(browser, session = { loggedIn: false, admin: false, mustChange: false }, extra = {}) {
  const changes = [];
  const router = createRouter({
    history: browser.history,
    location: browser.location,
    events: browser.events,
    getSession: () => session,
    onChange: cause => changes.push(cause),
    ...extra,
  });
  return { router, changes };
}

test("navigate menambah riwayat, memanggil onChange, dan current() mengikuti", () => {
  const browser = fakeBrowser("/");
  const { router, changes } = routerFor(browser);
  router.start();
  router.navigate("/browse");
  assert.deepEqual(browser.calls, [["push", "/browse"]]);
  assert.deepEqual(changes, ["navigate"]);
  assert.equal(router.resolve().route.name, "home");
  assert.equal(router.current().route.name, "home");
  router.navigate("/packages", { replace: true });
  assert.deepEqual(browser.calls.at(-1), ["replace", "/packages"]);
});

test("navigate ke path yang sama mengganti entri riwayat (tanpa entri ganda)", () => {
  const browser = fakeBrowser("/book/time");
  const { router } = routerFor(browser);
  router.start();
  router.navigate("/book/time");
  assert.deepEqual(browser.calls, [["replace", "/book/time"]]);
});

test("popstate memanggil onChange dengan sebab popstate", () => {
  const browser = fakeBrowser("/browse");
  const { router, changes } = routerFor(browser);
  router.start();
  browser.location.pathname = "/packages";
  browser.events.dispatchEvent(new Event("popstate"));
  assert.deepEqual(changes, ["popstate"]);
  assert.equal(router.resolve().route.name, "packages");
});

test("resolve menjalankan guard dan mengganti URL ke tujuan pengalihan", () => {
  const browser = fakeBrowser("/bookings?tab=history");
  const session = { loggedIn: false, admin: false, mustChange: false };
  const { router } = routerFor(browser, session);
  router.start();
  assert.equal(router.resolve().route.name, "landing");
  assert.deepEqual(browser.calls, [["replace", "/"]]);
  session.loggedIn = session.admin = session.mustChange = true; // admin dengan password bawaan: path tak dikenal → /admin → /admin/account
  browser.location.pathname = "/nope";
  assert.equal(router.resolve().route.name, "aacct");
  assert.equal(browser.location.pathname, "/admin/account");
});

test("#reset=<64 hex> di path mana pun: token diteruskan, hash dibuang, URL menjadi /reset-password", () => {
  const token = "ab".repeat(32);
  const browser = fakeBrowser("/browse");
  browser.location.hash = "#reset=" + token;
  const tokens = [];
  const { router, changes } = routerFor(browser, undefined, { onResetLink: value => tokens.push(value) });
  router.start();
  assert.deepEqual(tokens, [token]);
  assert.deepEqual(browser.calls, [["replace", "/reset-password"]]);
  assert.equal(browser.location.hash, "");
  assert.equal(router.resolve().route.name, "auth");
  assert.equal(router.resolve().route.params.mode, "reset");
  assert.deepEqual(changes, []); // render pertama dilakukan main.js
});

test("#reset= dengan token yang bukan 64 hex diabaikan", () => {
  const browser = fakeBrowser("/");
  browser.location.hash = "#reset=xyz";
  const tokens = [];
  const { router } = routerFor(browser, undefined, { onResetLink: value => tokens.push(value) });
  router.start();
  assert.deepEqual(tokens, []);
  assert.deepEqual(browser.calls, []);
});

test("#reset= yang dibuka di tab yang sudah memuat aplikasi (hashchange) juga diproses dan merender ulang", () => {
  const token = "cd".repeat(32);
  const browser = fakeBrowser("/");
  const tokens = [];
  const { router, changes } = routerFor(browser, undefined, { onResetLink: value => tokens.push(value) });
  router.start();
  browser.location.hash = "#reset=" + token;
  browser.events.dispatchEvent(new Event("hashchange"));
  assert.deepEqual(tokens, [token]);
  assert.deepEqual(browser.calls, [["replace", "/reset-password"]]);
  assert.deepEqual(changes, ["reset"]);
  browser.location.hash = "#lain";
  browser.events.dispatchEvent(new Event("hashchange")); // hash lain (mis. tautan bagian landing) diabaikan
  assert.deepEqual(changes, ["reset"]);
});

// ---------- leave(): kait rute yang ditinggalkan (fase 7, decisions.md 61) ----------

// rute dengan leave/after yang mencatat urutan; render() meniru core/render.js: resolve() lalu after() rute baru
function hookedRoutes(log) {
  return ROUTES.map(route => ({
    ...route,
    leave: previous => log.push(`leave ${previous.path}`),
    after: matched => log.push(`after ${matched.path}`),
  }));
}

test("leave() rute sebelumnya berjalan sebelum after() rute berikutnya", () => {
  const browser = fakeBrowser("/");
  const log = [];
  const session = { loggedIn: true, admin: false, mustChange: false };
  let router;
  const render = () => {
    const matched = router.resolve();
    matched.route.after(matched);
  };
  router = createRouter({ routes: hookedRoutes(log), history: browser.history, location: browser.location, events: browser.events, getSession: () => session, onChange: render });
  router.start();
  render();
  router.navigate("/sessions/41");
  router.navigate("/gallery");
  assert.deepEqual(log, ["after /", "leave /", "after /sessions/41", "leave /sessions/41", "after /gallery"]);
});

test("leave() tidak berjalan saat rute yang sama dirender ulang, tetapi berjalan saat id path berubah", () => {
  const browser = fakeBrowser("/sessions/1");
  const log = [];
  const { router } = routerFor(browser, { loggedIn: true, admin: false, mustChange: false }, { routes: hookedRoutes(log) });
  router.start();
  router.resolve();
  router.resolve();
  assert.deepEqual(log, []);
  router.navigate("/sessions/2");
  router.resolve();
  assert.deepEqual(log, ["leave /sessions/1"]);
});

test("leave() juga berjalan saat guard mengalihkan (keluar dari sesi foto → landing)", () => {
  const browser = fakeBrowser("/sessions/1");
  const log = [];
  const session = { loggedIn: true, admin: false, mustChange: false };
  const { router } = routerFor(browser, session, { routes: hookedRoutes(log) });
  router.start();
  router.resolve();
  session.loggedIn = false;
  router.resolve();
  assert.deepEqual(log, ["leave /sessions/1"]);
  assert.equal(router.current().path, "/");
});
