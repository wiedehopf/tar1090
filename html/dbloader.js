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

function dbLoad(icao) {
	let defer = $.Deferred();
	if (icao.charAt(0) == '~') {
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

	req.done(function(data) {
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
	});

	req.fail(function(jqXHR,textStatus,errorThrown) {
		defer.reject(jqXHR,textStatus,errorThrown);
	});
}

function getIcaoAircraftTypeData(aircraftData, defer) {
	if (_aircraft_type_cache === null) {
		$.getJSON(databaseFolder + "/icao_aircraft_types.js")
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
		let typeDesignator = aircraftData[1].toUpperCase();
		if (typeDesignator in _aircraft_type_cache) {
			let typeData = _aircraft_type_cache[typeDesignator];
			if (typeData.desc != null && typeData.desc.length == 3) {
				aircraftData[5] = typeData.desc;
			}
			if (typeData.wtc != undefined && aircraftData.wtc === undefined) {
				aircraftData[6] = typeData.wtc;
			}
		}
	}

	defer.resolve(aircraftData);
}

function db_ajax(bkey) {
	let req;

	if (bkey in _request_cache) {
		return _request_cache[bkey];
	}

	req = _request_cache[bkey] = $.Deferred();
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
		ajaxreq = $.ajax({ url: req_url,
			cache: true,
			timeout: 30000,
			dataType : 'json' });
		ajaxreq.done(function(data) {
            req.resolve(data);
        });
		ajaxreq.fail(function(jqxhr, status, error) {
			if (status == 'timeout') {
				delete _request_cache[req.bkey];
			}
			jqxhr.url = req_url;
			req.reject(jqxhr, status, error);
		});
		ajaxreq.always(function() {
			_request_count--;
			db_ajax_request_complete();
		});
	}
}
