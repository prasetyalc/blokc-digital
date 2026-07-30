# RT03RW05 DIGITAL

Portal informasi & keuangan warga RT03/RW05 — landing page publik + dashboard admin, database **Google Spreadsheet** (via Google Apps Script), light/dark mode, dan animasi scroll ala tampilan web 2026.

```
rt03rw05-digital/
├── index.html              → landing page publik + shell dashboard admin + semua modal
├── css/style.css           → design system (warna, tipografi, komponen, animasi, responsive)
├── js/api.js                → wrapper pemanggilan Google Apps Script (ganti API_URL di sini)
├── js/app.js                → tema, animasi scroll, login, render panel admin
└── apps-script/Code.gs      → backend REST API di atas Google Sheets (tempel ke Apps Script)
```

## Login demo (frontend saja, sebelum backend disambung)
Form login & tombol CRUD di file ini sudah berfungsi secara visual (modal, toast, animasi), tapi **belum tersambung ke data asli** sampai kamu menjalankan langkah deploy backend di bawah.

---

## LANGKAH 1 — Siapkan Database Google Spreadsheet

1. Buka [sheets.google.com](https://sheets.google.com) → buat Spreadsheet baru, beri nama misalnya **"DB RT03RW05 DIGITAL"**.
2. Buka menu **Extensions → Apps Script**.
3. Hapus semua isi editor default (`Code.gs`), lalu **copy-paste seluruh isi** file `apps-script/Code.gs` dari proyek ini.
4. Di dropdown fungsi (atas editor), pilih fungsi **`setupSheets`**, lalu klik **Run (▶)**.
   - Google akan meminta izin akses ke spreadsheet kamu → klik **Allow**.
   - Fungsi ini otomatis membuat semua tab: `Warga, Kas, Iuran, Aset, Layanan, Agenda, Pengumuman, Petugas, Audit, Settings, Sessions` lengkap dengan header kolom.
   - Akun admin default langsung dibuat: **username `admin`, password `bismillah`** (ganti setelah login pertama, lewat menu Petugas).

## LANGKAH 2 — Deploy Apps Script sebagai Web App (API)

1. Di editor Apps Script, klik **Deploy → New deployment**.
2. Klik ikon ⚙️ di samping "Select type" → pilih **Web app**.
3. Isi konfigurasi:
   - **Execute as:** `Me (email kamu)`
   - **Who has access:** `Anyone` (agar landing page publik & form warga bisa diakses tanpa login Google)
4. Klik **Deploy**, lalu **Authorize access** jika diminta.
5. Salin **Web app URL** yang muncul (formatnya seperti `https://script.google.com/macros/s/AKfycb.../exec`).

> Setiap kali kamu mengubah kode `Code.gs`, lakukan **Deploy → Manage deployments → Edit (✏️) → New version → Deploy** supaya perubahan ikut ter-update di URL yang sama.

## LANGKAH 3 — Sambungkan Frontend ke Backend

1. Buka file `js/api.js`.
2. Ganti baris berikut dengan URL Web App dari Langkah 2:
   ```js
   const API_URL = "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxx/exec";
   ```
3. Simpan file.

*(Opsional lanjutan)* Saat ini `js/app.js` memakai data contoh/statis untuk mempercepat pratinjau tampilan. Untuk menampilkan data asli dari Sheets, panggil fungsi `RTApi.getLandingData()`, `RTApi.listWarga()`, dst (sudah disiapkan di `api.js`) lalu render hasilnya ke elemen terkait (id `statWarga`, `tableAset`, `listJadwal`, dll) — polanya sama seperti fungsi `renderWargaPanel()` di `app.js`.

---

## LANGKAH 4 — Deploy Website ke Internet

Karena murni HTML/CSS/JS statis, kamu bisa pilih salah satu cara berikut (gratis semua):

### Opsi A — Netlify (paling cepat, drag & drop)
1. Buka [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag & drop folder `rt03rw05-digital` ke halaman tersebut.
3. Website langsung online dengan URL `https://nama-acak.netlify.app`.
4. Untuk domain sendiri: **Site settings → Domain management → Add custom domain**.

### Opsi B — Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Masuk ke folder proyek: `cd rt03rw05-digital`
3. Jalankan `vercel` → ikuti instruksi (login, pilih project baru).
4. Selesai, dapat URL `https://rt03rw05-digital.vercel.app`.

### Opsi C — GitHub Pages
1. Buat repository baru di GitHub, upload semua file proyek ini.
2. Masuk ke **Settings → Pages**.
3. Source: pilih branch `main`, folder `/root`.
4. Simpan → website online di `https://username.github.io/nama-repo/`.

### Opsi D — Hosting/Domain sendiri (cPanel dsb.)
Upload semua isi folder `rt03rw05-digital` via File Manager/FTP ke folder `public_html`. Selesai, tinggal akses domain kamu.

---

## LANGKAH 5 — Uji Coba

1. Buka website hasil deploy.
2. Klik **🔐 Login Pengurus** → masuk dengan `admin` / `bismillah`.
3. Buka menu **Petugas & Audit** → tambahkan akun pengurus RT/RW yang sebenarnya, lalu hapus/ubah akun demo.
4. Buka menu **Pengaturan** → ganti nama RT/RW, nominal iuran, dan teks halaman depan sesuai kebutuhan.
5. Mulai input data **Warga**, **Kas**, **Aset**, **Agenda**, dan **Pengumuman** — semuanya otomatis tersimpan ke Google Spreadsheet kamu.

## Keamanan (rekomendasi lanjutan)
- Password di sheet `Petugas` disimpan dalam bentuk hash SHA-256 (bukan teks polos), tapi untuk produksi yang lebih serius pertimbangkan menambahkan rate-limiting login dan reCAPTCHA pada form.
- Jangan bagikan URL Apps Script beserta akses "Edit" spreadsheet ke publik — yang dibagikan ke frontend cukup **Web App URL**-nya saja.
- Cadangkan (backup) spreadsheet secara berkala: **File → Make a copy** atau aktifkan Google Drive version history.

## Kustomisasi Tampilan
- Warna & tipografi: edit variabel di bagian `:root` dan `html[data-theme="dark"]` pada `css/style.css`.
- Logo default proyek ini sudah memakai logo "Guyub Rukun" yang kamu berikan (`assets/logo.png`, `assets/favicon.ico`, dll — sudah disesuaikan ke resolusi standar web: logo 128×128px, favicon 16/32/48px + apple-touch-icon 180×180px).
- Animasi scroll: tambahkan class `reveal` (fade-up satuan) atau `reveal-stagger` (fade-up berurutan untuk grid/list) ke elemen mana pun — akan otomatis dianimasikan saat masuk viewport.

## Fitur Panel Admin Terbaru
- **Dashboard**: kartu sambutan dengan jam real-time (update tiap detik) & tanggal lengkap format Indonesia, plus ringkasan KPI (pemasukan, pengeluaran, saldo, jumlah warga) yang otomatis ditarik dari Google Sheets.
- **Arus Kas**: grafik batang perbandingan pemasukan vs pengeluaran 6 bulan terakhir (SVG ringan, tanpa library eksternal, otomatis mengikuti warna tema light/dark).
- **Pengaturan → Logo & Favicon**: admin bisa upload/ganti logo dan favicon langsung dari browser (disimpan sebagai base64 di sheet `Settings`). **Batas ukuran file 35KB** karena 1 cell Google Sheets maksimal menampung ~50.000 karakter — kompres logo/favicon dulu (mis. lewat [tinypng.com](https://tinypng.com)) sebelum upload jika lebih besar dari itu.
- **Pengaturan → Identitas & Deskripsi Website**: ubah nama RT/RW, tagline header, judul hero beranda, dan deskripsi singkat footer — otomatis diterapkan ke seluruh halaman setelah disimpan.
- **Pengaturan → Copyright Footer**: ubah teks copyright di footer.
- **Tombol Back to Top**: muncul otomatis di pojok kanan bawah setelah scroll > 400px, tersedia di seluruh halaman (publik maupun admin).

> Semua perubahan branding di atas otomatis diterapkan kembali setiap kali ada orang membuka website (disimpan permanen di Google Sheets, bukan hanya di browser kamu).
