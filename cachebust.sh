#!/bin/bash

set -e
trap 'echo "[ERROR] Error in line $LINENO when executing: $BASH_COMMAND"' ERR

if [[ -z "$1" ]] || [[ -z "$2" ]]; then
    echo "ERROR: usage: ./cachebust.sh <path_to_cachebust.list> <tar1090_html_folder>"
    exit 1
fi

LISTPATH="$1"
HTMLFOLDER="$2"

sedreplaceargs=()

SCRIPT_JS=""
while read -r FILE; do
    md5sum=$(md5sum "$FILE" | cut -d' ' -f1)
    prefix=$(cut -d '.' -f1 <<< "$FILE")
    postfix=$(cut -d '.' -f2 <<< "$FILE")
    newname="${prefix}_${md5sum}.${postfix}"
    mv "$FILE" "$newname"
    sedreplaceargs+=("-e" "s#${FILE}#${newname}#")
    if [[ "$FILE" == "script.js" ]]; then
        SCRIPT_JS="$newname"
    fi
done < "$LISTPATH"

sed -i "${sedreplaceargs[@]}" "$HTMLFOLDER"/index.html
sed -i "${sedreplaceargs[@]}" "$HTMLFOLDER"/"$SCRIPT_JS"
