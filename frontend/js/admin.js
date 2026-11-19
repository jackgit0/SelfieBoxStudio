// ===== PANEL ADMIN: Dashboard, Pengguna, Studio, Booking, Properti, Pose, Transaksi, Paket & Diskon =====
const AD = { loading: {}, imgs: {}, open: {}, q: "", opPeriod: "month", opEdit: null, cdet: null, bdet: null, bstatus: "", scal: {}, sday: {}, sess: {}, sedit: null, sadd: null };
function adminReset() { Object.keys(AD).forEach(k => { if (!["loading", "imgs", "open"].includes(k) && !["q", "opPeriod", "bstatus"].includes(k)) AD[k] = null; }); AD.q = ""; AD.opPeriod = "month"; AD.bstatus = ""; AD.imgs = {}; AD.open = {}; AD.loading = {}; AD.scal = {}; AD.sday = {}; AD.sess = {}; }
const AMENU = [["adash", "Dashboard", "dash"], ["acust", "Pengguna", "users"], ["astudio", "Studio", "studio"], ["abook", "Booking", "calendar"], ["aprop", "Properti", "glasses"], ["apose", "Pose", "run"], ["atrx", "Transaksi", "card"], ["apkg", "Paket & Diskon", "tag"], ["aacct", "Akun Admin", "settings"]];
const ATITLE = { adash: "Administrasi Pendapatan", acust: "Daftar Pengguna", astudio: () => "Daftar Studio" + (AD.studios ? ` (${AD.studios.length})` : ""), abook: "Daftar Booking", aprop: "Daftar Properti", apose: "Daftar Pose", atrx: "Transaksi", apkg: "Paket & Diskon", aacct: "Akun Admin" };
const SEARCHABLE = ["acust", "astudio", "abook", "aprop", "apose", "atrx"];
function adminShell(inner) {
  return `<div class="adm"><aside class="side"><h3>Admin</h3>${AMENU.map(m => `<button class="${S.view == m[0] ? "on" : ""}" onclick="go('${m[0]}')">${ic(m[2], 20)} ${m[1]}</button>`).join("")}<div class="foot"><div class="sm m" style="margin:0 6px 8px">${esc(BRAND)}</div><button onclick="logout()">${ic("logout", 20)} Keluar</button></div></aside>
<main class="amain">${AD.me && AD.me.must_change ? `<div class="toast err">⚠ Anda masih memakai password bawaan. Ganti password sekarang — fitur admin lain terkunci sampai password diganti.</div>` : ""}<div class="ahead"><h1>${(typeof ATITLE[S.view] == "function" ? ATITLE[S.view]() : ATITLE[S.view]) || ""}</h1>${SEARCHABLE.includes(S.view) ? `<div class="search">${ic("search", 18)}<input placeholder="Search..." value="${esc(AD.q)}" onchange="AD.q=this.value;render()"></div>` : ""}</div>${toasts()}${inner}</main></div>`;
}
async function aLoad(k, fn, def) {
  if (AD[k] || AD.loading[k]) return; AD.loading[k] = 1;
  try { AD[k] = await fn(); } catch (e) { if (e.status == 403 && /Ganti password/.test(e.message)) { AD.loading[k] = 0; if (AD.me) AD.me.must_change = true; return go('aacct'); } if (e.status == 401 || e.status == 403) { AD.loading[k] = 0; return logout(); } err = e.message; AD[k] = def; }
  AD.loading[k] = 0; render();
}
async function aDo(fn, ok) { msg = err = ""; const sn = snap(); let failed = false; try { await fn(); if (ok) msg = ok; } catch (e) { if (e.status == 401 || e.status == 403) return logout(); err = e.message; failed = true; } render(); if (failed) restore(sn); }
// simpan & pulihkan isian form agar tidak hilang saat tampilan dirender ulang (unggah gambar / error validasi)
const snap = () => { const o = {}; document.querySelectorAll('.amain [id]').forEach(e => { if ('value' in e && e.type !== 'file') o[e.id] = e.value; }); return o; };
const restore = o => Object.keys(o).forEach(id => { const e = document.getElementById(id); if (e && 'value' in e && e.type !== 'file') e.value = o[id]; });
const val = id => ($("#" + id) || {}).value;
// dialog konfirmasi (Figma "Konfirmasi Hapus …"): resolve true bila admin menekan tombol aksi; body berupa HTML yang sudah di-escape pemanggil
function aModal(title, body, okLabel) {
  return new Promise(res => { const d = document.createElement("div"), back = document.activeElement; d.className = "mdl";
    d.innerHTML = `<div class="mbox" role="dialog" aria-modal="true" aria-labelledby="mdl-t"><h3 id="mdl-t">${esc(title)}</h3><p>${body}</p><div class="row"><button class="btn sm ghost" data-v="0">Kembali</button><button class="btn sm" data-v="1">${esc(okLabel)}</button></div></div>`;
    const key = e => { if (e.key === "Escape") done(false); else if (e.key === "Tab") { e.preventDefault(); const bs = [...d.querySelectorAll("button")], i = bs.indexOf(document.activeElement); bs[(i + (e.shiftKey ? bs.length - 1 : 1)) % bs.length].focus(); } }, done = v => { d.remove(); document.removeEventListener("keydown", key); if (back && back.focus) back.focus(); res(v); };
    d.onclick = e => { const b = e.target.closest("[data-v]"); if (b) done(b.dataset.v == "1"); else if (e.target === d) done(false); };
    document.addEventListener("keydown", key); document.body.appendChild(d); d.querySelector('[data-v="0"]').focus(); });
}
// aksi dengan alur konfirmasi server (DELETE/PATCH): dialog memakai dampak yang sudah diketahui (ask=false: langsung kirim tanpa dialog awal); bila server membalas 409 needs_confirm
// dengan dampak yang sama dan dialog sudah disetujui, ulangi dengan ?confirm=1, selain itu tampilkan dialog dengan dampak terbaru. Mengembalikan hasil server, atau null bila dibatalkan.
async function aConfirmReq(method, path, body, title, describe, okLabel, known, ask = true) {
  if (ask && !await aModal(title, describe(known), okLabel)) return null;
  try { return await API.req(method, path, body); } catch (e) {
    if (e.status != 409 || !e.data || !e.data.needs_confirm) throw e; const im = e.data.impact;
    if ((!ask || JSON.stringify(im) !== JSON.stringify(known)) && !await aModal(title, describe(im), okLabel)) return null;
    return API.req(method, path + (path.includes("?") ? "&" : "?") + "confirm=1", body); }
}
const aConfirmDel = (path, title, describe, okLabel, known) => aConfirmReq("DELETE", path, undefined, title, describe, okLabel, known);
const wib = ms => ms ? new Date(ms).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "-";
const match = (...f) => { const q = AD.q.trim().toLowerCase(); return !q || f.some(x => String(x ?? "").toLowerCase().includes(q)); };
const loading = `<div class="card m">Memuat…</div>`;
const sel = (id, opts, cur) => `<select id="${id}">${opts.map(o => `<option value="${o[0]}" ${o[0] == cur ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
// unggah gambar: diperkecil di browser (maks 1000px, JPEG) lalu disimpan server di /media
async function upImg(key, input) {
  const f = input.files[0]; if (!f) return; msg = err = ""; const sn = snap();
  try {
    const url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const sc = Math.min(1, 1000 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", .85)); }; im.onerror = () => no(new Error("File bukan gambar")); im.src = r.result; }; r.onerror = () => no(new Error("Gagal membaca file")); r.readAsDataURL(f); });
    AD.imgs[key] = (await API.post("/admin/media", { data: url })).url; msg = "Gambar diunggah. Klik Simpan untuk menerapkan.";
  } catch (e) { err = e.message; } render(); restore(sn);
}

// ---------- Dashboard: pendapatan + rekap operasional ----------
const stat = (t, r, sub = "") => `<div class="stat"><small class="m">${t}</small><b>${rp(r.total)}</b><small class="m">${r.n} transaksi${sub}</small></div>`;
const PERIODS = [["day", "Hari ini"], ["week", "7 hari terakhir"], ["month", "30 hari terakhir"], ["all", "Sejak pemesanan pertama"]];
V.adash = () => {
  const d = AD.dash, o = AD.ops; if (!d || !d.today || !o || !o.period) return loading;
  const e = AD.opEdit || {}, kind = e.kind || "biaya";
  return `<div class="stats">${stat("Hari ini", d.today)}${stat("7 hari terakhir", d.week)}${stat("30 hari terakhir", d.month)}${stat("Sejak pemesanan pertama", d.all, d.first_date ? " · mulai " + d.first_date : "")}</div>
<div class="card" style="margin-bottom:16px"><h3 class="h3" style="margin-bottom:8px">Pendapatan 7 hari terakhir</h3><div class="tbl"><table><tr><th>Tanggal</th><th>Transaksi</th><th>Pendapatan</th></tr>${d.daily.map(x => `<tr><td>${x.date}</td><td>${x.n}</td><td>${rp(x.total)}</td></tr>`).join("")}</table></div>
<p class="sm m" style="margin-top:8px">Pendapatan = pembayaran lunas (setelah diskon & promo). Pembayaran yang sudah di-refund tidak dihitung; refund gagal tetap dihitung.</p></div>
<div class="card"><div class="row sp"><h3 class="h3">Rekapitulasi Operasional</h3><select style="width:auto" onchange="AD.opPeriod=this.value;AD.ops=null;render()">${PERIODS.map(p => `<option value="${p[0]}" ${o.period == p[0] ? "selected" : ""}>${p[1]}</option>`).join("")}</select></div>
<div class="stats" style="margin-top:12px"><div class="stat"><small class="m">Pendapatan booking</small><b>${rp(o.booking_revenue)}</b></div><div class="stat"><small class="m">Pemasukan lain</small><b>${rp(o.other_income)}</b></div><div class="stat"><small class="m">Omset kotor</small><b>${rp(o.gross)}</b></div><div class="stat"><small class="m">Biaya operasional</small><b>${rp(o.costs)}</b></div><div class="stat"><small class="m">Omset bersih</small><b style="color:${o.net < 0 ? "var(--red)" : "var(--green)"}">${rp(o.net)}</b></div></div>
<div class="tbl"><table><tr><th>Tanggal</th><th>Keterangan</th><th>Jenis</th><th>Nominal</th><th>Catatan</th><th></th></tr>${o.items.map(i => `<tr><td>${i.date}</td><td>${esc(i.label)}</td><td><span class="tag ${i.kind == "biaya" ? "no" : "ok"}">${i.kind}</span></td><td>${rp(i.amount)}</td><td>${esc(i.note || "")}</td><td><button class="btn sm ghost" onclick="opEdit(${i.id})">Ubah</button> <button class="btn sm ghost" onclick="opDel(${i.id})">Hapus</button></td></tr>`).join("") || `<tr><td colspan="6" class="m">Belum ada item pada periode ini.</td></tr>`}</table></div>
<h3 class="h3" style="margin:16px 0 4px">${AD.opEdit ? "Ubah item" : "Tambah item"}</h3><div class="row"><input id="o_date" type="date" value="${e.date || todayS()}" style="width:auto"><input id="o_label" placeholder="Keterangan (mis. Sewa studio)" value="${esc(e.label || "")}" style="flex:1;min-width:160px">
<select id="o_kind" style="width:auto"><option value="biaya" ${kind == "biaya" ? "selected" : ""}>Biaya</option><option value="pemasukan" ${kind == "pemasukan" ? "selected" : ""}>Pemasukan lain</option></select><input id="o_amt" type="number" min="0" placeholder="Nominal" value="${e.amount ?? ""}" style="width:140px"><input id="o_note" placeholder="Catatan" value="${esc(e.note || "")}" style="width:170px"></div>
<div class="row" style="margin-top:10px"><button class="btn" onclick="opSave()">${AD.opEdit ? "Simpan perubahan" : "Tambah"}</button>${AD.opEdit ? `<button class="btn ghost" onclick="AD.opEdit=null;render()">Batal</button>` : ""}</div></div>`;
};
V.adash_after = () => { aLoad("dash", () => API.get("/admin/revenue"), {}); aLoad("ops", () => API.get("/admin/ops?period=" + AD.opPeriod), { period: "", items: [] }); };
const opEdit = id => { AD.opEdit = AD.ops.items.find(i => i.id == id); render(); window.scrollTo(0, document.body.scrollHeight); };
const opSave = () => aDo(async () => { const b = { date: val("o_date"), label: val("o_label"), kind: val("o_kind"), amount: +val("o_amt"), note: val("o_note") }; if (AD.opEdit) await API.patch("/admin/ops/" + AD.opEdit.id, b); else await API.post("/admin/ops", b); AD.opEdit = null; AD.ops = null; }, "Rekap operasional disimpan.");
const opDel = id => confirm("Hapus item rekap ini?") && aDo(async () => { await API.del("/admin/ops/" + id); AD.ops = null; AD.opEdit = null; }, "Item dihapus.");

// ---------- Pengguna ----------
V.acust = () => {
  const L = AD.cust; if (!L) return loading; const c = AD.cdet, rows = L.filter(u => match(u.name, u.email, u.phone));
  let out = `<div class="card"><div class="tbl"><table><tr><th>Nama</th><th>Email</th><th>Telepon</th><th>Booking</th><th>Total belanja</th><th>Foto</th><th></th></tr>${rows.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td>${u.bookings}</td><td>${rp(u.spent)}</td><td>${u.photos}</td><td style="white-space:nowrap"><button class="btn sm" onclick="openCust(${u.id})">Detail</button> <button class="btn sm ghost" onclick="delCust(${u.id},'${esc(u.name).replace(/'/g, "")}')">Hapus akun</button></td></tr>`).join("") || `<tr><td colspan="7" class="m">Tidak ada pengguna.</td></tr>`}</table></div></div>`;
  if (c) out += `<div class="card" style="margin-top:16px"><div class="row sp"><h3 class="h3">${esc(c.customer.name)} <small class="m">· ${esc(c.customer.email)} · ${esc(c.customer.phone)}</small></h3><button class="btn sm ghost" onclick="AD.cdet=null;render()">Tutup</button></div>
<h4 style="margin:14px 0 6px">Riwayat pembelian</h4><div class="tbl"><table><tr><th>Dipesan</th><th>Paket</th><th>Studio</th><th>Jadwal</th><th>Subtotal</th><th>Diskon</th><th>Total</th><th>Metode</th><th>Status</th></tr>
${c.bookings.map(b => `<tr><td>${wib(b.created_at)}</td><td>${esc(b.package)}</td><td>${esc(b.studio)}</td><td>${b.slot}</td><td>${rp(b.subtotal ?? b.amount)}</td><td>${b.main_disc + b.promo_disc ? "-" + rp(b.main_disc + b.promo_disc) + (b.promo_code ? " (" + esc(b.promo_code) + ")" : "") : "-"}</td><td><b>${rp(b.amount)}</b></td><td>${b.method || "-"}</td><td><span class="tag ${["Terbayar", "Selesai", "Sesi Berjalan"].includes(b.status) ? "ok" : b.status == "Dibatalkan" ? "no" : ""}">${b.status}</span></td></tr>`).join("") || `<tr><td colspan="9" class="m">Belum ada pembelian.</td></tr>`}</table></div>
<h4 style="margin:16px 0 8px">Foto (${c.photos.length})</h4><div class="gal">${c.photos.map(p => `<div class="ph"><a href="${aImg(p.id)}" target="_blank" rel="noopener"><img src="${aImg(p.id)}" loading="lazy" alt=""></a><span class="f">${p.fav ? "⭐" : ""}</span><small>${wib(p.taken_at)}</small></div>`).join("") || `<p class="m">Belum ada foto.</p>`}</div></div>`;
  return out;
};
const aImg = id => `${API_BASE}/api/admin/photos/${id}/image?t=${API.token}`;
V.acust_after = () => aLoad("cust", () => API.get("/admin/customers"), []);
const openCust = id => aDo(async () => { const [b, p] = await Promise.all([API.get(`/admin/customers/${id}/bookings`), API.get(`/admin/customers/${id}/photos`)]); AD.cdet = { customer: b.customer, bookings: b.bookings, photos: p.photos }; window.scrollTo(0, document.body.scrollHeight); });
const delCust = (id, name) => confirm(`Hapus akun "${name}" beserta SELURUH booking, pembayaran, dan foto miliknya?\nTindakan ini tidak dapat dibatalkan.`) && aDo(async () => { const r = await API.del("/admin/customers/" + id); AD.cust = AD.cdet = AD.dash = AD.ops = AD.studios = AD.books = AD.trx = null; AD.sess = {}; msg = `Akun dihapus (${r.photos_deleted} foto ikut terhapus).`; });

// ---------- Studio (accordion) ----------
function studioForm(s) {
  const k = "s" + (s.id || "N"), img = AD.imgs[k] || s.img || "", id = s.id || "N";
  return `<div class="body one"><div class="spanel"><h4>Detail Studio</h4><div class="sgrid"><div><label>Nama</label><input id="st${id}n" value="${esc(s.name || "")}"><label>Status</label>${sel("st" + id + "s", [["AVAILABLE", "Tersedia"], ["UNAVAILABLE", "Tidak tersedia"]], s.status || "AVAILABLE")}<label>Deskripsi</label><textarea id="st${id}d">${esc(s.description || "")}</textarea><label>Alamat / Lokasi</label><input id="st${id}a" value="${esc(s.address || "Jl. Veteran No. 3")}">
<div class="row" style="flex-wrap:nowrap"><div class="grow"><label>Biaya sewa studio (Rp)</label><input id="st${id}p" type="number" min="0" value="${s.price || 0}"></div><div class="grow"><label>Kapasitas</label>${sel("st" + id + "r", PEOPLE.map(p => [p.id, p.range + " orang"]), s.people_range_id || 1)}</div><div class="grow"><label>Rentang budget</label>${sel("st" + id + "b", BUDGET.map(p => [p.id, p.budget]), s.budget_range_id || 1)}</div></div></div>
<div><label>Gambar</label><div class="thumb" style="${bgi(img)}">${img ? "" : "Belum ada gambar"}</div><div class="row" style="margin-top:10px"><label class="btn sm soft" style="margin:0">${ic("upload", 16)} Unggah gambar<input type="file" accept="image/*" hidden onchange="upImg('${k}',this)"></label></div>
<div class="row" style="margin-top:18px"><button class="btn" onclick="studioSave(${s.id || 0})">${s.id ? "Simpan" : "Tambah studio"}</button></div>${s.id ? `<p class="sm m" style="margin-top:8px">${s.active_bookings} booking aktif dari ${s.bookings} booking (tanpa yang batal) · status Tidak tersedia menyembunyikan studio dari customer tanpa mengubah booking yang sudah ada</p>` : ""}</div></div></div>${s.id ? sessPanel(s) : ""}</div>`;
}
V.astudio = () => {
  const L = AD.studios; if (!L) return loading;
  const tog = id => `AD.open[${id}]=!AD.open[${id}];render()`, on = s => s.status != "UNAVAILABLE";
  return L.filter(s => match(s.name, s.description, s.address)).map(s => `<div class="acc"><div class="acc-h"><button class="acc-t" onclick="${tog(s.id)}" aria-expanded="${!!AD.open[s.id]}"><span>${esc(s.name)}</span><span class="tag ${on(s) ? "ok" : "off"}">${on(s) ? "Tersedia" : "Tidak tersedia"}</span><span class="meta">${rp(s.price || 0)} · ${s.sessions} sesi${s.address ? " · " + esc(s.address) : ""}</span></button>
<button class="ibtn del" onclick="studioDel(${s.id})" title="Hapus studio" aria-label="Hapus ${esc(s.name)}">${ic("trash", 18)}</button><button class="ibtn" onclick="${tog(s.id)}" aria-label="Buka/tutup detail" aria-expanded="${!!AD.open[s.id]}">${ic(AD.open[s.id] ? "up" : "down", 20)}</button></div>${AD.open[s.id] ? studioForm(s) : ""}</div>`).join("")
    + `<div class="acc"><button onclick="AD.open.N=!AD.open.N;render()"><span>${ic("plus", 18)} Tambah studio</span>${ic(AD.open.N ? "up" : "down", 20)}</button>${AD.open.N ? studioForm({}) : ""}</div>`;
};
V.astudio_after = () => { aLoad("studios", () => API.get("/admin/studios"), []); (AD.studios || []).forEach(s => { if (AD.open[s.id]) sessLoad(s.id); }); };
const masterReload = async () => { const m = await API.get("/master"); STUDIOS = m.STUDIOS; ALLSTUDIOS = m.ALLSTUDIOS || m.STUDIOS; };
const studioSave = id => aDo(async () => { const k = "s" + (id || "N"), n = id || "N", b = { name: val(`st${n}n`), status: val(`st${n}s`), description: val(`st${n}d`), address: val(`st${n}a`), price: +val(`st${n}p`) || 0, people_range_id: +val(`st${n}r`), budget_range_id: +val(`st${n}b`) }; if (AD.imgs[k]) b.img = AD.imgs[k];
  if (id) await API.patch("/admin/studios/" + id, b); else await API.post("/admin/studios", b); delete AD.imgs[k]; AD.studios = null; await masterReload(); }, "Studio disimpan.");
const studioImpactText = i => `Studio ini memiliki ${i.sessions} sesi dan ${i.active_bookings} booking aktif${i.paid_bookings ? ` (${i.paid_bookings} sudah dibayar, total refund ${rp(i.refund_total)})` : ""}. ${i.active_bookings ? "Setelah dikonfirmasi, seluruh booking aktif dibatalkan dan dana yang sudah dibayar dikembalikan 100% kepada pelanggan. " : ""}Studio beserta sesinya tidak lagi tampil, tetapi riwayat booking tetap tersimpan.`;
const studioDel = id => { const s = (AD.studios || []).find(x => x.id == id); if (!s) return;
  aDo(async () => { const r = await aConfirmDel("/admin/studios/" + id, `Hapus ${s.name}?`, studioImpactText, "Ya, Hapus Studio", s.impact); if (!r) return;
    AD.studios = AD.books = AD.trx = AD.dash = AD.ops = null; AD.sess = {}; delete AD.open[id]; await masterReload();
    msg = `Studio "${s.name}" dihapus.` + (r.cancelled ? ` ${r.cancelled} booking dibatalkan${r.refunded ? `, ${r.refunded} di-refund` : ""}${r.refund_failed ? `, ${r.refund_failed} refund gagal (tindak lanjuti manual di menu Transaksi)` : ""}.` : ""); }); };

// ---------- Sesi studio (panel "Detail Sesi" di accordion studio, Figma): kalender bulan + chip jam per hari ----------
const sMonth = sid => AD.scal[sid] || todayS().slice(0, 7), sDayOf = sid => AD.sday[sid] || todayS(), sKey = sid => sid + "|" + sMonth(sid);
async function sessLoad(sid) { const k = sKey(sid); if (AD.sess[k] || AD.loading["s" + k]) return; AD.loading["s" + k] = 1;
  try { AD.sess[k] = await API.get(`/admin/studios/${sid}/sessions?month=${sMonth(sid)}`); } catch (e) { if (e.status == 401 || e.status == 403) { AD.loading["s" + k] = 0; return logout(); } err = e.message; AD.sess[k] = []; }
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
const sRefresh = async sid => { Object.keys(AD.sess).forEach(k => { if (k.startsWith(sid + "|")) delete AD.sess[k]; }); AD.books = AD.trx = AD.dash = AD.ops = null; try { AD.studios = await API.get("/admin/studios"); } catch (e) { AD.studios = null; } }; // gagal muat ulang: daftar dimuat lagi saat render
const sFind = (sid, id) => (AD.sess[sKey(sid)] || []).find(x => x.id == id);
const sWho = i => i.customers && i.customers.length ? ` (${i.customers.map(esc).join(", ")})` : "";
const sAdd = sid => aDo(async () => { const id = `sa${sid}`, date = val(id + "d"), r = await API.post(`/admin/studios/${sid}/sessions`, { date, start: val(id + "s"), end: val(id + "e"), repeat: val(id + "r") === "" ? 1 : +val(id + "r") });
  AD.sadd = null; AD.sday[sid] = date; AD.scal[sid] = date.slice(0, 7); await sRefresh(sid);
  msg = r.created.length > 1 ? `${r.created.length} sesi berhasil ditambahkan.` : "Sesi berhasil ditambahkan."; if (r.skipped.length) msg += ` ${r.skipped.length} tanggal dilewati karena bertabrakan: ${r.skipped.join(", ")}.`; });
const sSave = (sid, sesId) => { const x = sFind(sid, sesId); if (!x) return; const id = `se${sesId}`, body = { date: val(id + "d"), start: val(id + "s"), end: val(id + "e") };
  const sn = snap(); let back = false;
  aDo(async () => { const r = await aConfirmReq("PATCH", "/admin/sessions/" + sesId, body, `Ubah sesi ${x.start} - ${x.end}?`, i => `Sesi ini memiliki ${i.active_bookings} booking aktif${sWho(i)}. Setelah dikonfirmasi, jadwal sesi diubah dan pelanggan menerima email berisi jadwal baru.`, "Ya, Ubah Sesi", x.impact, false); if (!r) { back = true; return; } // tanpa dialog awal: server memvalidasi jam dulu, dialog muncul hanya bila server meminta konfirmasi
    AD.sedit = null; AD.sday[sid] = r.date; AD.scal[sid] = r.date.slice(0, 7); await sRefresh(sid); msg = "Sesi berhasil diperbarui." + (r.notified ? ` Pelanggan dari ${r.notified} booking terdampak sudah diberi tahu lewat email.` : ""); }).then(() => { if (back) restore(sn); }); };
const sessImpactText = i => i.active_bookings ? `Sesi ini memiliki ${i.active_bookings} booking aktif${sWho(i)}${i.paid_bookings ? `, ${i.paid_bookings} sudah dibayar (total refund ${rp(i.refund_total)})` : ""}. Setelah dikonfirmasi, booking tersebut dibatalkan, dana yang sudah dibayar dikembalikan 100%, dan pelanggan diberi tahu lewat email.` : "Sesi ini belum memiliki booking aktif dan akan dihapus dari daftar sesi.";
const sDel = (sid, sesId) => { const x = sFind(sid, sesId); if (!x) return;
  aDo(async () => { const r = await aConfirmDel("/admin/sessions/" + sesId, `Hapus sesi ${x.date} ${x.start} - ${x.end}?`, sessImpactText, "Ya, Hapus Sesi", x.impact); if (!r) return;
    AD.sedit = null; await sRefresh(sid); msg = "Sesi dihapus." + (r.cancelled ? ` ${r.cancelled} booking dibatalkan${r.refunded ? `, ${r.refunded} di-refund` : ""}${r.refund_failed ? `, ${r.refund_failed} refund gagal (tindak lanjuti manual di menu Transaksi)` : ""}.` : ""); }); };

// ---------- Booking: daftar + panel Detail Booking (Figma "Admin - Booking") ----------
const BSTAT = ["Menunggu Pembayaran", "Terbayar", "Sesi Berjalan", "Selesai", "Dibatalkan"], btag = s => ["Terbayar", "Selesai", "Sesi Berjalan"].includes(s) ? "ok" : s == "Dibatalkan" ? "no" : "warn";
const slotHm = slot => { const h = +String(slot).split(" ")[1].split(":")[0]; return `${String(h).padStart(2, "0")}:00 - ${String(h).padStart(2, "0")}:50`; }; // slot tetap 50 menit
V.abook = () => {
  const L = AD.books; if (!L) return loading; const rows = L.filter(b => match(b.customer, b.email, b.studio, b.package, b.slot)), d = AD.bdet;
  return `<div class="bgrid ${d ? "open" : ""}"><div class="card"><div class="row sp"><select style="width:auto" aria-label="Saring status" onchange="AD.bstatus=this.value;AD.books=null;AD.bdet=null;render()"><option value="">Semua status</option>${BSTAT.map(s => `<option ${AD.bstatus == s ? "selected" : ""}>${s}</option>`).join("")}</select><span class="m sm">${rows.length} booking</span></div>
<div class="tbl" style="margin-top:8px"><table><tr><th>#</th><th>Pelanggan</th><th>Studio</th><th>Paket</th><th>Jadwal</th><th>Total</th><th>Status</th><th>Bayar</th><th></th></tr>${rows.map(b => `<tr class="${d && d.id == b.id ? "on" : ""}"><td>${b.id}</td><td>${esc(b.customer)}<br><small class="m">${esc(b.email)}</small></td><td>${esc(b.studio)}</td><td>${esc(b.package)}</td><td>${b.slot}</td><td>${rp(b.amount)}</td><td><span class="tag ${btag(b.status)}">${b.status}</span>${b.cancel_reason ? `<br><small class="m">${esc(b.cancel_reason)}</small>` : ""}</td><td>${PAYLBL[b.pay_status] || "-"}${b.method ? `<br><small class="m">${esc(b.method)}</small>` : ""}</td>
<td><button class="btn sm ${d && d.id == b.id ? "" : "ghost"}" onclick="openBook(${b.id})" aria-label="Detail booking #${b.id}">Detail</button></td></tr>`).join("") || `<tr><td colspan="9" class="m">Tidak ada booking.</td></tr>`}</table></div></div>${d ? bookPanel(d) : ""}</div>`;
};
function bookPanel(d) {
  const p = d.payment, ss = d.studio_session;
  return `<aside class="card bdet" aria-label="Detail booking #${d.id}"><div class="row sp"><h3 class="h3">Detail Booking #${d.id}</h3><div class="row" style="gap:6px">${d.delete_block ? "" : `<button class="ibtn del" onclick="bookDel(${d.id})" title="Hapus booking" aria-label="Hapus booking #${d.id}">${ic("trash", 18)}</button>`}<button class="ib" onclick="AD.bdet=null;render()" title="Tutup" aria-label="Tutup detail">✕</button></div></div>
${kvs([["Tanggal", d.slot.split(" ")[0]], ["Pelanggan", `${esc(d.customer.name)}<br><small class="m">${esc(d.customer.email)} · ${esc(d.customer.phone)}</small>`], ["Studio", esc(d.studio_name)], ["Sesi", slotHm(d.slot) + (ss ? `<br><small class="m">Sesi studio ${ss.date} ${ss.start} - ${ss.end}${ss.deleted ? " (dihapus)" : ""}</small>` : "")], ["Paket", esc(d.package_name)], ["Status", `<span class="tag ${btag(d.status)}">${d.status}</span>${d.cancel_reason ? `<br><small class="m">${esc(d.cancel_reason)}${d.cancel_detail ? ": " + esc(d.cancel_detail) : ""}</small>` : ""}`], ["Dipesan", fmtTime(d.created_at)]])}
<h4 class="bh">Detail Pembayaran</h4>${kvs([["Invoice", esc(d.invoice)], ["Waktu", fmtTime(p.paid_at)], ["Status", PAYLBL[p.status] || esc(p.status)], ["Metode", esc(p.method || "-")], ...(p.refunded_at ? [["Refund", fmtTime(p.refunded_at)]] : []), ...(p.status == "pending" ? [["Batas bayar", fmtTime(p.expire_at)]] : []),
  ["Paket", rp(d.package_price)], ...(d.add_on ? [["Add-on", rp(d.add_on)]] : []), ["Biaya Studio", rp(d.studio_fee)], ...(d.main_disc ? [["Diskon utama", "-" + rp(d.main_disc), "disc"]] : []), ...(d.promo_disc ? [["Kode promo " + esc(d.promo_code), "-" + rp(d.promo_disc), "disc"]] : []), ["Total", rp(d.amount), "total"]])}
${d.delete_block ? `<p class="sm m" style="margin-top:10px">${esc(d.delete_block)}.</p>` : ""}</aside>`;
}
V.abook_after = () => aLoad("books", () => API.get("/admin/bookings?status=" + encodeURIComponent(AD.bstatus)), []);
const openBook = id => aDo(async () => { AD.bdet = await API.get("/admin/bookings/" + id); if (innerWidth <= 1000) setTimeout(() => { const e = $(".bdet"); if (e) e.scrollIntoView({ behavior: "smooth", block: "start" }); }); });

