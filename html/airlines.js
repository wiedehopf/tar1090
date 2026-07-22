// airlines.js
// Loads the IATA -> ICAO callsign prefix table from OpenTravelData at
// runtime and caches it in localStorage, so it's fetched at most once
// per AIRLINE_CACHE_MAX_AGE_MS instead of on every page load.
"use strict";

const AIRLINE_CSV_URL = "https://raw.githubusercontent.com/opentraveldata/opentraveldata/master/opentraveldata/optd_airline_best_known_so_far.csv";
const AIRLINE_CACHE_KEY = "tar1090_iata_to_icao_v1";
const AIRLINE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

let iata_to_icao = {};

function parseAirlineCsv(text) {
    // Columns: pk^env_id^validity_from^validity_to^3char_code^2char_code^...^type^...
    // Only currently valid (validity_to empty) entries are kept. Passenger
    // entries are preferred over cargo ones when both exist for the same
    // IATA code (see the Lufthansa/Lufthansa Cargo special case in
    // iataToIcao() in planeObject.js), but a cargo-only entry is still
    // used when it's the only mapping available for that IATA code.
    const map = {};
    const cargoOnly = {};
    const lines = text.split('\n');
    for (let i = 1; i < lines.length; i++) {
        const f = lines[i].split('^');
        if (f.length < 12) {
            continue;
        }
        const validityTo = (f[3] || '').trim();
        const icao3 = (f[4] || '').trim();
        const iata2 = (f[5] || '').trim();
        const type = (f[11] || '').trim();
        if (!/^[A-Z0-9]{2}$/.test(iata2) || !/^[A-Z]{3}$/.test(icao3) || validityTo) {
            continue;
        }
        if (type === 'C') {
            cargoOnly[iata2] = icao3;
        } else {
            map[iata2] = icao3;
        }
    }
    for (const iata2 in cargoOnly) {
        if (!(iata2 in map)) {
            map[iata2] = cargoOnly[iata2];
        }
    }
    return map;
}

// Re-run setFlight() on already-tracked aircraft so their callsigns pick
// up the table once it's loaded (planes seen before that point were left
// with their raw, unconverted callsign).
function refreshTrackedCallsigns() {
    if (typeof g === 'undefined' || !g.planes) {
        return;
    }
    for (const hex in g.planes) {
        const plane = g.planes[hex];
        if (plane.flight) {
            const oldTs = plane.flightTs;
            plane.setFlight(plane.flight);
            plane.flightTs = oldTs;
        }
    }
}

function loadAirlineTable() {
    try {
        const cached = JSON.parse(localStorage.getItem(AIRLINE_CACHE_KEY));
        if (cached && typeof cached.ts === 'number' && cached.data && typeof cached.data === 'object'
            && Date.now() - cached.ts < AIRLINE_CACHE_MAX_AGE_MS) {
            iata_to_icao = cached.data;
            refreshTrackedCallsigns();
            return;
        }
    } catch (e) {
        // ignore missing/corrupt cache, fall through to fetch
    }

    fetch(AIRLINE_CSV_URL)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            }
            return res.text();
        })
        .then(text => {
            iata_to_icao = parseAirlineCsv(text);
            refreshTrackedCallsigns();
            try {
                localStorage.setItem(AIRLINE_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: iata_to_icao }));
            } catch (e) {
                // localStorage full or unavailable, not fatal
            }
        })
        .catch(err => {
            console.error("airlines.js: failed to load IATA->ICAO table", err);
        });
}

loadAirlineTable();
