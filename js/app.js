/* ============================================================
   RT03RW05 DIGITAL — App Logic
   ============================================================ */

/* ---------- 0. Tandai bahwa JS berhasil dimuat ----------
   CSS reveal/animasi di style.css hanya aktif kalau class ini ada.
   Kalau baris ini tidak sempat jalan (file ini gagal dimuat),
   konten tetap tampil normal berkat fallback di CSS. */
document.documentElement.classList.add("js-ready");

/* ---------- 1. THEME (light/dark) ---------- */
(function initTheme(){
  const saved = localStorage.getItem("rt_theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
})();

function toggleTheme(){
  const html = document.documentElement;
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("rt_theme", next);
}

/* ---------- 2. NAV: shrink on scroll + mobile menu ---------- */
const navEl = document.getElementById("mainNav");
window.addEventListener("scroll", () => {
  if (!navEl) return;
  navEl.classList.toggle("is-scrolled", window.scrollY > 12);
}, { passive: true });

/* ---------- 2b. BACK TO TOP ---------- */
function scrollToTop(){
  window.scrollTo({ top:0, behavior:"smooth" });
}
function initBackToTop(){
  const btn = document.getElementById("backToTop");
  if (!btn) return;
  window.addEventListener("scroll", () => btn.classList.toggle("show", window.scrollY > 400), { passive:true });
  btn.addEventListener("click", scrollToTop);
}
document.addEventListener("DOMContentLoaded", initBackToTop);

/* ---------- 3. SCROLL REVEAL ANIMATIONS ---------- */
function initReveal(){
  const items = document.querySelectorAll(".reveal, .reveal-stagger");
  if (!("IntersectionObserver" in window)){
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting){
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
  items.forEach((el) => io.observe(el));
  // Jaring pengaman: kalau ada elemen yang tidak pernah terdeteksi
  // (mis. karena race condition saat load), paksa tampil setelah 2 detik.
  setTimeout(() => items.forEach((el) => el.classList.add("is-visible")), 2000);
}
document.addEventListener("DOMContentLoaded", initReveal);

/* ---------- 4. SMOOTH ANCHOR SCROLL (offset navbar) ---------- */
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute("href");
  if (id.length < 2) return;
  const target = document.querySelector(id);
  if (!target) return;
  e.preventDefault();
  const y = target.getBoundingClientRect().top + window.scrollY - (document.getElementById("mainNav")?.offsetHeight || 76) + 1;
  window.scrollTo({ top: y, behavior: "smooth" });
});

/* ---------- 5. TOAST NOTIFICATIONS ---------- */
function toast(message, type = "ok"){
  const stack = document.getElementById("toastStack");
  if (!stack) return alert(message);
  const el = document.createElement("div");
  el.className = "toast" + (type === "err" ? " err" : "");
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

/* ---------- 6. MODAL HELPERS ---------- */
function openModal(id){ document.getElementById(id)?.classList.add("is-open"); }
function closeModal(id){ document.getElementById(id)?.classList.remove("is-open"); }
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("overlay")) e.target.classList.remove("is-open");
});

/* ---------- 7. LOGIN ---------- */
async function handleLogin(e){
  e.preventDefault();
  const form = e.target;
  const msg = form.querySelector(".form-msg");
  const btn = form.querySelector('button[type="submit"]');
  const username = form.username.value.trim();
  const password = form.password.value;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Memproses...';
  try {
    // Ganti RTApi.login(...) dengan pemanggilan Apps Script asli.
    const result = await RTApi.login(username, password);
    RTApi.setToken(result.token);
    localStorage.setItem("rt_user", JSON.stringify(result.user));
    toast("Login berhasil, selamat datang " + result.user.fullname);
    enterAdmin(result.user);
  } catch (err) {
    msg.textContent = err.message || "Username atau password salah.";
    msg.className = "form-msg err show";
  } finally {
    btn.disabled = false;
    btn.textContent = "Masuk";
  }
}

function enterAdmin(user){
  closeModal("loginModal");
  document.body.classList.add("admin-mode");
  document.getElementById("adminApp").classList.add("is-active");
  document.getElementById("adminUserName").textContent = user?.fullname || "Admin";
  document.getElementById("adminUserRole").textContent = user?.role || "Staff";
  loadAdminPanel("dashboard");
  refreshAdminNotifications();
  clearInterval(__notifTimer);
  __notifTimer = setInterval(refreshAdminNotifications, 60000); // cek permohonan baru tiap 60 detik
}

function logoutAdmin(){
  RTApi.logout().catch(() => {});
  RTApi.clearToken();
  localStorage.removeItem("rt_user");
  document.body.classList.remove("admin-mode");
  document.getElementById("adminApp").classList.remove("is-active");
  clearInterval(__notifTimer);
  toast("Berhasil keluar dari panel admin.");
}

// Auto-masuk admin jika sesi masih tersimpan
document.addEventListener("DOMContentLoaded", () => {
  const token = RTApi.getToken();
  const user = JSON.parse(localStorage.getItem("rt_user") || "null");
  if (token && user) enterAdmin(user);
});

/* ---------- 8. ADMIN SIDEBAR NAVIGATION ---------- */
const ADMIN_PANELS = {
  dashboard: { title: "Dashboard", render: renderDashboardPanel },
  warga: { title: "Data Profil Warga", render: renderWargaPanel },
  kas: { title: "Arus Kas RT/RW", render: renderKasPanel },
  iuran: { title: "Ceklist Iuran Warga", render: renderIuranPanel },
  aset: { title: "Aset & Inventaris", render: renderAsetPanel },
  layanan: { title: "Layanan & Pengaduan Warga", render: renderLayananPanel },
  agenda: { title: "Agenda & Pengumuman", render: renderAgendaPanel },
  petugas: { title: "Petugas & Audit Log", render: renderPetugasPanel },
  pengaturan: { title: "Pengaturan Sistem", render: renderPengaturanPanel },
};

function loadAdminPanel(key){
  document.querySelectorAll(".admin-nav a").forEach((a) => a.classList.toggle("active", a.dataset.panel === key));
  document.getElementById("adminTopbarTitle").textContent = ADMIN_PANELS[key]?.title || "";
  const content = document.getElementById("adminContent");
  content.innerHTML = '<div class="skeleton" style="height:220px;"></div>';
  closeAdminSidebar();
  ADMIN_PANELS[key]?.render(content);
}

document.addEventListener("click", (e) => {
  const link = e.target.closest(".admin-nav a[data-panel]");
  if (link) loadAdminPanel(link.dataset.panel);
});

function openAdminSidebar(){
  document.getElementById("adminSidebar")?.classList.add("is-open");
  document.getElementById("adminSidebarBackdrop")?.classList.add("show");
  document.body.classList.add("admin-sidebar-locked");
}
function closeAdminSidebar(){
  document.getElementById("adminSidebar")?.classList.remove("is-open");
  document.getElementById("adminSidebarBackdrop")?.classList.remove("show");
  document.body.classList.remove("admin-sidebar-locked");
}
function toggleAdminSidebar(){
  const sidebar = document.getElementById("adminSidebar");
  if (!sidebar) return;
  sidebar.classList.contains("is-open") ? closeAdminSidebar() : openAdminSidebar();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeAdminSidebar(); closeNotifDropdown(); }
});

/* ---------- 8b. NOTIFIKASI ADMIN: permohonan layanan baru ---------- */
let __notifTimer = null;
const NOTIF_JENIS_LABEL = { surat: "📄 Permohonan Surat Baru", pinjam: "📦 Peminjaman Aset Baru", aduan: "📢 Pengaduan & Saran Baru" };

function toggleNotifDropdown(){
  const dd = document.getElementById("notifDropdown");
  if (!dd) return;
  dd.classList.contains("show") ? closeNotifDropdown() : (dd.classList.add("show"), refreshAdminNotifications());
}
function closeNotifDropdown(){
  document.getElementById("notifDropdown")?.classList.remove("show");
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".notif-wrap")) closeNotifDropdown();
});

