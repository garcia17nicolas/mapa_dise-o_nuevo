# 🚀 GUÍA DE DESPLIEGUE EN RAILWAY

## PASO A PASO - Llevar tu proyecto a INTERNET en 15 minutos

---

## **FASE 1: Preparar GitHub (5 minutos)**

### 1.1 - Subir proyecto a GitHub

```bash
# En la carpeta del proyecto (PowerShell)
cd "g:\Mi unidad\Nicolas\Mapa-pruebas - copia"

# Inicializar Git si no está
git init
git add .
git commit -m "Inicial: NASA KIWE con autenticación y mapa"
git branch -M main
git remote add origin https://github.com/garcia17nicolas/mapa_diseño_nuevo.git
git push -u origin main
```

### 1.2 - Verificar en GitHub

- Ve a https://github.com/garcia17nicolas/mapa_diseño_nuevo
- Verifica que los archivos estén subidos
- ⚠️ Asegúrate que `.env` NO esté subido (debe estar en .gitignore)

---

## **FASE 2: Crear Cuenta en Railway (3 minutos)**

### 2.1 - Registrarse

1. Ve a https://railway.app
2. Click en "Start for Free"
3. Login con GitHub ✅
4. Autoriza la conexión

### 2.2 - Crear Proyecto

1. Click "Create New Project"
2. Selecciona "Deploy from GitHub repo"
3. Busca `mapa_diseño_nuevo`
4. Selecciona y autoriza Railway

---

## **FASE 3: Configurar Variables (2 minutos)**

### 3.1 - Agregar Variables de Entorno

En Railway dashboard:
1. Click en tu proyecto
2. Click en la variable `SERVICE` → "Variables"
3. Agregar estas variables:

```
JWT_SECRET=tu_clave_super_secreta_cambia_esto_en_produccion
JWT_EXPIRY=24h
NODE_ENV=production
PORT=3000
```

### 3.2 - Verificar Procfile

Railway debe detectar automáticamente:
- ✅ `Procfile` tiene `web: node server.js`
- ✅ `package.json` contiene scripts

---

## **FASE 4: Deploy (2 minutos)**

### 4.1 - Iniciar Despliegue

1. Railway detecta cambios automáticamente
2. O hace push nuevo a GitHub:

```bash
git add .
git commit -m "Actualizaciones para railway"
git push origin main
```

3. Railway inicia build automáticamente
4. Espera 2-3 minutos a que termine

### 4.2 - Ver Logs

En Railway dashboard:
- Click en "Logs"
- Verás: "✅ Servidor corriendo en..."

---

## **FASE 5: Obtener Tu URL (1 minuto)**

### 5.1 - URL Automática

Railway te da una URL como:
```
mapa-nasa-kiwe-production.railway.app
```

O en el dashboard:
- Click en tu servicio
- Click en "URL"
- Copia la dirección

### 5.2 - Probar

Abre en navegador:
```
https://mapa-nasa-kiwe-production.railway.app/login.html
```

Credenciales:
- Usuario: `admin`
- Contraseña: `admin123`

✅ ¡Está ONLINE! 🎉

---

## **FASE 6: Dominio Personalizado (Opcional)**

### 6.1 - Comprar Dominio

Opciones:
- Namecheap: ~$10/año
- GoDaddy: ~$12/año
- Google Domains: ~$15/año

Ejemplo: `mapanasikiwe.com`

### 6.2 - Conectar a Railway

1. En Railway → Tu proyecto → "Settings"
2. "Custom Domain"
3. Ingresa: `mapanasikiwe.com`
4. Railway te da registros DNS (CNAME)
5. Ve a tu registrador de dominio
6. Agrega los registros DNS
7. Espera 15-30 minutos a que se propague

### 6.3 - Verificar

```
https://mapanasikiwe.com/login.html
```

---

## **PROBLEMAS COMUNES**

### ❌ "Build failed"
- Verifica que `package.json` existe
- Verifica que `server.js` existe
- Revisar logs en Railway

### ❌ "Port is already in use"
- Agregar a `.env`: `PORT=3000`
- Railway asigna puerto automáticamente

### ❌ "Cannot find module"
- Verificar `package.json` tiene todas las dependencias
- Eliminar `node_modules` y hacer `npm install` localmente

### ❌ "404 - Página no encontrada"
- Verificar que archivos HTML existen
- Verificar rutas en `server.js`

---

## **ACTUALIZAR PROYECTO**

Después de hacer cambios locales:

```bash
# 1. Hacer cambios en el código
# 2. Subir a GitHub
git add .
git commit -m "Descripción de cambios"
git push origin main

# 3. Railway detecta automáticamente
# 4. Solo espera el build
```

---

## **MONITOREO Y STATS**

En Railway dashboard puedes ver:
- ✅ CPU usage
- ✅ Memory
- ✅ Network traffic
- ✅ Logs en tiempo real

---

## **ESCALABILIDAD FUTURA**

Si necesitas más:
- **Base de datos**: Railway → "Database" → PostgreSQL
- **Más RAM**: Upgrade plan (desde $5/mes)
- **Custom domain**: Ya cubierto
- **SSL/HTTPS**: Automático ✅

---

## **CONEXIÓN RÁPIDA**

Si ya tienes cuenta en Railway:

```bash
# 1. En la carpeta del proyecto
railway init

# 2. Selecciona proyecto existente

# 3. Visualizar
railway open
```

---

## 📞 SOPORTE RAILWAY

- Docs: https://railway.app/docs
- Community: https://railway.app/community
- Email: support@railway.app

¡Éxito con tu deployment! 🚀
