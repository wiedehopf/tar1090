#!/bin/bash

trap "kill 0" SIGINT
trap "kill -2 0" SIGTERM
INTERVAL=10
HISTORY_SIZE=360
CS=60
SOURCE=/run/dump1090-fa
source /etc/default/tar1090

dir=/run/tar1090
hist=$(($HISTORY_SIZE))
chunks=$(( $hist/$CS + 2 ))
#increase chunk size to get history size as close as we can
CS=$(( CS - ( (CS - hist % CS)/(chunks-1) ) ))
list="$dir/list_of_chunks"

new_chunk() {
	cur_chunk="chunk_$(date +%s).gz"
	echo $cur_chunk >> $list
	for iterator in $(head -n-$chunks $list); do rm -f $dir/$iterator; done
	tail -n$chunks $list > newlist
	mv newlist $list
	as_json="\"chunk_recent.gz\"$(for i in $(cat $list); do echo -n ", \"$i\""; done)"
	sed -e "s/\"chunks\" : \[.*\]/\"chunks\" : [ $as_json ]/" $dir/chunks.json > $dir/chunks.tmp
	echo "{ \"files\" : [ ] }" | gzip -1 > $cur_chunk
	mv $dir/chunks.tmp $dir/chunks.json
}

while true
do
	cd $dir
	rm -f $list
	rm -f $dir/*.gz
	rm -f $dir/*.json

	if ! cp $SOURCE/receiver.json chunks.json
	then
		sleep 60
		continue
	fi
	if [[ $ENABLE_978 == "yes" ]]; then
		sed -i -e "s?history\" : [0-9]*?chunks\" : [], \"enable_uat\" : \"true\"?" chunks.json
	else
		sed -i -e "s/history\" : [0-9]*/chunks\" : []/" chunks.json
	fi

	# integrate original dump1090-fa history on startup so we don't start blank
	cp $SOURCE/history_*.json $dir
	if [[ -f history_0.json ]]; then
		for i in history_*.json ; do
			sed -i -e '$a,' $i
		done
		sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *history_*.json | gzip -9 > temp.gz
		new_chunk
		mv temp.gz $cur_chunk
	fi
	# cleanup
	rm -f history_*.json

	sleep 2;
	i=0
	new_chunk

	while true
	do
		sleep $INTERVAL &

		source <(grep -F -e INTERVAL /etc/default/tar1090)

		cd $dir
		if ! cp $SOURCE/aircraft.json history_$((i%$CS)).json &>/dev/null
		then
			sleep 0.05
			cp $SOURCE/aircraft.json history_$((i%$CS)).json
		fi
		sed -i -e '$a,' history_$((i%$CS)).json
		sed -i -e 's/,"alt_geom":[^,^}]*//' -e 's/,"gs":[^,^}]*//' -e 's/,"ias":[^,^}]*//' -e 's/,"tas":[^,^}]*//' -e 's/,"track_rate":[^,^}]*//' -e 's/,"mag_heading":[^,^}]*//' -e 's/,"mach":[^,^}]*//' -e 's/,"roll":[^,^}]*//' -e 's/,"nav_qnh":[^,^}]*//' -e 's/,"nav_altitude_mcp":[^,^}]*//' -e 's/,"nav_altitude_fms":[^,^}]*//' -e 's/,"nac":[^,^}]*//' -e 's/,"nac":[^,^}]*//' -e 's/,"nic":[^,^}]*//' -e 's/,"nic_baro":[^,^}]*//' -e 's/,"sil_type":[^,^}]*//' -e 's/,"sil":[^,^}]*//' -e 's/,"nav_heading":[^,^}]*//' -e 's/,"baro_rate":[^,^}]*//' -e 's/,"geom_rate":[^,^}]*//' -e 's/,"rc":[^,^}]*//' -e 's/,"squawk":[^,^}]*//' -e 's/,"category":[^,^}]*//' -e 's/,"version":[^,^}]*//' -e 's/,"flight":[^,^}]*//' -e 's/,"rssi":[^,^}]*//' -e 's/,"emer":[^,^}]*//' -e 's/,"sda":[^,^}]*//' -e 's/,"gva":[^,^}]*//' history_$((i%$CS)).json

		if [[ $ENABLE_978 == "yes" ]]; then
			cp $dir/978.json $dir/978_history_$((i%$CS)).json
			sed -i -e '$a,' 978_history_$((i%$CS)).json
		fi



		if [[ $((i%6)) == 5 ]]
		then
			sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *history_*.json | gzip -1 > temp.gz
			echo "{ \"files\" : [ ] }" | gzip -1 > rec_temp.gz
			mv temp.gz $cur_chunk
			mv rec_temp.gz chunk_recent.gz
			rm -f *latest_*.json
		else
			cp history_$((i%$CS)).json latest_$((i%6)).json
			if [[ $ENABLE_978 == "yes" ]]; then
				cp 978_history_$((i%$CS)).json 978_latest_$((i%6)).json
			fi
			sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *latest_*.json | gzip -1 > temp.gz
			mv temp.gz chunk_recent.gz
		fi

		i=$((i+1))

		if [[ $i == $CS ]]
		then
			sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *history_*.json | gzip -9 > temp.gz
			mv temp.gz $cur_chunk
			i=0
			rm -f *history_*.json
			new_chunk
		fi

		wait
	done
	sleep 5
done &

while [[ $ENABLE_978 == "yes" ]]
do
	sleep 1 &
	wget -T 5 -q --compression=auto -O $dir/978.tmp $URL_978/data/aircraft.json
	sed -i -e 's/"now" \?:/"uat_978":"true","now":/' $dir/978.tmp
	mv $dir/978.tmp $dir/978.json
	wait
done &

wait

exit 0