async function refreshAdminNotifications(){
  const dot = document.getElementById("notifDot");
  const list = document.getElementById("notifList");
  if (!dot || !list) return; // belum login / bukan di panel admin
  try {
    const rows = await RTApi.listLayanan();
    const pending = (rows || []).filter(r => (r.status || "Pending") === "Pending");
    const counts = { surat: 0, pinjam: 0, aduan: 0 };
    pending.forEach(r => { if (counts[r.jenis] !== undefined) counts[r.jenis]++; });
    dot.style.display = pending.length > 0 ? "block" : "none";

    if (!pending.length){
      list.innerHTML = '<div class="notif-empty">Tidak ada permohonan baru 🎉</div>';
      return;
    }
    const recent = [...pending].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    let html = Object.entries(counts).filter(([,c]) => c > 0).map(([jenis, c]) => `
      <button class="notif-row" onclick="goToLayanan('${jenis}')">
        <span>${NOTIF_JENIS_LABEL[jenis] || jenis}</span><span class="notif-count">${c} baru</span>
      </button>`).join("");
    html += '<div class="notif-divider"></div><div class="notif-subhead">Masuk Terbaru</div>';
    html += recent.map(r => `
      <div class="notif-item"><b>${r.nama || "Anonim"}</b><span>${NOTIF_JENIS_LABEL[r.jenis] || r.jenis} · ${fmtTanggal(r.createdAt)}</span></div>`).join("");
    list.innerHTML = html;
  } catch (err) {
    list.innerHTML = `<div class="notif-empty">Gagal memuat notifikasi.</div>`;
    console.warn("Gagal memuat notifikasi admin:", err.message);
  }
}
function goToLayanan(jenis){
  document.querySelectorAll(".admin-nav a").forEach((a) => a.classList.toggle("active", a.dataset.panel === "layanan"));
  const titleEl = document.getElementById("adminTopbarTitle");
  if (titleEl) titleEl.textContent = ADMIN_PANELS.layanan.title;
  closeAdminSidebar();
  closeNotifDropdown();
  renderLayananPanel(document.getElementById("adminContent"), jenis);
}

/* ---------- 9. HELPERS UMUM ---------- */
const BULAN_ID = ["","Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function fmtRupiah(n){
  return "Rp " + (Number(n) || 0).toLocaleString("id-ID");
}
function fmtTanggal(d){
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" });
}
function fmtTanggalLengkap(d){
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
}
function fmtTanggalPanjang(d){
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString("id-ID", { day:"numeric", month:"long", year:"numeric" });
}
function emptyRow(colspan, icon, text){
  return `<tr><td colspan="${colspan}"><div class="empty-state"><div class="es-ic">${icon}</div>${text}</div></td></tr>`;
}
function errorRow(colspan, err){
  return `<tr><td colspan="${colspan}"><div class="empty-state"><div class="es-ic">⚠️</div>Gagal memuat data: ${err.message}</div></td></tr>`;
}
function formToObject(form, fields){
  const data = {};
  fields.forEach((f) => { if (form[f] !== undefined) data[f] = form[f].value; });
  return data;
}
function linkifyWaMessage(text){
  const escaped = String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(/wa\.me\/(\d+)/g, '<a href="https://wa.me/$1" target="_blank" rel="noopener" style="color:inherit; text-decoration:underline; font-weight:600;">wa.me/$1</a>');
}
async function submitEntity(form, apiCall, { successMsg, modalId, reloadPanel }){
  const msg = form.querySelector(".form-msg");
  const btn = form.querySelector('button[type="submit"], .btn-primary');
  const originalLabel = btn ? btn.textContent : "";
  if (btn){ btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Menyimpan...'; }
  try {
    await apiCall();
    toast(successMsg);
    if (modalId) closeModal(modalId);
    form.reset();
    if (form.id !== undefined && form.querySelector('[name="id"]')) form.querySelector('[name="id"]').value = "";
    if (reloadPanel) loadAdminPanel(reloadPanel);
  } catch (err) {
    if (msg){ msg.innerHTML = linkifyWaMessage(err.message); msg.className = "form-msg err show"; }
    else toast(err.message, "err");
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = originalLabel; }
  }
}

/* ---------- 9b. HELPER: MODAL TAMBAH / EDIT / SALIN (dipakai di semua panel CRUD) ---------- */
function openAddModal(modalId, titleText){
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const form = modal.querySelector("form");
  if (form){ form.reset(); const idField = form.querySelector('[name="id"]'); if (idField) idField.value = ""; }
  const titleEl = modal.querySelector(".modal-head h3");
  if (titleEl){ if (!titleEl.dataset.orig) titleEl.dataset.orig = titleEl.textContent; titleEl.textContent = titleText || titleEl.dataset.orig; }
  openModal(modalId);
}
function openEditModal(modalId, data, titleText){
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const form = modal.querySelector("form");
  if (form){
    form.reset();
    Object.entries(data || {}).forEach(([k, v]) => { const el = form.querySelector(`[name="${k}"]`); if (el) el.value = v ?? ""; });
    const idField = form.querySelector('[name="id"]'); if (idField) idField.value = data.id || "";
  }
  const titleEl = modal.querySelector(".modal-head h3");
  if (titleEl){ if (!titleEl.dataset.orig) titleEl.dataset.orig = titleEl.textContent; titleEl.textContent = titleText; }
  openModal(modalId);
}
function waLink(no){
  if (!no) return "";
  let digits = String(no).replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  else if (!digits.startsWith("62")) digits = "62" + digits;
  return "https://wa.me/" + digits;
}

/* ---------- 10. DASHBOARD ---------- */
const HARI_ID = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
let __clockTimer = null;

function updateAdminClock(){
  const el = document.getElementById("adminClock");
  const dateEl = document.getElementById("adminClockDate");
  if (!el || !dateEl) { clearInterval(__clockTimer); __clockTimer = null; return; }
  const now = new Date();
  const pad = (n) => String(n).padStart(2,"0");
  el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  dateEl.textContent = `Hari ini, ${HARI_ID[now.getDay()]}, ${now.getDate()} ${BULAN_ID[now.getMonth()+1]} ${now.getFullYear()}`;
}

async function renderDashboardPanel(el){
  const user = JSON.parse(localStorage.getItem("rt_user") || "{}");
  clearInterval(__clockTimer);
  el.innerHTML = `
    <div id="connStatus" class="card" style="margin-bottom:18px; border-color:var(--border);">
      <div style="display:flex; align-items:center; gap:10px;"><span class="spinner"></span> Mengecek koneksi ke Google Sheets...</div>
    </div>
    <div class="card welcome-card reveal is-visible" style="margin-bottom:22px;">
      <div class="welcome-row">
        <div>
          <span class="eyebrow">👋 Selamat Datang</span>
          <h3 style="margin-top:10px; font-size:22px;">Halo, ${user.fullname || "Admin"}!</h3>
          <p id="adminClockDate" style="margin-top:6px; color:var(--text-muted);">Memuat tanggal...</p>
        </div>
        <div class="welcome-clock"><span id="adminClock">00:00:00</span></div>
      </div>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card"><span>Pemasukan Iuran</span><b id="kpiMasuk">Rp 0</b></div>
      <div class="kpi-card"><span>Kas Keluar</span><b id="kpiKeluar">Rp 0</b></div>
      <div class="kpi-card"><span>Sisa Saldo Kas</span><b id="kpiSaldo">Rp 0</b></div>
      <div class="kpi-card"><span>Warga Terdaftar</span><b id="kpiWarga">0 Jiwa</b></div>
    </div>
    <div class="card">
      <h3>Panel Admin RT03RW05 DIGITAL</h3>
      <p>Gunakan menu di sebelah kiri untuk mengelola data warga, kas, iuran, aset, layanan, agenda, dan pengumuman — semuanya tersimpan langsung ke Google Spreadsheet kamu.</p>
    </div>`;
  updateAdminClock();
  __clockTimer = setInterval(updateAdminClock, 1000);
  checkConnection();
  try {
    const [kas, warga] = await Promise.all([RTApi.listKas().catch(()=>[]), RTApi.listWarga().catch(()=>[])]);
    const masuk = kas.filter(k => k.tipe === "masuk").reduce((s,k)=>s+Number(k.jumlah||0),0);
    const keluar = kas.filter(k => k.tipe === "keluar").reduce((s,k)=>s+Number(k.jumlah||0),0);
    setText("kpiMasuk", fmtRupiah(masuk));
    setText("kpiKeluar", fmtRupiah(keluar));
    setText("kpiSaldo", fmtRupiah(masuk - keluar));
    setText("kpiWarga", warga.length + " Jiwa");
  } catch (err) { /* KPI tetap Rp 0 jika gagal memuat */ }
}

