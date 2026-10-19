// Klien REST tipis untuk backend Snapia
const API_BASE = window.API_BASE || "";
const API = {
  token: localStorage.getItem("snapia_t") || "", staff: "",
  async req(m, p, b) {
    const r = await fetch(API_BASE + "/api" + p, { method: m, headers: { "Content-Type": "application/json",
      ...(API.token ? { Authorization: "Bearer " + API.token } : {}), ...(API.staff ? { "X-Staff-Token": API.staff } : {}) }, body: b ? JSON.stringify(b) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const e = new Error(j.error || "Terjadi kesalahan"); e.status = r.status; throw e; } return j;
  },
  get: p => API.req("GET", p), post: (p, b) => API.req("POST", p, b || {}), put: (p, b) => API.req("PUT", p, b),
  patch: (p, b) => API.req("PATCH", p, b), del: p => API.req("DELETE", p),
  invUrl: (id, dl) => `${API_BASE}/api/bookings/${id}/invoice?t=${API.token}${dl ? "&dl=1" : ""}`,
  imgUrl: id => `${API_BASE}/api/photos/${id}/image?t=${API.token}`
};
