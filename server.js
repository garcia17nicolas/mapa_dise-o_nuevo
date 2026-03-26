const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MIN_YEAR = 2000;

// Importar módulos
const auth = require('./auth');
const db = require('./db');
const fs = require('fs');

// Inicializar base de datos
let dbReady = false;
db.initializeTables()
  .then(async () => {
    dbReady = true;
    console.log('✅ Base de datos lista');
    
    // Auto-migrar si no existe el usuario admin
    const adminUser = await db.getUserByUsername('admin');
    if (!adminUser) {
      console.log('🔄 Migrando datos automáticamente...');
      try {
        const dataPath = path.join(__dirname, 'data.json');
        if (fs.existsSync(dataPath)) {
          const rawData = fs.readFileSync(dataPath, 'utf-8');
          const data = JSON.parse(rawData);
          
          // Mapping de regiones
          const regionColors = {
            'NORTE': '#D97373', 'SUR': '#F4D35E', 'ORIENTE': '#58D68D',
            'OCCIDENTE': '#5DADE2', 'CENTRO': '#E8B4B8'
          };
          const municipioToRegion = { 'INZÁ': 'CENTRO', 'EL TAMBO': 'NORTE', 'PÁEZ': 'SUR' };
          
          // Migrar municipios
          for (const [municipioNombre, entradas] of Object.entries(data)) {
            const region = municipioToRegion[municipioNombre] || 'CENTRO';
            const color = regionColors[region];
            await db.saveMunicipio(municipioNombre, region, color);
          }
          
          // Migrar entradas
          for (const [municipioNombre, entradas] of Object.entries(data)) {
            if (Array.isArray(entradas)) {
              for (const entrada of entradas) {
                try {
                  await db.saveEntrada(municipioNombre, entrada);
                } catch(e) {}
              }
            }
          }
          
          // Crear admin
          const hashedPassword = await auth.hashPassword('admin123');
          await db.saveUser('admin', hashedPassword, 'admin');
          console.log('✅ Migración completada. Usuario admin: admin/admin123');
        }
      } catch(err) {
        console.error('⚠️ Migración automática falló:', err.message);
      }
    }
  })
  .catch(err => {
    console.error('❌ Error al inicializar BD:', err);
  });

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname)); // Servir archivos estáticos

// Middleware para verificar BD
app.use((req, res, next) => {
  if (!dbReady && !req.path.includes('/health')) {
    return res.status(503).json({ error: 'Servidor inicializando...' });
  }
  next();
});

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

  // ── Campos de proyecto vial ──────────────────────────────────────────────
  const pct = Number(body.porcentaje_avance ?? existingEntry?.porcentaje_avance ?? 0);

  return {
    payload: {
      year,
      text,
      // Campos viales nuevos
      nombre_proyecto:    String(body.nombre_proyecto    || existingEntry?.nombre_proyecto    || '').trim(),
      tipo_obra:          String(body.tipo_obra          || existingEntry?.tipo_obra          || 'Vial').trim(),
      estado:             String(body.estado             || existingEntry?.estado             || 'En ejecución').trim(),
      porcentaje_avance:  Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0)),
      contratista:        String(body.contratista        || existingEntry?.contratista        || '').trim(),
      valor_contrato:     Number(body.valor_contrato     || existingEntry?.valor_contrato     || 0) || 0,
      fecha_inicio:       String(body.fecha_inicio       || existingEntry?.fecha_inicio       || '').trim(),
      fecha_fin_estimada: String(body.fecha_fin_estimada || existingEntry?.fecha_fin_estimada || '').trim(),
      // Campos originales
      documents,
      photos,
      fileName: documents[0]?.name || null,
      fileData: documents[0]?.data || null,
      published: body.published !== undefined ? !!body.published : !!existingEntry?.published
    }
  };
}

// GET: obtener todas las entradas de un municipio (solo publicadas)
app.get('/api/municipio/:dept', async (req, res) => {
  try {
    const dept = decodeURIComponent(req.params.dept);
    const entries = await db.getEntradasByMunicipio(dept);
    // Filtrar solo publicadas
    const published = entries.filter(e => e.published === true);
    res.json(published);
  } catch (error) {
    console.error('Error obteniendo entradas:', error);
    res.status(500).json({ error: 'Error al obtener entradas' });
  }
});

// GET: obtener todas las entradas de un municipio (admin - todas)
app.get('/api/admin/municipio/:dept', auth.authMiddleware, async (req, res) => {
  try {
    const dept = decodeURIComponent(req.params.dept);
    const entries = await db.getEntradasByMunicipio(dept);
    res.json(entries);
  } catch (error) {
    console.error('Error obteniendo entradas:', error);
    res.status(500).json({ error: 'Error al obtener entradas' });
  }
});

