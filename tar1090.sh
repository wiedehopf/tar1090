#!/bin/bash

trap "kill 0" SIGINT
trap "kill -2 0" SIGTERM

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


hist=$(($HISTORY_SIZE))
chunks=$(( $hist/$CHUNK_SIZE + 2 ))
#increase chunk size to get history size as close as we can
CHUNK_SIZE=$(( CHUNK_SIZE - ( (CHUNK_SIZE - hist % CHUNK_SIZE)/(chunks-1) ) ))
list="$RUN_DIR/list_of_chunks"

new_chunk() {
	cur_chunk="chunk_$(date +%s).gz"
	echo $cur_chunk >> $list
	for iterator in $(head -n-$chunks $list); do rm -f $RUN_DIR/$iterator; done
	tail -n$chunks $list > newlist
	mv newlist $list
	as_json="$(for i in $(cat $list); do echo -n "\"$i\", "; done)\"chunk_recent.gz\""
	sed -e "s/\"chunks\" : \[.*\]/\"chunks\" : [ $as_json ]/" $RUN_DIR/chunks.json > $RUN_DIR/chunks.tmp
	echo "{ \"files\" : [ ] }" | gzip -1 > $cur_chunk
	mv $RUN_DIR/chunks.tmp $RUN_DIR/chunks.json
}

prune() {
	if jq -c <$1 >$1.pruned '
		.aircraft |= map(select(has("seen_pos") and .seen_pos < 15))
		| .aircraft[] |= [.hex, .alt_baro, .gs, .track, .lat, .lon, .seen_pos, .mlat]
		'
	then
		mv $1.pruned $1
	fi
}

while true
do
	cd $RUN_DIR || { sleep 30; continue; }
	rm -f $list || true
	rm -f $RUN_DIR/*.gz || true
	rm -f $RUN_DIR/*.json || true

	echo '{ "pf_data" : "false", "enable_uat" : "false", "chunks" : [] }' > chunks.json
	if [[ $ENABLE_978 == "yes" ]]; then
		sed -i -e "s?\"enable_uat\" : \"false\"?\"enable_uat\" : \"true\"?" chunks.json
	fi
	echo "{ \"files\" : [ ] }" | gzip -1 > chunk_recent.gz

	# integrate original dump1090-fa history on startup so we don't start blank
	if cp $SRC_DIR/history_*.json $RUN_DIR && [[ -f history_0.json ]]; then
		new_chunk
		sleep 1;
		for i in history_*.json ; do
			prune $i
			sed -i -e '$a,' $i
		done
		sleep 1;
		sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *history_*.json | 7za a -si temp.gz >/dev/null
		mv temp.gz $cur_chunk
		# cleanup
		rm -f history_*.json
	fi

	sleep 1;
	i=0
	new_chunk

	while jq <$RUN_DIR/chunks.json '.chunks' >/dev/null 2>&1
	do
		sleep $INTERVAL &

		date=$(date +%s)

		if ! cd $RUN_DIR || ! cp $SRC_DIR/aircraft.json history_$date.json &>/dev/null
		then
			sleep 0.1
			if ! cd $RUN_DIR || ! cp $SRC_DIR/aircraft.json history_$date.json &>/dev/null
			then
				echo "No aircraft.json found in $SRC_DIR! Try restarting dump1090!"
				sleep 60
				continue;
			fi
		fi

		prune history_$date.json
		sed -i -e '$a,' history_$date.json

		if [[ $ENABLE_978 == "yes" ]]; then
			if cp 978.json 978_history_$date.json; then
				prune 978_history_$date.json
				sed -i -e '$a,' 978_history_$date.json
			fi
		fi



		if [[ $((i%6)) == 5 ]]
		then
			sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *history_*.json | gzip -4 > temp.gz
			mv temp.gz $cur_chunk
			echo "{ \"files\" : [ ] }" | gzip -1 > rec_temp.gz
			mv rec_temp.gz chunk_recent.gz
			rm -f *latest_*.json
		else
			if [ -f history_$date.json ]; then
				ln -s history_$date.json latest_$date.json
			fi
			if [[ $ENABLE_978 == "yes" ]] && [ -f 978_history_$date.json ]; then
				ln -s 978_history_$date.json 978_latest_$date.json || true
			fi
			sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *latest_*.json | gzip -1 > temp.gz
			mv temp.gz chunk_recent.gz
		fi

		i=$((i+1))

		if [[ $i == $CHUNK_SIZE ]]
		then
			sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *history_*.json | 7za a -si temp.gz >/dev/null
			mv temp.gz $cur_chunk
			echo "{ \"files\" : [ ] }" | gzip -1 > rec_temp.gz
			mv rec_temp.gz chunk_recent.gz
			i=0
			rm -f *history_*.json
			rm -f *latest_*.json
			new_chunk
		fi

		wait
	done
	echo "$RUN_DIR/chunks.json was corrupted or removed, restarting history chunk creation!"
done &

if [[ $(echo $URL_978 | head -c7) == "FILE://" ]]; then
	COMMAND_978="cp $(echo -n $URL_978 | tail -c+8) 978.tmp"
else
	COMMAND_978="wget -T 5 -q -O 978.tmp $URL_978/data/aircraft.json $COMPRESS_978"
fi

if [[ $ENABLE_978 == "yes" ]]; then
	while true
	do
		sleep $INT_978 &
		if cd $RUN_DIR && $COMMAND_978; then
			sed -i -e 's/"now" \?:/"uat_978":"true","now":/' 978.tmp
			mv 978.tmp 978.json
		fi
		wait
	done &
fi

sleep 3

while [[ -n $PF_URL ]]
do
	sleep 10 &
	TMP="pf.$RANDOM$RANDOM"
	if cd $RUN_DIR && wget -T 5 -q -O $TMP $PF_URL 2>/dev/null; then
		sed -i -e 's/"user_l[a-z]*":"[0-9,.,-]*",//g' $TMP
		mv $TMP pf.json
		if grep -qs -F -e '"pf_data" : "false"' chunks.json; then
			sleep 0.314
			cp chunks.json chunks.json.pf_data
			sed -i -e "s?\"pf_data\" : \"false\"?\"pf_data\" : \"true\"?" chunks.json.pf_data
			mv chunks.json.pf_data chunks.json
		fi
	else
		sleep 120
	fi
	wait
done &

wait
exit 0
