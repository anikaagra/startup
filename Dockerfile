FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY server/package.json server/package-lock.json* server/
COPY web/package.json web/package-lock.json* web/
COPY web/scripts web/scripts
RUN npm ci --prefix server --omit=dev && npm ci --prefix web
COPY . .
RUN npm run build --prefix web && (npm run fetch-model --prefix web || echo "Pose model will load from Google at runtime")
RUN mkdir -p /data
ENV NODE_ENV=production PORT=3001 RISE_DB=/data/rise.db
EXPOSE 3001
CMD ["node", "--no-warnings=ExperimentalWarning", "server/src/index.js"]
