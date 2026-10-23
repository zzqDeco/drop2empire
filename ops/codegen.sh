#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GOPATH_BIN="$(go env GOPATH)/bin"
export PATH="${GOPATH_BIN}:${PATH}"

if ! command -v node >/dev/null 2>&1; then
  echo "missing required codegen binary: node" >&2
  exit 1
fi

if command -v thriftgo >/dev/null 2>&1; then
  (
    cd "${ROOT_DIR}/contracts/gen/game"
    rm -rf hertz_gen
    thriftgo -g go:template=slim,no_default_serdes=true,no_processor=true -o hertz_gen "../../game/http_empire.thrift"
  )
fi

node "${ROOT_DIR}/tools/thrift-go-http-codegen/index.mjs"
node "${ROOT_DIR}/tools/thrift-ts-codegen/index.mjs"
