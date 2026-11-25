// Titik masuk aplikasi (satu-satunya <script type="module"> di index.html).
// Menyiapkan API, store, router, renderer dan event data-*, membungkus objek state kode lama (js/legacy) dengan store, memasang jembatan window
// untuk atribut onclick lama, lalu menjalankan isi boot.js lama: muat data master, tautan #reset= (router), pulihkan login, render pertama.
import { API_BASE, CS_EMAIL, CS_WA } from "./config.js";
import { createStore } from "./core/store.js";
import { ROUTES, createRouter } from "./core/router.js";
import { createEvents } from "./core/events.js";
import { createRenderer, installShellActions } from "./core/render.js";
import { createApi } from "./models/api.js";
import * as masterModel from "./models/master.js";
import * as studioModel from "./models/studio.js";
import * as bookingModel from "./models/booking.js";
import { openModal } from "./components/modal.js";
import { createStudioController } from "./controllers/StudioController.js";
import { createPackageController } from "./controllers/PackageController.js";
import { createBookingController } from "./controllers/BookingController.js";
import { browseView } from "./views/customer/browse.js";
import { studioView } from "./views/customer/studio.js";
import { packagesView } from "./views/customer/packages.js";
import { timeView } from "./views/customer/time.js";
import { S, M, BK, R, D, connectLegacy } from "./legacy/state.js";
import { $, goPath, render, renderAfter, renderBefore, renderContent, renderShell, refresh, logout } from "./legacy/core.js";
import "./legacy/landing.js";
import { P } from "./legacy/session.js";
import { AD, aDenied } from "./legacy/admin.js";
import { installLegacyBridge } from "./legacy-bridge.js";
import { registerLegacyActions } from "./legacy-actions.js";

// localStorage/sessionStorage bisa melempar galat bila diblokir browser; aplikasi tetap jalan tanpa penyimpanan
function browserStorage(name = "localStorage") {
  try {
    return window[name];
  } catch (error) {
    return null;
  }
}

// UI untuk controller: dialog, toast (runtime.toast, tampil di outlet), buka tautan (WhatsApp di tab baru, mailto di tab ini)
function createUi(store) {
  return {
    modal: openModal,
    toast: message => store.update("runtime", { toast: { message, error: "" } }),
    openUrl: (url, { newTab = false } = {}) => {
      if (newTab) {
        window.open(url, "_blank");
      } else {
        window.location.href = url;
      }
    },
  };
}

// halaman yang sudah MVC: view (state, match) → Safe dan kait after(match) per path rute; rute lain masih memakai V.<view> lama
function pagesFor({ studio }) {
  const showAvailability = () => studio.prefetchAvailability();
  return {
    "/browse": {
      view: browseView,
      after: () => {
        studio.refreshMaster();
        showAvailability();
      },
    },
    "/studios/:id": { view: studioView, after: () => studio.refreshMaster() },
    "/packages": { view: packagesView },
    // langkah Pilih Waktu (booking baru dan ubah jadwal): jam kosong dari StudioController
    "/book/time": { view: timeView, after: showAvailability },
    "/bookings/:id/reschedule": { view: timeView, after: showAvailability },
  };
}

// aksi data-* milik controller baru; kalender dibagi menurut data-context (home = Filter Jadwal Browse, book = Pilih Waktu)
function controllerActions({ studio, package: packages, booking }) {
  return {
    "booking:quickBook": booking.quickBook,
    "booking:start": booking.start,
    "booking:startReschedule": booking.startReschedule,
    "booking:pickSlot": booking.pickSlot,
    "booking:next": booking.next,
    "package:choose": packages.choose,
    "package:contactCs": packages.contactCs,
    "studio:toggleBookmark": studio.toggleBookmark,
    "studio:setHourFrom": studio.setHourFrom,
    "studio:setHourTo": studio.setHourTo,
    "studio:setPropertyCategory": studio.setPropertyCategory,
    "calendar:month": dataset => (dataset.context === "home" ? studio.moveMonth(dataset) : booking.moveMonth(dataset)),
    "calendar:pick": dataset => (dataset.context === "home" ? studio.pickDate(dataset) : booking.pickDate(dataset)),
  };
}

