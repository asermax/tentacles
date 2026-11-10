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

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git busybox \
 && rm -rf /var/lib/apt/lists/*

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
