// Titik masuk aplikasi (satu-satunya <script type="module"> di index.html).
// Menyiapkan API, store, router, renderer dan event data-*, membungkus objek state kode lama (js/legacy) dengan store, memasang jembatan window
// untuk atribut onclick lama, lalu menjalankan isi boot.js lama: muat data master, tautan #reset= (router), pulihkan login (AuthController), render pertama.
import { API_BASE, BRAND, CS_EMAIL, CS_WA, GOOGLE_CLIENT_ID } from "./config.js";
import { createStore } from "./core/store.js";
import { ROUTES, createRouter } from "./core/router.js";
import { createEvents, formValues } from "./core/events.js";
import { createRenderer, installShellActions } from "./core/render.js";
import { createApi } from "./models/api.js";
import * as masterModel from "./models/master.js";
import * as studioModel from "./models/studio.js";
import * as bookingModel from "./models/booking.js";
import * as paymentModel from "./models/payment.js";
import * as photoSessionModel from "./models/photoSession.js";
import * as accountModel from "./models/account.js";
import * as authModel from "./models/auth.js";
import * as contactModel from "./models/contact.js";
import * as driveModel from "./models/drive.js";
import * as galleryModel from "./models/gallery.js";
import { openModal } from "./components/modal.js";
import { createLandingPage } from "./components/landingPage.js";
import { shrinkImage } from "./components/imageFile.js";
import { createBeeper, createSessionScreen } from "./components/sessionScreen.js";
import { createStudioController } from "./controllers/StudioController.js";
import { createPackageController } from "./controllers/PackageController.js";
import { createBookingController } from "./controllers/BookingController.js";
import { createPaymentController } from "./controllers/PaymentController.js";
import { createAccountController } from "./controllers/AccountController.js";
import { createAuthController } from "./controllers/AuthController.js";
import { createLandingController } from "./controllers/LandingController.js";
import { landingView } from "./views/landing.js";
import { createPhotoSessionController, createPhotoState } from "./controllers/PhotoSessionController.js";
import { createGalleryController } from "./controllers/GalleryController.js";
import { createAdminController } from "./controllers/AdminController.js";
import * as adminModels from "./models/admin/index.js";
import { photoSessionView } from "./views/session/photoSession.js";
import { galleryView } from "./views/session/gallery.js";
import { dashboardView } from "./views/admin/dashboard.js";
import { studiosView } from "./views/admin/studios.js";
import { usersView } from "./views/admin/users.js";
import { transactionsView } from "./views/admin/transactions.js";
import { packagesView as adminPackagesView } from "./views/admin/packages.js";
import { accountView as adminAccountView } from "./views/admin/account.js";
import { browseView } from "./views/customer/browse.js";
import { studioView } from "./views/customer/studio.js";
import { packagesView } from "./views/customer/packages.js";
import { timeView } from "./views/customer/time.js";
import { payView } from "./views/customer/pay.js";
import { successView } from "./views/customer/success.js";
import { rescheduledView } from "./views/customer/rescheduled.js";
import { bookingsView } from "./views/customer/bookings.js";
import { bookingDetailView } from "./views/customer/bookingDetail.js";
import { cancelView } from "./views/customer/cancel.js";
import { refundView } from "./views/customer/refund.js";
import { accountView } from "./views/customer/account.js";
import { loginView } from "./views/auth/login.js";
import { registerView } from "./views/auth/register.js";
import { forgotView } from "./views/auth/forgot.js";
import { resetView } from "./views/auth/reset.js";
import { S, M, BK, R, D, connectLegacy } from "./legacy/state.js";
import { $, goPath, render, renderAfter, renderBefore, renderContent, renderShell } from "./legacy/core.js";
import { AD } from "./legacy/admin.js";
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

