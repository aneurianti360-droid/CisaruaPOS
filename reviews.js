/* ============================================================
   ULASAN (REVIEW) CISARUAPOS
   Rating 1-5 bintang, komentar, foto, like, filter & balasan admin.
   ============================================================ */

const reviewState = {
  q: '',
  product: '',
  rating: '',
  sort: 'terbaru',
  stats: null,
  products: [],
  list: [],
  total: 0,
  edit: null,
  formRating: 5,
  formGambar: null,
};

const bintang = (n) => '★'.repeat(Number(n) || 0) + '☆'.repeat(5 - (Number(n) || 0));
const bisaBalas = () => ['admin', 'owner'].includes(state.user?.role);

async function renderReviews() {
  const el = $('#view-reviews');
  el.innerHTML = `
    <div class="page-head ph-amber">
      <div class="ph-ico">⭐</div>
      <div style="flex:1"><h3>Ulasan Produk</h3><p>Bagikan pengalaman Anda dan baca ulasan dari pengguna lain.</p></div>
      <button class="btn btn-success" id="rev-tulis">✍️ Tulis Ulasan</button>
    </div>
    <div id="rev-stats" class="grid grid-4 mb-16"></div>
    <div class="card">
      <div class="toolbar">
        <input class="search" id="rev-q" placeholder="Cari ulasan, produk, atau nama..." value="${esc(reviewState.q)}" />
        <select class="select" id="rev-product"><option value="">Semua Produk</option></select>
        <select class="select" id="rev-sort">
          <option value="terbaru">Terbaru</option>
          <option value="populer">Paling Populer</option>
          <option value="tertinggi">Rating Tertinggi</option>
          <option value="terendah">Rating Terendah</option>
        </select>
      </div>
      <div class="filter-chips" id="rev-filters">
        ${[['', 'Semua'], [5, '5 ★'], [4, '4 ★'], [3, '3 ★'], [2, '2 ★'], [1, '1 ★']]
          .map(([v, label]) => `<button class="filter-chip ${String(reviewState.rating) === String(v) ? 'active' : ''}" data-rating="${v}">${label}</button>`).join('')}
      </div>
      <div id="rev-list"></div>
    </div>`;

  $('#rev-sort').value = reviewState.sort;
  await Promise.all([loadReviewStats(), loadReviewProducts()]);
  await loadReviews();

  $('#rev-tulis').addEventListener('click', () => bukaFormUlasan());
  $('#rev-q').addEventListener('input', (e) => { reviewState.q = e.target.value; loadReviews(); });
  $('#rev-product').addEventListener('change', (e) => { reviewState.product = e.target.value; loadReviews(); });
  $('#rev-sort').addEventListener('change', (e) => { reviewState.sort = e.target.value; loadReviews(); });
  $('#rev-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rating]');
    if (!btn) return;
    reviewState.rating = btn.dataset.rating;
    $('#rev-filters').querySelectorAll('[data-rating]').forEach((b) => b.classList.toggle('active', b === btn));
    loadReviews();
  });

  $('#rev-list').addEventListener('click', async (e) => {
    const like = e.target.closest('[data-like]');
    if (like) return toggleLike(Number(like.dataset.like));
    const reply = e.target.closest('[data-reply]');
    if (reply) return tampilFormBalasan(Number(reply.dataset.reply));
    const hapus = e.target.closest('[data-hapus-review]');
    if (hapus) return hapusReview(Number(hapus.dataset.hapusReview));
    const edit = e.target.closest('[data-edit-review]');
    if (edit) {
      const r = reviewState.list.find((x) => x.id === Number(edit.dataset.editReview));
      if (r) bukaFormUlasan(r);
    }
    const foto = e.target.closest('[data-lihat-foto]');
    if (foto) {
      const r = reviewState.list.find((x) => x.id === Number(foto.dataset.lihatFoto));
      if (r?.gambar) openModal('Foto Ulasan', `<img src="${r.gambar}" alt="Foto ulasan" style="width:100%;border-radius:12px" />`, true);
    }
  });
}

async function loadReviewStats() {
  const box = $('#rev-stats');
  if (!box) return;
  try {
    const data = await api('/api/reviews/stats');
    reviewState.stats = data.data;
    const s = data.data;
    box.innerHTML = `
      <div class="card stat-tile"><div class="stat-icon">⭐</div>
        <div class="stat-value">${fmtNum(s.rata_rata)} <small style="font-size:13px">/ 5</small></div>
        <div class="stat-label">Rating rata-rata</div></div>
      <div class="card stat-tile"><div class="stat-icon">💬</div>
        <div class="stat-value">${fmtNum(s.total)}</div><div class="stat-label">Total ulasan</div></div>
      <div class="card stat-tile"><div class="stat-icon">📷</div>
        <div class="stat-value">${fmtNum(s.dengan_foto)}</div><div class="stat-label">Ulasan bergambar</div></div>
      <div class="card stat-tile"><div class="stat-icon">📊</div>
        <div class="rating-dist">
          ${s.distribusi.map((d) => `<div class="rating-row"><span>${d.bintang}★</span>
            <div class="bar"><div style="width:${s.total ? (d.jumlah / s.total) * 100 : 0}%"></div></div>
            <b>${d.jumlah}</b></div>`).join('')}
        </div>
      </div>`;
  } catch (e) {
    box.innerHTML = emptyHTML(e.message, '⚠️');
  }
}