async function checkConnection(){
  const box = document.getElementById("connStatus");
  if (!box) return;
  if (!API_URL || API_URL.includes("PASTE_URL_WEB_APP")){
    box.style.borderColor = "var(--danger)";
    box.innerHTML = `<div style="display:flex; gap:10px;"><span>⚠️</span><div>
      <b style="color:var(--danger);">Belum tersambung ke Google Sheets</b>
      <p style="margin-top:4px; font-size:13.5px; color:var(--text-muted);">
        <code>API_URL</code> di <code>js/api.js</code> masih placeholder. Ganti dengan URL Web App hasil deploy Google Apps Script kamu, lalu upload ulang (redeploy) file ini ke hosting.
      </p></div></div>`;
    return;
  }
  try {
    await RTApi.getSettings();
    box.style.borderColor = "var(--success)";
    box.innerHTML = `<div style="display:flex; align-items:center; gap:10px;"><span>✅</span><b style="color:var(--success);">Terhubung ke Google Sheets</b></div>`;
  } catch (err) {
    box.style.borderColor = "var(--danger)";
    box.innerHTML = `<div style="display:flex; gap:10px;"><span>⚠️</span><div>
      <b style="color:var(--danger);">Gagal terhubung ke Google Sheets</b>
      <p style="margin-top:4px; font-size:13.5px; color:var(--text-muted);">Pesan error: <i>${err.message}</i></p>
      <p style="margin-top:6px; font-size:13.5px; color:var(--text-muted);">Kemungkinan penyebab: deployment Apps Script belum di-set "Who has access: Anyone", belum di-deploy ulang setelah edit Code.gs, atau URL di <code>js/api.js</code> salah/typo. Lihat README bagian "Langkah 2 & 3".</p></div></div>`;
  }
}

/* ---------- 11. PROFIL WARGA ---------- */
async function renderWargaPanel(el){
  el.innerHTML = `
    <div class="toolbar">
      <div class="filter-row"><input id="wargaSearch" type="text" placeholder="Cari nama / NIK..."></div>
      <button class="btn btn-primary btn-sm" onclick="openAddModal('modalWarga','Tambah Data Warga')">+ Tambah Warga</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>NIK</th><th>Nama</th><th>No. Rumah</th><th>JK</th><th>WhatsApp</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody id="wargaBody">${emptyRow(7,'⏳','Memuat data...')}</tbody>
      </table>
    </div>`;
  try {
    const rows = await RTApi.listWarga();
    window.__wargaCache = rows;
    renderWargaRows(rows);
    document.getElementById("wargaSearch").addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      renderWargaRows(rows.filter(r => (r.nama||"").toLowerCase().includes(q) || (r.nik||"").toString().includes(q)));
    });
  } catch (err) {
    document.getElementById("wargaBody").innerHTML = errorRow(7, err);
  }
}
function renderWargaRows(rows){
  const body = document.getElementById("wargaBody");
  if (!rows.length){ body.innerHTML = emptyRow(7,'👥','Belum ada data warga.'); return; }
  body.innerHTML = rows.map(r => `
    <tr>
      <td>${r.nik || "-"}</td><td>${r.nama || "-"}</td><td>${r.noRumah || "-"}</td>
      <td>${r.jenisKelamin === "Laki-laki" ? "L" : "P"}</td>
      <td>${r.noHp ? `<a href="${waLink(r.noHp)}" target="_blank" rel="noopener" class="wa-link" title="Hubungi via WhatsApp (darurat)">💬 ${r.noHp}</a>` : "-"}</td>
      <td><span class="badge ${r.statusAktif==='Pindahan'?'badge-muted':'badge-success'}">${r.statusAktif || "Aktif"}</span></td>
      <td class="row-actions">
        <button class="icon-btn" title="Edit" onclick='editWarga("${r.id}")'>✏️</button>
        <button class="icon-btn" title="Salin" onclick='duplicateWarga("${r.id}")'>📋</button>
        <button class="icon-btn" title="Hapus" onclick="deleteWarga('${r.id}')">🗑️</button>
      </td>
    </tr>`).join("");
}
function findWarga(id){ return (window.__wargaCache||[]).find(r => r.id === id); }
function editWarga(id){
  const data = findWarga(id);
  if (!data) return toast("Data tidak ditemukan, muat ulang halaman.", "err");
  openEditModal("modalWarga", data, "Edit Data Warga");
}
async function duplicateWarga(id){
  const data = findWarga(id);
  if (!data) return toast("Data tidak ditemukan, muat ulang halaman.", "err");
  try {
    const copy = { ...data, id: undefined, nama: data.nama + " (Salinan)" };
    await RTApi.saveWarga(copy);
    toast("Data warga disalin.");
    loadAdminPanel("warga");
  } catch (err) { toast(err.message, "err"); }
}
async function deleteWarga(id){
  if (!confirm("Hapus data warga ini?")) return;
  try { await RTApi.deleteWarga(id); toast("Data warga dihapus."); loadAdminPanel("warga"); }
  catch (err){ toast(err.message, "err"); }
}
async function handleSaveWarga(e){
  e.preventDefault();
  const form = e.target;
  const data = formToObject(form, ["id","nik","nama","noRumah","jenisKelamin","statusTinggal","posisiKeluarga","noHp"]);
  const isEdit = !!data.id;
  if (!isEdit) { delete data.id; data.statusAktif = "Aktif"; }
  await submitEntity(form, () => RTApi.saveWarga(data), { successMsg: isEdit ? "Perubahan data warga tersimpan." : "Data warga tersimpan.", modalId: "modalWarga", reloadPanel: "warga" });
}