// unduh satu berkas lewat tautan sementara (Unduh Foto Terpilih di Galeri)
function downloadFile(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// UI untuk controller: dialog, toast (runtime.toast, tampil di outlet), buka tautan (WhatsApp di tab baru, mailto di tab ini)
function createUi(store) {
  return {
    modal: openModal,
    toast: message => store.update("runtime", { toast: { message, error: "" } }),
    // gulir ke bawah halaman (form Ubah item rekap, detail pelanggan di panel admin)
    scrollToEnd: () => window.scrollTo(0, document.body.scrollHeight),
    // fokus ke elemen pertama yang cocok (field bertanda galat di Tambah Studio)
    focus: selector => {
      const element = document.querySelector(selector);
      if (element && element.focus) {
        element.focus();
      }
    },
    openUrl: (url, { newTab = false } = {}) => {
      if (newTab) {
        window.open(url, "_blank");
      } else {
        window.location.href = url;
      }
    },
  };
}

// halaman yang sudah MVC: view (state, match) → Safe dan kait after(match) per path rute; rute lain masih memakai V.<view> lama.
// links = { invoiceUrl } untuk view yang menautkan invoice (token tetap di models/api.js, decisions.md 50)
function pagesFor({ studio, payment, landing, photo, gallery, admin }, links) {
  const showAvailability = () => studio.prefetchAvailability();
  return {
    // landing page (LandingController): scroll-spy dipasang setiap render dan dilepas saat halaman ditinggalkan
    "/": { view: landingView, after: () => landing.startScrollSpy(), leave: () => landing.stopScrollSpy() },
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
    "/book/pay": { view: payView, after: () => payment.loadMissingQuote() },
    "/bookings/:id/success": { view: (state, match) => successView(state, match, links) },
    "/bookings/:id/rescheduled": { view: rescheduledView },
    // Booking Saya, detail, pembatalan dan hasil refund (BookingController, PaymentController.payNow)
    "/bookings": { view: bookingsView },
    "/bookings/:id": { view: (state, match) => bookingDetailView(state, match, links) },
    "/bookings/:id/cancel": { view: cancelView },
    "/bookings/:id/refund": { view: refundView },
    // Pengaturan Akun: Edit Profil dan Riwayat Pembayaran (AccountController)
    "/account": { view: (state, match) => accountView(state, match, links) },
    "/account/payments": { view: (state, match) => accountView(state, match, links) },
    // Masuk, Daftar, Lupa Sandi, Buat Sandi Baru (AuthController)
    "/login": { view: loginView },
    "/register": { view: registerView },
    "/forgot-password": { view: forgotView },
    "/reset-password": { view: resetView },
    // Sesi Foto (PhotoSessionController): kamera dan timer berjalan selama halaman terbuka, berhenti saat ditinggalkan
    "/sessions/:id": { view: photoSessionView, after: match => photo.enter(match), leave: () => photo.stopTimers() },
    // Galeri (GalleryController)
    "/gallery": { view: galleryView },
    // panel admin (AdminController; Studio + Detail Sesi = StudioController); Booking, Properti, Pose masih V.<view> lama (fase 8b)
    "/admin": { view: dashboardView, after: () => admin.loadDashboard() },
    "/admin/studios": { view: studiosView, after: () => studio.loadStudios() },
    "/admin/users": { view: (state, match) => usersView(state, match, links), after: () => admin.loadUsers() },
    "/admin/transactions": { view: transactionsView, after: () => admin.loadTransactions() },
    "/admin/packages": { view: adminPackagesView, after: () => admin.loadPackagesPage() },
    "/admin/account": { view: adminAccountView },
  };
}

// aksi data-* milik controller baru; kalender dibagi menurut data-context (home = Filter Jadwal Browse, book = Pilih Waktu)
function controllerActions({ studio, package: packages, booking, payment, account, auth, landing, photo, gallery, admin }) {
  return {
    "admin:search": (dataset, event) => admin.setSearch(event.target.value),
    "admin:setOperationsPeriod": (dataset, event) => admin.setOperationsPeriod(event.target.value),
    "admin:editOperation": admin.editOperation,
    "admin:cancelOperationEdit": admin.cancelOperationEdit,
    "admin:saveOperation": (dataset, event) => admin.saveOperation(formValues(event.target)),
    "admin:deleteOperation": admin.deleteOperation,
    "admin:openCustomer": admin.openCustomer,
    "admin:closeCustomer": admin.closeCustomer,
    "admin:deleteCustomer": admin.deleteCustomer,
    "admin:savePackage": (dataset, event) => admin.savePackage(dataset, formValues(event.target)),
    "admin:addPackage": (dataset, event) => admin.addPackage(formValues(event.target)),
    "admin:activatePackage": admin.activatePackage,
    "admin:deletePackage": admin.deletePackage,
    "admin:saveDiscount": (dataset, event) => admin.saveDiscount(formValues(event.target)),
    "admin:saveAccount": (dataset, event) => admin.saveAccount(formValues(event.target)),
    "studio:toggleStudio": studio.toggleStudio,
    "studio:openNew": studio.openNew,
    "studio:cancelNew": studio.cancelNew,
    "studio:uploadImage": (dataset, event) => studio.uploadImage(dataset, event.target.files[0], formValues(event.target.form)),
    "studio:review": (dataset, event) => studio.review(formValues(event.target)),
    "studio:backToForm": studio.backToForm,
    "studio:save": studio.save,
    "studio:edit": (dataset, event) => studio.edit(dataset, formValues(event.target)),
    "studio:delete": studio.delete,
    "studio:moveSessionMonth": studio.moveSessionMonth,
    "studio:pickSessionDay": studio.pickSessionDay,
    "studio:toggleSession": studio.toggleSession,
    "studio:toggleAddSession": studio.toggleAddSession,
    "studio:closeSessionForm": studio.closeSessionForm,
    "studio:addSession": (dataset, event) => studio.addSession(dataset, formValues(event.target)),
    "studio:saveSession": (dataset, event) => studio.saveSession(dataset, formValues(event.target)),
    "studio:deleteSession": studio.deleteSession,
    "gallery:showSession": gallery.showSession,
    "gallery:select": gallery.select,
    "gallery:toggleFavourite": gallery.toggleFavourite,
    "gallery:deletePhoto": gallery.deletePhoto,
    "gallery:toggleDeleteMode": gallery.toggleDeleteMode,
    "gallery:selectAllNonFavourite": gallery.selectAllNonFavourite,
    "gallery:deleteSelected": gallery.deleteSelected,
    "gallery:confirmSelection": gallery.confirmSelection,
    "gallery:download": gallery.download,
    "photo:start": photo.start,
    "photo:open": photo.open,
    "photo:shoot": photo.shoot,
    "photo:nextPose": photo.nextPose,
    "photo:staffAction": photo.staffAction,
    "landing:scrollTo": landing.scrollTo,
    "landing:toggleMenu": landing.toggleMenu,
    "landing:openAuth": landing.openAuth,
    "landing:setContactField": landing.setContactField,
    "landing:sendContact": landing.sendContact,
    "auth:login": (dataset, event) => auth.login(formValues(event.target)),
    "auth:register": (dataset, event) => auth.register(formValues(event.target)),
    "auth:forgot": (dataset, event) => auth.forgot(formValues(event.target)),
    "auth:reset": (dataset, event) => auth.reset(formValues(event.target)),
    "auth:logout": auth.logout,
    "auth:staffToggle": auth.toggleStaff,
    "account:saveProfile": (dataset, event) => account.saveProfile(formValues(event.target)),
    "account:requestPasswordChange": account.requestPasswordChange,
    "payment:selectPackage": payment.selectPackage,
    "payment:setMethod": payment.setMethod,
    "payment:confirm": payment.confirm,
    "payment:togglePaymentDetail": payment.togglePaymentDetail,
    "payment:emailInvoice": payment.emailInvoice,
    "payment:payNow": payment.payNow,
    "booking:quickBook": booking.quickBook,
    "booking:start": booking.start,
    "booking:startReschedule": booking.startReschedule,
    "booking:pickSlot": booking.pickSlot,
    "booking:next": booking.next,
    "booking:openCancel": booking.openCancel,
    "booking:setCancelReason": booking.setCancelReason,
    "booking:setCancelDetail": booking.setCancelDetail,
    "booking:cancel": booking.cancel,
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
  const store = createStore({ persisted: S, master: M, booking: BK, runtime: R, data: D, photo: createPhotoState(), admin: AD }, { storage, persistKey: "snapia", session });
  const ui = createUi(store);
  const navigation = { navigate: path => goPath(path) };
  const models = { master: masterModel, studio: studioModel, booking: bookingModel, payment: paymentModel, photoSession: photoSessionModel, account: accountModel, auth: authModel, contact: contactModel, drive: driveModel, gallery: galleryModel, admin: adminModels };
  // AdminController dibuat setelah AuthController (saling memakai); controller yang lebih dulu dibuat memanggilnya lewat adminCore
  let admin = null;
  const adminCore = { run: (...args) => admin.run(...args), load: (...args) => admin.load(...args), handleAccessError: (...args) => admin.handleAccessError(...args) };
  const files = { readImage: file => shrinkImage(file, window) };
  const studio = createStudioController({ api, store, ui, router: navigation, models, admin: adminCore, files });
  const packages = createPackageController({ store, ui, router: navigation, config: { wa: CS_WA, email: CS_EMAIL }, refreshMaster: studio.refreshMaster });
  const booking = createBookingController({ api, store, ui, router: navigation, models, packages, refreshMaster: studio.refreshMaster });
  const payment = createPaymentController({ api, store, ui, router: navigation, models, booking, refresh: booking.refreshData });
  const account = createAccountController({ api, store, models });
  // AuthController dan AdminController saling memakai: keluar (auth.logout) dan dialog Akses ditolak (admin.showAccessDenied)
  const auth = createAuthController({ api, store, ui, router: navigation, models, booking, accessDenied: () => admin.showAccessDenied() });
  admin = createAdminController({ api, store, ui, router: navigation, models, logout: () => auth.logout() });
  const landing = createLandingController({ api, store, router: navigation, models, page: createLandingPage({ document, window }), timers: { setTimeout: (callback, delay) => window.setTimeout(callback, delay) } });
  const photo = createPhotoSessionController({
    api,
    store,
    ui,
    router: navigation,
    models,
    screen: createSessionScreen({ document }),
    media: navigator.mediaDevices ? { getUserMedia: constraints => navigator.mediaDevices.getUserMedia(constraints) } : null,
    timers: { setInterval: (callback, delay) => window.setInterval(callback, delay), clearInterval: id => window.clearInterval(id), setTimeout: (callback, delay) => window.setTimeout(callback, delay) },
    sound: createBeeper(window.AudioContext),
    drive: { clientId: GOOGLE_CLIENT_ID, google: () => window.google, fetch: (...request) => window.fetch(...request) },
    refreshData: booking.refreshData,
    brand: BRAND,
  });
  const gallery = createGalleryController({ api, store, ui, models, drive: { fetch: (...request) => window.fetch(...request) }, files: { download: downloadFile }, photoSession: photo, refreshData: booking.refreshData, brand: BRAND });
  const controllers = { studio, package: packages, booking, payment, account, auth, landing, photo, gallery, admin };
  const pages = pagesFor(controllers, { invoiceUrl: api.invoiceUrl, adminPhotoUrl: api.adminPhotoUrl });
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

  // pulihkan login tersimpan (Mode Staf tidak ikut dipulihkan); token pelanggan di sesi admin → dialog Akses Ditolak (AuthController)
  if (await auth.restoreSession()) {
    render();
  }
}

start();
