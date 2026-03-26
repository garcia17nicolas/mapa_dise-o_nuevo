FROM node:20-alpine

WORKDIR /app

# Copiar package.json
COPY package.json .

# Instalar dependencias
RUN npm install --production

# Copiar resto del código
COPY . .

# Exponer puerto
EXPOSE 3000

# Iniciar servidor
CMD ["node", "server.js"]
