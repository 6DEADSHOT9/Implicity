#!/bin/sh
set -eu

until rpk topic list --brokers posthog-kafka:9092 >/dev/null 2>&1; do
    sleep 2
done

while IFS= read -r topic; do
    [ -n "$topic" ] || continue
    if ! rpk topic create "$topic" --brokers posthog-kafka:9092 -p 1 -r 1 >/dev/null 2>&1; then
        rpk topic list --brokers posthog-kafka:9092 | awk '{print $1}' | grep -qx "$topic" || exit 1
    fi
done < /topics.txt

exec tail -f /dev/null