async function loadReviewProducts() {
  try {
    const data = await api('/api/products?aktif=1');
    reviewState.products = data.data;
    const select = $('#rev-product');
    if (!select) return;
    const prev = reviewState.product;
    select.innerHTML = `<option value="">Semua Produk</option>` +
      reviewState.products.map((p) => `<option value="${p.id}">${esc(p.nama)}</option>`).join('');
    select.value = prev;
  } catch (e) { /* biarkan filter tanpa produk */ }
}

async function loadReviews() {
  const box = $('#rev-list');
  if (!box) return;
  box.innerHTML = `<div class="empty-state"><div class="big">⏳</div><p>Memuat ulasan...</p></div>`;
  try {
    const params = new URLSearchParams({ sort: reviewState.sort, limit: 50 });
    if (reviewState.q.trim()) params.set('q', reviewState.q.trim());
    if (reviewState.product) params.set('product_id', reviewState.product);
    if (reviewState.rating) params.set('rating', reviewState.rating);
    const data = await api(`/api/reviews?${params}`);
    reviewState.list = data.data;
    reviewState.total = data.total;
    renderReviewList();
  } catch (e) {
    box.innerHTML = emptyHTML(e.message, '⚠️');
  }
}

function renderReviewList() {
  const box = $('#rev-list');
  if (!box) return;
  if (!reviewState.list.length) {
    box.innerHTML = emptyHTML('Belum ada ulasan. Jadilah yang pertama!', '💬');
    return;
  }
  box.innerHTML = `
    <div class="muted-text mb-12">Menampilkan ${reviewState.list.length} dari ${fmtNum(reviewState.total)} ulasan</div>
    <div class="review-grid">
      ${reviewState.list.map((r) => {
        const own = state.user?.id === r.user_id;
        return `
        <div class="review-card">
          <div class="review-head">
            <div class="avatar sm">${esc(String(r.nama || 'U').charAt(0).toUpperCase())}</div>
            <div class="review-author">
              <strong>${esc(r.nama)} ${own ? '<span class="badge badge-violet">Anda</span>' : ''}</strong>
              <small>${esc(r.email || '')} · ${esc(fmtTime(r.created_at))}</small>
            </div>
            <div class="review-stars"><span class="stars">${bintang(r.rating)}</span></div>
          </div>
          <div class="review-product">🛍️ ${esc(r.produk_nama)}</div>
          <p class="review-text">${esc(r.komentar)}</p>
          ${r.gambar ? `<img class="review-photo" src="${r.gambar}" data-lihat-foto="${r.id}" alt="Foto ulasan" />` : ''}
          ${(r.replies || []).map((bal) => `
            <div class="review-reply">
              <b>↳ ${esc(bal.nama)} <span class="badge badge-blue">${esc(bal.role === 'owner' ? 'Owner' : 'Admin')}</span></b>
              <p>${esc(bal.komentar)}</p>
              <small>${esc(fmtTime(bal.created_at))}</small>
            </div>`).join('')}
          <div class="review-actions">
            <button class="btn btn-sm ${r.sudah_like ? 'btn-primary' : 'btn-outline'}" data-like="${r.id}">
              ${r.sudah_like ? '❤️' : '🤍'} Suka <b>${fmtNum(r.likes)}</b>
            </button>
            ${bisaBalas() ? `<button class="btn btn-sm btn-ghost" data-reply="${r.id}">↩️ Balas</button>` : ''}
            ${own ? `<button class="btn btn-sm btn-ghost" data-edit-review="${r.id}">✏️ Ubah</button>` : ''}
            ${own || bisaBalas() ? `<button class="btn btn-sm btn-danger" data-hapus-review="${r.id}">🗑️</button>` : ''}
          </div>
          <div id="reply-box-${r.id}"></div>
        </div>`;
      }).join('')}
    </div>`;
}

async function toggleLike(id) {
  try {
    const data = await api(`/api/reviews/${id}/like`, { method: 'POST' });
    const r = reviewState.list.find((x) => x.id === id);
    if (r) { r.sudah_like = data.liked; r.likes = data.likes; }
    renderReviewList();
  } catch (e) { toast(e.message, 'error'); }
}

