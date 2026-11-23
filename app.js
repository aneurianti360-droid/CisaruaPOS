/* ============================================================
   CisaruaPOS - Agentic POS untuk Kantin & Koperasi SMKN 1 Cisarua
   Frontend SPA dengan tema biru, splash, dashboard,
   produk, kasir, pembayaran, transaksi berhasil, riwayat & laporan.
   ============================================================ */

/* ---------- State ---------- */
const state = {
  user: null,
  view: 'dashboard',
  cart: [],
  lastTrx: null,
  prodSearch: '',
  prodCat: '',
  kasirSearch: '',
  kasirCat: '',
  trxQ: '',
  trxFrom: '',
  trxTo: '',
  trxMetode: '',
  reportPeriod: 'today',
  payable: { total: 0, metode: 'tunai', bayar: '' },
  productsCache: [],
  posProducts: [],
  // Fitur tambahan
  scanMakanan: null,
  ulasanRating: 0,
  troliProduk: [],
  troliKeranjang: null,
  troliVoucher: null,
  troliOngkir: 0,
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const fmtRupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const fmtNum = (n) => Number(n || 0).toLocaleString('id-ID');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Kompresi foto kamera/galeri sebelum dikirim ke server (hemat bandwidth) */
function compressImage(file, maxSize = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) return reject(new Error('Pilih file gambar yang valid'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca gambar'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gambar tidak dapat dibuka'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
window.compressImage = compressImage;

/* ---------- HTTP ---------- */
async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({ success: false, message: 'Respons tidak valid' }));
  if (res.status === 401) {
    // Sesi berakhir/dicabut -> masuk ulang sebagai Tamu agar aplikasi tetap usable
    state.user = null;
    const ok = await enterGuest();
    if (ok) showApp();
    else showLogin();
    throw new Error(data.message || 'Sesi berakhir, silakan masuk ulang');
  }
  if (!res.ok || data.success === false) throw new Error(data.message || 'Terjadi kesalahan');
  return data;
}

/* ---------- Toast / Modal ---------- */
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.3s'; }, 3200);
  setTimeout(() => el.remove(), 3600);
}
function openModal(title, html, wide) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  $('#modal-box').style.maxWidth = wide ? '640px' : '520px';
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modal-body').innerHTML = ''; }

/* ============================================================
   NAVIGATION & ROLES
   Daftar hak akses tiap view dikirim server (src/roles.js)
   ============================================================ */
const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊', short: 'Dashboard' },
  { key: 'kasir', label: 'Kasir', icon: '🛒', short: 'Kasir' },
  { key: 'products', label: 'Daftar Produk', icon: '📦', short: 'Produk' },
  { key: 'troli', label: 'Troli Belanja', icon: '🧺', short: 'Troli' },
  { key: 'scan', label: 'Scan Kalori', icon: '🥗', short: 'Scan' },
  { key: 'reviews', label: 'Ulasan', icon: '⭐', short: 'Ulasan' },
  { key: 'riwayat', label: 'Riwayat Transaksi', icon: '🧾', short: 'Riwayat' },
  { key: 'laporan', label: 'Laporan Penjualan', icon: '📈', short: 'Laporan' },
  { key: 'users', label: 'User Management', icon: '👥', short: 'User' },
  { key: 'audit', label: 'Audit Log', icon: '🕒', short: 'Audit' },
];

const TITLES = {
  dashboard: 'Dashboard',
  kasir: 'Kasir',
  payment: 'Pembayaran',
  success: 'Transaksi Berhasil',
  products: 'Daftar Produk',
  troli: 'Troli Belanja',
  scan: 'Scan Kalori Makanan',
  reviews: 'Ulasan Produk',
  riwayat: 'Riwayat Transaksi',
  laporan: 'Laporan Penjualan',
  users: 'User Management',
  audit: 'Audit Log',
};

const ROLE_BADGE = { admin: 'badge-blue', owner: 'badge-amber', kasir: 'badge-green', staff: 'badge-cyan', guest: 'badge-blue' };
const roleLabel = (r) => state.user?.role_label || ({ admin: 'Admin', owner: 'Owner/Pimpinan', kasir: 'Kasir', staff: 'Staff', guest: 'Tamu' })[r] || r;

function allowedNav() {
  const views = state.user?.views || ['dashboard'];
  return NAV.filter((n) => views.includes(n.key));
}
function canAccess(key) {
  return allowedNav().some((n) => n.key === key);
}

function renderNav() {
  const visible = allowedNav();
  // Halaman payment/success bukan menu nav, jangan ikut di-reset ke dashboard.
  const isNavView = NAV.some((n) => n.key === state.view);
  if (isNavView && !visible.some((n) => n.key === state.view)) state.view = 'dashboard';
  const side = $('#main-nav');
  const bottom = $('#bottom-nav');
  const isSetting = (k) => k === 'users' || k === 'audit';
  let groupStarted = false;
  const sideHtml = visible
    .map((n) => {
      let head = '';
      if (isSetting(n.key) && !groupStarted) {
        groupStarted = true;
        head = '<div class="nav-label">Pengaturan</div>';
      }
      return head + `
    <button class="nav-item ${state.view === n.key ? 'active' : ''}" data-view="${n.key}">
      <span class="nav-ico">${n.icon}</span> ${n.label}
    </button>`;
    })
    .join('');
  const bottomHtml = visible.map((n) => `
    <button class="bn-item ${state.view === n.key ? 'active' : ''}" data-view="${n.key}">
      <span class="bn-ico">${n.icon}</span>${n.short}
    </button>`).join('');
  if (side) side.innerHTML = sideHtml;
  if (bottom) bottom.innerHTML = bottomHtml;
}

async function navigate(view) {
  // role guard
  if (NAV.find((n) => n.key === view) && !canAccess(view)) {
    toast('Anda tidak memiliki akses ke halaman ini', 'error');
    return;
  }
  if (view === 'payment' && !state.payable.total) { view = 'kasir'; }

  state.view = view;
  $$('.view').forEach((v) => v.classList.add('hidden'));
  const target = $('#view-' + view);
  if (!target) return;
  target.classList.remove('hidden');
  renderNav();

  const renderers = {
    dashboard: renderDashboard,
    kasir: renderKasir,
    payment: renderPayment,
    success: renderSuccess,
    products: renderProducts,
    troli: () => window.renderTroli(),
    scan: () => window.renderNutrition(),
    reviews: () => window.renderReviews(),
    riwayat: renderRiwayat,
    laporan: renderLaporan,
    users: () => window.renderUserManagement(),
    audit: () => window.renderAuditLog(),
  };
  if (renderers[view]) await renderers[view]();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   AUTH & SPLASH
   Login hanya meminta email (tanpa password).
   ============================================================ */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function showLogin() {
  $('#splash-view')?.classList.add('hidden');
  $('#app-view')?.classList.add('hidden');
  $('#login-view')?.classList.remove('hidden');
  setTimeout(() => $('#login-email')?.focus(), 120);
}

function applyUser(user) {
  state.user = user;
  if (!$('#app-view') || $('#app-view').classList.contains('hidden')) return;
  $('#sidebar-name').textContent = state.user.nama;
  $('#sidebar-role').textContent = `${roleLabel(state.user.role)} · ${state.user.email}`;
  $('#avatar-char').textContent = (state.user.nama || 'U').trim().charAt(0).toUpperCase();
  const isGuest = state.user?.role === 'guest';
  const sideLogin = $('#login-side-btn');
  if (sideLogin) sideLogin.classList.toggle('hidden', !isGuest);
  const logout = $('#logout-btn');
  if (logout) logout.textContent = isGuest ? '🚪 Keluar Aplikasi' : '🚪 Keluar Akun';
}

function showApp() {
  $('#splash-view')?.classList.add('hidden');
  $('#login-view')?.classList.add('hidden');
  $('#app-view')?.classList.remove('hidden');
  applyUser(state.user);
  navigate('dashboard');
}

function loginError(msg) {
  const box = $('#login-error');
  if (box) box.textContent = msg || '';
  $('#login-email')?.classList.toggle('invalid', !!msg);
}

/* Login opsional: buat sesi Tamu tanpa email. */
async function enterGuest() {
  try {
    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.user) return false;
    state.user = data.user;
    return true;
  } catch {
    return false;
  }
}

