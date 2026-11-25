// AccountController: Edit Profil dan permintaan ubah sandi lewat email (dulu saveProfile di customer.js dan changePw di core.js).
// Riwayat Pembayaran hanya ditampilkan (views/customer/account.js). Hasil setiap aksi tampil sebagai toast di outlet.
// Metode menerima isian form sebagai objek biasa (main.js: formValues, decisions.md 54).

export function createAccountController({ api, store, models }) {
  const state = () => store.get();

  function showToast(toast) {
    store.update("runtime", { toast: { message: "", error: "", ...toast } });
  }

  return {
    // Simpan di Edit Profil ({ name, phone }): nama baru langsung tampil di navbar (shell dipasang ulang karena isinya berubah)
    async saveProfile(fields) {
      store.update("runtime", { toast: { message: "", error: "" } }, { silent: true });
      try {
        const answer = await models.account.updateProfile(api, { name: fields.name, phone: fields.phone });
        store.update("persisted", { user: { ...state().persisted.user, ...answer } }, { silent: true });
        store.persist();
      } catch (error) {
        return showToast({ error: error.message });
      }
      showToast({ message: "Profil disimpan." });
    },

    // Ubah sandi via email: tautan buat sandi baru dikirim ke email akun ini
    async requestPasswordChange() {
      const email = state().persisted.user.email;
      try {
        await models.auth.forgot(api, email);
      } catch (error) {
        return showToast({ error: error.message });
      }
      showToast({ message: "Tautan untuk mengubah sandi telah dikirim ke " + email });
    },
  };
}
