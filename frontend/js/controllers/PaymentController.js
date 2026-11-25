// PaymentController (tabel MVC APS): langkah Paket & Pembayaran (pilih paket, metode, quote), Check Out, Detail Pembayaran di halaman
// sukses, invoice lewat email, dan Bayar booking yang tertunda dari Detail Booking dengan modal konfirmasi (dulu selectPkg, V.pay_after,
// confirmPay, mailInv, payNow di customer.js). Metode data-* menerima (dataset, event) dari core/events.js.
// booking = BookingController (popup galat, popup Belum Login, mengosongkan booking berjalan); refresh = muat ulang booking dan sesi foto.
import { isStudioShown } from "../models/master.js";
import { payConfirmModal } from "../views/customer/bookingPopups.js";

const DEFAULT_METHOD = "QRIS";

export function createPaymentController({ api, store, ui, router, models, booking, refresh }) {
  const { booking: bookingModel, payment: paymentModel } = models;
  const state = () => store.get();
  // quote yang sedang diambil setelah halaman dimuat ulang (satu permintaan saja walau outlet dirender berkali-kali)
  let quoteLoading = false;

  function fetchQuote() {
    return bookingModel.quote(api, { packageId: state().persisted.pkg, studioId: state().booking.studio });
  }

  const controller = {
    // pill paket di langkah ini (data-id): quote diambil ulang lalu outlet dirender (decisions.md 49)
    async selectPackage(dataset) {
      store.update("persisted", { pkg: Number(dataset.id) }, { silent: true });
      store.update("runtime", { toast: { message: "", error: "" } }, { silent: true });
      let quote;
      try {
        quote = await fetchQuote();
      } catch (error) {
        return booking.handleError(error, () => controller.selectPackage({ id: state().persisted.pkg }));
      }
      store.update("booking", { quote });
    },

    // select Metode pembayaran (data-change)
    setMethod(dataset, event) {
      store.update("persisted", { method: event.target.value });
    },

    // Check Out: tamu → popup Belum Login, belum ada booking yang dibuat (keputusan 35);
    // selain itu buat booking + bayar → muat ulang data → Studio Berhasil Direservasi
    async confirm() {
      const { persisted, booking: draft } = state();
      if (!persisted.me) {
        return booking.requireLogin();
      }
      try {
        const created = await bookingModel.create(api, { packageId: persisted.pkg, studioId: draft.studio, slot: draft.slot });
        await paymentModel.pay(api, created.id, persisted.method || DEFAULT_METHOD);
        booking.clearBooking();
        await refresh();
        store.update("persisted", { payOpen: false }, { silent: true });
        router.navigate(`/bookings/${created.id}/success`);
      } catch (error) {
        store.update("runtime", { availability: {} }, { silent: true });
        return booking.handleError(error, () => controller.selectPackage({ id: state().persisted.pkg }));
      }
    },

    // tombol Detail Pembayaran di halaman sukses
    togglePaymentDetail() {
      store.update("persisted", { payOpen: !state().persisted.payOpen });
    },

    // Kirim invoice ke email (data-id); hasilnya sebagai toast
    async emailInvoice(dataset) {
      const toast = { message: "", error: "" };
      try {
        const answer = await paymentModel.emailInvoice(api, Number(dataset.id));
        toast.message = answer.dev ? "Mode pengembangan: SMTP belum diatur, email disimpan di folder backend/outbox." : "Invoice dikirim ke email Anda.";
      } catch (error) {
        toast.error = error.message;
      }
      store.update("runtime", { toast });
    },

    // Bayar di Detail Booking (data-id): modal Konfirmasi Pembayaran → bayar QRIS (simulasi) → muat ulang data → halaman sukses
    async payNow(dataset) {
      const id = Number(dataset.id);
      if ((await ui.modal(payConfirmModal())) !== true) {
        return;
      }
      try {
        await paymentModel.pay(api, id, DEFAULT_METHOD);
        await refresh();
      } catch (error) {
        if (error.status == 401) {
          return booking.loginExpired();
        }
        store.update("runtime", { toast: { message: "", error: error.message } });
        return;
      }
      store.update("persisted", { payOpen: false }, { silent: true });
      router.navigate(`/bookings/${id}/success`);
    },

    // kait after /book/pay: booking berjalan bertahan saat dimuat ulang (sessionStorage, decisions.md 26) tanpa quote, jadi quote diambil lagi
    async loadMissingQuote() {
      const { booking: current, master } = state();
      if (!current.slot || current.quote || quoteLoading || !isStudioShown(master, current.studio)) {
        return;
      }
      quoteLoading = true;
      let quote;
      try {
        quote = await fetchQuote();
      } catch (error) {
        quoteLoading = false;
        router.navigate("/book/time");
        return booking.handleError(error, booking.next);
      }
      quoteLoading = false;
      store.update("booking", { quote });
    },
  };
  return controller;
}
