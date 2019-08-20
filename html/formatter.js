// -*- mode: javascript; indent-tabs-mode: t; c-basic-offset: 8 -*-
"use strict";

var NBSP='\u00a0';
var DEGREES='\u00b0'
var UP_TRIANGLE='\u25b2'; // U+25B2 BLACK UP-POINTING TRIANGLE
var DOWN_TRIANGLE='\u25bc'; // U+25BC BLACK DOWN-POINTING TRIANGLE

var TrackDirections = ["North","NE","East","SE","South","SW","West","NW"];

var UnitLabels = {
	'altitude': { metric: "m", imperial: "ft", nautical: "ft"},
	'speed': { metric: "km/h", imperial: "mph", nautical: "kt" },
	'distance': { metric: "km", imperial: "mi", nautical: "NM" },
	'verticalRate': { metric: "m/s", imperial: "ft/min", nautical: "ft/min" },
	'distanceShort': {metric: "m", imperial: "ft", nautical: "m"}
};

// formatting helpers

function get_unit_label(quantity, systemOfMeasurement) {
	var labels = UnitLabels[quantity];
	if (labels !== undefined && labels[systemOfMeasurement] !== undefined) {
		return labels[systemOfMeasurement];
	}
	return "";
}

// track in degrees (0..359)
function format_track_brief(track) {
	if (track == null){
		return "";
	}

	return Math.round(track) + DEGREES;
}

// track in degrees (0..359)
function format_track_long(track) {
	if (track == null){
		return "n/a";
	}

	var trackDir = Math.floor((360 + track % 360 + 22.5) / 45) % 8;
	return Math.round(track) + DEGREES + NBSP + "(" + TrackDirections[trackDir] + ")";
}

// alt in feet
function format_altitude_brief(alt, vr, displayUnits) {
	var alt_text;

	if (alt == null){
		return "";
	} else if (alt === "ground"){
		return "ground";
	}

	alt_text = Math.round(convert_altitude(alt, displayUnits)).toLocaleString() + NBSP;

	// Vertical Rate Triangle
	var verticalRateTriangle = "";
	if (vr > 192){
		verticalRateTriangle = UP_TRIANGLE;
	} else if (vr < -192){
		verticalRateTriangle = DOWN_TRIANGLE;
	} else {
		verticalRateTriangle = NBSP;
	}

	return alt_text + verticalRateTriangle;
}

// alt in feet
function format_altitude_long(alt, vr, displayUnits) {
	var alt_text = "";

	if (alt == null) {
		return "n/a";
	} else if (alt === "ground") {
		return "on ground";
	}

	alt_text = Math.round(convert_altitude(alt, displayUnits)).toLocaleString() + NBSP + get_unit_label("altitude", displayUnits);

	if (vr > 192) {
		return UP_TRIANGLE + NBSP + alt_text;
	} else if (vr < -192) {
		return DOWN_TRIANGLE + NBSP + alt_text;
	} else {
		return alt_text;
	}
}

// alt ground/airborne
function format_onground (alt) {
	if (alt == null) {
		return "n/a";
	} else if (alt === "ground") {
		return "on ground";
	} else {
		return "airborne";
	}
}

// alt in feet
function convert_altitude(alt, displayUnits) {
	if (displayUnits === "metric") {
		return alt / 3.2808;  // feet to meters
	}

	return alt;
}

// speed in knots
function format_speed_brief(speed, displayUnits) {
	if (speed == null) {
		return "";
	}

	return Math.round(convert_speed(speed, displayUnits));
}

// speed in knots
function format_speed_long(speed, displayUnits) {
	if (speed == null) {
		return "n/a";
	}

	var speed_text = Math.round(convert_speed(speed, displayUnits)) + NBSP + get_unit_label("speed", displayUnits);

	return speed_text;
}

// speed in knots
function convert_speed(speed, displayUnits) {
	if (displayUnits === "metric") {
		return speed * 1.852;  // knots to kilometers per hour
	}
	else if (displayUnits === "imperial") {
		return speed * 1.151;  // knots to miles per hour
	}

	return speed;
}

