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
chunks=$(( $hist/$CS ))
partial=$(($hist%$CS))
if [[ $partial != 0 ]]
then actual_chunks=$(($chunks+2))
else actual_chunks=$(($chunks+1))
fi


while true
do
	cd $dir
	rm -f $dir/*.gz
	rm -f $dir/*.json

	if ! cp $SOURCE/receiver.json chunks.json
	then
		sleep 60
		continue
	fi
	if [[ $ENABLE_978 == "yes" ]]; then
		sed -i -e "s?history\" : [0-9]*?chunks\" : $actual_chunks, \"enable_uat\" : \"true\"?" chunks.json
	else
		sed -i -e "s/history\" : [0-9]*/chunks\" : $actual_chunks/" chunks.json
	fi

	# integrate original dump1090-fa history on startup so we don't start blank
	cp $SOURCE/history_*.json $dir
	if [[ -f history_0.json ]]; then
		for i in history_*.json ; do
			sed -i -e '$a,' $i
		done
		sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *history_*.json | gzip -9 > temp.gz
		mv temp.gz chunk_0.gz
	fi
	# cleanup
	rm -f history_*.json



	# start with chunk 1 instead of 0 to not overwrite original dump1090-fa history just in case
	i=0
	j=1

	sleep 2;

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
			mv temp.gz chunk_$j.gz
			rm -f *latest_*.json chunk_$(($actual_chunks - 1)).gz
		else
			cp history_$((i%$CS)).json latest_$((i%6)).json
			if [[ $ENABLE_978 == "yes" ]]; then
				cp 978_history_$((i%$CS)).json 978_latest_$((i%6)).json
			fi
			sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *latest_*.json | gzip -1 > temp.gz
			mv temp.gz chunk_$(($actual_chunks - 1)).gz
		fi

		i=$((i+1))

		if [[ $i == $CS ]]
		then
			sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *history_*.json | gzip -9 > temp.gz
			mv temp.gz chunk_$j.gz
			i=0
			j=$((j+1))
			rm -f *history_*.json
		fi
		if [[ $j == $chunks ]] && [[ $i == $partial ]]
		then
			if [[ $i != 0 ]]; then
				# only necessary if the last chunk is a partial one
				sed -e '1i{ "files" : [' -e '$a]}' -e '$d' *history_*.json | gzip -9 > temp.gz
				mv temp.gz chunk_$j.gz
			fi
			# reset counters and do cleanup
			i=0
			j=0
			rm -f *history_*.json
		fi

		wait
	done
	sleep 5
done &

while [[ $ENABLE_978 == "yes" ]]
do
	sleep 1 &
	wget -T 5 -q -O $dir/978.tmp $URL_978/data/aircraft.json
	sed -i -e 's/"now" \?:/"uat_978":"true","now":/' $dir/978.tmp
	mv $dir/978.tmp $dir/978.json
	wait
done &

wait

exit 0


