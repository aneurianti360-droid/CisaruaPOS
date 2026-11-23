const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const productRoutes = require('./src/routes/products');
const stockRoutes = require('./src/routes/stock');
const salesRoutes = require('./src/routes/sales');
const reportRoutes = require('./src/routes/reports');
const nutritionRoutes = require('./src/routes/nutrition');
const reviewRoutes = require('./src/routes/reviews');
const troliRoutes = require('./src/routes/troli');
const db = require('./src/db');
const { canView } = require('./src/roles');

const app = express();
const PORT = process.env.PORT || 3000;
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

app.set('trust proxy', TRUST_PROXY ? 1 : false);
// Limit dinaikkan untuk upload foto (scan kalori & ulasan) yang dikirim sebagai data URL
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
  },
}));

app.use(session({
  name: 'cisaruapos.sid',
  secret: process.env.SESSION_SECRET || 'cisaruapos-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: TRUST_PROXY,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

/* ============================================================
   KEAMANAN AKSES
   Semua data CisaruaPOS (produk, stok, transaksi, laporan)
   memakai session. Login dengan email opsional; bila tanpa login,
   aplikasi otomatis membuat sesi Tamu (/api/auth/guest).
   ============================================================ */
const requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, message: 'Belum login' });
  }
  // Akun dinonaktifkan/dihapus oleh Admin lain => session langsung dicabut
  const fresh = db.prepare('SELECT status FROM users WHERE id = ?').get(req.session.user.id);
  if (!fresh || fresh.status !== 'aktif') {
    return req.session.destroy(() => {
      res.clearCookie('cisaruapos.sid');
      res.status(401).json({ success: false, message: 'Akses Anda sudah tidak berlaku. Silakan login ulang.' });
    });
  }
  next();
};

app.get('/api/health', (req, res) => res.json({ success: true, app: 'CisaruaPOS', status: 'ok' }));

/* Pembatasan tambahan berdasarkan role (halaman yang diizinkan user) */
const requireView = (view) => (req, res, next) => {
  if (!canView(req.session.user, view)) {
    return res.status(403).json({ success: false, message: 'Role Anda tidak memiliki akses ke bagian ini' });
  }
  next();
};

// Publik: hanya login & cek sesi
app.use('/api/auth', authRoutes);

// Wajib login
app.use('/api/users', requireAuth, userRoutes);

// Produk: semua role bisa melihat (dibutuhkan Kasir), ubah hanya admin/owner
app.use('/api/products', requireAuth, (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  return requireView('products')(req, res, next);
}, productRoutes);

app.use('/api/stock', requireAuth, requireView('products'), stockRoutes);
app.use('/api/transactions', requireAuth, salesRoutes);

// Fitur tambahan: Scan Kalori, Ulasan & Troli (semua role yang login)
app.use('/api/nutrition', requireAuth, nutritionRoutes);
app.use('/api/reviews', requireAuth, reviewRoutes);
app.use('/api/troli', requireAuth, troliRoutes);

app.use('/api/reports', requireAuth, (req, res, next) => {
  if (req.path === '/' || req.path === '/dashboard') return next();
  return requireView('laporan')(req, res, next);
}, reportRoutes);

app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' }));

// Fallback SPA -> index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan server: ' + err.message });
});

app.listen(PORT, () => {
  const users = db.prepare("SELECT email, role FROM users WHERE status = 'aktif' ORDER BY id").all();
  console.log('============================================');
  console.log('  CisaruaPOS v1.0.0');
  console.log('  Kantin & Koperasi SMKN 1 Cisarua');
  console.log(`  Server berjalan: http://localhost:${PORT}`);
  console.log('  Login: email saja (opsional, tanpa password) | Tamu otomatis');
  console.log('  Fitur: Kasir, Scan Kalori, Ulasan, Troli, Multi-Admin, Audit Log');
  console.log(`  ${users.length} akun terdaftar (${users.filter((u) => u.role === 'admin' || u.role === 'owner').length} Admin/Owner):`);
  for (const u of users) console.log(`    - ${u.email} (${u.role})`);
  console.log('============================================');
});

