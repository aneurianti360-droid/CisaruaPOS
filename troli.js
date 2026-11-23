/* ============================================================
   TROLI BELANJA CISARUAPOS
   Katalog produk -> keranjang -> voucher/ongkir -> checkout.
   Checkout memakai data produk & stok yang sama dengan Kasir.
   ============================================================ */

const troliState = {
  q: '',
  kategori: '',
  kategoriList: [],
  vouchers: [],
  lastOrder: null,
  metode: 'transfer',
  catatan: '',
};

async function renderTroli() {
  const el = $('#view-troli');
  el.innerHTML = `<div class="empty-state"><div class="big">⏳</div><p>Memuat katalog & troli...</p></div>`;

  try {
    await Promise.all([loadTroliKatalog(), loadTroliCart(), loadTroliVouchers()]);
    if (troliState.lastOrder) return renderTroliSukses();
    renderTroliView();
  } catch (e) {
    el.innerHTML = emptyHTML(e.message, '⚠️');
  }
}

async function loadTroliKatalog() {
  const [products, cats] = await Promise.all([
    api('/api/products?aktif=1').then((d) => d.data),
    api('/api/products/meta/kategori').then((d) => d.data).catch(() => []),
  ]);
  state.troliProduk = products;
  troliState.kategoriList = cats;
}

async function loadTroliCart() {
  const data = await api('/api/troli');
  state.troliKeranjang = data.data;
}

async function loadTroliVouchers() {
  try {
    const data = await api('/api/troli/vouchers');
    troliState.vouchers = data.data;
  } catch (e) { troliState.vouchers = []; }
}

