#!/bin/bash

trap "kill 0" SIGINT
trap "kill -2 0" SIGTERM

#set -e

if [[ -z $rundir && -z $srcdir ]]
then
	echo "runtime directory and source directory are not specified, fatal error!"
	exit 1
fi
if [[ -z $HISTORY_SIZE && -z $INTERVAL && -z $CS ]]
then
	echo "Missing some settings from environment variables, using defaults"
	INTERVAL=10
	HISTORY_SIZE=360
	CS=60
fi


hist=$(($HISTORY_SIZE))
chunks=$(( $hist/$CS + 2 ))
#increase chunk size to get history size as close as we can
CS=$(( CS - ( (CS - hist % CS)/(chunks-1) ) ))
list="$rundir/list_of_chunks"

new_chunk() {
	cur_chunk="chunk_$(date +%s).gz"
	echo $cur_chunk >> $list
	for iterator in $(head -n-$chunks $list); do rm -f $rundir/$iterator; done
	tail -n$chunks $list > newlist
	mv newlist $list
	as_json="$(for i in $(cat $list); do echo -n "\"$i\", "; done)\"chunk_recent.gz\""
	sed -e "s/\"chunks\" : \[.*\]/\"chunks\" : [ $as_json ]/" $rundir/chunks.json > $rundir/chunks.tmp
	echo "{ \"files\" : [ ] }" | gzip -1 > $cur_chunk
	mv $rundir/chunks.tmp $rundir/chunks.json
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
	cd $rundir
	rm -f $list || true
	rm -f $rundir/*.gz || true
	rm -f $rundir/*.json || true

	echo '{ "pf_data" : "false", "enable_uat" : "false", "chunks" : [] }' > chunks.json
	if [[ $ENABLE_978 == "yes" ]]; then
		sed -i -e "s?\"enable_uat\" : \"false\"?\"enable_uat\" : \"true\"?" chunks.json
	fi
	echo "{ \"files\" : [ ] }" | gzip -1 > chunk_recent.gz

	# integrate original dump1090-fa history on startup so we don't start blank
	if cp $srcdir/history_*.json $rundir && [[ -f history_0.json ]]; then
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

	while jq <$rundir/chunks.json '.chunks' >/dev/null 2>&1
	do
		sleep $INTERVAL &

		date=$(date +%s)

		if ! cd $rundir || ! cp $srcdir/aircraft.json history_$date.json &>/dev/null
		then
			sleep 0.1
			if ! cd $rundir || ! cp $srcdir/aircraft.json history_$date.json &>/dev/null
			then
				echo "No aircraft.json found in $srcdir! Try restarting dump1090!"
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

		if [[ $i == $CS ]]
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
	echo "$rundir/chunks.json was corrupted or removed, restarting history chunk creation!"
done &

while true
do
	sleep $INT_978 &

	if [[ $ENABLE_978 != "yes" ]]; then sleep 30; continue; fi

	if cd $rundir && wget -T 5 -q -O 978.tmp $URL_978/data/aircraft.json $COMPRESS_978; then
		sed -i -e 's/"now" \?:/"uat_978":"true","now":/' 978.tmp
		mv 978.tmp 978.json
	fi
	wait
done &

sleep 3

while true
do
	sleep 10 &
	if cd $rundir && wget -T 5 -q -O pf.tmp http://127.0.0.1:30053/ajax/aircraft 2>/dev/null; then
		sed -i -e 's/"user_l[a-z]*":"[0-9,.,-]*",//g' pf.tmp
		mv pf.tmp pf.json
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


