// Router dengan path History API (decisions.md 7): tabel rute, match(), guard(), navigate(), back/forward dan tautan #reset=.
// Modul ini tidak menyentuh window/document saat diimpor: history, location dan target event diberikan oleh main.js lewat createRouter().
// "name" = nama halaman (sama dengan kunci view lama), dibaca layoutOf() dan runtime.route.name.

// access: public = tamu dan customer (admin dialihkan ke /admin); guest = hanya tamu (yang sudah masuk ke berandanya);
//         customer = harus masuk sebagai customer; admin = hanya admin.
// params = parameter tetap milik rute (mis. mode form masuk); title dan tab = judul navbar dan tab yang menyala (dulu TITLES/TABGROUP).
// after (opsional) = fungsi yang dijalankan setelah outlet dirender (core/render.js); leave (opsional) = saat halaman rute ini ditinggalkan (resolve()).
// Rute admin: menu = { label, icon } di sidebar (dulu AMENU), searchable = kotak cari di header (dulu SEARCHABLE),
//             count = slice admin yang jumlahnya ditambahkan ke judul, mis. "Daftar Studio (4)" (components/adminSidebar.js).
export const ROUTES = [
  { path: "/", name: "landing", access: "public", title: "", tab: null },
  { path: "/login", name: "auth", access: "guest", title: "", tab: null, params: { mode: "login" } },
  { path: "/register", name: "auth", access: "guest", title: "", tab: null, params: { mode: "register" } },
  { path: "/forgot-password", name: "auth", access: "guest", title: "", tab: null, params: { mode: "forgot" } },
  { path: "/reset-password", name: "auth", access: "guest", title: "", tab: null, params: { mode: "reset" } },
  { path: "/browse", name: "home", access: "public", title: "Browse", tab: "home" },
  { path: "/packages", name: "packages", access: "public", title: "Pilihan Paket", tab: "home" },
  { path: "/studios/:id", name: "studio", access: "public", title: "Studio", tab: "home" },
  { path: "/book/time", name: "time", access: "public", title: "Pilih Waktu", tab: "home" },
  { path: "/book/pay", name: "pay", access: "public", title: "Pembayaran", tab: "home" },
  { path: "/bookings/:id/reschedule", name: "time", access: "customer", title: "Pilih Waktu", tab: "home" },
  { path: "/bookings/:id/success", name: "success", access: "customer", title: "Booking", tab: "home" },
  { path: "/bookings/:id/rescheduled", name: "rescheduled", access: "customer", title: "Reschedule", tab: "home" },
  { path: "/bookings", name: "my", access: "customer", title: "Booking Saya", tab: "my" },
  { path: "/bookings/:id", name: "bdetail", access: "customer", title: "Detail Booking", tab: "my" },
  { path: "/bookings/:id/cancel", name: "cancel", access: "customer", title: "Pembatalan", tab: "my" },
  { path: "/bookings/:id/refund", name: "refund", access: "customer", title: "Refund", tab: "my" },
  { path: "/account", name: "account", access: "customer", title: "Akun", tab: null, params: { tab: "profile" } },
  { path: "/account/payments", name: "account", access: "customer", title: "Akun", tab: null, params: { tab: "pay" } },
  { path: "/gallery", name: "gallery", access: "customer", title: "Galeri", tab: "gallery" },
  {
    path: "/admin",
    name: "adash",
    access: "admin",
    title: "Administrasi Pendapatan",
    tab: null,
    menu: { label: "Dashboard", icon: "dash" },
  },
  {
    path: "/admin/users",
    name: "acust",
    access: "admin",
    title: "Daftar Pengguna",
    tab: null,
    menu: { label: "Pengguna", icon: "users" },
    searchable: true,
  },
  {
    path: "/admin/studios",
    name: "astudio",
    access: "admin",
    title: "Daftar Studio",
    tab: null,
    menu: { label: "Studio", icon: "studio" },
    searchable: true,
    count: "studios",
  },
  // Session Assistant di tablet studio (ikon mata di Admin → Studio): layar penuh tanpa sidebar (layout "kiosk", core/render.js)
  { path: "/admin/studios/:id/live", name: "alive", access: "admin", title: "Session Assistant", tab: null },
  {
    path: "/admin/bookings",
    name: "abook",
    access: "admin",
    title: "Daftar Booking",
    tab: null,
    menu: { label: "Booking", icon: "calendar" },
    searchable: true,
  },
  {
    path: "/admin/props",
    name: "aprop",
    access: "admin",
    title: "Daftar Properti",
    tab: null,
    menu: { label: "Properti", icon: "glasses" },
    searchable: true,
  },
  {
    path: "/admin/poses",
    name: "apose",
    access: "admin",
    title: "Daftar Pose",
    tab: null,
    menu: { label: "Pose", icon: "run" },
  },
  {
    path: "/admin/transactions",
    name: "atrx",
    access: "admin",
    title: "Transaksi",
    tab: null,
    menu: { label: "Transaksi", icon: "card" },
    searchable: true,
  },
  {
    path: "/admin/packages",
    name: "apkg",
    access: "admin",
    title: "Paket & Diskon",
    tab: null,
    menu: { label: "Paket & Diskon", icon: "tag" },
  },
  {
    path: "/admin/account",
    name: "aacct",
    access: "admin",
    title: "Akun Admin",
    tab: null,
    menu: { label: "Akun Admin", icon: "settings" },
  },
];

