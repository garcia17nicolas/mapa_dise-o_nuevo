// admin.js - Dashboard administrativo para municipios
const API_BASE = 'http://localhost:3000/api';
const MIN_YEAR = 2000;

// ═══════════════════════════════════════════════════════════════════
// ✅ VERIFICACIÓN DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════

function checkAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token || !user) {
    // Redirigir a login
    window.location.href = 'login.html';
    return false;
  }

  return { token, user };
}

// Verificar autenticación al cargar
const auth = checkAuth();
if (!auth) throw new Error('No autenticado');

// Mostrar información del usuario
document.getElementById('userInfo').textContent = auth.user.username;

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  }
});

// Función helper para hacer fetch con token
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
}

const municipioSelect = document.getElementById('municipioSelect');
const newEntryBtn = document.getElementById('newEntryBtn');
const newMunicipioBtn = document.getElementById('newMunicipioBtn');
const entryForm = document.getElementById('entryForm');
const deptInput = document.getElementById('deptInput');
const yearInput = document.getElementById('yearInput');
const textInput = document.getElementById('textInput');
const documentsInput = document.getElementById('documentsInput');
const photosInput = document.getElementById('photosInput');
const editAttachmentsInfo = document.getElementById('editAttachmentsInfo');
const publishedCheckbox = document.getElementById('publishedCheckbox');
const cancelBtn = document.getElementById('cancelBtn');
const entriesList = document.getElementById('entriesList');
const alertDiv = document.getElementById('alert');

// ── Campos viales nuevos ────────────────────────────────────────────────────
const nombreProyectoInput = document.getElementById('nombreProyectoInput');
const tipoObraInput       = document.getElementById('tipoObraInput');
const estadoInput         = document.getElementById('estadoInput');
const avanceInput         = document.getElementById('avanceInput');
const avanceLabel         = document.getElementById('avanceLabel');
const contratistaInput    = document.getElementById('contratistaInput');
const valorInput          = document.getElementById('valorInput');
const fechaInicioInput    = document.getElementById('fechaInicioInput');
const fechaFinInput       = document.getElementById('fechaFinInput');

let editingId = null;
let editingEntry = null;

function showAlert(msg, type = 'success') {
  alertDiv.innerHTML = `<div class="alert ${type}">${msg}</div>`;
  setTimeout(() => {
    alertDiv.innerHTML = '';
  }, 4000);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    published: !!safe.published,
    documents,
    photos
  };
}

function getSelectedDept() {
  return (municipioSelect.value || '').trim();
}

async function loadMunicipios() {
  try {
    const res = await fetch('./municipios.geojson');
    const geojson = await res.json();
    const municipiosCauca = new Set();
    let departmentName = 'Cauca';

    if (geojson.features) {
      geojson.features.forEach(feature => {
        if (feature.properties && feature.properties.DPTO_CNMBR === 'CAUCA') {
          if (feature.properties.MPIO_CNMBR) {
            municipiosCauca.add(feature.properties.MPIO_CNMBR);
          }
          departmentName = feature.properties.DPTO_CNMBR || 'Cauca';
        }
      });
    }

    const deptNameEl = document.getElementById('departmentName');
    if (deptNameEl) {
      deptNameEl.textContent = `🗺️ ${departmentName}`;
    }

    municipioSelect.innerHTML = '<option value="">-- Selecciona un municipio --</option>';
    Array.from(municipiosCauca).sort().forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      municipioSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error cargando municipios desde GeoJSON:', err);
    try {
      const res = await fetch(`${API_BASE}/municipios`);
      const municipios = await res.json();
      municipioSelect.innerHTML = '<option value="">-- Selecciona un municipio --</option>';
      municipios.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        municipioSelect.appendChild(opt);
      });
    } catch (fallbackErr) {
      console.error('Error fallback cargando municipios:', fallbackErr);
    }
  }
}

