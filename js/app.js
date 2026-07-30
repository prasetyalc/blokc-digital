/* ============================================================
   RT03RW05 DIGITAL — App Logic
   ============================================================ */

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

function toggleMobileNav(){
  document.getElementById("mobileNav")?.classList.toggle("is-open");
}

/* ---------- 3. SCROLL REVEAL ANIMATIONS ---------- */
function initReveal(){
  const items = document.querySelectorAll(".reveal, .reveal-stagger");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting){
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
  items.forEach((el) => io.observe(el));
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
  document.getElementById("mobileNav")?.classList.remove("is-open");
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
}

function logoutAdmin(){
  RTApi.logout().catch(() => {});
  RTApi.clearToken();
  localStorage.removeItem("rt_user");
  document.body.classList.remove("admin-mode");
  document.getElementById("adminApp").classList.remove("is-active");
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
  document.getElementById("adminSidebar")?.classList.remove("is-open");
  ADMIN_PANELS[key]?.render(content);
}

document.addEventListener("click", (e) => {
  const link = e.target.closest(".admin-nav a[data-panel]");
  if (link) loadAdminPanel(link.dataset.panel);
});

function toggleAdminSidebar(){
  document.getElementById("adminSidebar")?.classList.toggle("is-open");
}

/* ---------- 9. ADMIN PANELS (template — hubungkan ke RTApi.* saat backend siap) ---------- */

function renderDashboardPanel(el){
  el.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><span>Pemasukan Iuran</span><b>Rp 0</b></div>
      <div class="kpi-card"><span>Kas Keluar</span><b>Rp 0</b></div>
      <div class="kpi-card"><span>Sisa Saldo Kas</span><b>Rp 0</b></div>
      <div class="kpi-card"><span>Warga Terdaftar</span><b>0 Jiwa</b></div>
    </div>
    <div class="card">
      <h3>Selamat datang di Panel Admin RT03RW05 DIGITAL</h3>
      <p>Hubungkan <code>API_URL</code> di <code>js/api.js</code> ke Web App Google Apps Script kamu untuk menampilkan data real-time dari Google Spreadsheet di sini.</p>
    </div>`;
}

function renderWargaPanel(el){
  el.innerHTML = `
    <div class="toolbar">
      <div class="filter-row">
        <select><option>Semua Jenis Kelamin</option><option>Laki-laki</option><option>Perempuan</option></select>
        <select><option>Semua Status Tinggal</option><option>Tetap</option><option>Kontrak</option></select>
        <input type="text" placeholder="Cari nama / NIK...">
      </div>
      <button class="btn btn-primary btn-sm" onclick="openModal('modalWarga')">+ Tambah Warga</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>NIK</th><th>Nama</th><th>No. Rumah</th><th>JK</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody><tr><td colspan="6"><div class="empty-state"><div class="es-ic">👥</div>Belum ada data warga. Data akan tampil di sini setelah backend Google Sheets terhubung.</div></td></tr></tbody>
      </table>
    </div>`;
}

function renderKasPanel(el){
  el.innerHTML = `
    <div class="tab-strip">
      <button class="active">Pemasukan</button>
      <button>Pengeluaran</button>
    </div>
    <div class="toolbar">
      <div class="filter-row">
        <select><option>Semua Bulan</option></select>
        <select><option>Semua Kategori</option></select>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-outline btn-sm">Ekspor CSV</button>
        <button class="btn btn-primary btn-sm" onclick="openModal('modalPemasukan')">+ Catat Pemasukan</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tanggal</th><th>Sumber</th><th>Kategori</th><th>Jumlah</th><th>Aksi</th></tr></thead>
        <tbody><tr><td colspan="5"><div class="empty-state"><div class="es-ic">💰</div>Belum ada transaksi kas.</div></td></tr></tbody>
      </table>
    </div>`;
}

function renderIuranPanel(el){
  el.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="kpi-card"><span>Total Terkumpul</span><b>Rp 0</b></div>
      <div class="kpi-card"><span>Sudah Bayar</span><b>0 Warga</b></div>
      <div class="kpi-card"><span>Belum Bayar</span><b>0 Warga</b></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nama Warga</th><th>No. Rumah</th><th>Status</th><th>Centang Lunas</th></tr></thead>
        <tbody><tr><td colspan="4"><div class="empty-state"><div class="es-ic">✅</div>Data iuran akan tampil setelah tersambung ke Google Sheets.</div></td></tr></tbody>
      </table>
    </div>`;
}

