// ==================== MÓDULO DE AUTENTICACIÓN ====================
// Maneja: Login, JWT, Passwords, Perfiles

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const SECRET = process.env.JWT_SECRET || 'default-secret-key-dev-only';
const EXPIRY = process.env.JWT_EXPIRY || '24h';
const DATA_FILE = path.join(__dirname, 'data.json');

// ═══════════════════════════════════════════════════════════════════
// 1️⃣ FUNCIONES DE CONTRASEÑA (BCRYPT)
// ═══════════════════════════════════════════════════════════════════

async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  } catch (err) {
    console.error('Error al hashear contraseña:', err);
    throw err;
  }
}

async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    console.error('Error al verificar contraseña:', err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2️⃣ GESTIÓN DE DATOS (Users)
// ═══════════════════════════════════════════════════════════════════

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error al leer data.json:', err);
  }
  return { users: [], municipios: {} };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error al guardar data.json:', err);
    return false;
  }
}

// Inicializar usuarios si no existen
function initializeUsers() {
  const data = loadData();
  
  if (!data.users || data.users.length === 0) {
    console.log('📝 Creando usuario admin por defecto...');
    data.users = [];
    saveData(data);
  }
  
  return data;
}

// ═══════════════════════════════════════════════════════════════════
// 3️⃣ FUNCIONES DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════

async function createUser(username, email, password, role = 'editor') {
  try {
    const data = loadData();
    
    // Validar que el usuario no exista
    if (data.users.some(u => u.username === username || u.email === email)) {
      return { error: 'Usuario o email ya existe' };
    }
    
    // Hash de la contraseña
    const hashedPassword = await hashPassword(password);
    
    // Crear usuario
    const newUser = {
      id: data.users.length + 1,
      username,
      email,
      password: hashedPassword,
      role: role, // admin, editor, revisor
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    
    data.users.push(newUser);
    saveData(data);
    
    console.log(`✅ Usuario "${username}" creado con rol: ${role}`);
    return { 
      success: true, 
      user: { id: newUser.id, username, email, role } 
    };
  } catch (err) {
    console.error('Error al crear usuario:', err);
    return { error: 'Error al crear usuario' };
  }
}

async function login(username, password, dbModule = null) {
  try {
    let user = null;

    // Si hay módulo DB (PostgreSQL), usar eso; si no, usar data.json
    if (dbModule) {
      user = await dbModule.getUserByUsername(username);
      console.log(`🔍 Buscando usuario en BD: ${username}`, user ? '✅' : '❌');
    } else {
      const data = loadData();
      user = data.users?.find(u => u.username === username);
      console.log(`🔍 Buscando usuario en JSON: ${username}`, user ? '✅' : '❌');
    }
    
    if (!user) {
      console.log(`❌ Usuario no encontrado: ${username}`);
      return { error: 'Usuario no encontrado' };
    }
    
    const isValid = await verifyPassword(password, user.password || user.password);
    if (!isValid) {
      console.log(`❌ Contraseña incorrecta para: ${username}`);
      return { error: 'Contraseña incorrecta' };
    }
    
    // Generar JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      SECRET,
      { expiresIn: EXPIRY }
    );
    
    console.log(`✅ Login exitoso: ${username}`);
    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    };
  } catch (err) {
    console.error('❌ Error en login:', err.message);
    return { error: 'Error en autenticación' };
  }
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, SECRET);
    return { valid: true, user: decoded };
  } catch (err) {
    console.error('Token inválido:', err.message);
    return { valid: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 4️⃣ MIDDLEWARE DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════

function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No autorizado - Token requerido' });
    }
    
    const verification = verifyToken(token);
    if (!verification.valid) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    
    req.user = verification.user;
    next();
  } catch (err) {
    console.error('Error en authMiddleware:', err);
    res.status(500).json({ error: 'Error de autenticación' });
  }
}

// Verificar rol específico
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Acceso denegado. Rol requerido: ${allowedRoles.join(' o ')}` 
      });
    }
    
    next();
  };
}

// ═══════════════════════════════════════════════════════════════════
// 5️⃣ MODELOS DE ROLES
// ═══════════════════════════════════════════════════════════════════

const ROLES = {
  admin: {
    name: '👑 Administrador',
    permissions: ['create', 'read', 'update', 'delete', 'publish', 'manage_users']
  },
  editor: {
    name: '📝 Editor',
    permissions: ['create', 'read', 'update', 'publish']
  },
  revisor: {
    name: '👁️ Revisor',
    permissions: ['read', 'comment']
  }
};

// ═══════════════════════════════════════════════════════════════════
// EXPORTAR
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  hashPassword,
  verifyPassword,
  createUser,
  login,
  verifyToken,
  authMiddleware,
  requireRole,
  loadData,
  saveData,
  initializeUsers,
  ROLES
};
