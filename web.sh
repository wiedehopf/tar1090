#!/bin/bash

# file for local testing of changes to the webinterface

ipath=/usr/local/share/tar1090

if [ -z $1 ]; then
	htmlpath="$ipath/html"
else
	htmlpath="$ipath/$1-html"
fi
echo $htmlpath
mkdir -p $htmlpath

mv $htmlpath/config.js /tmp/

cp -r -T html $htmlpath

mv /tmp/config.js $htmlpath

# bust cache for all css and js files
sed -i -e "s/__cache_version__/$(date +%s)/g" $htmlpath/index.html

