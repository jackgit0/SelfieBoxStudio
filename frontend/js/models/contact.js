// Form Contact Us di landing page (dulu bagian dari sendContact di legacy/landing.js). Murni; api diberikan pemanggil.

// jawaban = { message } dari server (pesan terima kasih); galat 400 bila isian tidak lengkap
export function sendMessage(api, { name, email, message }) {
  return api.post("/contact", { name, email, message });
}
