// BookingController (tabel MVC APS): langkah Pilih Tanggal & Waktu, ubah jadwal (reschedule), draf booking tamu, dan satu pemetaan
// galat API → popup Create Booking (dulu quickBook, startBook, calNav/calPick "book", nextTime, resumeDraft, backToTime, bookingErr,
// inputInvalid, sesiGone, sesiBooked, needLogin di customer.js), lalu Booking Saya: memuat booking dan sesi foto milik user (refresh),
// pembatalan dengan modal konfirmasi (openCancel, doCancel) dan ubah jadwal yang dibuka langsung lewat URL (syncReschedule di core.js).
// Metode data-* menerima (dataset, event) dari core/events.js.
// packages = PackageController (paket pilihan, popup Paket Tidak Ditemukan); refreshMaster = StudioController.refreshMaster;
// refresh (opsional, untuk tes) = pengganti refreshData.
import { isoDate, parseSlot, slotLabel } from "../core/format.js";
import { isStudioShown } from "../models/master.js";
import { filterDate } from "../models/studio.js";
import { monthOf, shiftMonth } from "../components/calendar.js";
import {
  bookingFailedModal,
  cancelConfirmModal,
  inputInvalidModal,
  loginRequiredModal,
  sessionBookedModal,
  sessionExpiredModal,
  sessionGoneModal,
} from "../views/customer/bookingPopups.js";

const EMPTY_BOOKING = { studio: null, date: null, slot: null, quote: null, rescheduleId: null };

// Satu tabel, dibaca berurutan: baris pertama yang cocok membuka popupnya. Urutannya penting: "Paket/studio tidak valid" berarti paket
// yang hilang bila paket pilihan memang sudah nonaktif (baris package), selain itu studionya (baris terakhir).
// open(controller, error, next) → true bila galat sudah ditangani; false = lanjut ke baris berikutnya.
export const BOOKING_ERRORS = [
  { name: "login", matches: error => error.status == 401, open: controller => controller.requireLogin() },
  // "Jadwal sudah tidak tersedia" (booking) / "Jadwal baru tidak tersedia" (reschedule)
  {
    name: "sessionBooked",
    matches: error => error.status == 409 && /^Jadwal (sudah|baru) tidak tersedia/.test(error.message),
    open: controller => controller.showSessionBooked(),
  },
  // "Paket tidak valid" / "Paket/studio tidak valid" dengan paket yang sudah nonaktif → Paket Tidak Ditemukan
  {
    name: "package",
    matches: () => true,
    open: (controller, error, next) => controller.packages.handleError(error, next),
  },
  {
    name: "inputInvalid",
    matches: error => error.message === "Format/jam slot tidak valid",
    open: controller => controller.showInputInvalid(),
  },
  // paket masih aktif: sesinya lewat atau studionya hilang
  {
    name: "sessionGone",
    matches: error =>
      ["Jadwal sudah lewat", "Studio tidak tersedia", "Paket/studio tidak valid"].includes(error.message),
    open: controller => controller.showSessionGone(),
  },
];

