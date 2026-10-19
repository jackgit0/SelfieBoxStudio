// ===== SISI CUSTOMER: Beranda (Browse), Studio, Booking, Booking Saya, Pembatalan/Refund, Akun =====
const PURPOSES = ["Pas foto/Portrait", "Couple", "Keluarga", "Teman/Grup"];
const bgi = u => u ? `background-image:url('${esc(u)}')` : "";
const propVisual = p => p.img ? `<div class="pimg" style="${bgi(p.img)}"></div>` : `<div class="pimg" ${p.bg ? `style="background-image:linear-gradient(135deg,${esc(p.bg)})"` : ""}>${p.bg ? "" : esc(p.e || "🎁")}</div>`;
function recommend(q) {
  const n = PKG.length, pick = i => PKG[Math.min(i, n - 1)]; let main = pick(q.people == 1 ? 1 : q.people == 2 ? 2 : 3); if (q.purpose && q.purpose.startsWith("Pas foto")) main = PKG[0];
  if (eff(main) <= q.budget) return { main }; const alt = [...PKG].reverse().find(p => eff(p) <= q.budget); return { alt };
}
const recPkg = () => { if (!(S.quiz && S.quiz.ok && PKG.length)) return null; const r = recommend(S.quiz); return r.main || r.alt || PKG[0]; };

// ---------- kalender ----------
function calHTML(ctx, sel) {
  const t = new Date(), c = CAL[ctx] || (CAL[ctx] = { y: t.getFullYear(), m: t.getMonth() }), first = (new Date(c.y, c.m, 1).getDay() + 6) % 7, dim = new Date(c.y, c.m + 1, 0).getDate(), today = todayS();
  let cells = "<i></i>".repeat(first);
  for (let d = 1; d <= dim; d++) { const ds = iso(new Date(c.y, c.m, d)); cells += `<button class="cd ${ds == sel ? "on" : ""}" ${ds < today ? "disabled" : ""} onclick="calPick('${ctx}','${ds}')">${d}</button>`; }
  return `<div class="cal"><div class="calh"><button class="ib" aria-label="Bulan sebelumnya" onclick="calNav('${ctx}',-1)">${ic("left", 16)}</button><b>${new Date(c.y, c.m, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</b><button class="ib" aria-label="Bulan berikutnya" onclick="calNav('${ctx}',1)">${ic("right", 16)}</button></div>
<div class="calg">${["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(x => `<small>${x}</small>`).join("")}${cells}</div></div>`;
}
function calNav(ctx, dir) { const t = new Date(), c = CAL[ctx] || (CAL[ctx] = { y: t.getFullYear(), m: t.getMonth() }); let m = c.m + dir, y = c.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } if (y * 12 + m < t.getFullYear() * 12 + t.getMonth()) return; c.y = y; c.m = m; render(); }
function calPick(ctx, ds) { if (ctx === "home") S.hDate = ds; else { B.date = ds; B.slot = null; } render(); }