/* ---------- 12. ARUS KAS ---------- */
function buildKasChart(allKas){
  // Kelompokkan 6 bulan terakhir
  const now = new Date();
  const months = [];
  for (let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: BULAN_ID[d.getMonth()+1].slice(0,3), masuk:0, keluar:0 });
  }
  allKas.forEach(k => {
    const d = new Date(k.tanggal);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = months.find(m => m.key === key);
    if (!m) return;
    if (k.tipe === "masuk") m.masuk += Number(k.jumlah||0); else m.keluar += Number(k.jumlah||0);
  });
  const max = Math.max(1, ...months.map(m => Math.max(m.masuk, m.keluar)));
  const W = 640, H = 220, padL = 10, padB = 28, groupW = (W-padL) / months.length, barW = 20;
  let bars = "", labels = "";
  months.forEach((m, i) => {
    const gx = padL + i*groupW + groupW/2;
    const hMasuk = (m.masuk/max) * (H-padB-14);
    const hKeluar = (m.keluar/max) * (H-padB-14);
    bars += `<rect x="${gx-barW-3}" y="${H-padB-hMasuk}" width="${barW}" height="${hMasuk}" rx="4" fill="var(--teal-700)"><title>Masuk ${m.label}: ${fmtRupiah(m.masuk)}</title></rect>`;
    bars += `<rect x="${gx+3}" y="${H-padB-hKeluar}" width="${barW}" height="${hKeluar}" rx="4" fill="var(--gold-500)"><title>Keluar ${m.label}: ${fmtRupiah(m.keluar)}</title></rect>`;
    labels += `<text x="${gx}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--text-muted)" font-family="var(--font-body)">${m.label}</text>`;
  });
  return `
    <div class="card" style="margin-bottom:20px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <h3>📊 Grafik Arus Kas — 6 Bulan Terakhir</h3>
        <div style="display:flex; gap:16px; font-size:12.5px; color:var(--text-muted);">
          <span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--teal-700);margin-right:5px;"></i>Pemasukan</span>
          <span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--gold-500);margin-right:5px;"></i>Pengeluaran</span>
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto; overflow:visible;">
        <line x1="0" y1="${H-padB}" x2="${W}" y2="${H-padB}" stroke="var(--border)" stroke-width="1"/>
        ${bars}${labels}
      </svg>
    </div>`;
}

async function renderKasPanel(el, tab = "masuk"){
  el.innerHTML = `
    <div id="kasChartWrap">${emptyRow(1,'⏳','Memuat grafik...')}</div>
    <div class="tab-strip">
      <button class="${tab==='masuk'?'active':''}" onclick="renderKasPanel(document.getElementById('adminContent'),'masuk')">Pemasukan</button>
      <button class="${tab==='keluar'?'active':''}" onclick="renderKasPanel(document.getElementById('adminContent'),'keluar')">Pengeluaran</button>
    </div>
    <div class="toolbar">
      <div></div>
      <button class="btn btn-primary btn-sm" onclick="openAddModal('${tab==='masuk'?'modalPemasukan':'modalPengeluaran'}','Catat ${tab==='masuk'?'Pemasukan':'Pengeluaran'} Kas')">+ Catat ${tab==='masuk'?'Pemasukan':'Pengeluaran'}</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tanggal</th><th>${tab==='masuk'?'Sumber':'Keperluan'}</th><th>Kategori</th><th>Jumlah</th><th>Aksi</th></tr></thead>
        <tbody id="kasBody">${emptyRow(5,'⏳','Memuat data...')}</tbody>
      </table>
    </div>`;
  try {
    const allKas = await RTApi.listKas();
    window.__kasCache = allKas;
    document.getElementById("kasChartWrap").innerHTML = buildKasChart(allKas);
    const rows = allKas.filter(r => r.tipe === tab);
    const body = document.getElementById("kasBody");
    body.innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td>${fmtTanggal(r.tanggal)}</td><td>${r.namaSumber || "-"}</td><td>${r.kategori || "-"}</td>
        <td>${fmtRupiah(r.jumlah)}</td>
        <td class="row-actions">
          <button class="icon-btn" title="Edit" onclick='editKas("${r.id}","${tab}")'>✏️</button>
          <button class="icon-btn" title="Salin" onclick='duplicateKas("${r.id}","${tab}")'>📋</button>
          <button class="icon-btn" title="Hapus" onclick="deleteKas('${r.id}','${tab}')">🗑️</button>
        </td>
      </tr>`).join("") : emptyRow(5,'💰','Belum ada transaksi.');
  } catch (err) {
    document.getElementById("kasChartWrap").innerHTML = "";
    document.getElementById("kasBody").innerHTML = errorRow(5, err);
  }
}
function findKas(id){ return (window.__kasCache||[]).find(r => r.id === id); }
function editKas(id, tab){
  const data = findKas(id);
  if (!data) return toast("Data tidak ditemukan, muat ulang panel.", "err");
  const modalId = tab === "masuk" ? "modalPemasukan" : "modalPengeluaran";
  openEditModal(modalId, data, `Edit ${tab==='masuk'?'Pemasukan':'Pengeluaran'} Kas`);
}
async function duplicateKas(id, tab){
  const data = findKas(id);
  if (!data) return toast("Data tidak ditemukan, muat ulang panel.", "err");
  try {
    await RTApi.saveKas({ ...data, id: undefined, tanggal: new Date().toISOString().slice(0,10) });
    toast("Transaksi disalin.");
    renderKasPanel(document.getElementById("adminContent"), tab);
  } catch (err) { toast(err.message, "err"); }
}
async function deleteKas(id, tab){
  if (!confirm("Hapus transaksi ini?")) return;
  try { await RTApi.deleteKas(id); toast("Transaksi dihapus."); renderKasPanel(document.getElementById("adminContent"), tab); }
  catch (err){ toast(err.message, "err"); }
}
async function handleSaveKas(e, tipe){
  e.preventDefault();
  const form = e.target;
  const data = formToObject(form, ["id","namaSumber","kategori","jumlah","tanggal"]);
  if (!data.id) delete data.id;
  data.tipe = tipe;
  await submitEntity(form, () => RTApi.saveKas(data), {
    successMsg: data.id ? "Perubahan transaksi tersimpan." : "Transaksi tersimpan.",
    modalId: tipe === "masuk" ? "modalPemasukan" : "modalPengeluaran",
  });
  renderKasPanel(document.getElementById("adminContent"), tipe);
}

/* ---------- 13. CEKLIST IURAN ---------- */
async function renderIuranPanel(el){
  el.innerHTML = `<div class="table-wrap">${emptyRow(1,'⏳','Memuat data...')}</div>`;
  try {
    const now = new Date();
    const bulan = now.getMonth()+1, tahun = now.getFullYear();
    const [warga, iuran, settings] = await Promise.all([RTApi.listWarga(), RTApi.listIuran(), RTApi.getSettings().catch(()=>({}))]);
    const kk = warga.filter(w => w.posisiKeluarga === "Kepala Keluarga");
    const nominal = settings.nominalIuran || 20000;
    const lunasSet = new Set(iuran.filter(i => Number(i.bulan)===bulan && Number(i.tahun)===tahun && (i.lunas===true||i.lunas==="TRUE")).map(i=>i.wargaId));
    const totalTerkumpul = lunasSet.size * Number(nominal);

    el.innerHTML = `
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);">
        <div class="kpi-card"><span>Total Terkumpul (${BULAN_ID[bulan]})</span><b>${fmtRupiah(totalTerkumpul)}</b></div>
        <div class="kpi-card"><span>Sudah Bayar</span><b>${lunasSet.size} KK</b></div>
        <div class="kpi-card"><span>Belum Bayar</span><b>${kk.length - lunasSet.size} KK</b></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nama Warga</th><th>No. Rumah</th><th>Status</th><th>Centang Lunas</th></tr></thead>
          <tbody>${kk.length ? kk.map(w => `
            <tr>
              <td>${w.nama}</td><td>${w.noRumah || "-"}</td>
              <td>${lunasSet.has(w.id) ? '<span class="badge badge-success">Lunas</span>' : '<span class="badge badge-warn">Menunggak</span>'}</td>
              <td><input type="checkbox" ${lunasSet.has(w.id)?'checked':''} onchange="toggleIuranRow('${w.id}', ${bulan}, ${tahun}, this.checked)"></td>
            </tr>`).join("") : emptyRow(4,'✅','Belum ada Kepala Keluarga terdaftar.')}</tbody>
        </table>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="card">${errorRow(1, err)}</div>`;
  }
}
async function toggleIuranRow(wargaId, bulan, tahun, checked){
  try { await RTApi.toggleIuran(wargaId, bulan, tahun, checked); toast(checked ? "Ditandai lunas." : "Pembayaran dibatalkan."); loadAdminPanel("iuran"); }
  catch (err){ toast(err.message, "err"); }
}

/* ---------- 14. ASET & INVENTARIS ---------- */
async function renderAsetPanel(el){
  el.innerHTML = `
    <div class="toolbar"><div></div><button class="btn btn-primary btn-sm" onclick="openAddModal('modalAset','Tambah Aset / Barang')">+ Tambah Aset</button></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nama Barang</th><th>Total</th><th>Tersedia</th><th>Kondisi</th><th>Aksi</th></tr></thead>
        <tbody id="asetBody">${emptyRow(5,'⏳','Memuat data...')}</tbody>
      </table>
    </div>`;
  try {
    const rows = await RTApi.listAset();
    window.__asetCache = rows;
    const body = document.getElementById("asetBody");
    body.innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td>${r.nama}</td><td>${r.jumlahTotal}</td><td>${r.jumlahTersedia}</td>
        <td><span class="badge ${r.kondisi==='Baik'?'badge-success':r.kondisi==='Rusak Berat'?'badge-danger':'badge-warn'}">${r.kondisi||'-'}</span></td>
        <td class="row-actions">
          <button class="icon-btn" title="Edit" onclick='editAset("${r.id}")'>✏️</button>
          <button class="icon-btn" title="Salin" onclick='duplicateAset("${r.id}")'>📋</button>
          <button class="icon-btn" title="Hapus" onclick="deleteAset('${r.id}')">🗑️</button>
        </td>
      </tr>`).join("") : emptyRow(5,'📦','Belum ada data aset.');
  } catch (err) {
    document.getElementById("asetBody").innerHTML = errorRow(5, err);
  }
}
function findAset(id){ return (window.__asetCache||[]).find(r => r.id === id); }
function editAset(id){
  const data = findAset(id);
  if (!data) return toast("Data tidak ditemukan, muat ulang panel.", "err");
  openEditModal("modalAset", data, "Edit Data Aset");
}
async function duplicateAset(id){
  const data = findAset(id);
  if (!data) return toast("Data tidak ditemukan, muat ulang panel.", "err");
  try {
    await RTApi.saveAset({ ...data, id: undefined, nama: data.nama + " (Salinan)", jumlahTersedia: data.jumlahTotal });
    toast("Data aset disalin.");
    loadAdminPanel("aset");
  } catch (err) { toast(err.message, "err"); }
}
async function deleteAset(id){
  if (!confirm("Hapus data aset ini?")) return;
  try { await RTApi.deleteAset(id); toast("Data aset dihapus."); loadAdminPanel("aset"); }
  catch (err){ toast(err.message, "err"); }
}
async function handleSaveAset(e){
  e.preventDefault();
  const form = e.target;
  const data = formToObject(form, ["id","nama","jumlahTotal","kondisi","keterangan"]);
  const isEdit = !!data.id;
  if (!isEdit){ delete data.id; data.jumlahTersedia = data.jumlahTotal; }
  // Saat edit, jumlahTersedia sengaja TIDAK ikut dikirim supaya angka stok yang sedang dipinjam tidak tertimpa/reset.
  await submitEntity(form, () => RTApi.saveAset(data), { successMsg: isEdit ? "Perubahan data aset tersimpan." : "Data aset tersimpan.", modalId: "modalAset", reloadPanel: "aset" });
}

