// Klien REST tipis untuk backend. Satu-satunya tempat yang membaca dan menulis token login (storage["snapia_t"]).
// createApi({ base, fetch, storage }): base = API_BASE dari config.js, fetch dan storage disuntikkan agar bisa dites.

const TOKEN_KEY = "snapia_t";

function readToken(storage) {
  try {
    return (storage && storage.getItem(TOKEN_KEY)) || "";
  } catch (error) {
    return "";
  }
}

export function createApi({
  base = "",
  fetch: fetchFunction = (...args) => globalThis.fetch(...args),
  storage = null,
} = {}) {
  let token = readToken(storage);
  let staffToken = "";

  const api = {
    // JWT pengguna atau admin; mengisinya juga menyimpan ke storage, mengosongkannya menghapus dari storage
    get token() {
      return token;
    },
    set token(value) {
      token = value || "";
      try {
        if (token) {
          storage.setItem(TOKEN_KEY, token);
        } else {
          storage.removeItem(TOKEN_KEY);
        }
      } catch (error) {
        // storage diblokir: token tetap berlaku di memori sampai halaman dimuat ulang
      }
    },
    // token Mode Staf (header X-Staff-Token), hanya di memori
    get staffToken() {
      return staffToken;
    },
    set staffToken(value) {
      staffToken = value || "";
    },

    async request(method, path, body) {
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = "Bearer " + token;
      }
      if (staffToken) {
        headers["X-Staff-Token"] = staffToken;
      }
      const response = await fetchFunction(base + "/api" + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      let data = {};
      try {
        data = await response.json();
      } catch (error) {
        // respons tanpa JSON
      }
      if (!response.ok) {
        const error = new Error(data.error || "Terjadi kesalahan");
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    },
    get: path => api.request("GET", path),
    post: (path, body) => api.request("POST", path, body || {}),
    put: (path, body) => api.request("PUT", path, body),
    patch: (path, body) => api.request("PATCH", path, body),
    del: path => api.request("DELETE", path),

    // tautan invoice (download = unduh berkas, bukan tampil di tab baru) dan gambar foto, dengan token di query
    invoiceUrl: (id, download) => `${base}/api/bookings/${id}/invoice?t=${token}${download ? "&dl=1" : ""}`,
    imageUrl: id => `${base}/api/photos/${id}/image?t=${token}`,
    // foto pelanggan di panel admin (detail Pengguna)
    adminPhotoUrl: id => `${base}/api/admin/photos/${id}/image?t=${token}`,
  };
  return api;
}
