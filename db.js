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

// Crear tablas si no existen
const initializeTables = async () => {
  try {
    // Dropear tabla entradas si existe (para corregir tipo LONGTEXT)
    try {
      await query(`DROP TABLE IF EXISTS entradas CASCADE`);
      console.log('🔄 Tabla entradas limpiada');
    } catch(e) {}

    // Tabla de usuarios
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'revisor',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de municipios
    await query(`
      CREATE TABLE IF NOT EXISTS municipios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) UNIQUE NOT NULL,
        region VARCHAR(100),
        color VARCHAR(7),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de entradas (entries)
    // Primero, dropar la tabla si existe para recrearla con la nueva estructura
    await query(`DROP TABLE IF EXISTS entradas CASCADE`);
    
    await query(`
      CREATE TABLE IF NOT EXISTS entradas (
        id BIGINT PRIMARY KEY,
        municipioId INT NOT NULL REFERENCES municipios(id) ON DELETE CASCADE,
        year INT,
        text TEXT,
        fileName VARCHAR(255),
        fileData TEXT,
        published BOOLEAN DEFAULT true,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    'INSERT INTO municipios (nombre, region, color) VALUES ($1, $2, $3) ON CONFLICT (nombre) DO UPDATE SET region = $2, color = $3 RETURNING *',
    [nombre, region, color]
  );
  return res.rows[0];
};

// Consultas de entradas
const getEntradasByMunicipio = async (municipioNombre) => {
  const res = await query(`
    SELECT e.* FROM entradas e
    JOIN municipios m ON e.municipioId = m.id
    WHERE m.nombre = $1
    ORDER BY e.year DESC, e.createdAt DESC
  `, [municipioNombre]);
  return res.rows;
};

const saveEntrada = async (municipioNombre, entrada) => {
  // Primero obtener el ID del municipio
  const mun = await getMunicipioByName(municipioNombre);
  if (!mun) {
    throw new Error(`Municipio ${municipioNombre} no encontrado`);
  }

  const res = await query(
    `INSERT INTO entradas (id, municipioId, year, text, fileName, fileData, published, createdAt, 
                          nombre_proyecto, tipo_obra, estado, porcentaje_avance, contratista, valor_contrato, fecha_inicio, fecha_fin_estimada)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (id) DO UPDATE SET year=$3, text=$4, fileName=$5, fileData=$6, published=$7,
                                   nombre_proyecto=$9, tipo_obra=$10, estado=$11, porcentaje_avance=$12, 
                                   contratista=$13, valor_contrato=$14, fecha_inicio=$15, fecha_fin_estimada=$16
     RETURNING *`,
    [entrada.id, mun.id, entrada.year, entrada.text, entrada.fileName || null, entrada.fileData || null, 
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
  saveUser,
  close
};