async function submitLogin(e) {
  e.preventDefault();
  const btn = $('#login-btn');
  const input = $('#login-email');
  const email = input.value.trim().toLowerCase();

  loginError('');
  if (!email) return loginError('Email wajib diisi');
  if (!EMAIL_RE.test(email)) return loginError('Format email tidak valid. Contoh: admin1@gmail.com');

  btn.disabled = true;
  btn.textContent = 'Memeriksa email...';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      loginError(data.message || 'Login gagal. Silakan coba lagi.');
      btn.disabled = false;
      btn.textContent = 'Masuk ke CisaruaPOS';
      return;
    }
    state.user = data.user;
    btn.textContent = 'Berhasil masuk';
    showApp();
  } catch (err) {
    loginError('Tidak dapat terhubung ke server');
    btn.disabled = false;
    btn.textContent = 'Masuk ke CisaruaPOS';
  }
}

async function logout() {
  const wasGuest = state.user?.role === 'guest';
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch { /* abaikan, session tetap dihapus di server */ }
  state.user = null;
  state.cart = [];
  state.view = 'dashboard';
  $('#login-email').value = '';
  $('#login-btn').disabled = false;
  $('#login-btn').textContent = 'Masuk ke CisaruaPOS';
  loginError('');

  // Keluar akun -> lanjut sebagai Tamu. Keluar dari Tamu -> tampilkan pilihan login.
  if (!wasGuest && await enterGuest()) showApp();
  else showLogin();
}

/* Splash selalu berakhir di Dashboard. Login hanya opsional. */
async function checkSession() {
  const started = Date.now();
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.user) state.user = data.user;
  } catch { /* sesi belum ada */ }

  if (!state.user) await enterGuest();
  await delay(Math.max(0, 1400 - (Date.now() - started)));

  if (state.user) {
    showApp();
    return true;
  }
  showLogin();
  return false;
}

