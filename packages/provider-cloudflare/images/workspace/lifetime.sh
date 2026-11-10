#!/bin/sh
# The container's main process. While /workspace holds work that is not pushed, it asks the session
# object every minute whether the workspace is still needed; the request reaching the object renews the
# container. Once the answer is no it stops asking, and the platform's inactivity timeout stops the
# container. It never exits, since the container stops when its main process does.

has_pending_work() {
  [ -n "$(git -C /workspace status --porcelain 2>/dev/null)" ] && return 0

  # Commits on a local branch that no remote-tracking branch contains: covers a branch ahead of its
  # upstream and a branch that was never pushed, which git status alone does not report.
  [ -n "$(git -C /workspace log --branches --not --remotes --format=%H -n 1 2>/dev/null)" ]
}

while true; do
  sleep 60

  if has_pending_work; then
    answer="$(busybox wget -q -O - 'http://tentacles.internal/lifetime?pendingWork=true' 2>/dev/null)"

    if [ "$answer" = "no" ]; then
      break
    fi
  fi
done

exec sleep infinity
