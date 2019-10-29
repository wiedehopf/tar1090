#!/bin/bash

trap "exit" INT TERM
trap "kill 0" EXIT
trap 'echo ERROR on line number $LINENO' ERR

#set -e

RUN_DIR=$1
SRC_DIR=$2
INTERVAL=$3
HISTORY_SIZE=$4
CHUNK_SIZE=$5

ENABLE_978=$6
URL_978=$7
INT_978=$8
PF_URL=$9
COMPRESS_978=${10}

if ! [[ -d $RUN_DIR && -d $SRC_DIR ]]
then
	echo "runtime directory or source directory are not specified or not directories, fatal error!"
	echo "minimal Syntax: bash tar1090.sh <runtime directory> <dump1090 source directory>"
	echo "Syntax: bash tar1090.sh <runtime directory> <dump1090 source directory> <history interval> <history size> <chunk size> <enable 978 yes/no> <URL for 978 aircraft.json> <interval 978 is updated>"
	exit 1
fi
if [[ -z $HISTORY_SIZE || -z $INTERVAL || -z $CHUNK_SIZE ]]
then
	echo "Syntax: bash tar1090.sh <runtime directory> <dump1090 source directory> <history interval> <history size> <chunk size> <enable 978 yes/no> <URL for 978 aircraft.json> <interval 978 is updated>"
	echo "Missing some settings from environment variables, using defaults:"
	echo "history interval: 8 seconds"
	echo "history size: 450 entries"
	echo "chunk size: 60 entries"
	INTERVAL=8
	HISTORY_SIZE=450
	CHUNK_SIZE=60
fi
if [[ -z $URL_978 ]]; then
	ENABLE_978=no
fi
if [[ -z $INT_978 ]]; then
	INT_978=1
fi


hist=$((HISTORY_SIZE))
chunks=$(( hist/CHUNK_SIZE + 2 ))
#increase chunk size to get history size as close as we can
CHUNK_SIZE=$(( CHUNK_SIZE - ( (CHUNK_SIZE - hist % CHUNK_SIZE)/(chunks-1) ) ))

new_chunk() {
	if [[ $1 != "refresh" ]]; then
		cur_chunk="chunk_$(date +%s%N | head -c-7).gz"
		echo "$cur_chunk" >> chunk_list
		echo "{ \"files\" : [ ] }" | gzip -1 > "$cur_chunk"
	fi
	for iterator in $(head -n-$chunks chunk_list); do rm -f "$RUN_DIR/$iterator"; done
	tail -n$chunks chunk_list > chunk_list.tmp
	mv chunk_list.tmp chunk_list

	# construct chunks.json
	JSON='{'

	if [ -f pf.json ]; then JSON="$JSON"' "pf_data": "true",'; fi
	if [[ "$ENABLE_978" == "yes" ]]; then JSON="$JSON"' "enable_uat": "true",'; fi

	JSON="$JSON"' "chunks": [ '
	JSON="$JSON""$(while read -r i; do echo -n "\"$i\", "; done < chunk_list)"
	JSON="$JSON"' "chunk_recent.gz" ] }'

	echo "$JSON" > "$RUN_DIR/chunks.json"
}

prune() {
	jq -c <"$1" >"$2" '
		.aircraft |= map(select(has("seen_pos") and .seen_pos < 15))
		| .aircraft[] |= [.hex,
		(if .alt_baro != null then .alt_baro else .alt_geom end),
		(if .gs != null then .gs else .tas end),
		.track, .lat, .lon, .seen_pos,
		(if .mlat != null and (.mlat | contains(["lat"])) then "mlat"
		elif .tisb != null and (.tisb | contains(["lat"])) then "tisb" else .type end),
		.flight]
		'
}

