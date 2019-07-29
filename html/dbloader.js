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

var _aircraft_cache = {};
var _aircraft_type_cache = null;

function getAircraftData(icao) {
	var defer;

	if (icao.charAt(0) == '~') {
		defer = $.Deferred()
		defer.reject();
		return defer;
	}

	icao = icao.toUpperCase();

	if (icao in _aircraft_cache) {
		defer = _aircraft_cache[icao];
	} else {
		// load from blocks:
		defer = _aircraft_cache[icao] = $.Deferred();
		request_from_db(icao, 1, defer);
	}

	return defer;
}

function request_from_db(icao, level, defer) {
	var bkey = icao.substring(0, level);
	var dkey = icao.substring(level);
	var req = db_ajax(bkey);

	req.done(function(data) {
		var subkey;

		if (dkey in data) {
			getIcaoAircraftTypeData(data[dkey], defer);
			return;
		}

		if ("children" in data) {
			subkey = bkey + dkey.substring(0,1);
			if (data.children.indexOf(subkey) != -1) {
				request_from_db(icao, level+1, defer);
				return;
			}
		}
		defer.reject();
	});

	req.fail(function(jqXHR,textStatus,errorThrown) {
		defer.reject();
	});
}

function getIcaoAircraftTypeData(aircraftData, defer) {
	if (_aircraft_type_cache === null) {
		$.getJSON("db/aircraft_types/icao_aircraft_types.json")
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
	if (_aircraft_type_cache !== null && "t" in aircraftData) {
		var typeDesignator = aircraftData.t.toUpperCase();
		if (typeDesignator in _aircraft_type_cache) {
			var typeData = _aircraft_type_cache[typeDesignator];
			if (typeData.desc != undefined && aircraftData.desc === undefined && typeData.desc != null && typeData.desc.length == 3) {
				aircraftData.desc = typeData.desc;
			}
			if (typeData.wtc != undefined && aircraftData.wtc === undefined) {
				aircraftData.wtc = typeData.wtc;
			}
		}
	}

	defer.resolve(aircraftData);
}

var _request_count = 0;
var _request_queue = [];
var _request_cache = {};

var MAX_REQUESTS = 2;

function db_ajax(bkey) {
	var defer;

	if (bkey in _request_cache) {
		return _request_cache[bkey];
	}

	if (_request_count < MAX_REQUESTS) {
		// just do ajax directly
		++_request_count;
		defer = _request_cache[bkey] = $.ajax({ url: 'db/' + bkey + '.json',
			cache: true,
			timeout: 5000,
			dataType : 'json' });
		defer.always(db_ajax_request_complete);
	} else {
		// put it in the queue
		defer = _request_cache[bkey] = $.Deferred();
		defer.bkey = bkey;
		_request_queue.push(defer);
	}

	return defer;
}

function db_ajax_request_complete() {
	var req;
	var ajaxreq;

	if (_request_queue.length == 0) {
		--_request_count;
	} else {
		req = _request_queue.shift();
		ajaxreq = $.ajax({ url: 'db/' + req.bkey + '.json',
			cache: true,
			timeout: 5000,
			dataType : 'json' });
		ajaxreq.done(function(data) { req.resolve(data); });
		ajaxreq.fail(function(jqxhr, status, error) { req.reject(jqxhr, status, error); });
		ajaxreq.always(db_ajax_request_complete);
	}
}
