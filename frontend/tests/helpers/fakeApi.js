// API palsu untuk tes unit: mencatat setiap panggilan dan menjawab dari tabel "METODE /path".
// Galat dibentuk seperti models/api.js: Error dengan message, status, data.
export function createFakeApi(responses = {}) {
  const calls = [];

  async function request(method, path, body) {
    calls.push({ method, path, body });
    const answer = responses[`${method} ${path}`];
    if (!answer) {
      throw apiError(404, { error: "Endpoint tidak ada" });
    }
    const resolved = typeof answer === "function" ? await answer(body, calls) : answer;
    const status = resolved.status ?? 200;
    const data = resolved.body ?? {};
    if (status >= 400) {
      throw apiError(status, data);
    }
    return data;
  }

  return {
    calls,
    request,
    get: path => request("GET", path),
    post: (path, body) => request("POST", path, body || {}),
    put: (path, body) => request("PUT", path, body),
    patch: (path, body) => request("PATCH", path, body),
    del: path => request("DELETE", path),
  };
}

function apiError(status, data) {
  const error = new Error(data.error || "Terjadi kesalahan");
  error.status = status;
  error.data = data;
  return error;
}
