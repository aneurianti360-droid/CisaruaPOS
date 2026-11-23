/* ============================================================
   SCAN KALORI MAKANAN - CISARUAPOS
   Camera/galeri -> estimasi kalori & nutrisi -> riwayat harian.
   Hasil estimasi dapat dikoreksi (pilih makanan & porsi).
   ============================================================ */

const scanState = {
  gambar: null,
  hint: '',
  foods: [],
  foodId: null,
  porsi: 'sedang',
  kandidat: [],
  hasil: null,
  tanggal: new Date().toLocaleDateString('sv-SE'), // YYYY-MM-DD lokal
};

const todayStr = () => new Date().toLocaleDateString('sv-SE');

async function renderNutrition() {
  const el = $('#view-scan');
  el.innerHTML = `
    <div class="page-head ph-mint">
      <div class="ph-ico">🥗</div>
      <div><h3>Scan Kalori Makanan</h3><p>Potret makanan untuk mengestimasi kalori & kandungan nutrisinya.</p></div>
    </div>

    <div class="grid grid-2 scan-layout">
      <div class="card scan-panel">
        <div class="card-title">📷 Foto Makanan</div>
        <div class="scan-drop" id="scan-drop">
          <input type="file" id="scan-camera-input" accept="image/*" capture="environment" hidden />
          <input type="file" id="scan-gallery-input" accept="image/*" hidden />
          <div id="scan-preview" class="scan-preview">
            <div class="scan-placeholder"><span>🍱</span><p>Kamera belum diambil</p><small>Potret makanan atau pilih dari galeri</small></div>
          </div>
        </div>
        <div class="scan-actions">
          <button class="btn btn-primary" id="scan-camera">📸 Buka Kamera</button>
          <button class="btn btn-outline" id="scan-gallery">🖼️ Galeri</button>
        </div>

        <div class="field mt-16">
          <label for="scan-hint">Petunjuk nama makanan <span class="muted-text">(opsional, membantu AI mengenali)</span></label>
          <input class="input" id="scan-hint" maxlength="200" placeholder="Contoh: nasi goreng, kopi, pisang goreng" value="${esc(scanState.hint)}" />
        </div>
        <div class="form-row">
          <div class="field">
            <label for="scan-food">Jenis makanan <span class="muted-text">(bisa dikoreksi)</span></label>
            <select class="select" id="scan-food"><option value="">Mencari daftar makanan...</option></select>
          </div>
          <div class="field">
            <label for="scan-porsi">Estimasi porsi</label>
            <select class="select" id="scan-porsi">
              <option value="kecil">Kecil</option>
              <option value="sedang" selected>Sedang</option>
              <option value="besar">Besar</option>
            </select>
          </div>
        </div>
        <div id="scan-candidates" class="scan-candidates"></div>
        <button class="btn btn-success btn-block btn-lg mt-12" id="scan-submit">🔍 Hitung Estimasi Gizi</button>
        <p class="note-text mt-12">⚠️ Hasil adalah <b>estimasi</b> berbasis basis data gizi, bukan diagnosis medis. Koreksi jenis & porsi makanan agar lebih akurat.</p>
      </div>

      <div>
        <div class="card" id="scan-result"></div>
        <div class="card mt-16" id="scan-history"></div>
      </div>
    </div>`;

  $('#scan-porsi').value = scanState.porsi;

  await loadScanFoods('');
  renderScanResult();
  await loadScanHistory();

  const cam = $('#scan-camera');
  const gal = $('#scan-gallery');
  const camInput = $('#scan-camera-input');
  const galInput = $('#scan-gallery-input');

  $('#scan-drop').addEventListener('click', () => galInput.click());
  cam.addEventListener('click', (e) => { e.stopPropagation(); camInput.click(); });
  gal.addEventListener('click', (e) => { e.stopPropagation(); galInput.click(); });
  camInput.addEventListener('change', (e) => pilihFoto(e.target.files[0]));
  galInput.addEventListener('change', (e) => pilihFoto(e.target.files[0]));

  $('#scan-hint').addEventListener('input', (e) => {
    scanState.hint = e.target.value;
    loadScanFoods(scanState.hint);
  });
  $('#scan-food').addEventListener('change', (e) => {
    scanState.foodId = e.target.value ? Number(e.target.value) : null;
  });
  $('#scan-porsi').addEventListener('change', (e) => { scanState.porsi = e.target.value; });
  $('#scan-submit').addEventListener('click', simpanScan);

  $('#scan-history').addEventListener('click', (e) => {
    if (e.target.closest('[data-hapus-scan]')) {
      hapusScan(Number(e.target.closest('[data-hapus-scan]').dataset.hapusScan));
    }
  });
}