/* ---------- 15. LAYANAN & PENGADUAN ---------- */
async function renderLayananPanel(el, jenis = "surat"){
  const labels = { surat: "📄 Permohonan Surat", pinjam: "📦 Peminjaman Aset", aduan: "📢 Pengaduan & Saran" };
  el.innerHTML = `
    <div class="tab-strip">
      ${Object.entries(labels).map(([k,l]) => `<button class="${k===jenis?'active':''}" onclick="renderLayananPanel(document.getElementById('adminContent'),'${k}')">${l}</button>`).join("")}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tanggal</th><th>Nama</th><th>Detail</th><th>Status</th><th>Ubah Status</th></tr></thead>
        <tbody id="layananBody">${emptyRow(5,'⏳','Memuat data...')}</tbody>
      </table>
    </div>`;
  try {
    const rows = await RTApi.listLayanan(jenis);
    const body = document.getElementById("layananBody");
    body.innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td>${fmtTanggal(r.createdAt)}</td><td>${r.nama || "Anonim"}</td><td>${r.detail || "-"}</td>
        <td><span class="badge badge-warn">${r.status||'Pending'}</span></td>
        <td>
          <select onchange="updateLayananStatus('${r.id}','${jenis}',this.value)">
            <option ${r.status==='Pending'?'selected':''}>Pending</option>
            <option ${r.status==='Diproses'?'selected':''}>Diproses</option>
            <option ${r.status==='Selesai'?'selected':''}>Selesai</option>
            <option ${r.status==='Ditolak'?'selected':''}>Ditolak</option>
          </select>
        </td>
      </tr>`).join("") : emptyRow(5,'📮','Belum ada permohonan masuk.');
  } catch (err) {
    document.getElementById("layananBody").innerHTML = errorRow(5, err);
  }
}
async function updateLayananStatus(id, jenis, status){
  try { await RTApi.updateLayananStatus(jenis, id, status); toast("Status permohonan diperbarui."); refreshAdminNotifications(); }
  catch (err){ toast(err.message, "err"); }
}
async function handleSubmitLayanan(e, jenis, modalId){
  e.preventDefault();
  const form = e.target;
  const data = formToObject(form, ["nama","nik","noRumah","noHp","detail"]);
  const msg = form.querySelector(".form-msg");
  const noRumahPattern = /^C\d+\/\d{2}$/i;
  if (!noRumahPattern.test((data.noRumah || "").trim())) {
    if (msg){ msg.textContent = "Format nomor rumah tidak valid. Gunakan format seperti C1/09."; msg.className = "form-msg err show"; }
    return;
  }
  await submitEntity(form, () => RTApi.submitLayanan(jenis, data), { successMsg: "Permohonan terkirim ke pengurus, terima kasih.", modalId });
}

/* ---------- 16. AGENDA & PENGUMUMAN ---------- */
async function renderAgendaPanel(el, tab = "agenda"){
  el.innerHTML = `
    <div class="tab-strip">
      <button class="${tab==='agenda'?'active':''}" onclick="renderAgendaPanel(document.getElementById('adminContent'),'agenda')">📅 Agenda Kegiatan</button>
      <button class="${tab==='pengumuman'?'active':''}" onclick="renderAgendaPanel(document.getElementById('adminContent'),'pengumuman')">📢 Pengumuman</button>
    </div>
    <div class="toolbar">
      <div></div>
      <button class="btn btn-primary btn-sm" onclick="openAddModal('${tab==='agenda'?'modalAgenda':'modalPengumuman'}','${tab==='agenda'?'Buat Agenda Kegiatan':'Buat Pengumuman'}')">+ ${tab==='agenda'?'Buat Agenda':'Buat Pengumuman'}</button>
    </div>
    <div class="table-wrap">
      <table>
        ${tab==='agenda'
          ? '<thead><tr><th>Judul</th><th>Kategori</th><th>Tanggal</th><th>Waktu</th><th>Lokasi</th><th>Aksi</th></tr></thead>'
          : '<thead><tr><th>Tanggal</th><th>Waktu</th><th>Tipe</th><th>Judul</th><th>Isi</th><th>Aksi</th></tr></thead>'}
        <tbody id="agendaBody">${emptyRow(6,'⏳','Memuat data...')}</tbody>
      </table>
    </div>`;
  try {
    const body = document.getElementById("agendaBody");
    if (tab === "agenda") {
      const rows = await RTApi.listAgenda();
      window.__agendaCache = rows;
      body.innerHTML = rows.length ? rows.map(r => `
        <tr><td>${r.judul}</td><td>${r.kategori}</td><td>${fmtTanggal(r.tanggalJam)}</td><td>${r.waktu ? r.waktu + ' WIB' : '-'}</td><td>${r.lokasi}</td>
        <td class="row-actions">
          <button class="icon-btn" title="Edit" onclick='editAgenda("${r.id}")'>✏️</button>
          <button class="icon-btn" title="Salin" onclick='duplicateAgenda("${r.id}")'>📋</button>
          <button class="icon-btn" title="Hapus" onclick="deleteAgenda('${r.id}')">🗑️</button>
        </td></tr>`).join("")
        : emptyRow(6,'🗓️','Belum ada agenda kegiatan.');
    } else {
      const rows = await RTApi.listPengumuman();
      window.__pengumumanCache = rows;
      body.innerHTML = rows.length ? rows.map(r => `
        <tr><td>${fmtTanggal(r.tanggal)}</td><td>${r.waktu ? r.waktu + ' WIB' : '-'}</td><td><span class="badge ${r.tipe==='PENTING'?'badge-danger':'badge-info'}">${r.tipe}</span></td>
        <td>${r.judul}</td><td>${(r.isi||"").slice(0,60)}...</td>
        <td class="row-actions">
          <button class="icon-btn" title="Edit" onclick='editPengumuman("${r.id}")'>✏️</button>
          <button class="icon-btn" title="Salin" onclick='duplicatePengumuman("${r.id}")'>📋</button>
          <button class="icon-btn" title="Hapus" onclick="deletePengumuman('${r.id}')">🗑️</button>
        </td></tr>`).join("")
        : emptyRow(6,'📢','Belum ada pengumuman.');
    }
  } catch (err) {
    document.getElementById("agendaBody").innerHTML = errorRow(6, err);
  }
}
function findAgenda(id){ return (window.__agendaCache||[]).find(r => r.id === id); }
function findPengumuman(id){ return (window.__pengumumanCache||[]).find(r => r.id === id); }

function editAgenda(id){
  const data = findAgenda(id);
  if (!data) return toast("Data tidak ditemukan, muat ulang panel.", "err");
  // Pecah tanggalJam (tersimpan gabungan) jadi field tanggal + waktu terpisah untuk mengisi form
  const dt = new Date(data.tanggalJam);
  const tanggal = !isNaN(dt) ? dt.toISOString().slice(0,10) : "";
  const waktu = data.waktu || (!isNaN(dt) ? String(dt.getHours()).padStart(2,"0") + ":" + String(dt.getMinutes()).padStart(2,"0") : "");
  openEditModal("modalAgenda", { ...data, tanggal, waktu }, "Edit Agenda Kegiatan");
}
async function duplicateAgenda(id){
  const data = findAgenda(id);
  if (!data) return toast("Data tidak ditemukan, muat ulang panel.", "err");
  try {
    await RTApi.saveAgenda({ ...data, id: undefined, judul: data.judul + " (Salinan)" });
    toast("Agenda disalin.");
    renderAgendaPanel(document.getElementById("adminContent"), "agenda");
  } catch (err) { toast(err.message, "err"); }
}
function editPengumuman(id){
  const data = findPengumuman(id);
  if (!data) return toast("Data tidak ditemukan, muat ulang panel.", "err");
  openEditModal("modalPengumuman", data, "Edit Pengumuman");
}
async function duplicatePengumuman(id){
  const data = findPengumuman(id);
  if (!data) return toast("Data tidak ditemukan, muat ulang panel.", "err");
  try {
    await RTApi.savePengumuman({ ...data, id: undefined, judul: data.judul + " (Salinan)" });
    toast("Pengumuman disalin.");
    renderAgendaPanel(document.getElementById("adminContent"), "pengumuman");
  } catch (err) { toast(err.message, "err"); }
}
async function deleteAgenda(id){ if(!confirm("Hapus agenda ini?"))return; try{ await RTApi.deleteAgenda(id); toast("Agenda dihapus."); renderAgendaPanel(document.getElementById("adminContent"),"agenda"); }catch(err){toast(err.message,"err");} }
async function deletePengumuman(id){ if(!confirm("Hapus pengumuman ini?"))return; try{ await RTApi.deletePengumuman(id); toast("Pengumuman dihapus."); renderAgendaPanel(document.getElementById("adminContent"),"pengumuman"); }catch(err){toast(err.message,"err");} }
async function handleSaveAgenda(e){
  e.preventDefault();
  const form = e.target;
  const data = formToObject(form, ["id","judul","kategori","tanggal","waktu","lokasi"]);
  const isEdit = !!data.id;
  if (!isEdit){ delete data.id; data.status = "Terjadwal"; }
  data.tanggalJam = data.tanggal && data.waktu ? `${data.tanggal}T${data.waktu}` : data.tanggal;
  delete data.tanggal;
  await submitEntity(form, () => RTApi.saveAgenda(data), { successMsg: isEdit ? "Perubahan agenda tersimpan." : "Agenda tersimpan.", modalId: "modalAgenda" });
  renderAgendaPanel(document.getElementById("adminContent"), "agenda");
}
async function handleSavePengumuman(e){
  e.preventDefault();
  const form = e.target;
  const data = formToObject(form, ["id","tanggal","waktu","tipe","judul","isi"]);
  if (!data.id) delete data.id;
  await submitEntity(form, () => RTApi.savePengumuman(data), { successMsg: data.id ? "Perubahan pengumuman tersimpan." : "Pengumuman tersimpan.", modalId: "modalPengumuman" });
  renderAgendaPanel(document.getElementById("adminContent"), "pengumuman");
}

/* ---------- 17. PETUGAS & AUDIT ---------- */
async function renderPetugasPanel(el){
  el.innerHTML = `
    <div class="toolbar"><h3 style="font-size:15px;">Daftar Petugas</h3><button class="btn btn-primary btn-sm" onclick="openModal('modalPetugas')">+ Tambah Petugas</button></div>
    <div class="table-wrap" style="margin-bottom:26px;">
      <table><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Aksi</th></tr></thead>
      <tbody id="petugasBody">${emptyRow(4,'⏳','Memuat data...')}</tbody></table>
    </div>
    <h3 style="font-size:15px; margin-bottom:12px;">Audit Aktivitas</h3>
    <div class="table-wrap">
      <table><thead><tr><th>Waktu</th><th>Petugas</th><th>Aksi</th><th>Detail</th></tr></thead>
      <tbody id="auditBody">${emptyRow(4,'⏳','Memuat data...')}</tbody></table>
    </div>`;
  try {
    const petugas = await RTApi.listPetugas();
    document.getElementById("petugasBody").innerHTML = petugas.length ? petugas.map(p => `
      <tr><td>${p.fullname}</td><td>${p.username}</td><td><span class="badge badge-info">${p.role}</span></td>
      <td class="row-actions"><button class="icon-btn" onclick="deletePetugas('${p.id}')">🗑️</button></td></tr>`).join("")
      : emptyRow(4,'🛡️','Belum ada data petugas.');
  } catch (err) { document.getElementById("petugasBody").innerHTML = errorRow(4, err); }
  try {
    const audit = (await RTApi.listAudit()).slice(-30).reverse();
    document.getElementById("auditBody").innerHTML = audit.length ? audit.map(a => `
      <tr><td>${fmtTanggal(a.waktu)}</td><td>${a.petugas}</td><td>${a.aksi}</td><td>${a.detail||'-'}</td></tr>`).join("")
      : emptyRow(4,'📋','Belum ada log aktivitas.');
  } catch (err) { document.getElementById("auditBody").innerHTML = errorRow(4, err); }
}
async function deletePetugas(id){ if(!confirm("Hapus petugas ini?"))return; try{ await RTApi.deletePetugas(id); toast("Petugas dihapus."); loadAdminPanel("petugas"); }catch(err){toast(err.message,"err");} }
async function handleSavePetugas(e){
  e.preventDefault();
  const form = e.target;
  const data = formToObject(form, ["fullname","username","password","role"]);
  await submitEntity(form, () => RTApi.savePetugas(data), { successMsg: "Petugas baru ditambahkan.", modalId: "modalPetugas", reloadPanel: "petugas" });
}

/* ---------- 18. PENGATURAN ---------- */
let __pendingBranding = {}; // menampung hasil upload base64 sebelum disimpan

async function renderPengaturanPanel(el){
  el.innerHTML = `<div class="card">${emptyRow(1,'⏳','Memuat pengaturan...')}</div>`;
  __pendingBranding = {};
  try {
    const s = await RTApi.getSettings();
    el.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <h3>Nominal Iuran Bulanan</h3>
          <form onsubmit="handleSaveSettings(event, {nominalIuran: this.nominalIuran.value})">
            <div class="field" style="margin-top:14px;"><label>Rp</label><input name="nominalIuran" type="number" value="${s.nominalIuran||20000}"></div>
            <button class="btn btn-primary btn-sm">Simpan Pengaturan</button>
          </form>
        </div>

        <div class="card">
          <h3>Logo &amp; Favicon Website</h3>
          <div class="field" style="margin-top:14px;">
            <label>Logo Website (header &amp; footer)</label>
            <div class="upload-box">
              <div class="upload-preview" id="previewLogo"><img src="${s.logoBase64 || 'assets/logo.png'}" alt="Preview logo"></div>
              <div style="flex:1;">
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" onchange="handleImageUpload(event,'logoBase64','previewLogo')">
                <p class="field-hint">PNG/JPG persegi, maks. 35KB (disarankan 128×128–256×256px).</p>
              </div>
            </div>
          </div>
          <div class="field">
            <label>Favicon (ikon tab browser)</label>
            <div class="upload-box">
              <div class="upload-preview round" id="previewFavicon"><img src="${s.faviconBase64 || 'assets/favicon-32x32.png'}" alt="Preview favicon"></div>
              <div style="flex:1;">
                <input type="file" accept="image/png,image/x-icon" onchange="handleImageUpload(event,'faviconBase64','previewFavicon')">
                <p class="field-hint">PNG/ICO, maks. 35KB (disarankan 32×32px).</p>
              </div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="handleSaveBranding()">Simpan Logo &amp; Favicon</button>
        </div>

        <div class="card">
          <h3>Identitas &amp; Deskripsi Website</h3>
          <form id="formBranding" onsubmit="event.preventDefault(); handleSaveBranding();">
            <div class="field" style="margin-top:14px;"><label>Nama RT/RW (Header &amp; Footer)</label><input name="namaRtRw" type="text" value="${s.namaRtRw||'RT03RW05 DIGITAL'}"></div>
            <div class="field"><label>Tagline / Sub-judul Header</label><input name="tagline" type="text" value="${s.tagline||'DIGITAL'}"></div>
            <div class="field"><label>Label Wilayah (di atas judul hero)</label><input name="wilayahTag" type="text" value="${s.wilayahTag||'WILAYAH RT 03 / RW 05'}"></div>
            <div class="field"><label>Judul Hero (Beranda)</label><textarea name="heroTitle" rows="2">${s.heroTitle||'Bersama Warga, Membangun Lingkungan yang Nyaman dan Harmonis'}</textarea></div>
            <div class="field"><label>Deskripsi Hero (paragraf di bawah judul)</label><textarea name="heroLead" rows="2">${s.heroLead||'Satu portal digital untuk komunikasi, transparansi keuangan kas, dan pelayanan administrasi warga — cepat, terbuka, dan mudah diakses kapan saja.'}</textarea></div>
            <div class="field"><label>Deskripsi Singkat (Footer)</label><textarea name="siteDesc" rows="2">${s.siteDesc||'Platform informasi & keuangan warga RT 03 / RW 05.'}</textarea></div>
            <button class="btn btn-primary btn-sm">Simpan Identitas</button>
          </form>
        </div>

        <div class="card">
          <h3>Copyright Footer</h3>
          <form onsubmit="handleSaveSettings(event, {copyrightText: this.copyrightText.value})">
            <div class="field" style="margin-top:14px;"><label>Teks Copyright</label><input name="copyrightText" type="text" value="${s.copyrightText||'© 2026 RT03RW05 DIGITAL. Seluruh hak cipta dilindungi.'}"></div>
            <button class="btn btn-primary btn-sm">Simpan Copyright</button>
          </form>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="card">${errorRow(1, err)}</div>`;
  }
}

