# The release of Computer's daemon, which the stack passes from the Computer package's version.
ARG COMPUTERD_VERSION
FROM ghcr.io/cloudflare/computer-computerd-linux-x64:${COMPUTERD_VERSION} AS computerd

FROM debian:trixie-slim

# Where the platform writes the CA it intercepts outbound HTTPS with, once the container has started.
ARG EGRESS_CA_PATH

# Pinned release of mise (runtime manager) and the checksum of its linux-x64 tarball, from the release's SHASUMS256.txt.
ARG MISE_VERSION=2026.11.8
ARG MISE_SHA256=d2d5a46f507bba772686e2c8f2316b3a4439dac49a37a30db5c0e7bb077c5431

# fuse3 and libfuse2t64: computerd mounts the workspace's files at /workspace over FUSE.
# libatomic1: prebuilt Node binaries (pnpm's shim, mise's node) fail to start without libatomic.so.1.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fuse3 libfuse2t64 ca-certificates git curl xz-utils unzip bzip2 libatomic1 procps \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/mise.tar.gz "https://github.com/jdx/mise/releases/download/v${MISE_VERSION}/mise-v${MISE_VERSION}-linux-x64.tar.gz" \
 && echo "${MISE_SHA256}  /tmp/mise.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/mise.tar.gz -C /usr/local/bin --strip-components=2 mise/bin/mise \
 && rm /tmp/mise.tar.gz

# The agent's commands run through computerd, which passes on only HOME and PATH, so mise keeps its
# default directories under HOME and only its shims go on PATH.
ENV PATH=/root/.local/share/mise/shims:$PATH

COPY --from=computerd /usr/local/bin/computerd /usr/local/bin/computerd
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN test -n "$EGRESS_CA_PATH" && chmod +x /usr/local/bin/entrypoint.sh && mkdir -p /workspace

ENV PORT=8080
ENV MOUNT_POINT=/workspace
ENV FUSE_MOUNT=auto
ENV EGRESS_CA_PATH=${EGRESS_CA_PATH}

EXPOSE 8080

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
