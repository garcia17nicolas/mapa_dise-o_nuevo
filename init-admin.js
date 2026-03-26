#!/usr/bin/env node

/**
 * Script de inicialización - Crea el usuario admin por defecto
 * Ejecutar una sola vez: node init-admin.js
 */

const auth = require('./auth');
const fs = require('fs');
const path = require('path');

async function init() {
  console.log('\n🔐 ═══════════════════════════════════════════════════════════════');
  console.log('   INICIALIZANDO SISTEMA DE AUTENTICACIÓN');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Verificar si ya existe data.json
    const dataFile = path.join(__dirname, 'data.json');
    let isNew = !fs.existsSync(dataFile);

    // Inicializar estructura
    auth.initializeUsers();

    if (isNew) {
      console.log('📄 Archivo data.json creado ✅');
    }

    // Cargar datos actuales
    const data = auth.loadData();

    // Verificar si ya existe un admin
    const adminExists = data.users && data.users.some(u => u.role === 'admin');

    if (adminExists) {
      console.log('⚠️  Ya existe un usuario admin en el sistema');
      console.log('\n📋 Usuarios actuales:');
      data.users.forEach(u => {
        console.log(`   - ${u.username} (${u.role}) - ${u.email}`);
      });
    } else {
      // Crear usuario admin por defecto
      console.log('  Creando usuario admin por defecto...\n');

      const result = await auth.createUser(
        'admin',
        'admin@nasa-kiwe.com',
        'admin123',
        'admin'
      );

      if (result.error) {
        console.error('❌ Error:', result.error);
        process.exit(1);
      }

      console.log('✅ Usuario admin creado exitosamente\n');
      console.log('📝 Credenciales de acceso:');
      console.log('   Usuario: admin');
      console.log('   Contraseña: admin123');
      console.log('   Rol: Administrador total acceso\n');
      console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login\n');
    }

    // Mostrar información
    console.log('🔑 ═══════════════════════════════════════════════════════════════');
    console.log('   ROLES Y PERMISOS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('👑 ADMIN');
    console.log('   - Crear/editar/eliminar municipios y entradas');
    console.log('   - Publicar contenido');
    console.log('   - Gestionar usuarios\n');

    console.log('📝 EDITOR');
    console.log('   - Crear/editar entradas');
    console.log('   - Publicar contenido\n');

    console.log('👁️ REVISOR');
    console.log('   - Ver contenido');
    console.log('   - Dejar comentarios\n');

    console.log('══════════════════════════════════════════════════════════════\n');
    console.log('✨ Inicialización completada');
    console.log('Inicia el servidor con: npm start\n');

  } catch (err) {
    console.error('❌ Error durante la inicialización:', err);
    process.exit(1);
  }
}

// Ejecutar
init();