/* Segarkan profil di sidebar tanpa memuat ulang halaman */
async function refreshProfile() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.user) applyUser(data.user);
  } catch { /* abaikan */ }
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function renderDashboard(days = 30) {
  const el = $('#view-dashboard');
  el.innerHTML = `<div class="empty-state"><div class="big">⏳</div><p>Memuat data dashboard...</p></div>`;
  try {
    const { data } = await api('/api/reports/dashboard?days=' + days);
    const lowCount = data.lowStock.length;

    el.innerHTML = `
      <div class="page-head ph-aurora">
        <div class="ph-ico">${state.user.role === 'kasir' ? '🛒' : '📊'}</div>
        <div>
          <h3>${esc(data.greeting)}, ${esc(state.user.nama)} 👋</h3>
          <p>Ringkasan penjualan, stok, dan rekomendasi Agentic AI.</p>
        </div>
        <div class="ph-spacer"></div>
        ${daysPickerHTML('dash', days)}
      </div>

      <div class="grid grid-4 mb-16">
        <div class="card">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${fmtRupiah(data.today.total)}</div>
          <div class="stat-label">Total Penjualan Hari Ini</div>
        </div>
        <div class="card">
          <div class="stat-icon">🧾</div>
          <div class="stat-value">${fmtNum(data.today.transaksi)}</div>
          <div class="stat-label">Jumlah Transaksi Hari Ini</div>
        </div>
        <div class="card">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${fmtNum(data.produkAktif)}</div>
          <div class="stat-label">Total Produk Aktif</div>
        </div>
        <div class="card" style="${lowCount ? '--card-bar:var(--g-amber);--card-bg:var(--s-amber);--card-ink:var(--c-amber)' : '--card-bar:var(--g-emerald);--card-bg:var(--s-emerald);--card-ink:var(--c-emerald)'}">
          <div class="stat-icon">${lowCount ? '⚠️' : '✅'}</div>
          <div class="stat-value">${fmtNum(lowCount)}</div>
          <div class="stat-label">Produk Stok Menipis</div>
        </div>
      </div>

      <div class="grid grid-2 mb-16">
        <div class="card">
          <div class="card-title">📈 Grafik Penjualan (<span id="dash-grafik-range">${days} hari</span>)</div>
          <canvas id="dash-line" height="150"></canvas>
        </div>
        <div class="card">
          <div class="card-title">🏷️ Penjualan per Kategori</div>
          <canvas id="dash-donut" height="150"></canvas>
          <div class="chart-legend" id="dash-donut-legend"></div>
        </div>
      </div>

      <div class="grid grid-2 mb-16">
        <div class="card ai-panel">
          <div class="card-title">🤖 Insight Agentic AI <span class="kpi-chip">${days} hari</span></div>
          <div id="dash-insights"></div>
        </div>
        <div class="card">
          <div class="card-title">🚨 Notifikasi Stok Menipis</div>
          <div id="dash-stock"></div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">⭐ Produk Terlaris</div>
          <div id="dash-top"></div>
        </div>
        <div class="card">
          <div class="card-title">📋 Ringkasan Transaksi (<span id="dash-sum-range">${days} hari</span>)</div>
          <div id="dash-summary"></div>
        </div>
      </div>
    `;

    drawLine('dash-line', data.daily.map((d) => d.tanggal.slice(5)), data.daily.map((d) => d.total));
    drawDonut('dash-donut', 'dash-donut-legend', data.categories.map((c) => c.kategori), data.categories.map((c) => c.omzet));

    renderInsights('dash-insights', data.insights);
    renderStockWarnings('dash-stock', data.lowStock);
    renderTopProducts('dash-top', data.ranking);
    renderSummary('dash-summary', data.summary);

    bindDaysPicker('dash', (d) => renderDashboard(d));
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="big">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

function daysPickerHTML(id, days) {
  return `<div class="days-picker" id="dp-${id}">
    ${[7, 14, 30, 90].map((d) => `<button data-d="${d}" class="${d === days ? 'active' : ''}">${d}h</button>`).join('')}
  </div>`;
}
function bindDaysPicker(id, cb) {
  const el = $('#dp-' + id);
  if (!el) return;
  el.addEventListener('click', (e) => {
    if (e.target.dataset.d) cb(Number(e.target.dataset.d));
  });
}

function renderInsights(id, insights) {
  const box = $('#' + id);
  if (!box) return;
  if (!insights || !insights.length) { box.innerHTML = emptyHTML('Belum ada data cukup untuk insight AI.'); return; }
  box.innerHTML = insights.map((i) => `
    <div class="insight-card mb-12">
      <div class="insight-ikon">${{ star: '⭐', trending: '📈', warning: '⚠️', category: '🏷️', clock: '🕐', spark: '✨' }[i.ikon] || '💡'}</div>
      <div>
        <div class="insight-judul">${esc(i.judul)}</div>
        <div class="insight-teks">${esc(i.teks)}</div>
      </div>
    </div>`).join('');
}

function renderStockWarnings(id, rows) {
  const box = $('#' + id);
  if (!box) return;
  if (!rows || !rows.length) { box.innerHTML = emptyHTML('Semua stok aman 🎉', '✅'); return; }
  box.innerHTML = rows.slice(0, 8).map((r) => `
    <div class="mini-product">
      <div><b>${esc(r.nama)}</b><br/><small style="color:var(--muted)">sisa ${fmtNum(r.stok)} ${esc(r.satuan)} · min ${fmtNum(r.stok_min)}</small></div>
      <span class="badge ${r.level === 'habis' ? 'badge-red' : 'badge-yellow'}">${r.level === 'habis' ? 'Habis' : 'Menipis'}</span>
    </div>`).join('');
}

function renderTopProducts(id, rows) {
  const box = $('#' + id);
  if (!box) return;
  if (!rows || !rows.length) { box.innerHTML = emptyHTML('Belum ada penjualan.'); return; }
  const max = Math.max(...rows.map((r) => r.qty), 1);
  box.innerHTML = rows.slice(0, 6).map((r, i) => `
    <div class="mini-product">
      <div style="flex:1">
        <div class="flex-between mb-12"><b>${i + 1}. ${esc(r.nama)}</b><span style="font-size:12px;color:var(--muted)">${fmtNum(r.qty)} pcs</span></div>
        <div class="bar"><div style="width:${(r.qty / max) * 100}%"></div></div>
      </div>
    </div>`).join('');
}

function renderSummary(id, s) {
  const box = $('#' + id);
  if (!box) return;
  const avg = Math.round(s.total / Math.max(1, s.jumlahTrx));
  box.innerHTML = `
    <div class="mini-product"><span>Total Omzet</span><b>${fmtRupiah(s.total)}</b></div>
    <div class="mini-product"><span>Jumlah Transaksi</span><b>${fmtNum(s.jumlahTrx)}</b></div>
    <div class="mini-product"><span>Rata-rata / Transaksi</span><b>${fmtRupiah(avg)}</b></div>
    <div class="mini-product"><span>Total Diskon</span><b>${fmtRupiah(s.diskon)}</b></div>`;
}

/* ============================================================
   PRODUCTS (CRUD)
   ============================================================ */
function renderProducts() {
  const el = $('#view-products');
  el.innerHTML = `
    <div class="page-head ph-ocean">
      <div class="ph-ico">📦</div>
      <div>
        <h3>Daftar Produk</h3>
        <p>Kelola produk, harga, dan stok kantin &amp; koperasi.</p>
      </div>
      <div class="ph-spacer"></div>
    </div>
    <div class="card mb-12">
      <div class="toolbar">
        <input class="input search" id="prod-search" placeholder="🔍 Cari produk..." value="${esc(state.prodSearch)}" />
        <select class="select" id="prod-cat" style="width:180px">
          <option value="">Semua Kategori</option>
          <option>Makanan</option><option>Minuman</option><option>Snack</option><option>ATK</option><option>Lainnya</option>
        </select>
        <button class="btn btn-ghost" id="btn-stock-log">📋 Log Stok</button>
        <button class="btn btn-primary" id="btn-add-prod">➕ Tambah Produk</button>
      </div>
    </div>
    <div class="card">
      <div class="table-scroll">
        <table class="table">
          <thead><tr>
            <th>Nama Produk</th><th>Kategori</th><th class="right">Harga Jual</th><th class="right">HPP</th>
            <th class="right">Stok</th><th>Satuan</th><th>Status Stok</th><th>Aksi</th>
          </tr></thead>
          <tbody id="prod-body"><tr><td colspan="8"><div class="empty-state">Memuat...</div></td></tr></tbody>
        </table>
      </div>
    </div>
  `;
  $('#prod-search').addEventListener('input', (e) => { state.prodSearch = e.target.value; loadProducts(); });
  $('#prod-cat').addEventListener('change', (e) => { state.prodCat = e.target.value; loadProducts(); });
  $('#btn-add-prod').addEventListener('click', () => showProductForm());
  $('#btn-stock-log').addEventListener('click', showStockLog);
  loadProducts();
}

async function loadProducts() {
  const body = $('#prod-body');
  if (!body) return;
  try {
    let url = '/api/products?aktif=1';
    if (state.prodSearch.trim()) url = '/api/products?q=' + encodeURIComponent(state.prodSearch.trim());
    const { data } = await api(url);
    state.productsCache = data;
    let rows = data;
    if (state.prodCat) rows = rows.filter((p) => p.kategori === state.prodCat);

    if (!rows.length) { body.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="big">📦</div><p>Tidak ada produk</p></div></td></tr>`; return; }
    body.innerHTML = rows.map((p) => {
      const st = p.stok <= 0 ? ['stock-out', 'Habis']
              : p.stok <= p.stok_min ? ['stock-low', 'Menipis']
              : ['stock-normal', 'Tersedia'];
      const margin = p.harga_jual - p.harga_beli;
      return `
      <tr>
        <td><b>${esc(p.nama)}</b><br/><small style="color:var(--muted)">${esc(p.kode)}</small></td>
        <td><span class="badge badge-blue">${esc(p.kategori || '-')}</span></td>
        <td class="right num"><b>${fmtRupiah(p.harga_jual)}</b></td>
        <td class="right num">${fmtRupiah(p.harga_beli)}</td>
        <td class="right num"><b>${fmtNum(p.stok)}</b></td>
        <td>${esc(p.satuan)}</td>
        <td><span class="stock-pill ${st[0]}">${st[1]}</span></td>
        <td style="white-space:nowrap">
          <button class="btn btn-soft btn-sm" onclick='showProductForm(${p.id})'>✏️ Edit</button>
          <button class="btn btn-ghost btn-sm" onclick='showStockModal(${p.id}, "masuk")'>📥</button>
          <button class="btn btn-warning btn-sm" onclick='showStockModal(${p.id}, "keluar")'>📤</button>
          <button class="btn btn-outline btn-sm" onclick='showStockModal(${p.id}, "opname")'>🔁</button>
          <button class="btn btn-danger btn-sm" onclick='deleteProduct(${p.id})'>🗑️</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="8"><div class="empty-state">⚠️ ${esc(e.message)}</div></td></tr>`;
  }
}

async function showProductForm(id) {
  let p = null;
  try {
    if (id) p = (await api('/api/products/' + id)).data;
  } catch (e) { toast(e.message, 'error'); return; }

  const isEdit = !!p;
  const cats = await api('/api/products/meta/kategori').then((d) => d.data).catch(() => []);
  const catOptions = cats.map((c) => `<option value="${c.id}" ${p && p.kategori_id === c.id ? 'selected' : ''}>${esc(c.nama)}</option>`).join('');

  openModal(isEdit ? 'Edit Produk' : 'Tambah Produk', `
    <form id="prod-form">
      <div class="field">
        <label class="label">Nama Produk *</label>
        <input class="input" name="nama" required value="${esc(p?.nama || '')}" placeholder="cth: Kopi Cisarua" />
      </div>
      <div class="form-row">
        <div class="field">
          <label class="label">Kategori</label>
          <select class="select" name="kategori_id"><option value="">Tanpa Kategori</option>${catOptions}</select>
        </div>
        <div class="field">
          <label class="label">Kode Produk</label>
          <input class="input" name="kode" value="${esc(p?.kode || '')}" placeholder="otomatis" />
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label class="label">Harga Jual (Rp) *</label>
          <input class="input" name="harga_jual" type="number" min="0" required value="${p?.harga_jual ?? ''}" placeholder="15000" />
        </div>
        <div class="field">
          <label class="label">HPP / Modal (Rp)</label>
          <input class="input" name="harga_beli" type="number" min="0" value="${p?.harga_beli ?? 0}" placeholder="8000" />
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label class="label">Stok${isEdit ? ' <small style="color:var(--muted)">(diubah saat transaksi)</small>' : ' Awal'}</label>
          <input class="input" name="stok" type="number" min="0" value="${p?.stok ?? 0}" ${isEdit ? 'disabled' : ''} />
        </div>
        <div class="field">
          <label class="label">Satuan</label>
          <input class="input" name="satuan" value="${esc(p?.satuan || 'pcs')}" placeholder="pcs / gelas / porsi" />
        </div>
      </div>
      <div class="field">
        <label class="label">Stok Minimal (peringatan menipis)</label>
        <input class="input" name="stok_min" type="number" min="0" value="${p?.stok_min ?? 5}" />
      </div>
      <div class="form-row mt-12">
        <button class="btn btn-primary btn-block" type="submit">💾 Simpan</button>
        <button class="btn btn-outline btn-block" type="button" id="btn-batal-form">Batal</button>
      </div>
    </form>
  `);

  $('#btn-batal-form').addEventListener('click', closeModal);

  $('#prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    if (!body.kode && !isEdit) body.kode = autoKode(body.nama, body.kategori_id);
    body.kategori_id = body.kategori_id || null;
    body.is_active = 1;
    if (isEdit) delete body.stok; // stok dikelola via transaksi / mutasi
    try {
      if (isEdit) await api('/api/products/' + p.id, { method: 'PUT', body });
      else await api('/api/products', { method: 'POST', body });
      toast('Produk tersimpan', 'success');
      closeModal();
      loadProducts();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function autoKode(nama, catName) {
  const map = { 'Makanan': 'MK', 'Minuman': 'MN', 'Snack': 'SN', 'ATK': 'ATK', 'Lainnya': 'LN' };
  const prefix = map[catName] || 'PRD';
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${rand}`;
}

async function deleteProduct(id) {
  const p = state.productsCache.find((x) => x.id === id);
  if (!confirm(`Hapus produk "${p?.nama || ''}"?`)) return;
  try {
    await api('/api/products/' + id, { method: 'DELETE' });
    toast('Produk dihapus', 'success');
    loadProducts();
  } catch (e) { toast(e.message, 'error'); }
}

/* ---------- Manajemen Stok ---------- */
async function showStockModal(id, type) {
  const p = state.productsCache.find((x) => x.id === id) || await api('/api/products/' + id).then((d) => d.data).catch(() => null);
  if (!p) { toast('Produk tidak ditemukan', 'error'); return; }

  const tipeLabel = { masuk: 'Stok Masuk', keluar: 'Stok Keluar', opname: 'Stok Opname' }[type];
  const isOpname = type === 'opname';

  openModal(`${tipeLabel} - ${p.nama}`, `
    <form id="stock-form">
      <div class="field">
        <label class="label">Produk</label>
        <input class="input" value="${esc(p.nama)}" disabled />
      </div>
      <div class="field">
        <label class="label">Stok Saat Ini</label>
        <div class="total-line"><span>${fmtNum(p.stok)} ${esc(p.satuan)}</span>
        ${p.stok <= 0 ? '<span class="badge badge-red">Habis</span>' : p.stok <= p.stok_min ? '<span class="badge badge-yellow">Menipis</span>' : '<span class="badge badge-green">Normal</span>'}</div>
      </div>
      ${isOpname
        ? `<div class="field">
            <label class="label">Stok Aktual (hasil hitung fisik)</label>
            <input class="input" name="stok_aktual" type="number" min="0" required value="${p.stok}" />
          </div>`
        : `<div class="field">
            <label class="label">Jumlah ${type === 'masuk' ? 'Masuk' : 'Keluar'} (${esc(p.satuan)})</label>
            <input class="input" name="qty" type="number" min="1" required placeholder="cth: 10" />
          </div>`}
      <div class="field">
        <label class="label">Keterangan</label>
        <input class="input" name="keterangan" placeholder="${isOpname ? 'cth: Opname bulanan' : type === 'masuk' ? 'cth: Pembelian dari supplier' : 'cth: Produk rusak / expired'}" />
      </div>
      <div class="form-row mt-12">
        <button class="btn btn-primary btn-block" type="submit">${isOpname ? '🔁 Simpan Opname' : type === 'masuk' ? '📥 Simpan Stok Masuk' : '📤 Simpan Stok Keluar'}</button>
        <button class="btn btn-outline btn-block" type="button" onclick='closeModal()'>Batal</button>
      </div>
    </form>
  `);

  $('#stock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.product_id = p.id;
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      if (isOpname) await api('/api/stock/opname', { method: 'POST', body });
      else await api('/api/stock/' + type, { method: 'POST', body });
      toast(`Stok ${p.nama} diperbarui`, 'success');
      closeModal();
      loadProducts();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; }
  });
}

async function showStockLog() {
  try {
    const { data } = await api('/api/stock/log?limit=100');
    if (!data.length) { toast('Belum ada riwayat stok', 'info'); return; }
    openModal('📋 Riwayat Stok', `
      <div class="table-scroll" style="max-height:60vh">
        <table class="table">
          <thead><tr><th>Waktu</th><th>Produk</th><th>Jenis</th><th class="right">Qty</th><th>Keterangan</th></tr></thead>
          <tbody>
            ${data.map((l) => `
              <tr>
                <td class="num" style="white-space:nowrap;font-size:12px">${fmtTime(l.created_at)}</td>
                <td><b>${esc(l.nama)}</b></td>
                <td><span class="badge ${{ masuk: 'badge-green', keluar: 'badge-red', penjualan: 'badge-blue' }[l.type] || 'badge-gray'}">${esc(l.type)}</span></td>
                <td class="right num">${l.type === 'keluar' || l.type === 'penjualan' ? '−' : '+'}${fmtNum(l.qty)}</td>
                <td style="font-size:12px;color:var(--muted)">${esc(l.keterangan || '-')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`);
  } catch (e) { toast(e.message, 'error'); }
}

/* ============================================================
   KASIR
   ============================================================ */
async function renderKasir() {
  const el = $('#view-kasir');
  el.innerHTML = `
    <div class="page-head ph-rainbow">
      <div class="ph-ico">🛒</div>
      <div>
        <h3>Kasir</h3>
        <p>Pilih produk untuk menambah ke keranjang, lalu proses pembayaran.</p>
      </div>
      <div class="ph-spacer"></div>
    </div>
    <div class="kasir-wrap">
      <div>
        <div class="toolbar">
          <input class="input search" id="kasir-search" placeholder="🔍 Cari produk / kode..." value="${esc(state.kasirSearch)}" />
          <select class="select" id="kasir-cat" style="width:170px">
            <option value="">Semua Kategori</option>
          </select>
        </div>
        <div class="pos-grid" id="pos-grid">
          <div class="empty-state"><div class="big">⏳</div><p>Memuat produk...</p></div>
        </div>
      </div>

      <div class="cart">
        <div class="cart-head"><span>🛒 Keranjang</span><span id="cart-count">0 item</span></div>
        <div class="cart-items" id="cart-items"></div>
        <div class="cart-foot">
          <div class="total-line"><span>Subtotal</span><span class="num" id="c-subtotal">Rp 0</span></div>
          <div class="total-line grand"><span>Total</span><span class="num" id="c-total">Rp 0</span></div>
          <button class="btn btn-primary btn-block btn-lg mt-12" id="btn-to-pay">💳 Lanjut Pembayaran</button>
          <button class="btn btn-ghost btn-block mt-12" id="btn-clear-cart">🗑️ Kosongkan</button>
        </div>
      </div>
    </div>
  `;

  // kategori filter
  try {
    const kat = await api('/api/products/meta/kategori');
    const sel = $('#kasir-cat');
    kat.data.forEach((k) => {
      const o = document.createElement('option');
      o.value = k.id; o.textContent = k.nama;
      sel.appendChild(o);
    });
    if (state.kasirCat) sel.value = state.kasirCat;
  } catch { /* abaikan */ }

  $('#kasir-search').addEventListener('input', (e) => { state.kasirSearch = e.target.value; loadKasirProducts(); });
  $('#kasir-cat').addEventListener('change', (e) => { state.kasirCat = e.target.value; loadKasirProducts(); });
  $('#btn-clear-cart').addEventListener('click', clearCart);
  $('#btn-to-pay').addEventListener('click', toPayment);

  loadKasirProducts();
}

async function loadKasirProducts() {
  const grid = $('#pos-grid');
  if (!grid) return;
  try {
    let url = '/api/products?aktif=1';
    const q = state.kasirSearch.trim();
    if (q) url = '/api/products?q=' + encodeURIComponent(q);
    else if (state.kasirCat) url = '/api/products?kategori=' + state.kasirCat;
    const { data } = await api(url);
    state.posProducts = data;
    if (!data.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="big">🔍</div><p>Produk tidak ditemukan</p></div>`; return; }
    grid.innerHTML = data.map((p) => {
      const habis = p.stok <= 0;
      const low = p.stok <= p.stok_min;
      return `
      <div class="pos-card ${habis ? 'stok-habis' : ''}" data-id="${p.id}" title="${habis ? 'Stok habis' : 'Klik untuk tambah ke keranjang'}">
        <div class="pc-icon">${habis ? '🚫' : kategoriIcon(p.kategori)}</div>
        <div class="pc-name">${esc(p.nama)}</div>
        <div class="pc-price">${fmtRupiah(p.harga_jual)}</div>
        <div class="pc-stock ${low ? 'low' : ''}">sisa ${fmtNum(p.stok)} ${esc(p.satuan)}</div>
      </div>`;
    }).join('');
    grid.querySelectorAll('.pos-card').forEach((card) => {
      card.addEventListener('click', () => addToCart(Number(card.dataset.id)));
    });
  } catch (e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">⚠️ ${esc(e.message)}</div>`;
  }
}

function kategoriIcon(cat) {
  const map = { Makanan: '🍚', Minuman: '🥤', Snack: '🍫', ATK: '✏️', Lainnya: '🛍️' };
  return map[cat] || '🛒';
}

function addToCart(id) {
  const found = state.posProducts?.find((x) => x.id === id);
  if (!found || found.stok <= 0) { toast('Stok habis, tidak bisa ditambahkan', 'error'); return; }
  const item = state.cart.find((c) => c.product_id === found.id);
  if (item) {
    if (item.qty < found.stok) item.qty++;
    else { toast('Jumlah melebihi stok tersedia (' + found.stok + ')', 'warning'); return; }
  } else {
    state.cart.push({ product_id: found.id, nama: found.nama, harga: found.harga_jual, qty: 1, stok: found.stok });
  }
  updateCartUI();
}

function cartQty(idx, delta) {
  const item = state.cart[idx];
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart.splice(idx, 1);
  else if (item.qty > item.stok) { item.qty = item.stok; toast('Melebihi stok tersedia', 'warning'); }
  updateCartUI();
}
function cartRemove(idx) { state.cart.splice(idx, 1); updateCartUI(); }
function clearCart() { state.cart = []; updateCartUI(); }

function updateCartUI() {
  const count = $('#cart-count');
  if (count) count.textContent = state.cart.reduce((a, b) => a + b.qty, 0) + ' item';
  const box = $('#cart-items');
  if (!box) return;
  if (!state.cart.length) { box.innerHTML = `<div class="empty-state"><div class="big">🛒</div><p>Keranjang masih kosong</p></div>`; }
  else {
    box.innerHTML = state.cart.map((c, i) => `
      <div class="cart-item">
        <div class="ci-info">
          <div class="ci-name">${esc(c.nama)}</div>
          <div class="ci-price">${fmtRupiah(c.harga)} × ${c.qty}</div>
        </div>
        <div class="ci-qty">
          <button onclick="cartQty(${i}, -1)">−</button>
          <span>${c.qty}</span>
          <button onclick="cartQty(${i}, 1)">+</button>
        </div>
        <b class="num" style="font-size:13px">${fmtRupiah(c.harga * c.qty)}</b>
        <button class="ci-del" onclick="cartRemove(${i})">×</button>
      </div>`).join('');
  }
  const subtotal = state.cart.reduce((a, b) => a + b.harga * b.qty, 0);
  $('#c-subtotal').textContent = fmtRupiah(subtotal);
  $('#c-total').textContent = fmtRupiah(subtotal);
}

function toPayment() {
  if (!state.cart.length) { toast('Keranjang masih kosong', 'warning'); return; }
  const total = state.cart.reduce((a, b) => a + b.harga * b.qty, 0);
  state.payable = { total, metode: 'tunai', bayar: '' };
  navigate('payment');
}

/* ============================================================
   PEMBAYARAN
   ============================================================ */
function renderPayment() {
  const el = $('#view-payment');
  const { total, metode } = state.payable;

  el.innerHTML = `
    <div class="pay-wrap">
      <div class="page-head ph-sunset">
        <div class="ph-ico">💳</div>
        <div>
          <h3>Pembayaran</h3>
          <p>Konfirmasi pesanan dan selesaikan pembayaran.</p>
        </div>
        <div class="ph-spacer"></div>
      </div>

      <div class="pay-card">
        <div class="card-title">🧾 Ringkasan Pesanan</div>
        <div id="pay-items"></div>
        <div class="pay-total">
          <span>Total Pembayaran</span><span>${fmtRupiah(total)}</span>
        </div>
      </div>

      <div class="pay-card">
        <div class="card-title">💵 Metode Pembayaran</div>
        <div class="method-tabs">
          <button class="method-tab ${metode === 'tunai' ? 'active' : ''}" onclick="setMetode('tunai')">💵 Tunai</button>
          <button class="method-tab ${metode === 'qris' ? 'active' : ''}" onclick="setMetode('qris')">📱 QRIS</button>
        </div>

        <div id="pay-options"></div>

        <button class="btn btn-primary btn-block btn-lg mt-16" id="btn-process" onclick="processPayment()">✅ Proses Pembayaran</button>
      </div>

      <div class="center mt-12">
        <button class="btn btn-ghost" onclick="navigate('kasir')">⬅️ Kembali ke Kasir</button>
      </div>
    </div>
  `;

  $('#pay-items').innerHTML = state.cart.map((c) => `
    <div class="pay-sum-row"><span>${esc(c.nama)} × ${c.qty}</span><b>${fmtRupiah(c.harga * c.qty)}</b></div>`).join('');
  renderPayOptions();
}

function setMetode(m) {
  state.payable.metode = m;
  state.payable.bayar = '';
  renderPayOptions();
  $$('.method-tab').forEach((t) => {
    t.classList.toggle('active', t.textContent.includes(m === 'tunai' ? 'Tunai' : 'QRIS'));
  });
}

function renderPayOptions() {
  const box = $('#pay-options');
  if (!box) return;
  const { total, metode, bayar } = state.payable;

  if (metode === 'tunai') {
    const selisih = Number(bayar) - total;
    box.innerHTML = `
      <div class="field">
        <label class="label">Jumlah Uang Dibayar (Rp)</label>
        <input class="input cash-input" id="cash-input" type="number" min="0" placeholder="0" value="${bayar || ''}" />
        <div class="quick-cash">
          ${[total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, 50000, 100000].filter((v, i, a) => a.indexOf(v) === i).map((v) => `<button onclick="quickCash(${v})">${fmtRupiah(v)}</button>`).join('')}
        </div>
      </div>
      <div class="pay-sum-row"><span>Total</span><b>${fmtRupiah(total)}</b></div>
      <div class="pay-sum-row"><span>Uang Dibayar</span><b class="num" id="cash-shown">${fmtRupiah(bayar || 0)}</b></div>
      <div class="pay-sum-row" style="font-size:17px;font-weight-bold"><span>Kembalian</span><b class="num" id="cash-change" style="color:${selisih < 0 ? 'var(--danger)' : 'var(--success)'}">${fmtRupiah(Math.max(0, selisih))}</b></div>
      ${selisih < 0 ? `<div style="color:var(--danger);font-size:12.5px;margin-top:6px">⚠️ Uang kurang dari total pembayaran.</div>` : ''}
    `;
    const input = $('#cash-input');
    input.addEventListener('input', () => {
      state.payable.bayar = input.value;
      const s = Number(input.value) - total;
      $('#cash-shown').textContent = fmtRupiah(input.value || 0);
      $('#cash-change').textContent = fmtRupiah(Math.max(0, s));
      $('#cash-change').style.color = s < 0 ? 'var(--danger)' : 'var(--success)';
      let warn = box.querySelector('.pay-warn');
      if (s < 0 && !warn) {
        warn = document.createElement('div');
        warn.className = 'pay-warn';
        warn.style.cssText = 'color:var(--danger);font-size:12.5px;margin-top:6px';
        warn.textContent = '⚠️ Uang kurang dari total pembayaran.';
        box.appendChild(warn);
      }
      if (s >= 0 && warn) warn.remove();
    });
  } else {
    box.innerHTML = `
      <div class="qris-panel">
        <div class="qris-box">
          <div id="qris-svg" style="width:200px;height:200px"></div>
        </div>
        <div class="qris-amount">${fmtRupiah(total)}</div>
        <div class="qris-status" id="qris-status"><span class="loader-ring" style="width:14px;height:14px;border-width:2px"></span> Menunggu pembayaran... arahkan kamera ke QRIS</div>
      </div>`;
    try { qrCode($('#qris-svg'), 'CISARUAPOS-' + total + '-' + Date.now()); } catch (e) { /* abaikan */ }
    state.payable.bayar = total;
  }
}

function quickCash(v) {
  state.payable.bayar = v;
  renderPayOptions();
}

async function processPayment() {
  const { metode, total } = state.payable;
  if (metode === 'tunai') {
    const bayar = Number(state.payable.bayar) || 0;
    if (bayar < total) { toast('Uang dibayar kurang dari total', 'error'); return; }
    await doTransaction(bayar, 'tunai', 0);
  } else {
    // Simulasi pembayaran QRIS berhasil
    const st = $('#qris-status');
    if (st) { st.className = 'qris-status done'; st.innerHTML = '✅ Pembayaran berhasil'; }
    await doTransaction(total, 'qris', 0);
  }
}

async function doTransaction(bayar, metode, diskon) {
  if (!state.cart.length) { toast('Keranjang kosong', 'warning'); return; }
  const btn = $('#btn-process');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }
  try {
    const { data } = await api('/api/transactions', {
      method: 'POST',
      body: {
        items: state.cart.map((it) => ({ product_id: it.product_id, qty: it.qty })),
        bayar, diskon, metode,
      },
    });
    state.lastTrx = data;
    state.cart = [];
    state.payable = { total: 0, metode: 'tunai', bayar: '' };
    navigate('success');
  } catch (e) {
    toast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✅ Proses Pembayaran'; }
  }
}

/* ============================================================
   TRANSAKSI BERHASIL
   ============================================================ */
function renderSuccess() {
  const el = $('#view-success');
  const t = state.lastTrx;
  if (!t) { el.innerHTML = `<div class="empty-state"><div class="big">❓</div><p>Belum ada transaksi.</p><br/><button class="btn btn-primary" onclick="navigate('kasir')">Ke Kasir</button></div>`; return; }
  const waktu = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });

  el.innerHTML = `
    <div class="success-wrap">
      <div class="success-icon">✅</div>
      <div class="success-no">${esc(t.no_transaksi)}</div>
      <div class="success-meta">${waktu} · ${t.metode === 'qris' ? '📱 QRIS' : '💵 Tunai'}</div>

      <div class="card" style="text-align:left">
        <div class="card-title">🧾 Daftar Produk</div>
        ${t.detail.map((d) => `
          <div class="pay-sum-row"><span>${esc(d.nama)} × ${d.qty}</span><b>${fmtRupiah(d.subtotal)}</b></div>`).join('')}
        <div class="pay-sum-row"><span>Subtotal</span><b>${fmtRupiah(t.subtotal)}</b></div>
        ${t.diskon ? `<div class="pay-sum-row"><span>Diskon</span><b>−${fmtRupiah(t.diskon)}</b></div>` : ''}
        <div class="pay-total"><span>Total Dibayar</span><span>${fmtRupiah(t.total)}</span></div>
        ${t.metode === 'tunai' ? `
          <div class="pay-sum-row"><span>Uang Dibayar</span><b>${fmtRupiah(t.bayar)}</b></div>
          <div class="pay-sum-row"><span>Kembalian</span><b style="color:var(--success)">${fmtRupiah(t.kembalian)}</b></div>` : ''}
      </div>

      <div class="success-actions">
        <button class="btn btn-primary" onclick="printStruk()">🖨️ Cetak Struk</button>
        <button class="btn btn-success" onclick="navigate('kasir')">🛒 Transaksi Baru</button>
        <button class="btn btn-ghost" onclick="navigate('riwayat')">🧾 Lihat Riwayat</button>
      </div>
    </div>
  `;
}