function renderAsetPanel(el){
  el.innerHTML = `
    <div class="toolbar">
      <div class="filter-row"><select><option>Semua Kategori</option></select><select><option>Semua Kondisi</option></select></div>
      <button class="btn btn-primary btn-sm" onclick="openModal('modalAset')">+ Tambah Aset</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nama Barang</th><th>Kategori</th><th>Total</th><th>Tersedia</th><th>Kondisi</th><th>Aksi</th></tr></thead>
        <tbody><tr><td colspan="6"><div class="empty-state"><div class="es-ic">📦</div>Belum ada data aset/inventaris.</div></td></tr></tbody>
      </table>
    </div>`;
}

function renderLayananPanel(el){
  el.innerHTML = `
    <div class="tab-strip">
      <button class="active">📄 Permohonan Surat</button>
      <button>📦 Peminjaman Aset</button>
      <button>📢 Pengaduan & Saran</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tanggal</th><th>Nama</th><th>Keperluan</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody><tr><td colspan="5"><div class="empty-state"><div class="es-ic">📮</div>Belum ada permohonan masuk.</div></td></tr></tbody>
      </table>
    </div>`;
}

function renderAgendaPanel(el){
  el.innerHTML = `
    <div class="tab-strip">
      <button class="active">📅 Agenda Kegiatan</button>
      <button>📢 Pengumuman</button>
    </div>
    <div class="toolbar">
      <div></div>
      <button class="btn btn-primary btn-sm" onclick="openModal('modalAgenda')">+ Buat Agenda</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Judul</th><th>Kategori</th><th>Tanggal</th><th>Lokasi</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody><tr><td colspan="6"><div class="empty-state"><div class="es-ic">🗓️</div>Belum ada agenda kegiatan.</div></td></tr></tbody>
      </table>
    </div>`;
}

function renderPetugasPanel(el){
  el.innerHTML = `
    <div class="toolbar"><h3 style="font-size:15px;">Daftar Petugas</h3><button class="btn btn-primary btn-sm" onclick="openModal('modalPetugas')">+ Tambah Petugas</button></div>
    <div class="table-wrap" style="margin-bottom:26px;">
      <table><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Aksi</th></tr></thead>
      <tbody><tr><td colspan="4"><div class="empty-state">Belum ada data petugas.</div></td></tr></tbody></table>
    </div>
    <h3 style="font-size:15px; margin-bottom:12px;">Audit Aktivitas</h3>
    <div class="table-wrap">
      <table><thead><tr><th>Waktu</th><th>Petugas</th><th>Aksi</th><th>Detail</th></tr></thead>
      <tbody><tr><td colspan="4"><div class="empty-state">Belum ada log aktivitas.</div></td></tr></tbody></table>
    </div>`;
}

function renderPengaturanPanel(el){
  el.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <h3>Nominal Iuran Bulanan</h3>
        <div class="field" style="margin-top:14px;"><label>Rp</label><input type="number" placeholder="20000"></div>
        <button class="btn btn-primary btn-sm">Simpan Pengaturan</button>
      </div>
      <div class="card">
        <h3>Branding Halaman Depan</h3>
        <div class="field" style="margin-top:14px;"><label>Nama RT/RW</label><input type="text" value="RT03RW05 DIGITAL"></div>
        <div class="field"><label>Judul Hero</label><textarea rows="2">Bersama Warga, Membangun Lingkungan yang Nyaman dan Harmonis</textarea></div>
        <button class="btn btn-primary btn-sm">Simpan Tampilan</button>
      </div>
    </div>`;
}
