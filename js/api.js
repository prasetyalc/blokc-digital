/* ============================================================
   RT03RW05 DIGITAL — API Layer
   Menghubungkan frontend ke Google Spreadsheet lewat
   Google Apps Script Web App (lihat /apps-script/Code.gs)
   ============================================================ */

// GANTI dengan URL Web App hasil deploy Apps Script kamu, contoh:
// "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec"
const API_URL = "https://script.google.com/macros/u/1/s/AKfycbzYjJCrZ9zX36IPIZRKPUda8iwDgyiea3anAIGUrHhqsjmXHcWbXp_4C33mhC_8atyp/exec";

const RTApi = (() => {

  function getToken(){ return localStorage.getItem("rt_token") || ""; }
  function setToken(t){ localStorage.setItem("rt_token", t); }
  function clearToken(){ localStorage.removeItem("rt_token"); }

  // Semua request GET: ?action=xxx&...params
  async function get(action, params = {}) {
    const url = new URL(API_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("token", getToken());
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) throw new Error("Gagal memuat data (" + res.status + ")");
    const json = await res.json();
    if (json.status === "error") throw new Error(json.message || "Terjadi kesalahan");
    return json.data;
  }

  // Semua request tulis (create/update/delete) lewat POST supaya bisa bawa token
  async function post(action, payload = {}) {
    const res = await fetch(API_URL, {
      method: "POST",
      // text/plain menghindari CORS preflight pada Apps Script Web App
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, token: getToken(), ...payload }),
    });
    if (!res.ok) throw new Error("Gagal mengirim data (" + res.status + ")");
    const json = await res.json();
    if (json.status === "error") throw new Error(json.message || "Terjadi kesalahan");
    return json.data;
  }

  return {
    getToken, setToken, clearToken,

    // --- Auth ---
    login: (username, password) => post("login", { username, password }),
    logout: () => post("logout", {}),

    // --- Landing page (data publik, read-only) ---
    getLandingData: () => get("getLandingData"),
    getRecentLayanan: () => get("getRecentLayanan"),
    getSettings: () => get("getSettings"),

    // --- Warga ---
    listWarga: (filters = {}) => get("listWarga", filters),
    saveWarga: (data) => post("saveWarga", { data }),
    deleteWarga: (id) => post("deleteWarga", { id }),

    // --- Kas (pemasukan / pengeluaran) ---
    listKas: (filters = {}) => get("listKas", filters),
    saveKas: (data) => post("saveKas", { data }),
    deleteKas: (id) => post("deleteKas", { id }),

    // --- Iuran ---
    listIuran: (filters = {}) => get("listIuran", filters),
    toggleIuran: (wargaId, bulan, tahun, lunas) => post("toggleIuran", { wargaId, bulan, tahun, lunas }),

    // --- Aset / Inventaris ---
    listAset: () => get("listAset"),
    saveAset: (data) => post("saveAset", { data }),
    deleteAset: (id) => post("deleteAset", { id }),

    // --- Video Momen Kebersamaan Warga ---
    listVideo: () => get("listVideo"),
    saveVideo: (data) => post("saveVideo", { data }),
    deleteVideo: (id) => post("deleteVideo", { id }),

    // --- Layanan (surat / peminjaman / pengaduan) ---
    listLayanan: (jenis) => get("listLayanan", jenis ? { jenis } : {}),
    submitLayanan: (jenis, data) => post("submitLayanan", { jenis, data }), // publik, tanpa token
    updateLayananStatus: (jenis, id, status, extra = {}) => post("updateLayananStatus", { jenis, id, status, ...extra }),

    // --- Agenda ---
    listAgenda: () => get("listAgenda"),
    saveAgenda: (data) => post("saveAgenda", { data }),
    deleteAgenda: (id) => post("deleteAgenda", { id }),

    // --- Pengumuman ---
    listPengumuman: () => get("listPengumuman"),
    savePengumuman: (data) => post("savePengumuman", { data }),
    deletePengumuman: (id) => post("deletePengumuman", { id }),

    // --- Petugas ---
    listPetugas: () => get("listPetugas"),
    savePetugas: (data) => post("savePetugas", { data }),
    deletePetugas: (id) => post("deletePetugas", { id }),
    listAudit: () => get("listAudit"),

    // --- Pengaturan ---
    saveSettings: (data) => post("saveSettings", { data }),
  };
})();
