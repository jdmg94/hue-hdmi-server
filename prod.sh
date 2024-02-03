#!/bin/bash
echo "production mode!"

cd /usr/src

echo "using pnpm to install dependencies..."
pnpm install --prod --reporter=silent
pnpm install -d @swc/cli

echo "linking opencv bindings..."
rm -rf /usr/src/node_modules/@u4

echo "starting server..."
NODE_ENV=production pnpm run build
NODE_PATH=/usr/lib/node_modules NODE_EXTRA_CA_CERTS=/usr/src/node_modules/hue-sync/signify.pem node build/index.js

