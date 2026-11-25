// ===== PANEL ADMIN (sisa kode lama, fase 8b): Studio + Sesi, Booking, Properti, Pose =====
import { API, CONTROLLERS, M, R, V } from "./state.js";
import { createAdminState } from "../controllers/AdminController.js";
import { uploadImage } from "../models/admin/uploads.js";
import { shrinkImage } from "../components/imageFile.js";
import { esc, raw } from "../core/html.js";
import { formatTime as fmtTime, formatRupiah as rp } from "../core/format.js";
import { $, ic, modal, render } from "./core.js";
import { PAYMENT_LABELS as PAYLBL } from "../models/booking.js";
import { keyValueRows } from "../components/keyValueRows.js";
import { backgroundImage as bgi } from "../components/propertyVisual.js";
// baris "label — nilai" untuk detail booking admin (nilai dari kode lama sudah berupa HTML; dulu di customer.js, fase 8b memindahkannya)
const kvs = rows => keyValueRows(rows.map(([label, value, cls]) => [raw(String(label)), raw(String(value)), cls])).markup;
// slice admin (store): isi awal dari AdminController; kosongkan saat keluar = AuthController.logout (dulu adminReset)
const AD = createAdminState();
// menu sidebar, judul halaman dan kotak cari: tabel rute (core/router.js) dan components/adminSidebar.js (refactor MVC fase 4)
// inti admin di controllers/AdminController.js (refactor MVC fase 8a): galat akses (401 keluar, 403 "Hanya admin" → Akses ditolak,
// 403 "Ganti password" → Akun Admin), muat sekali (aLoad) dan aksi dengan toast (aDo). Sisa kode lama (fase 8b) memanggilnya lewat CONTROLLERS.admin.
const aLoad = (k, fn, def) => CONTROLLERS.admin.load(k, fn, def);
// isian form kode lama dipulihkan bila aksi gagal (form fase 8b belum memperbarui isian di tempat)
async function aDo(fn, ok, what) { const sn = snap(); if (!await CONTROLLERS.admin.run(fn, ok, what)) restore(sn); }
// simpan & pulihkan isian form agar tidak hilang saat tampilan dirender ulang (unggah gambar / error validasi)
const snap = () => { const o = {}; document.querySelectorAll('.amain [id]').forEach(e => { if ('value' in e && e.type !== 'file') o[e.id] = e.value; }); return o; };
const restore = o => Object.keys(o).forEach(id => { const e = document.getElementById(id); if (e && 'value' in e && e.type !== 'file') e.value = o[id]; });
const val = id => ($("#" + id) || {}).value;
// dialog konfirmasi (Figma "Konfirmasi Hapus …"), memakai modal() bersama di core.js: true bila admin menekan tombol aksi; body berupa HTML yang sudah di-escape pemanggil
const aModal = (title, body, okLabel) => modal({ title, body, buttons: [{ label: "Kembali", value: false, style: "ghost" }, { label: okLabel, value: true }] }).then(v => v === true);
// aksi dengan alur konfirmasi server (DELETE/PATCH): dialog memakai dampak yang sudah diketahui (ask=false: langsung kirim tanpa dialog awal); bila server membalas 409 needs_confirm
// dengan dampak yang sama dan dialog sudah disetujui, ulangi dengan ?confirm=1, selain itu tampilkan dialog dengan dampak terbaru. Mengembalikan hasil server, atau null bila dibatalkan.
async function aConfirmReq(method, path, body, title, describe, okLabel, known, ask = true) {
  if (ask && !await aModal(title, describe(known), okLabel)) return null;
  try { return await API.request(method, path, body); } catch (e) {
    if (e.status != 409 || !e.data || !e.data.needs_confirm) throw e; const im = e.data.impact;
    if ((!ask || JSON.stringify(im) !== JSON.stringify(known)) && !await aModal(title, describe(im), okLabel)) return null;
    return API.request(method, path + (path.includes("?") ? "&" : "?") + "confirm=1", body); }
}
const aConfirmDel = (path, title, describe, okLabel, known) => aConfirmReq("DELETE", path, undefined, title, describe, okLabel, known);
const match = (...f) => { const q = AD.query.trim().toLowerCase(); return !q || f.some(x => String(x ?? "").toLowerCase().includes(q)); };
const loading = `<div class="card m">Memuat…</div>`;
const sel = (id, opts, cur) => `<select id="${id}">${opts.map(o => `<option value="${o[0]}" ${o[0] == cur ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
// unggah gambar properti: diperkecil di browser (components/imageFile.js) lalu disimpan server di /media
async function upImg(key, input) {
  const f = input.files[0]; if (!f) return; R.toast.message = R.toast.error = ""; const sn = snap();
  try {
    const url = await shrinkImage(f, window);
    AD.images[key] = await uploadImage(API, url); R.toast.message = "Gambar diunggah. Klik Simpan untuk menerapkan.";
  } catch (e) { R.toast.error = e.message; } render(); restore(sn);
}

// Dashboard, Pengguna, Transaksi, Paket & Diskon dan Akun Admin: views/admin/*.js + AdminController (refactor MVC fase 8a)

// Studio + Detail Sesi: views/admin/studios.js, views/admin/sessions.js + StudioController (refactor MVC fase 8b)

// ---------- Booking: daftar + panel Detail Booking (Figma "Admin - Booking") ----------
const BSTAT = ["Menunggu Pembayaran", "Terbayar", "Sesi Berjalan", "Selesai", "Dibatalkan"], btag = s => ["Terbayar", "Selesai", "Sesi Berjalan"].includes(s) ? "ok" : s == "Dibatalkan" ? "no" : "warn";
const slotHm = slot => { const h = +String(slot).split(" ")[1].split(":")[0]; return `${String(h).padStart(2, "0")}:00 - ${String(h).padStart(2, "0")}:50`; }; // slot tetap 50 menit
V.abook = () => {
  const L = AD.bookings; if (!L) return loading; const rows = L.filter(b => match(b.customer, b.email, b.studio, b.package, b.slot)), d = AD.bookingDetail;
  return `<div class="bgrid ${d ? "open" : ""}"><div class="card"><div class="row sp"><select style="width:auto" aria-label="Saring status" onchange="AD.bookingFilter=this.value;AD.bookings=null;AD.bookingDetail=AD.bst=null;render()"><option value="">Semua status</option>${BSTAT.map(s => `<option ${AD.bookingFilter == s ? "selected" : ""}>${s}</option>`).join("")}</select><span class="m sm">${rows.length} booking</span></div>
<div class="tbl" style="margin-top:8px"><table><tr><th>#</th><th>Pelanggan</th><th>Studio</th><th class="bx">Paket</th><th>Jadwal</th><th class="bx">Total</th><th>Status</th><th class="bx">Bayar</th><th></th></tr>${rows.map(b => `<tr class="${d && d.id == b.id ? "on" : ""}"><td>${b.id}</td><td>${esc(b.customer)}<br><small class="m">${esc(b.email)}</small></td><td>${esc(b.studio)}</td><td class="bx">${esc(b.package)}</td><td>${b.slot}</td><td class="bx">${rp(b.amount)}</td><td><span class="tag ${btag(b.status)}">${b.status}</span>${b.cancel_reason ? `<br><small class="m">${esc(b.cancel_reason)}</small>` : ""}</td><td class="bx">${PAYLBL[b.pay_status] || "-"}${b.method ? `<br><small class="m">${esc(b.method)}</small>` : ""}</td>
<td><button class="btn sm ${d && d.id == b.id ? "" : "ghost"}" onclick="openBook(${b.id})" aria-label="Detail booking #${b.id}">Detail</button></td></tr>`).join("") || `<tr><td colspan="9" class="m">Tidak ada booking.</td></tr>`}</table></div></div>${d ? bookPanel(d) : ""}</div>`;
};
function bookPanel(d) {
  const p = d.payment, ss = d.studio_session;
  return `<aside class="card bdet" aria-label="Detail booking #${d.id}"><div class="row sp"><h3 class="h3">Detail Booking #${d.id}</h3><div class="row" style="gap:6px">${d.delete_block ? "" : `<button class="ibtn del" onclick="bookDel(${d.id})" title="Hapus booking" aria-label="Hapus booking #${d.id}">${ic("trash", 18)}</button>`}<button class="ib" onclick="AD.bookingDetail=null;render()" title="Tutup" aria-label="Tutup detail">✕</button></div></div>
${kvs([["Tanggal", d.slot.split(" ")[0]], ["Pelanggan", `${esc(d.customer.name)}<br><small class="m">${esc(d.customer.email)} · ${esc(d.customer.phone)}</small>`], ["Studio", esc(d.studio_name)], ["Sesi", slotHm(d.slot) + (ss ? `<br><small class="m">Sesi studio ${ss.date} ${ss.start} - ${ss.end}${ss.deleted ? " (dihapus)" : ""}</small>` : "")], ["Paket", esc(d.package_name)], ["Status", `<span class="tag ${btag(d.status)}">${d.status}</span>${d.cancel_reason ? `<br><small class="m">${esc(d.cancel_reason)}${d.cancel_detail ? ": " + esc(d.cancel_detail) : ""}</small>` : ""}`], ["Dipesan", fmtTime(d.created_at)]])}
${bookEdit(d)}<h4 class="bh">Detail Pembayaran</h4>${kvs([["Invoice", esc(d.invoice)], ["Waktu", fmtTime(p.paid_at)], ["Status", PAYLBL[p.status] || esc(p.status)], ["Metode", esc(p.method || "-")], ...(p.refunded_at ? [["Refund", fmtTime(p.refunded_at)]] : []), ...(p.status == "pending" ? [["Batas bayar", fmtTime(p.expire_at)]] : []),
  ["Paket", rp(d.items_price)], ["Biaya Studio", rp(d.studio_fee)], ...(d.main_disc ? [["Diskon utama", "-" + rp(d.main_disc), "disc"]] : []), ["Total", rp(d.amount), "total"]])}
${d.delete_block ? `<p class="sm m" style="margin-top:10px">${esc(d.delete_block)}.</p>` : ""}</aside>`;
}
// ubah booking (US-15, Figma "Admin - Edit Booking"): paket hanya sebelum dibayar, status hanya ke tujuan yang diizinkan server (d.allowed)
function bookEdit(d) {
  const canP = d.status == "Menunggu Pembayaran"; if (!canP && !d.allowed.length) return ""; const cur = AD.bst && [d.status, ...d.allowed].includes(AD.bst) ? AD.bst : d.status, pk = !canP ? [{ id: d.package_id, name: d.package_name, price: null }] : d.packages.some(p => p.id == d.package_id) ? d.packages : [{ id: d.package_id, name: d.package_name + " (nonaktif)", price: null }, ...d.packages]; // daftar paket aktif terbaru dari server
  return `<h4 class="bh">Ubah Booking</h4><fieldset class="brad"><legend class="sm m">Status Booking</legend>${[d.status, ...d.allowed].map(s => `<label><input type="radio" name="bst" value="${s}" ${s == cur ? "checked" : ""} onchange="AD.bst=this.value"> ${s}${s == d.status ? " (sekarang)" : ""}</label>`).join("")}</fieldset>
${d.allowed.includes("Dibatalkan") && d.payment.status == "paid" ? `<p class="sm m" style="margin-top:6px">Mengubah status booking yang sudah dibayar menjadi Dibatalkan akan mengembalikan dana 100% kepada pelanggan.</p>` : ""}
<label class="sm m" for="be-pkg" style="display:block;margin-top:12px">Paket</label><select id="be-pkg" ${canP ? "" : "disabled"}>${pk.map(p => `<option value="${p.id}" ${p.id == d.package_id ? "selected" : ""}>${esc(p.name)}${p.price == null ? "" : " · " + rp(p.price)}</option>`).join("")}</select>
<p class="sm m" style="margin-top:6px">Paket hanya dapat diubah sebelum booking dibayar${canP ? "; total dihitung ulang (paket + biaya studio − diskon)" : ""}.</p><button class="btn sm" style="margin-top:10px;width:100%" onclick="bookSave(${d.id})">Simpan Perubahan</button>`;
}
const bookSave = id => { const d = AD.bookingDetail; if (!d || d.id != id) return; const st = ($('input[name="bst"]:checked') || {}).value || d.status, pk = +val("be-pkg") || d.package_id, body = {};
  if (pk != d.package_id) body.package_id = pk; if (st != d.status) body.status = st; if (!Object.keys(body).length) { R.toast.message = ""; R.toast.error = "Tidak ada perubahan."; return render(); }
  aDo(async () => {
    if (st == "Dibatalkan" && !await aModal("Batalkan booking ini?", `Booking ${esc(d.studio_name)} · ${d.slot.split(" ")[0]} · ${slotHm(d.slot)} atas nama ${esc(d.customer.name)} diubah menjadi Dibatalkan. ${d.payment.status == "paid" ? `Dana ${rp(d.payment.amount)} akan dikembalikan 100% kepada pelanggan dan sesinya dibuka kembali.` : "Booking belum dibayar, jadi tidak ada dana yang dikembalikan; sesinya dibuka kembali."} Pelanggan menerima email pemberitahuan.`, "Ya, Batalkan Booking")) return;
    if (["Sesi Berjalan", "Selesai"].includes(st) && !await aModal(`Ubah status menjadi ${st}?`, `${st == "Sesi Berjalan" ? "Timer sesi foto booking ini langsung dimulai." : "Booking ditandai selesai dan sesi fotonya diakhiri."} Status tidak dapat dikembalikan. Pelanggan menerima email pemberitahuan.`, "Ya, Ubah Status")) return;
    const r = await API.request("PATCH", "/admin/bookings/" + id, body).catch(e => bookFail(id, e)); bookAfter(); AD.bookingDetail = r; AD.bst = null;
    if (r.refund && r.refund.state == "failed") R.toast.error = "Booking dibatalkan, tetapi refund gagal. Tindak lanjuti secara manual."; else R.toast.message = "Booking diperbarui." + (r.refund && r.refund.state == "refunded" ? ` Dana ${rp(r.refund.amount)} dikembalikan 100%.` : "") + (r.notified ? " Pelanggan diberi tahu lewat email." : ""); }); };
V.abook_after = () => aLoad("bookings", async () => { const L = await API.get("/admin/bookings?status=" + encodeURIComponent(AD.bookingFilter)); const id = AD.bookingDetail && AD.bookingDetail.id; if (id) { const d = await API.get("/admin/bookings/" + id).catch(() => null); if (AD.bookingDetail && AD.bookingDetail.id == id) AD.bookingDetail = d; } return L; }, []); // panel detail ikut diperbarui (booking bisa berubah/terhapus dari halaman lain)
const openBook = id => aDo(async () => { AD.bst = null; AD.bookingDetail = await API.get("/admin/bookings/" + id); if (innerWidth <= 1000) setTimeout(() => { const e = $(".bdet"); if (e) e.scrollIntoView({ behavior: "smooth", block: "start" }); }); });

// hapus booking (US-16): dialog Figma "Konfirmasi Hapus Booking" berisi status dan dana yang dikembalikan
const bookFail = async (id, e) => { AD.bookingDetail = await API.get("/admin/bookings/" + id).catch(() => null); AD.bookings = null; throw e; }; // aksi gagal (mis. booking berubah sementara itu): tampilkan detail terbaru
const bookAfter = () => { AD.bookings = AD.revenue = AD.operations = AD.transactions = AD.studios = AD.customers = AD.customerDetail = null; AD.sessions = {}; }; // sesi studio tertaut & ringkasan ikut berubah
const bookDelText = d => i => `Booking ${esc(d.studio_name)} · ${d.slot.split(" ")[0]} · ${slotHm(d.slot)} atas nama ${esc(d.customer.name)}. Status booking: ${esc(i.status)} (${i.paid ? "sudah dibayar" : "belum dibayar"}). ${i.paid ? `Dana ${rp(i.refund_amount)} akan dikembalikan 100% lebih dulu, lalu booking dihapus dan sesinya dibuka kembali.` : i.status == "Dibatalkan" ? "Booking akan dihapus dari riwayat." : "Booking akan langsung dihapus dan sesinya dibuka kembali."}${["Menunggu Pembayaran", "Terbayar"].includes(i.status) ? " Pelanggan menerima email pemberitahuan." : ""} Tindakan ini tidak dapat dibatalkan.`;
const bookDel = id => { const d = AD.bookingDetail; if (!d || d.id != id) return;
  aDo(async () => { const r = await aConfirmDel("/admin/bookings/" + id, "Hapus booking ini?", bookDelText(d), "Ya, Hapus Booking", d.impact).catch(e => bookFail(id, e)); if (!r) return; bookAfter();
    if (r.kept) { AD.bookingDetail = await API.get("/admin/bookings/" + id).catch(() => null); R.toast.error = r.message + "."; } else { AD.bookingDetail = null; R.toast.message = r.refund == "refunded" ? `Booking dihapus. Dana ${rp(r.refund_amount)} dikembalikan 100%.` : "Booking dihapus."; } }); };

// ---------- Properti ----------
const CATS = ["Background", "Topi", "Rompi", "Kalung", "Kacamata", "Lainnya"];
const pthumb = (p, k) => { const img = AD.images[k] || p.img; return `<label class="pthumb" style="${img ? bgi(img) : ""}">${img ? "" : ic("upload", 20)}<input type="file" accept="image/*" hidden onchange="upImg('${k}',this)"></label>`; };
const propRow = p => { const id = p.id || "N", k = "p" + id; return `<tr><td>${pthumb(p, k)}</td><td><input id="pr${id}n" value="${esc(p.name || "")}" placeholder="Nama properti"></td><td>${sel("pr" + id + "c", CATS.map(c => [c, c]), p.category || "Topi")}</td><td><input id="pr${id}q" type="number" min="0" value="${p.qty ?? 1}" style="width:80px"></td>
<td style="white-space:nowrap"><button class="btn sm" onclick="propSave(${p.id || 0})">${p.id ? "Simpan" : "+ Tambah"}</button>${p.id ? ` <button class="btn sm ghost" onclick="propDel(${p.id})">Hapus</button>` : ""}</td></tr>`; };
V.aprop = () => { const L = AD.properties; if (!L) return loading; return `<div class="card"><div class="tbl"><table><tr><th>Foto</th><th>Nama</th><th>Kategori</th><th>Qty</th><th></th></tr>${L.filter(p => match(p.name, p.category)).map(propRow).join("")}${propRow({})}</table></div><p class="sm m" style="margin-top:8px">Qty 0 = properti ditampilkan "Habis" di halaman studio. Kategori "Background" menjadi background, selain itu aksesori.</p></div>`; };
V.aprop_after = () => aLoad("properties", () => API.get("/admin/properties"), []);
const propBody = id => { const n = id || "N", b = { name: val(`pr${n}n`), category: val(`pr${n}c`), qty: +val(`pr${n}q`) }; if (AD.images["p" + n]) b.img = AD.images["p" + n]; return b; };
const propReload = async () => { AD.properties = null; M.properties = (await API.get("/master")).PROP; };
const propSave = id => aDo(async () => { const b = propBody(id); if (id) await API.patch("/admin/properties/" + id, b); else await API.post("/admin/properties", b); delete AD.images["p" + (id || "N")]; await propReload(); }, "Properti disimpan.");
const propDel = id => confirm("Hapus properti ini?") && aDo(async () => { await API.del("/admin/properties/" + id); await propReload(); }, "Properti dihapus.");

// ---------- Pose ----------
const poseRow = p => { const id = p.id || "N"; return `<tr><td><input id="po${id}n" value="${esc(p.nama || "")}" placeholder="Nama / deskripsi pose" style="min-width:260px"></td><td>${sel("po" + id + "r", M.peopleRanges.map(x => [x.id, x.range + " orang"]), p.people_range_id || 1)}</td><td style="white-space:nowrap"><button class="btn sm" onclick="poseSave(${p.id || 0})">${p.id ? "Simpan" : "+ Tambah"}</button>${p.id ? ` <button class="btn sm ghost" onclick="poseDel(${p.id})">Hapus</button>` : ""}</td></tr>`; };
V.apose = () => { const L = AD.poses; if (!L) return loading; return `<div class="card"><div class="tbl"><table><tr><th>Pose</th><th>Jumlah orang</th><th></th></tr>${L.filter(p => match(p.nama)).map(poseRow).join("")}${poseRow({})}</table></div></div>`; };
V.apose_after = () => aLoad("poses", () => API.get("/admin/poses"), []);
const poseSave = id => aDo(async () => { const n = id || "N", b = { nama: val(`po${n}n`), people_range_id: +val(`po${n}r`) }; if (id) await API.patch("/admin/poses/" + id, b); else await API.post("/admin/poses", b); AD.poses = null; }, "Pose disimpan.");
const poseDel = id => confirm("Hapus pose ini?") && aDo(async () => { await API.del("/admin/poses/" + id); AD.poses = null; }, "Pose dihapus.");

export { AD, bookDel, bookSave, loading, openBook, poseDel, poseSave, propDel, propSave, pthumb, sel, upImg };
