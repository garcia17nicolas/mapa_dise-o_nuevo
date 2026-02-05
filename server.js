const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

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

// ===== API ENDPOINTS =====

// GET: obtener todas las entradas de un municipio (solo publicadas)
app.get('/api/municipio/:dept', (req, res) => {
  const dept = decodeURIComponent(req.params.dept);
  const data = loadData();
  const entries = data[dept] || [];
  // Filtrar solo publicadas
  const published = entries.filter(e => e.published === true);
  res.json(published);
});

// GET: obtener todas las entradas de un municipio (admin - todas)
app.get('/api/admin/municipio/:dept', (req, res) => {
  const dept = decodeURIComponent(req.params.dept);
  const data = loadData();
  const entries = data[dept] || [];
  res.json(entries);
});

// POST: guardar una entrada (admin)
app.post('/api/admin/municipio/:dept', (req, res) => {
  const dept = decodeURIComponent(req.params.dept);
  const { year, text, fileName, fileData, published } = req.body;

  if (!year || !text) {
    return res.status(400).json({ error: 'Año y descripción son requeridos' });
  }

  const data = loadData();
  if (!data[dept]) data[dept] = [];

  const entry = {
    id: Date.now(),
    year,
    text,
    fileName,
    fileData,
    published: published || false,
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
  const { year, text, fileName, fileData, published } = req.body;

  const data = loadData();
  if (!data[dept]) {
    return res.status(404).json({ error: 'Municipio no encontrado' });
  }

  const entry = data[dept].find(e => e.id === entryId);
  if (!entry) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }

  entry.year = year || entry.year;
  entry.text = text || entry.text;
  entry.fileName = fileName !== undefined ? fileName : entry.fileName;
  entry.fileData = fileData !== undefined ? fileData : entry.fileData;
  entry.published = published !== undefined ? published : entry.published;

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
