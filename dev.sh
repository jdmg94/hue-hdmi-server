#!/bin/bash
echo "dev mode!"

cd /usr/src

echo "starting server.."
NODE_EXTRA_CA_CERTS=/usr/src/node_modules/hue-sync/signify.pem pnpm run dev