export function createBookingController({
  api,
  store,
  ui,
  router,
  models,
  packages,
  refreshMaster,
  refresh: refreshOverride,
  now = () => new Date(),
}) {
  const bookingModel = models.booking;
  const refresh = () => (refreshOverride ? refreshOverride() : controller.refreshData());
  const state = () => store.get();
  const booking = () => state().booking;

  // path langkah Pilih Waktu: /bookings/:id/reschedule saat mengubah jadwal
  function timePath() {
    const id = booking().rescheduleId;
    return id ? `/bookings/${id}/reschedule` : "/book/time";
  }

  function currentMonth() {
    const today = now();
    return { year: today.getFullYear(), month: today.getMonth() };
  }

  async function loadQuote() {
    const quote = await bookingModel.quote(api, { packageId: state().persisted.pkg, studioId: booking().studio });
    store.update("booking", { quote }, { silent: true });
  }

  // bulan kalender yang dipindah dengan panah dilupakan, jadi kalender membuka bulan tanggal booking yang baru (decisions.md 52)
  function forgetMonth() {
    const { book, ...others } = state().runtime.calendar;
    store.update("runtime", { calendar: others }, { silent: true });
  }

  // booking baru dari Browse / Detail Studio: draf tamu lama dan reschedule dibuang
  function begin(fields) {
    forgetMonth();
    store.update("persisted", { draft: null }, { silent: true });
    store.update("booking", { rescheduleId: null, ...fields }, { silent: true });
    router.navigate("/book/time");
  }

  // token kedaluwarsa: login yang tersimpan dilepas beserta data milik user
  function forgetLogin() {
    api.token = "";
    store.update("persisted", { user: null, me: null }, { silent: true });
    store.update("data", { bookings: [], sessions: [] }, { silent: true });
  }

  const controller = {
    packages,

    // chip jam di kartu studio Browse (data-studio, data-date, data-hour)
    quickBook(dataset) {
      if (!packages.ensureSelected(() => controller.quickBook(dataset))) {
        return;
      }
      begin({ studio: Number(dataset.studio), date: dataset.date, slot: `${dataset.date} ${Number(dataset.hour)}:00` });
    },

    // Book Now di Detail Studio (data-id): tanggal dari Filter Jadwal, tanpa sesi
    start(dataset) {
      if (!packages.ensureSelected(() => controller.start(dataset))) {
        return;
      }
      begin({ studio: Number(dataset.id), date: filterDate(state().persisted.hDate, isoDate(now())), slot: null });
    },

    // Reschedule di Detail Booking (data-id): studio dan tanggal booking itu, sesi dipilih ulang
    startReschedule(dataset) {
      const id = Number(dataset.id);
      const existing = bookingModel.bookingById(state().data.bookings, id);
      if (!existing) {
        return;
      }
      forgetMonth();
      store.update(
        "booking",
        { rescheduleId: id, studio: existing.studio, date: parseSlot(existing.date).date, slot: null },
        { silent: true },
      );
      router.navigate(timePath());
    },

    // kalender langkah ini (data-context="book")
    pickDate(dataset) {
      store.update("booking", { date: dataset.date, slot: null });
    },

    moveMonth(dataset) {
      const calendars = state().runtime.calendar;
      const shown = calendars.book || monthOf(booking().date || isoDate(now()));
      const next = shiftMonth(shown, dataset.step, currentMonth());
      if (!next) {
        return;
      }
      store.update("runtime", { calendar: { ...calendars, book: next } });
    },

    pickSlot(dataset) {
      store.update("booking", { slot: dataset.slot, date: parseSlot(dataset.slot).date });
    },

    // Lanjut ke Pembayaran (quote → /book/pay) atau Simpan Jadwal Baru (PATCH → Reschedule Berhasil)
    async next() {
      const { slot, rescheduleId, studio } = booking();
      if (!slot) {
        return controller.showInputInvalid();
      }
      if (bookingModel.isSlotGone(state().runtime.availability, studio, slot, now())) {
        return controller.showSessionGone();
      }
      if (rescheduleId) {
        try {
          await bookingModel.reschedule(api, rescheduleId, { studioId: studio, slot });
        } catch (error) {
          return controller.handleError(error, controller.next);
        }
        controller.clearBooking();
        await refresh();
        router.navigate(`/bookings/${rescheduleId}/rescheduled`);
        return;
      }
      store.update("booking", { quote: null }, { silent: true });
      try {
        await loadQuote();
      } catch (error) {
        return controller.handleError(error, controller.next);
      }
      router.navigate("/book/pay");
    },

    // draf booking tamu setelah Masuk/Daftar (popup Belum Login): kembali ke Paket & Pembayaran dengan studio, sesi dan paket yang sama
    async resumeDraft() {
      const draft = state().persisted.draft;
      forgetMonth();
      store.update("persisted", { draft: null }, { silent: true });
      store.update(
        "booking",
        { rescheduleId: null, studio: draft.studio, date: draft.date, slot: draft.slot, quote: null },
        { silent: true },
      );
      try {
        await loadQuote();
      } catch (error) {
        router.navigate("/book/time");
        return controller.handleError(error, controller.next);
      }
      router.navigate("/book/pay");
    },

    // setelah Check Out / reschedule berhasil: booking berjalan dikosongkan (juga dari sessionStorage)
    clearBooking() {
      store.update("booking", { ...EMPTY_BOOKING }, { silent: true });
    },

    // kembali ke Pilih Waktu dengan sesi dikosongkan dan ketersediaan dimuat ulang (kait after rute memanggil prefetch)
    backToTime() {
      store.update("booking", { slot: null, quote: null }, { silent: true });
      if (state().runtime.route.name === "time") {
        store.update("runtime", { availability: {} });
      } else {
        router.navigate(timePath());
      }
    },

    // galat API dari quote/booking/reschedule → popup (tabel BOOKING_ERRORS); next = ulangi langkah semula setelah paket lain dipilih
    async handleError(error, next) {
      for (const rule of BOOKING_ERRORS) {
        if (rule.matches(error) && (await rule.open(controller, error, next)) !== false) {
          return;
        }
      }
      await ui.modal(bookingFailedModal(error.message || ""));
    },

    async showInputInvalid() {
      await ui.modal(inputInvalidModal());
      if (state().runtime.route.name !== "time") {
        controller.backToTime();
      }
    },

    // sesi lewat/terisi, atau studionya tidak tersedia lagi (data master dimuat ulang dulu)
    async showSessionGone() {
      const slot = booking().slot;
      const slotText = slot ? slotLabel(parseSlot(slot).h) : "";
      await refreshMaster();
      const studioShown = isStudioShown(state().master, booking().studio);
      await ui.modal(sessionGoneModal({ studioShown, slotText }));
      if (studioShown) {
        controller.backToTime();
        return;
      }
      const rescheduleId = booking().rescheduleId;
      store.update("booking", { slot: null, quote: null }, { silent: true });
      router.navigate(rescheduleId ? `/bookings/${rescheduleId}` : "/browse");
      if (rescheduleId) {
        store.update("booking", { rescheduleId: null }, { silent: true });
      }
    },

    async showSessionBooked() {
      await ui.modal(sessionBookedModal());
      controller.backToTime();
    },

    // Belum Login: draf (studio, tanggal, sesi) disimpan agar setelah Masuk/Daftar alur kembali ke Paket & Pembayaran.
    // Masih tercatat masuk (401 = token kedaluwarsa): sesi login dilepas dulu
    async requireLogin() {
      const { studio, date, slot } = booking();
      store.update("persisted", { draft: { studio, date, slot } }, { silent: true });
      const answer = await ui.modal(loginRequiredModal());
      if (!answer) {
        return;
      }
      if (state().persisted.me) {
        forgetLogin();
      }
      router.navigate(answer === "register" ? "/register" : "/login");
    },

    // 401 saat membatalkan / membayar booking yang sudah ada (dulu toast "Belum login"): login dilepas, popup, lalu form Masuk
    async loginExpired() {
      forgetLogin();
      await ui.modal(sessionExpiredModal());
      router.navigate("/login");
    },

    // ---------- Booking Saya ----------

    // booking dan sesi foto milik user yang masuk → slice data (tanpa render; pemanggil yang pindah halaman / merender)
    async refreshData() {
      const bookings = await bookingModel.listMine(api);
      const sessions = await models.photoSession.listMine(api);
      store.update("data", { bookings, sessions }, { silent: true });
    },

    // rute Pilih Waktu (setiap render): /bookings/:id/reschedule dibuka langsung (tab baru, tautan) memulai ubah jadwal booking itu
    // bila masih bisa diubah; id kosong (/book/time) = bukan reschedule
    syncReschedule(id) {
      if (!id) {
        store.update("booking", { rescheduleId: null }, { silent: true });
        return;
      }
      if (booking().rescheduleId == id) {
        return;
      }
      const existing = bookingModel.bookingById(state().data.bookings, id);
      if (existing && bookingModel.canChange(existing)) {
        forgetMonth();
        store.update(
          "booking",
          { rescheduleId: id, studio: existing.studio, date: parseSlot(existing.date).date, slot: null, quote: null },
          { silent: true },
        );
      }
    },

    // Batalkan di Detail Booking (data-id): isian alasan dikosongkan
    openCancel(dataset) {
      store.update("runtime", { cancel: { reason: "", detail: "" } }, { silent: true });
      router.navigate(`/bookings/${dataset.id}/cancel`);
    },

    // alasan pembatalan (data-reason): outlet dirender ulang (tombol menyala, textarea untuk "Pembatalan lainnya")
    setCancelReason(dataset) {
      store.update("runtime", { cancel: { ...state().runtime.cancel, reason: dataset.reason } });
    },

    // teks alasan lain (data-input): disimpan diam-diam agar textarea tidak dirender ulang saat mengetik
    setCancelDetail(dataset, event) {
      store.update("runtime", { cancel: { ...state().runtime.cancel, detail: event.target.value } }, { silent: true });
    },

    // Refund / Batalkan Booking (data-id): modal Konfirmasi Pembatalan → POST → muat ulang data → halaman hasil refund
    async cancel(dataset) {
      const id = Number(dataset.id);
      if ((await ui.modal(cancelConfirmModal())) !== true) {
        return;
      }
      const { reason, detail } = state().runtime.cancel;
      try {
        const result = await bookingModel.cancel(api, id, { reason, detail });
        store.update("persisted", { cancelRes: result }, { silent: true });
        await refresh();
      } catch (error) {
        if (error.status == 401) {
          return controller.loginExpired();
        }
        store.update("runtime", { toast: { message: "", error: error.message } });
        return;
      }
      router.navigate(`/bookings/${id}/refund`);
    },
  };
  return controller;
}