const RESET_HASH = /^#reset=([a-f0-9]{64})$/;

function splitUrl(url) {
  const queryStart = url.indexOf("?");
  const pathname = queryStart < 0 ? url : url.slice(0, queryStart);
  const search = queryStart < 0 ? "" : url.slice(queryStart + 1);
  return { pathname, search };
}

function parseQuery(search) {
  const query = {};
  for (const [key, value] of new URLSearchParams(search)) {
    query[key] = value;
  }
  return query;
}

function segmentsOf(pathname) {
  return pathname.split("/").filter(Boolean);
}

// url = path dengan query opsional ("/bookings?tab=history") → { route, params, query, path } atau null bila tidak ada rute yang cocok
export function match(url, routes = ROUTES) {
  const { pathname, search } = splitUrl(url);
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const actual = segmentsOf(path);
  for (const route of routes) {
    const pattern = segmentsOf(route.path);
    if (pattern.length !== actual.length) {
      continue;
    }
    const params = {};
    const fits = pattern.every((part, index) => {
      if (part.startsWith(":")) {
        params[part.slice(1)] = decodeURIComponent(actual[index]);
        return true;
      }
      return part === actual[index];
    });
    if (fits) {
      return { route, params, query: parseQuery(search), path };
    }
  }
  return null;
}

// session = { loggedIn, admin, mustChange }
export function homePath(session) {
  if (session.admin) {
    return session.mustChange ? "/admin/account" : "/admin";
  }
  return session.loggedIn ? "/browse" : "/";
}

// tujuan pengalihan guard (nama view lama → path)
const REDIRECTS = { landing: "/", adash: "/admin", aacct: "/admin/account", home: "/browse" };

// path pengalihan atau null; urutan aturan sama dengan render() lama di core.js
export function guard(matched, session) {
  if (!matched) {
    return homePath(session);
  }
  const { route } = matched;
  let name = route.name;
  let access = route.access;
  const moveTo = (target, targetAccess) => {
    name = target;
    access = targetAccess;
  };
  // tamu di luar halaman tamu → landing
  if (!session.loggedIn && access !== "public" && access !== "guest") {
    moveTo("landing", "public");
  }
  // admin di halaman bukan admin → dasbor admin
  if (session.admin && access !== "admin") {
    moveTo("adash", "admin");
  }
  // password bawaan: hanya Akun Admin yang terbuka
  if (session.admin && session.mustChange && name !== "aacct") {
    moveTo("aacct", "admin");
  }
  // customer di halaman admin → Browse, diam-diam (tanpa popup)
  if (!session.admin && access === "admin") {
    moveTo(session.loggedIn ? "home" : "landing", "public");
  }
  // yang sudah masuk tidak membuka form Masuk/Daftar/Lupa/Buat Sandi (decisions.md 37)
  if (session.loggedIn && !session.admin && access === "guest") {
    moveTo("home", "public");
  }
  return name === route.name && access === route.access ? null : REDIRECTS[name];
}

