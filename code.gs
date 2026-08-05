/**
 * ============================================================
 *  RT03RW05 DIGITAL — Backend (Google Apps Script + Sheets)
 * ============================================================
 *  Cara pakai:
 *  1. Buat Google Spreadsheet baru (lihat README.md untuk nama & kolom sheet).
 *  2. Buka Extensions > Apps Script, hapus isi default, tempel file ini.
 *  3. Jalankan fungsi `setupSheets` sekali (Run > setupSheets) untuk
 *     membuat semua tab/kolom otomatis + akun admin default.
 *  4. Deploy > New deployment > Web app.
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  5. Salin URL Web App ke variabel API_URL di js/api.js (frontend).
 * ============================================================
 */

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SS = SpreadsheetApp.openById(SHEET_ID);

const SHEETS = {
  WARGA: "Warga",
  KAS: "Kas",
  IURAN: "Iuran",
  ASET: "Aset",
  LAYANAN: "Layanan",
  AGENDA: "Agenda",
  PENGUMUMAN: "Pengumuman",
  PETUGAS: "Petugas",
  AUDIT: "Audit",
  SETTINGS: "Settings",
  SESSIONS: "Sessions",
};

const SCHEMAS = {
  Warga: ["id","nik","nama","noRumah","jenisKelamin","tempatLahir","tanggalLahir","statusTinggal","statusNikah","posisiKeluarga","noHp","statusAktif","createdAt"],
  Kas: ["id","tipe","namaSumber","kategori","jumlah","tanggal","buktiUrl","createdBy","createdAt"],
  Iuran: ["id","wargaId","bulan","tahun","lunas","tanggalBayar","nominal"],
  Aset: ["id","nama","kategori","jumlahTotal","jumlahTersedia","kondisi","keterangan","fotoUrl","createdAt"],
  Layanan: ["id","jenis","nama","nik","noRumah","noHp","detail","status","nomorSurat","tanggal","createdAt"],
  Agenda: ["id","judul","kategori","tanggalJam","waktu","lokasi","status","laporanUrl","notulenUrl","createdAt"],
  Pengumuman: ["id","tanggal","waktu","tipe","judul","isi","createdAt"],
  Petugas: ["id","fullname","username","passwordHash","role","createdAt"],
  Audit: ["id","waktu","petugas","aksi","detail"],
  Settings: ["key","value"],
  Sessions: ["token","username","fullname","role","expiresAt"],
};

/* ---------------- Setup awal (jalankan manual sekali) ---------------- */
function setupSheets(){
  Object.entries(SCHEMAS).forEach(([name, cols]) => {
    let sh = SS.getSheetByName(name);
    if (!sh) sh = SS.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(cols);
    else ensureColumns_(name, cols); // migrasi: tambahkan kolom baru yang belum ada di sheet lama
    formatWaktuColumnAsText_(name); // cegah/​perbaiki kolom "waktu" ke-convert jadi Date/Time oleh Sheets
  });
  // Akun admin default (username: admin / password: bismillah)
  const petugas = SS.getSheetByName(SHEETS.PETUGAS);
  if (petugas.getLastRow() < 2) {
    petugas.appendRow([Utilities.getUuid(), "Ketua RT/RW", "admin", hashPassword_("bismillah"), "Admin", new Date()]);
  }
  const settings = SS.getSheetByName(SHEETS.SETTINGS);
  if (settings.getLastRow() < 2) {
    settings.appendRow(["namaRtRw", "RT03RW05 DIGITAL"]);
    settings.appendRow(["tagline", "DIGITAL"]);
    settings.appendRow(["nominalIuran", "20000"]);
    settings.appendRow(["wilayahTag", "WILAYAH RT 03 / RW 05"]);
    settings.appendRow(["heroTitle", "Bersama Warga, Membangun Lingkungan yang Nyaman dan Harmonis"]);
    settings.appendRow(["heroLead", "Satu portal digital untuk komunikasi, transparansi keuangan kas, dan pelayanan administrasi warga — cepat, terbuka, dan mudah diakses kapan saja."]);
    settings.appendRow(["siteDesc", "Platform informasi & keuangan warga RT 03 / RW 05."]);
    settings.appendRow(["copyrightText", "© 2026 RT03RW05 DIGITAL. Seluruh hak cipta dilindungi."]);
  }
  Logger.log("Setup selesai. Sheet default & akun admin siap dipakai.");
}