// ---------- beranda (Browse) ----------
const toggleBm = id => { const i = S.bm.indexOf(id); i < 0 ? S.bm.push(id) : S.bm.splice(i, 1); save(); render(); };
function studioCard(s) {
  const d = S.hDate, from = S.hFrom ?? 8, to = S.hTo ?? 20, slots = free(s.id, d).filter(h => h >= from && h <= to).slice(0, 3), on = S.bm.includes(s.id);
  return `<article class="scard"><div class="box" onclick="go('studio',{id:${s.id}})"><div class="simg" style="${bgi(s.img)}"></div><div class="sbody"><div class="row sp" style="flex-wrap:nowrap"><h3>${esc(s.name)}</h3>
<button class="star ${on ? "on" : ""}" aria-label="Favorit" onclick="event.stopPropagation();toggleBm(${s.id})">${icf("star", 20)}</button></div><p class="desc">${esc(s.description)}</p>
<div class="meta"><span>${ic("users", 14)} ${esc(capLabel(s))}</span><span>${ic("tag", 14)} ${priceRange(s)}</span></div></div></div>
<div class="chips">${slots.map(h => `<button class="chip" onclick="quickBook(${s.id},'${d}',${h})">${slotLabel(h)}</button>`).join("") || `<span class="chip none">Tidak ada sesi tersedia</span>`}</div></article>`;
}
function pkgCards() {
  const rec = recPkg();
  return PKG.map(p => `<div class="pk ${rec && rec.id == p.id ? "rec" : ""}"><div class="row sp"><h4>${esc(p.name)}</h4>${rec && rec.id == p.id ? '<span class="tag">Rekomendasi</span>' : ""}</div><div class="price">${ptag(p)}</div>
<ul><li>${p.photo_count} foto · ${p.dur} menit</li><li>Strip ${esc(p.strip_size || "-")} · ${esc(p.strip_material || "-")}</li><li>Galeri online 30 hari</li></ul></div>`).join("");
}
V.home = () => {
  const d = S.hDate || (S.hDate = todayS()), from = S.hFrom ?? 8, to = S.hTo ?? 20, rec = recPkg(), opt = (v, sel) => HRS.map(h => `<option value="${h}" ${h == sel ? "selected" : ""}>${pad(h)}:00</option>`).join("");
  const banner = rec ? `<div class="rec-banner">${ic("star", 22)}<div class="grow"><b>Rekomendasi untuk kamu: Paket ${esc(rec.name)}</b><div class="sm m">${rec.photo_count} foto · ${rec.dur} menit · ${rp(eff(rec))} — sesuai preferensimu.</div></div><button class="btn sm" onclick="openAcct('pref')">Ubah</button></div>`
    : `<div class="rec-banner">${ic("settings", 22)}<div class="grow"><b>Dapatkan rekomendasi paket</b><div class="sm m">Isi preferensi (tujuan, jumlah orang, vibe, budget) agar kami sarankan paket yang pas.</div></div><button class="btn sm" onclick="openAcct('pref')">Isi preferensi</button></div>`;
  return `<div class="home"><aside class="filter card soft"><h3 class="h3">Filter Jadwal</h3><p class="sub" style="margin-bottom:12px">Pilih waktu yang sesuai, kami tampilkan studio yang tersedia.</p>${calHTML("home", d)}
<div class="trange"><div><label>Dari jam</label><select onchange="S.hFrom=+this.value;render()">${opt(0, from)}</select></div><div><label>Sampai jam</label><select onchange="S.hTo=+this.value;render()">${opt(0, to)}</select></div></div></aside>
<section style="min-width:0"><h1 class="h1">Browse</h1><p class="sub">Temukan studio yang cocok sama selera kamu.</p>${banner}<div class="grid3">${STUDIOS.map(studioCard).join("")}</div>
<h2 class="h2" style="margin-top:36px">Paket</h2><p class="sub">Pilih paket saat memesan — harga sudah termasuk diskon yang berlaku.</p><div class="pk-grid">${pkgCards()}</div></section></div>`;
};
function ensurePkg() { if (!S.pkg || !PKG.find(p => p.id == S.pkg)) S.pkg = (recPkg() || PKG[0]).id; }
function quickBook(sid, date, h) { editId = null; B = { studio: sid, date, slot: `${date} ${h}:00` }; ensurePkg(); go("time"); }
function startBook(sid) { editId = null; B = { studio: sid, date: S.hDate || todayS(), slot: null }; ensurePkg(); go("time"); }

