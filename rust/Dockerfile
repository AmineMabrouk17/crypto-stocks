# Multi-stage build for the standalone Rust backend.
FROM rust:1-bookworm AS builder
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY app ./app
RUN cargo build --release --locked -p crypto-stocks-backend

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /build/target/release/crypto-stocks-backend /usr/local/bin/crypto-stocks-backend
ENV HOST=0.0.0.0 PORT=8080 RUST_LOG=info
EXPOSE 8080
CMD ["crypto-stocks-backend"]
