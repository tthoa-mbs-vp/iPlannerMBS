FROM alpine:3.20 AS builder

ARG PB_VERSION=0.39.10

RUN apk add --no-cache wget unzip && \
  wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip && \
  unzip pocketbase_${PB_VERSION}_linux_amd64.zip -d /pb && \
  rm pocketbase_${PB_VERSION}_linux_amd64.zip

FROM alpine:3.20

RUN apk add --no-cache ca-certificates

COPY --from=builder /pb/pocketbase /usr/local/bin/pocketbase

EXPOSE 8090

ENTRYPOINT ["pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--hooksDir=/pb/pb_hooks", "--migrationsDir=/pb/pb_migrations", "--publicDir=/pb/pb_public", "--hooksWatch=false"]
