FROM node:24-alpine

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código y assets
COPY . .

# Exponer puerto (Railway lo asignará)
EXPOSE 3000

# Iniciar servidor
CMD ["npm", "start"]
