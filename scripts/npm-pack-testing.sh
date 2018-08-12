#!/usr/bin/env bash
set -e

npm run dist
npm run pack

TMPDIR="/tmp/npm-pack-testing.$$"
mkdir "$TMPDIR"
mv *-*.*.*.tgz "$TMPDIR"
cp tests/fixtures/smoke-testing.ts "$TMPDIR"

cd $TMPDIR
npm init -y
npm install *-*.*.*.tgz \
  @types/lru-cache \
  @types/node \
  @types/normalize-package-data \
  @types/promise-retry \
  file-box \
  memory-card \
  typescript \
  wechaty-puppet@next \

./node_modules/.bin/tsc \
  --esModuleInterop \
  --lib esnext \
  --noEmitOnError \
  --noImplicitAny \
  --target es6 \
  --module commonjs \
  smoke-testing.ts

node smoke-testing.js
