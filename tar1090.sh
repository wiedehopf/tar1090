#!/bin/bash

trap 'echo ERROR on line number $LINENO' ERR

RUN_DIR=$1
SRC_DIR=$2

if ! [[ -d $RUN_DIR ]]; then
    echo "runtime directory (first argument: $RUN_DIR) is not a directory, fatal error!"
    exit 1
fi

if [[ -z $SRC_DIR ]]; then
    echo "source directory (2nd argument) not specified, fatal error!"
    exit 1
fi

if [[ -z $HISTORY_SIZE || -z $INTERVAL || -z $CHUNK_SIZE ]]
then
    echo "Syntax: bash tar1090.sh <runtime directory> <dump1090 source directory>"
    echo "Missing some settings from environment variables, using defaults:"
    echo "history interval: 8 seconds"
    echo "history size: 450 entries"
    echo "chunk size: 60 entries"
    echo "really either use the file named default as a systemd environment file or export those variables yourself"
    echo "in other words: figure it out ;)"
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
if (( ${#INT_978} > 2 )) || (( ${#INT_978} < 1 )); then
    INT_978=1
fi

if (( ${#GZIP_LVL} < 1 || ${#GZIP_LVL} > 9 ));
then
    echo "gzip level unspecified, using level 3"
    GZIP_LVL=3
fi


hist=$((HISTORY_SIZE))
chunks=$(( hist/CHUNK_SIZE + 1 ))
#increase chunk size to get history size as close as we can
CHUNK_SIZE=$(( CHUNK_SIZE - ( (CHUNK_SIZE - hist % CHUNK_SIZE)/chunks ) ))

new_chunk() {
    if [[ $1 != "refresh" ]]; then
        cur_chunk="chunk_$(date +%s%N | head -c-7).gz"
        echo "$cur_chunk" >> chunk_list
        cp "$1" "$cur_chunk"
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
    JSON="$JSON"' "current_large.gz", "current_small.gz" ] }'

    echo "$JSON" > "$RUN_DIR/chunks.json"
}

prune() {
    jq -c <"$1" >"$2" '
    .aircraft |= map(select(has("seen") and .seen < 15))
    | .aircraft[] |= [.hex,
    (if .alt_baro != null then .alt_baro elif .altitude != null then .altitude else .alt_geom end),
    (if .gs != null then .gs else .tas end),
    .track, .lat, .lon, .seen_pos,
    (if .mlat != null and (.mlat | contains(["lat"])) then "mlat"
elif .tisb != null and (.tisb | contains(["lat"])) then "tisb" else .type end),
    .flight, .messages]
    '
}

while true
do
    cd "$RUN_DIR" || { sleep 30; continue; }
    echo "{ \"files\" : [ ] }" | gzip -1 > empty.gz
    new_chunk empty.gz
    if ! [ -f "$SRC_DIR/aircraft.json" ]; then
        echo "No aircraft.json found in $SRC_DIR! Try restarting dump1090!"
        sleep 180
        continue
    fi
    rm -f chunk_list ./chunk_*.gz ./current_*.gz history_*.json latest_*.json || true

    cp empty.gz current_small.gz
    cp empty.gz current_large.gz
    touch chunk_list

    # integrate original dump1090-fa history on startup so we don't start blank
    if [[ -f "$SRC_DIR"/history_0.json ]]; then
        for i in "$SRC_DIR"/history_*.json
        do
            FILE=$(basename "$i")
            if prune "$i" "$FILE"; then
                sed -i -e '$a,' "$FILE"
            fi
        done

        if sed -e '1i{ "files" : [' -e '$a]}' -e '$d' history_*.json | gzip -1 > temp.gz; then
            new_chunk temp.gz
        fi
        # cleanup
        rm -f history_*.json
    fi

    i=0

    while [ -f chunks.json ]
    do
        cd "$RUN_DIR" || { sleep 30; continue; }
        sleep $INTERVAL &

        if ! [ -f empty.gz ]; then
            echo "{ \"files\" : [ ] }" | gzip -1 > empty.gz
        fi

        if ! [ -f "$SRC_DIR/aircraft.json" ]; then
            echo "No aircraft.json found in $SRC_DIR! Try restarting dump1090!"
            sleep 60
            continue
        fi

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
            sed -e '1i{ "files" : [' -e '$a]}' -e '$d' history_*.json | gzip -1 > temp.gz
            mv temp.gz current_large.gz
            cp empty.gz current_small.gz
            rm -f latest_*.json
        else
            if [ -f "history_$date.json" ]; then
                ln -s "history_$date.json" "latest_$date.json"
            fi
            if [[ $ENABLE_978 == "yes" ]] && [ -f "history_978_$date.json" ]; then
                ln -s "history_978_$date.json" "latest_978_$date.json" || true
            fi
            sed -e '1i{ "files" : [' -e '$a]}' -e '$d' latest_*.json | gzip -1 > temp.gz
            mv temp.gz current_small.gz
        fi

        i=$((i+1))

        if [[ $i == "$CHUNK_SIZE" ]]
        then
            sed -e '1i{ "files" : [' -e '$a]}' -e '$d' history_*.json | gzip "-$GZIP_LVL" > temp.gz
            new_chunk temp.gz
            cp empty.gz current_small.gz
            cp empty.gz current_large.gz
            i=0
            rm -f history_*.json latest_*.json
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
    TMP="/tmp/tar1090-tmp.pf.json.$RANDOM$RANDOM"
    while true
    do
        sleep 10 &
        if cd "$RUN_DIR" && wget -T 5 -q -O $TMP "$PF_URL" &>/dev/null; then
            sed -i -e 's/"user_l[a-z]*":"[0-9,.,-]*",//g' $TMP
            mv $TMP pf.json
            if ! grep -qs -e pf_data chunks.json; then
                new_chunk refresh
            fi
        else
            rm -f $TMP
            sleep 120
        fi
        wait
    done &
fi

wait -n
