// admin.js - Dashboard administrativo para municipios
const API_BASE = '/api';
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

// ═══════════════════════════════════════════════════════════════════
// Nota: Profile settings moved to settings.html (accessible via ⚙️ Perfil button)
// ═══════════════════════════════════════════════════════════════════

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
    entriesList.innerHTML = '<p class="no-entries">🏘️ Selecciona un municipio para ver sus entradas</p>';
    return;
  }

  try {
    const res = await fetchWithAuth(`${API_BASE}/admin/municipio/${encodeURIComponent(dept)}`);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const entries = (await res.json()).map(normalizeEntry).sort((a, b) => Number(b.year) - Number(a.year));

    entriesList.innerHTML = '';
    if (entries.length === 0) {
      entriesList.innerHTML = '<p class="no-entries">📭 No hay entradas para <strong>' + escapeHtml(dept) + '</strong>. <br><small>Crea una nueva haciendo click en "+ Nueva Entrada"</small></p>';
      return;
    }

    // Mostrar header con nombre y contador
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom:20px; padding-bottom:15px; border-bottom: 2px solid #D97373;';
    header.innerHTML = `
      <h3 style="color:#D97373; margin-bottom:8px; font-size:18px;">📍 ${escapeHtml(dept)}</h3>
      <p style="color:#666; font-size:13px; margin:0;">Total: <strong style="color:#D97373;">${entries.length}</strong> entrada${entries.length !== 1 ? 's' : ''} registrada${entries.length !== 1 ? 's' : ''}</p>
    `;
    entriesList.appendChild(header);

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
            <div class="entry-title">📋 Año ${e.year} ${badge}</div>
            ${e.nombre_proyecto ? `<div style="margin-top:6px; font-weight:600; color:#D97373; font-size:14px;">${escapeHtml(e.nombre_proyecto)}</div>` : ''}
            ${metaHtml ? `<div class="entry-meta" style="margin-top:6px; font-size:13px; color:#666;">${metaHtml}</div>` : ''}
          </div>
          <div class="entry-buttons">
            <button type="button" onclick="togglePublish(${e.id})" title="${e.published ? 'Ocultar del público' : 'Publicar al público'}">${e.published ? '👁️ Ocultar' : '👁️ Publicar'}</button>
            <button type="button" onclick="editEntry(${e.id})" title="Editar esta entrada">✏️ Editar</button>
            <button type="button" onclick="deleteEntry(${e.id})" title="Eliminar esta entrada">🗑️ Eliminar</button>
          </div>
        </div>
        ${barraHtml}
        ${e.text ? `<div class="entry-text">${escapeHtml(e.text).replace(/\n/g,'<br>')}</div>` : ''}
        <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(217,115,115,0.2); display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#999; flex-wrap:wrap; gap:10px;">
          <div>📎 ${e.documents.length} doc(s)  •  🖼️ ${e.photos.length} foto(s)</div>
          <div>${e.createdAt ? new Date(e.createdAt).toLocaleDateString('es-ES') : 'N/D'}</div>
        </div>
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
  const res = await fetchWithAuth(`${API_BASE}/admin/municipio/${encodeURIComponent(dept)}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const entries = (await res.json()).map(normalizeEntry);
  return entries.find(e => Number(e.id) === Number(entryId));
}

async function editEntry(entryId) {
  const dept = getSelectedDept();
  if (!dept) {
    showAlert('Selecciona un municipio primero', 'error');
    return;
  }

  try {
    console.log('Cargando entrada para editar:', entryId, 'en municipio:', dept);
    const entry = await getEntryById(dept, entryId);
    
    if (!entry) {
      console.error('Entrada no encontrada:', entryId);
      showAlert('Entrada no encontrada', 'error');
      return;
    }

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
    showAlert('✏️ Editando entrada - Realiza los cambios y guarda');

    const docsNames = entry.documents.slice(0, 5).map(d => escapeHtml(d.name)).join(', ');
    editAttachmentsInfo.style.display = 'block';
    editAttachmentsInfo.innerHTML = `Editando entrada: ${entry.documents.length} documento(s), ${entry.photos.length} foto(s). ${docsNames ? `Documentos actuales: ${docsNames}` : ''}`;
    yearInput.focus();
  } catch (err) {
    console.error('Error editando:', err);
    showAlert('Error al abrir la entrada para editar: ' + err.message, 'error');
  }
}

async function togglePublish(entryId) {
  const dept = getSelectedDept();
  if (!dept) {
    showAlert('Selecciona un municipio primero', 'error');
    return;
  }

  try {
    console.log('Cambiando publicación de entrada:', entryId, 'en municipio:', dept);
    const entry = await getEntryById(dept, entryId);
    
    if (!entry) {
      console.error('Entrada no encontrada:', entryId);
      showAlert('Entrada no encontrada', 'error');
      return;
    }

    const newStatus = !entry.published;
    console.log('Estado actual:', entry.published, '→ Nuevo estado:', newStatus);

    // Construir objeto minimalista para solo cambiar published
    // No incluir documents/photos directamente para evitar problemas de normalización
    const updateData = {
      year: entry.year,
      text: entry.text,
      published: newStatus,
      nombre_proyecto: entry.nombre_proyecto,
      tipo_obra: entry.tipo_obra,
      estado: entry.estado,
      porcentaje_avance: entry.porcentaje_avance,
      contratista: entry.contratista,
      valor_contrato: entry.valor_contrato,
      fecha_inicio: entry.fecha_inicio,
      fecha_fin_estimada: entry.fecha_fin_estimada
      // No enviar documents/photos para evitar que se reprocessen
    };

    console.log('Enviando actualización:', updateData);

    const update = await fetchWithAuth(`${API_BASE}/admin/municipio/${encodeURIComponent(dept)}/${entryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    console.log('Respuesta del servidor:', update.status, update.statusText);

    if (update.ok) {
      const result = await update.json();
      console.log('Actualización exitosa:', result);
      showAlert(newStatus ? '✅ Entrada publicada' : '👁️ Entrada ocultada');
      setTimeout(() => loadEntries(), 500);
    } else {
      const err = await update.json().catch(() => ({}));
      console.error('Error en respuesta:', update.status, err);
      showAlert(err.error || `Error ${update.status}: No se pudo cambiar el estado`, 'error');
    }
  } catch (err) {
    console.error('Error publicando:', err);
    showAlert('Error: ' + err.message, 'error');
  }
}

async function deleteEntry(entryId) {
  if (!confirm('¿Eliminar esta entrada definitivamente?')) return;
  
  const dept = getSelectedDept();
  if (!dept) {
    showAlert('Selecciona un municipio primero', 'error');
    return;
  }

  try {
    console.log('Eliminando entrada:', entryId, 'en municipio:', dept);
    const res = await fetchWithAuth(`${API_BASE}/admin/municipio/${encodeURIComponent(dept)}/${entryId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showAlert('✅ Entrada eliminada');
      loadEntries();
    } else {
      const err = await res.json().catch(() => ({}));
      console.error('Error en respuesta:', err);
      showAlert(err.error || 'No se pudo eliminar la entrada', 'error');
    }
  } catch (err) {
    console.error('Error eliminando:', err);
    showAlert('Error al eliminar: ' + err.message, 'error');
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

    const res = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      showAlert(editingId ? 'Entrada actualizada' : 'Entrada guardada');
      resetForm(false);
      // Reset year to current year and default estado/tipo_obra
      yearInput.value = new Date().getFullYear();
      if (tipoObraInput) tipoObraInput.value = 'Vial';
      if (estadoInput) estadoInput.value = 'En ejecución';
      if (avanceInput) avanceInput.value = 0;
      if (avanceLabel) avanceLabel.textContent = '0%';
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

// ═══════════════════════════════════════════════════════════════════
// 👥 GESTIÓN DE USUARIOS (Solo para Admin)
// ═══════════════════════════════════════════════════════════════════

if (auth.user.role === 'admin') {
  document.getElementById('usersSection').style.display = 'block';
}

document.getElementById('toggleNewUserForm').addEventListener('click', () => {
  const form = document.getElementById('newUserForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('cancelNewUserBtn').addEventListener('click', () => {
  document.getElementById('newUserForm').style.display = 'none';
  document.getElementById('newUserForm').reset();
});

document.getElementById('createUserBtn').addEventListener('click', async () => {
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  const role = document.getElementById('newUserRole').value;

  if (!username || !password) {
    showAlert('Usuario y contraseña son requeridos', 'error');
    return;
  }

  if (password.length < 4) {
    showAlert('La contraseña debe tener al menos 4 caracteres', 'error');
    return;
  }

  try {
    const res = await fetchWithAuth(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role })
    });

    if (res.ok) {
      const data = await res.json();
      showAlert(`✅ Usuario "${username}" creado exitosamente con rol ${role}`);
      document.getElementById('newUserForm').reset();
      document.getElementById('newUserForm').style.display = 'none';
      loadUsersList();
    } else {
      const err = await res.json();
      showAlert(err.error || 'Error al crear usuario', 'error');
    }
  } catch (err) {
    console.error('Error creando usuario:', err);
    showAlert('Error al crear usuario: ' + err.message, 'error');
  }
});

async function loadUsersList() {
  try {
    const res = await fetchWithAuth(`${API_BASE}/auth/users`);
    if (!res.ok) throw new Error('No autorizado');

    const users = await res.json();
    const usersList = document.getElementById('usersList');

    if (!Array.isArray(users) || users.length === 0) {
      usersList.innerHTML = '<p class="no-entries">No hay usuarios adicionales</p>';
      return;
    }

    usersList.innerHTML = '<h3 style="margin-bottom:12px;">Usuarios Existentes:</h3>';
    users.forEach(u => {
      const div = document.createElement('div');
      div.className = 'entry';
      div.style.background = u.role === 'admin' ? '#fef3c7' : '#f3f4f6';
      
      const roleEmoji = {
        'admin': '🔑', 'editor': '✏️', 'revisor': '👁️'
      };

      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${escapeHtml(u.username)}</strong>
            <span class="badge ${u.role === 'admin' ? 'published' : 'draft'}" style="margin-left:8px;">
              ${roleEmoji[u.role] || '•'} ${u.role}
            </span>
          </div>
          <small style="color:#666;">Creado: ${new Date(u.createdAt).toLocaleDateString()}</small>
        </div>
      `;
      usersList.appendChild(div);
    });
  } catch (err) {
    console.error('Error cargando usuarios:', err);
  }
}

loadMunicipios();
loadUsersList();

// Auto-seleccionar y cargar el primer municipio si hay
setTimeout(() => {
  if (municipioSelect.options.length > 1) {
    municipioSelect.selectedIndex = 1; // El índice 0 es "-- Selecciona un municipio --"
    municipioSelect.dispatchEvent(new Event('change'));
  }
}, 500);
