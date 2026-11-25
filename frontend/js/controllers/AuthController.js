// AuthController: Masuk/Daftar/Lupa Sandi/Buat Sandi Baru, masuk admin, keluar, Mode Staf dan pemulihan login saat aplikasi dibuka
// (dulu reg, login, adminLogin, afterAuth, forgot, doReset, logout, staffToggle di core.js dan isi boot.js).
// Metode form menerima isian sebagai objek biasa (main.js: formValues, decisions.md 54); galat tampil sebagai toast di kartu form,
// dan isian yang diketik (bukan password) tetap ada setelah galat.
// booking = BookingController (refreshData, resumeDraft, clearBooking); accessDenied = dialog Akses ditolak (AdminController.showAccessDenied).
// Keluar mengosongkan slice admin ke isi awalnya (createAdminState, dulu adminReset di admin.js).
import { staffPinModal } from "../views/auth/staff.js";
import { createAdminState } from "./AdminController.js";

const EMAIL = /\S+@\S+\.\S+/;
const PHONE = /^\d{8,15}$/;

export function createAuthController({ api, store, ui, router, models, booking, accessDenied = () => {} }) {
  const auth = models.auth;
  const state = () => store.get();

  function showToast(toast) {
    store.update("runtime", { toast: { message: "", error: "", ...toast } });
  }

  // galat form: toast + isian yang diketik untuk form ini
  function showError(message, mode, values) {
    store.update("runtime", { auth: { ...state().runtime.auth, form: { mode, values } } }, { silent: true });
    showToast({ error: message });
  }

  function forgetTyped() {
    store.update("runtime", { auth: { ...state().runtime.auth, form: null } }, { silent: true });
  }

  const controller = {
    // satu form masuk: isian berisi "@" = email pelanggan, selain itu = username admin
    async login({ identifier = "", password = "" }) {
      const name = identifier.trim();
      const typed = { identifier: name };
      if (!name || !password) {
        return showError("Isi email/username dan password.", "login", typed);
      }
      try {
        if (name.includes("@")) {
          await controller.afterAuth(await auth.login(api, { email: name, password }));
        } else {
          await controller.adminLogin(name, password);
        }
      } catch (error) {
        showError(error.status == 401 ? "Email/username atau password salah" : error.message, "login", typed);
      }
    },

    async register({ name = "", phone = "", email = "", password = "" }) {
      const fields = { name: name.trim(), phone: phone.trim(), email: email.trim() };
      if (!fields.name || !EMAIL.test(fields.email) || !PHONE.test(fields.phone) || password.length < 6) {
        return showError("Lengkapi data: email valid, telepon 8-15 digit, password min. 6 karakter.", "register", fields);
      }
      try {
        await controller.afterAuth(await auth.register(api, { name: fields.name, email: fields.email, phone: fields.phone, password }));
      } catch (error) {
        showError(error.message, "register", fields);
      }
    },

    async forgot({ email = "" }) {
      const address = email.trim();
      if (!EMAIL.test(address)) {
        return showError("Masukkan email yang valid.", "forgot", { email: address });
      }
      let answer;
      try {
        answer = await auth.forgot(api, address);
      } catch (error) {
        return showError(error.message, "forgot", { email: address });
      }
      forgetTyped();
      router.navigate("/login");
      showToast({ message: answer.message });
    },

    async reset({ password = "", confirmation = "" }) {
      if (password.length < 6 || password !== confirmation) {
        return showToast({ error: "Password min. 6 karakter dan kedua isian harus sama." });
      }
      try {
        await auth.reset(api, { token: state().runtime.auth.resetToken, password });
      } catch (error) {
        return showToast({ error: error.message });
      }
      store.update("runtime", { auth: { ...state().runtime.auth, resetToken: "" } }, { silent: true });
      router.navigate("/login");
      showToast({ message: "Sandi berhasil diubah. Silakan masuk dengan sandi baru." });
    },

    // pelanggan masuk/terdaftar: data miliknya dimuat; draf booking tamu (popup Belum Login) → kembali ke Paket & Pembayaran
    async afterAuth(answer) {
      api.token = answer.token;
      store.update("persisted", { admin: false, user: answer.user, me: answer.user.id }, { silent: true });
      forgetTyped();
      await booking.refreshData();
      if (state().persisted.draft) {
        return booking.resumeDraft();
      }
      router.navigate("/browse");
    },

    async adminLogin(username, password) {
      const answer = await auth.adminLogin(api, { username, password });
      api.token = answer.token;
      store.update("persisted", { admin: true, draft: null, user: { name: "Admin", id: 0 }, me: "admin" }, { silent: true });
      store.update("admin", { me: answer.admin }, { silent: true });
      forgetTyped();
      router.navigate(answer.admin.must_change ? "/admin/account" : "/admin");
    },

    // Keluar: semua yang milik user dibuang, termasuk booking yang sedang diisi (decisions.md 58) dan state admin
    logout() {
      api.token = "";
      api.staffToken = "";
      store.update("persisted", { user: null, me: null, staff: false, admin: false, draft: null }, { silent: true });
      store.update("data", { bookings: [], sessions: [] }, { silent: true });
      booking.clearBooking();
      store.update("admin", createAdminState(), { silent: true });
      store.update("runtime", { auth: { ...state().runtime.auth, mode: "login", form: null } }, { silent: true });
      router.navigate("/");
    },

    // Mode Staf di menu akun: aktif → nonaktif langsung; nonaktif → modal PIN
    async toggleStaff() {
      if (state().persisted.staff) {
        api.staffToken = "";
        store.update("persisted", { staff: false });
        store.persist();
        return;
      }
      const answer = await ui.modal(staffPinModal());
      const pin = answer && answer.value === "ok" ? answer.data : "";
      if (!pin) {
        return;
      }
      try {
        api.staffToken = (await auth.staffLogin(api, pin)).token;
      } catch (error) {
        return showToast({ error: error.message });
      }
      store.update("persisted", { staff: true });
      store.persist();
    },

    // saat aplikasi dibuka: login tersimpan dipulihkan (Mode Staf tidak). true = pemanggil merender;
    // false = sudah ditangani (logout pindah ke landing, atau dialog Akses Ditolak untuk token pelanggan di sesi admin)
    async restoreSession() {
      store.update("persisted", { staff: false }, { silent: true });
      const { persisted } = state();
      if (!api.token || !persisted.user) {
        store.update("persisted", { me: null }, { silent: true });
        return true;
      }
      try {
        store.update("persisted", { me: persisted.admin ? "admin" : persisted.user.id }, { silent: true });
        if (persisted.admin) {
          store.update("admin", { me: await auth.adminMe(api) }, { silent: true });
        } else {
          await booking.refreshData();
        }
      } catch (error) {
        if (persisted.admin && error.status == 403 && /Hanya admin/.test(error.message)) {
          accessDenied();
          return false;
        }
        controller.logout();
        return false;
      }
      return true;
    },
  };
  return controller;
}
