/* ============================================================
   USER MANAGEMENT & AUDIT LOG CisaruaPOS
   Halaman: Settings → User Management
   Semua Admin_share data yang sama; halaman ini hanya mengelola
   siapa saja yang boleh masuk dan dengan role apa.
   ============================================================ */

const userState = {
  q: '',
  role: '',
  status: '',
  list: [],
  summary: {},
  roles: [],
  auditQ: '',
  auditRows: [],
  auditTotal: 0,
  auditOffset: 0,
  auditLimit: 50,
};

const DETAIL_LABEL = {
  nama: 'Nama',
  email: 'Email',
  role: 'Role',
  status: 'Status',
  kode: 'Kode',
  qty: 'Jumlah',
  stok: 'Stok',
  stok_akhir: 'Stok akhir',
  stok_sebelumnya: 'Stok sebelumnya',
  stok_aktual: 'Stok aktual',
  selisih: 'Selisih',
  harga_jual: 'Harga jual',
  total: 'Total',
  metode: 'Metode',
  item: 'Item',
  no_transaksi: 'No. Transaksi',
  keterangan: 'Keterangan',
  perubahan: 'Perubahan',
  dari: 'Dari',
  ke: 'Ke',
  manage_users: 'Izin kelola user',
  kategori_id: 'Kategori',
  satuan: 'Satuan',
  harga_beli: 'Harga beli',
  stok_min: 'Stok min',
  is_active: 'Aktif',
  dari_field: 'Dari',
};

const val = (v) => {
  if (v === true) return 'ya';
  if (v === false) return 'tidak';
  if (v === 0 || v === 1) return String(v);
  return v;
};

function fmtDetail(detail) {
  if (!detail) return '-';
  if (typeof detail === 'string') return detail;
  if (typeof detail !== 'object') return String(detail);
  const parts = [];
  for (const [key, raw] of Object.entries(detail)) {
    if (raw === null || raw === undefined || raw === '') continue;
    const label = DETAIL_LABEL[key] || key;
    if (raw && typeof raw === 'object') {
      const subs = Object.entries(raw)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => {
          const lbl = DETAIL_LABEL[k] || k;
          if (v && typeof v === 'object') return `${lbl}: ${val(v.dari)} → ${val(v.ke)}`;
          return `${lbl}: ${val(v)}`;
        });
      if (subs.length) parts.push(`${label} (${subs.join(', ')})`);
    } else {
      parts.push(`${label}: ${val(raw)}`);
    }
  }
  return parts.join(' · ') || '-';
}

/* ============================================================
   USER MANAGEMENT
   ============================================================ */
async function renderUserManagement() {
  const el = $('#view-users');
  el.innerHTML = `<div class="empty-state"><div class="big">⏳</div><p>Memuat data pengguna...</p></div>`;
  try {
    if (!userState.roles.length) {
      userState.roles = await api('/api/users/meta/roles').then((d) => d.data).catch(() => []);
    }
    await loadUsers();
  } catch (e) {
    el.innerHTML = emptyHTML(e.message, '⚠️');
  }
}