// dist in meters
function format_distance_brief(dist, displayUnits) {
	if (dist == null) {
		return "";
	}

	return convert_distance(dist, displayUnits).toFixed(1);
}

// dist in meters
function format_distance_long(dist, displayUnits, fixed) {
	if (dist == null) {
		return "n/a";
	}

	if (typeof fixed === 'undefined') {
		fixed = 1;
	}

	var dist_text = convert_distance(dist, displayUnits).toFixed(fixed) + NBSP + get_unit_label("distance", displayUnits);

	return dist_text;
}

function format_distance_short (dist, displayUnits) {
	if (dist == null) {
		return "n/a";
	}

	var dist_text = Math.round(convert_distance_short(dist, displayUnits)) + NBSP + get_unit_label("distanceShort", displayUnits);

	return dist_text;
}

// dist in meters
function convert_distance(dist, displayUnits) {
	if (displayUnits === "metric") {
		return (dist / 1000); // meters to kilometers
	}
	else if (displayUnits === "imperial") {
		return (dist / 1609); // meters to miles
	}
	return (dist / 1852); // meters to nautical miles
}

// dist in meters
// converts meters to feet or just returns meters
function convert_distance_short(dist, displayUnits) {
	if (displayUnits === "imperial") {
		return (dist / 0.3048); // meters to feet
	}
	return dist; // just meters
}

// rate in ft/min
function format_vert_rate_brief(rate, displayUnits) {
	if (rate == null) {
		return "";
	}

	return convert_vert_rate(rate, displayUnits).toFixed(displayUnits === "metric" ? 1 : 0);
}

// rate in ft/min
function format_vert_rate_long(rate, displayUnits) {
	if (rate == null){
		return "n/a";
	}

	var rate_text = convert_vert_rate(rate, displayUnits).toFixed(displayUnits === "metric" ? 1 : 0) + NBSP + get_unit_label("verticalRate", displayUnits);

	return rate_text;
}

// rate in ft/min
function convert_vert_rate(rate, displayUnits) {
	if (displayUnits === "metric") {
		return (rate / 196.85); // ft/min to m/s
	}

	return rate;
}

// p is a [lon, lat] coordinate
function format_latlng(p) {
	return p[1].toFixed(3) + DEGREES + "," + NBSP + p[0].toFixed(3) + DEGREES;
}

function format_data_source(source) {
	switch (source) {
		case 'uat' :
			return "UAT";
		case 'mlat':
			return "MLAT";
		case 'adsb_icao':
		case 'adsb_other':
			return "ADS-B";
		case 'adsb_icao_nt':
			return "ADS-B (non transponder)";
		case 'adsr_icao':
		case 'adsr_other':
			return "ADS-R";
		case 'tisb_icao':
		case 'tisb_trackfile':
		case 'tisb_other':
			return "TIS-B";
		case 'mode_s':
			return "Mode S";
		case 'mode_ac':
			return "Mode A/C";
	}

	return "";
}

function format_nac_p (value) {
	switch (value) {
		case 0:
			return "EPU ≥ 18.52 km";
		case 1:
			return "EPU < 18.52 km";
		case 2:
			return "EPU < 7.408 km";
		case 3:
			return "EPU < 3.704 km";
		case 4:
			return "EPU < 1852 m";
		case 5:
			return "EPU < 926 m";
		case 6:
			return "EPU < 555.6 m";
		case 7:
			return "EPU < 185.2 m";
		case 8:
			return "EPU < 92.6 m";
		case 9:
			return "EPU < 30 m";
		case 10:
			return "EPU < 10 m";
		case 11:
			return "EPU < 3 m";
		default:
			return "n/a";

	}
}

function format_nac_v (value) {
	switch (value) {
		case 0:
			return "Unknown or  10 m/s";
		case 1:
			return "< 10 m/s";
		case 2:
			return "< 3 m/s";
		case 3:
			return "< 1 m/s";
		case 4:
			return "< 0.3 m/s";
		default:
			return "n/a";
	}
}
