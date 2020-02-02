#!/usr/bin/env python3

import sys, json


with open(sys.argv[1]) as jsonFile:
        data = json.load(jsonFile)

timeZero = data['timestamp']
trace = data['trace']

for i in trace:
    state = i
    ts = timeZero + state[0]
    lat = state[1]
    lon = state[2]
    alt = state[3]
    gs = state[4]
    track = state[5]
    stale = state[6]

    outString = str(ts)
    outString += ',' + str(lat)
    outString += ',' + str(lon)
    outString += ',' + str(alt)
    outString += ',' + str(gs)
    outString += ',' + str(track)

    print(outString)
