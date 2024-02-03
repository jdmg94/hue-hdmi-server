#!/bin/bash
echo "dev mode!"

cd /usr/src

echo "using pnpm to install dependencies..."
pnpm install --ignore-scripts

echo "linking opencv bindings..."
rm -rf /usr/src/node_modules/@u4

echo "starting server..."
NODE_PATH=/usr/lib/node_modules NODE_EXTRA_CA_CERTS=/usr/src/node_modules/hue-sync/signify.pem pnpm run dev

