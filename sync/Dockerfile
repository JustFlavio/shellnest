FROM node:24-alpine
WORKDIR /app
COPY server.ts ./
COPY src ./src
# The data directory belongs to the unprivileged user, so a fresh named volume is writable.
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production SYNC_HOST=0.0.0.0 SYNC_PORT=8787 SYNC_DATA_DIR=/data
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8787/health || exit 1
CMD ["node", "server.ts"]