async function start() {
  const storage = browserStorage();
  const api = createApi({ base: API_BASE, storage });
  // booking berjalan (studio, tanggal, sesi, id reschedule; tanpa quote) bertahan saat dimuat ulang, hanya di tab ini (decisions.md 26)
  const session = { storage: browserStorage("sessionStorage"), key: "snapia_booking", slices: { booking: ["studio", "date", "slot", "rescheduleId"] } };
  const store = createStore({ persisted: S, master: M, booking: BK, runtime: R, data: D, photo: P, admin: AD }, { storage, persistKey: "snapia", session });
  const ui = createUi(store);
  const navigation = { navigate: path => goPath(path) };
  const models = { master: masterModel, studio: studioModel, booking: bookingModel };
  const studio = createStudioController({ api, store, ui, router: navigation, models });
  const packages = createPackageController({ store, ui, router: navigation, config: { wa: CS_WA, email: CS_EMAIL }, refreshMaster: studio.refreshMaster });
  const booking = createBookingController({ api, store, ui, router: navigation, models, packages, refreshMaster: studio.refreshMaster, refresh });
  const controllers = { studio, package: packages, booking };
  const pages = pagesFor(controllers);
  const routes = ROUTES.map(route => ({ ...route, ...pages[route.path] }));
  const router = createRouter({
    routes,
    history: window.history,
    location: window.location,
    events: window,
    getSession: () => ({ loggedIn: Boolean(S.me), admin: Boolean(S.admin), mustChange: Boolean(S.admin && AD.me && AD.me.must_change) }),
    onChange: cause => {
      if (cause !== "navigate") {
        R.toast.message = R.toast.error = ""; // back/forward dan tautan reset (go() sudah membersihkannya sendiri)
      }
      render();
    },
    // tautan "buat sandi baru" dari email (/#reset=<token>): login yang tersimpan dilepas
    // (juga saat tautan dibuka di tab yang sudah memuat aplikasi: data user sebelumnya ikut dibersihkan)
    onResetLink: token => {
      R.auth.resetToken = token;
      api.token = "";
      S.user = S.me = null;
      S.admin = false;
      D.bookings = [];
      D.sessions = [];
    },
  });
  // shell sekali per rute, outlet setiap render (core/render.js); kait-kaitnya masih kode lama (V.<view>, toast, header admin)
  const outlet = match => renderContent(match, match.route.view ? match.route.view(store.get(), match) : null);
  const renderer = createRenderer({ root: document.getElementById("app"), resolve: () => router.resolve(), before: renderBefore, shell: renderShell, outlet, after: renderAfter });
  connectLegacy({ api, store, router, renderer, controllers });
  installLegacyBridge();
  renderer.start(store);

  // atribut data-* (core/events.js) di seluruh dokumen; data-route pindah halaman seperti go() lama (decisions.md 42)
  const events = createEvents({ navigate: path => goPath(path) });
  installShellActions({ registerActions: events.registerActions, document });
  registerLegacyActions(events.registerActions);
  events.registerActions(controllerActions(controllers));
  events.startEvents(document);

  try {
    store.update("master", await masterModel.loadMaster(api), { silent: true });
  } catch (error) {
    $("#app").innerHTML = "<p style='padding:24px'>Server API tidak dapat dihubungi. Jalankan backend: <code>cd backend && npm start</code></p>";
    return;
  }

  // back/forward dan tautan #reset= (diubah menjadi /reset-password)
  router.start();

  // pulihkan login (Mode Staf tidak ikut dipulihkan)
  S.staff = false;
  if (api.token && S.user) {
    try {
      S.me = S.admin ? "admin" : S.user.id;
      if (S.admin) {
        AD.me = await api.get("/admin/me");
      } else {
        await refresh();
      }
    } catch (error) {
      if (S.admin && error.status == 403 && /Hanya admin/.test(error.message)) {
        return aDenied(); // token yang tersimpan bukan token admin: dialog Akses Ditolak
      }
      logout();
      return;
    }
  } else {
    S.me = null;
  }
  render();
}

start();
