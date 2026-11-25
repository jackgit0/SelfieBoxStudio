// Paket & Diskon (/admin/packages): kartu diskon utama dan tabel paket (ubah, aktifkan, hapus, tambah).
// View murni (dulu V.apkg di admin.js). Semua tampil hanya-baca dengan Ubah; hanya record admin.editing ("package-<id>", "package-new",
// "discount") yang menjadi form dengan Simpan/Tambah dan Batal (dev/admin-edit-mode-plan.md). Baris form punya <form> sendiri; input di sel lain
// terikat lewat atribut form= (form tidak boleh membungkus <tr>). Isian yang gagal disimpan dibaca dari admin.drafts dengan kunci yang sama.
import { html } from "../../core/html.js";
import { formatRupiah } from "../../core/format.js";
import { icon } from "../../components/icon.js";
import { loadingCard } from "../../components/adminWidgets.js";

// kolom baris paket: [nama field, tipe, lebar px]
const COLUMNS = [
  ["name", "text", 90],
  ["price", "number", 110],
  ["photo_count", "number", 70],
  ["dur", "number", 70],
  ["strip_size", "text", 70],
  ["strip_material", "text", 90],
];
const LABELS = {
  name: "Nama",
  price: "Harga (Rp)",
  photo_count: "Jml foto",
  dur: "Durasi (mnt)",
  strip_size: "Ukuran strip",
  strip_material: "Material",
};

function packageInputs(formId, values) {
  return COLUMNS.map(
    ([name, type, width], index) =>
      html`<td>
        <input
          form="${formId}"
          name="${name}"
          ${index == 0 ? "data-edit-focus" : ""}
          value="${values[name] ?? ""}"
          type="${type}"
          ${type == "number" ? "min=0" : ""}
          aria-label="${LABELS[name]}"
          style="width:${width}px"
        />
      </td>`,
  );
}

const statusTag = pkg => html`<span class="tag ${pkg.active ? "ok" : "no"}">${pkg.active ? "aktif" : "nonaktif"}</span>`;
const cancelButton = html`<button class="btn sm ghost" type="button" data-action="admin:cancelEdit">Batal</button>`;

// isi sel hanya-baca: harga dalam rupiah, kolom kosong = "-"
function cellText(name, value) {
  if (name == "price") {
    return formatRupiah(value || 0);
  }
  return value === "" || value == null ? "-" : value;
}

// baris hanya-baca: Ubah, Aktifkan (paket nonaktif), Hapus
function packageView(pkg) {
  const activate = pkg.active
    ? ""
    : html`<button class="btn sm soft" type="button" data-action="admin:activatePackage" data-id="${pkg.id}">
        Aktifkan
      </button> `;
  return html`<tr>
    ${COLUMNS.map(([name]) => html`<td>${cellText(name, pkg[name])}</td>`)}
    <td>${statusTag(pkg)}</td>
    <td style="white-space:nowrap">
      <button class="btn sm ghost" type="button" data-action="admin:startEdit" data-key="package-${pkg.id}" aria-label="Ubah ${pkg.name}">
        Ubah</button
      > ${activate}<button class="btn sm ghost" type="button" data-action="admin:deletePackage" data-id="${pkg.id}">
        Hapus
      </button>
    </td>
  </tr>`;
}

// baris form paket yang diubah: Simpan + Batal
function packageForm(pkg, draft) {
  const formId = "package-form-" + pkg.id;
  return html`<tr>
    ${packageInputs(formId, draft || pkg)}
    <td>${statusTag(pkg)}</td>
    <td style="white-space:nowrap">
      <form id="${formId}" novalidate data-submit="admin:savePackage" data-id="${pkg.id}"></form>
      <button class="btn sm" type="submit" form="${formId}">Simpan</button> ${cancelButton}
    </td>
  </tr>`;
}

// baris paket baru (setelah + Tambah paket): Tambah + Batal
function newPackageRow(draft) {
  const formId = "package-form-new";
  return html`<tr>
    ${packageInputs(formId, draft || {})}
    <td></td>
    <td style="white-space:nowrap">
      <form id="${formId}" novalidate data-submit="admin:addPackage"></form>
      <button class="btn sm" type="submit" form="${formId}">Tambah</button> ${cancelButton}
    </td>
  </tr>`;
}

const DISCOUNT_NOTE = "Potongan persen untuk harga semua paket (biaya studio tidak didiskon). Isi 0 untuk menonaktifkan.";

// kartu diskon hanya-baca: persen dan label, tombol Ubah
function discountView(discount) {
  const pct = Number(discount.pct) || 0;
  return html`<div class="card" style="margin-bottom:16px">
    <div class="row sp">
      <h3 class="h3">Diskon utama</h3>
      <button class="btn sm ghost" type="button" data-action="admin:startEdit" data-key="discount" aria-label="Ubah diskon utama">
        Ubah
      </button>
    </div>
    <p style="margin-top:8px">
      ${pct ? html`<b>${pct}%</b>${discount.label ? ` · ${discount.label}` : ""}` : html`<span class="m">Tidak ada diskon.</span>`}
    </p>
  </div>`;
}

function discountForm(discount) {
  return html`<form class="card" style="margin-bottom:16px" novalidate data-submit="admin:saveDiscount">
    <h3 class="h3">Diskon utama</h3>
    <p class="m sm">${DISCOUNT_NOTE}</p>
    <div class="row" style="margin-top:8px">
      <input
        id="d_pct"
        data-edit-focus
        name="pct"
        type="number"
        min="0"
        max="100"
        aria-label="Diskon (%)"
        value="${discount.pct}"
        style="width:90px"
      />
      %<input
        id="d_lbl"
        name="label"
        placeholder="Label (mis. Promo Kemerdekaan)"
        aria-label="Label diskon"
        value="${discount.label}"
        style="flex:1;min-width:160px"
      />
    </div>
    <div class="row" style="margin-top:12px">
      <button class="btn sm" type="submit">Simpan</button
      ><button class="btn sm ghost" type="button" data-action="admin:cancelEdit">Batal</button>
    </div>
  </form>`;
}

export function packagesView(state) {
  const { packages, discount, drafts, editing } = state.admin;
  if (!packages || !discount) {
    return loadingCard();
  }
  const header = html`<tr>
    ${COLUMNS.map(([name]) => html`<th>${LABELS[name]}</th>`)}
    <th>Status</th>
    <th></th>
  </tr>`;
  const rows = packages.map(pkg =>
    editing == "package-" + pkg.id ? packageForm(pkg, drafts["package-" + pkg.id]) : packageView(pkg),
  );
  const adding = editing == "package-new";
  return html`${editing == "discount" ? discountForm(drafts.discount || discount) : discountView(discount)}
    <div class="card" style="margin-bottom:16px">
      <h3 class="h3">Paket</h3>
      <div class="tbl">
        <table>
          ${header} ${rows} ${adding ? newPackageRow(drafts["package-new"]) : ""}
        </table>
      </div>
      ${adding
        ? ""
        : html`<button class="btn sm" type="button" style="margin-top:12px" data-action="admin:startEdit" data-key="package-new">
            ${icon("plus", 16)} Tambah paket
          </button>`}
      <p class="sm m" style="margin-top:8px">
        Harga baru hanya berlaku untuk booking berikutnya. Paket yang pernah dibeli hanya dinonaktifkan agar riwayat
        tetap utuh.
      </p>
    </div>`;
}
