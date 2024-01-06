# syntax=docker/dockerfile:1.6
FROM golang:1.21-bookworm as builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go build -ldflags="-s"

# NB we use the bookworm-slim (instead of scratch) image so we can enter the container to execute bash etc.
FROM debian:12-slim
COPY --from=builder /app/amt-setupbin-img .
ENTRYPOINT ["/amt-setupbin-img"]