function handleImageUpload(e, key, previewId){
  const file = e.target.files[0];
  if (!file) return;
  // Google Sheets membatasi 1 cell maksimal ~50.000 karakter, dan base64
  // menambah ukuran file sekitar 33% — jadi file asli dibatasi cukup kecil.
  if (file.size > 35 * 1024) { toast("Ukuran file maksimal 35KB agar muat disimpan di Google Sheets. Kompres/perkecil gambar dulu, ya.", "err"); return; }
  const reader = new FileReader();
  reader.onload = () => {
    __pendingBranding[key] = reader.result;
    const preview = document.getElementById(previewId);
    if (preview) preview.innerHTML = `<img src="${reader.result}" alt="Preview">`;
  };
  reader.readAsDataURL(file);
}

async function handleSaveBranding(){
  const formBranding = document.getElementById("formBranding");
  const data = { ...__pendingBranding };
  if (formBranding) {
    data.namaRtRw = formBranding.namaRtRw.value;
    data.tagline = formBranding.tagline.value;
    data.wilayahTag = formBranding.wilayahTag.value;
    data.heroTitle = formBranding.heroTitle.value;
    data.heroLead = formBranding.heroLead.value;
    data.siteDesc = formBranding.siteDesc.value;
  }
  try {
    await RTApi.saveSettings(data);
    toast("Perubahan tampilan tersimpan.");
    applyBranding(data);
    __pendingBranding = {};
  } catch (err) {
    toast(err.message, "err");
  }
}

