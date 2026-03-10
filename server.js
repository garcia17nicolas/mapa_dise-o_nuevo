const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const MIN_YEAR = 2000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname)); // Servir archivos estáticos

// Ruta del archivo de datos
const dataFile = path.join(__dirname, 'data.json');

// Funciones auxiliares para leer/escribir JSON
function loadData() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error al leer data.json:', err);
  }
  return {};
}

function saveData(data) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error al guardar data.json:', err);
    return false;
  }
}

function normalizeMediaList(items, onlyImages = false) {
  if (!Array.isArray(items)) return [];

  return items
    .map(item => ({
      name: String(item?.name || '').trim(),
      mimeType: String(item?.mimeType || ''),
      data: String(item?.data || '')
    }))
    .filter(item => {
      if (!item.name || !item.data.startsWith('data:')) return false;
      if (onlyImages) return item.data.startsWith('data:image/');
      return true;
    });
}

function normalizeStoredEntry(entry) {
  const safe = entry || {};

  const documents = Array.isArray(safe.documents)
    ? normalizeMediaList(safe.documents, false)
    : (safe.fileName && safe.fileData ? [{
        name: String(safe.fileName),
        mimeType: String(safe.fileData).split(';')[0].replace('data:', '') || 'application/octet-stream',
        data: String(safe.fileData)
      }] : []);

  const photos = Array.isArray(safe.photos)
    ? normalizeMediaList(safe.photos, true)
    : [];

  return {
    ...safe,
    year: Number(safe.year),
    text: String(safe.text || ''),
    documents,
    photos,
    fileName: documents[0]?.name || null,
    fileData: documents[0]?.data || null,
    published: !!safe.published
  };
}

function buildEntryPayload(body, existingEntry) {
  const rawYear = body.year !== undefined ? body.year : existingEntry?.year;
  const year = Number(rawYear);
  const text = String(body.text !== undefined ? body.text : (existingEntry?.text || '')).trim();

  if (!Number.isInteger(year) || year < MIN_YEAR || year > 2100) {
    return { error: `El año debe ser un número entre ${MIN_YEAR} y 2100` };
  }

  if (!text) {
    return { error: 'Año y descripción son requeridos' };
  }

  let documents;
  if (Array.isArray(body.documents)) {
    documents = normalizeMediaList(body.documents, false);
  } else if (body.fileName && body.fileData) {
    documents = normalizeMediaList([
      {
        name: body.fileName,
        mimeType: String(body.fileData).split(';')[0].replace('data:', '') || 'application/octet-stream',
        data: body.fileData
      }
    ], false);
  } else {
    documents = normalizeStoredEntry(existingEntry).documents;
  }

  const photos = Array.isArray(body.photos)
    ? normalizeMediaList(body.photos, true)
    : normalizeStoredEntry(existingEntry).photos;

  return {
    payload: {
      year,
      text,
      documents,
      photos,
      fileName: documents[0]?.name || null,
      fileData: documents[0]?.data || null,
      published: body.published !== undefined ? !!body.published : !!existingEntry?.published
    }
  };
}

// ===== API ENDPOINTS =====

// GET: obtener todas las entradas de un municipio (solo publicadas)
app.get('/api/municipio/:dept', (req, res) => {
  const dept = decodeURIComponent(req.params.dept);
  const data = loadData();
  const entries = (data[dept] || []).map(normalizeStoredEntry);
  // Filtrar solo publicadas
  const published = entries.filter(e => e.published === true);
  res.json(published);
});

// GET: obtener todas las entradas de un municipio (admin - todas)
app.get('/api/admin/municipio/:dept', (req, res) => {
  const dept = decodeURIComponent(req.params.dept);
  const data = loadData();
  const entries = (data[dept] || []).map(normalizeStoredEntry);
  res.json(entries);
});

// POST: guardar una entrada (admin)
app.post('/api/admin/municipio/:dept', (req, res) => {
  const dept = decodeURIComponent(req.params.dept);
  const built = buildEntryPayload(req.body, {});

  if (built.error) {
    return res.status(400).json({ error: built.error });
  }

  const data = loadData();
  if (!data[dept]) data[dept] = [];

  const entry = {
    id: Date.now(),
    ...built.payload,
    createdAt: new Date().toISOString()
  };

  data[dept].push(entry);
  if (saveData(data)) {
    res.json({ success: true, entry });
  } else {
    res.status(500).json({ error: 'Error al guardar' });
  }
});

// PUT: actualizar una entrada (admin)
app.put('/api/admin/municipio/:dept/:id', (req, res) => {
  const dept = decodeURIComponent(req.params.dept);
  const entryId = Number(req.params.id);

  const data = loadData();
  if (!data[dept]) {
    return res.status(404).json({ error: 'Municipio no encontrado' });
  }

  const entry = data[dept].find(e => e.id === entryId);
  if (!entry) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }

  const built = buildEntryPayload(req.body, entry);
  if (built.error) {
    return res.status(400).json({ error: built.error });
  }

  entry.year = built.payload.year;
  entry.text = built.payload.text;
  entry.documents = built.payload.documents;
  entry.photos = built.payload.photos;
  entry.fileName = built.payload.fileName;
  entry.fileData = built.payload.fileData;
  entry.published = built.payload.published;

  if (saveData(data)) {
    res.json({ success: true, entry });
  } else {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// DELETE: eliminar una entrada (admin)
app.delete('/api/admin/municipio/:dept/:id', (req, res) => {
  const dept = decodeURIComponent(req.params.dept);
  const entryId = Number(req.params.id);

  const data = loadData();
  if (!data[dept]) {
    return res.status(404).json({ error: 'Municipio no encontrado' });
  }

  data[dept] = data[dept].filter(e => e.id !== entryId);
  if (saveData(data)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// GET: obtener lista de todos los municipios
app.get('/api/municipios', (req, res) => {
  const data = loadData();
  const municipios = Object.keys(data);
  res.json(municipios);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📍 Abre http://localhost:${PORT} en tu navegador`);
  console.log(`🛠️  Dashboard admin: http://localhost:${PORT}/admin.html`);
});