async function loadScanFoods(q) {
  try {
    const data = await api(`/api/nutrition/foods?q=${encodeURIComponent(q || '')}`);
    scanState.foods = data.data;
    const select = $('#scan-food');
    if (!select) return;
    const prev = scanState.foodId;
    select.innerHTML = `<option value="">-- Pilih makanan --</option>` +
      scanState.foods.map((f) => `<option value="${f.id}">${f.emoji || '🍽️'} ${esc(f.nama)}</option>`).join('');
    if (prev && scanState.foods.some((f) => f.id === prev)) select.value = String(prev);
    else { scanState.foodId = null; }
  } catch (e) {
    if ($('#scan-food')) $('#scan-food').innerHTML = `<option value="">Gagal memuat daftar makanan</option>`;
  }
}

async function pilihFoto(file) {
  if (!file) return;
  try {
    toast('Memproses foto...', 'info');
    scanState.gambar = await compressImage(file, 900, 0.75);
    scanState.hint = file.name || '';
    $('#scan-hint').value = scanState.hint;
    $('#scan-preview').innerHTML = `<img src="${scanState.gambar}" alt="Pratinjau makanan" />`;

    // AI lokal: cocokkan nama file ke basis data gizi
    const data = await api('/api/nutrition/analyze', {
      method: 'POST',
      body: { hint: scanState.hint, porsi: scanState.porsi },
    });
    const hasil = data.data;
    scanState.kandidat = hasil.kandidat || [];
    renderCandidates();

    if (hasil.dikenali && hasil.food_id) {
      scanState.foodId = hasil.food_id;
      await loadScanFoods(scanState.hint);
      $('#scan-food').value = String(hasil.food_id);
      $('#scan-porsi').value = hasil.porsi || scanState.porsi;
      toast(`Kemungkinan: ${hasil.makanan} (${Math.round(hasil.confidence * 100)}%)`, 'success');
    } else {
      await loadScanFoods(scanState.hint);
      toast('Foto siap. Pilih jenis makanan untuk melanjutkan.', 'info');
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderCandidates() {
  const box = $('#scan-candidates');
  if (!box) return;
  if (!scanState.kandidat.length) { box.innerHTML = ''; return; }
  box.innerHTML = `
    <div class="label mt-12">Kemungkinan dikenali AI:</div>
    <div class="filter-chips">
      ${scanState.kandidat.slice(0, 4).map((f) => `
        <button class="filter-chip ${scanState.foodId === f.id ? 'active' : ''}" data-candidate="${f.id}">
          ${f.emoji || '🍽️'} ${esc(f.nama)}
        </button>`).join('')}
    </div>`;
  box.querySelectorAll('[data-candidate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      scanState.foodId = Number(btn.dataset.candidate);
      $('#scan-food').value = String(scanState.foodId);
      box.querySelectorAll('[data-candidate]').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
}

async function simpanScan() {
  const btn = $('#scan-submit');
  if (!scanState.foodId && !scanState.hint.trim()) {
    toast('Ambil foto atau pilih jenis makanan terlebih dahulu', 'warning');
    return;
  }
  try {
    btn.disabled = true;
    btn.textContent = '⏳ Menganalisis...';
    const data = await api('/api/nutrition/scan', {
      method: 'POST',
      body: {
        gambar: scanState.gambar,
        hint: scanState.hint,
        food_id: scanState.foodId,
        porsi: scanState.porsi,
      },
    });
    scanState.hasil = data.data;
    renderScanResult();
    toast(data.message, 'success');
    await loadScanHistory();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Hitung Estimasi Gizi';
  }
}

function renderScanResult() {
  const box = $('#scan-result');
  if (!box) return;
  const r = scanState.hasil;
  if (!r) {
    box.innerHTML = `
      <div class="card-title">📊 Hasil Estimasi Gizi</div>
      <div class="empty-state"><div class="big">🥗</div><p>Silakan potret makanan untuk melihat estimasi kalori & nutrisinya.</p></div>`;
    return;
  }
  box.innerHTML = `
    <div class="card-title">📊 Hasil Estimasi Gizi <span class="badge badge-green">AI</span></div>
    <div class="nutri-hero">
      <div class="nutri-hero-emoji">${esc(r.emoji || '🍽️')}</div>
      <div>
        <div class="nutri-food">${esc(r.nama_makanan)}</div>
        <div class="nutri-sub">Porsi ${esc(r.porsi)} · ±${fmtNum(r.porsi_gram)} g</div>
      </div>
      <div class="nutri-kcal"><strong>${fmtNum(r.kalori)}</strong><small>kkal</small></div>
    </div>
    <div class="grid grid-2 nutri-macros">
      <div class="macro macro-protein"><span>Protein</span><strong>${fmtNum(r.protein)} g</strong></div>
      <div class="macro macro-carbo"><span>Karbohidrat</span><strong>${fmtNum(r.karbo)} g</strong></div>
      <div class="macro macro-fat"><span>Lemak</span><strong>${fmtNum(r.lemak)} g</strong></div>
      <div class="macro macro-portion"><span>Porsi</span><strong>±${fmtNum(r.porsi_gram)} g</strong></div>
    </div>
    <div class="nutri-meta">
      <span class="badge badge-cyan">${esc(r.sumber || '-')}</span>
      ${r.confidence != null ? `<span class="muted-text">Tingkat keyakinan: ${Math.round(Number(r.confidence) * 100)}%</span>` : ''}
    </div>`;
}

async function loadScanHistory() {
  const box = $('#scan-history');
  if (!box) return;
  box.innerHTML = `<div class="empty-state"><div class="big">⏳</div><p>Memuat riwayat...</p></div>`;
  try {
    const data = await api(`/api/nutrition/history?tanggal=${encodeURIComponent(scanState.tanggal)}`);
    const rows = data.data;
    const t = data.total;
    const trend = data.trend || [];
    const maxTrend = Math.max(1, ...trend.map((x) => Number(x.kalori)));

    box.innerHTML = `
      <div class="flex-between mb-16">
        <div class="card-title" style="margin:0">📅 Riwayat Konsumsi</div>
        <input type="date" class="input" id="scan-tanggal" value="${esc(scanState.tanggal)}" style="width:auto" />
      </div>
      <div class="grid grid-4 nutri-totals">
        <div class="nutri-total"><span>Makanan</span><strong>${fmtNum(t.jumlah)}</strong></div>
        <div class="nutri-total"><span>Total kalori</span><strong>${fmtNum(t.kalori)} kkal</strong></div>
        <div class="nutri-total"><span>Protein</span><strong>${fmtNum(t.protein)} g</strong></div>
        <div class="nutri-total"><span>Karbo / Lemak</span><strong>${fmtNum(t.karbo)} / ${fmtNum(t.lemak)} g</strong></div>
      </div>
      ${trend.length ? `
        <div class="label mt-16">Tren 7 hari terakhir</div>
        <div class="nutri-trend">
          ${trend.map((x) => `<div class="nutri-trend-col">
            <div class="nutri-trend-bar" style="height:${Math.max(8, Math.round((Number(x.kalori) / maxTrend) * 80))}px"></div>
            <small>${esc(String(x.tanggal).slice(5))}</small>
          </div>`).join('')}
        </div>` : ''}
      ${rows.length ? `
        <div class="table-scroll mt-16">
          <table class="table">
            <thead><tr><th>Foto</th><th>Makanan</th><th>Porsi</th><th>Kalori</th><th>Waktu</th><th></th></tr></thead>
            <tbody>
              ${rows.map((r) => `<tr>
                <td>${r.gambar ? `<img class="scan-thumb" src="${r.gambar}" alt="Foto makanan" />` : '🍽️'}</td>
                <td><b>${esc(r.nama_makanan)}</b></td>
                <td>${esc(r.porsi)} · ${fmtNum(r.porsi_gram)} g</td>
                <td><b>${fmtNum(r.kalori)}</b> kkal</td>
                <td>${esc(fmtTime(r.created_at))}</td>
                <td><button class="btn btn-danger btn-sm" data-hapus-scan="${r.id}">Hapus</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : emptyHTML('Belum ada konsumsi tercatat pada tanggal ini.', '📭')}`;

    $('#scan-tanggal').addEventListener('change', (e) => {
      scanState.tanggal = e.target.value || todayStr();
      loadScanHistory();
    });
  } catch (e) {
    box.innerHTML = emptyHTML(e.message, '⚠️');
  }
}

async function hapusScan(id) {
  if (!confirm('Hapus riwayat konsumsi ini?')) return;
  try {
    const data = await api(`/api/nutrition/history/${id}`, { method: 'DELETE' });
    toast(data.message, 'success');
    await loadScanHistory();
  } catch (e) {
    toast(e.message, 'error');
  }
}

window.renderNutrition = renderNutrition;