/* Terapkan pengaturan branding ke elemen-elemen di seluruh halaman */
function applyBranding(s){
  if (s.namaRtRw){
    ["siteNameNav","siteNameFooter","siteNameAdmin"].forEach(id => setText(id, s.namaRtRw));
    document.title = s.namaRtRw + " — Sistem Informasi & Keuangan Warga";
  }
  if (s.tagline) setText("siteTaglineNav", s.tagline);
  setText("heroWilayahTag", s.wilayahTag || "WILAYAH RT 03 / RW 05");
  setText("heroTitle", s.heroTitle || "Bersama Warga, Membangun Lingkungan yang Nyaman dan Harmonis");
  setText("heroLead", s.heroLead || "Satu portal digital untuk komunikasi, transparansi keuangan kas, dan pelayanan administrasi warga — cepat, terbuka, dan mudah diakses kapan saja.");
  if (s.siteDesc) setText("siteDescFooter", s.siteDesc);
  if (s.copyrightText) setText("siteCopyright", s.copyrightText);
  if (s.logoBase64){
    ["siteLogoNav","siteLogoFooter","siteLogoAdmin"].forEach(id => { const img = document.getElementById(id); if (img) img.src = s.logoBase64; });
  }
  if (s.faviconBase64){
    document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(link => link.href = s.faviconBase64);
  }
}

/* Muat & terapkan branding tersimpan saat halaman pertama kali dibuka */
async function loadBrandingOnBoot(){
  try {
    const s = await RTApi.getSettings();
    applyBranding(s);
  } catch (err) {
    // API belum tersambung — tetap hilangkan skeleton loading dengan teks default yang wajar
    applyBranding({});
  }
}
document.addEventListener("DOMContentLoaded", loadBrandingOnBoot);
async function handleSaveSettings(e, data){
  e.preventDefault();
  const form = e.target;
  await submitEntity(form, () => RTApi.saveSettings(data), { successMsg: "Pengaturan tersimpan." });
}