while true
do
	cd "$RUN_DIR" || { sleep 30; continue; }
	rm -f chunk_list ./chunk_*.gz history_*.json latest_*.json || true

	new_chunk

	# integrate original dump1090-fa history on startup so we don't start blank
	for i in "$SRC_DIR"/history_*.json
	do
		FILE=$(basename "$i")
		if prune "$i" "$FILE"; then
			sed -i -e '$a,' "$FILE"
		fi
	done

	if sed -e '1i{ "files" : [' -e '$a]}' -e '$d' history_*.json | 7za a -si temp.gz >/dev/null; then
		mv temp.gz "$cur_chunk"
		new_chunk
	fi
	# cleanup
	rm -f history_*.json

	i=0

	while [ -f chunks.json ]
	do
		cd "$RUN_DIR" || { sleep 30; continue; }
		sleep $INTERVAL &

		date=$(date +%s%N | head -c-7)

		if prune "$SRC_DIR/aircraft.json" "history_$date.json" ||
			{ sleep 0.1 && prune "$SRC_DIR/aircraft.json" "history_$date.json"; }
		then
			sed -i -e '$a,' "history_$date.json"
		else
			echo "No aircraft.json found in $SRC_DIR! Try restarting dump1090!"
			sleep 60
			continue
		fi

		if [[ $ENABLE_978 == "yes" ]] && prune 978.json "history_978_$date.json"; then
			sed -i -e '$a,' "history_978_$date.json"
		fi


		if [[ $((i%6)) == 5 ]]
		then
			sed -e '1i{ "files" : [' -e '$a]}' -e '$d' history_*.json | gzip -4 > temp.gz
			mv temp.gz "$cur_chunk"
			echo "{ \"files\" : [ ] }" | gzip -1 > rec_temp.gz
			mv rec_temp.gz chunk_recent.gz
			rm -f latest_*.json
		else
			if [ -f "history_$date.json" ]; then
				ln -s "history_$date.json" "latest_$date.json"
			fi
			if [[ $ENABLE_978 == "yes" ]] && [ -f "history_978_$date.json" ]; then
				ln -s "history_978_$date.json" "latest_978_$date.json" || true
			fi
			sed -e '1i{ "files" : [' -e '$a]}' -e '$d' latest_*.json | gzip -1 > temp.gz
			mv temp.gz chunk_recent.gz
		fi

		i=$((i+1))

		if [[ $i == "$CHUNK_SIZE" ]]
		then
			sed -e '1i{ "files" : [' -e '$a]}' -e '$d' history_*.json | 7za a -si temp.gz >/dev/null
			mv temp.gz "$cur_chunk"
			echo "{ \"files\" : [ ] }" | gzip -1 > rec_temp.gz
			mv rec_temp.gz chunk_recent.gz
			i=0
			rm -f history_*.json latest_*.json
			new_chunk
		fi

		wait
	done
	echo "$RUN_DIR/chunks.json was corrupted or removed, restarting history chunk creation!"
done &

if [[ $(echo "$URL_978" | head -c7) == "FILE://" ]]; then
	COMMAND_978="cp $(echo -n "$URL_978" | tail -c+8) 978.tmp"
else
	COMMAND_978="wget -T 5 -q -O 978.tmp $URL_978/data/aircraft.json $COMPRESS_978"
fi

if [[ $ENABLE_978 == "yes" ]]; then
	while true
	do
		sleep $INT_978 &
		if cd "$RUN_DIR" && $COMMAND_978; then
			sed -i -e 's/"now" \?:/"uat_978":"true","now":/' 978.tmp
			mv 978.tmp 978.json
		fi
		wait
	done &
fi

sleep 10

if [[ -n $PF_URL ]]; then
	while true
	do
		sleep 10 &
		TMP="pf.$RANDOM$RANDOM"
		if cd "$RUN_DIR" && wget -T 5 -q -O $TMP "$PF_URL" &>/dev/null; then
			sed -i -e 's/"user_l[a-z]*":"[0-9,.,-]*",//g' $TMP
			mv $TMP pf.json
			if ! grep -qs -e pf_data chunks.json; then
				new_chunk refresh
			fi
		else
			sleep 120
		fi
		wait
	done &
fi

wait -n
