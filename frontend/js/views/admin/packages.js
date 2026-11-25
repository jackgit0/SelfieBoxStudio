// Paket & Diskon (/admin/packages): form diskon utama dan tabel paket (ubah, aktifkan, hapus, tambah).
// View murni (dulu V.apkg di admin.js). Setiap baris tabel punya <form> sendiri; input di sel lain terikat lewat atribut form=
// (form tidak boleh membungkus <tr>). Isian yang gagal disimpan dibaca dari admin.drafts ("package-<id>", "package-new", "discount").
import { html } from "../../core/html.js";
import { loadingCard } from "../../components/adminWidgets.js";

// kolom baris paket: [nama field, tipe, lebar px]
const COLUMNS = [["name", "text", 90], ["price", "number", 110], ["photo_count", "number", 70], ["dur", "number", 70], ["strip_size", "text", 70], ["strip_material", "text", 90]];
const LABELS = { name: "Nama", price: "Harga (Rp)", photo_count: "Jml foto", dur: "Durasi (mnt)", strip_size: "Ukuran strip", strip_material: "Material" };

function packageInputs(formId, values) {
  return COLUMNS.map(([name, type, width]) => html`<td><input form="${formId}" name="${name}" value="${values[name] ?? ""}" type="${type}" ${type == "number" ? "min=0" : ""} aria-label="${LABELS[name]}" style="width:${width}px"></td>`);
}

function packageRow(pkg, draft) {
  const formId = "package-form-" + pkg.id;
  const activate = pkg.active ? "" : html`<button class="btn sm soft" type="button" data-action="admin:activatePackage" data-id="${pkg.id}">Aktifkan</button> `;
  return html`<tr>${packageInputs(formId, draft || pkg)}<td><span class="tag ${pkg.active ? "ok" : "no"}">${pkg.active ? "aktif" : "nonaktif"}</span></td><td style="white-space:nowrap"><form id="${formId}" novalidate data-submit="admin:savePackage" data-id="${pkg.id}"></form><button class="btn sm" type="submit" form="${formId}">Simpan</button> ${activate}<button class="btn sm ghost" type="button" data-action="admin:deletePackage" data-id="${pkg.id}">Hapus</button></td></tr>`;
}

function newPackageRow(draft) {
  const formId = "package-form-new";
  return html`<tr>${packageInputs(formId, draft || {})}<td></td><td><form id="${formId}" novalidate data-submit="admin:addPackage"></form><button class="btn sm" type="submit" form="${formId}">+ Tambah paket</button></td></tr>`;
}

function discountForm(discount) {
  return html`<form class="card" style="margin-bottom:16px" novalidate data-submit="admin:saveDiscount"><h3 class="h3">Diskon utama</h3><p class="m sm">Potongan persen untuk harga semua paket (biaya studio tidak didiskon). Isi 0 untuk menonaktifkan.</p>
<div class="row" style="margin-top:8px"><input id="d_pct" name="pct" type="number" min="0" max="100" aria-label="Diskon (%)" value="${discount.pct}" style="width:90px"> %<input id="d_lbl" name="label" placeholder="Label (mis. Promo Kemerdekaan)" aria-label="Label diskon" value="${discount.label}" style="flex:1;min-width:160px"><button class="btn" type="submit">Simpan</button></div></form>`;
}

export function packagesView(state) {
  const { packages, discount, drafts } = state.admin;
  if (!packages || !discount) {
    return loadingCard();
  }
  const header = html`<tr>${COLUMNS.map(([name]) => html`<th>${LABELS[name]}</th>`)}<th>Status</th><th></th></tr>`;
  return html`${discountForm(drafts.discount || discount)}
<div class="card" style="margin-bottom:16px"><h3 class="h3">Paket</h3><div class="tbl"><table>${header}
${packages.map(pkg => packageRow(pkg, drafts["package-" + pkg.id]))}
${newPackageRow(drafts["package-new"])}</table></div>
<p class="sm m" style="margin-top:8px">Harga baru hanya berlaku untuk booking berikutnya. Paket yang pernah dibeli hanya dinonaktifkan agar riwayat tetap utuh.</p></div>`;
}