// ---------- detail studio + properti ----------
function togProp(id) {
  const p = PROP.find(x => x.id == id); if (!p || p.qty <= 0) return; const st = S.setup;
  if (p.type === "background") st.bg = st.bg == id ? null : id; else { const i = st.acc.indexOf(id); i < 0 ? st.acc.push(id) : st.acc.splice(i, 1); }
  save(); render();
}
const setupItems = st => [st.bg, ...(st.acc || [])].filter(Boolean).map(id => PROP.find(p => p.id == id)).filter(Boolean);
function previewHTML(st) {
  const bg = PROP.find(p => p.id == st.bg), acc = (st.acc || []).map(id => PROP.find(p => p.id == id)).filter(Boolean);
  const style = bg ? (bg.img ? bgi(bg.img) : bg.bg ? `background-image:linear-gradient(135deg,${esc(bg.bg)})` : "") : "";
  return `<div class="pv" style="${style}"><div class="acc">${acc.map(a => `<span title="${esc(a.name)}" style="${a.img ? bgi(a.img) : ""}">${a.img ? "" : esc(a.e || "🎁")}</span>`).join("")}</div></div>`;
}
V.studio = () => {
  const s = studioOf(S.p.id), st = S.setup, cat = S.pCat || "Semua", cats = ["Semua", ...new Set(PROP.map(p => p.category || "Lainnya"))], list = PROP.filter(p => cat === "Semua" || (p.category || "Lainnya") === cat);
  const add = setupItems(st).reduce((a, p) => a + p.price, 0), on = S.bm.includes(s.id);
  return `<button class="back" onclick="go('home')">${ic("left", 16)} Kembali</button>
<div class="sdet"><div class="left stack"><div class="bigcard"><div class="simg" style="${bgi(s.img)}"></div><div class="sbody"><div class="row sp" style="flex-wrap:nowrap"><h1 class="h2">${esc(s.name)}</h1><button class="star ${on ? "on" : ""}" aria-label="Favorit" onclick="toggleBm(${s.id})">${icf("star", 20)}</button></div>
<p class="desc" style="-webkit-line-clamp:6">${esc(s.description)}</p><div class="row" style="margin-top:6px;color:var(--muted-2);font-size:12px">${ic("pin", 14)} ${esc(s.address || "-")}</div>
<div class="row sp" style="margin-top:12px"><button class="btn" onclick="startBook(${s.id})">Book Now</button><div class="meta" style="margin:0"><span>${ic("users", 14)} ${esc(capLabel(s))}</span><span>${ic("tag", 14)} ${priceRange(s)}</span></div></div></div></div>
<div class="card"><div class="row sp"><h3 class="h3">Pratinjau Setup</h3>${setupItems(st).length ? `<button class="btn sm ghost" onclick="S.setup={bg:null,acc:[]};save();render()">Reset</button>` : ""}</div>${previewHTML(st)}
<p class="sm m" style="margin-top:8px">${setupItems(st).length ? setupItems(st).map(p => esc(p.name)).join(", ") + ` · add-on <b>${rp(add)}</b>` : "Pilih background & aksesori dari daftar properti. Tersimpan otomatis dan ikut ke pemesanan."}</p></div></div>
<div><h2 class="h2">Properti</h2><p class="sub">Background dan aksesori yang tersedia — klik untuk menambahkan ke sesi kamu.</p>
<div class="tabsx">${cats.map(c => `<button class="tabx ${c === cat ? "on" : ""}" onclick="S.pCat='${esc(c)}';render()">${esc(c)}</button>`).join("")}</div>
<div class="props">${list.map(p => { const on2 = st.bg == p.id || st.acc.includes(p.id), off = p.qty <= 0; return `<button class="prop ${on2 ? "on" : ""} ${off ? "off" : ""}" ${off ? "disabled" : ""} onclick="togProp(${p.id})">${propVisual(p)}${on2 ? `<span class="pchk">${ic("check", 16)}</span>` : ""}<div class="pinfo"><div><b>${esc(p.name)}</b><div class="sm m">${p.price ? "+" + rp(p.price) : "Gratis"}</div></div><small>${off ? "Habis" : "Qty. " + p.qty}</small></div></button>`; }).join("") || '<p class="m">Belum ada properti.</p>'}</div></div></div>`;
};

// ---------- booking: langkah 1 (tanggal & waktu) ----------
V.time = () => {
  if (!B.studio) return `<div class="card">Pilih studio terlebih dahulu.</div>`;
  const s = studioOf(B.studio), d = B.date || (B.date = todayS()), fr = free(s.id, d);
  return `<div class="panel"><button class="back" onclick="editId?go('bdetail',{id:editId}):go('studio',{id:${s.id}})">${ic("left", 16)} ${editId ? "Batal ubah jadwal" : "Kembali"}</button>
<div class="row sp"><div><h1 class="h1">${editId ? "Ubah Jadwal" : "Pilih Tanggal & Waktu"}</h1><p class="sub">${esc(s.name)} · ${esc(s.address || "")}</p></div>${editId ? "" : '<span class="steps">1/2</span>'}</div>
<div class="card" style="margin-top:16px"><div class="bk"><div><h3 class="h3" style="margin-bottom:10px">Pilih Tanggal</h3>${calHTML("book", d)}</div>
<div><h3 class="h3">Pilih Sesi</h3><p class="sub">${fmtDate(d)} · tiap sesi 50 menit</p><div class="slots">${HRS.map(h => { const dt = `${d} ${h}:00`; return `<button class="pill ${B.slot == dt ? "on" : ""}" ${fr.includes(h) ? "" : "disabled"} onclick="B.slot='${dt}';render()">${slotLabel(h)}</button>`; }).join("")}</div></div></div>
<button class="btn block" style="margin-top:22px" ${B.slot ? "" : "disabled"} onclick="nextTime()">${editId ? "Simpan Jadwal Baru" : "Lanjut ke Pembayaran"}</button></div></div>`;
};
const setupPayload = () => (S.setup.bg || S.setup.acc.length) ? { bg: S.setup.bg, acc: S.setup.acc } : null;
async function loadQuote(code) { Q = await API.post("/quote", { package_id: S.pkg, studio_id: B.studio, setup: setupPayload(), code: code || undefined }); }
async function nextTime() {
  if (editId) {
    try { await API.patch("/bookings/" + editId, { studio_id: B.studio, date: B.slot }); const id = editId; editId = null; await refresh(); return go("rescheduled", { id }); }
    catch (e) { err = e.message; B.slot = null; AV = {}; return render(); }
  }
  Q = null; promoCode = ""; try { await loadQuote(); } catch (e) { err = e.message; return render(); } go("pay");
}

