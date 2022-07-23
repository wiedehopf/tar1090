// -*- mode: javascript; indent-tabs-mode: nil; c-basic-offset: 8 -*-

// Part of dump1090, a Mode S message decoder for RTLSDR devices.
//
// dbloader.js: load aircraft metadata from static json files
//
// Copyright (c) 2014,2015 Oliver Jowett <oliver@mutability.co.uk>
//
// This file is free software: you may copy, redistribute and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 2 of the License, or (at your
// option) any later version.
//
// This file is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

"use strict";

let _aircraft_cache = {};
let _airport_coords_cache = null;

let _request_count = 0;
let _request_queue = [];
let _request_cache = {};

let regCache = null;

Promise.unwrapped = () => {
  let resolve, reject, promise = new Promise((_resolve, _reject) => {
    resolve = _resolve, reject = _reject;
  });
  promise.resolve = resolve, promise.reject = reject;
  return promise;
}

function dbLoad(icao) {
    let defer = Promise.unwrapped();
	if (icao[0] == '~') {
		defer.resolve(null);
        return defer;
	}
	icao = icao.toUpperCase();

	request_from_db(icao, 1, defer);

    return defer;
}

function request_from_db(icao, level, defer) {
	let bkey = icao.substring(0, level);
	let dkey = icao.substring(level);
	let req = db_ajax(bkey);

    req.then(
        data => {
            let subkey;

            if (data == null) {
                defer.resolve("strange");
                return;
            }

            if (dkey in data) {
                defer.resolve(data[dkey]);
                return;
            }

            if ("children" in data) {
                subkey = bkey + dkey.substring(0,1);
                if (data.children.indexOf(subkey) != -1) {
                    request_from_db(icao, level+1, defer);
                    return;
                }
            }
            defer.resolve(null);
        },
        error => {
            defer.reject(error);
        });
}

function getIcaoAircraftTypeData(aircraftData, defer) {
	if (_aircraft_type_cache === null) {
		jQuery.getJSON(databaseFolder + "/icao_aircraft_types.js")
			.done(function(typeLookupData) {
				_aircraft_type_cache = typeLookupData;
			})
			.always(function() {
				lookupIcaoAircraftType(aircraftData, defer);
			});
	}
	else {
		lookupIcaoAircraftType(aircraftData, defer);
	}
}

function lookupIcaoAircraftType(aircraftData, defer) {
	if (_aircraft_type_cache !== null && aircraftData[1]) {
		let typeCode = aircraftData[1].toUpperCase();
		if (typeCode in _aircraft_type_cache) {
			let typeData = _aircraft_type_cache[typeCode];
            const typeLong = typeData[0];
            const desc = typeData[1];
            const wtc = typeData[2];
            aircraftData[5] = desc;
            aircraftData[6] = wtc;
            aircraftData[7] = typeLong;
		}
	}

	defer.resolve(aircraftData);
}

function db_ajax(bkey) {
	let req;

	if (bkey in _request_cache) {
		return _request_cache[bkey];
	}

	req = _request_cache[bkey] = Promise.unwrapped();
	req.bkey = bkey;
	// put it in the queue
	_request_queue.push(req);

    db_ajax_request_complete();

	return req;
}

function db_ajax_request_complete() {
	let req;
	let ajaxreq;

	if (_request_queue.length == 0 || _request_count >= 1) {
		return;
	} else {
		_request_count++;
		req = _request_queue.shift();
		const req_url = databaseFolder + '/' + req.bkey + '.js';
		ajaxreq = jQuery.ajax({ url: req_url,
			cache: true,
			timeout: 30000,
			dataType : 'json' });
		ajaxreq.done(data => {
            req.resolve(data);
        });
		ajaxreq.fail((jqxhr, status, error) => {
			if (status == 'timeout') {
				delete _request_cache[req.bkey];
			}
			jqxhr.url = req_url;
            let reason = new Error('');
            if (status == 'timeout') {
                reason.http_status = 'timeout';
                console.error('Database: HTTP error: timeout (URL: ' + jqxhr.url + ')');
            } else {
                console.error('Database: HTTP error: ' + jqxhr.status + ' (URL: ' + jqxhr.url + ')');
                reason.http_status = 'other';
            }
			req.reject(reason);
		});
		ajaxreq.always(function() {
			_request_count--;
			db_ajax_request_complete();
		});
	}
}