/* ============================================================
   RIWAYAT TRANSAKSI
   ============================================================ */
async function renderRiwayat() {
  const el = $('#view-riwayat');
  el.innerHTML = `
    <div class="page-head ph-grape">
      <div class="ph-ico">🧾</div>
      <div>
        <h3>Riwayat Transaksi</h3>
        <p>Semua transaksi kasir tersimpan di sini untuk semua Admin.</p>
      </div>
      <div class="ph-spacer"></div>
    </div>
    <div class="toolbar">
      <input class="input search" id="trx-q" placeholder="🔍 Cari no / kasir / produk..." value="${esc(state.trxQ)}" />
      <input class="input" type="date" id="trx-from" value="${state.trxFrom}" style="width:auto" />
      <input class="input" type="date" id="trx-to" value="${state.trxTo}" style="width:auto" />
      <select class="select" id="trx-metode" style="width:150px">
        <option value="">Semua Metode</option>
        <option ${state.trxMetode === 'tunai' ? 'selected' : ''}>tunai</option>
        <option ${state.trxMetode === 'qris' ? 'selected' : ''}>qris</option>
      </select>
      <button class="btn btn-outline" id="trx-filter">Filter</button>
    </div>
    <div class="card">
      <div class="table-scroll">
        <table class="table">
          <thead><tr>
            <th>No. Transaksi</th><th>Tanggal / Waktu</th><th>Produk</th><th class="right">Total</th><th>Metode</th><th>Status</th><th></th>
          </tr></thead>
          <tbody id="trx-body"><tr><td colspan="7"><div class="empty-state">Memuat...</div></td></tr></tbody>
        </table>
      </div>
    </div>
  `;
  const run = () => { state.trxQ = $('#trx-q').value; state.trxFrom = $('#trx-from').value; state.trxTo = $('#trx-to').value; state.trxMetode = $('#trx-metode').value; loadRiwayat(); };
  $('#trx-filter').addEventListener('click', run);
  $('#trx-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  $('#trx-metode').addEventListener('change', run);
  loadRiwayat();
}

async function loadRiwayat() {
  const body = $('#trx-body');
  if (!body) return;
  try {
    const params = new URLSearchParams();
    if (state.trxQ.trim()) params.set('q', state.trxQ.trim());
    if (state.trxFrom) params.set('from', state.trxFrom);
    if (state.trxTo) params.set('to', state.trxTo);
    if (state.trxMetode) params.set('metode', state.trxMetode);
    const { data: rows } = await api('/api/transactions?' + params.toString());

    if (!rows.length) { body.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="big">🧾</div><p>Belum ada transaksi</p></div></td></tr>`; return; }
    body.innerHTML = rows.map((t) => `
      <tr>
        <td><b>${esc(t.no_transaksi)}</b></td>
        <td class="num" style="white-space:nowrap">${fmtTime(t.created_at)}</td>
        <td style="font-size:12.5px;color:var(--muted);max-width:200px">${esc(t.item_summary || t.kasir)}</td>
        <td class="right num"><b>${fmtRupiah(t.total)}</b></td>
        <td>${t.metode === 'qris' ? '<span class="badge badge-blue">📱 QRIS</span>' : '<span class="badge badge-green">💵 Tunai</span>'}</td>
        <td><span class="badge badge-green">Sukses</span></td>
        <td><button class="btn btn-soft btn-sm" onclick='viewTrxDetail(${t.id})'>Detail</button></td>
      </tr>`).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty-state">⚠️ ${esc(e.message)}</div></td></tr>`;
  }
}

async function viewTrxDetail(id) {
  try {
    const { data } = await api('/api/transactions/' + id);
    openModal('Detail Transaksi', `
      <div class="struk">
        <div class="row"><span>No</span><b>${esc(data.no_transaksi)}</b></div>
        <div class="row"><span>Waktu</span>${fmtTime(data.created_at)}</div>
        <div class="row"><span>Kasir</span>${esc(data.kasir)}</div>
        <div class="row"><span>Metode</span>${data.metode === 'qris' ? 'QRIS' : 'Tunai'}</div>
        <div class="dashed"></div>
        ${data.items.map((i) => `
          <div>${esc(i.nama)}</div>
          <div class="row"><span>&nbsp;&nbsp;${i.qty} × ${fmtRupiah(i.harga)}</span><span>${fmtRupiah(i.subtotal)}</span></div>`).join('')}
        <div class="dashed"></div>
        <div class="row"><span>Subtotal</span>${fmtRupiah(data.subtotal)}</div>
        ${data.diskon ? `<div class="row"><span>Diskon</span>${fmtRupiah(data.diskon)}</div>` : ''}
        <div class="row"><b>TOTAL</b><b>${fmtRupiah(data.total)}</b></div>
        ${data.metode === 'tunai' ? `
          <div class="row"><span>Bayar</span>${fmtRupiah(data.bayar)}</div>
          <div class="row"><span>Kembalian</span>${fmtRupiah(data.kembalian)}</div>` : ''}
      </div>`);
  } catch (e) { toast(e.message, 'error'); }
}

/* ============================================================
   LAPORAN PENJUALAN
   ============================================================ */
async function renderLaporan() {
  const el = $('#view-laporan');
  el.innerHTML = `<div class="empty-state"><div class="big">⏳</div><p>Menyusun laporan...</p></div>`;
  try {
    const period = state.reportPeriod;
    let url = '/api/reports/sales?period=' + period;
    if (period === 'custom') {
      const from = $('#lapa-from')?.value || '';
      const to = $('#lapa-to')?.value || '';
      url = '/api/reports/sales?from=' + from + '&to=' + to;
    }
    const { data } = await api(url);
    const s = data.summary;

    el.innerHTML = `
      <div class="page-head ph-mint">
        <div class="ph-ico">📈</div>
        <div>
          <h3>Laporan Penjualan</h3>
          <p>Rekap omzet, transaksi, dan produk penjualan.</p>
        </div>
        <div class="ph-spacer"></div>
      </div>

      <div class="filter-chips">
        ${[['today', 'Hari Ini'], ['week', 'Minggu Ini'], ['month', 'Bulan Ini'], ['custom', 'Custom']].map(([k, label]) =>
          `<button class="filter-chip ${period === k ? 'active' : ''}" data-period="${k}">${label}</button>`).join('')}
        <input class="input" type="date" id="lapa-from" style="width:auto" />
        <input class="input" type="date" id="lapa-to" style="width:auto" />
        <button class="btn btn-outline" id="lapa-apply">Terapkan</button>
      </div>

      <div class="grid grid-4 mb-16">
        <div class="card">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${fmtRupiah(s.total)}</div>
          <div class="stat-label">Total Omzet</div>
        </div>
        <div class="card">
          <div class="stat-icon">🧾</div>
          <div class="stat-value">${fmtNum(s.jumlahTrx)}</div>
          <div class="stat-label">Jumlah Transaksi</div>
        </div>
        <div class="card">
          <div class="stat-icon">🎯</div>
          <div class="stat-value">${fmtRupiah(Math.round(s.total / Math.max(1, s.jumlahTrx)))}</div>
          <div class="stat-label">Rata-rata / Transaksi</div>
        </div>
        <div class="card">
          <div class="stat-icon">⭐</div>
          <div class="stat-value" style="font-size:15px">${esc(data.ranking[0]?.nama || '-')}</div>
          <div class="stat-label">Produk Terlaris</div>
        </div>
      </div>

      <div class="grid grid-2 mb-16">
        <div class="card">
          <div class="card-title">📅 Grafik Penjualan</div>
          <canvas id="repo-line" height="160"></canvas>
        </div>
        <div class="card">
          <div class="card-title">🏷️ Penjualan per Kategori</div>
          <canvas id="repo-bars" height="160"></canvas>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">⭐ Produk Terlaris</div>
          <div id="repo-top"></div>
        </div>
        <div class="card">
          <div class="card-title">🕐 Jam Transaksi</div>
          <canvas id="repo-hour" height="160"></canvas>
        </div>
      </div>
    `;

    drawLine('repo-line', data.daily.map((d) => d.tanggal.slice(5)), data.daily.map((d) => d.total));
    drawBars('repo-bars', data.categories.map((c) => c.kategori), data.categories.map((c) => c.omzet));
    drawBars('repo-hour', data.hourly.map((h) => h.jam + ':00'), data.hourly.map((h) => h.total));

    const maxQty = Math.max(...data.ranking.map((r) => r.qty), 1);
    $('#repo-top').innerHTML = data.ranking.length
      ? data.ranking.map((r, i) => `
          <div class="mini-product">
            <div style="flex:1">
              <div class="flex-between mb-12"><b>${i + 1}. ${esc(r.nama)}</b><span style="font-size:12px;color:var(--muted)">${fmtNum(r.qty)} pcs · ${fmtRupiah(r.omzet)}</span></div>
              <div class="bar"><div style="width:${(r.qty / maxQty) * 100}%"></div></div>
            </div>
          </div>`).join('')
      : `<div class="empty-state"><div class="big">📭</div><p>Belum ada penjualan pada periode ini.</p></div>`;

    $$('.filter-chip').forEach((c) => c.addEventListener('click', () => {
      state.reportPeriod = c.dataset.period;
      renderLaporan();
    }));
    $('#lapa-apply').addEventListener('click', () => {
      state.reportPeriod = 'custom';
      renderLaporan();
    });
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="big">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

/* ============================================================
   CANVAS CHARTS
   ============================================================ */
function ctx2d(id) {
  const c = document.getElementById(id);
  if (!c) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = c.parentElement.clientWidth - 8;
  const h = c.getAttribute('height') || 160;
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function drawLine(id, labels, values, color = '#0284c7', fill = 'rgba(59,130,246,.18)') {
  const cv = ctx2d(id);
  if (!cv) return;
  const { ctx, w, h } = cv;
  ctx.clearRect(0, 0, w, h);
  if (!values.length || values.every((v) => !v)) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '13px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('Belum ada data pada periode ini', w / 2, h / 2);
    return;
  }
  const pad = 26, max = Math.max(...values, 1);
  const stepX = w > 40 ? (w - pad * 2) / Math.max(1, labels.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * stepX, h - 22 - (v / max) * (h - 48)]);

  // grid lines
  ctx.strokeStyle = '#dbeafe'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = h - 22 - (g / 4) * (h - 48);
    ctx.beginPath(); ctx.moveTo(pad - 8, y); ctx.lineTo(w - 8, y); ctx.stroke();
  }

  // area
  ctx.beginPath();
  ctx.moveTo(pts[0][0], h - 22);
  pts.forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.lineTo(pts[pts.length - 1][0], h - 22);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, fill);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.fill();

  // gradasi biru CisaruaPOS (biru muda -> biru cerah -> biru tua)
  const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
  lineGrad.addColorStop(0, '#93c5fd');
  lineGrad.addColorStop(.35, '#3b82f6');
  lineGrad.addColorStop(.7, '#2563eb');
  lineGrad.addColorStop(1, '#1d4ed8');
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.strokeStyle = lineGrad; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();

  // dots
  const labelEvery = Math.max(1, Math.ceil(labels.length / 8));
  ctx.fillStyle = color;
  pts.forEach((p, i) => {
    if (labels.length <= 16 || i % labelEvery === 0) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill();
    }
  });

  // labels x
  ctx.fillStyle = '#94a3b8'; ctx.font = '10px Segoe UI'; ctx.textAlign = 'center';
  labels.forEach((l, i) => {
    if (labels.length <= 16 || i % labelEvery === 0) ctx.fillText(String(l), pts[i][0], h - 8);
  });
}