// POST: guardar una entrada (admin)
app.post('/api/admin/municipio/:dept', auth.authMiddleware, auth.requireRole('admin', 'editor'), async (req, res) => {
  try {
    const dept = decodeURIComponent(req.params.dept);
    const built = buildEntryPayload(req.body, {});

    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    const entrada = {
      id: Date.now(),
      ...built.payload,
      createdAt: new Date().toISOString()
    };

    const saved = await db.saveEntrada(dept, entrada);
    res.json({ success: true, entry: saved });
  } catch (error) {
    console.error('Error guardando entrada:', error);
    res.status(500).json({ error: 'Error al guardar' });
  }
});

// PUT: actualizar una entrada (admin)
app.put('/api/admin/municipio/:dept/:id', auth.authMiddleware, auth.requireRole('admin', 'editor'), async (req, res) => {
  try {
    const dept = decodeURIComponent(req.params.dept);
    const entryId = Number(req.params.id);

    const entries = await db.getEntradasByMunicipio(dept);
    const entry = entries.find(e => e.id === entryId);
    
    if (!entry) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }

    const built = buildEntryPayload(req.body, entry);
    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    const updated = {
      ...entry,
      ...built.payload,
      id: entryId
    };

    const saved = await db.saveEntrada(dept, updated);
    res.json({ success: true, entry: saved });
  } catch (error) {
    console.error('Error actualizando entrada:', error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// DELETE: eliminar una entrada (admin)
app.delete('/api/admin/municipio/:dept/:id', auth.authMiddleware, auth.requireRole('admin'), async (req, res) => {
  try {
    const entryId = Number(req.params.id);
    await db.deleteEntrada(entryId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando entrada:', error);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// GET: obtener lista de todos los municipios
app.get('/api/municipios', async (req, res) => {
  try {
    const municipios = await db.getMunicipios();
    res.json(municipios);
  } catch (error) {
    console.error('Error obteniendo municipios:', error);
    res.status(500).json({ error: 'Error al obtener municipios' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ✅ RUTAS DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════

// 1. POST: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const result = await auth.login(username, password, db);

    if (result.error) {
      return res.status(401).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('❌ Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 2. POST: Crear nuevo usuario (solo admin)
app.post('/api/auth/register', auth.authMiddleware, auth.requireRole('admin'), async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    // Verificar si el usuario ya existe
    const existing = await db.getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Hash de la contraseña
    const hashedPassword = await auth.hashPassword(password);
    
    // Guardar usuario en BD
    const newUser = await db.saveUser(username, hashedPassword, role || 'editor');

    if (!newUser) {
      return res.status(400).json({ error: 'No se pudo crear el usuario' });
    }

    res.json({ 
      success: true, 
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    });
  } catch (err) {
    console.error('Error al crear usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 3. GET: Obtener datos del usuario actual
app.get('/api/auth/me', auth.authMiddleware, (req, res) => {
  res.json({
    user: req.user,
    roles: auth.ROLES
  });
});

// 4. POST: Logout (solo invalida en cliente, JWT expira automáticamente)
app.post('/api/auth/logout', auth.authMiddleware, (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada' });
});

// 5. GET: Listar usuarios (solo admin)
app.get('/api/auth/users', auth.authMiddleware, auth.requireRole('admin'), async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, role, createdAt FROM users ORDER BY createdAt DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo usuarios:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ✅ PROTEGER RUTAS DEL ADMIN CON AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════

// Proteger POST/PUT/DELETE de municipios
app.post('/api/municipios/:dept/entrada', auth.authMiddleware, auth.requireRole('admin', 'editor'), (req, res) => {
  // Ruta existente - ahora protegida
});

app.put('/api/municipios/:dept/entrada/:entryId', auth.authMiddleware, auth.requireRole('admin', 'editor'), async (req, res) => {
  // Ahora usa PostgreSQL automáticamente
  res.status(200).json({ message: 'Use POST a /api/admin/municipio/:dept' });
});

app.delete('/api/municipios/:dept/entrada/:entryId', auth.authMiddleware, auth.requireRole('admin'), async (req, res) => {
  // Ahora usa PostgreSQL automáticamente
  res.status(200).json({ message: 'Use DELETE a /api/admin/municipio/:dept/:id' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: dbReady ? 'connected' : 'connecting',
    env: process.env.NODE_ENV || 'development'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📍 Abre http://localhost:${PORT} en tu navegador`);
  console.log(`🛠️  Dashboard admin: http://localhost:${PORT}/admin.html`);
  console.log(`📊 Base de datos: PostgreSQL en Railway`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});
