// ===== PANEL ADMIN (sisa kode lama, fase 8b): Studio + Sesi, Booking, Properti, Pose =====
import { API, CONTROLLERS, M, R, V } from "./state.js";
import { createAdminState } from "../controllers/AdminController.js";
import { uploadImage } from "../models/admin/uploads.js";
import { shrinkImage } from "../components/imageFile.js";
import { esc, raw } from "../core/html.js";
import { $, ic, modal, render } from "./core.js";
import { backgroundImage as bgi } from "../components/propertyVisual.js";
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

// Booking: views/admin/bookings.js + AdminBookingController (refactor MVC fase 8b)

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
// hapus lewat modal bersama (dulu confirm() bawaan browser, decisions.md 4, 27)
const aConfirm = (title, text, okLabel) => CONTROLLERS.admin.confirm({ title, body: raw(`<p>${text}</p>`), okLabel });
const propDel = async id => { if (await aConfirm("Konfirmasi Hapus Properti", "Hapus properti ini?", "Ya, Hapus Properti")) aDo(async () => { await API.del("/admin/properties/" + id); await propReload(); }, "Properti dihapus."); };

// ---------- Pose ----------
const poseRow = p => { const id = p.id || "N"; return `<tr><td><input id="po${id}n" value="${esc(p.nama || "")}" placeholder="Nama / deskripsi pose" style="min-width:260px"></td><td>${sel("po" + id + "r", M.peopleRanges.map(x => [x.id, x.range + " orang"]), p.people_range_id || 1)}</td><td style="white-space:nowrap"><button class="btn sm" onclick="poseSave(${p.id || 0})">${p.id ? "Simpan" : "+ Tambah"}</button>${p.id ? ` <button class="btn sm ghost" onclick="poseDel(${p.id})">Hapus</button>` : ""}</td></tr>`; };
V.apose = () => { const L = AD.poses; if (!L) return loading; return `<div class="card"><div class="tbl"><table><tr><th>Pose</th><th>Jumlah orang</th><th></th></tr>${L.filter(p => match(p.nama)).map(poseRow).join("")}${poseRow({})}</table></div></div>`; };
V.apose_after = () => aLoad("poses", () => API.get("/admin/poses"), []);
const poseSave = id => aDo(async () => { const n = id || "N", b = { nama: val(`po${n}n`), people_range_id: +val(`po${n}r`) }; if (id) await API.patch("/admin/poses/" + id, b); else await API.post("/admin/poses", b); AD.poses = null; }, "Pose disimpan.");
const poseDel = async id => { if (await aConfirm("Konfirmasi Hapus Pose", "Hapus pose ini?", "Ya, Hapus Pose")) aDo(async () => { await API.del("/admin/poses/" + id); AD.poses = null; }, "Pose dihapus."); };

export { AD, loading, poseDel, poseSave, propDel, propSave, pthumb, sel, upImg };
