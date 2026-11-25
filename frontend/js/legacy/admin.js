// ===== PANEL ADMIN: Dashboard, Pengguna, Studio, Booking, Properti, Pose, Transaksi, Paket & Diskon =====
import { API, CONTROLLERS, M, R, V } from "./state.js";
import { createAdminState } from "../controllers/AdminController.js";
import { uploadImage } from "../models/admin/uploads.js";
import { esc, raw } from "../core/html.js";
import { formatDate as fmtDate, formatTime as fmtTime, padTwo as pad, formatRupiah as rp, todayIso as todayS } from "../core/format.js";
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
const aAuthErr = (e, what) => CONTROLLERS.admin.handleAccessError(e, what);
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
// unggah gambar: diperkecil di browser (maks 1000px, JPEG) lalu disimpan server di /media
async function upImg(key, input) {
  const f = input.files[0]; if (!f) return; R.toast.message = R.toast.error = ""; const sn = snap();
  try {
    const url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const sc = Math.min(1, 1000 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", .85)); }; im.onerror = () => no(new Error("File bukan gambar")); im.src = r.result; }; r.onerror = () => no(new Error("Gagal membaca file")); r.readAsDataURL(f); });
    AD.imgs[key] = await uploadImage(API, url); if (key === "sN") AD.sterr = null; R.toast.message = key === "sN" ? "Gambar diunggah." : "Gambar diunggah. Klik Simpan untuk menerapkan.";
  } catch (e) { R.toast.error = e.message; } render(); restore(sn);
}

// Dashboard, Pengguna dan Transaksi: views/admin/*.js + AdminController (refactor MVC fase 8a)

// ---------- Studio (accordion) ----------
// galat isian Tambah Studio (Figma 592:5056 Input Tidak Valid, 592:5140 Nama Sudah Digunakan)
const ST_BAD = "Input studio tidak valid. Periksa field yang ditandai.", ST_DUP = "Nama studio sudah digunakan oleh studio lain.", ST_DUPF = "Nama studio sudah digunakan. Gunakan nama lain.";
const fErr = (e, f) => e && e[f] ? `<p class="ferr" id="ste_${f}">${esc(e[f])}</p>` : "", fInv = (e, f) => e && e[f] ? ` aria-invalid="true" aria-describedby="ste_${f}"` : "";
function studioForm(s) {
  const k = "s" + (s.id || "N"), img = AD.imgs[k] || s.img || "", id = s.id || "N", e = s.id ? null : AD.sterr;
  return `<div class="body one"><div class="spanel"><h4>${s.id ? "Detail Studio" : "Detail Studio Baru"}</h4>${s.id ? "" : `<p class="sm m" style="margin-bottom:10px">Isi data studio. Nama dan gambar wajib diisi, dan nama tidak boleh sama dengan studio lain.</p>${e ? `<div class="ferr-top" role="alert">${ic("alert", 18)}<span>${esc(e.top)}${e.other ? ` (${esc(e.other)})` : ""}</span></div>` : ""}`}<div class="sgrid"><div><label for="st${id}n">Nama</label><input id="st${id}n" class="${e && e.name ? "inv" : ""}" placeholder="Contoh: Studio Kreatif" value="${esc(s.name || "")}"${fInv(e, "name")}>${fErr(e, "name")}<label>Status</label>${sel("st" + id + "s", [["AVAILABLE", "Tersedia"], ["UNAVAILABLE", "Tidak tersedia"]], s.status || "AVAILABLE")}<label>Deskripsi</label><textarea id="st${id}d">${esc(s.description || "")}</textarea><label>Alamat / Lokasi</label><input id="st${id}a" value="${esc(s.address || "Jl. Veteran No. 3")}">
<div class="row" style="flex-wrap:nowrap"><div class="grow"><label for="st${id}p">Biaya sewa studio (Rp)</label><input id="st${id}p" type="number" min="0" step="1" class="${e && e.price ? "inv" : ""}" value="${s.price ?? 0}"${fInv(e, "price")}>${fErr(e, "price")}</div><div class="grow"><label>Kapasitas</label>${sel("st" + id + "r", M.peopleRanges.map(p => [p.id, p.range + " orang"]), s.people_range_id || 1)}</div><div class="grow"><label>Rentang budget</label>${sel("st" + id + "b", M.budgetRanges.map(p => [p.id, p.budget]), s.budget_range_id || 1)}</div></div></div>
<div><label>Gambar</label><div class="thumb ${e && e.img ? "inv" : ""}" style="${bgi(img)}">${img ? "" : "Belum ada gambar"}</div>${fErr(e, "img")}<div class="row" style="margin-top:10px"><label class="btn sm soft" style="margin:0">${ic("upload", 16)} ${img && !s.id ? "Ganti gambar" : "Unggah gambar"}<input type="file" accept="image/*" hidden onchange="upImg('${k}',this)"></label></div>
<div class="row" style="margin-top:18px">${s.id ? `<button class="btn" onclick="studioSave(${s.id})">Simpan</button>` : `<button class="btn ghost" onclick="stCancel()">Batal</button><button class="btn" onclick="stReview()">Lihat Ringkasan</button>`}</div>${s.id ? `<p class="sm m" style="margin-top:8px">${s.active_bookings} booking aktif dari ${s.bookings} booking (tanpa yang batal) · status Tidak tersedia menyembunyikan studio dari customer tanpa mengubah booking yang sudah ada</p>` : ""}</div></div></div>${s.id ? sessPanel(s) : ""}</div>`;
}
V.astudio = () => {
  const L = AD.studios; if (!L) return loading;
  const tog = id => `AD.open[${id}]=!AD.open[${id}];render()`, on = s => s.status != "UNAVAILABLE";
  return stDone() + L.filter(s => match(s.name, s.description, s.address)).map(s => `<div class="acc"><div class="acc-h"><button class="acc-t" onclick="${tog(s.id)}" aria-expanded="${!!AD.open[s.id]}"><span>${esc(s.name)}</span><span class="tag ${on(s) ? "ok" : "off"}">${on(s) ? "Tersedia" : "Tidak tersedia"}</span><span class="meta">${rp(s.price || 0)} · ${s.sessions} sesi${s.address ? " · " + esc(s.address) : ""}</span></button>
<button class="ibtn del" onclick="studioDel(${s.id})" title="Hapus studio" aria-label="Hapus ${esc(s.name)}">${ic("trash", 18)}</button><button class="ibtn" onclick="${tog(s.id)}" aria-label="Buka/tutup detail" aria-expanded="${!!AD.open[s.id]}">${ic(AD.open[s.id] ? "up" : "down", 20)}</button></div>${AD.open[s.id] ? studioForm(s) : ""}</div>`).join("")
    + `<div class="acc"><button onclick="AD.open.N=!AD.open.N;AD.stdone=null;render()" aria-expanded="${!!AD.open.N}"><span>${ic("plus", 18)} Tambah studio${AD.open.N && AD.stsum ? " · Ringkasan" : ""}</span>${ic(AD.open.N ? "up" : "down", 20)}</button>${AD.open.N ? (AD.stsum && AD.stnew ? stSummary() : studioForm(AD.stnew || {})) : ""}</div>`;
};
// toast Berhasil (Figma 592:4689): tampil di halaman Studio sampai aksi admin berikutnya
const stDone = () => AD.stdone ? `<div class="toast okc" role="status">${ic("check", 20)}<div><b>${esc(AD.stdone.title)}</b><small>${esc(AD.stdone.text)}</small></div></div>` : "";
V.astudio_after = () => { aLoad("studios", () => API.get("/admin/studios"), []); (AD.studios || []).forEach(s => { if (AD.open[s.id]) sessLoad(s.id); }); };
const masterReload = async () => { const m = await API.get("/master"); M.studios = m.STUDIOS; M.allStudios = m.ALLSTUDIOS || m.STUDIOS; };
const stRead = n => { const p = val(`st${n}p`); return { name: val(`st${n}n`), status: val(`st${n}s`), description: val(`st${n}d`), address: val(`st${n}a`), price: p === "" ? 0 : +p, people_range_id: +val(`st${n}r`), budget_range_id: +val(`st${n}b`) }; };
const studioSave = id => aDo(async () => { const k = "s" + id, b = stRead(id); b.price = b.price || 0; if (AD.imgs[k]) b.img = AD.imgs[k];
  await API.patch("/admin/studios/" + id, b); delete AD.imgs[k]; AD.studios = null; await masterReload(); }, "Studio disimpan.", "Hanya admin yang dapat mengubah studio."); // ubah studio: satu langkah
// Tambah Studio: form -> Ringkasan Studio (Figma 592:4329) -> Berhasil (592:4689). Validasi lokal = aturan server + gambar wajib (Figma); server tetap penentu akhir
function stReview() {
  const b = stRead("N"), nm = String(b.name || "").trim(), e = {}; R.toast.message = R.toast.error = ""; AD.stdone = null; AD.stnew = b;
  if (!nm) e.name = "Nama studio wajib diisi."; else if ((AD.studios || []).some(s => String(s.name).trim().toLowerCase() === nm.toLowerCase())) e.name = ST_DUPF;
  if (!Number.isInteger(b.price) || b.price < 0) e.price = "Biaya sewa harus bilangan bulat 0 atau lebih.";
  if (!AD.imgs.sN) e.img = "Gambar studio wajib diunggah.";
  if (Object.keys(e).length) AD.sterr = { top: e.name === ST_DUPF && Object.keys(e).length === 1 ? ST_DUP : ST_BAD, ...e }; else { AD.sterr = null; AD.stsum = true; }
  render(); if (AD.sterr) { const f = $(".amain .inv"); if (f && f.focus) f.focus(); }
}
const stCancel = () => { AD.stnew = AD.stsum = AD.sterr = null; delete AD.imgs.sN; AD.open.N = false; R.toast.message = R.toast.error = ""; render(); };
const stEdit = () => { AD.stsum = null; render(); }; // kembali ke form, isian tetap (AD.stnew + gambar di AD.imgs.sN)
function stSummary() {
  const b = AD.stnew, img = AD.imgs.sN, pr = M.peopleRanges.find(p => p.id == b.people_range_id), bu = M.budgetRanges.find(p => p.id == b.budget_range_id), row = (t, v) => `<dt>${t}</dt><dd>${v}</dd>`;
  return `<div class="body one"><div class="spanel"><h4>Ringkasan Studio</h4><p class="sm m" style="margin-bottom:12px">Periksa data studio baru sebelum disimpan. Pilih Ubah untuk memperbaiki isian.</p><div class="sgrid"><dl class="sumdl">
${row("Nama", esc(b.name.trim()))}${row("Deskripsi", esc(b.description) || "-")}${row("Status", b.status == "UNAVAILABLE" ? "Tidak tersedia" : "Tersedia")}${row("Alamat / Lokasi", esc(b.address) || "-")}${row("Biaya sewa studio", rp(b.price))}${row("Kapasitas", pr ? esc(pr.range) + " orang" : "-")}${row("Rentang budget", bu ? esc(bu.budget) : "-")}</dl>
<div><div class="thumb" style="${bgi(img)}" role="img" aria-label="Gambar ${esc(b.name.trim())}"></div></div></div>
<div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn ghost" onclick="stEdit()">${ic("edit", 16)} Ubah</button><button class="btn" onclick="stSave()">Simpan Studio</button></div></div></div>`;
}
const stSave = () => aDo(async () => { const b = { ...AD.stnew, name: AD.stnew.name.trim(), img: AD.imgs.sN }; let r;
  try { r = await API.post("/admin/studios", b); } catch (e) { // galat server: kembali ke form dengan pesannya
    if (e.status == 409 && /sudah dipakai/.test(e.message)) { AD.sterr = { top: ST_DUP, name: ST_DUPF }; AD.studios = null; } // daftar dimuat ulang: studio bernama sama ikut tampil
    else if (e.status == 400) AD.sterr = /Nama/.test(e.message) ? { top: ST_BAD, name: "Nama studio wajib diisi." } : /Angka/.test(e.message) ? { top: ST_BAD, price: "Biaya sewa harus bilangan bulat 0 atau lebih." } : { top: ST_BAD, other: e.message };
    else throw e; AD.stsum = null; return; }
  delete AD.imgs.sN; AD.open.N = false; AD.open[r.id] = true; AD.stnew = AD.stsum = AD.sterr = null;
  AD.stdone = { title: "Studio berhasil ditambahkan", text: b.status == "UNAVAILABLE" ? `${b.name} disimpan dengan status Tidak tersedia, belum tampil di daftar studio pelanggan.` : `${b.name} tersedia dan tampil di daftar studio pelanggan.` };
  AD.studios = null; await masterReload(); }, "", "Hanya admin yang dapat menambahkan studio.");
const studioImpactText = i => `Studio ini memiliki ${i.sessions} sesi dan ${i.active_bookings} booking aktif${i.paid_bookings ? ` (${i.paid_bookings} sudah dibayar, total refund ${rp(i.refund_total)})` : ""}. ${i.active_bookings ? "Setelah dikonfirmasi, seluruh booking aktif dibatalkan dan dana yang sudah dibayar dikembalikan 100% kepada pelanggan. " : ""}Studio beserta sesinya tidak lagi tampil, tetapi riwayat booking tetap tersimpan.`;
const studioDel = id => { const s = (AD.studios || []).find(x => x.id == id); if (!s) return;
  aDo(async () => { const r = await aConfirmDel("/admin/studios/" + id, `Hapus ${s.name}?`, studioImpactText, "Ya, Hapus Studio", s.impact); if (!r) return;
    AD.studios = AD.books = AD.transactions = AD.revenue = AD.operations = null; AD.sess = {}; delete AD.open[id]; await masterReload();
    R.toast.message = `Studio "${s.name}" dihapus.` + (r.cancelled ? ` ${r.cancelled} booking dibatalkan${r.refunded ? `, ${r.refunded} di-refund` : ""}${r.refund_failed ? `, ${r.refund_failed} refund gagal (tindak lanjuti manual di menu Transaksi)` : ""}.` : ""); }); };

// ---------- Sesi studio (panel "Detail Sesi" di accordion studio, Figma): kalender bulan + chip jam per hari ----------
const sMonth = sid => AD.scal[sid] || todayS().slice(0, 7), sDayOf = sid => AD.sday[sid] || todayS(), sKey = sid => sid + "|" + sMonth(sid);
async function sessLoad(sid) { const k = sKey(sid); if (AD.sess[k] || AD.loading["s" + k]) return; AD.loading["s" + k] = 1;
  try { AD.sess[k] = await API.get(`/admin/studios/${sid}/sessions?month=${sMonth(sid)}`); } catch (e) { if (aAuthErr(e)) { AD.loading["s" + k] = 0; return; } R.toast.error = e.message; AD.sess[k] = []; }
  AD.loading["s" + k] = 0; render(); }
const sNav = (sid, dir) => { let [y, m] = sMonth(sid).split("-").map(Number); m += dir; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } const mo = `${y}-${pad(m)}`; AD.scal[sid] = mo; AD.sday[sid] = todayS().startsWith(mo) ? todayS() : mo + "-01"; AD.sedit = AD.sadd = null; render(); }; // hari terpilih ikut pindah bulan
const sDay = (sid, ds) => { AD.sday[sid] = ds; AD.sedit = AD.sadd = null; render(); };
function sessCal(sid, L) {
  const [y, m] = sMonth(sid).split("-").map(Number), first = (new Date(y, m - 1, 1).getDay() + 6) % 7, dim = new Date(y, m, 0).getDate(), day = sDayOf(sid), today = todayS(); let cells = "<i></i>".repeat(first);
  for (let d = 1; d <= dim; d++) { const ds = `${y}-${pad(m)}-${pad(d)}`, n = L.filter(x => x.date == ds).length; cells += `<button class="cd ${ds == day ? "on" : ""} ${n ? "dot" : ""} ${ds == today ? "now" : ""}" onclick="sDay(${sid},'${ds}')" aria-label="${ds}${n ? `, ${n} sesi` : ""}" aria-pressed="${ds == day}">${d}</button>`; }
  return `<div class="cal"><div class="calh"><button class="ib" aria-label="Bulan sebelumnya" onclick="sNav(${sid},-1)">${ic("left", 16)}</button><b>${new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</b><button class="ib" aria-label="Bulan berikutnya" onclick="sNav(${sid},1)">${ic("right", 16)}</button></div>
<div class="calg">${["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(x => `<small>${x}</small>`).join("")}${cells}</div></div>`;
}
const sChip = x => `<button class="schip ${x.status == "UNAVAILABLE" ? "full" : ""} ${x.past ? "past" : ""} ${AD.sedit == x.id ? "on" : ""}" onclick="AD.sedit=${AD.sedit == x.id ? "null" : x.id};AD.sadd=null;render()" aria-expanded="${AD.sedit == x.id}">${x.start} - ${x.end}<small>${x.past ? "lewat" : x.booking && x.booking.status == "Sesi Berjalan" ? "Berlangsung" : x.status == "UNAVAILABLE" ? "Terisi" : "Tersedia"}${x.booking ? ` · #${x.booking.id} ${esc(x.booking.customer)}` : ""}</small></button>`;
function sessEdit(sid, x) {
  const b = x.booking, id = `se${x.id}`;
  return `<div class="sform"><div class="row sp"><b>Sesi ${x.date} · ${x.start} - ${x.end}</b><button class="ibtn del" onclick="sDel(${sid},${x.id})" title="Hapus sesi" aria-label="Hapus sesi ${x.start}">${ic("trash", 18)}</button></div>
<p class="sm m">${b ? `Booking #${b.id} · ${esc(b.customer)} · ${esc(b.status)}` : "Belum ada booking pada sesi ini."}</p>
${x.past || (b && b.status == "Sesi Berjalan") ? `<p class="sm m">${x.past ? "Sesi sudah lewat" : "Sesi foto sedang berlangsung"} sehingga tidak dapat diubah.</p>` : `<div class="srow"><div><label for="${id}d">Tanggal</label><input id="${id}d" type="date" value="${x.date}"></div><div><label for="${id}s">Mulai</label><input id="${id}s" type="time" value="${x.start}"></div><div><label for="${id}e">Selesai</label><input id="${id}e" type="time" value="${x.end}"></div></div>
<div class="row" style="margin-top:12px"><button class="btn sm" onclick="sSave(${sid},${x.id})">Simpan</button><button class="btn sm ghost" onclick="AD.sedit=null;render()">Tutup</button></div>`}</div>`;
}
function sessAdd(sid) { const id = `sa${sid}`;
  return `<div class="sform"><b>Tambah sesi</b><div class="srow"><div><label for="${id}d">Tanggal</label><input id="${id}d" type="date" min="${todayS()}" value="${sDayOf(sid) < todayS() ? todayS() : sDayOf(sid)}"></div><div><label for="${id}s">Mulai</label><input id="${id}s" type="time" value="09:00"></div><div><label for="${id}e">Selesai</label><input id="${id}e" type="time" value="09:50"></div><div><label for="${id}r">Berulang (hari)</label><input id="${id}r" type="number" min="1" max="30" value="1"></div></div>
<p class="sm m" style="margin-top:6px">Berulang 1 = hanya tanggal ini; lebih dari 1 = jam yang sama pada hari-hari berikutnya (tanggal yang bertabrakan dilewati).</p><div class="row" style="margin-top:12px"><button class="btn sm" onclick="sAdd(${sid})">Tambah</button><button class="btn sm ghost" onclick="AD.sadd=null;render()">Batal</button></div></div>`; }
function sessPanel(s) {
  const L = AD.sess[sKey(s.id)]; if (!L) return `<div class="spanel"><h4>Detail Sesi</h4><p class="m">Memuat…</p></div>`;
  const day = sDayOf(s.id), D = L.filter(x => x.date == day), ed = D.find(x => x.id == AD.sedit);
  return `<div class="spanel"><h4>Detail Sesi</h4><div class="ssgrid"><div>${sessCal(s.id, L)}</div><div><p class="sm m" style="margin-bottom:10px">${fmtDate(day)} · ${D.length} sesi</p>
<div class="schips">${D.map(sChip).join("")}<button class="schip add" onclick="AD.sadd=${AD.sadd == s.id ? "null" : s.id};AD.sedit=null;render()" aria-expanded="${AD.sadd == s.id}">${ic("plus", 16)} TAMBAH</button></div>
${D.length ? "" : `<p class="sm m" style="margin-top:10px">Belum ada sesi pada tanggal ini.</p>`}${ed ? sessEdit(s.id, ed) : ""}${AD.sadd == s.id ? sessAdd(s.id) : ""}</div></div></div>`;
}
// setelah perubahan: cache sesi studio dibuang, daftar studio (jumlah sesi, dampak hapus) dimuat ulang tanpa layar "Memuat"
const sRefresh = async sid => { Object.keys(AD.sess).forEach(k => { if (k.startsWith(sid + "|")) delete AD.sess[k]; }); AD.books = AD.transactions = AD.revenue = AD.operations = null; try { AD.studios = await API.get("/admin/studios"); } catch (e) { AD.studios = null; } }; // gagal muat ulang: daftar dimuat lagi saat render
const sFind = (sid, id) => (AD.sess[sKey(sid)] || []).find(x => x.id == id);
const sWho = i => i.customers && i.customers.length ? ` (${i.customers.map(esc).join(", ")})` : "";
const sAdd = sid => aDo(async () => { const id = `sa${sid}`, date = val(id + "d"), r = await API.post(`/admin/studios/${sid}/sessions`, { date, start: val(id + "s"), end: val(id + "e"), repeat: val(id + "r") === "" ? 1 : +val(id + "r") });
  AD.sadd = null; AD.sday[sid] = date; AD.scal[sid] = date.slice(0, 7); await sRefresh(sid);
  R.toast.message = r.created.length > 1 ? `${r.created.length} sesi berhasil ditambahkan.` : "Sesi berhasil ditambahkan."; if (r.skipped.length) R.toast.message += ` ${r.skipped.length} tanggal dilewati karena bertabrakan: ${r.skipped.join(", ")}.`; });
const sSave = (sid, sesId) => { const x = sFind(sid, sesId); if (!x) return; const id = `se${sesId}`, body = { date: val(id + "d"), start: val(id + "s"), end: val(id + "e") };
  const sn = snap(); let back = false;
  aDo(async () => { const r = await aConfirmReq("PATCH", "/admin/sessions/" + sesId, body, `Ubah sesi ${x.start} - ${x.end}?`, i => `Sesi ini memiliki ${i.active_bookings} booking aktif${sWho(i)}. Setelah dikonfirmasi, jadwal sesi diubah dan pelanggan menerima email berisi jadwal baru.`, "Ya, Ubah Sesi", x.impact, false); if (!r) { back = true; return; } // tanpa dialog awal: server memvalidasi jam dulu, dialog muncul hanya bila server meminta konfirmasi
    AD.sedit = null; AD.sday[sid] = r.date; AD.scal[sid] = r.date.slice(0, 7); await sRefresh(sid); R.toast.message = "Sesi berhasil diperbarui." + (r.notified ? ` Pelanggan dari ${r.notified} booking terdampak sudah diberi tahu lewat email.` : ""); }).then(() => { if (back) restore(sn); }); };
const sessImpactText = i => i.active_bookings ? `Sesi ini memiliki ${i.active_bookings} booking aktif${sWho(i)}${i.paid_bookings ? `, ${i.paid_bookings} sudah dibayar (total refund ${rp(i.refund_total)})` : ""}. Setelah dikonfirmasi, booking tersebut dibatalkan, dana yang sudah dibayar dikembalikan 100%, dan pelanggan diberi tahu lewat email.` : "Sesi ini belum memiliki booking aktif dan akan dihapus dari daftar sesi.";
const sDel = (sid, sesId) => { const x = sFind(sid, sesId); if (!x) return;
  aDo(async () => { const r = await aConfirmDel("/admin/sessions/" + sesId, `Hapus sesi ${x.date} ${x.start} - ${x.end}?`, sessImpactText, "Ya, Hapus Sesi", x.impact); if (!r) return;
    AD.sedit = null; await sRefresh(sid); R.toast.message = "Sesi dihapus." + (r.cancelled ? ` ${r.cancelled} booking dibatalkan${r.refunded ? `, ${r.refunded} di-refund` : ""}${r.refund_failed ? `, ${r.refund_failed} refund gagal (tindak lanjuti manual di menu Transaksi)` : ""}.` : ""); }); };

// ---------- Booking: daftar + panel Detail Booking (Figma "Admin - Booking") ----------
const BSTAT = ["Menunggu Pembayaran", "Terbayar", "Sesi Berjalan", "Selesai", "Dibatalkan"], btag = s => ["Terbayar", "Selesai", "Sesi Berjalan"].includes(s) ? "ok" : s == "Dibatalkan" ? "no" : "warn";
const slotHm = slot => { const h = +String(slot).split(" ")[1].split(":")[0]; return `${String(h).padStart(2, "0")}:00 - ${String(h).padStart(2, "0")}:50`; }; // slot tetap 50 menit
V.abook = () => {
  const L = AD.books; if (!L) return loading; const rows = L.filter(b => match(b.customer, b.email, b.studio, b.package, b.slot)), d = AD.bdet;
  return `<div class="bgrid ${d ? "open" : ""}"><div class="card"><div class="row sp"><select style="width:auto" aria-label="Saring status" onchange="AD.bstatus=this.value;AD.books=null;AD.bdet=AD.bst=null;render()"><option value="">Semua status</option>${BSTAT.map(s => `<option ${AD.bstatus == s ? "selected" : ""}>${s}</option>`).join("")}</select><span class="m sm">${rows.length} booking</span></div>
<div class="tbl" style="margin-top:8px"><table><tr><th>#</th><th>Pelanggan</th><th>Studio</th><th class="bx">Paket</th><th>Jadwal</th><th class="bx">Total</th><th>Status</th><th class="bx">Bayar</th><th></th></tr>${rows.map(b => `<tr class="${d && d.id == b.id ? "on" : ""}"><td>${b.id}</td><td>${esc(b.customer)}<br><small class="m">${esc(b.email)}</small></td><td>${esc(b.studio)}</td><td class="bx">${esc(b.package)}</td><td>${b.slot}</td><td class="bx">${rp(b.amount)}</td><td><span class="tag ${btag(b.status)}">${b.status}</span>${b.cancel_reason ? `<br><small class="m">${esc(b.cancel_reason)}</small>` : ""}</td><td class="bx">${PAYLBL[b.pay_status] || "-"}${b.method ? `<br><small class="m">${esc(b.method)}</small>` : ""}</td>
<td><button class="btn sm ${d && d.id == b.id ? "" : "ghost"}" onclick="openBook(${b.id})" aria-label="Detail booking #${b.id}">Detail</button></td></tr>`).join("") || `<tr><td colspan="9" class="m">Tidak ada booking.</td></tr>`}</table></div></div>${d ? bookPanel(d) : ""}</div>`;
};
function bookPanel(d) {
  const p = d.payment, ss = d.studio_session;
  return `<aside class="card bdet" aria-label="Detail booking #${d.id}"><div class="row sp"><h3 class="h3">Detail Booking #${d.id}</h3><div class="row" style="gap:6px">${d.delete_block ? "" : `<button class="ibtn del" onclick="bookDel(${d.id})" title="Hapus booking" aria-label="Hapus booking #${d.id}">${ic("trash", 18)}</button>`}<button class="ib" onclick="AD.bdet=null;render()" title="Tutup" aria-label="Tutup detail">✕</button></div></div>
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
const bookSave = id => { const d = AD.bdet; if (!d || d.id != id) return; const st = ($('input[name="bst"]:checked') || {}).value || d.status, pk = +val("be-pkg") || d.package_id, body = {};
  if (pk != d.package_id) body.package_id = pk; if (st != d.status) body.status = st; if (!Object.keys(body).length) { R.toast.message = ""; R.toast.error = "Tidak ada perubahan."; return render(); }
  aDo(async () => {
    if (st == "Dibatalkan" && !await aModal("Batalkan booking ini?", `Booking ${esc(d.studio_name)} · ${d.slot.split(" ")[0]} · ${slotHm(d.slot)} atas nama ${esc(d.customer.name)} diubah menjadi Dibatalkan. ${d.payment.status == "paid" ? `Dana ${rp(d.payment.amount)} akan dikembalikan 100% kepada pelanggan dan sesinya dibuka kembali.` : "Booking belum dibayar, jadi tidak ada dana yang dikembalikan; sesinya dibuka kembali."} Pelanggan menerima email pemberitahuan.`, "Ya, Batalkan Booking")) return;
    if (["Sesi Berjalan", "Selesai"].includes(st) && !await aModal(`Ubah status menjadi ${st}?`, `${st == "Sesi Berjalan" ? "Timer sesi foto booking ini langsung dimulai." : "Booking ditandai selesai dan sesi fotonya diakhiri."} Status tidak dapat dikembalikan. Pelanggan menerima email pemberitahuan.`, "Ya, Ubah Status")) return;
    const r = await API.request("PATCH", "/admin/bookings/" + id, body).catch(e => bookFail(id, e)); bookAfter(); AD.bdet = r; AD.bst = null;
    if (r.refund && r.refund.state == "failed") R.toast.error = "Booking dibatalkan, tetapi refund gagal. Tindak lanjuti secara manual."; else R.toast.message = "Booking diperbarui." + (r.refund && r.refund.state == "refunded" ? ` Dana ${rp(r.refund.amount)} dikembalikan 100%.` : "") + (r.notified ? " Pelanggan diberi tahu lewat email." : ""); }); };
V.abook_after = () => aLoad("books", async () => { const L = await API.get("/admin/bookings?status=" + encodeURIComponent(AD.bstatus)); const id = AD.bdet && AD.bdet.id; if (id) { const d = await API.get("/admin/bookings/" + id).catch(() => null); if (AD.bdet && AD.bdet.id == id) AD.bdet = d; } return L; }, []); // panel detail ikut diperbarui (booking bisa berubah/terhapus dari halaman lain)
const openBook = id => aDo(async () => { AD.bst = null; AD.bdet = await API.get("/admin/bookings/" + id); if (innerWidth <= 1000) setTimeout(() => { const e = $(".bdet"); if (e) e.scrollIntoView({ behavior: "smooth", block: "start" }); }); });

// hapus booking (US-16): dialog Figma "Konfirmasi Hapus Booking" berisi status dan dana yang dikembalikan
const bookFail = async (id, e) => { AD.bdet = await API.get("/admin/bookings/" + id).catch(() => null); AD.books = null; throw e; }; // aksi gagal (mis. booking berubah sementara itu): tampilkan detail terbaru
const bookAfter = () => { AD.books = AD.revenue = AD.operations = AD.transactions = AD.studios = AD.customers = AD.customerDetail = null; AD.sess = {}; }; // sesi studio tertaut & ringkasan ikut berubah
const bookDelText = d => i => `Booking ${esc(d.studio_name)} · ${d.slot.split(" ")[0]} · ${slotHm(d.slot)} atas nama ${esc(d.customer.name)}. Status booking: ${esc(i.status)} (${i.paid ? "sudah dibayar" : "belum dibayar"}). ${i.paid ? `Dana ${rp(i.refund_amount)} akan dikembalikan 100% lebih dulu, lalu booking dihapus dan sesinya dibuka kembali.` : i.status == "Dibatalkan" ? "Booking akan dihapus dari riwayat." : "Booking akan langsung dihapus dan sesinya dibuka kembali."}${["Menunggu Pembayaran", "Terbayar"].includes(i.status) ? " Pelanggan menerima email pemberitahuan." : ""} Tindakan ini tidak dapat dibatalkan.`;
const bookDel = id => { const d = AD.bdet; if (!d || d.id != id) return;
  aDo(async () => { const r = await aConfirmDel("/admin/bookings/" + id, "Hapus booking ini?", bookDelText(d), "Ya, Hapus Booking", d.impact).catch(e => bookFail(id, e)); if (!r) return; bookAfter();
    if (r.kept) { AD.bdet = await API.get("/admin/bookings/" + id).catch(() => null); R.toast.error = r.message + "."; } else { AD.bdet = null; R.toast.message = r.refund == "refunded" ? `Booking dihapus. Dana ${rp(r.refund_amount)} dikembalikan 100%.` : "Booking dihapus."; } }); };

// ---------- Properti ----------
const CATS = ["Background", "Topi", "Rompi", "Kalung", "Kacamata", "Lainnya"];
const pthumb = (p, k) => { const img = AD.imgs[k] || p.img; return `<label class="pthumb" style="${img ? bgi(img) : ""}">${img ? "" : ic("upload", 20)}<input type="file" accept="image/*" hidden onchange="upImg('${k}',this)"></label>`; };
const propRow = p => { const id = p.id || "N", k = "p" + id; return `<tr><td>${pthumb(p, k)}</td><td><input id="pr${id}n" value="${esc(p.name || "")}" placeholder="Nama properti"></td><td>${sel("pr" + id + "c", CATS.map(c => [c, c]), p.category || "Topi")}</td><td><input id="pr${id}q" type="number" min="0" value="${p.qty ?? 1}" style="width:80px"></td>
<td style="white-space:nowrap"><button class="btn sm" onclick="propSave(${p.id || 0})">${p.id ? "Simpan" : "+ Tambah"}</button>${p.id ? ` <button class="btn sm ghost" onclick="propDel(${p.id})">Hapus</button>` : ""}</td></tr>`; };
V.aprop = () => { const L = AD.props; if (!L) return loading; return `<div class="card"><div class="tbl"><table><tr><th>Foto</th><th>Nama</th><th>Kategori</th><th>Qty</th><th></th></tr>${L.filter(p => match(p.name, p.category)).map(propRow).join("")}${propRow({})}</table></div><p class="sm m" style="margin-top:8px">Qty 0 = properti ditampilkan "Habis" di halaman studio. Kategori "Background" menjadi background, selain itu aksesori.</p></div>`; };
V.aprop_after = () => aLoad("props", () => API.get("/admin/properties"), []);
const propBody = id => { const n = id || "N", b = { name: val(`pr${n}n`), category: val(`pr${n}c`), qty: +val(`pr${n}q`) }; if (AD.imgs["p" + n]) b.img = AD.imgs["p" + n]; return b; };
const propReload = async () => { AD.props = null; M.properties = (await API.get("/master")).PROP; };
const propSave = id => aDo(async () => { const b = propBody(id); if (id) await API.patch("/admin/properties/" + id, b); else await API.post("/admin/properties", b); delete AD.imgs["p" + (id || "N")]; await propReload(); }, "Properti disimpan.");
const propDel = id => confirm("Hapus properti ini?") && aDo(async () => { await API.del("/admin/properties/" + id); await propReload(); }, "Properti dihapus.");

// ---------- Pose ----------
const poseRow = p => { const id = p.id || "N"; return `<tr><td><input id="po${id}n" value="${esc(p.nama || "")}" placeholder="Nama / deskripsi pose" style="min-width:260px"></td><td>${sel("po" + id + "r", M.peopleRanges.map(x => [x.id, x.range + " orang"]), p.people_range_id || 1)}</td><td style="white-space:nowrap"><button class="btn sm" onclick="poseSave(${p.id || 0})">${p.id ? "Simpan" : "+ Tambah"}</button>${p.id ? ` <button class="btn sm ghost" onclick="poseDel(${p.id})">Hapus</button>` : ""}</td></tr>`; };
V.apose = () => { const L = AD.poses; if (!L) return loading; return `<div class="card"><div class="tbl"><table><tr><th>Pose</th><th>Jumlah orang</th><th></th></tr>${L.filter(p => match(p.nama)).map(poseRow).join("")}${poseRow({})}</table></div></div>`; };
V.apose_after = () => aLoad("poses", () => API.get("/admin/poses"), []);
const poseSave = id => aDo(async () => { const n = id || "N", b = { nama: val(`po${n}n`), people_range_id: +val(`po${n}r`) }; if (id) await API.patch("/admin/poses/" + id, b); else await API.post("/admin/poses", b); AD.poses = null; }, "Pose disimpan.");
const poseDel = id => confirm("Hapus pose ini?") && aDo(async () => { await API.del("/admin/poses/" + id); AD.poses = null; }, "Pose dihapus.");

// ---------- Paket dan diskon utama ----------
V.apkg = () => {
  const P = AD.packages, D = AD.discount; if (!P || !D) return loading;
  const inp = (id, v, t = "text", w = 90) => `<input id="${id}" type="${t}" value="${esc(v)}" ${t == "number" ? 'min="0"' : ""} style="width:${w}px">`;
  return `<div class="card" style="margin-bottom:16px"><h3 class="h3">Diskon utama</h3><p class="m sm">Potongan persen untuk harga semua paket (biaya studio tidak didiskon). Isi 0 untuk menonaktifkan.</p>
<div class="row" style="margin-top:8px"><input id="d_pct" type="number" min="0" max="100" value="${D.pct}" style="width:90px"> %<input id="d_lbl" placeholder="Label (mis. Promo Kemerdekaan)" value="${esc(D.label)}" style="flex:1;min-width:160px"><button class="btn" onclick="discSave()">Simpan</button></div></div>
<div class="card" style="margin-bottom:16px"><h3 class="h3">Paket</h3><div class="tbl"><table><tr><th>Nama</th><th>Harga (Rp)</th><th>Jml foto</th><th>Durasi (mnt)</th><th>Ukuran strip</th><th>Material</th><th>Status</th><th></th></tr>
${P.map(p => `<tr><td>${inp("pk" + p.id + "n", p.name)}</td><td>${inp("pk" + p.id + "p", p.price, "number", 110)}</td><td>${inp("pk" + p.id + "c", p.photo_count, "number", 70)}</td><td>${inp("pk" + p.id + "d", p.dur, "number", 70)}</td><td>${inp("pk" + p.id + "s", p.strip_size, "text", 70)}</td><td>${inp("pk" + p.id + "m", p.strip_material)}</td>
<td><span class="tag ${p.active ? "ok" : "no"}">${p.active ? "aktif" : "nonaktif"}</span></td><td style="white-space:nowrap"><button class="btn sm" onclick="pkSave(${p.id})">Simpan</button> ${p.active ? "" : `<button class="btn sm soft" onclick="pkActive(${p.id})">Aktifkan</button> `}<button class="btn sm ghost" onclick="pkDel(${p.id})">Hapus</button></td></tr>`).join("")}
<tr><td>${inp("pkNn", "")}</td><td>${inp("pkNp", "", "number", 110)}</td><td>${inp("pkNc", "", "number", 70)}</td><td>${inp("pkNd", "", "number", 70)}</td><td>${inp("pkNs", "", "text", 70)}</td><td>${inp("pkNm", "")}</td><td></td><td><button class="btn sm" onclick="pkAdd()">+ Tambah paket</button></td></tr></table></div>
<p class="sm m" style="margin-top:8px">Harga baru hanya berlaku untuk booking berikutnya. Paket yang pernah dibeli hanya dinonaktifkan agar riwayat tetap utuh.</p></div>`;
};
V.apkg_after = () => { aLoad("packages", () => API.get("/admin/packages"), []); aLoad("discount", () => API.get("/admin/discount"), { pct: 0, label: "" }); };
const pkBody = p => ({ name: val(`pk${p}n`), price: +val(`pk${p}p`), photo_count: +val(`pk${p}c`), dur: +val(`pk${p}d`), strip_size: val(`pk${p}s`), strip_material: val(`pk${p}m`) });
const pkSave = id => aDo(async () => { await API.patch("/admin/packages/" + id, pkBody(id)); AD.packages = null; }, "Paket disimpan. Harga baru berlaku untuk booking berikutnya.");
const pkAdd = () => aDo(async () => { await API.post("/admin/packages", pkBody("N")); AD.packages = null; }, "Paket baru ditambahkan.");
const pkActive = id => aDo(async () => { await API.patch("/admin/packages/" + id, { active: true }); AD.packages = null; }, "Paket diaktifkan.");
const pkDel = async id => await aModal("Konfirmasi Hapus Paket", "<p>Hapus paket ini? (Jika pernah dibeli, paket hanya dinonaktifkan.)</p>", "Ya, Hapus Paket") && aDo(async () => { const r = await API.del("/admin/packages/" + id); AD.packages = null; R.toast.message = r.deactivated ? "Paket pernah dibeli, jadi dinonaktifkan (riwayat tetap utuh)." : "Paket dihapus."; });
const discSave = () => aDo(async () => { await API.put("/admin/discount", { pct: +val("d_pct"), label: val("d_lbl") }); AD.discount = null; }, "Diskon utama disimpan.");

// ---------- Akun Admin (tersimpan di database; ganti username/password) ----------
V.aacct = () => {
  const me = AD.me || { username: "", must_change: false };
  return `<div class="card" style="max-width:560px"><h3 class="h3">Akun Admin</h3><p class="m sm" style="margin-top:4px">Akun admin tersimpan di database dengan password ter-hash. Password baru minimal 8 karakter dan mengandung huruf serta angka. Setelah password diganti, semua sesi admin lama otomatis keluar.</p>
<label>Username</label><input id="ac_u" value="${esc(me.username)}" autocomplete="username"><label>Password saat ini</label><input id="ac_c" type="password" autocomplete="current-password">
<label>Password baru ${me.must_change ? "(wajib)" : "(kosongkan jika tidak diganti)"}</label><input id="ac_n" type="password" autocomplete="new-password"><label>Ulangi password baru</label><input id="ac_n2" type="password" autocomplete="new-password">
<div class="row" style="margin-top:18px"><button class="btn" onclick="acctSave()">Simpan</button></div></div>`;
};
const acctSave = () => {
  const n = val("ac_n"), n2 = val("ac_n2"); if (n !== n2) { R.toast.error = "Pengulangan password baru tidak sama."; R.toast.message = ""; return render(); }
  if (AD.me && AD.me.must_change && !n) { R.toast.error = "Password baru wajib diisi."; R.toast.message = ""; return render(); }
  return aDo(async () => { const r = await API.patch("/admin/account", { current_password: val("ac_c"), username: val("ac_u"), new_password: n || undefined }); API.token = r.token; localStorage.setItem("snapia_t", r.token); AD.me = { username: r.username, must_change: false }; }, "Akun admin diperbarui.");
};
export { AD, acctSave, bookDel, bookSave, discSave, loading, openBook, pkActive, pkAdd, pkDel, pkSave, poseDel, poseSave, propDel, propSave, pthumb, sAdd, sDay, sDel, sNav, sSave, sel, stCancel, stEdit, stReview, stSave, studioDel, studioSave, upImg };