// hapus booking (US-16): dialog Figma "Konfirmasi Hapus Booking" berisi status dan dana yang dikembalikan
const bookAfter = () => { AD.books = AD.dash = AD.ops = AD.trx = AD.studios = AD.cust = AD.cdet = null; AD.sess = {}; }; // sesi studio tertaut & ringkasan ikut berubah
const bookDelText = d => i => `Booking ${esc(d.studio_name)} · ${d.slot.split(" ")[0]} · ${slotHm(d.slot)} atas nama ${esc(d.customer.name)}. Status booking: ${esc(i.status)} (${i.paid ? "sudah dibayar" : "belum dibayar"}). ${i.paid ? `Dana ${rp(i.refund_amount)} akan dikembalikan 100% lebih dulu, lalu booking dihapus dan sesinya dibuka kembali.` : i.status == "Dibatalkan" ? "Booking akan dihapus dari riwayat." : "Booking akan langsung dihapus dan sesinya dibuka kembali."}${["Menunggu Pembayaran", "Terbayar"].includes(i.status) ? " Pelanggan menerima email pemberitahuan." : ""} Tindakan ini tidak dapat dibatalkan.`;
const bookDel = id => { const d = AD.bdet; if (!d || d.id != id) return;
  aDo(async () => { const r = await aConfirmDel("/admin/bookings/" + id, "Hapus booking ini?", bookDelText(d), "Ya, Hapus Booking", d.impact); if (!r) return; bookAfter();
    if (r.kept) { AD.bdet = await API.get("/admin/bookings/" + id).catch(() => null); err = r.message + "."; } else { AD.bdet = null; msg = r.refund == "refunded" ? `Booking dihapus. Dana ${rp(r.refund_amount)} dikembalikan 100%.` : "Booking dihapus."; } }); };

