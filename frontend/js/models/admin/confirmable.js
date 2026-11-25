// Alur konfirmasi server untuk aksi admin yang berdampak (DELETE/PATCH): server membalas 409 { needs_confirm, impact } sampai
// permintaan diulang dengan ?confirm=1 (dulu aConfirmReq/aConfirmDel di admin.js).
// request(confirmed) = kirim permintaan; confirmed = true → pakai confirmPath(path). Dialog lewat ui.modal (Kembali + tombol aksi).
// known = dampak yang sudah diketahui dari daftar (dialog awal); askFirst = false → langsung kirim tanpa dialog awal.
// Bila server membalas 409 dengan dampak yang sama dengan dialog yang sudah disetujui, langsung ulangi; selain itu tampilkan dialog
// dengan dampak terbaru. Mengembalikan hasil server, atau null bila admin membatalkan. Galat lain diteruskan ke pemanggil.

export const confirmPath = path => path + (path.includes("?") ? "&" : "?") + "confirm=1";

function ask(ui, { title, okLabel, describeImpact }, impact) {
  const options = { title, body: describeImpact(impact), buttons: [{ label: "Kembali", value: false, style: "ghost" }, { label: okLabel, value: true }] };
  return Promise.resolve(ui.modal(options)).then(answer => answer === true);
}

export async function withConfirm(request, { ui, title, okLabel, describeImpact, known, askFirst = true }) {
  const dialog = { title, okLabel, describeImpact };
  if (askFirst && !(await ask(ui, dialog, known))) {
    return null;
  }
  try {
    return await request(false);
  } catch (error) {
    if (error.status != 409 || !error.data || !error.data.needs_confirm) {
      throw error;
    }
    const impact = error.data.impact;
    const sameAsApproved = askFirst && JSON.stringify(impact) === JSON.stringify(known);
    if (!sameAsApproved && !(await ask(ui, dialog, impact))) {
      return null;
    }
    return request(true);
  }
}
