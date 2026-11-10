# Build context: apps/claude-relay after its build, which leaves the relay as one file in dist/.
FROM node:24-bookworm-slim

# Where the platform writes the CA it intercepts outbound HTTPS with, and the token the CLI sends;
# the egress handler swaps the placeholder for the real token.
ARG EGRESS_CA_PATH
ARG CREDENTIAL_PLACEHOLDER

RUN test -n "$EGRESS_CA_PATH" && test -n "$CREDENTIAL_PLACEHOLDER" \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g @anthropic-ai/claude-code@2.1.311 \
 && npm cache clean --force \
 && claude --version \
 && mkdir -p /workspace

COPY dist/main.js /relay/main.js

# The relay reads EGRESS_CA_PATH on each request until the file appears; the CLI processes it starts
# read NODE_EXTRA_CA_CERTS, and start once the file is there.
ENV EGRESS_CA_PATH=$EGRESS_CA_PATH \
    NODE_EXTRA_CA_CERTS=$EGRESS_CA_PATH \
    CLAUDE_CODE_OAUTH_TOKEN=$CREDENTIAL_PLACEHOLDER

# pi-claude-code runs the CLI in the relay's working directory.
WORKDIR /workspace

# PORT comes from the container's environment, which the setup sets.
CMD ["node", "/relay/main.js"]