// ---------- Properti ----------
const CATS = ["Background", "Topi", "Rompi", "Kalung", "Kacamata", "Lainnya"];
const pthumb = (p, k) => { const img = AD.imgs[k] || p.img; return `<label class="pthumb" style="${img ? bgi(img) : ""}">${img ? "" : ic("upload", 20)}<input type="file" accept="image/*" hidden onchange="upImg('${k}',this)"></label>`; };
const propRow = p => { const id = p.id || "N", k = "p" + id; return `<tr><td>${pthumb(p, k)}</td><td><input id="pr${id}n" value="${esc(p.name || "")}" placeholder="Nama properti"></td><td>${sel("pr" + id + "c", CATS.map(c => [c, c]), p.category || "Topi")}</td><td><input id="pr${id}p" type="number" min="0" value="${p.price ?? 0}" style="width:110px"></td><td><input id="pr${id}q" type="number" min="0" value="${p.qty ?? 1}" style="width:80px"></td>
<td style="white-space:nowrap"><button class="btn sm" onclick="propSave(${p.id || 0})">${p.id ? "Simpan" : "+ Tambah"}</button>${p.id ? ` <button class="btn sm ghost" onclick="propDel(${p.id})">Hapus</button>` : ""}</td></tr>`; };
V.aprop = () => { const L = AD.props; if (!L) return loading; return `<div class="card"><div class="tbl"><table><tr><th>Foto</th><th>Nama</th><th>Kategori</th><th>Harga add-on</th><th>Qty</th><th></th></tr>${L.filter(p => match(p.name, p.category)).map(propRow).join("")}${propRow({})}</table></div><p class="sm m" style="margin-top:8px">Qty 0 = properti ditampilkan "Habis" dan tidak bisa dipilih customer. Kategori "Background" menjadi background sesi, selain itu aksesori.</p></div>`; };
V.aprop_after = () => aLoad("props", () => API.get("/admin/properties"), []);
const propBody = id => { const n = id || "N", b = { name: val(`pr${n}n`), category: val(`pr${n}c`), price: +val(`pr${n}p`) || 0, qty: +val(`pr${n}q`) }; if (AD.imgs["p" + n]) b.img = AD.imgs["p" + n]; return b; };
const propReload = async () => { AD.props = null; PROP = (await API.get("/master")).PROP; };
const propSave = id => aDo(async () => { const b = propBody(id); if (id) await API.patch("/admin/properties/" + id, b); else await API.post("/admin/properties", b); delete AD.imgs["p" + (id || "N")]; await propReload(); }, "Properti disimpan.");
const propDel = id => confirm("Hapus properti ini?") && aDo(async () => { await API.del("/admin/properties/" + id); await propReload(); }, "Properti dihapus.");