function tampilFormBalasan(id) {
  const box = $(`#reply-box-${id}`);
  if (!box) return;
  box.innerHTML = `
    <div class="reply-form mt-12">
      <textarea class="input" id="reply-text-${id}" rows="2" placeholder="Tulis balasan sebagai Admin/Owner..."></textarea>
      <div class="flex-between mt-12">
        <button class="btn btn-sm btn-ghost" id="reply-batal-${id}">Batal</button>
        <button class="btn btn-sm btn-primary" id="reply-kirim-${id}">Kirim Balasan</button>
      </div>
    </div>`;
  $(`#reply-batal-${id}`).addEventListener('click', () => { box.innerHTML = ''; });
  $(`#reply-kirim-${id}`).addEventListener('click', async () => {
    const komentar = $(`#reply-text-${id}`).value.trim();
    if (!komentar) return toast('Balasan tidak boleh kosong', 'warning');
    try {
      const data = await api(`/api/reviews/${id}/reply`, { method: 'POST', body: { komentar } });
      const r = reviewState.list.find((x) => x.id === id);
      if (r) r.replies.push(data.data);
      toast(data.message, 'success');
      renderReviewList();
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function hapusReview(id) {
  if (!confirm('Hapus ulasan ini?')) return;
  try {
    const data = await api(`/api/reviews/${id}`, { method: 'DELETE' });
    toast(data.message, 'success');
    await Promise.all([loadReviews(), loadReviewStats()]);
  } catch (e) { toast(e.message, 'error'); }
}

function bukaFormUlasan(edit = null) {
  reviewState.edit = edit;
  reviewState.formRating = edit?.rating || 5;
  reviewState.formGambar = edit?.gambar || null;

  const produkOptions = reviewState.products.length
    ? reviewState.products.map((p) => `<option value="${p.id}" ${edit && edit.product_id === p.id ? 'selected' : ''}>${esc(p.nama)}</option>`).join('')
    : `<option value="">Memuat produk...</option>`;

  openModal(edit ? 'Ubah Ulasan' : 'Tulis Ulasan', `
    <div class="field">
      <label for="rev-form-product">Produk / Layanan</label>
      <select class="select" id="rev-form-product" ${edit ? 'disabled' : ''}>${produkOptions}</select>
    </div>
    <div class="field">
      <label>Rating</label>
      <div class="star-picker" id="rev-form-stars">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star-btn ${n <= reviewState.formRating ? 'active' : ''}" data-star="${n}">★</button>`).join('')}
        <span class="muted-text" id="rev-rating-label">${reviewState.formRating} dari 5</span>
      </div>
    </div>
    <div class="field">
      <label for="rev-form-komentar">Komentar / Pengalaman</label>
      <textarea class="input" id="rev-form-komentar" rows="4" maxlength="1000" placeholder="Ceritakan pengalaman Anda tentang produk ini...">${esc(edit?.komentar || '')}</textarea>
    </div>
    <div class="field">
      <label for="rev-form-file">Foto ulasan <span class="muted-text">(opsional)</span></label>
      <input type="file" id="rev-form-file" accept="image/*" class="input" />
      <div id="rev-form-preview" class="rev-form-preview mt-12">
        ${reviewState.formGambar ? `<img src="${reviewState.formGambar}" alt="Foto ulasan" /><label class="muted-text"><input type="checkbox" id="rev-hapus-foto" /> Hapus foto ini</label>` : ''}
      </div>
    </div>
    <button class="btn btn-primary btn-block btn-lg" id="rev-form-submit">${edit ? 'Simpan Perubahan' : 'Kirim Ulasan'}</button>`, true);

  $('#rev-form-stars').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-star]');
    if (!btn) return;
    reviewState.formRating = Number(btn.dataset.star);
    $('#rev-form-stars').querySelectorAll('[data-star]').forEach((b) => b.classList.toggle('active', Number(b.dataset.star) <= reviewState.formRating));
    $('#rev-rating-label').textContent = `${reviewState.formRating} dari 5`;
  });

  $('#rev-form-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      reviewState.formGambar = await compressImage(file, 700, 0.7);
      $('#rev-form-preview').innerHTML = `<img src="${reviewState.formGambar}" alt="Pratinjau foto ulasan" />`;
    } catch (err) { toast(err.message, 'error'); }
  });

  $('#rev-form-submit').addEventListener('click', simpanUlasan);
}

async function simpanUlasan() {
  const edit = reviewState.edit;
  const productId = edit ? edit.product_id : Number($('#rev-form-product')?.value);
  const komentar = $('#rev-form-komentar').value.trim();
  if (!productId) return toast('Pilih produk terlebih dahulu', 'warning');
  if (komentar.length < 3) return toast('Komentar minimal 3 karakter', 'warning');

  const body = { rating: reviewState.formRating, komentar, gambar: reviewState.formGambar };
  if (!edit) body.product_id = productId;
  if ($('#rev-hapus-foto')?.checked) body.hapus_foto = true;

  try {
    const data = await api(edit ? `/api/reviews/${edit.id}` : '/api/reviews', {
      method: edit ? 'PUT' : 'POST',
      body,
    });
    closeModal();
    toast(data.message, 'success');
    await Promise.all([loadReviews(), loadReviewStats()]);
  } catch (e) { toast(e.message, 'error'); }
}

window.renderReviews = renderReviews;
