// Titik masuk aplikasi (satu-satunya <script type="module"> di index.html).
// Menyiapkan API, store, controller, router, renderer dan event data-*, lalu: muat data master, tautan #reset= (router),
// pulihkan login (AuthController), render pertama. start() hanya berjalan di browser (ada document), jadi tes Node dapat mengimpor modul ini.
import { API_BASE, BRAND, CS_EMAIL, CS_WA, GOOGLE_CLIENT_ID } from "./config.js";
import { createStore } from "./core/store.js";
import { ROUTES, createRouter } from "./core/router.js";
import { createEvents, formValues } from "./core/events.js";
import { createPageHooks, createRenderer, installShellActions } from "./core/render.js";
import { createInitialState } from "./core/state.js";
import { createNavigator } from "./core/navigation.js";
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
import { createAdminController, createAdminState } from "./controllers/AdminController.js";
import { createAdminBookingController } from "./controllers/AdminBookingController.js";
import * as adminModels from "./models/admin/index.js";
import { photoSessionView } from "./views/session/photoSession.js";
import { galleryView } from "./views/session/gallery.js";
import { dashboardView } from "./views/admin/dashboard.js";
import { studiosView } from "./views/admin/studios.js";
import { bookingsView as adminBookingsView } from "./views/admin/bookings.js";
import { propertiesView } from "./views/admin/properties.js";
import { posesView } from "./views/admin/poses.js";
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
    // layar sempit: panel Detail Booking ada di bawah tabel, jadi digulir ke sana setelah dirender
    revealBookingDetail: () => {
      if (window.innerWidth <= 1000) {
        window.setTimeout(() => {
          const panel = document.querySelector(".bdet");
          if (panel) {
            panel.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }
    },
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

// halaman per path rute: view (state, match) → Safe, kait after(match) setelah outlet dirender, leave() saat halaman ditinggalkan.
// links = { invoiceUrl } untuk view yang menautkan invoice (token tetap di models/api.js, decisions.md 50)
function pagesFor({ studio, payment, landing, photo, gallery, admin, adminBooking }, links) {
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
    // panel admin (AdminController; Studio + Detail Sesi = StudioController; Booking = AdminBookingController)
    "/admin": { view: dashboardView, after: () => admin.loadDashboard() },
    "/admin/studios": { view: studiosView, after: () => studio.loadStudios() },
    "/admin/bookings": { view: adminBookingsView, after: () => adminBooking.load() },
    "/admin/props": { view: propertiesView, after: () => admin.loadProperties() },
    "/admin/poses": { view: posesView, after: () => admin.loadPoses() },
    "/admin/users": { view: (state, match) => usersView(state, match, links), after: () => admin.loadUsers() },
    "/admin/transactions": { view: transactionsView, after: () => admin.loadTransactions() },
    "/admin/packages": { view: adminPackagesView, after: () => admin.loadPackagesPage() },
    "/admin/account": { view: adminAccountView },
  };
}

// aksi data-* milik controller (diekspor untuk tests/main.test.js: setiap aksi di view terdaftar di sini); kalender dibagi menurut data-context (home = Filter Jadwal Browse, book = Pilih Waktu)
export function controllerActions({
  studio,
  package: packages,
  booking,
  payment,
  account,
  auth,
  landing,
  photo,
  gallery,
  admin,
  adminBooking,
}) {
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
    "studio:uploadImage": (dataset, event) =>
      studio.uploadImage(dataset, event.target.files[0], formValues(event.target.form)),
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
    "admin:saveProperty": (dataset, event) => admin.saveProperty(dataset, formValues(event.target)),
    "admin:addProperty": (dataset, event) => admin.addProperty(formValues(event.target)),
    "admin:uploadPropertyImage": (dataset, event) =>
      admin.uploadPropertyImage(dataset, event.target.files[0], formValues(event.target.form)),
    "admin:uploadPoseImage": (dataset, event) =>
      admin.uploadPoseImage(dataset, event.target.files[0], formValues(event.target.form)),
    "admin:deleteProperty": admin.deleteProperty,
    "admin:savePose": (dataset, event) => admin.savePose(dataset, formValues(event.target)),
    "admin:addPose": (dataset, event) => admin.addPose(formValues(event.target)),
    "admin:deletePose": admin.deletePose,
    "adminBooking:setFilter": adminBooking.setFilter,
    "adminBooking:open": adminBooking.open,
    "adminBooking:close": adminBooking.close,
    "adminBooking:save": (dataset, event) => adminBooking.save(dataset, formValues(event.target)),
    "adminBooking:delete": adminBooking.delete,
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
  const session = {
    storage: browserStorage("sessionStorage"),
    key: "snapia_booking",
    slices: { booking: ["studio", "date", "slot", "rescheduleId"] },
  };
  const store = createStore(
    { ...createInitialState(), photo: createPhotoState(), admin: createAdminState() },
    { storage, persistKey: "snapia", session },
  );
  const state = store.get();
  const ui = createUi(store);
  // router dibuat setelah controller (tabel halamannya memakai controller), jadi navigasi meneruskan ke router lewat rujukan
  let router = null;
  const navigation = createNavigator({
    store,
    router: { navigate: path => router.navigate(path) },
    scrollToTop: () => window.scrollTo({ top: 0, behavior: "instant" }),
  });
  const models = {
    master: masterModel,
    studio: studioModel,
    booking: bookingModel,
    payment: paymentModel,
    photoSession: photoSessionModel,
    account: accountModel,
    auth: authModel,
    contact: contactModel,
    drive: driveModel,
    gallery: galleryModel,
    admin: adminModels,
  };
  // AdminController dibuat setelah AuthController (saling memakai); controller yang lebih dulu dibuat memanggilnya lewat adminCore
  let admin = null;
  const adminCore = {
    run: (...args) => admin.run(...args),
    load: (...args) => admin.load(...args),
    handleAccessError: (...args) => admin.handleAccessError(...args),
  };
  const files = { readImage: file => shrinkImage(file, window) };
  const studio = createStudioController({ api, store, ui, router: navigation, models, admin: adminCore, files });
  const packages = createPackageController({
    store,
    ui,
    router: navigation,
    config: { wa: CS_WA, email: CS_EMAIL },
    refreshMaster: studio.refreshMaster,
  });
  const booking = createBookingController({
    api,
    store,
    ui,
    router: navigation,
    models,
    packages,
    refreshMaster: studio.refreshMaster,
  });
  const payment = createPaymentController({
    api,
    store,
    ui,
    router: navigation,
    models,
    booking,
    refresh: booking.refreshData,
  });
  const account = createAccountController({ api, store, models });
  // AuthController dan AdminController saling memakai: keluar (auth.logout) dan dialog Akses ditolak (admin.showAccessDenied)
  const auth = createAuthController({
    api,
    store,
    ui,
    router: navigation,
    models,
    booking,
    accessDenied: () => admin.showAccessDenied(),
  });
  admin = createAdminController({ api, store, ui, router: navigation, models, logout: () => auth.logout(), files });
  const landing = createLandingController({
    api,
    store,
    router: navigation,
    models,
    page: createLandingPage({ document, window }),
    timers: { setTimeout: (callback, delay) => window.setTimeout(callback, delay) },
  });
  const photo = createPhotoSessionController({
    api,
    store,
    ui,
    router: navigation,
    models,
    screen: createSessionScreen({ document }),
    media: navigator.mediaDevices
      ? { getUserMedia: constraints => navigator.mediaDevices.getUserMedia(constraints) }
      : null,
    timers: {
      setInterval: (callback, delay) => window.setInterval(callback, delay),
      clearInterval: id => window.clearInterval(id),
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    },
    sound: createBeeper(window.AudioContext),
    drive: { clientId: GOOGLE_CLIENT_ID, google: () => window.google, fetch: (...request) => window.fetch(...request) },
    refreshData: booking.refreshData,
    brand: BRAND,
  });
  const gallery = createGalleryController({
    api,
    store,
    ui,
    models,
    drive: { fetch: (...request) => window.fetch(...request) },
    files: { download: downloadFile },
    photoSession: photo,
    refreshData: booking.refreshData,
    brand: BRAND,
  });
  const adminBooking = createAdminBookingController({ api, store, ui, models, admin });
  const controllers = {
    studio,
    package: packages,
    booking,
    payment,
    account,
    auth,
    landing,
    photo,
    gallery,
    admin,
    adminBooking,
  };
  const pages = pagesFor(controllers, { invoiceUrl: api.invoiceUrl, adminPhotoUrl: api.adminPhotoUrl });
  const routes = ROUTES.map(route => ({ ...route, ...pages[route.path] }));
  router = createRouter({
    routes,
    history: window.history,
    location: window.location,
    events: window,
    getSession: () => ({
      loggedIn: Boolean(state.persisted.me),
      admin: Boolean(state.persisted.admin),
      mustChange: Boolean(state.persisted.admin && state.admin.me && state.admin.me.must_change),
    }),
    onChange: cause => {
      if (cause !== "navigate") {
        store.update("runtime", { toast: { message: "", error: "" } }, { silent: true }); // back/forward dan tautan reset (navigasi aplikasi sudah membersihkannya sendiri)
      }
      renderer.render();
    },
    // tautan "buat sandi baru" dari email (/#reset=<token>): login yang tersimpan dilepas
    // (juga saat tautan dibuka di tab yang sudah memuat aplikasi: data user sebelumnya ikut dibersihkan)
    onResetLink: token => {
      store.update("runtime", { auth: { ...state.runtime.auth, resetToken: token } }, { silent: true });
      api.token = "";
      store.update("persisted", { user: null, me: null, admin: false }, { silent: true });
      store.update("data", { bookings: [], sessions: [] }, { silent: true });
    },
  });
  // shell sekali per rute, outlet setiap render (core/render.js)
  const hooks = createPageHooks({ store, syncReschedule: id => booking.syncReschedule(id) });
  const root = document.getElementById("app");
  const renderer = createRenderer({
    root,
    resolve: () => router.resolve(),
    before: hooks.before,
    shell: hooks.shell,
    outlet: hooks.outlet,
  });
  renderer.start(store);

  // atribut data-* (core/events.js) di seluruh dokumen; data-route pindah halaman lewat navigasi aplikasi (decisions.md 42)
  const events = createEvents({ navigate: path => navigation.navigate(path) });
  installShellActions({ registerActions: events.registerActions, document });
  events.registerActions(controllerActions(controllers));
  events.startEvents(document);

  try {
    store.update("master", await masterModel.loadMaster(api), { silent: true });
  } catch (error) {
    const message = document.createElement("p");
    message.style.padding = "24px";
    const command = document.createElement("code");
    command.textContent = "cd backend && npm start";
    message.append("Server API tidak dapat dihubungi. Jalankan backend: ", command);
    root.replaceChildren(message);
    return;
  }

  // back/forward dan tautan #reset= (diubah menjadi /reset-password)
  router.start();

  // pulihkan login tersimpan (Mode Staf tidak ikut dipulihkan); token pelanggan di sesi admin → dialog Akses Ditolak (AuthController)
  if (await auth.restoreSession()) {
    renderer.render();
  }
}

if (typeof document !== "undefined") {
  start();
}
