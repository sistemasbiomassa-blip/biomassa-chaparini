#!/bin/bash
# Junta index.dev.html + css/styles.css + js/*.js em um único index.html
# pronto para subir no GitHub (sem depender das pastas css/ e js/).
#
# Uso: bash build.sh
# Edite os arquivos em css/ e js/ (e o markup em index.dev.html), depois
# rode este script antes de fazer commit/upload do index.html.

set -e
cd "$(dirname "$0")"

OUT="index.html"
SRC="index.dev.html"

> "$OUT"

while IFS= read -r line || [ -n "$line" ]; do
  if [[ "$line" == '<link rel="stylesheet" href="css/styles.css">' ]]; then
    echo "<style>" >> "$OUT"
    cat "css/styles.css" >> "$OUT"
    echo "</style>" >> "$OUT"
  elif [[ "$line" =~ ^\<script\ src=\"js/([a-zA-Z0-9_-]+)\.js\"\>\</script\>$ ]]; then
    name="${BASH_REMATCH[1]}"
    echo "<script>" >> "$OUT"
    cat "js/${name}.js" >> "$OUT"
    echo "</script>" >> "$OUT"
  else
    echo "$line" >> "$OUT"
  fi
done < "$SRC"

echo "OK: $OUT gerado a partir de $SRC + css/ + js/"