function drawBars(id, labels, values, color = '') {
  const cv = ctx2d(id);
  if (!cv) return;
  const { ctx, w, h } = cv;
  ctx.clearRect(0, 0, w, h);
  if (!values.length || values.every((v) => !v)) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '13px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('Belum ada data', w / 2, h / 2);
    return;
  }
  const max = Math.max(...values, 1);
  const padL = 34, padB = 18, padT = 8;
  const innerW = w - padL - 8;
  const slot = innerW / values.length;
  const barW = Math.min(42, slot * 0.55);
  const barPal = ['#1d4ed8', '#2563eb', '#3b82f6', '#0284c7', '#38bdf8', '#7dd3fc', '#1e40af', '#60a5fa'];

  ctx.strokeStyle = '#dbeafe'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = h - padB - (g / 4) * (h - padB - padT);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - 8, y); ctx.stroke();
    ctx.fillStyle = '#a5b0c4'; ctx.font = '9.5px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText(fmtRupiahShort(max * g / 4), padL - 6, y + 3);
  }

  values.forEach((v, i) => {
    const x = padL + i * slot + (slot - barW) / 2;
    const bh = Math.max(3, (v / max) * (h - padB - padT));
    const y = h - padB - bh;
    const bg = ctx.createLinearGradient(0, y, 0, h - padB);
    bg.addColorStop(0, barPal[i % barPal.length]);
    bg.addColorStop(1, barPal[i % barPal.length] + '99');
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, barW, bh, 4);
    ctx.fill();
    ctx.fillStyle = '#94a3b8'; ctx.font = '9.5px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText(String(labels[i] ?? '').length > 8 ? String(labels[i]).slice(0, 8) + '…' : String(labels[i] ?? ''), x + barW / 2, h - 5);
  });
}