// ---------- Pose ----------
const poseRow = p => { const id = p.id || "N"; return `<tr><td><input id="po${id}n" value="${esc(p.nama || "")}" placeholder="Nama / deskripsi pose" style="min-width:260px"></td><td>${sel("po" + id + "r", PEOPLE.map(x => [x.id, x.range + " orang"]), p.people_range_id || 1)}</td><td style="white-space:nowrap"><button class="btn sm" onclick="poseSave(${p.id || 0})">${p.id ? "Simpan" : "+ Tambah"}</button>${p.id ? ` <button class="btn sm ghost" onclick="poseDel(${p.id})">Hapus</button>` : ""}</td></tr>`; };
V.apose = () => { const L = AD.poses; if (!L) return loading; return `<div class="card"><div class="tbl"><table><tr><th>Pose</th><th>Jumlah orang</th><th></th></tr>${L.filter(p => match(p.nama)).map(poseRow).join("")}${poseRow({})}</table></div></div>`; };
V.apose_after = () => aLoad("poses", () => API.get("/admin/poses"), []);
const poseSave = id => aDo(async () => { const n = id || "N", b = { nama: val(`po${n}n`), people_range_id: +val(`po${n}r`) }; if (id) await API.patch("/admin/poses/" + id, b); else await API.post("/admin/poses", b); AD.poses = null; }, "Pose disimpan.");
const poseDel = id => confirm("Hapus pose ini?") && aDo(async () => { await API.del("/admin/poses/" + id); AD.poses = null; }, "Pose dihapus.");