// ---------- booking: langkah 2 (paket & pembayaran) ----------
function qr() {
  let h = 7, r = ""; for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) { h = (h * 31 + x * 17 + y * 13 + (B.studio || 1)) % 97; const fx = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (fx ? (x % 6 == 0 || y % 6 == 0 || x == 14 || x == 20 || y == 14 || y == 20 || (x % 6 > 1 && x % 6 < 5 && y % 6 > 1 && y % 6 < 5)) : h % 2) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; }
  return `<svg viewBox="0 0 21 21" width="160" fill="#1c2748" style="background:#fff;padding:8px;border-radius:12px;border:1px solid var(--line-2)">${r}</svg>`;
}
async function applyPromo() { const c = $("#pc").value.trim(); msg = err = ""; try { await loadQuote(c); promoCode = c; if (c) msg = "Kode promo diterapkan."; } catch (e) { err = e.message; try { await loadQuote(promoCode); } catch (x) { promoCode = ""; await loadQuote(); } } render(); }
async function selectPkg(id) { S.pkg = id; save(); msg = err = ""; try { await loadQuote(promoCode); } catch (e) { promoCode = ""; await loadQuote(); } render(); }
V.pay = () => {
  if (!B.slot || !S.pkg || !Q) return `<div class="card">Pilih jadwal terlebih dahulu.</div>`;
  const s = studioOf(B.studio), p = pkOf(S.pkg), col = f => PKG.map(x => `<td class="${x.id == S.pkg ? "sel" : ""}">${f(x)}</td>`).join(""), method = S.method || "QRIS";
  return `<div class="panel"><button class="back" onclick="go('time')">${ic("left", 16)} Kembali</button><div class="row sp"><h1 class="h1">Paket & Pembayaran</h1><span class="steps">2/2</span></div>
<div class="card" style="margin-top:16px"><div class="bk"><div><h2 class="h2">Paket</h2><div style="overflow-x:auto;margin-top:8px"><table class="cmp"><tr><th>Fitur</th>${PKG.map(x => `<th>${esc(x.name)}</th>`).join("")}</tr>
<tr><td>Strip</td>${col(x => x.photo_count + " foto")}</tr><tr><td>Ukuran</td>${col(x => esc(x.strip_size || "-"))}</tr><tr><td>Bahan</td>${col(x => esc(x.strip_material || "-"))}</tr><tr><td>Durasi</td>${col(x => x.dur + " mnt")}</tr><tr><td>Cloud</td>${col(() => "30 hari")}</tr><tr><td>Harga</td>${col(x => ptag(x))}</tr></table></div>
<p class="sm m" style="margin-top:14px">${ic("calendar", 14)} ${esc(s.name)} · ${fmtDate(parseSlot(B.slot).date)} · ${slotRange(B.slot)}</p></div>
<div><h3 class="h3">Pilih Paket</h3><div class="pkpick">${PKG.map(x => `<button class="pill ${x.id == S.pkg ? "on" : ""}" onclick="selectPkg(${x.id})">${esc(x.name)}</button>`).join("")}</div>
<h3 class="h3">Rincian Pembayaran</h3><div style="margin-top:6px">${Q.studio_fee ? `<div class="kv"><span>Studio</span><b>${rp(Q.studio_fee)}</b></div>` : ""}<div class="kv"><span>Paket ${esc(p.name)}</span><b>${rp(p.price)}</b></div>${Q.add ? `<div class="kv"><span>Add-on setup</span><b>${rp(Q.add)}</b></div>` : ""}
${Q.mainDisc ? `<div class="kv disc"><span>Diskon utama (${Q.pct}%)</span><b>-${rp(Q.mainDisc)}</b></div>` : ""}${Q.promoDisc ? `<div class="kv disc"><span>Kode promo ${esc(Q.promo_code)}</span><b>-${rp(Q.promoDisc)}</b></div>` : ""}<div class="kv total"><span>Total</span><b>${rp(Q.total)}</b></div></div>
<label>Kode promo</label><div class="row" style="flex-wrap:nowrap"><input id="pc" value="${esc(promoCode)}" placeholder="Masukkan kode" onkeydown="if(event.key==='Enter')applyPromo()"><button class="btn ghost" onclick="applyPromo()">Terapkan</button></div>
<label>Metode pembayaran</label><select onchange="S.method=this.value;render()"><option ${method == "QRIS" ? "selected" : ""}>QRIS</option><option ${method == "Transfer Bank" ? "selected" : ""}>Transfer Bank</option></select>
<div class="qr">${method == "QRIS" ? qr() : `<div class="sm m center" style="padding:14px">Transfer ke <b>BCA 123 456 7890</b><br>a.n. ${esc(BRAND)} (simulasi)</div>`}</div>
<button class="btn block" onclick="confirmPay()">Check Out</button></div></div></div></div>`;
};
async function confirmPay() {
  try { const b = await API.post("/bookings", { package_id: S.pkg, studio_id: B.studio, date: B.slot, setup: setupPayload(), code: promoCode || undefined }); await API.post(`/bookings/${b.id}/pay`, { method: S.method || "QRIS" });
    B.slot = null; Q = null; promoCode = ""; S.setup = { bg: null, acc: [] }; await refresh(); S.payOpen = false; go("success", { id: b.id }); }
  catch (e) { err = e.message; AV = {}; render(); }
}