/* Format seluruh kolom "waktu" (kalau ada) sebagai teks polos (@), termasuk baris yang sudah
   terlanjur ada. Ini men-supply perbaikan cepat untuk bug Google Sheets yang otomatis mengubah
   nilai seperti "12:52" jadi objek Date/Time internal. Aman dijalankan berkali-kali. */
function formatWaktuColumnAsText_(sheetName){
  const sh = SS.getSheetByName(sheetName);
  if (!sh) return;
  const lastCol = sh.getLastColumn();
  if (!lastCol) return;
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const waktuColIdx = headers.indexOf("waktu");
  if (waktuColIdx === -1) return;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) { sh.getRange(1, waktuColIdx + 1, Math.max(lastRow,1), 1).setNumberFormat("@"); return; }
  const range = sh.getRange(2, waktuColIdx + 1, lastRow - 1, 1);
  const tz = SS.getSpreadsheetTimeZone();
  const values = range.getValues().map(([v]) => (v instanceof Date) ? Utilities.formatDate(v, tz, "HH:mm") : v);
  range.setNumberFormat("@").setValues(values.map(v => [v]));
}

/* Menambahkan kolom baru ke akhir header sheet yang sudah ada, kalau belum ada.
   Aman dijalankan berkali-kali (idempotent) — dipakai untuk migrasi skema (mis. menambah kolom "waktu"). */
function ensureColumns_(sheetName, requiredCols){
  const sh = SS.getSheetByName(sheetName);
  if (!sh) return;
  const lastCol = sh.getLastColumn();
  const headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  requiredCols.forEach(col => {
    if (headers.indexOf(col) === -1) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
      headers.push(col);
    }
  });
}

/* ---------------- Router utama ---------------- */
function doGet(e){
  try {
    const action = e.parameter.action;
    const data = routeGet_(action, e.parameter);
    return jsonOut_({ status: "ok", data });
  } catch (err) {
    return jsonOut_({ status: "error", message: err.message });
  }
}

function doPost(e){
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const data = routePost_(body.action, body);
    return jsonOut_({ status: "ok", data });
  } catch (err) {
    return jsonOut_({ status: "error", message: err.message });
  }
}

function jsonOut_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- GET actions (baca data) ---------------- */
function routeGet_(action, params){
  switch(action){
    case "getLandingData": return getLandingData_();
    case "getRecentLayanan": return getRecentLayanan_();
    case "getSettings": return getAll_(SHEETS.SETTINGS).reduce((o,r)=>(o[r.key]=r.value, o), {});
    case "listWarga": return requireAuth_(params.token) && getAll_(SHEETS.WARGA);
    case "listKas": return requireAuth_(params.token) && getAll_(SHEETS.KAS);
    case "listIuran": return requireAuth_(params.token) && getAll_(SHEETS.IURAN);
    case "listAset": return getAll_(SHEETS.ASET); // publik untuk transparansi
    case "listLayanan": {
      const jenisFilter = (params.jenis && params.jenis !== "undefined" && params.jenis !== "null") ? params.jenis : null;
      return requireAuth_(params.token) && getAll_(SHEETS.LAYANAN).filter(r => !jenisFilter || r.jenis === jenisFilter);
    }
    case "listAgenda": return getAll_(SHEETS.AGENDA);
    case "listPengumuman": return getAll_(SHEETS.PENGUMUMAN);
    case "listPetugas": return requireAuth_(params.token) && getAll_(SHEETS.PETUGAS).map(({passwordHash, ...rest}) => rest);
    case "listAudit": return requireAuth_(params.token) && getAll_(SHEETS.AUDIT);
    default: throw new Error("Aksi tidak dikenal: " + action);
  }
}

