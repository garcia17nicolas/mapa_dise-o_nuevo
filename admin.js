// admin.js - Dashboard administrativo para municipios
const API_BASE = 'http://localhost:3000/api';

const municipioSelect = document.getElementById('municipioSelect');
const newMunicipioBtn = document.getElementById('newMunicipioBtn');
const entryForm = document.getElementById('entryForm');
const deptInput = document.getElementById('deptInput');
const yearInput = document.getElementById('yearInput');
const textInput = document.getElementById('textInput');
const fileInput = document.getElementById('fileInput');
const publishedCheckbox = document.getElementById('publishedCheckbox');
const cancelBtn = document.getElementById('cancelBtn');
const entriesList = document.getElementById('entriesList');
const alertDiv = document.getElementById('alert');

let editingId = null;
let currentDept = null;

// Mostrar alerta
function showAlert(msg, type = 'success') {
  alertDiv.innerHTML = `<div class="alert ${type}">${msg}</div>`;
  setTimeout(() => { alertDiv.innerHTML = ''; }, 4000);
}

// Cargar lista de municipios
async function loadMunicipios() {
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
  } catch (err) {
    console.error('Error cargando municipios:', err);
  }
}

// Cargar entradas del municipio seleccionado
async function loadEntries() {
  const dept = municipioSelect.value;
  if (!dept) { entriesList.innerHTML = '<p class="no-entries">Selecciona un municipio</p>'; return; }

  currentDept = dept;
  try {
    const res = await fetch(`${API_BASE}/admin/municipio/${encodeURIComponent(dept)}`);
    const entries = await res.json();
    
    entriesList.innerHTML = '';
    if (entries.length === 0) { entriesList.innerHTML = '<p class="no-entries">Sin entradas</p>'; return; }

    entries.forEach(e => {
      const el = document.createElement('div');
      el.className = 'entry';
      const badge = e.published ? '<span class="badge published">✓ Publicado</span>' : '<span class="badge draft">📋 Borrador</span>';
      el.innerHTML = `
        <div class="entry-header">
          <div>
            <div class="entry-title">Año ${e.year} ${badge}</div>
            <div class="entry-meta">Creado: ${new Date(e.createdAt).toLocaleDateString('es-ES')}</div>
          </div>
          <div class="entry-buttons">
            <button type="button" class="publish" onclick="togglePublish(${e.id})">
              ${e.published ? '👁️ Despu.' : '👁️ Pub.'}
            </button>
            <button type="button" onclick="editEntry(${e.id})">✏️ Editar</button>
            <button type="button" class="danger" onclick="deleteEntry(${e.id})">🗑️ Eliminar</button>
          </div>
        </div>
        <div class="entry-text">${e.text.replace(/\n/g, '<br>')}</div>
        ${e.fileName ? `<div><small>📎 Archivo: ${e.fileName}</small></div>` : ''}
      `;
      entriesList.appendChild(el);
    });
  } catch (err) {
    console.error('Error cargando entradas:', err);
    showAlert('Error al cargar entradas', 'error');
  }
}

// Editar entrada
async function editEntry(entryId) {
  const dept = municipioSelect.value;
  try {
    const res = await fetch(`${API_BASE}/admin/municipio/${encodeURIComponent(dept)}`);
    const entries = await res.json();
    const entry = entries.find(e => e.id === entryId);
    
    if (!entry) return;

    yearInput.value = entry.year;
    textInput.value = entry.text;
    publishedCheckbox.checked = entry.published;
    editingId = entryId;
    entryForm.style.display = 'block';
    yearInput.focus();
  } catch (err) {
    console.error('Error editando:', err);
  }
}

// Cambiar estado de publicación
async function togglePublish(entryId) {
  const dept = municipioSelect.value;
  try {
    const res = await fetch(`${API_BASE}/admin/municipio/${encodeURIComponent(dept)}`);
    const entries = await res.json();
    const entry = entries.find(e => e.id === entryId);
    
    if (!entry) return;

    const update = await fetch(
      `${API_BASE}/admin/municipio/${encodeURIComponent(dept)}/${entryId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, published: !entry.published })
      }
    );
    
    if (update.ok) {
      showAlert(entry.published ? 'Entrada despublicada' : 'Entrada publicada');
      loadEntries();
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

// Eliminar entrada
async function deleteEntry(entryId) {
  if (!confirm('¿Eliminar esta entrada?')) return;
  
  const dept = municipioSelect.value;
  try {
    const res = await fetch(
      `${API_BASE}/admin/municipio/${encodeURIComponent(dept)}/${entryId}`,
      { method: 'DELETE' }
    );
    
    if (res.ok) {
      showAlert('Entrada eliminada');
      loadEntries();
    }
  } catch (err) {
    console.error('Error eliminando:', err);
    showAlert('Error al eliminar', 'error');
  }
}

// Enviar formulario
entryForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const dept = municipioSelect.value;
  const year = Number(yearInput.value);
  const text = textInput.value.trim();
  
  if (!text) { showAlert('Escriba una descripción', 'error'); return; }

  let fileData = null, fileName = null;
  const file = fileInput.files?.[0];
  if (file) {
    fileName = file.name;
    fileData = await readFileAsDataURL(file);
  }

  try {
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId 
      ? `${API_BASE}/admin/municipio/${encodeURIComponent(dept)}/${editingId}`
      : `${API_BASE}/admin/municipio/${encodeURIComponent(dept)}`;

    const body = { year, text, fileName, fileData, published: publishedCheckbox.checked };

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
      showAlert('Error al guardar', 'error');
    }
  } catch (err) {
    console.error('Error:', err);
    showAlert('Error al guardar', 'error');
  }
});

function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
}

function resetForm() {
  entryForm.reset();
  entryForm.style.display = 'none';
  editingId = null;
  publishedCheckbox.checked = false;
}

// Botones
municipioSelect.addEventListener('change', loadEntries);
cancelBtn.addEventListener('click', resetForm);
newMunicipioBtn.addEventListener('click', () => {
  const nuevoDept = prompt('Nombre del nuevo municipio:');
  if (nuevoDept) {
    municipioSelect.value = nuevoDept;
    currentDept = nuevoDept;
    deptInput.value = nuevoDept;
    entryForm.style.display = 'block';
    yearInput.value = new Date().getFullYear();
    textInput.focus();
  }
});

// Inicializar
loadMunicipios();
