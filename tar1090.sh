#!/bin/bash

set -e
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
if (( INT_978 > 2 )) || (( INT_978 < 1 )); then
    INT_978=1
fi

if (( GZIP_LVL < 1 || GZIP_LVL > 9 )); then
    echo "gzip level unspecified, using level 1"
    GZIP_LVL=1
fi


# determine number of chunks
chunks=$(( HISTORY_SIZE/CHUNK_SIZE + 1 ))

# increase chunk size to get total history size as close as we can
CHUNK_SIZE=$(( CHUNK_SIZE - ( (CHUNK_SIZE - HISTORY_SIZE % CHUNK_SIZE)/chunks ) ))


if [[ -z $PTRACKS ]]; then
    PTRACKS=8
fi
chunksAll=$(awk "function ceil(x){return int(x)+(x>int(x))} BEGIN {printf ceil($PTRACKS * 3600 / $INTERVAL / $CHUNK_SIZE)}")

if (( chunksAll < chunks )); then
    chunksAll="$chunks"
fi

newChunk() {
    if [[ "$1" != "refresh" ]]; then
        curChunk="chunk_$(date +%s%N | head -c-7).gz"
        echo "$curChunk" >> chunk_list
        echo "$curChunk" >> chunk_list_all
        cp "$1" "$curChunk"
    fi
    for ITEM in $(head -n-$chunksAll chunk_list_all); do
        rm -f "$RUN_DIR/$ITEM"
    done

    tail -n$chunksAll chunk_list_all > chunk_list_all.tmp
    mv chunk_list_all.tmp chunk_list_all

    tail -n$chunks chunk_list > chunk_list.tmp
    mv chunk_list.tmp chunk_list


    # construct chunks.json
    JSON='{'

    if [ -f pf.json ]; then
        JSON+=' "pf_data": "true",'
    fi
    if [[ "$ENABLE_978" == "yes" ]]; then
        JSON+=' "enable_uat": "true",'
    fi

    JSON+=' "chunks": [ '
    JSON+="$(while read -r LINE; do echo -n "\"$LINE\", "; done < chunk_list)"
    JSON+=' "current_large.gz", "current_small.gz" ],'

    JSON+=' "chunks_all": [ '
    JSON+="$(while read -r LINE; do echo -n "\"$LINE\", "; done < chunk_list_all)"
    JSON+=' "current_large.gz", "current_small.gz" ] }'

    echo "$JSON" > "$RUN_DIR/chunks.json"
}

prune() {
    jq -c <"$1" >"$2" '
    .aircraft |= map(select(has("seen") and .seen < '$INTERVAL' + 2))
    | .aircraft[] |= [.hex,
    (if .alt_baro != null then .alt_baro elif .altitude != null then .altitude else .alt_geom end),
    (if .gs != null then .gs else .tas end),
    .track, .lat, .lon, .seen_pos,
    (if .mlat != null and (.mlat | contains(["lat"])) then "mlat"
elif .tisb != null and (.tisb | contains(["lat"])) then "tisb" else .type end),
    .flight, .messages]
    '
}

cd "$RUN_DIR"

rm -f chunk_list chunk_list_all ./chunk_*.gz ./current_*.gz history_*.json latest_*.json || true

echo "{ \"files\" : [ ] }" | gzip -1 > empty.gz
newChunk empty.gz

cp empty.gz current_small.gz
cp empty.gz current_large.gz

# integrate original dump1090-fa history on startup so we don't start blank
if [[ -f "$SRC_DIR"/history_0.json ]]; then
    for i in "$SRC_DIR"/history_*.json; do
        FILE=$(basename "$i")
        if prune "$i" "$FILE"; then
            sed -i -e '$a,' "$FILE"
        fi
    done

    if sed -e '1i{ "files" : [' -e '$a]}' -e '$d' history_*.json | gzip -1 > temp.gz; then
        newChunk temp.gz
    fi
    # cleanup
    rm -f history_*.json
fi

i=0

while true; do
    cd "$RUN_DIR"
    if ! [[ -f chunks.json ]]; then
        echo "$RUN_DIR/chunks.json was corrupted or removed, fatal!"
        exit 1
    fi
    sleep $INTERVAL &

    if ! [[ -f empty.gz ]]; then
        echo "{ \"files\" : [ ] }" | gzip -1 > empty.gz
    fi

    date=$(date +%s%N | head -c-7)

    next_error=0
    error_printed=0
    while ! [[ -f "$SRC_DIR/aircraft.json" ]] || ! prune "$SRC_DIR/aircraft.json" "history_$date.json"; do
        now=$(date +%s%N | head -c-7)
        if (( now > next_error )); then
            if (( next_error != 0 )); then
                echo "No aircraft.json found in $SRC_DIR during the last 30 seconds! Try restarting dump1090 or reinstalling tar1090 if you switched dump1090 to readsb!"
                error_printed=1
            fi
            next_error=$(( now + 10000 ))
        fi
        sleep 2
    done
    if (( error_printed != 0 )); then
        echo "Found aircraft.json in $SRC_DIR, continuing operation as per usual!"
    fi

    sed -i -e '$a,' "history_$date.json"

    if [[ $ENABLE_978 == "yes" ]] && prune 978.json "history_978_$date.json"; then
        sed -i -e '$a,' "history_978_$date.json"
    fi


    if (( i % 6 == 5 )); then
        sed -e '1i{ "files" : [' -e '$a]}' -e '$d' history_*.json | gzip -1 > temp.gz
        mv temp.gz current_large.gz
        cp empty.gz current_small.gz
        rm -f latest_*.json
    else
        if [[ -f "history_$date.json" ]]; then
            ln -s "history_$date.json" "latest_$date.json"
        fi
        if [[ $ENABLE_978 == "yes" ]] && [[ -f "history_978_$date.json" ]]; then
            ln -s "history_978_$date.json" "latest_978_$date.json" || true
        fi
        sed -e '1i{ "files" : [' -e '$a]}' -e '$d' latest_*.json | gzip -1 > temp.gz
        mv temp.gz current_small.gz
    fi

    i=$(( i + 1 ))

    if (( i == CHUNK_SIZE )); then
        sed -e '1i{ "files" : [' -e '$a]}' -e '$d' history_*.json | gzip "-$GZIP_LVL" > temp.gz
        newChunk temp.gz
        cp empty.gz current_small.gz
        cp empty.gz current_large.gz
        i=0
        rm -f history_*.json latest_*.json
    fi

    wait
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

if [[ -n "$PF_URL" ]] && [[ "x$PF_ENABLE" != "x0" ]]; then
    while true
    do
        sleep 10 &
        TMP="$RUN_DIR/tar1090-tmp.pf.json"
        if cd "$RUN_DIR" && wget -T 5 -O "$TMP" "$PF_URL" &>/dev/null; then
            sed -i -e 's/"user_l[a-z]*":"[0-9,.,-]*",//g' "$TMP"
            mv "$TMP" pf.json
            if ! grep -qs -e pf_data chunks.json; then
                newChunk refresh
            fi
        else
            rm -f "$TMP"
            sleep 120
        fi
        wait
    done &
fi

wait -n
