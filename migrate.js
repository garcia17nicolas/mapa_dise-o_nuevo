// Script para migrar datos de data.json a PostgreSQL
const db = require('./db');
const fs = require('fs');
const path = require('path');

const migrateData = async () => {
  try {
    console.log('🚀 Iniciando migración de datos...');

    // Inicializar tablas
    await db.initializeTables();

    // Leer data.json
    const dataPath = path.join(__dirname, 'data.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(rawData);

    // Configuración de regiones (colores por región)
    const regionColors = {
      'NORTE': '#D97373',      // Rojo NASA KIWE
      'SUR': '#F4D35E',        // Amarillo NASA KIWE
      'ORIENTE': '#58D68D',    // Verde
      'OCCIDENTE': '#5DADE2',  // Azul
      'CENTRO': '#E8B4B8'      // Rosa
    };

    // Mapping de municipios a regiones (ajustar según tu mapa)
    const municipioToRegion = {
      'INZÁ': 'CENTRO',
      'EL TAMBO': 'NORTE',
      'PÁEZ': 'SUR',
      // Agregar más según sea necesario
    };

    // Migrar municipios
    console.log('📍 Migrando municipios...');
    for (const [municipioNombre, entradas] of Object.entries(data)) {
      const region = municipioToRegion[municipioNombre] || 'CENTRO';
      const color = regionColors[region];
      
      await db.saveMunicipio(municipioNombre, region, color);
      console.log(`  ✓ ${municipioNombre} (${region})`);
    }

    // Migrar entradas
    console.log('📝 Migrando entradas...');
    let totalEntradas = 0;
    for (const [municipioNombre, entradas] of Object.entries(data)) {
      if (Array.isArray(entradas)) {
        for (const entrada of entradas) {
          await db.saveEntrada(municipioNombre, entrada);
          totalEntradas++;
        }
      }
    }
    console.log(`  ✓ ${totalEntradas} entradas migradas`);

    // Crear usuario admin si no existe
    const auth = require('./auth');
    const adminUser = await db.getUserByUsername('admin');
    
    if (!adminUser) {
      console.log('👤 Creando usuario admin...');
      const hashedPassword = await auth.hashPassword('admin123');
      await db.saveUser('admin', hashedPassword, 'admin');
      console.log('  ✓ Usuario admin creado (contraseña: admin123)');
    }

    console.log('✅ Migración completada exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  migrateData();
}

module.exports = { migrateData };