// ---------- Transaksi ----------
V.atrx = () => {
  const T = AD.trx; if (!T) return loading; const rows = T.rows.filter(r => match(r.customer, r.email, r.invoice, r.status, r.method));
  return `<div class="stats"><div class="stat"><small class="m">Total pembayaran masuk</small><b>${rp(T.paid)}</b></div><div class="stat"><small class="m">Total refund</small><b>${rp(T.refunded)}</b></div></div>
<div class="card"><div class="tbl"><table><tr><th>Invoice</th><th>Waktu bayar</th><th>Pelanggan</th><th>Metode</th><th>Nominal</th><th>Status</th><th>Refund</th></tr>${rows.map(r => `<tr><td>${esc(r.invoice)}</td><td>${wib(r.paid_at)}</td><td>${esc(r.customer)}<br><small class="m">${esc(r.email)}</small></td><td>${esc(r.method || "-")}</td><td>${rp(r.amount)}</td><td><span class="tag ${r.status == "paid" ? "ok" : r.status == "refunded" ? "" : "no"}">${PAYLBL[r.status] || r.status}</span></td><td>${r.refunded_at ? wib(r.refunded_at) : "-"}</td></tr>`).join("") || `<tr><td colspan="7" class="m">Belum ada transaksi.</td></tr>`}</table></div></div>`;
};
V.atrx_after = () => aLoad("trx", () => API.get("/admin/transactions"), { rows: [], paid: 0, refunded: 0 });