// ---------- halaman hasil: sukses, reschedule ----------
const addonOf = b => (b.setup ? [b.setup.bg, ...(b.setup.acc || [])].filter(Boolean).reduce((a, id) => a + ((PROP.find(p => p.id == id) || {}).price || 0), 0) : 0);
const PAYLBL = { paid: "Lunas", refunded: "Refunded", refund_failed: "Refund gagal", pending: "Menunggu pembayaran", batal: "Batal" };
function payRows(b) {
  const add = addonOf(b), fee = b.studio_fee || 0, r = []; if (fee) r.push(["Studio", rp(fee)]); r.push(["Paket " + pkOf(b.package_id).name, rp(b.subtotal - add - fee)]); if (add) r.push(["Add-on setup", rp(add)]);
  if (b.main_disc) r.push(["Diskon utama", "-" + rp(b.main_disc), "disc"]); if (b.promo_disc) r.push(["Kode promo " + (b.promo_code || ""), "-" + rp(b.promo_disc), "disc"]); r.push(["Total", rp(b.amount), "total"]); return r;
}
const kvs = rows => rows.map(r => `<div class="kv ${r[2] || ""}"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("");
const bookRows = b => { const s = studioOf(b.studio), pt = parseSlot(b.date); return kvs([["Studio", esc(s.name)], ["Paket", esc(pkOf(b.package_id).name)], ["Tanggal", fmtDMY(pt.date)], ["Jam", slotRange(b.date)], ["Lokasi", esc(s.address || "-")]]); };
const payDetail = b => kvs([["Waktu", fmtTime(b.paid_at)], ["Status", PAYLBL[b.pay_status] || b.pay_status], ["Metode", esc(b.method || "-")], ...payRows(b)]);
const bookOf = () => S.bookings.find(x => x.id == (S.p && S.p.id));
V.success = () => {
  const b = bookOf(); if (!b) return `<div class="card">Memuat…</div>`;
  return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Studio Berhasil Direservasi</h1><img class="ill" src="img/ill-booking.png" alt="">
<div style="text-align:left;margin-top:8px"><h3 class="h3" style="margin-bottom:6px">Detail Transaksi</h3>${bookRows(b)}<button class="coll" onclick="S.payOpen=!S.payOpen;render()">Detail Pembayaran ${ic(S.payOpen ? "up" : "down", 16)}</button>${S.payOpen ? `<div style="padding-bottom:10px">${payDetail(b)}</div>` : ""}</div>
<div class="row" style="margin-top:12px;flex-wrap:nowrap"><a class="btn ghost grow" href="${API.invUrl(b.id, 1)}" download>${ic("download", 16)} Unduh invoice</a><button class="btn ghost" onclick="mailInv(${b.id})">${ic("mail", 16)}</button></div>
<button class="btn block" style="margin-top:10px" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
};
V.rescheduled = () => {
  const b = bookOf(); if (!b) return `<div class="card">Memuat…</div>`;
  return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Reschedule Berhasil</h1><img class="ill" src="img/ill-reschedule.png" alt=""><div style="text-align:left">${bookRows(b)}</div><button class="btn block" style="margin-top:18px" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
};
async function mailInv(id) { msg = err = ""; try { const r = await API.post(`/bookings/${id}/invoice/email`); msg = r.dev ? "Mode pengembangan: SMTP belum diatur, email disimpan di folder backend/outbox." : "Invoice dikirim ke email Anda."; } catch (e) { err = e.message; } render(); }

// ---------- Booking Saya ----------
const UPCOMING = ["Menunggu Pembayaran", "Terbayar", "Sesi Berjalan"];
const stTag = b => `<span class="tag ${["Terbayar", "Selesai", "Sesi Berjalan"].includes(b.status) ? "ok" : b.status == "Dibatalkan" ? "no" : "warn"}">${b.status}</span>`;
V.my = () => {
  const tab = S.myTab || "up"; S.bookings.forEach(b => { if (b.status == "Menunggu Pembayaran" && Date.now() > b.expire_at) b.status = "Dibatalkan"; });
  let L = S.bookings.filter(b => b.user_id == S.me && (tab == "up" ? UPCOMING.includes(b.status) : !UPCOMING.includes(b.status))); L.sort((a, b) => tab == "up" ? (a.date < b.date ? -1 : 1) : (a.date < b.date ? 1 : -1));
  const groups = {}; L.forEach(b => (groups[parseSlot(b.date).date] = groups[parseSlot(b.date).date] || []).push(b));
  return `<div class="panel"><h1 class="h1">Booking Saya</h1><div class="seg"><button class="${tab == "up" ? "on" : ""}" onclick="S.myTab='up';render()">Mendatang</button><button class="${tab == "hist" ? "on" : ""}" onclick="S.myTab='hist';render()">Riwayat</button></div>
${Object.keys(groups).map(d => `<div class="dayh">${fmtDate(d)}</div>${groups[d].map(b => `<button class="brow" onclick="go('bdetail',{id:${b.id}})"><div><b>${esc(studioOf(b.studio).name)}</b><div class="sub">${esc(pkOf(b.package_id).name)} · ${stTag(b)}</div></div><b>${slotRange(b.date)}</b></button>`).join("")}`).join("") || `<div class="card center m" style="margin-top:12px">${tab == "up" ? "Belum ada booking mendatang." : "Belum ada riwayat booking."}<div style="margin-top:12px"><button class="btn" onclick="go('home')">Cari studio</button></div></div>`}</div>`;
};
const canChange = b => ["Menunggu Pembayaran", "Terbayar"].includes(b.status);
function startReschedule(id) { const b = S.bookings.find(x => x.id == id); editId = id; B = { studio: b.studio, date: parseSlot(b.date).date, slot: null }; go("time"); }
async function payNow(id) { if (!confirm("Bayar sekarang via QRIS (simulasi)?")) return; try { await API.post(`/bookings/${id}/pay`, { method: "QRIS" }); await refresh(); S.payOpen = false; go("success", { id }); } catch (e) { err = e.message; render(); } }
V.bdetail = () => {
  const b = bookOf(); if (!b) return `<div class="panel"><button class="back" onclick="go('my')">${ic("left", 16)} Kembali</button><div class="card">Booking tidak ditemukan.</div></div>`;
  const s = studioOf(b.studio), pt = parseSlot(b.date), pending = b.status == "Menunggu Pembayaran";
  return `<div class="panel"><button class="back" onclick="go('my')">${ic("left", 16)} Booking Saya</button>
<div class="row sp" style="align-items:flex-start"><div><h1 class="h1"><a href="#" style="color:inherit;text-decoration:none" onclick="go('studio',{id:${s.id}});return false">${esc(s.name)} ${ic("ext", 18)}</a></h1><div class="h1" style="font-size:24px">${slotRange(b.date)}</div></div><div style="text-align:right"><div class="h2">${fmtDate(pt.date)}</div>${stTag(b)}</div></div>
<div class="row" style="margin:16px 0">${canChange(b) ? `<button class="btn sm" onclick="startReschedule(${b.id})">Reschedule</button><button class="btn sm ghost" onclick="openCancel(${b.id})">Batalkan</button>` : ""}${pending ? `<button class="btn sm" onclick="payNow(${b.id})">Bayar</button>` : ""}${b.status == "Terbayar" ? `<button class="btn sm soft" onclick="startSession(${b.id})">${ic("camera", 16)} Check-in & Mulai Sesi</button>` : ""}${b.status == "Sesi Berjalan" ? `<button class="btn sm soft" onclick="go('session')">Buka Sesi</button>` : ""}</div>
<div class="card"><h3 class="h3" style="margin-bottom:6px">Detail Booking</h3>${bookRows(b)}<hr><h3 class="h3" style="margin-bottom:6px">Detail Pembayaran</h3>${payDetail(b)}
${b.cancel_reason ? `<hr><div class="kv"><span>Alasan pembatalan</span><b>${esc(b.cancel_reason)}</b></div>` : ""}
${b.paid && b.status != "Dibatalkan" ? `<div class="row" style="margin-top:12px"><a class="btn sm ghost" href="${API.invUrl(b.id, 1)}" download>${ic("download", 16)} Unduh invoice</a><button class="btn sm ghost" onclick="mailInv(${b.id})">${ic("mail", 16)} Kirim ke email</button></div>` : ""}</div></div>`;
};

// ---------- pembatalan & refund ----------
const REASONS = ["Tidak ada waktu", "Penggunaan dana lain", "Pemesanan ganda", "Pembatalan lainnya"]; let CR = "", CD = "";
function openCancel(id) { CR = ""; CD = ""; go("cancel", { id }); }
V.cancel = () => {
  const b = bookOf(); if (!b) return `<div class="card">Booking tidak ditemukan.</div>`; const paid = b.paid;
  return `<div class="panel"><button class="back" onclick="go('bdetail',{id:${b.id}})">${ic("left", 16)} Kembali</button><h1 class="h1">Pembatalan Booking</h1><p class="sub">${esc(studioOf(b.studio).name)} · ${fmtDate(parseSlot(b.date).date)} · ${slotRange(b.date)}</p>
<div class="card" style="margin-top:16px"><h3 class="h3">Alasan Pembatalan</h3><div class="reasons">${REASONS.map(r => `<button class="reason ${CR == r ? "on" : ""}" onclick="CR='${r}';render()"><i></i>${r}</button>`).join("")}</div>
${CR == "Pembatalan lainnya" ? `<textarea placeholder="Tuliskan alasan pembatalan kamu" oninput="CD=this.value">${esc(CD)}</textarea>` : ""}
${paid ? `<p class="sm m" style="margin:10px 0">${ic("clock", 14)} Refund diproses otomatis jika pembatalan dilakukan minimal ${POLICY.refund_hours} jam sebelum sesi dimulai.</p>` : ""}
<button class="btn block" style="margin-top:8px" ${CR ? "" : "disabled"} onclick="doCancel(${b.id})">${paid ? "Refund" : "Batalkan Booking"}</button></div></div>`;
};
async function doCancel(id) {
  if (!confirm("Yakin membatalkan booking ini?")) return;
  try { const r = await API.post(`/bookings/${id}/cancel`, { reason: CR, detail: CD }); S.cancelRes = r; await refresh(); go("refund", { id }); } catch (e) { err = e.message; render(); }
}
V.refund = () => {
  const r = S.cancelRes, b = bookOf(); if (!r || !b) return `<div class="panel"><div class="card center">Booking dibatalkan.<div style="margin-top:12px"><button class="btn" onclick="go('home')">Kembali ke Beranda</button></div></div></div>`;
  const st = r.refund.state;
  if (st == "refunded") return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Refund Berhasil</h1><img class="ill" src="img/ill-refund-ok.png" alt=""><div style="text-align:left">${kvs([["Waktu", fmtTime(r.refund.at)], ["Status", "Refunded"], ["Total", rp(r.refund.amount)]])}</div><button class="btn block" style="margin-top:18px" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
  if (st == "failed") return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Maaf Refund Gagal</h1><img class="ill" src="img/ill-refund-fail.png" alt=""><p class="m sm">Booking sudah dibatalkan, namun refund hanya tersedia untuk pembatalan minimal ${r.refund.min_hours} jam sebelum sesi.</p><button class="btn block" style="margin-top:18px" onclick="csContact()">Hubungi Customer Service</button><button class="btn ghost block" style="margin-top:10px" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
  return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Booking Dibatalkan</h1><p class="m" style="margin:10px 0 18px">Booking belum dibayar, jadi tidak ada refund yang diperlukan.</p><button class="btn block" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
};

// ---------- akun: profil, preferensi, riwayat pembayaran ----------
V.account = () => {
  const tab = S.acct || "profile", u = me(), tabs = [["profile", "Edit Profil"], ["pref", "Preferensi"], ["pay", "Riwayat Pembayaran"]];
  let body = "";
  if (tab == "profile") body = `<div class="card"><h3 class="h3">Edit Profil</h3><label>Nama</label><input id="pn" value="${esc(u.name)}"><label>Telepon</label><input id="pp" value="${esc(u.phone || "")}" inputmode="numeric"><label>Email</label><input value="${esc(u.email)}" disabled>
<div class="row" style="margin-top:18px"><button class="btn" onclick="saveProfile()">Simpan</button><button class="btn ghost" onclick="changePw()">${ic("mail", 16)} Ubah sandi via email</button></div></div>`;
  if (tab == "pref") { const q = S.quiz || {}, rec = recPkg(); body = `<div class="card"><h3 class="h3">Preferensi</h3><p class="sub">Dipakai untuk merekomendasikan paket yang paling pas.</p>
<label>Tujuan sesi foto</label><select id="q1"><option value="">-- pilih --</option>${PURPOSES.map(x => `<option ${q.purpose == x ? "selected" : ""}>${x}</option>`).join("")}</select>
<label>Jumlah peserta</label><select id="q2"><option value="">-- pilih --</option>${PEOPLE.map(x => `<option value="${x.id}" ${q.people == x.id ? "selected" : ""}>${x.range} orang</option>`).join("")}</select>
<label>Vibe / style</label><select id="q3"><option value="">-- pilih --</option>${VIBES.map(x => `<option value="${x.id}" ${q.vibe == x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
<label>Budget (Rp)</label><input id="q4" type="number" min="0" value="${q.budget || ""}"><button class="btn" style="margin-top:18px" onclick="savePref()">Simpan Preferensi</button></div>
${rec ? `<div class="card soft" style="margin-top:14px"><div class="row sp"><div><span class="tag">Rekomendasi</span><h3 class="h3" style="margin-top:6px">Paket ${esc(rec.name)} — ${rp(eff(rec))}</h3><p class="sm m">${rec.photo_count} foto · ${rec.dur} menit · strip ${esc(rec.strip_size || "-")}</p></div><button class="btn" onclick="go('home')">Cari studio</button></div></div>` : ""}`; }
  if (tab == "pay") { const L = S.bookings.filter(b => b.pay_status && !["pending", "batal"].includes(b.pay_status)).sort((a, b) => (b.paid_at || 0) - (a.paid_at || 0));
    body = `<div class="card"><h3 class="h3">Riwayat Pembayaran</h3>${L.length ? `<div class="tbl"><table><tr><th>Waktu</th><th>Studio</th><th>Paket</th><th>Total</th><th>Status</th><th></th></tr>${L.map(b => `<tr><td>${fmtTime(b.paid_at)}</td><td>${esc(studioOf(b.studio).name)}</td><td>${esc(pkOf(b.package_id).name)}</td><td>${rp(b.amount)}</td><td><span class="tag ${b.pay_status == "paid" ? "ok" : b.pay_status == "refunded" ? "" : "no"}">${PAYLBL[b.pay_status]}</span></td>
<td>${b.paid && b.status != "Dibatalkan" ? `<a class="btn sm ghost" href="${API.invUrl(b.id, 0)}" target="_blank" rel="noopener">${ic("receipt", 14)} Kwitansi Digital</a>` : ""}</td></tr>`).join("")}</table></div>` : `<p class="m" style="margin-top:8px">Belum ada transaksi.</p>`}</div>`; }
  return `<div class="panel"><h1 class="h1">Pengaturan Akun</h1><div class="seg">${tabs.map(t => `<button class="${t[0] == tab ? "on" : ""}" onclick="S.acct='${t[0]}';msg=err='';render()">${t[1]}</button>`).join("")}</div>${body}<div style="margin-top:18px"><button class="btn ghost" onclick="logout()">${ic("logout", 16)} Keluar</button></div></div>`;
};
async function saveProfile() { msg = err = ""; try { const r = await API.patch("/me", { name: $("#pn").value, phone: $("#pp").value }); S.user = { ...S.user, ...r }; save(); msg = "Profil disimpan."; } catch (e) { err = e.message; } render(); }
async function savePref() {
  const q = { purpose: $("#q1").value, people: +$("#q2").value, vibe: +$("#q3").value, budget: +$("#q4").value }; msg = err = "";
  if (!q.purpose || !q.people || !q.vibe || !(q.budget > 0)) { err = "Lengkapi semua preferensi dengan benar."; S.quiz = { ...q }; return render(); }
  q.ok = true; S.quiz = q; save(); try { await API.put("/preferences", { people: q.people, budget: q.budget, vibe: q.vibe }); msg = "Preferensi disimpan."; } catch (e) { err = e.message; } render();
}
