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

    // Color por estado
    const colorEstado = {
      'En ejecución': '#2563eb', 'Terminado': '#16a34a',
      'Suspendido':   '#dc2626', 'En planeación': '#9333ea'
    };
    const col = colorEstado[entry.estado] || '#6b7280';
    const pct = entry.porcentaje_avance ?? 0;

    // Nombre del proyecto (usa nombre_proyecto o text como fallback)
    const nombre = entry.nombre_proyecto || entry.text || 'Proyecto sin nombre';

    // Barra de progreso
    const barraHtml = `
      <div style="margin:10px 0;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span style="color:#6b7280;">Avance de la obra</span>
          <strong style="color:${col};">${pct}%</strong>
        </div>
        <div style="height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${col};border-radius:5px;transition:width .4s;"></div>
        </div>
      </div>`;

    // Tabla de datos clave
    const filas = [
      ['🔧 Tipo de obra',    entry.tipo_obra          || '—'],
      ['🏢 Contratista',     entry.contratista         || '—'],
      ['💰 Inversión',       entry.valor_contrato
        ? '$' + Number(entry.valor_contrato).toLocaleString('es-CO')
        : '—'],
      ['📅 Fecha de inicio', entry.fecha_inicio         || '—'],
      ['🏁 Fin estimado',    entry.fecha_fin_estimada   || '—'],
    ];
    const tablaHtml = `
      <div style="background:#f8f9fa;border-radius:8px;padding:10px 14px;margin:10px 0;">
        ${filas.map(([k,v]) => `
          <div style="display:flex;justify-content:space-between;padding:5px 0;
            border-bottom:0.5px solid #e5e7eb;font-size:13px;">
            <span style="color:#6b7280;">${k}</span>
            <span style="font-weight:500;color:#111;text-align:right;max-width:60%;">${escapeHtml(v)}</span>
          </div>`).join('')}
      </div>`;

    // Fotos
    const fotosHtml = (entry.photos || []).length
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:10px;">
          ${entry.photos.map(p =>
            `<a href="${p.data}" target="_blank" rel="noopener">
              <img src="${p.data}" alt="${escapeHtml(p.name)}"
                style="width:100%;height:100px;object-fit:cover;border-radius:8px;
                  border:0.5px solid #e5e7eb;display:block;">
            </a>`
          ).join('')}
        </div>` : '';

    // Documentos
    const docsHtml = (entry.documents || []).length
      ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
          ${entry.documents.map(d =>
            `<a href="${d.data}" download="${escapeHtml(d.name)}"
              style="font-size:12px;color:#2563eb;text-decoration:none;
                padding:4px 10px;border:0.5px solid #bfdbfe;border-radius:6px;
                background:#eff6ff;display:inline-flex;align-items:center;gap:4px;">
              📎 ${escapeHtml(d.name)}
            </a>`
          ).join('')}
        </div>` : '';

    // Descripción adicional
    const descHtml = entry.text && entry.text !== nombre
      ? `<p style="font-size:13px;color:#6b7280;margin:8px 0;line-height:1.6;">
          ${escapeHtml(entry.text).replace(/\n/g,'<br>')}
        </p>` : '';

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <h4 style="font-size:17px;color:#1e3a5f;margin:0;flex:1;">${escapeHtml(nombre)}</h4>
        <span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;
          background:${col}20;color:${col};white-space:nowrap;flex-shrink:0;">
          ${escapeHtml(entry.estado || 'Sin estado')}
        </span>
      </div>
      <div style="font-size:12px;color:#9ca3af;margin-top:4px;">Año ${entry.year}</div>
      ${barraHtml}
      ${tablaHtml}
      ${descHtml}
      ${fotosHtml}
      ${docsHtml}
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
