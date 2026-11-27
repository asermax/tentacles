#!/bin/sh
# Cloudflare re-signs every HTTPS connection of the container with a CA it writes only after the
# container has started. This waits briefly for it and copies it into the system trust store, which
# curl and git read, and into npm's user config, which npm reads under the HOME that computerd
# passes on. Node reads neither: src/computer/workspace-container-backend.ts points it at the copy in the
# system store through NODE_EXTRA_CA_CERTS, so the path below has to stay the same. Waiting before computerd starts keeps the first command after a cold start from
# running before the CA is trusted; the wait is capped, so a CA that never appears cannot keep
# computerd from starting. Then it runs computerd, which keeps the container's main process alive.

for _ in $(seq 1 100); do
  if [ -f "$EGRESS_CA_PATH" ]; then
    cp "$EGRESS_CA_PATH" /usr/local/share/ca-certificates/cloudflare-containers-ca.crt
    update-ca-certificates >/dev/null 2>&1
    echo "cafile=/etc/ssl/certs/ca-certificates.crt" > /root/.npmrc
    break
  fi

  sleep 0.2
done

exec /usr/local/bin/computerd "$@"