/* ---------- 19. DATA PUBLIK DI LANDING PAGE ---------- */
async function loadLandingData(){
  try {
    const d = await RTApi.getLandingData();
    if (!d) throw new Error("Respons kosong dari server.");
    setText("statWarga", d.statWarga ?? 0); setText("statKK", d.statKK ?? 0);
    setText("statL", d.statL ?? 0); setText("statP", d.statP ?? 0);
    setText("fcSaldo", fmtRupiah(d.saldoKas));
    setText("fpSaldo", fmtRupiah(d.saldoKas));
    setText("fpMasuk", fmtRupiah(d.totalMasuk));
    setText("fpKeluar", fmtRupiah(d.totalKeluar));
    const pct = d.iuranTotalKK ? Math.round((d.iuranSudahBayar / d.iuranTotalKK) * 100) : 0;
    setText("fcIuran", `${d.iuranSudahBayar||0}/${d.iuranTotalKK||0} KK`);
    setText("fpIuranPct", pct + "%");
    document.querySelector(".progress-track i") && (document.querySelector(".progress-track i").style.width = pct + "%");
    const saldoPct = d.totalMasuk ? Math.min(100, Math.round((d.saldoKas / d.totalMasuk) * 100)) : 0;
    const saldoBar = document.getElementById("fcSaldoBar"); if (saldoBar) saldoBar.style.width = Math.max(0,saldoPct) + "%";
    const iuranBar = document.getElementById("fcIuranBar"); if (iuranBar) iuranBar.style.width = pct + "%";

    const asetBody = document.getElementById("tableAset");
    if (asetBody) asetBody.innerHTML = d.aset?.length ? d.aset.map(a => `
      <tr><td>${a.nama}</td><td>${a.jumlahTotal}</td><td>${a.jumlahTersedia}</td>
      <td><span class="badge ${a.kondisi==='Baik'?'badge-success':'badge-warn'}">${a.kondisi||'-'}</span></td></tr>`).join("")
      : emptyRow(4,'📦','Belum ada data aset.');

    const jadwal = document.getElementById("listJadwal");
    if (jadwal){
      jadwal.innerHTML = d.agenda?.length ? d.agenda.slice(0,5).map(a => {
        const dt = new Date(a.tanggalJam);
        return `<div class="list-row"><div class="list-date"><b>${isNaN(dt)?'-':dt.getDate()}</b><span>${isNaN(dt)?'-':dt.toLocaleDateString('id-ID',{month:'short'})}</span><small>${isNaN(dt)?'':dt.getFullYear()}</small></div>
        <div class="list-body"><h4>${a.judul}</h4><p>${a.lokasi||''}${a.waktu ? ' · ' + a.waktu + ' WIB' : ''}</p></div><span class="badge badge-info">${a.status||'Terjadwal'}</span></div>`;
      }).join("") : emptyRow(1,'🗓️','Belum ada agenda terjadwal.');
    }
    const upcoming = (d.agenda||[])
      .filter(a => !isNaN(new Date(a.tanggalJam)) && new Date(a.tanggalJam) >= new Date())
      .sort((a,b) => new Date(a.tanggalJam) - new Date(b.tanggalJam))[0];
    setText("fcAgenda", upcoming ? upcoming.judul : "Belum ada agenda");
    setText("fcAgendaDate", upcoming ? `${fmtTanggalPanjang(upcoming.tanggalJam)}${upcoming.waktu ? ' · ' + upcoming.waktu + ' WIB' : ''}` : "");

    const peng = document.getElementById("listPengumuman");
    if (peng && d.pengumuman?.length) peng.innerHTML = d.pengumuman.slice(0,3).map(p => `
      <div class="card"><span class="badge ${p.tipe==='PENTING'?'badge-danger':'badge-info'}">${p.tipe||'Info'}</span>
      <p class="pengumuman-date">${fmtTanggalLengkap(p.tanggal)}${p.waktu ? ' · ' + p.waktu + ' WIB' : ''}</p>
      <h3 style="margin-top:6px;">${p.judul}</h3><p>${(p.isi||'').slice(0,120)}</p></div>`).join("");
  } catch (err) {
    console.warn("Gagal memuat data landing page:", err.message);
    showLandingDataError(err.message);
    // Jangan biarkan skeleton loading nyangkut selamanya — tampilkan nilai default yang wajar
    ["statWarga","statKK","statL","statP"].forEach(id => setText(id, 0));
    setText("fcSaldo", fmtRupiah(0)); setText("fpSaldo", fmtRupiah(0));
    setText("fpMasuk", fmtRupiah(0)); setText("fpKeluar", fmtRupiah(0));
    setText("fcIuran", "0/0 KK"); setText("fpIuranPct", "0%");
    setText("fcAgenda", "Belum ada agenda"); setText("fcAgendaDate", "");
  }
}
function showLandingDataError(message){
  if (document.getElementById("landingDataError")) return; // jangan dobel
  const box = document.createElement("div");
  box.id = "landingDataError";
  box.style.cssText = "position:fixed; left:16px; bottom:16px; z-index:399; max-width:360px; background:var(--surface); border:1px solid var(--danger); border-radius:12px; padding:14px 16px; box-shadow:var(--shadow); font-size:13px; color:var(--text);";
  box.innerHTML = `<b style="color:var(--danger);">⚠️ Data beranda gagal dimuat</b>
    <p style="margin-top:6px; color:var(--text-muted);">${message}</p>
    <button onclick="this.closest('#landingDataError').remove()" style="margin-top:8px; background:none; border:none; color:var(--accent); font-weight:600; cursor:pointer; padding:0; font-size:12.5px;">Tutup</button>`;
  document.body.appendChild(box);
}
function setText(id, val){ const el = document.getElementById(id); if (el) el.textContent = val; }

/* ---------- 20. SLIDER OTOMATIS: PENGAJUAN LAYANAN TERBARU ---------- */
async function loadLayananSlider(){
  const mask = document.getElementById("layananSliderMask");
  const track = document.getElementById("layananSliderTrack");
  if (!mask || !track) return;
  try {
    const rows = await RTApi.getRecentLayanan();
    if (!rows || !rows.length){
      mask.closest(".layanan-slider").innerHTML = '<p class="layanan-slider-label">🕒 Belum ada aktivitas pengajuan layanan.</p>';
      return;
    }
    const jenisLabel = { surat: "📄 Surat Pengantar", pinjam: "📦 Peminjaman Aset", aduan: "📢 Pengaduan & Saran" };
    const statusBadge = { Pending:"badge-warn", Diproses:"badge-info", Selesai:"badge-success", Ditolak:"badge-danger" };
    const cardHtml = (r) => `
      <div class="layanan-slider-card">
        <div class="lsc-top"><span class="lsc-jenis">${jenisLabel[r.jenis] || r.jenis || "Layanan"}</span><span class="badge ${statusBadge[r.status]||'badge-warn'}">${r.status||'Pending'}</span></div>
        <div class="lsc-nama">${r.nama || "Anonim"}</div>
        <div class="lsc-detail">${r.detail || "-"}</div>
        <div class="lsc-date">${fmtTanggal(r.tanggal)}</div>
      </div>`;
    // Digandakan supaya animasi loop terlihat mulus tanpa jeda
    const html = rows.map(cardHtml).join("") + rows.map(cardHtml).join("");
    track.innerHTML = html;
    track.style.setProperty("--slide-duration", Math.max(18, rows.length * 4) + "s");
  } catch (err) {
    console.warn("Gagal memuat slider layanan:", err.message);
    mask.closest(".layanan-slider").innerHTML = '<p class="layanan-slider-label">🕒 Aktivitas layanan belum dapat dimuat.</p>';
  }
}
document.addEventListener("DOMContentLoaded", loadLayananSlider);

document.addEventListener("DOMContentLoaded", loadLandingData);
