#!/bin/sh
set -eu
ROOT='/Users/xumingyue/Downloads/MyProjects/wedding-crest2'
TARGET="${1:-$ROOT/src/extensions/payment/paypal.ts}"
cp "$ROOT/.rankup/artifacts/paypal-network-retry/paypal.ts.original" "$TARGET"
echo "restored $TARGET"
