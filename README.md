# Mapa Municipios - Sistema Local

Sistema de información de municipios de Colombia con dashboard administrativo.

## 📋 Estructura

```
.
├── index.html              # Página principal del mapa
├── municipio.html          # Vista de información pública de cada municipio
├── admin.html              # Dashboard administrativo (solo lectura aquí)
├── mapa.js                 # Lógica del mapa
├── municipio.js            # Lógica de vista pública
├── admin.js                # Lógica del dashboard
├── style.css               # Estilos
├── server.js               # Servidor Node.js con API
├── package.json            # Dependencias Node.js
└── data.json               # Base de datos (se crea automáticamente)
```

## 🚀 Cómo ejecutar a nivel local

### Requisitos
- **Node.js** (versión 14+) descargado desde https://nodejs.org

### Pasos

1. **Abre PowerShell** en la carpeta del proyecto (`e:\VISUAL\Mapa-pruebas`)

2. **Instala las dependencias** (solo la primera vez):
```powershell
npm install
```

3. **Inicia el servidor**:
```powershell
npm start
```

Verás en la consola:
```
✅ Servidor corriendo en http://localhost:3000
📍 Abre http://localhost:3000 en tu navegador
🛠️  Dashboard admin: http://localhost:3000/admin.html
```

4. **Abre en tu navegador**:
   - **Mapa público**: http://localhost:3000
   - **Dashboard admin**: http://localhost:3000/admin.html

5. **Para detener el servidor**: Presiona `Ctrl+C` en PowerShell

## 📱 Cómo usar

### Dashboard Administrativo (`admin.html`)

1. Selecciona o crea un nuevo municipio
2. Llena el formulario:
   - Año
   - Descripción/información
   - Archivo (opcional: PDF, IMG, DOC, etc.)
3. Marca "Publicar" si quieres que sea visible al público
4. Haz clic en "Guardar Entrada"
5. Usa los botones:
   - **👁️ Pub.** → Cambiar estado de publicación
   - **✏️ Editar** → Modificar entrada
   - **🗑️ Eliminar** → Borrar entrada

### Mapa Público (`index.html`)

1. Haz hover sobre un departamento (pasa el ratón)
2. Haz click en un departamento para ver su información
3. Filtra por año en el selector
4. Descarga los archivos asociados (si existen)

## 🔐 Notas de seguridad

- El dashboard admin **está abierto** (sin contraseña) localmente
- Los datos se guardan en `data.json` (archivo JSON plano)
- En producción, **agregará autenticación y validaciones**

## 🛠️ Archivos generados

- `data.json` → base de datos con toda la información de municipios (se crea automáticamente)

## 📊 Estructura de datos

```json
{
  "Antioquia": [
    {
      "id": 1707345600000,
      "year": 2024,
      "text": "Información del municipio en 2024",
      "fileName": "reporte.pdf",
      "fileData": "data:application/pdf;base64,...",
      "published": true,
      "createdAt": "2026-02-05T10:30:00.000Z"
    }
  ]
}
```

## ⚠️ Próximos pasos (cuando esté listo para producción)

1. **Subir a servidor**: AWS, Heroku, Vercel, etc.
2. **Agregar autenticación**: login con contraseña para admin
3. **Base de datos real**: SQLite, PostgreSQL, MongoDB
4. **Almacenamiento de archivos**: Cloud storage (AWS S3, Google Cloud)
5. **HTTPS**: certificado SSL
6. **Respaldo de datos**: copias de seguridad automáticas

## 🐛 Solucionar problemas

**Error: "Cannot find module 'express'"**
```powershell
npm install
```

**El servidor no inicia**
- Verifica que el puerto 3000 esté disponible
- Cierra otras aplicaciones usando ese puerto

**El mapa no aparece**
- Abre la consola (F12) y revisa errores
- Verifica que el servidor esté corriendo

**Los datos no se guardan**
- Revisa la consola del navegador (F12)
- Verifica que la API responda en http://localhost:3000/api/municipios

## 📞 Contacto / Soporte
----- Ingeniero Nicolas Garcia 3106649899

Para reportar errores o sugerencias, revisa los logs en la consola (F12 en navegador).
