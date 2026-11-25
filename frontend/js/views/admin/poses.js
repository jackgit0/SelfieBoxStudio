// Daftar Pose admin (/admin/poses): foto contoh pose dan jumlah orang per baris (tanpa nama), lalu tombol + Tambah pose. View murni (dulu poseRow, V.apose di admin.js).
// Baris tampil hanya-baca dengan Ubah dan Hapus; hanya baris admin.editing ("pose-<id|new>") yang menjadi form dengan Simpan/Tambah dan Batal
// (dev/admin-edit-mode-plan.md). Form baris memakai <form> sendiri (atribut form=); foto diunggah lewat data-change="admin:uploadPoseImage" seperti Properti.
// Foto baru di admin.images["pose-<id|new>"], isian yang gagal/sedang diisi di admin.drafts["pose-<id|new>"].
import { html } from "../../core/html.js";
import { backgroundImage } from "../../components/propertyVisual.js";
import { icon } from "../../components/icon.js";
import { loadingCard, selectField } from "../../components/adminWidgets.js";

const rangeLabel = (peopleRanges, id) => {
  const range = peopleRanges.find(item => item.id == id);
  return range ? range.range + " orang" : "";
};

// baris hanya-baca: foto dan jumlah orang, Ubah dan Hapus
function poseView(pose, peopleRanges) {
  const people = rangeLabel(peopleRanges, pose.people_range_id);
  return html`<tr>
    <td>
      <span class="pthumb ro" style="${pose.img_url ? backgroundImage(pose.img_url) : ""}" role="img" aria-label="Foto pose ${people}"
        >${pose.img_url ? "" : icon("images", 20)}</span
      >
    </td>
    <td>${people}</td>
    <td style="white-space:nowrap">
      <button class="btn sm ghost" type="button" data-action="admin:startEdit" data-key="pose-${pose.id}" aria-label="Ubah pose ${people}">
        Ubah</button
      > <button class="btn sm ghost" type="button" data-action="admin:deletePose" data-id="${pose.id}">Hapus</button>
    </td>
  </tr>`;
}

// baris form (pose yang diubah, atau baris tambah bila pose kosong)
function poseForm(pose, admin, peopleRanges) {
  const key = pose.id || "new";
  const formId = "pose-form-" + key;
  const values = admin.drafts["pose-" + key] || pose;
  const image = admin.images["pose-" + key] || pose.img_url;
  const range = peopleRanges.find(item => item.id == (values.people_range_id || 1));
  const submit = pose.id
    ? html`<form id="${formId}" novalidate data-submit="admin:savePose" data-id="${pose.id}"></form>`
    : html`<form id="${formId}" novalidate data-submit="admin:addPose"></form>`;
  const ranges = peopleRanges.map(item => [item.id, item.range + " orang"]);
  return html`<tr>
    <td>
      <label class="pthumb" style="${image ? backgroundImage(image) : ""}"
        >${image ? "" : icon("upload", 20)}<input
          type="file"
          accept="image/*"
          hidden
          form="${formId}"
          data-change="admin:uploadPoseImage"
          data-key="${key}"
          aria-label="${pose.id ? `Foto pose ${range ? range.range + " orang" : ""}` : "Foto pose baru"}"
      /></label>
    </td>
    <td>
      ${selectField({ id: `po${key}r`, name: "people_range_id", options: ranges, current: values.people_range_id || 1, attributes: html`form="${formId}" aria-label="Jumlah orang" data-edit-focus` })}
    </td>
    <td style="white-space:nowrap">
      ${submit}<button class="btn sm" type="submit" form="${formId}">${pose.id ? "Simpan" : "Tambah"}</button
      > <button class="btn sm ghost" type="button" data-action="admin:cancelEdit">Batal</button>
    </td>
  </tr>`;
}

export function posesView(state) {
  const admin = state.admin;
  if (!admin.poses) {
    return loadingCard();
  }
  const peopleRanges = state.master.peopleRanges;
  const rows = admin.poses.map(pose =>
    admin.editing == "pose-" + pose.id ? poseForm(pose, admin, peopleRanges) : poseView(pose, peopleRanges),
  );
  const adding = admin.editing == "pose-new";
  return html`<div class="card">
    <div class="tbl">
      <table>
        <tr>
          <th>Foto</th>
          <th>Jumlah orang</th>
          <th></th>
        </tr>
        ${rows}${adding ? poseForm({}, admin, peopleRanges) : ""}
      </table>
    </div>
    ${adding
      ? ""
      : html`<button class="btn sm" type="button" style="margin-top:12px" data-action="admin:startEdit" data-key="pose-new">
          ${icon("plus", 16)} Tambah pose
        </button>`}
    <p class="sm m" style="margin-top:8px">
      Foto wajib diunggah saat menambah pose. Pose tampil di Sesi Foto sebagai contoh gaya sesuai jumlah orang.
    </p>
  </div>`;
}