/* ---------------- POST actions (tulis data) ---------------- */
function routePost_(action, body){
  switch(action){
    case "login": return login_(body.username, body.password);
    case "logout": return logout_(body.token);
    case "saveWarga": requireAuth_(body.token); return upsert_(SHEETS.WARGA, body.data, body.token);
    case "deleteWarga": requireAuth_(body.token); return remove_(SHEETS.WARGA, body.id, body.token);
    case "saveKas": requireAuth_(body.token); return upsert_(SHEETS.KAS, body.data, body.token);
    case "deleteKas": requireAuth_(body.token); return remove_(SHEETS.KAS, body.id, body.token);
    case "toggleIuran": requireAuth_(body.token); return toggleIuran_(body);
    case "saveAset": requireAuth_(body.token); return upsert_(SHEETS.ASET, body.data, body.token);
    case "deleteAset": requireAuth_(body.token); return remove_(SHEETS.ASET, body.id, body.token);
    case "submitLayanan": return submitLayananWithGuard_(body.jenis, body.data);
    case "updateLayananStatus": requireAuth_(body.token); return upsert_(SHEETS.LAYANAN, { id: body.id, status: body.status, nomorSurat: body.nomorSurat || "" }, body.token);
    case "saveAgenda": requireAuth_(body.token); return upsert_(SHEETS.AGENDA, body.data, body.token);
    case "deleteAgenda": requireAuth_(body.token); return remove_(SHEETS.AGENDA, body.id, body.token);
    case "savePengumuman": requireAuth_(body.token); return upsert_(SHEETS.PENGUMUMAN, body.data, body.token);
    case "deletePengumuman": requireAuth_(body.token); return remove_(SHEETS.PENGUMUMAN, body.id, body.token);
    case "savePetugas": requireAuth_(body.token); return savePetugas_(body.data, body.token);
    case "deletePetugas": requireAuth_(body.token); return remove_(SHEETS.PETUGAS, body.id, body.token);
    case "saveSettings": requireAuth_(body.token); return saveSettings_(body.data, body.token);
    default: throw new Error("Aksi tidak dikenal: " + action);
  }
}

/* ---------------- Helper: baca sheet jadi array of object ---------------- */
function getSheet_(name){
  const sh = SS.getSheetByName(name);
  if (!sh) throw new Error("Sheet '" + name + "' tidak ditemukan. Jalankan setupSheets() dulu.");
  return sh;
}

function getAll_(name){
  const sh = getSheet_(name);
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  const tz = SS.getSpreadsheetTimeZone();
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let v = row[i];
      // Google Sheets kadang otomatis mengubah nilai kolom "waktu" (mis. "12:52") jadi
      // objek Date/Time internal. Kalau kejadian, ubah kembali jadi teks HH:mm yang benar
      // (pakai timezone spreadsheet supaya jamnya tidak geser).
      if (h === "waktu" && v instanceof Date) {
        v = Utilities.formatDate(v, tz, "HH:mm");
      }
      obj[h] = v;
    });
    return obj;
  }).filter(r => Object.values(r).some(v => v !== "" && v !== null));
}

function upsert_(name, data, token){
  const sh = getSheet_(name);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const waktuColIdx = headers.indexOf("waktu"); // -1 kalau sheet ini tidak punya kolom waktu
  const values = sh.getDataRange().getValues();
  let rowIndex = -1;
  if (data.id) {
    for (let i=1;i<values.length;i++){ if (values[i][0] === data.id){ rowIndex = i+1; break; } }
  }
  if (rowIndex === -1) {
    data.id = data.id || Utilities.getUuid();
    data.createdAt = data.createdAt || new Date();
    const row = headers.map(h => data[h] !== undefined ? data[h] : "");
    sh.appendRow(row);
    if (waktuColIdx !== -1) {
      // Format kolom waktu sebagai teks polos SETELAH baris ditambahkan, supaya
      // Google Sheets tidak otomatis mengubah "12:52" jadi nilai Date/Time internal.
      const newRow = sh.getLastRow();
      sh.getRange(newRow, waktuColIdx + 1).setNumberFormat("@").setValue(row[waktuColIdx]);
    }
  } else {
    headers.forEach((h, i) => {
      if (data[h] !== undefined) {
        const cell = sh.getRange(rowIndex, i+1);
        if (h === "waktu") cell.setNumberFormat("@");
        cell.setValue(data[h]);
      }
    });
  }
  logAudit_(token, (rowIndex === -1 ? "Tambah" : "Ubah") + " data " + name, data.id);
  return { id: data.id };
}