function fmtRupiahShort(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'jt';
  if (n >= 1000) return Math.round(n / 1000) + 'rb';
  return String(Math.round(n));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawDonut(id, legendId, labels, values, colors) {
  const cv = ctx2d(id);
  if (!cv || !values.length || values.every((v) => !v)) return;
  const { ctx, w, h } = cv;
  ctx.clearRect(0, 0, w, h);
  const pal = colors || ['#1d4ed8', '#2563eb', '#3b82f6', '#0284c7', '#38bdf8', '#7dd3fc', '#1e40af', '#60a5fa', '#0ea5e9', '#bfdbfe', '#60a5fa', '#2563eb'];
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 8;

  let start = -Math.PI / 2;
  values.forEach((v, i) => {
    const angle = (v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = pal[i % pal.length];
    ctx.fill();
    start += angle;
  });
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.62, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.fillStyle = '#1d4ed8'; ctx.font = '700 14px Segoe UI'; ctx.textAlign = 'center';
  ctx.fillText(fmtRupiahShort(total), cx, cy - 2);
  ctx.font = '9.5px Segoe UI'; ctx.fillStyle = '#64748b';
  ctx.fillText('total', cx, cy + 12);

  const legend = $('#' + legendId);
  if (legend) {
    legend.innerHTML = labels.map((l, i) => `<span><span class="legend-dot" style="background:${pal[i % pal.length]}"></span>${esc(l)}</span>`).join('');
  }
}

/* ============================================================
   QR CODE (dekoratif - valid format QR untuk simulasi)
   ============================================================ */
const SVG_NS = 'http://www.w3.org/2000/svg';
function qrCode(container, text) {
  const size = 21, cell = 9, quiet = 2;
  const total = size + quiet * 2;
  const modules = pseudoRandom(text, size);
  const svgNS = SVG_NS;
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '200'); svg.setAttribute('height', '200');
  svg.setAttribute('viewBox', `0 0 ${total * cell} ${total * cell}`);

  const rect = (x, y, w, h, c) => {
    const r = document.createElementNS(svgNS, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', w); r.setAttribute('height', h); r.setAttribute('fill', c);
    svg.appendChild(r);
  };

  rect(0, 0, total * cell, total * cell, '#fff');
  for (let yy = 0; yy < size; yy++) {
    for (let xx = 0; xx < size; xx++) {
      if (isFinder(xx, yy)) continue;
      if (modules[yy][xx]) rect((xx + quiet) * cell, (yy + quiet) * cell, cell, cell, '#0f172a');
    }
  }
  // finder patterns
  [[0, 0], [size - 7, 0], [0, size - 7]].forEach(([fx, fy]) => drawFinder(svg, (fx + quiet) * cell, (fy + quiet) * cell, cell));
  container.innerHTML = '';
  container.appendChild(svg);
}

function drawFinder(svg, x, y, cell) {
  const svgNS = SVG_NS;
  const rect = (px, py2, size, c) => {
    const r = document.createElementNS(svgNS, 'rect');
    r.setAttribute('x', px); r.setAttribute('y', py2);
    r.setAttribute('width', size); r.setAttribute('height', size); r.setAttribute('fill', c);
    svg.appendChild(r);
  };
  rect(x, y, cell * 7, '#0f172a');
  rect(x + cell, y + cell, cell * 5, '#fff');
  rect(x + cell * 2, y + cell * 2, cell * 3, '#0f172a');
}

function pseudoRandom(seed, size) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
      row.push((h & 0xff) > 127);
    }
    rows.push(row);
  }
  return rows;
}

