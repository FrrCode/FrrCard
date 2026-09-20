# The renderer needs Node at container start (it builds the mounted data/ then
# serves it), so Node has to be in the final image — but npm, the headers and the
# rest of the toolchain do not. Lifting just the binary onto bare Alpine cuts the
# image by ~100 MB.
FROM node:22-alpine AS node

FROM alpine:3.22

LABEL org.opencontainers.image.title="FrrCard" \
      org.opencontainers.image.description="Self-hosted digital business card — one JSON file per person, one static page out." \
      org.opencontainers.image.source="https://github.com/FrrCode/FrrCard" \
      org.opencontainers.image.licenses="LicenseRef-ISC-Commons-Clause"

# libstdc++ (and the libgcc it pulls in) are all the node binary links against.
RUN apk add --no-cache libstdc++ \
 && addgroup -S -g 1000 node \
 && adduser -S -u 1000 -G node -h /app node

COPY --from=node /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
COPY build.js serve.js template.html ./

# data/ and public/ are mounted read-only; dist/ is rebuilt on every start.
RUN mkdir -p /app/data /app/public /app/dist && chown node:node /app/dist

ENV PORT=8080 \
    NODE_ENV=production
EXPOSE 8080
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/healthz" || exit 1

CMD ["sh", "-c", "node build.js && exec node serve.js"]
