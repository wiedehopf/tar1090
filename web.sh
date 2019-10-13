#!/bin/bash

# file for local testing of changes to the webinterface

ipath=/usr/local/share/tar1090
mkdir -p $ipath

mv $ipath/html/config.js /tmp/

#rm -f $ipath/html/db/*.json
cp -r html $ipath

mv /tmp/config.js $ipath/html/

# bust cache for all css and js files
sed -i -e "s/__cache_version__/$(date +%s)/g" $ipath/html/index.html

