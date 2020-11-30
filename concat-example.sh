# cache busting and concatenation example
function magic() {
    FN="$1.$2"
    MD5="$1_$(md5sum "$FN" | cut -f1 -d' ').$2"
    sed -i -e "s/$FN/$MD5/" index.html
    mv "$FN" "$MD5"
}


for file in $(grep -oP -e '"stylesheet" href="\K[^"]*' index.html); do
    sed -i -e "\\#$file#d" index.html
    cat "$file" >> all.css
done
sed -i -e 's$.*CSS_ANCHOR.*$\0\n<link rel="stylesheet" href="all.css" type="text/css" />$' index.html
magic all css


for file in $(grep -oP -e 'script src="\K[^"]*' index.html); do
    sed -i -e "\\#$file#d" index.html
    cat "$file" >> all.js
done
sed -i -e 's$.*JS_ANCHOR.*$\0\n<script src="all.js"></script>$' index.html
magic all js


DB_VERSION=$(date +%s)
# or better
DB_VERSION=$(git rev-parse --short HEAD)
sed -i -e "s/let databaseFolder = .*;/let databaseFolder = \"db-$DB_VERSION\";/" index.html