function remove_(name, id, token){
  const sh = getSheet_(name);
  const values = sh.getDataRange().getValues();
  for (let i=1;i<values.length;i++){
    if (values[i][0] === id){ sh.deleteRow(i+1); break; }
  }
  logAudit_(token, "Hapus data " + name, id);
  return { id };
}

/* ---------------- Auth sederhana berbasis token sesi ---------------- */
function hashPassword_(pw){
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw));
}

function login_(username, password){
  const users = getAll_(SHEETS.PETUGAS);
  const user = users.find(u => u.username === username);
  if (!user || user.passwordHash !== hashPassword_(password)) {
    throw new Error("Username atau password salah.");
  }
  const token = Utilities.getUuid();
  const expiresAt = new Date(Date.now() + 12*60*60*1000); // sesi 12 jam
  getSheet_(SHEETS.SESSIONS).appendRow([token, user.username, user.fullname, user.role, expiresAt]);
  logAudit_(token, "Login", user.username);
  return { token, user: { fullname: user.fullname, username: user.username, role: user.role } };
}

function logout_(token){
  const sh = getSheet_(SHEETS.SESSIONS);
  const values = sh.getDataRange().getValues();
  for (let i=1;i<values.length;i++){
    if (values[i][0] === token){ sh.deleteRow(i+1); break; }
  }
  return { ok: true };
}

function requireAuth_(token){
  if (!token) throw new Error("Sesi tidak valid, silakan login kembali.");
  const sessions = getAll_(SHEETS.SESSIONS);
  const session = sessions.find(s => s.token === token);
  if (!session) throw new Error("Sesi tidak valid, silakan login kembali.");
  if (new Date(session.expiresAt) < new Date()) throw new Error("Sesi telah berakhir, silakan login kembali.");
  return true;
}

function savePetugas_(data, token){
  if (data.password) { data.passwordHash = hashPassword_(data.password); delete data.password; }
  return upsert_(SHEETS.PETUGAS, data, token);
}

function saveSettings_(data, token){
  const sh = getSheet_(SHEETS.SETTINGS);
  Object.entries(data).forEach(([key, value]) => {
    const values = sh.getDataRange().getValues();
    let found = false;
    for (let i=1;i<values.length;i++){
      if (values[i][0] === key){ sh.getRange(i+1,2).setValue(value); found = true; break; }
    }
    if (!found) sh.appendRow([key, value]);
  });
  logAudit_(token, "Ubah Pengaturan", Object.keys(data).join(", "));
  return { ok: true };
}

function toggleIuran_(body){
  const sh = getSheet_(SHEETS.IURAN);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  let rowIndex = -1;
  for (let i=1;i<values.length;i++){
    if (values[i][headers.indexOf("wargaId")] === body.wargaId &&
        String(values[i][headers.indexOf("bulan")]) === String(body.bulan) &&
        String(values[i][headers.indexOf("tahun")]) === String(body.tahun)) { rowIndex = i+1; break; }
  }
  const nominal = getAll_(SHEETS.SETTINGS).find(s => s.key === "nominalIuran")?.value || 20000;
  if (rowIndex === -1) {
    sh.appendRow([Utilities.getUuid(), body.wargaId, body.bulan, body.tahun, body.lunas, new Date(), nominal]);
  } else {
    sh.getRange(rowIndex, headers.indexOf("lunas")+1).setValue(body.lunas);
    sh.getRange(rowIndex, headers.indexOf("tanggalBayar")+1).setValue(new Date());
  }
  logAudit_(body.token, "Update status iuran", body.wargaId);
  return { ok: true };
}

