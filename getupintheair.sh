#!/bin/bash

ID="$1"

if [[ -z $1 ]]; then
    echo "no ID supplied"
    exit
fi

ALTS="12192"
if [[ -n $2 ]]; then
	ALTS="$2"
fi

instance=tar1090
if [[ -n $3 ]]; then
	instance="tar1090-$3"
fi


wget -nv -O "/usr/local/share/${instance}/html/upintheair.json" "http://www.heywhatsthat.com/api/upintheair.json?id=${ID}&refraction=0.25&alts=${ALTS}"

