FROM node:24-bookworm-slim AS pi-env

ARG PI_ENV_VERSION

WORKDIR /pi-env

RUN test -n "$PI_ENV_VERSION" \
 && npm pack --silent "@earendil-works/pi-env@${PI_ENV_VERSION}" \
 && tar -xzf earendil-works-pi-env-*.tgz package/bin/pi-env-linux-x64/pi-env \
 && chmod +x package/bin/pi-env-linux-x64/pi-env

FROM debian:bookworm-slim

# Where the platform writes the CA it intercepts outbound HTTPS with, and the credential git sends;
# the egress handler swaps the placeholder for the real token.
ARG EGRESS_CA_PATH
ARG CREDENTIAL_PLACEHOLDER

# Pinned release of mise (runtime manager) and the checksum of its linux-x64 tarball, from the release's SHASUMS256.txt.
ARG MISE_VERSION=2026.11.8
ARG MISE_SHA256=d2d5a46f507bba772686e2c8f2316b3a4439dac49a37a30db5c0e7bb077c5431

# libatomic1: prebuilt Node binaries (pnpm's shim, mise's node) fail to start without libatomic.so.1.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git busybox curl xz-utils unzip bzip2 libatomic1 procps \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/mise.tar.gz "https://github.com/jdx/mise/releases/download/v${MISE_VERSION}/mise-v${MISE_VERSION}-linux-x64.tar.gz" \
 && echo "${MISE_SHA256}  /tmp/mise.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/mise.tar.gz -C /usr/local/bin --strip-components=2 mise/bin/mise \
 && rm /tmp/mise.tar.gz

# Same layout as mise's official container images: tools installed through mise resolve through the shims directory.
ENV MISE_DATA_DIR=/mise \
    MISE_CONFIG_DIR=/mise \
    MISE_CACHE_DIR=/mise/cache \
    PATH=/mise/shims:$PATH

COPY --from=pi-env /pi-env/package/bin/pi-env-linux-x64/pi-env /usr/local/bin/pi-env
COPY lifetime.sh /usr/local/bin/tentacles-lifetime

RUN test -n "$EGRESS_CA_PATH" && test -n "$CREDENTIAL_PLACEHOLDER" \
 && chmod +x /usr/local/bin/tentacles-lifetime \
 && git config --system credential.https://github.com.helper "!f() { echo username=x-access-token; echo password=${CREDENTIAL_PLACEHOLDER}; }; f" \
 && git config --system http.https://github.com/.sslCAInfo "$EGRESS_CA_PATH" \
 && git config --system user.name tentacles \
 && git config --system user.email tentacles@tentacles.invalid \
 && mkdir -p /workspace

WORKDIR /workspace

# The session object starts pi-env in the container over exec; the main process only keeps it alive.
CMD ["/usr/local/bin/tentacles-lifetime"]