function logAudit_(token, aksi, detail){
  try {
    let petugasName = "Publik";
    if (token) {
      const session = getAll_(SHEETS.SESSIONS).find(s => s.token === token);
      if (session) petugasName = session.fullname;
    }
    getSheet_(SHEETS.AUDIT).appendRow([Utilities.getUuid(), new Date(), petugasName, aksi, String(detail || "")]);
  } catch(e){ /* jangan sampai gagal simpan cuma karena audit gagal */ }
}

/* ---------------- Data agregat untuk landing page publik ---------------- */
function safeGetAll_(name){
  try { return getAll_(name); }
  catch (err) { Logger.log("Gagal membaca sheet " + name + ": " + err.message); return []; }
}

/* Data ringkas pengajuan layanan warga terbaru (untuk slider di halaman publik) */
function getRecentLayanan_(){
  const rows = safeGetAll_(SHEETS.LAYANAN);
  return rows
    .slice(-15)
    .reverse()
    .map(r => ({
      tanggal: r.createdAt,
      nama: r.nama || "Anonim",
      jenis: r.jenis,
      detail: r.detail || "",
      status: r.status || "Pending",
    }));
}

/* ---------- Validasi Nomor Rumah (format: C[angka]/[angka][angka], contoh: C1/09) ---------- */
const NAMA_PERUMAHAN_ = "Samawa Village Sepatan";
const WA_ADMIN_ = "085780318103";

function normalizeNoRumah_(v){
  return String(v || "").trim().toUpperCase().replace(/\s+/g, "");
}
function isValidNoRumahFormat_(v){
  return /^C\d+\/\d{2}$/.test(normalizeNoRumah_(v));
}
function isNoRumahTerdaftar_(v){
  const target = normalizeNoRumah_(v);
  const warga = safeGetAll_(SHEETS.WARGA);
  return warga.some(w => normalizeNoRumah_(w.noRumah) === target);
}
function submitLayananWithGuard_(jenis, data){
  const noRumah = (data && data.noRumah) || "";
  if (!isValidNoRumahFormat_(noRumah)) {
    throw new Error("Format nomor rumah tidak valid. Gunakan format seperti C1/09.");
  }
  if (!isNoRumahTerdaftar_(noRumah)) {
    throw new Error("Anda tidak bisa mengisi form karena belum terdaftar sebagai warga blok C perumahan " + NAMA_PERUMAHAN_ + ". Silakan hubungi admin (wa.me/" + WA_ADMIN_ + ") untuk input data Anda.");
  }
  return upsert_(SHEETS.LAYANAN, Object.assign({ jenis: jenis, status: "Pending" }, data), null);
}

function getLandingData_(){
  const warga = safeGetAll_(SHEETS.WARGA);
  const kas = safeGetAll_(SHEETS.KAS);
  const iuran = safeGetAll_(SHEETS.IURAN);
  const aset = safeGetAll_(SHEETS.ASET);
  const agenda = safeGetAll_(SHEETS.AGENDA);
  const pengumuman = safeGetAll_(SHEETS.PENGUMUMAN);

  const totalMasuk = kas.filter(k => k.tipe === "masuk").reduce((s,k)=>s+Number(k.jumlah||0),0);
  const totalKeluar = kas.filter(k => k.tipe === "keluar").reduce((s,k)=>s+Number(k.jumlah||0),0);

  const now = new Date();
  const bulanIni = now.getMonth()+1, tahunIni = now.getFullYear();
  const iuranBulanIni = iuran.filter(i => Number(i.bulan)===bulanIni && Number(i.tahun)===tahunIni);
  const kkCount = warga.filter(w => w.posisiKeluarga === "Kepala Keluarga").length;

  return {
    statWarga: warga.length,
    statKK: kkCount,
    statL: warga.filter(w=>w.jenisKelamin==="Laki-laki").length,
    statP: warga.filter(w=>w.jenisKelamin==="Perempuan").length,
    saldoKas: totalMasuk - totalKeluar,
    totalMasuk, totalKeluar,
    iuranSudahBayar: iuranBulanIni.filter(i=>i.lunas===true || i.lunas==="TRUE").length,
    iuranTotalKK: kkCount,
    aset, agenda, pengumuman,
  };
}
