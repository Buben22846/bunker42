FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json server.mjs engine.mjs content.mjs ./
COPY --chown=node:node public ./public
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV PORT=3000 HOST=0.0.0.0 DATA_DIR=/app/data
EXPOSE 3000
CMD ["node", "server.mjs"]
