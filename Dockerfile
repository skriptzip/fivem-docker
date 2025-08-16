ARG FIVEM_NUM=18443
ARG FIVEM_VER=18443-746f079d418d6a05ae5fe78268bc1b4fd66ce738
ARG DATA_VER=0e7ba538339f7c1c26d0e689aa750a336576cf02

# =============================
# Build Stage
# =============================
FROM ghcr.io/skriptzip/alpine:main AS builder

ARG FIVEM_VER
ARG DATA_VER

WORKDIR /output

RUN apk add --no-cache wget xz tar \
 && wget -O- https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/${FIVEM_VER}/fx.tar.xz \
        | tar xJ --strip-components=1 \
            --exclude alpine/dev --exclude alpine/proc \
            --exclude alpine/run --exclude alpine/sys \
 && mkdir -p /output/opt/cfx-server-data /output/usr/local/share \
 && wget -O- https://github.com/citizenfx/cfx-server-data/archive/${DATA_VER}.tar.gz \
        | tar xz --strip-components=1 -C opt/cfx-server-data

# Add config + entrypoint
ADD server.cfg opt/cfx-server-data
ADD entrypoint usr/bin/entrypoint
RUN chmod +x /output/usr/bin/entrypoint

# =============================
# Final Stage
# =============================
FROM scratch

ARG FIVEM_VER
ARG FIVEM_NUM
ARG DATA_VER

LABEL org.opencontainers.image.authors="you <you@example.com>" \
      org.opencontainers.image.vendor="Custom" \
      org.opencontainers.image.title="FiveM" \
      org.opencontainers.image.url="https://fivem.net" \
      org.opencontainers.image.description="FiveM dedicated server image" \
      org.opencontainers.image.version=${FIVEM_NUM} \
      io.fivem.version=${FIVEM_VER} \
      io.fivem.data=${DATA_VER}

COPY --from=builder /output/ /

WORKDIR /config
EXPOSE 30120

CMD [""]
ENTRYPOINT ["/sbin/tini", "--", "/usr/bin/entrypoint"]
