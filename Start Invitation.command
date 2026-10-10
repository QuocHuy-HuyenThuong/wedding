#!/bin/zsh
cd "$(dirname "$0")"
PORT="${PORT:-4173}" node server.js