function userFilterHTML() {
  const roles = userState.roles.length
    ? userState.roles
    : [{ key: 'admin', label: 'Admin' }, { key: 'owner', label: 'Owner/Pimpinan' }, { key: 'kasir', label: 'Kasir' }, { key: 'staff', label: 'Staff' }];
  return `
    <div class="toolbar">
      <input class="search" id="user-search" placeholder="Cari nama atau email..." value="${esc(userState.q)}" />
      <select class="select" id="user-role">
        <option value="">Semua Role</option>
        ${roles.map((r) => `<option value="${r.key}" ${userState.role === r.key ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
      </select>
      <select class="select" id="user-status">
        <option value="">Semua Status</option>
        <option value="aktif" ${userState.status === 'aktif' ? 'selected' : ''}>Aktif</option>
        <option value="nonaktif" ${userState.status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option>
      </select>
    </div>`;
}

async function loadUsers() {
  const params = new URLSearchParams();
  if (userState.q.trim()) params.set('q', userState.q.trim());
  if (userState.role) params.set('role', userState.role);
  if (userState.status) params.set('status', userState.status);

  const { data, summary } = await api('/api/users?' + params.toString());
  userState.list = data;
  userState.summary = summary || {};

  const el = $('#view-users');
  if (!el) return;

  el.innerHTML = `
    <div class="page-head ph-violet">
      <div class="ph-ico">👥</div>
      <div>
        <h3>User Management</h3>
        <p>Kelola Admin, Kasir, Staff, dan Owner. Semua akun memakai data CisaruaPOS yang sama.</p>
      </div>
      <div class="ph-spacer"></div>
      <button class="btn btn-primary" id="btn-add-user">➕ Tambah Admin</button>
    </div>

    <div class="grid grid-4 mb-12">
      <div class="card">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${fmtNum(userState.summary.total || 0)}</div>
        <div class="stat-label">Total Pengguna</div>
      </div>
      <div class="card">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${fmtNum(userState.summary.aktif || 0)}</div>
        <div class="stat-label">Akun Aktif</div>
      </div>
      <div class="card" style="${(userState.summary.nonaktif || 0) ? '--card-bar:var(--g-rose);--card-bg:var(--s-rose);--card-ink:var(--c-rose)' : ''}">
        <div class="stat-icon">⛔</div>
        <div class="stat-value">${fmtNum(userState.summary.nonaktif || 0)}</div>
        <div class="stat-label">Akun Nonaktif</div>
      </div>
      <div class="card">
        <div class="stat-icon">🛡️</div>
        <div class="stat-value">${fmtNum(userState.summary.admin || 0)}</div>
        <div class="stat-label">Admin / Owner</div>
      </div>
    </div>

    <div class="card mb-12">
      ${userFilterHTML()}
    </div>

    <div class="card">
      <div class="card-title">Daftar Seluruh Admin</div>
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>Nama &amp; Email</th>
              <th>Role</th>
              <th>Izin Kelola User</th>
              <th>Status</th>
              <th>Terakhir Login</th>
              <th style="text-align:right">Aksi</th>
            </tr>
          </thead>
          <tbody id="user-body"></tbody>
        </table>
      </div>
    </div>`;

  const body = $('#user-body');
  if (!data.length) {
    body.innerHTML = `<tr><td colspan="6">${emptyHTML('Belum ada pengguna yang cocok', '👤')}</td></tr>`;
  } else {
    body.innerHTML = data.map(userRow).join('');
  }

  $('#user-search').addEventListener('input', debounce((e) => { userState.q = e.target.value; loadUsers(); }, 300));
  $('#user-role').addEventListener('change', (e) => { userState.role = e.target.value; loadUsers(); });
  $('#user-status').addEventListener('change', (e) => { userState.status = e.target.value; loadUsers(); });
  $('#btn-add-user').addEventListener('click', () => showUserForm());
}

function userRow(u) {
  const aktif = u.status === 'aktif';
  const badge = ROLE_BADGE[u.role] || 'badge-gray';
  return `
    <tr>
      <td>
        <b>${esc(u.nama)}</b>${u.is_self ? ' <span class="badge badge-blue">Anda</span>' : ''}<br/>
        <small style="color:var(--muted)">${esc(u.email)}</small><br/>
        <small style="color:var(--muted);opacity:.8">Bergabung: ${esc(u.created_at ? fmtTime(u.created_at) : '-')}</small>
      </td>
      <td><span class="badge ${badge}">${esc(u.role_label || roleLabel(u.role))}</span></td>
      <td>${u.manage_users ? '<span class="badge badge-blue">Ya</span>' : '<span class="badge badge-gray">Tidak</span>'}</td>
      <td><span class="stock-pill ${aktif ? 'stock-normal' : 'stock-out'}">${aktif ? 'Aktif' : 'Nonaktif'}</span></td>
      <td><small>${u.last_login ? esc(fmtTime(u.last_login)) : '<span style="color:var(--muted)">Belum pernah</span>'}</small></td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-soft btn-sm" onclick='showUserForm(${u.id})'>✏️ Edit</button>
        ${aktif
          ? `<button class="btn btn-warning btn-sm" onclick='toggleUser(${u.id})' ${u.is_self ? 'disabled' : ''}>⛔</button>`
          : `<button class="btn btn-success btn-sm" onclick='toggleUser(${u.id})'>▶️ Aktifkan</button>`}
        <button class="btn btn-danger btn-sm" onclick='removeUser(${u.id})' ${u.is_self ? 'disabled' : ''}>🗑️</button>
      </td>
    </tr>`;
}

/* ---------- Form tambah / ubah pengguna ---------- */
function showUserForm(id) {
  const u = id ? userState.list.find((x) => x.id === id) : null;
  const isEdit = !!u;
  const roles = userState.roles.length
    ? userState.roles
    : [
        { key: 'admin', label: 'Admin', manage_users: 1 },
        { key: 'owner', label: 'Owner/Pimpinan', manage_users: 1 },
        { key: 'kasir', label: 'Kasir', manage_users: 0 },
        { key: 'staff', label: 'Staff', manage_users: 0 },
      ];

  const roleOptions = roles
    .map((r) => `<option value="${r.key}" ${u && u.role === r.key ? 'selected' : ''}>${esc(r.label)}</option>`)
    .join('');

  openModal(isEdit ? 'Edit Pengguna' : 'Tambah Admin Baru', `
    <form id="user-form">
      <div class="field">
        <label class="label">Nama *</label>
        <input class="input" name="nama" required value="${esc(u?.nama || '')}" placeholder="cth: Admin 1" />
      </div>
      <div class="field">
        <label class="label">Email *</label>
        <input class="input" name="email" type="email" required value="${esc(u?.email || '')}" placeholder="cth: admin1@gmail.com" />
        <small style="color:var(--muted)">Email ini dipakai untuk login. Tidak ada password.</small>
      </div>
      <div class="form-row">
        <div class="field">
          <label class="label">Role *</label>
          <select class="select" name="role" id="user-form-role">${roleOptions}</select>
        </div>
        <div class="field">
          <label class="label">Status</label>
          <select class="select" name="status">
            <option value="aktif" ${!u || u.status === 'aktif' ? 'selected' : ''}>Aktif</option>
            <option value="nonaktif" ${u?.status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label class="label"><input type="checkbox" name="manage_users" id="user-form-manage" ${u?.manage_users ? 'checked' : ''} /> Izin mengelola Admin lain (Settings → User Management)</label>
        <small style="color:var(--muted)" id="manage-hint">Hanya role Admin dan Owner/Pimpinan yang dapat diberi izin ini.</small>
      </div>
      <div class="form-row mt-12">
        <button class="btn btn-primary btn-block" type="submit">💾 Simpan</button>
        <button class="btn btn-outline btn-block" type="button" id="btn-batal-user">Batal</button>
      </div>
    </form>`);

  const roleSel = $('#user-form-role');
  const manage = $('#user-form-manage');
  const syncManage = () => {
    const r = roles.find((x) => x.key === roleSel.value);
    const allowed = r ? r.manage_users === 1 : true;
    manage.disabled = !allowed;
    if (!allowed) manage.checked = false;
  };
  roleSel.addEventListener('change', syncManage);
  syncManage();

  $('#btn-batal-user').addEventListener('click', closeModal);

  $('#user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.manage_users = fd.get('manage_users') ? 1 : 0;
    if (!EMAIL_RE.test(String(body.email || '').trim().toLowerCase())) {
      toast('Format email tidak valid', 'error');
      return;
    }
    try {
      if (isEdit) await api('/api/users/' + u.id, { method: 'PUT', body });
      else await api('/api/users', { method: 'POST', body });
      toast(isEdit ? 'Data pengguna diperbarui' : 'Admin baru berhasil ditambahkan', 'success');
      closeModal();
      // bila akun sendiri yang diubah, segarkan profil di sidebar
      if (isEdit && u.is_self) await refreshProfile();
      loadUsers();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* ---------- Aktif / nonaktif ---------- */
async function toggleUser(id) {
  const u = userState.list.find((x) => x.id === id);
  if (!u) return;
  const next = u.status === 'aktif' ? 'nonaktif' : 'aktif';
  if (next === 'nonaktif' && !confirm(`Nonaktifkan akses ${u.nama} (${u.email})?`)) return;
  try {
    const res = await api(`/api/users/${id}/status`, { method: 'PATCH', body: { status: next } });
    toast(res.message, 'success');
    loadUsers();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ---------- Hapus akses ---------- */
async function removeUser(id) {
  const u = userState.list.find((x) => x.id === id);
  if (!u) return;
  if (!confirm(`Hapus akses ${u.nama} (${u.email})?\n\nEmail ini tidak akan bisa login lagi. Riwayat transaksi tetap tersimpan.`)) return;
  try {
    const res = await api('/api/users/' + id, { method: 'DELETE' });
    toast(res.message, 'success');
    loadUsers();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============================================================
   AUDIT LOG
   ============================================================ */
async function renderAuditLog() {
  const el = $('#view-audit');
  el.innerHTML = `<div class="empty-state"><div class="big">⏳</div><p>Memuat audit log...</p></div>`;
  try {
    await loadAudit(true);
  } catch (e) {
    el.innerHTML = emptyHTML(e.message, '⚠️');
  }
}

function auditDetailHTML(r) {
  return `
    <tr>
      <td style="white-space:nowrap"><small>${esc(fmtTime(r.created_at))}</small></td>
      <td>
        <b>${esc(r.user_nama || '-')}</b><br/>
        <small style="color:var(--muted)">${esc(r.user_email || '-')}</small>
      </td>
      <td><span class="badge ${auditBadge(r.aktivitas)}">${esc(r.aktivitas)}</span></td>
      <td style="font-size:12.5px;color:var(--muted)">${esc(fmtDetail(r.detail))}</td>
    </tr>`;
}

function auditBadge(aktivitas) {
  const a = String(aktivitas || '');
  if (a.startsWith('Login berhasil')) return 'badge-green';
  if (a.startsWith('Logout')) return 'badge-gray';
  if (a.includes('ditolak')) return 'badge-red';
  if (a.includes('Menghapus') || a.includes('Menonaktifkan')) return 'badge-red';
  if (a.includes('transaksi')) return 'badge-cyan';
  if (a.includes('stok') || a.includes('Stok')) return 'badge-teal';
  if (a.includes('produk') || a.includes('Produk')) return 'badge-pink';
  if (a.includes('Admin') || a.includes('pengguna')) return 'badge-violet';
  return 'badge-amber';
}

async function loadAudit(reset = false) {
  if (reset) userState.auditOffset = 0;
  const params = new URLSearchParams({ limit: userState.auditLimit, offset: userState.auditOffset });
  if (userState.auditQ.trim()) params.set('q', userState.auditQ.trim());

  const { data, total } = await api('/api/users/audit?' + params.toString());
  userState.auditRows = reset ? data : userState.auditRows.concat(data);
  userState.auditTotal = total;

  const el = $('#view-audit');
  if (!el) return;

  const shown = userState.auditRows.length;
  el.innerHTML = `
    <div class="page-head ph-cyan">
      <div class="ph-ico">🕒</div>
      <div>
        <h3>Audit Log</h3>
        <p>Catatan aktivitas semua Admin: siapa, melakukan apa, dan kapan.</p>
      </div>
      <div class="ph-spacer"></div>
      <button class="btn btn-soft" id="audit-refresh">🔄 Muat ulang</button>
    </div>

    <div class="card mb-12">
      <div class="toolbar">
        <input class="search" id="audit-search" placeholder="Cari email, aktivitas, atau data..." value="${esc(userState.auditQ)}" />
      </div>
    </div>

    <div class="card">
      <div class="card-title">Menampilkan ${fmtNum(shown)} dari ${fmtNum(userState.auditTotal)} aktivitas</div>
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th><th>Data</th></tr>
          </thead>
          <tbody id="audit-body"></tbody>
        </table>
      </div>
      ${shown < total ? '<div class="mt-12" style="text-align:center"><button class="btn btn-soft" id="audit-more">Muat lebih banyak</button></div>' : ''}
    </div>`;

  const body = $('#audit-body');
  body.innerHTML = userState.auditRows.length
    ? userState.auditRows.map(auditDetailHTML).join('')
    : `<tr><td colspan="4">${emptyHTML('Belum ada aktivitas tercatat', '🕒')}</td></tr>`;

  $('#audit-search').addEventListener('input', debounce((e) => {
    userState.auditQ = e.target.value;
    loadAudit(true);
  }, 300));
  $('#audit-refresh').addEventListener('click', () => loadAudit(true));
  $('#audit-more')?.addEventListener('click', () => {
    userState.auditOffset = userState.auditRows.length;
    loadAudit();
  });
}

/* ---------- util ---------- */
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* expose ke app.js (dipakai navigate()) */
window.renderUserManagement = renderUserManagement;
window.renderAuditLog = renderAuditLog;
window.showUserForm = showUserForm;
window.toggleUser = toggleUser;
window.removeUser = removeUser;
