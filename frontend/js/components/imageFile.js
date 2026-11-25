// Gambar yang dipilih admin (studio, properti) diperkecil di browser sebelum diunggah: maks 1000 px, JPEG kualitas 0.85
// (dulu bagian upImg() di admin.js). Pembantu DOM: main.js memberikannya ke controller sebagai files.readImage, tes memakai versi palsu.

export function shrinkImage(file, { FileReader, Image, document }, maxSide = 1000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      image.onerror = () => reject(new Error("File bukan gambar"));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}