// ---------- Paket, diskon utama, kode promo ----------
V.apkg = () => {
  const P = AD.pkgs, D = AD.disc, R = AD.promos; if (!P || !D || !R) return loading;
  const inp = (id, v, t = "text", w = 90) => `<input id="${id}" type="${t}" value="${esc(v)}" ${t == "number" ? 'min="0"' : ""} style="width:${w}px">`;
  return `<div class="card" style="margin-bottom:16px"><h3 class="h3">Diskon utama</h3><p class="m sm">Potongan persen untuk harga semua paket (add-on tidak didiskon). Isi 0 untuk menonaktifkan.</p>
<div class="row" style="margin-top:8px"><input id="d_pct" type="number" min="0" max="100" value="${D.pct}" style="width:90px"> %<input id="d_lbl" placeholder="Label (mis. Promo Kemerdekaan)" value="${esc(D.label)}" style="flex:1;min-width:160px"><button class="btn" onclick="discSave()">Simpan</button></div></div>
<div class="card" style="margin-bottom:16px"><h3 class="h3">Paket</h3><div class="tbl"><table><tr><th>Nama</th><th>Harga (Rp)</th><th>Jml foto</th><th>Durasi (mnt)</th><th>Ukuran strip</th><th>Material</th><th>Status</th><th></th></tr>
${P.map(p => `<tr><td>${inp("pk" + p.id + "n", p.name)}</td><td>${inp("pk" + p.id + "p", p.price, "number", 110)}</td><td>${inp("pk" + p.id + "c", p.photo_count, "number", 70)}</td><td>${inp("pk" + p.id + "d", p.dur, "number", 70)}</td><td>${inp("pk" + p.id + "s", p.strip_size, "text", 70)}</td><td>${inp("pk" + p.id + "m", p.strip_material)}</td>
<td><span class="tag ${p.active ? "ok" : "no"}">${p.active ? "aktif" : "nonaktif"}</span></td><td style="white-space:nowrap"><button class="btn sm" onclick="pkSave(${p.id})">Simpan</button> ${p.active ? "" : `<button class="btn sm soft" onclick="pkActive(${p.id})">Aktifkan</button> `}<button class="btn sm ghost" onclick="pkDel(${p.id})">Hapus</button></td></tr>`).join("")}
<tr><td>${inp("pkNn", "")}</td><td>${inp("pkNp", "", "number", 110)}</td><td>${inp("pkNc", "", "number", 70)}</td><td>${inp("pkNd", "", "number", 70)}</td><td>${inp("pkNs", "", "text", 70)}</td><td>${inp("pkNm", "")}</td><td></td><td><button class="btn sm" onclick="pkAdd()">+ Tambah paket</button></td></tr></table></div>
<p class="sm m" style="margin-top:8px">Harga baru hanya berlaku untuk booking berikutnya. Paket yang pernah dibeli hanya dinonaktifkan agar riwayat tetap utuh.</p></div>
<div class="card"><h3 class="h3">Kode promo</h3><div class="tbl"><table><tr><th>Kode</th><th>Potongan</th><th>Terpakai</th><th>Berlaku s/d</th><th>Status</th><th></th></tr>
${R.map(r => `<tr><td><b>${esc(r.code)}</b></td><td>${r.kind == "percent" ? r.value + "%" : rp(r.value)}</td><td>${r.used_count}${r.max_uses ? " / " + r.max_uses : " (bebas)"}</td><td>${r.expires_at ? new Date(r.expires_at + 7 * 3600e3).toISOString().slice(0, 10) : "-"}</td><td><span class="tag ${r.active ? "ok" : "no"}">${r.active ? "aktif" : "nonaktif"}</span></td><td style="white-space:nowrap"><button class="btn sm ghost" onclick="promoToggle(${r.id})">${r.active ? "Nonaktifkan" : "Aktifkan"}</button> <button class="btn sm ghost" onclick="promoDel(${r.id})">Hapus</button></td></tr>`).join("") || `<tr><td colspan="6" class="m">Belum ada kode promo.</td></tr>`}</table></div>
<h4 style="margin:14px 0 6px">Buat kode baru</h4><div class="row"><input id="r_code" placeholder="KODE" style="width:130px;text-transform:uppercase"><select id="r_kind" style="width:auto"><option value="percent">Persen (%)</option><option value="nominal">Nominal (Rp)</option></select><input id="r_val" type="number" min="1" placeholder="Nilai" style="width:110px"><input id="r_max" type="number" min="0" placeholder="Maks. pemakaian (0 = bebas)" style="width:200px"><input id="r_exp" type="date" style="width:auto" title="Berlaku sampai"><button class="btn" onclick="promoAdd()">Tambah</button></div></div>`;
};
V.apkg_after = () => { aLoad("pkgs", () => API.get("/admin/packages"), []); aLoad("disc", () => API.get("/admin/discount"), { pct: 0, label: "" }); aLoad("promos", () => API.get("/admin/promos"), []); };
const pkBody = p => ({ name: val(`pk${p}n`), price: +val(`pk${p}p`), photo_count: +val(`pk${p}c`), dur: +val(`pk${p}d`), strip_size: val(`pk${p}s`), strip_material: val(`pk${p}m`) });
const pkSave = id => aDo(async () => { await API.patch("/admin/packages/" + id, pkBody(id)); AD.pkgs = null; }, "Paket disimpan. Harga baru berlaku untuk booking berikutnya.");
const pkAdd = () => aDo(async () => { await API.post("/admin/packages", pkBody("N")); AD.pkgs = null; }, "Paket baru ditambahkan.");
const pkActive = id => aDo(async () => { await API.patch("/admin/packages/" + id, { active: true }); AD.pkgs = null; }, "Paket diaktifkan.");
const pkDel = id => confirm("Hapus paket ini? (Jika pernah dibeli, paket hanya dinonaktifkan.)") && aDo(async () => { const r = await API.del("/admin/packages/" + id); AD.pkgs = null; msg = r.deactivated ? "Paket pernah dibeli, jadi dinonaktifkan (riwayat tetap utuh)." : "Paket dihapus."; });
const discSave = () => aDo(async () => { await API.put("/admin/discount", { pct: +val("d_pct"), label: val("d_lbl") }); AD.disc = null; }, "Diskon utama disimpan.");
const promoAdd = () => aDo(async () => { await API.post("/admin/promos", { code: val("r_code"), kind: val("r_kind"), value: +val("r_val"), max_uses: +val("r_max") || 0, expires: val("r_exp") || null }); AD.promos = null; }, "Kode promo dibuat.");
const promoToggle = id => aDo(async () => { const r = AD.promos.find(x => x.id == id); await API.patch("/admin/promos/" + id, { code: r.code, kind: r.kind, value: r.value, max_uses: r.max_uses, expires: r.expires_at ? new Date(r.expires_at + 7 * 3600e3).toISOString().slice(0, 10) : null, active: !r.active }); AD.promos = null; });
const promoDel = id => confirm("Hapus kode promo ini?") && aDo(async () => { await API.del("/admin/promos/" + id); AD.promos = null; }, "Kode promo dihapus.");