function isFinder(x, y) {
  const s = 21;
  const inBox = (fx, fy) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
  return inBox(0, 0) || inBox(s - 7, 0) || inBox(0, s - 7);
}

/* ============================================================
   PRINT STRUK
   ============================================================ */
function printStruk() {
  const t = state.lastTrx;
  if (!t) { toast('Tidak ada transaksi untuk dicetak', 'error'); return; }
  const now = new Date();
  const waktu = now.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
  $('#print-area').innerHTML = `
    <div class="struk">
      <div class="center">🏪 CISARUA KANTIN</div>
      <div class="center" style="font-weight:400;font-size:11px">SMKN 1 Cisarua<br/>Sistem Kasir CisaruaPOS</div>
      <div class="dashed"></div>
      <div class="row"><span>No</span><span>${esc(t.no_transaksi)}</span></div>
      <div class="row"><span>Waktu</span><span>${waktu}</span></div>
      <div class="row"><span>Kasir</span><span>${esc(state.user.nama)}</span></div>
      <div class="row"><span>Metode</span><span>${t.metode === 'qris' ? 'QRIS' : 'Tunai'}</span></div>
      <div class="dashed"></div>
      ${t.detail.map((d) => `
        <div>${esc(d.nama)}</div>
        <div class="row"><span>&nbsp;&nbsp;${d.qty} × ${fmtRupiah(d.harga)}</span><span>${fmtRupiah(d.subtotal)}</span></div>`).join('')}
      <div class="dashed"></div>
      <div class="row"><span>Subtotal</span><span>${fmtRupiah(t.subtotal)}</span></div>
      ${t.diskon ? `<div class="row"><span>Diskon</span><span>${fmtRupiah(t.diskon)}</span></div>` : ''}
      <div class="row"><b>TOTAL</b><b>${fmtRupiah(t.total)}</b></div>
      ${t.metode === 'tunai' ? `
        <div class="row"><span>Bayar</span><span>${fmtRupiah(t.bayar)}</span></div>
        <div class="row"><span>Kembalian</span><span>${fmtRupiah(t.kembalian)}</span></div>` : ''}
      <div class="dashed"></div>
      <div class="center">Terima kasih 🙏<br/>Semoga harimu menyenangkan!</div>
    </div>`;
  window.print();
  setTimeout(() => { $('#print-area').innerHTML = ''; }, 400);
}

