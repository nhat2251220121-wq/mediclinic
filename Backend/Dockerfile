FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node src ./src
COPY --chown=node:node database ./database
COPY --chown=node:node scripts ./scripts
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 5000
CMD ["npm", "start"]
