// Dashboard admin (/admin): kartu pendapatan, pendapatan 7 hari terakhir dan Rekapitulasi Operasional dengan form tambah/ubah item.
// View murni (dulu V.adash di admin.js). Form dikirim lewat data-submit (AdminController.saveOperation); isian yang gagal disimpan
// dibaca dari admin.drafts.operation.
import { html } from "../../core/html.js";
import { formatRupiah, todayIso } from "../../core/format.js";
import { PERIODS } from "../../models/admin/dashboard.js";
import { loadingCard, statCard } from "../../components/adminWidgets.js";

const selected = flag => (flag ? "selected" : "");

function revenueSection(revenue) {
  const daily = revenue.daily.map(day => html`<tr><td>${day.date}</td><td>${day.n}</td><td>${formatRupiah(day.total)}</td></tr>`);
  return html`<div class="stats">${statCard("Hari ini", revenue.today)}${statCard("7 hari terakhir", revenue.week)}${statCard("30 hari terakhir", revenue.month)}${statCard("Sejak pemesanan pertama", revenue.all, revenue.first_date ? " · mulai " + revenue.first_date : "")}</div>
<div class="card" style="margin-bottom:16px"><h3 class="h3" style="margin-bottom:8px">Pendapatan 7 hari terakhir</h3><div class="tbl"><table><tr><th>Tanggal</th><th>Transaksi</th><th>Pendapatan</th></tr>${daily}</table></div>
<p class="sm m" style="margin-top:8px">Pendapatan = pembayaran lunas (setelah diskon). Pembayaran yang sudah di-refund tidak dihitung; refund gagal tetap dihitung.</p></div>`;
}

function operationRows(items) {
  if (!items.length) {
    return html`<tr><td colspan="6" class="m">Belum ada item pada periode ini.</td></tr>`;
  }
  return items.map(item => html`<tr><td>${item.date}</td><td>${item.label}</td><td><span class="tag ${item.kind == "biaya" ? "no" : "ok"}">${item.kind}</span></td><td>${formatRupiah(item.amount)}</td><td>${item.note || ""}</td><td><button class="btn sm ghost" data-action="admin:editOperation" data-id="${item.id}">Ubah</button> <button class="btn sm ghost" data-action="admin:deleteOperation" data-id="${item.id}">Hapus</button></td></tr>`);
}

// values = draf yang gagal disimpan, item yang diubah, atau kosong (item baru)
function operationForm(values, editing) {
  const kind = values.kind || "biaya";
  return html`<form novalidate data-submit="admin:saveOperation"><h3 class="h3" style="margin:16px 0 4px">${editing ? "Ubah item" : "Tambah item"}</h3><div class="row"><input id="o_date" name="date" type="date" aria-label="Tanggal" value="${values.date || todayIso()}" style="width:auto"><input id="o_label" name="label" placeholder="Keterangan (mis. Sewa studio)" aria-label="Keterangan" value="${values.label || ""}" style="flex:1;min-width:160px">
<select id="o_kind" name="kind" aria-label="Jenis" style="width:auto"><option value="biaya" ${selected(kind == "biaya")}>Biaya</option><option value="pemasukan" ${selected(kind == "pemasukan")}>Pemasukan lain</option></select><input id="o_amt" name="amount" type="number" min="0" placeholder="Nominal" aria-label="Nominal" value="${values.amount ?? ""}" style="width:140px"><input id="o_note" name="note" placeholder="Catatan" aria-label="Catatan" value="${values.note || ""}" style="width:170px"></div>
<div class="row" style="margin-top:10px"><button class="btn" type="submit">${editing ? "Simpan perubahan" : "Tambah"}</button>${editing ? html`<button class="btn ghost" type="button" data-action="admin:cancelOperationEdit">Batal</button>` : ""}</div></form>`;
}

function operationsSection(operations, editing, draft) {
  const periods = PERIODS.map(([value, label]) => html`<option value="${value}" ${selected(operations.period == value)}>${label}</option>`);
  const stat = (label, amount, style = "") => html`<div class="stat"><small class="m">${label}</small><b style="${style}">${formatRupiah(amount)}</b></div>`;
  return html`<div class="card"><div class="row sp"><h3 class="h3">Rekapitulasi Operasional</h3><select style="width:auto" aria-label="Periode rekap" data-change="admin:setOperationsPeriod">${periods}</select></div>
<div class="stats" style="margin-top:12px">${stat("Pendapatan booking", operations.booking_revenue)}${stat("Pemasukan lain", operations.other_income)}${stat("Omset kotor", operations.gross)}${stat("Biaya operasional", operations.costs)}${stat("Omset bersih", operations.net, `color:${operations.net < 0 ? "var(--red)" : "var(--green)"}`)}</div>
<div class="tbl"><table><tr><th>Tanggal</th><th>Keterangan</th><th>Jenis</th><th>Nominal</th><th>Catatan</th><th></th></tr>${operationRows(operations.items)}</table></div>
${operationForm(draft || editing || {}, Boolean(editing))}</div>`;
}

export function dashboardView(state) {
  const { revenue, operations, editingOperation, drafts } = state.admin;
  if (!revenue || !revenue.today || !operations || !operations.period) {
    return loadingCard();
  }
  return html`${revenueSection(revenue)}
${operationsSection(operations, editingOperation, drafts.operation)}`;
}
