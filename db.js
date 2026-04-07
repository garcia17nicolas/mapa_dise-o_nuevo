const { Pool } = require('pg');

// Conexión a PostgreSQL
console.log('🔗 DATABASE_URL:', process.env.DATABASE_URL ? '✅ Configurada' : '❌ NO configurada');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/mapa',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Manejador de errores
pool.on('error', (err) => {
  console.error('❌ Error no manejado en pool:', err.message);
});

pool.on('connect', () => {
  console.log('✅ Conexión a PostgreSQL establecida');
});

// Función para ejecutar queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('✓ Query ejecutada en', duration, 'ms:', res.rowCount, 'filas');
    return res;
  } catch (error) {
    console.error('❌ Error en query:', error.message);
    throw error;
  }
};

// Crear tablas si no existen (sin DROP - preserva datos entre reinicios)
const initializeTables = async () => {
  try {
    // Tabla de usuarios
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'revisor',
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de municipios
    await query(`
      CREATE TABLE IF NOT EXISTS municipios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) UNIQUE NOT NULL,
        region VARCHAR(100),
        color VARCHAR(7),
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de entradas (entries)
    await query(`
      CREATE TABLE IF NOT EXISTS entradas (
        id BIGINT PRIMARY KEY,
        municipioid INT NOT NULL REFERENCES municipios(id) ON DELETE CASCADE,
        year INT,
        text TEXT,
        filename VARCHAR(255),
        filedata TEXT,
        documents JSONB DEFAULT '[]',
        photos JSONB DEFAULT '[]',
        published BOOLEAN DEFAULT true,
        createdat TIMESTAMP,
        updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        nombre_proyecto VARCHAR(255),
        tipo_obra VARCHAR(100),
        estado VARCHAR(100),
        porcentaje_avance INT DEFAULT 0,
        contratista VARCHAR(255),
        valor_contrato BIGINT,
        fecha_inicio DATE,
        fecha_fin_estimada DATE
      )
    `);

    // Add documents/photos columns if they don't exist (migration for existing tables)
    try {
      await query(`ALTER TABLE entradas ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'`);
      await query(`ALTER TABLE entradas ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'`);
    } catch(e) {
      // Columns already exist, ignore
    }

    console.log('✅ Tablas inicializadas correctamente');
  } catch (error) {
    console.error('Error inicializando tablas:', error);
    throw error;
  }
};

// Consultas de municipios
const getMunicipios = async () => {
  const res = await query('SELECT * FROM municipios ORDER BY nombre');
  return res.rows;
};

const getMunicipioByName = async (nombre) => {
  const res = await query('SELECT * FROM municipios WHERE nombre = $1', [nombre]);
  return res.rows[0];
};

const saveMunicipio = async (nombre, region, color) => {
  const res = await query(
    'INSERT INTO municipios (nombre, region, color) VALUES ($1, $2, $3) ON CONFLICT (nombre) DO UPDATE SET region = EXCLUDED.region, color = EXCLUDED.color RETURNING *',
    [nombre, region, color]
  );
  return res.rows[0];
};

// Consultas de entradas
const getEntradasByMunicipio = async (municipioNombre) => {
  const res = await query(`
    SELECT e.* FROM entradas e
    JOIN municipios m ON e.municipioid = m.id
    WHERE m.nombre = $1
    ORDER BY e.year DESC, e.createdat DESC
  `, [municipioNombre]);
  // Parse JSONB columns and normalize column names for frontend
  return res.rows.map(row => ({
    ...row,
    municipioId: row.municipioid,
    fileName: row.filename,
    fileData: row.filedata,
    createdAt: row.createdat,
    updatedAt: row.updatedat,
    documents: typeof row.documents === 'string' ? JSON.parse(row.documents) : (row.documents || []),
    photos: typeof row.photos === 'string' ? JSON.parse(row.photos) : (row.photos || [])
  }));
};

const saveEntrada = async (municipioNombre, entrada) => {
  // Primero obtener el ID del municipio
  const mun = await getMunicipioByName(municipioNombre);
  if (!mun) {
    throw new Error(`Municipio ${municipioNombre} no encontrado`);
  }

  const documentsJson = JSON.stringify(Array.isArray(entrada.documents) ? entrada.documents : []);
  const photosJson = JSON.stringify(Array.isArray(entrada.photos) ? entrada.photos : []);

  const res = await query(
    `INSERT INTO entradas (id, municipioid, year, text, filename, filedata, documents, photos, published, createdat,
                          nombre_proyecto, tipo_obra, estado, porcentaje_avance, contratista, valor_contrato, fecha_inicio, fecha_fin_estimada)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (id) DO UPDATE SET year=$3, text=$4, filename=$5, filedata=$6, documents=$7, photos=$8, published=$9,
                                   nombre_proyecto=$11, tipo_obra=$12, estado=$13, porcentaje_avance=$14,
                                   contratista=$15, valor_contrato=$16, fecha_inicio=$17, fecha_fin_estimada=$18,
                                   updatedat=CURRENT_TIMESTAMP
     RETURNING *`,
    [entrada.id, mun.id, entrada.year, entrada.text, entrada.fileName || null, entrada.fileData || null,
     documentsJson, photosJson,
     entrada.published, entrada.createdAt, entrada.nombre_proyecto || null, entrada.tipo_obra || null,
     entrada.estado || null, entrada.porcentaje_avance || 0, entrada.contratista || null,
     entrada.valor_contrato || null, entrada.fecha_inicio || null, entrada.fecha_fin_estimada || null]
  );
  return res.rows[0];
};

const deleteEntrada = async (entradaId) => {
  const res = await query('DELETE FROM entradas WHERE id = $1 RETURNING *', [entradaId]);
  return res.rows[0];
};

// Consultas de usuarios
const getUserByUsername = async (username) => {
  const res = await query('SELECT * FROM users WHERE username = $1', [username]);
  return res.rows[0];
};

const getUsers = async () => {
  const res = await query('SELECT id, username, role, createdat FROM users ORDER BY createdat DESC');
  return res.rows;
};

const saveUser = async (username, hashedPassword, role = 'revisor') => {
  const res = await query(
    'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING RETURNING *',
    [username, hashedPassword, role]
  );
  return res.rows[0];
};

// Pool para cerrar conexiones
const close = async () => {
  await pool.end();
};

module.exports = {
  query,
  pool,
  initializeTables,
  getMunicipios,
  getMunicipioByName,
  saveMunicipio,
  getEntradasByMunicipio,
  saveEntrada,
  deleteEntrada,
  getUserByUsername,
  getUsers,
  saveUser,
  close
};
