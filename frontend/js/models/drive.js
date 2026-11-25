// Google Drive (dulu driveAuth, driveFolder, uploadDrive dan hapus berkas Drive di legacy/session.js).
// Semua panggilan Google di dalam fungsi: tidak ada yang berjalan saat diimpor, dan tanpa GOOGLE_CLIENT_ID tidak ada yang diminta.
// Token dan folder disimpan pemanggil (slice photo.drive, PhotoSessionController); fetch dan google diberikan pemanggil.

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FILES = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
const BOUNDARY = "snapia";

// izin Google Drive lewat Google Identity: token akses, atau null bila tidak diatur / ditolak
export function authorize({ clientId, google }) {
  return new Promise(resolve => {
    if (!clientId || !google) {
      resolve(null);
      return;
    }
    google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: answer => resolve(answer.access_token || null) }).requestAccessToken();
  });
}

async function createFolder({ fetch, token, name }) {
  const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const answer = await fetch(FILES, { method: "POST", headers, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }) });
  return (await answer.json()).id;
}

// photo = { id, img (data URL JPEG) } → { status: "drive" | "gagal" | "lokal", driveId?, folder } (folder dibuat sekali per sesi peramban)
export async function upload({ fetch, token, folder, folderName, photo }) {
  if (!token) {
    return { status: "lokal", folder };
  }
  try {
    const target = folder || await createFolder({ fetch, token, name: folderName });
    folder = target;
    const meta = JSON.stringify({ name: "foto-" + photo.id + ".jpg", parents: [target] });
    const body = `--${BOUNDARY}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n${photo.img.split(",")[1]}\r\n--${BOUNDARY}--`;
    const answer = await fetch(UPLOAD, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "multipart/related; boundary=" + BOUNDARY }, body });
    if (answer.ok) {
      return { status: "drive", driveId: (await answer.json()).id, folder: target };
    }
    return { status: "gagal", folder: target };
  } catch (error) {
    return { status: "gagal", folder };
  }
}

// hapus berkas di Drive (foto dihapus dari galeri); galat diabaikan
export async function remove({ fetch, token, driveId }) {
  try {
    await fetch(FILES + "/" + driveId, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
  } catch (error) {
    // seperti kode lama: kegagalan menghapus di Drive tidak menghalangi penghapusan foto
  }
}