async function loadEntries() {
  const dept = getSelectedDept();
  if (!dept) {
    entriesList.innerHTML = '<p class="no-entries">Selecciona un municipio</p>';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/municipio/${encodeURIComponent(dept)}`);
    const entries = (await res.json()).map(normalizeEntry).sort((a, b) => Number(b.year) - Number(a.year));

    entriesList.innerHTML = '';
    if (entries.length === 0) {
      entriesList.innerHTML = '<p class="no-entries">Sin entradas</p>';
      return;
    }

    entries.forEach(e => {
      const el = document.createElement('div');
      el.className = 'entry';

      const badge = e.published
        ? '<span class="badge published">✓ Publicado</span>'
        : '<span class="badge draft">📋 Borrador</span>';

      // Color por estado
      const colorEstado = {
        'En ejecución': '#2563eb', 'Terminado': '#16a34a',
        'Suspendido': '#dc2626',   'En planeación': '#9333ea'
      };
      const col = colorEstado[e.estado] || '#6b7280';
      const pct = e.porcentaje_avance ?? 0;

      // Barra de progreso
      const barraHtml = `
        <div style="margin:8px 0 4px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:3px;">
            <span style="font-weight:600;color:${col};">${e.estado || 'Sin estado'}</span>
            <span style="font-weight:700;color:${col};">${pct}%</span>
          </div>
          <div style="height:7px;background:#e5e7eb;border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${col};border-radius:4px;transition:width .3s;"></div>
          </div>
        </div>`;

      // Datos clave en línea
      const metaHtml = [
        e.nombre_proyecto    ? `<span>📋 ${escapeHtml(e.nombre_proyecto)}</span>`       : '',
        e.tipo_obra          ? `<span>🔧 ${escapeHtml(e.tipo_obra)}</span>`             : '',
        e.contratista        ? `<span>🏢 ${escapeHtml(e.contratista)}</span>`           : '',
        e.valor_contrato     ? `<span>💰 $${Number(e.valor_contrato).toLocaleString('es-CO')}</span>` : '',
        e.fecha_fin_estimada ? `<span>📅 Fin: ${e.fecha_fin_estimada}</span>`           : '',
      ].filter(Boolean).join(' · ');

      const photosPreview = e.photos.length
        ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">${
            e.photos.slice(0,4).map(p =>
              `<img src="${p.data}" alt="${escapeHtml(p.name)}"
                style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">`
            ).join('')
          }</div>`
        : '';

      el.innerHTML = `
        <div class="entry-header">
          <div style="flex:1;min-width:0;">
            <div class="entry-title">Año ${e.year} ${badge}</div>
            ${metaHtml ? `<div class="entry-meta" style="margin-top:4px;display:flex;flex-wrap:wrap;gap:6px;">${metaHtml}</div>` : ''}
          </div>
          <div class="entry-buttons">
            <button type="button" class="publish" onclick="togglePublish(${e.id})">${e.published ? '👁️ Ocultar' : '👁️ Publicar'}</button>
            <button type="button" onclick="editEntry(${e.id})">✏️ Editar</button>
            <button type="button" class="danger" onclick="deleteEntry(${e.id})">🗑️ Eliminar</button>
          </div>
        </div>
        ${barraHtml}
        ${e.text ? `<div class="entry-text" style="margin-top:6px;">${escapeHtml(e.text).replace(/\n/g,'<br>')}</div>` : ''}
        <div style="margin-top:6px;"><small>📎 ${e.documents.length} doc(s) | 🖼️ ${e.photos.length} foto(s) | Creado: ${e.createdAt ? new Date(e.createdAt).toLocaleDateString('es-ES') : 'N/D'}</small></div>
        ${photosPreview}
      `;
      entriesList.appendChild(el);
    });
  } catch (err) {
    console.error('Error cargando entradas:', err);
    showAlert('Error al cargar entradas', 'error');
  }
}

async function getEntryById(dept, entryId) {
  const res = await fetch(`${API_BASE}/admin/municipio/${encodeURIComponent(dept)}`);
  const entries = (await res.json()).map(normalizeEntry);
  return entries.find(e => Number(e.id) === Number(entryId));
}

async function editEntry(entryId) {
  const dept = getSelectedDept();
  if (!dept) return;

  try {
    const entry = await getEntryById(dept, entryId);
    if (!entry) return;

    deptInput.value = dept;
    yearInput.value = entry.year;
    textInput.value = entry.text;
    publishedCheckbox.checked = entry.published;
    editingId = entryId;
    editingEntry = entry;

    // ── Poblar campos viales ──────────────────────────────────────────────
    if (nombreProyectoInput) nombreProyectoInput.value  = entry.nombre_proyecto   || '';
    if (tipoObraInput)       tipoObraInput.value        = entry.tipo_obra         || 'Vial';
    if (estadoInput)         estadoInput.value          = entry.estado            || 'En ejecución';
    if (avanceInput) {
      avanceInput.value = entry.porcentaje_avance ?? 0;
      if (avanceLabel) avanceLabel.textContent = (entry.porcentaje_avance ?? 0) + '%';
    }
    if (contratistaInput) contratistaInput.value  = entry.contratista       || '';
    if (valorInput)       valorInput.value        = entry.valor_contrato    || '';
    if (fechaInicioInput) fechaInicioInput.value  = entry.fecha_inicio      || '';
    if (fechaFinInput)    fechaFinInput.value     = entry.fecha_fin_estimada|| '';

    entryForm.style.display = 'block';

    const docsNames = entry.documents.slice(0, 5).map(d => escapeHtml(d.name)).join(', ');
    editAttachmentsInfo.style.display = 'block';
    editAttachmentsInfo.innerHTML = `Editando entrada: ${entry.documents.length} documento(s), ${entry.photos.length} foto(s). ${docsNames ? `Documentos actuales: ${docsNames}` : ''}`;
    yearInput.focus();
  } catch (err) {
    console.error('Error editando:', err);
    showAlert('Error al abrir la entrada para editar', 'error');
  }
}

async function togglePublish(entryId) {
  const dept = getSelectedDept();
  if (!dept) return;

  try {
    const entry = await getEntryById(dept, entryId);
    if (!entry) return;

    const update = await fetch(`${API_BASE}/admin/municipio/${encodeURIComponent(dept)}/${entryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...entry,
        published: !entry.published,
        fileName: entry.documents[0]?.name || null,
        fileData: entry.documents[0]?.data || null
      })
    });

    if (update.ok) {
      showAlert(entry.published ? 'Entrada ocultada del público' : 'Entrada publicada');
      loadEntries();
    } else {
      showAlert('No se pudo cambiar el estado de publicación', 'error');
    }
  } catch (err) {
    console.error('Error publicando:', err);
    showAlert('Error al cambiar publicación', 'error');
  }
}

