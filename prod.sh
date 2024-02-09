#!/bin/bash
echo "production mode!"

cd /usr/src

echo "starting server..."
NODE_ENV=production pnpm run build
NODE_EXTRA_CA_CERTS=/usr/src/node_modules/hue-sync/signify.pem node build/index.js

