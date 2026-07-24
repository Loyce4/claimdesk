FROM node:20-slim

WORKDIR /app

COPY --chown=node:node package*.json ./
RUN npm ci --ignore-scripts

COPY --chown=node:node . .

EXPOSE 8000
USER node
CMD ["npm", "run", "dev"]