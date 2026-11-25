#!/bin/sh
set -eu
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 /path/to/verified-graph local-image-tag" >&2
  exit 2
fi

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
graph=$(CDPATH= cd -- "$1" && pwd)
test -f "$graph/release.json"
test -f "$graph/config.json"
test -d "$graph/tiles"
context=$(mktemp -d)
trap 'rm -rf "$context"' EXIT
mkdir "$context/graph"
cp "$script_dir/attested-service.py" "$script_dir/image.env" "$context/"
cp "$graph/release.json" "$graph/config.json" "$context/graph/"
cp -R "$graph/tiles" "$context/graph/"
chmod -R a+rX,go-w "$context/graph"
tag=$2
image=$(sed -n 's/^VALHALLA_IMAGE=//p' "$script_dir/image.env")
sed "s|^FROM .*|FROM $image|" "$script_dir/Dockerfile.release" > "$context/Dockerfile"
docker build -t "$tag" "$context"
