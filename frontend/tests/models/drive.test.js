import { test } from "node:test";
import assert from "node:assert/strict";
import * as drive from "../../js/models/drive.js";

function fakeFetch(answers) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, ...options });
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    return { ok: answer.ok !== false, json: async () => answer.body };
  };
  return { fetch, calls };
}

test("authorize: tanpa GOOGLE_CLIENT_ID atau tanpa Google Identity → null (tidak meminta izin)", async () => {
  assert.equal(await drive.authorize({ clientId: "", google: { accounts: {} } }), null);
  assert.equal(await drive.authorize({ clientId: "abc", google: undefined }), null);
});

test("authorize: token dari Google Identity (scope drive.file)", async () => {
  let config;
  const google = { accounts: { oauth2: { initTokenClient: options => { config = options; return { requestAccessToken: () => options.callback({ access_token: "tok" }) }; } } } };
  assert.equal(await drive.authorize({ clientId: "abc", google }), "tok");
  assert.equal(config.client_id, "abc");
  assert.equal(config.scope, "https://www.googleapis.com/auth/drive.file");
});

test("upload: tanpa token → lokal, tanpa permintaan", async () => {
  const { fetch, calls } = fakeFetch([]);
  assert.deepEqual(await drive.upload({ fetch, token: null, folder: null, folderName: "X", photo: { id: 1, img: "data:image/jpeg;base64,AA" } }), { status: "lokal", folder: null });
  assert.equal(calls.length, 0);
});

test("upload: buat folder sekali, unggah multipart, simpan id Drive", async () => {
  const { fetch, calls } = fakeFetch([{ body: { id: "folder1" } }, { body: { id: "file9" } }]);
  const result = await drive.upload({ fetch, token: "tok", folder: null, folderName: "SelfieBox Studio - 25/11/2026", photo: { id: 9, img: "data:image/jpeg;base64,QUJD" } });
  assert.deepEqual(result, { status: "drive", driveId: "file9", folder: "folder1" });
  assert.equal(calls[0].url, "https://www.googleapis.com/drive/v3/files");
  assert.deepEqual(JSON.parse(calls[0].body), { name: "SelfieBox Studio - 25/11/2026", mimeType: "application/vnd.google-apps.folder" });
  assert.equal(calls[1].url, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart");
  assert.equal(calls[1].headers.Authorization, "Bearer tok");
  assert.match(calls[1].body, /"name":"foto-9\.jpg","parents":\["folder1"\]/);
  assert.match(calls[1].body, /\r\n\r\nQUJD\r\n/);
  const again = fakeFetch([{ ok: false, body: {} }]);
  assert.deepEqual(await drive.upload({ fetch: again.fetch, token: "tok", folder: "folder1", folderName: "X", photo: { id: 10, img: "data:,AA" } }), { status: "gagal", folder: "folder1" });
  assert.equal(again.calls.length, 1);
});

test("upload: galat jaringan → gagal", async () => {
  const { fetch } = fakeFetch([new Error("offline")]);
  assert.deepEqual(await drive.upload({ fetch, token: "tok", folder: null, folderName: "X", photo: { id: 1, img: "data:,AA" } }), { status: "gagal", folder: null });
});

test("remove: DELETE berkas Drive, galat diabaikan", async () => {
  const { fetch, calls } = fakeFetch([new Error("offline")]);
  await drive.remove({ fetch, token: "tok", driveId: "file9" });
  assert.equal(calls[0].url, "https://www.googleapis.com/drive/v3/files/file9");
  assert.equal(calls[0].method, "DELETE");
});