function renderTroliView() {
  const el = $('#view-troli');
  const products = state.troliProduk.filter((p) => {
    const cocokQ = !troliState.q || p.nama.toLowerCase().includes(troliState.q.toLowerCase()) || String(p.kode).toLowerCase().includes(troliState.q.toLowerCase());
    const cocokKat = !troliState.kategori || String(p.kategori_id) === String(troliState.kategori);
    return cocokQ && cocokKat;
  });

  el.innerHTML = `
    <div class="page-head ph-orange">
      <div class="ph-ico">🧺</div>
      <div><h3>Troli Belanja</h3><p>Pilih produk kantin & koperasi, lalu checkout dalam satu langkah.</p></div>
    </div>
    <div class="troli-wrap">
      <div class="card">
        <div class="card-title">🛍️ Katalog Produk <span class="badge badge-orange">${products.length}</span></div>
        <div class="toolbar">
          <input class="search" id="troli-q" placeholder="Cari produk..." value="${esc(troliState.q)}" />
          <select class="select" id="troli-kategori">
            <option value="">Semua Kategori</option>
            ${troliState.kategoriList.map((c) => `<option value="${c.id}" ${String(troliState.kategori) === String(c.id) ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}
          </select>
        </div>
        <div class="troli-katalog" id="troli-katalog">
          ${products.length ? products.map((p) => `
            <div class="troli-produk">
              <div class="troli-produk-ico">${kategoriIcon(p.kategori)}</div>
              <div class="troli-produk-info">
                <div class="troli-produk-nama">${esc(p.nama)}</div>
                <div class="troli-produk-harga">${fmtRupiah(p.harga_jual)} <span>/ ${esc(p.satuan)}</span></div>
                <div class="troli-produk-stok ${p.stok <= 0 ? 'low' : ''}">Stok: ${fmtNum(p.stok)}</div>
              </div>
              <button class="btn btn-sm btn-primary" data-troli-add="${p.id}" ${p.stok <= 0 ? 'disabled' : ''}>＋</button>
            </div>`).join('') : emptyHTML('Produk tidak ditemukan.', '🔍')}
        </div>
      </div>

      <div class="troli-cart" id="troli-cart">
        <div class="troli-cart-head">
          <strong>🧺 Keranjang Saya</strong>
          <span id="troli-count">${fmtNum(state.troliKeranjang.jumlah_item)} produk</span>
        </div>
        <div id="troli-items"></div>
        <div class="troli-cart-foot">
          <div class="field">
            <label for="troli-voucher-input">🎟️ Kode voucher</label>
            <div class="voucher-row">
              <input class="input" id="troli-voucher-input" placeholder="Misal: HEMAT10" value="${esc(state.troliVoucher?.kode || '')}" />
              <button class="btn btn-sm btn-primary" id="troli-pakai-voucher">Pakai</button>
            </div>
            ${troliState.vouchers.length ? `<div class="voucher-list">
              ${troliState.vouchers.map((v) => `<button class="voucher-chip" data-voucher="${esc(v.kode)}" title="Min. belanja ${fmtRupiah(v.min_belanja)}">${esc(v.kode)}</button>`).join('')}
            </div>` : ''}
            ${state.troliVoucher ? `<div class="voucher-active">✓ ${esc(state.troliVoucher.nama || state.troliVoucher.kode)} <button id="troli-lepas-voucher">Lepas</button></div>` : ''}
          </div>
          <div class="field">
            <label for="troli-ongkir">🚚 Ongkos kirim</label>
            <select class="select" id="troli-ongkir">
              <option value="0">Ambil di kantin (gratis)</option>
              <option value="5000">Dikirim kelas - Rp 5.000</option>
              <option value="10000">Dikirim asrama - Rp 10.000</option>
              <option value="15000">Luar sekolah - Rp 15.000</option>
            </select>
          </div>
          <div id="troli-summary"></div>
          <div class="field">
            <label for="troli-metode">💳 Metode pembayaran</label>
            <select class="select" id="troli-metode">
              <option value="transfer">Transfer / QRIS</option>
              <option value="tunai">Tunai saat ambil</option>
              <option value="qris">QRIS</option>
            </select>
          </div>
          <div class="field">
            <label for="troli-catatan">📝 Catatan (opsional)</label>
            <input class="input" id="troli-catatan" maxlength="300" placeholder="Contoh: titipkan di kelas 2A" value="${esc(troliState.catatan)}" />
          </div>
          <button class="btn btn-success btn-block btn-lg" id="troli-checkout">Checkout & Bayar</button>
        </div>
      </div>
    </div>`;

  $('#troli-ongkir').value = String(state.troliOngkir);
  $('#troli-metode').value = troliState.metode;
  renderTroliItems();
  renderTroliSummary();

  $('#troli-q').addEventListener('input', (e) => {
    troliState.q = e.target.value;
    const pos = e.target.selectionStart;
    renderTroliView();
    $('#troli-q').focus();
    $('#troli-q').setSelectionRange(pos, pos);
  });
  $('#troli-kategori').addEventListener('change', (e) => { troliState.kategori = e.target.value; renderTroliView(); });

  $('#troli-katalog').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-troli-add]');
    if (btn) troliTambah(Number(btn.dataset.troliAdd));
  });

  $('#troli-items').addEventListener('click', (e) => {
    const qty = e.target.closest('[data-troli-qty]');
    if (qty) return troliUbahQty(Number(qty.dataset.troliQty), Number(qty.dataset.delta));
    const hapus = e.target.closest('[data-troli-hapus]');
    if (hapus) return troliHapus(Number(hapus.dataset.troliHapus));
  });
  $('#troli-items').addEventListener('change', (e) => {
    const check = e.target.closest('[data-troli-check]');
    if (check) troliPilih(Number(check.dataset.troliCheck), check.checked);
  });

  $('#troli-pakai-voucher').addEventListener('click', troliPakaiVoucher);
  $('#troli-voucher-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') troliPakaiVoucher(); });
  $('#troli-lepas-voucher')?.addEventListener('click', () => {
    state.troliVoucher = null;
    $('#troli-voucher-input').value = '';
    renderTroliView();
  });
  $('#troli-voucher-input')?.addEventListener('input', (e) => {
    if (state.troliVoucher && e.target.value.trim().toUpperCase() !== state.troliVoucher.kode) {
      state.troliVoucher = null;
      renderTroliSummary();
    }
  });
  $$('[data-voucher]').forEach((chip) => chip.addEventListener('click', () => {
    $('#troli-voucher-input').value = chip.dataset.voucher;
    troliPakaiVoucher();
  }));

  $('#troli-ongkir').addEventListener('change', async (e) => {
    state.troliOngkir = Number(e.target.value) || 0;
    if (state.troliVoucher) {
      try {
        const data = await api('/api/troli/voucher/validate', {
          method: 'POST',
          body: { kode: state.troliVoucher.kode, ongkir: state.troliOngkir },
        });
        state.troliVoucher = data.data.voucher;
      } catch (err) { state.troliVoucher = null; toast(err.message, 'warning'); }
    }
    renderTroliSummary();
  });
  $('#troli-metode').addEventListener('change', (e) => { troliState.metode = e.target.value; });
  $('#troli-catatan').addEventListener('input', (e) => { troliState.catatan = e.target.value; });
  $('#troli-checkout').addEventListener('click', troliCheckout);
}

function renderTroliItems() {
  const box = $('#troli-items');
  if (!box) return;
  const items = state.troliKeranjang?.items || [];
  if (!items.length) {
    box.innerHTML = emptyHTML('Keranjang masih kosong. Tambahkan produk!', '🧺');
    return;
  }
  box.innerHTML = items.map((i) => `
    <div class="troli-item ${Number(i.selected) ? '' : 'unselected'}">
      <input type="checkbox" data-troli-check="${i.id}" ${Number(i.selected) ? 'checked' : ''} />
      <div class="troli-item-info">
        <strong>${esc(i.nama)}</strong>
        <small>${fmtRupiah(i.harga_jual)} / ${esc(i.satuan)}</small>
      </div>
      <div class="ci-qty">
        <button data-troli-qty="${i.id}" data-delta="-1">−</button>
        <span>${fmtNum(i.qty)}</span>
        <button data-troli-qty="${i.id}" data-delta="1">＋</button>
      </div>
      <button class="ci-del" data-troli-hapus="${i.id}" title="Hapus">×</button>
    </div>`).join('');
  const count = $('#troli-count');
  if (count) count.textContent = `${fmtNum(state.troliKeranjang.jumlah_item)} produk`;
}

function troliRingkasan() {
  const subtotal = Number(state.troliKeranjang?.subtotal || 0);
  let diskon = 0;
  let potonganOngkir = 0;
  const v = state.troliVoucher;
  if (v) {
    if (v.tipe === 'persen') diskon = Math.min(Math.round((subtotal * Number(v.nilai)) / 100), Number(v.maksimal || Infinity), subtotal);
    else if (v.tipe === 'nominal') diskon = Math.min(Number(v.nilai), subtotal);
    else if (v.tipe === 'ongkir') potonganOngkir = Math.min(state.troliOngkir, Number(v.maksimal || v.nilai || 0));
  }
  const ongkir = Math.max(0, state.troliOngkir - potonganOngkir);
  return { subtotal, diskon, potonganOngkir, ongkir, total: Math.max(0, subtotal - diskon + ongkir) };
}

function renderTroliSummary() {
  const box = $('#troli-summary');
  if (!box) return;
  const r = troliRingkasan();
  box.innerHTML = `
    <div class="dashed"></div>
    <div class="pay-sum-row"><span>Subtotal (${fmtNum(state.troliKeranjang?.total_qty || 0)} item)</span><b>${fmtRupiah(r.subtotal)}</b></div>
    ${r.diskon ? `<div class="pay-sum-row diskon"><span>Diskon voucher</span><b>− ${fmtRupiah(r.diskon)}</b></div>` : ''}
    ${r.potonganOngkir ? `<div class="pay-sum-row diskon"><span>Potongan ongkir</span><b>− ${fmtRupiah(r.potonganOngkir)}</b></div>` : ''}
    <div class="pay-sum-row"><span>Ongkos kirim</span><b>${r.ongkir ? fmtRupiah(r.ongkir) : 'Gratis'}</b></div>
    <div class="pay-total"><span>Total pembayaran</span><span>${fmtRupiah(r.total)}</span></div>`;
}

/* Antrean mutations agar klik cepat tidak saling menimpa (qty selalu diambil dari server) */
let troliAntrean = Promise.resolve();
function troliMutasi(path, opts, pesanSukses = null) {
  troliAntrean = troliAntrean
    .then(async () => {
      const data = await api(path, opts);
      const fresh = await api('/api/troli');
      state.troliKeranjang = fresh.data;
      renderTroliItems();
      renderTroliSummary();
      if (pesanSukses) toast(pesanSukses, 'success');
      else if (data?.message) toast(data.message, 'success');
      return data;
    })
    .catch((e) => { toast(e.message, 'error'); return null; });
  return troliAntrean;
}

function troliTambah(productId) {
  return troliMutasi('/api/troli/items', { method: 'POST', body: { product_id: productId, qty: 1 } }, 'Produk ditambahkan ke troli');
}

function troliUbahQty(id, delta) {
  const item = state.troliKeranjang?.items?.find((i) => i.id === id);
  if (!item) return Promise.resolve();
  return troliMutasi(`/api/troli/items/${id}`, { method: 'PATCH', body: { qty: Number(item.qty) + delta } });
}

function troliPilih(id, checked) {
  return troliMutasi(`/api/troli/items/${id}`, { method: 'PATCH', body: { selected: checked } });
}

function troliHapus(id) {
  return troliMutasi(`/api/troli/items/${id}`, { method: 'DELETE' }, 'Produk dihapus dari troli');
}

async function troliPakaiVoucher() {
  const kode = $('#troli-voucher-input')?.value.trim();
  if (!kode) return toast('Masukkan kode voucher', 'warning');
  try {
    const data = await api('/api/troli/voucher/validate', {
      method: 'POST',
      body: { kode, ongkir: state.troliOngkir },
    });
    state.troliVoucher = data.data.voucher;
    toast(data.message, 'success');
    renderTroliView();
  } catch (e) { toast(e.message, 'error'); }
}

async function troliCheckout() {
  const btn = $('#troli-checkout');
  if (!state.troliKeranjang?.jumlah_dipilih) {
    return toast('Pilih minimal satu produk di keranjang', 'warning');
  }
  try {
    await troliAntrean.catch(() => {}); // tunggu perubahan troli selesai
    btn.disabled = true;
    btn.textContent = '⏳ Memproses checkout...';
    const data = await api('/api/troli/checkout', {
      method: 'POST',
      body: {
        voucher: state.troliVoucher?.kode || null,
        ongkir: state.troliOngkir,
        metode: troliState.metode,
        catatan: troliState.catatan,
      },
    });
    troliState.lastOrder = data.data;
    state.troliVoucher = null;
    await loadTroliCart();
    toast(data.message, 'success');
    renderTroliSukses();
    // Stok produk berubah -> segarkan daftar produk bila sedang terbuka
    if (state.view === 'products') loadProducts().catch(() => {});
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Checkout & Bayar';
  }
}

function renderTroliSukses() {
  const o = troliState.lastOrder;
  $('#view-troli').innerHTML = `
    <div class="success-wrap card" style="padding:32px">
      <div class="success-icon">✅</div>
      <div class="success-no">Checkout Berhasil</div>
      <p class="success-meta">Pesanan ${esc(o.no_transaksi)} telah tersimpan dan bisa dilihat semua Admin di Riwayat Transaksi.</p>
      <div class="pay-sum-row"><span>Total dibayar</span><b>${fmtRupiah(o.total)}</b></div>
      <div class="pay-sum-row"><span>Metode</span><b>${esc(o.metode)}</b></div>
      ${o.voucher ? `<div class="pay-sum-row"><span>Voucher</span><b>${esc(o.voucher)}</b></div>` : ''}
      <div class="success-actions">
        <button class="btn btn-primary" data-view="riwayat">🧾 Lihat Riwayat</button>
        <button class="btn btn-outline" id="troli-belanja-lagi">🛍️ Belanja Lagi</button>
      </div>
    </div>`;
  $('#troli-belanja-lagi').addEventListener('click', () => {
    troliState.lastOrder = null;
    renderTroli();
  });
}

window.renderTroli = renderTroli;