/* ============================================================
   MISC
   ============================================================ */
function emptyHTML(txt, icon = '📭') { return `<div class="empty-state"><div class="big">${icon}</div><p>${esc(txt)}</p></div>`; }
function fmtTime(s) {
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // global fns for inline handlers
  window.navigate = navigate;
  window.cartQty = cartQty;
  window.cartRemove = cartRemove;
  window.addToCart = addToCart;
  window.showProductForm = showProductForm;
  window.deleteProduct = deleteProduct;
  window.setMetode = setMetode;
  window.quickCash = quickCash;
  window.processPayment = processPayment;
  window.printStruk = printStruk;
  window.viewTrxDetail = viewTrxDetail;
  window.closeModalStruk = closeModal;
  window.showStockModal = showStockModal;
  window.showStockLog = showStockLog;

  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (e) => { if (e.target === $('#modal')) closeModal(); });

  // Login opsional (email saja) + akses Tamu
  $('#login-form').addEventListener('submit', submitLogin);
  $('#login-email').addEventListener('input', () => loginError(''));

  $('#login-skip').addEventListener('click', async () => {
    const btn = $('#login-skip');
    btn.disabled = true;
    btn.textContent = 'Menyiapkan Tamu...';
    if (await enterGuest()) showApp();
    else {
      loginError('Tidak dapat membuat sesi Tamu. Silakan coba lagi.');
      btn.disabled = false;
      btn.textContent = 'Lewati, masuk sebagai Tamu';
    }
  });

  $('#login-side-btn').addEventListener('click', showLogin);

  $('#logout-btn').addEventListener('click', () => {
    const label = state.user?.role === 'guest'
      ? 'Keluar dari sesi Tamu dan tampilkan halaman login?'
      : 'Keluar akun dan lanjut menggunakan CisaruaPOS sebagai Tamu?';
    if (confirm(label)) logout();
  });

  // nav delegation (sidebar + bottom)
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-view]');
    if (navBtn) navigate(navBtn.dataset.view);
  });

  checkSession();
});
