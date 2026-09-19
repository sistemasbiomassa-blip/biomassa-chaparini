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
  # Tira o CR final: se o fonte for salvo com quebra de linha do Windows (CRLF), a
  # comparacao exata abaixo nao bate em nada e o build gera um index.html SEM embutir
  # css/js — falha silenciosa que ja aconteceu. Ver a checagem no fim do script.
  line="${line%$'\r'}"
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

# Conferencia: se sobrou referencia a css/ ou js/ soltos, o build nao embutiu nada.
# Melhor falhar aqui do que publicar um index.html quebrado achando que deu certo.
restantes=$(grep -c -E '<script src="js/|<link rel="stylesheet" href="css/' "$OUT" || true)
if [ "$restantes" -ne 0 ]; then
  echo "ERRO: $OUT ficou com $restantes referencia(s) a css/ ou js/ soltos — nada foi embutido." >&2
  echo "      Causa provavel: $SRC salvo com quebra de linha CRLF (Windows)." >&2
  exit 1
fi

echo "OK: $OUT gerado a partir de $SRC + css/ + js/ ($(wc -c < "$OUT") bytes)"