// ---------- Akun Admin (tersimpan di database; ganti username/password) ----------
V.aacct = () => {
  const me = AD.me || { username: "", must_change: false };
  return `<div class="card" style="max-width:560px"><h3 class="h3">Akun Admin</h3><p class="m sm" style="margin-top:4px">Akun admin tersimpan di database dengan password ter-hash. Password baru minimal 8 karakter dan mengandung huruf serta angka. Setelah password diganti, semua sesi admin lama otomatis keluar.</p>
<label>Username</label><input id="ac_u" value="${esc(me.username)}" autocomplete="username"><label>Password saat ini</label><input id="ac_c" type="password" autocomplete="current-password">
<label>Password baru ${me.must_change ? "(wajib)" : "(kosongkan jika tidak diganti)"}</label><input id="ac_n" type="password" autocomplete="new-password"><label>Ulangi password baru</label><input id="ac_n2" type="password" autocomplete="new-password">
<div class="row" style="margin-top:18px"><button class="btn" onclick="acctSave()">Simpan</button></div></div>`;
};
const acctSave = () => {
  const n = val("ac_n"), n2 = val("ac_n2"); if (n !== n2) { err = "Pengulangan password baru tidak sama."; msg = ""; return render(); }
  if (AD.me && AD.me.must_change && !n) { err = "Password baru wajib diisi."; msg = ""; return render(); }
  return aDo(async () => { const r = await API.patch("/admin/account", { current_password: val("ac_c"), username: val("ac_u"), new_password: n || undefined }); API.token = r.token; localStorage.setItem("snapia_t", r.token); AD.me = { username: r.username, must_change: false }; }, "Akun admin diperbarui.");
};
