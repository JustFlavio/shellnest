FROM node:22-alpine
WORKDIR /app
COPY server.mjs .
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV SYNC_HOST=0.0.0.0 SYNC_PORT=8787 SYNC_DATA_DIR=/app/data
EXPOSE 8787
CMD ["node", "server.mjs"]
