// municipio.js - Lee datos publicados desde la API (público)
const API_BASE = 'http://localhost:3000/api';
const MIN_YEAR = 2000;

(function(){
  function qs(key){
    const params = new URLSearchParams(location.search);
    return params.get(key);
  }

  const dept = qs('dept') || 'Desconocido';
  const title = document.getElementById('title');
  if(title) title.textContent = `Municipio: ${dept}`;

  const form = document.getElementById('infoForm');
  const filterYear = document.getElementById('filterYear');
  const clearFilter = document.getElementById('clearFilter');
  const entriesDiv = document.getElementById('entries');

  if(form) form.style.display = 'none';

  document.title = `${dept} - Nasa Kiwe`;

  function escapeHtml(s){ 
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;'); 
  }

  function normalizeEntry(entry) {
    const safe = entry || {};

    const documents = Array.isArray(safe.documents)
      ? safe.documents.filter(d => d && d.name && d.data)
      : (safe.fileName && safe.fileData ? [{
          name: safe.fileName,
          data: safe.fileData,
          mimeType: String(safe.fileData).split(';')[0].replace('data:', '') || 'application/octet-stream'
        }] : []);

    const photos = Array.isArray(safe.photos)
      ? safe.photos.filter(p => p && p.name && p.data)
      : [];

    return {
      ...safe,
      year: Number(safe.year) || MIN_YEAR,
      text: String(safe.text || ''),
      documents,
      photos
    };
  }

  function renderEntry(entry) {
    const el = document.createElement('article');
    el.className = 'entry';

    const docsHtml = entry.documents.length
      ? `<div class="docs">${entry.documents.map(d => {
          const safeName = escapeHtml(d.name);
          return `<a href="${d.data}" download="${safeName}">📎 ${safeName}</a>`;
        }).join('')}</div>`
      : '<p class="empty">Sin documentos adjuntos.</p>';

    const photosHtml = entry.photos.length
      ? `<div class="photo-grid">${entry.photos.map(p => {
          const safeName = escapeHtml(p.name);
          return `<a href="${p.data}" target="_blank" rel="noopener"><img src="${p.data}" alt="${safeName}"></a>`;
        }).join('')}</div>`
      : '<p class="empty">Sin fotos cargadas.</p>';

    el.innerHTML = `
      <h4>Año ${entry.year}</h4>
      <p>${escapeHtml(entry.text).replace(/\n/g, '<br>')}</p>
      <div style="margin-top:10px;"><strong>Documentos</strong></div>
      ${docsHtml}
      <div style="margin-top:12px;"><strong>Fotos</strong></div>
      ${photosHtml}
    `;

    return el;
  }

  async function loadAndRender(year) {
    if (!entriesDiv) return;
    try {
      const res = await fetch(`${API_BASE}/municipio/${encodeURIComponent(dept)}`);
      const entries = (await res.json()).map(normalizeEntry).sort((a, b) => Number(b.year) - Number(a.year));
      
      entriesDiv.innerHTML = '';
      const filtered = year ? entries.filter(e => String(e.year) === String(year)) : entries;
      
      if (filtered.length === 0) { 
        entriesDiv.innerHTML = '<p class="empty">No hay información disponible para este filtro.</p>'; 
        return; 
      }
      
      filtered.forEach(e => {
        entriesDiv.appendChild(renderEntry(e));
      });
    } catch (err) {
      console.error('Error cargando datos:', err);
      entriesDiv.innerHTML = '<p style="color:red;">Error al cargar información.</p>';
    }
  }

  function populateYearFilter(){
    if (!filterYear) return;
    fetch(`${API_BASE}/municipio/${encodeURIComponent(dept)}`)
      .then(res => res.json())
      .then(entries => {
        const years = new Set(entries.map(e => Number(e.year)).filter(y => Number.isInteger(y) && y >= MIN_YEAR));
        const now = new Date().getFullYear();
        for (let y = now; y >= MIN_YEAR; y--) { years.add(y); }
        const arr = Array.from(years).sort((a, b) => b - a);
        filterYear.innerHTML = '<option value="">-- Todos los años --</option>' + arr.map(y => `<option value="${y}">${y}</option>`).join('');
      })
      .catch(err => console.error('Error cargando años:', err));
  }

  if (filterYear) filterYear.addEventListener('change', () => loadAndRender(filterYear.value || null));
  if (clearFilter) clearFilter.addEventListener('click', () => { if (filterYear) filterYear.value = ''; loadAndRender(null); });

  // Inicializar
  console.log('✅ Vista pública del municipio:', dept);
  populateYearFilter();
  loadAndRender(null);

})();