async function deleteEntry(entryId) {
  if (!confirm('¿Eliminar esta entrada?')) return;
  const dept = getSelectedDept();
  if (!dept) return;

  try {
    const res = await fetch(`${API_BASE}/admin/municipio/${encodeURIComponent(dept)}/${entryId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showAlert('Entrada eliminada');
      loadEntries();
    } else {
      showAlert('No se pudo eliminar la entrada', 'error');
    }
  } catch (err) {
    console.error('Error eliminando:', err);
    showAlert('Error al eliminar', 'error');
  }
}

function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
}

async function readFilesPayload(fileList) {
  const files = Array.from(fileList || []);
  const maxFileSize = 10 * 1024 * 1024;

  for (const file of files) {
    if (file.size > maxFileSize) {
      throw new Error(`El archivo "${file.name}" supera el límite de 10MB.`);
    }
  }

  return Promise.all(files.map(async file => ({
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    data: await readFileAsDataURL(file)
  })));
}

function openNewEntryForm() {
  const dept = getSelectedDept();
  if (!dept) {
    showAlert('Primero selecciona un municipio', 'error');
    return;
  }

  resetForm(false);
  deptInput.value = dept;
  yearInput.value = new Date().getFullYear();
  entryForm.style.display = 'block';
  textInput.focus();
}

function resetForm(hideForm = true) {
  entryForm.reset();
  if (hideForm) {
    entryForm.style.display = 'none';
  }
  editingId = null;
  editingEntry = null;
  publishedCheckbox.checked = false;
  editAttachmentsInfo.style.display = 'none';
  editAttachmentsInfo.textContent = '';
  // ── Limpiar campos viales ─────────────────────────────────────────────
  if (nombreProyectoInput) nombreProyectoInput.value = '';
  if (tipoObraInput)       tipoObraInput.value       = 'Vial';
  if (estadoInput)         estadoInput.value         = 'En ejecución';
  if (avanceInput) {       avanceInput.value         = 0; }
  if (avanceLabel)         avanceLabel.textContent   = '0%';
  if (contratistaInput)    contratistaInput.value    = '';
  if (valorInput)          valorInput.value          = '';
  if (fechaInicioInput)    fechaInicioInput.value    = '';
  if (fechaFinInput)       fechaFinInput.value       = '';
}

entryForm.addEventListener('submit', async ev => {
  ev.preventDefault();

  const dept = getSelectedDept();
  const year = Number(yearInput.value);
  const text = textInput.value.trim();

  if (!dept) {
    showAlert('Selecciona un municipio', 'error');
    return;
  }

  if (!Number.isInteger(year) || year < MIN_YEAR) {
    showAlert(`El año debe ser un número mayor o igual a ${MIN_YEAR}`, 'error');
    return;
  }

  if (!text) {
    showAlert('Escribe una descripción', 'error');
    return;
  }

  try {
    const uploadedDocs = await readFilesPayload(documentsInput.files);
    const uploadedPhotos = await readFilesPayload(photosInput.files);

    const documents = uploadedDocs.length
      ? uploadedDocs
      : (editingEntry?.documents || []);

    const photos = uploadedPhotos.length
      ? uploadedPhotos
      : (editingEntry?.photos || []);

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId
      ? `${API_BASE}/admin/municipio/${encodeURIComponent(dept)}/${editingId}`
      : `${API_BASE}/admin/municipio/${encodeURIComponent(dept)}`;

    const body = {
      year,
      text,
      // ── Campos viales ───────────────────────────────────────────────────
      nombre_proyecto:    nombreProyectoInput?.value.trim()  || '',
      tipo_obra:          tipoObraInput?.value               || 'Vial',
      estado:             estadoInput?.value                 || 'En ejecución',
      porcentaje_avance:  Number(avanceInput?.value)         || 0,
      contratista:        contratistaInput?.value.trim()     || '',
      valor_contrato:     Number(valorInput?.value)          || 0,
      fecha_inicio:       fechaInicioInput?.value            || '',
      fecha_fin_estimada: fechaFinInput?.value               || '',
      // ── Campos originales ───────────────────────────────────────────────
      documents,
      photos,
      fileName: documents[0]?.name || null,
      fileData: documents[0]?.data || null,
      published: publishedCheckbox.checked
    };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      showAlert(editingId ? 'Entrada actualizada' : 'Entrada guardada');
      resetForm();
      loadEntries();
      loadMunicipios();
    } else {
      const errData = await res.json().catch(() => ({}));
      showAlert(errData.error || 'Error al guardar', 'error');
    }
  } catch (err) {
    console.error('Error guardando:', err);
    showAlert(err.message || 'Error al guardar', 'error');
  }
});

municipioSelect.addEventListener('change', () => {
  const dept = getSelectedDept();
  deptInput.value = dept;
  resetForm();
  loadEntries();
});

newEntryBtn.addEventListener('click', openNewEntryForm);
cancelBtn.addEventListener('click', () => resetForm());

newMunicipioBtn.addEventListener('click', () => {
  const nuevoDept = (prompt('Nombre del nuevo municipio:') || '').trim();
  if (!nuevoDept) return;

  let existing = Array.from(municipioSelect.options).find(o => o.value.toLowerCase() === nuevoDept.toLowerCase());
  if (!existing) {
    existing = document.createElement('option');
    existing.value = nuevoDept;
    existing.textContent = nuevoDept;
    municipioSelect.appendChild(existing);
  }

  municipioSelect.value = existing.value;
  openNewEntryForm();
});

// Exponer funciones para botones inline
window.editEntry = editEntry;
window.togglePublish = togglePublish;
window.deleteEntry = deleteEntry;

loadMunicipios();
