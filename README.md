# Nasa Kiwe — Sistema de Información de Municipios

CMS web para gestionar y publicar información sobre proyectos e inversiones en los municipios del **Departamento del Cauca, Colombia**. Incluye un mapa interactivo público y un panel administrativo con autenticación y control de roles.

---

## Estructura del proyecto

```
.
├── index.html          # Mapa público interactivo (página de inicio)
├── municipio.html      # Vista pública de proyectos por municipio
├── login.html          # Inicio de sesión al panel admin
├── admin.html          # Panel administrativo (CRUD de entradas)
├── settings.html       # Perfil y cambio de contraseña del usuario
│
├── mapa.js             # Lógica del mapa Highcharts + colores por región
├── municipio.js        # Carga y renderizado de entradas públicas
├── admin.js            # Lógica del dashboard administrativo
│
├── server.js           # Servidor Express + endpoints de la API REST
├── db.js               # Módulo de base de datos PostgreSQL
├── auth.js             # JWT, hashing de contraseñas, middleware de auth
│
├── init-admin.js       # Script utilitario: crea usuario admin inicial
├── migrate.js          # Script utilitario: migra data.json → PostgreSQL
│
├── municipios.geojson  # Datos geográficos de municipios del Cauca
├── style.css           # Estilos base (compartidos)
├── package.json        # Dependencias Node.js
├── .env                # Variables de entorno (no commitear en producción)
├── Dockerfile          # Imagen Docker
├── Procfile            # Config para Heroku
└── railway.json        # Config para Railway.app
```

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5, CSS3, JavaScript (vanilla) |
| Mapa | [Highcharts Maps](https://www.highcharts.com/maps/) v12 |
| Backend | Node.js + Express 4 |
| Base de datos | PostgreSQL (producción) / `data.json` (fallback local) |
| Autenticación | JWT (`jsonwebtoken`) + bcryptjs |
| Seguridad | Helmet, CORS, express-validator |
| Despliegue | Railway.app / Docker / Heroku |

---

## Requisitos previos

- **Node.js** 14 o superior → https://nodejs.org
- **PostgreSQL** (para producción). En desarrollo sin PostgreSQL el servidor usa `data.json` automáticamente.

---

## Instalación y ejecución local

```bash
# 1. Instalar dependencias
npm install

# 2. (Opcional) Configurar variables de entorno
cp .env.example .env   # o editar .env directamente

# 3. Iniciar el servidor
npm start
```

El servidor queda disponible en **http://localhost:3000**

| URL | Descripción |
|-----|-------------|
| `http://localhost:3000` | Mapa público |
| `http://localhost:3000/login.html` | Login de administración |
| `http://localhost:3000/admin.html` | Panel admin (requiere sesión) |
| `http://localhost:3000/settings.html` | Perfil y contraseña (requiere sesión) |

---

## Variables de entorno (`.env`)

```env
PORT=3000
DATABASE_URL=postgresql://usuario:contraseña@host:5432/nombre_db
JWT_SECRET=cambia_esto_en_produccion
```

Si `DATABASE_URL` no está definida, el servidor usará `data.json` como base de datos local.

---

## Credenciales por defecto

Al iniciar por primera vez (o al ejecutar la migración automática), se crea el usuario administrador:

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `admin123` |

> **Importante:** cambia la contraseña desde `settings.html` antes de poner el sistema en producción.

---

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| `admin` | CRUD completo + gestión de usuarios |
| `editor` | Crear, editar y publicar entradas |
| `revisor` | Solo lectura del panel |

Los admins pueden crear nuevos usuarios desde el panel administrativo.

---

## API REST

### Endpoints públicos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/municipio/:nombre` | Entradas publicadas de un municipio |

### Endpoints protegidos (requieren `Authorization: Bearer <token>`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Iniciar sesión, devuelve JWT |
| `POST` | `/api/auth/change-password` | Cambiar contraseña del usuario actual |
| `GET` | `/api/admin/municipio/:nombre` | Todas las entradas (publicadas + borradores) |
| `POST` | `/api/admin/municipio/:nombre` | Crear nueva entrada |
| `PUT` | `/api/admin/municipio/:nombre/:id` | Editar entrada existente |
| `DELETE` | `/api/admin/municipio/:nombre/:id` | Eliminar entrada |
| `GET` | `/api/admin/users` | Listar usuarios (solo admin) |
| `POST` | `/api/admin/users` | Crear usuario (solo admin) |

---

## Estructura de una entrada

Cada proyecto/obra registrado en un municipio tiene los siguientes campos:

```json
{
  "id": 1,
  "year": 2024,
  "nombre_proyecto": "Rehabilitación vía El Patía - Mercaderes",
  "tipo_obra": "Vial",
  "estado": "En ejecución",
  "porcentaje_avance": 65,
  "contratista": "Constructora ABC S.A.S",
  "valor_contrato": 850000000,
  "fecha_inicio": "2024-03-01",
  "fecha_fin_estimada": "2024-12-31",
  "text": "Observaciones adicionales sobre el proyecto.",
  "documents": [{ "name": "contrato.pdf", "data": "data:application/pdf;base64,..." }],
  "photos": [{ "name": "avance.jpg", "data": "data:image/jpeg;base64,..." }],
  "published": true
}
```

**Tipos de obra disponibles:** Vial, Puente, Peatonal, Infraestructura, Otro

**Estados disponibles:** En planeación, En ejecución, Suspendido, Terminado

---

## Regiones del Cauca

El mapa colorea los municipios según su región:

| Región | Color | Municipios incluidos |
|--------|-------|---------------------|
| Norte | Rojo `#D97373` | Buenos Aires, Caloto, Corinto, Guachené, Miranda, Padilla, Puerto Tejada, Santander de Quilichao, Suárez, Villa Rica |
| Centro | Naranja `#F8A855` | Cajibío, El Tambo, La Sierra, Morales, Piendamó, Popayán, Rosas, Sotará, Timbío |
| Sur | Amarillo `#F4D35E` | Almaguer, Argelia, Balboa, Bolívar, Florencia, La Vega, Mercaderes, Patía, Piamonte, San Sebastián, Santa Rosa, Sucre |
| Oriente | Azul `#5DADE2` | Caldono, Inzá, Jambaló, Páez, Puracé, Silvia, Toribío, Totoró |
| Occidente | Verde `#58D68D` | Guapi, López de Micay, Timbiquí |

---

## Scripts utilitarios

```bash
# Crear usuario admin manualmente
node init-admin.js

# Migrar datos desde data.json a PostgreSQL
node migrate.js
```

---

## Despliegue en Railway

1. Crear proyecto en [railway.app](https://railway.app)
2. Agregar un servicio **PostgreSQL** y copiar el `DATABASE_URL`
3. Configurar las variables de entorno: `DATABASE_URL`, `JWT_SECRET`
4. Hacer push al repositorio conectado — Railway detecta el `Procfile` automáticamente

---

## Solución de problemas

**`Cannot find module 'express'`**
```bash
npm install
```

**El mapa no aparece**
- Verifica que el servidor esté corriendo (`npm start`)
- Abre la consola del navegador (F12) y revisa la pestaña Network
- Confirma que `municipios.geojson` exista en la raíz del proyecto

**Error de base de datos**
- Verifica que `DATABASE_URL` sea correcta en `.env`
- Si no tienes PostgreSQL local, el servidor usa `data.json` automáticamente

**Error 503 "Servidor inicializando"**
- La base de datos aún está conectando; espera unos segundos y recarga

**No puedo iniciar sesión**
- Usuario por defecto: `admin` / `admin123`
- Si ya lo cambiaste y lo olvidaste, ejecuta `node init-admin.js` para restablecerlo
