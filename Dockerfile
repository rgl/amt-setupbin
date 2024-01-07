# syntax=docker/dockerfile:1.6

FROM oven/bun:1.0 as build
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY *.cjs *.js ./
# NB this is not using --minify --sourcemap=inline beause it makes stack traces
#    hard to read, as they show the minified version source code.
RUN bun \
        build \
        . \
        --production \
        --compile \
        --target=bun \
        --outfile=amt-setupbin

FROM golang:1.21-bookworm as img-build
WORKDIR /app
COPY amt-setupbin-img/go.* ./
RUN go mod download
COPY amt-setupbin-img/*.go ./
RUN CGO_ENABLED=0 go build -ldflags="-s"

# NB we use the bookworm-slim (instead of scratch) image so we can enter the container to execute bash etc.
FROM debian:12-slim
COPY --from=build /app/amt-setupbin /usr/local/bin/
COPY --from=img-build /app/amt-setupbin-img /usr/local/bin/
ENTRYPOINT ["amt-setupbin"]