function fixedParamsFit(route, params) {
  return Object.entries(route.params || {}).every(([key, value]) =>
    params[key] === undefined ? false : String(params[key]) === value,
  );
}

// nama rute + parameter → path; rute dengan parameter tetap (mode, tab) dipilih bila nilainya cocok,
// rute dengan :id dipilih bila id diberikan; null bila tidak ada yang cocok
export function pathFor(name, params = {}, routes = ROUTES) {
  const candidates = routes.filter(route => route.name === name);
  for (const route of candidates) {
    if (route.params && !fixedParamsFit(route, params)) {
      continue;
    }
    const pattern = segmentsOf(route.path);
    const needed = pattern.filter(part => part.startsWith(":")).map(part => part.slice(1));
    const extra = Object.keys(params).filter(
      key =>
        params[key] !== undefined &&
        params[key] !== null &&
        !needed.includes(key) &&
        !(route.params && key in route.params),
    );
    if (
      needed.some(key => params[key] === undefined || params[key] === null || params[key] === "") ||
      extra.includes("id")
    ) {
      continue;
    }
    return (
      "/" +
      pattern.map(part => (part.startsWith(":") ? encodeURIComponent(String(params[part.slice(1)])) : part)).join("/")
    );
  }
  return null;
}

// history, location = milik browser (atau tiruan di tes); events = target addEventListener (window);
// getSession() = { loggedIn, admin, mustChange }; onChange(cause) = render ulang ("navigate", "popstate", "reset");
// onResetLink(token) = simpan token reset dan keluarkan login yang tersimpan (seperti boot.js lama)
export function createRouter({
  routes = ROUTES,
  history,
  location,
  events,
  getSession,
  onChange = () => {},
  onResetLink = () => {},
}) {
  let currentMatch = null;

  function changeUrl(method, path) {
    try {
      history[method](null, "", path);
    } catch (error) {
      // history tidak tersedia (mis. halaman dibuka dari berkas lokal): tetap render tanpa mengubah URL
    }
  }

  function currentUrl() {
    return location.pathname + (location.search || "");
  }

  // tautan "buat sandi baru" dari email: /#reset=<64 hex> di path mana pun
  function takeResetLink() {
    const found = RESET_HASH.exec(location.hash || "");
    if (!found) {
      return false;
    }
    onResetLink(found[1]);
    changeUrl("replaceState", "/reset-password");
    return true;
  }

  // rute yang aktif sekarang, setelah guard; pengalihan mengganti entri riwayat (tombol back tidak kembali ke halaman terlarang)
  function resolve() {
    let matched = match(currentUrl(), routes);
    for (let step = 0; step < 4; step++) {
      const redirect = guard(matched, getSession());
      if (redirect === null) {
        break;
      }
      changeUrl("replaceState", redirect);
      matched = match(redirect, routes);
    }
    // halaman ditinggalkan (path berubah): kait leave() rute sebelumnya, mis. hentikan scroll-spy landing atau timer sesi foto (decisions.md 61)
    const previous = currentMatch;
    currentMatch = matched;
    if (previous && (!matched || previous.path !== matched.path) && typeof previous.route.leave === "function") {
      previous.route.leave(previous);
    }
    return matched;
  }

  function navigate(path, { replace = false } = {}) {
    const same = path === currentUrl();
    changeUrl(replace || same ? "replaceState" : "pushState", path);
    onChange("navigate");
  }

  function start() {
    takeResetLink();
    events.addEventListener("popstate", () => onChange("popstate"));
    // tautan reset dibuka di tab yang sudah memuat aplikasi di "/": browser hanya mengganti hash, tanpa memuat ulang
    events.addEventListener("hashchange", () => {
      if (takeResetLink()) {
        onChange("reset");
      }
    });
  }

  return {
    start,
    navigate,
    resolve,
    current: () => currentMatch,
  };
}
