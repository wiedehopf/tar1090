// -*- mode: javascript; indent-tabs-mode: t; c-basic-offset: 8 -*-
"use strict";

let NBSP='\u00a0';
let NNBSP='\u202f';
let DEGREES='\u00b0'
let ENDASH='\u2013';
let UP_TRIANGLE='\u25b2'; // U+25B2 BLACK UP-POINTING TRIANGLE
let DOWN_TRIANGLE='\u25bc'; // U+25BC BLACK DOWN-POINTING TRIANGLE
let EM_QUAD = '\u2001';

let TrackDirections = ["North","NE","East","SE","South","SW","West","NW"];
let TrackDirectionArrows = ["\u21e7","\u2b00","\u21e8","\u2b02","\u21e9","\u2b03","\u21e6","\u2b01"];

let UnitLabels = {
    'altitude': { metric: "米", imperial: "英尺", nautical: "英尺"},
    'speed': { metric: "千米/小时", imperial: "英里/小时", nautical: "节" },
    'distance': { metric: "千米", imperial: "英里", nautical: "海里" },
    'verticalRate': { metric: "米/秒", imperial: "英尺/分钟", nautical: "英尺/分钟" },
    'distanceShort': { metric: "米", imperial: "英尺", nautical: "海里" }
};

let aircraftCategories = {
    'A0': '未指明动力的飞机',
    'A1': `轻型 (< 15${NNBSP}500${NBSP}磅)`,
    'A2': `小型 (15${NNBSP}500 至 75${NNBSP}000${NBSP}磅)`,
    'A3': `大型 (75${NNBSP}000 至 300${NNBSP}000${NBSP}磅)`,
    'A4': '高涡轮大型 (B-757等飞机)',
    'A5': `重型 (> 300${NNBSP}000${NBSP}磅)`,
    'A6': `高性能 (> 5${NBSP}g 加速度 和 > 400${NBSP}节)`,
    'A7': '旋翼机',
    'B0': '未指明的无动力飞机或无人机或航天器',
    'B1': '滑翔机',
    'B2': '飞艇',
    'B3': '跳伞运动员',
    'B4': '超轻/悬挂式滑翔机/滑翔伞',
    'B6': '无人机',
    'B7': '太空/跨大气层飞行器',
    'C0': '未指明的地面安装或车辆',
    'C1': `地面车辆 ${ENDASH} 急救车`,
    'C2': `地面车辆 ${ENDASH} 急救车`,
    'C3': '固定地面或系绳障碍物'
};

// formatting helpers

function get_category_label(category) {
    if (!category)
        return '';
    let label = aircraftCategories[category];
    if (!label)
        return '';
    return label;
}

function get_unit_label(quantity, systemOfMeasurement) {
	let labels = UnitLabels[quantity];
	if (labels !== undefined && labels[systemOfMeasurement] !== undefined) {
		return labels[systemOfMeasurement];
	}
	return "";
}

// track in degrees (0..359)
function format_track_brief(track, rounded) {
	if (track == null){
		return "n/a";
	}

	return track.toFixed(rounded ? 0 : 1) + DEGREES;
}

// track in degrees (0..359)
function format_track_long(track, rounded) {
	if (track == null){
		return "n/a";
	}

	let trackDir = Math.floor((360 + track % 360 + 22.5) / 45) % 8;
	return  TrackDirections[trackDir] + ":" + NNBSP + track.toFixed(rounded ? 0 : 1) + DEGREES;
}
function format_track_arrow(track) {
	if (track == null){
		return "";
	}

	let trackDir = Math.floor((360 + track % 360 + 22.5) / 45) % 8;
	return  TrackDirectionArrows[trackDir];
}

// alt in feet
function format_altitude_brief(alt, vr, displayUnits, withUnits) {
	let alt_text;

	if (alt == null){
		return NBSP + '?' + NBSP;
	} else if (alt === "ground"){
		return "ground";
	}

	alt_text = Math.round(convert_altitude(alt, displayUnits)).toString();
    if (withUnits)
        alt_text += NNBSP + get_unit_label("altitude", displayUnits);

	// Vertical Rate Triangle
	let verticalRateTriangle = "";
	if (vr > 245){
		verticalRateTriangle = UP_TRIANGLE;
	} else if (vr < -245){
		verticalRateTriangle = DOWN_TRIANGLE;
	} else {
		verticalRateTriangle = NNBSP;
	}

	return alt_text + verticalRateTriangle;
}

// alt in feet
function format_altitude_long(alt, vr, displayUnits) {
	let alt_text = "";

	if (alt == null) {
		return "n/a";
	} else if (alt === "ground") {
		return "on ground";
	}

	alt_text = Math.round(convert_altitude(alt, displayUnits)).toString() + NNBSP + get_unit_label("altitude", displayUnits);

	if (vr > 192) {
		return UP_TRIANGLE + NNBSP + alt_text;
	} else if (vr < -192) {
		return DOWN_TRIANGLE + NNBSP + alt_text;
	} else {
		return alt_text;
	}
}

// alt in feet
function format_altitude(alt, displayUnits) {
	let alt_text = "";

	if (alt == null) {
		return "n/a";
	} else if (alt === "ground") {
		return "on ground";
	}

	alt_text = Math.round(convert_altitude(alt, displayUnits)).toString() + NNBSP + get_unit_label("altitude", displayUnits);

    return alt_text;
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
		return alt * 0.3048;  // feet to meters
	}

	return alt;
}

// speed in knots
function format_speed_brief(speed, displayUnits, withUnits) {
	if (speed == null || isNaN(speed)) {
		return "";
	}
    let speed_text = Math.round(convert_speed(speed, displayUnits)).toString();
    if (withUnits)
        speed_text += NNBSP + get_unit_label("speed", displayUnits);

	return speed_text;
}

// speed in knots
function format_speed_long(speed, displayUnits) {
	if (speed == null) {
		return "n/a";
	}

	let speed_text = Math.round(convert_speed(speed, displayUnits)) + NNBSP + get_unit_label("speed", displayUnits);

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

	let dist_text = convert_distance(dist, displayUnits).toFixed(fixed) + NNBSP + get_unit_label("distance", displayUnits);

	return dist_text;
}

function format_distance_short (dist, displayUnits) {
	if (dist == null) {
		return "n/a";
	}

	let dist_text = Math.round(convert_distance_short(dist, displayUnits)) + NNBSP + get_unit_label("distanceShort", displayUnits);

	return dist_text;
}

// dist in meters
function convert_distance(dist, displayUnits) {
	if (displayUnits === "metric") {
		return (dist / 1000); // meters to kilometres
	}
	else if (displayUnits === "imperial") {
		return (dist / 1609); // meters to miles
	}
	return (dist / 1852); // meters to nautical miles
}

// dist in meters
// converts meters to feet or just returns metres
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

	let rate_text = convert_vert_rate(rate, displayUnits).toFixed(displayUnits === "metric" ? 1 : 0) + NNBSP + get_unit_label("verticalRate", displayUnits);

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
	return p[1].toFixed(3) + DEGREES + "," + NNBSP + p[0].toFixed(3) + DEGREES;
}

function format_data_source(source) {
	switch (source) {
		case 'uat' :
			return "UAT";
		case 'mlat':
			return "MLAT";
		case 'adsb':
		case 'adsb_icao':
		case 'adsb_other':
			return "ADS-B";
		case 'adsb_icao_nt':
			return "ADS-B noTP";
		case 'adsr':
		case 'adsr_icao':
		case 'adsr_other':
			return "ADS-R or UAT";
		case 'tisb_icao':
		case 'tisb_trackfile':
		case 'tisb_other':
		case 'tisb':
			return "TIS-B";
		case 'modeS':
			return "Mode S";
		case 'mode_ac':
			return "Mode A/C";
        case 'adsc':
            return "Sat. ADS-C";
        case 'other':
            return "Other";
	}

	return "Unknown";
}

function format_nac_p (value) {
	switch (value) {
		case 0:
			return "不确定的预计位置 ≥ 18.5 千米";
		case 1:
			return "不确定的预计位置 < 18.5 千米";
		case 2:
			return "不确定的预计位置 < 7.4 千米";
		case 3:
			return "不确定的预计位置 < 3.7 千米";
		case 4:
			return "不确定的预计位置 < 1.8 千米";
		case 5:
			return "不确定的预计位置 < 926 米";
		case 6:
			return "不确定的预计位置 < 555 米";
		case 7:
			return "不确定的预计位置 < 185 米";
		case 8:
			return "不确定的预计位置 < 92 米";
		case 9:
			return "不确定的预计位置 < 30 米";
		case 10:
			return "不确定的预计位置 < 10 米";
		case 11:
			return "不确定的预计位置 < 3 米";
		default:
			return "n/a";

	}
}

function format_nac_v (value) {
	switch (value) {
		case 0:
			return "≥ 10 米/秒";
		case 1:
			return "< 10 米/秒";
		case 2:
			return "< 3 米/秒";
		case 3:
			return "< 1 米/秒";
		case 4:
			return "< 0.3 米/秒";
		default:
			return "n/a";
	}
}

function format_duration(seconds) {
    if (seconds == null)
        return "n/a";
    if (seconds < 20)
        return seconds.toFixed(1) + ' 秒';
    if (seconds < 5 * 60)
        return seconds.toFixed(0) + ' 秒';
    if (seconds < 3 * 60 * 60)
        return (seconds/60).toFixed(0) + ' 分钟';
    return (seconds/60/60).toFixed(0) + ' 小时';

}

function iOSVersion() {
  if (/iP(hone|od|ad)/.test(navigator.platform)) {
    // supports iOS 2.0 and later: <http://bit.ly/TJjs1V>
    var v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
    return [parseInt(v[1], 10), parseInt(v[2], 10), parseInt(v[3] || 0, 10)];
  }
}

function wqi(data) {
    const INT32_MAX = 2147483647;
    const buffer = data.buffer;
    //console.log(buffer);
    let u32 = new Uint32Array(data.buffer, 0, 11);
    data.now = u32[0] / 1000 + u32[1] * 4294967.296;
    //console.log(data.now);
    let stride = u32[2];
    data.global_ac_count_withpos = u32[3];
    data.globeIndex = u32[4];

    let limits = new Int16Array(buffer, 20, 4);
    data.south =  limits[0];
    data.west =  limits[1];
    data.north =  limits[2];
    data.east =  limits[3];

    data.messages = u32[7];

    let s32 = new Int32Array(data.buffer, 0, stride / 4);
    let receiver_lat = s32[8] / 1e6;
    let receiver_lon = s32[9] / 1e6;

    const binCraftVersion = u32[10];

    if (receiver_lat != 0 && receiver_lon != 0) {
        //console.log("receiver_lat: " + receiver_lat + " receiver_lon: " + receiver_lon);
        let position = {
            coords: {
                latitude: receiver_lat,
                longitude: receiver_lon,
            },
        };
        if (receiver_lat != SiteLat || receiver_lon != SiteLon) {
            onLocationChange(position);
        }
    }

    data.aircraft = [];
    for (let off = stride; off < buffer.byteLength; off += stride) {
        let ac = {}
        let u32 = new Uint32Array(buffer, off, stride / 4);
        let s32 = new Int32Array(buffer, off, stride / 4);
        let u16 = new Uint16Array(buffer, off, stride / 2);
        let s16 = new Int16Array(buffer, off, stride / 2);
        let u8 = new Uint8Array(buffer, off, stride);
        let t = s32[0] & (1<<24);
        ac.hex = (s32[0] & ((1<<24) - 1)).toString(16).padStart(6, '0');
        ac.hex = t ? ('~' + ac.hex) : ac.hex;
        ac.seen_pos = u16[2] / 10;
        ac.seen = u16[3] / 10;

        ac.lon = s32[2] / 1e6;
        ac.lat = s32[3] / 1e6;

        ac.baro_rate = s16[8] * 8;
        ac.geom_rate = s16[9] * 8;
        ac.alt_baro = s16[10] * 25;
        ac.alt_geom = s16[11] * 25;

        ac.nav_altitude_mcp = u16[12] * 4;
        ac.nav_altitude_fms = u16[13] * 4;
        ac.nav_qnh = s16[14] / 10;
        ac.nav_heading = s16[15] / 90;

        const s = u16[16].toString(16).padStart(4, '0');
        if (s[0] > '9') {
            ac.squawk = String(parseInt(s[0], 16)) + s[1] + s[2] + s[3];
        } else {
            ac.squawk = s;
        }
        ac.gs = s16[17] / 10;
        ac.mach = s16[18] / 1000;
        ac.roll = s16[19] / 100;

        ac.track = s16[20] / 90;
        ac.track_rate = s16[21] / 100;
        ac.mag_heading = s16[22] / 90;
        ac.true_heading = s16[23] / 90;

        ac.wd  = s16[24];
        ac.ws  = s16[25];
        ac.oat = s16[26];
        ac.tat = s16[27];

        ac.tas = u16[28];
        ac.ias = u16[29];
        ac.rc  = u16[30];

        if (globeIndex && binCraftVersion >= 20220916) {
            ac.messageRate = u16[31] / 10;
        } else {
            ac.messages = u16[31];
        }

        ac.category = u8[64] ? u8[64].toString(16).toUpperCase() : undefined;
        ac.nic      = u8[65];

        let nav_modes = u8[66];
        ac.nav_modes = true;
        ac.emergency = u8[67] & 15;
        ac.type = (u8[67] & 240) >> 4;

        ac.airground = u8[68] & 15;
        ac.nav_altitude_src = (u8[68] & 240) >> 4;

        ac.sil_type = u8[69] & 15;
        ac.adsb_version = (u8[69] & 240) >> 4;

        ac.adsr_version = u8[70] & 15;
        ac.tisb_version = (u8[70] & 240) >> 4;

        ac.nac_p = u8[71] & 15;
        ac.nac_v = (u8[71] & 240) >> 4;

        ac.sil = u8[72] & 3;
        ac.gva = (u8[72] & 12) >> 2;
        ac.sda = (u8[72] & 48) >> 4;
        ac.nic_a = (u8[72] & 64) >> 6;
        ac.nic_c = (u8[72] & 128) >> 7;


        ac.flight = "";
        for (let i = 78; u8[i] && i < 86; i++) {
            ac.flight += String.fromCharCode(u8[i]);
        }

        ac.dbFlags = u16[43];

        ac.t = "";
        for (let i = 88; u8[i] && i < 92; i++) {
            ac.t += String.fromCharCode(u8[i]);
        }
        ac.r = "";
        for (let i = 92; u8[i] && i < 104; i++) {
            ac.r += String.fromCharCode(u8[i]);
        }
        ac.receiverCount = u8[104];

        ac.rssi = 10 * Math.log(u8[105]*u8[105]/65025 + 1.125e-5)/Math.log(10);

        ac.extraFlags = u8[106];
        ac.nogps = ac.extraFlags & 1;
        if (ac.nogps && nogpsOnly && s32[3] != INT32_MAX) {
            u8[73] |= 64;
            u8[73] |= 16;
        }

        // must come after the stuff above (validity bits)

        ac.nic_baro      = (u8[73] & 1);
        ac.alert1        = (u8[73] & 2);
        ac.spi           = (u8[73] & 4);
        ac.flight        = (u8[73] & 8)    ? ac.flight       : undefined;
        ac.alt_baro      = (u8[73] & 16)   ? ac.alt_baro     : undefined;
        ac.alt_geom      = (u8[73] & 32)   ? ac.alt_geom     : undefined;

        ac.lat           = (u8[73] & 64)   ? ac.lat          : undefined;
        ac.lon           = (u8[73] & 64)   ? ac.lon          : undefined;
        ac.seen_pos      = (u8[73] & 64)   ? ac.seen_pos     : undefined;

        ac.gs            = (u8[73] & 128)  ? ac.gs           : undefined;

        ac.ias           = (u8[74] & 1)    ? ac.ias          : undefined;
        ac.tas           = (u8[74] & 2)    ? ac.tas          : undefined;
        ac.mach          = (u8[74] & 4)    ? ac.mach         : undefined;
        ac.track         = (u8[74] & 8)    ? ac.track        : undefined;
        ac.calc_track    = !(u8[74] & 8)   ? ac.track        : undefined;
        ac.track_rate    = (u8[74] & 16)   ? ac.track_rate   : undefined;
        ac.roll          = (u8[74] & 32)   ? ac.roll         : undefined;
        ac.mag_heading   = (u8[74] & 64)   ? ac.mag_heading  : undefined;
        ac.true_heading  = (u8[74] & 128)  ? ac.true_heading : undefined;

        ac.baro_rate     = (u8[75] & 1)    ? ac.baro_rate    : undefined;
        ac.geom_rate     = (u8[75] & 2)    ? ac.geom_rate    : undefined;
        ac.nic_a         = (u8[75] & 4)    ? ac.nic_a        : undefined;
        ac.nic_c         = (u8[75] & 8)    ? ac.nic_c        : undefined;
        ac.nic_baro      = (u8[75] & 16)   ? ac.nic_baro     : undefined;
        ac.nac_p         = (u8[75] & 32)   ? ac.nac_p        : undefined;
        ac.nac_v         = (u8[75] & 64)   ? ac.nac_v        : undefined;
        ac.sil           = (u8[75] & 128)  ? ac.sil          : undefined;

        ac.gva                  = (u8[76] & 1)   ? ac.gva              : undefined;
        ac.sda                  = (u8[76] & 2)   ? ac.sda              : undefined;
        ac.squawk               = (u8[76] & 4)   ? ac.squawk           : undefined;
        ac.emergency            = (u8[76] & 8)   ? ac.emergency        : undefined;
        ac.spi                  = (u8[76] & 16)  ? ac.spi              : undefined;
        ac.nav_qnh              = (u8[76] & 32)  ? ac.nav_qnh          : undefined;
        ac.nav_altitude_mcp     = (u8[76] & 64)  ? ac.nav_altitude_mcp : undefined;
        ac.nav_altitude_fms     = (u8[76] & 128) ? ac.nav_altitude_fms : undefined;

        ac.nav_altitude_src     = (u8[77] & 1)   ? ac.nav_altitude_src : undefined;
        ac.nav_heading          = (u8[77] & 2)   ? ac.nav_heading      : undefined;
        ac.nav_modes            = (u8[77] & 4)   ? ac.nav_modes        : undefined;
        ac.alert1               = (u8[77] & 8)   ? ac.alert1           : undefined;
        ac.ws                   = (u8[77] & 16)  ? ac.ws               : undefined;
        ac.wd                   = (u8[77] & 16)  ? ac.wd               : undefined;
        ac.oat                  = (u8[77] & 32)  ? ac.oat              : undefined;
        ac.tat                  = (u8[77] & 32)  ? ac.tat              : undefined;

        if (ac.airground == 1)
            ac.alt_baro = "ground";

        if (ac.nav_modes) {
            ac.nav_modes = [];
            if (nav_modes & 1) ac.nav_modes.push('autopilot');
            if (nav_modes & 2) ac.nav_modes.push('vnav');
            if (nav_modes & 4) ac.nav_modes.push('alt_hold');
            if (nav_modes & 8) ac.nav_modes.push('approach');
            if (nav_modes & 16) ac.nav_modes.push('lnav');
            if (nav_modes & 32) ac.nav_modes.push('tcas');
        }
        switch (ac.type) {
            case  0: ac.type = 'adsb_icao';        break;
            case  1: ac.type = 'adsb_icao_nt';     break;
            case  2: ac.type = 'adsr_icao';        break;
            case  3: ac.type = 'tisb_icao';        break;
            case  4: ac.type = 'adsc';             break;
            case  5: ac.type = 'mlat';             break;
            case  6: ac.type = 'other';            break;
            case  7: ac.type = 'mode_s';           break;
            case  8: ac.type = 'adsb_other';       break;
            case  9: ac.type = 'adsr_other';       break;
            case 10: ac.type = 'tisb_trackfile';   break;
            case 11: ac.type = 'tisb_other';       break;
            case 12: ac.type = 'mode_ac';          break;
            default: ac.type = 'unknown';
        }
        const type4 = ac.type.slice(0, 4);
        if (type4 == 'adsb') {
            ac.version = ac.adsb_version;
        } else if (type4 == 'adsr') {
            ac.version = ac.adsr_version;
        } else if (type4 == 'tisb') {
            ac.version = ac.tisb_version;
        }
        if (stride == 112) {
            ac.rId = u32[27].toString(16).padStart(8, '0');
            //ac.rId = ac.rId.slice(0, 4) + '-' + ac.rId.slice(4);
        }

        data.aircraft.push(ac);
    }
}

function ItemCache(maxItems) {
    this.maxItems = maxItems;
    this.items = {};
    this.keys = [];
}
ItemCache.prototype.clear = function() {
    this.items = {};
    this.keys = [];
}
ItemCache.prototype.get = function(key) {
    return this.items[key];
}
ItemCache.prototype.add = function(key, value) {

    if (!(key in this.items)) {
        this.keys.push(key);
    }
    this.items[key] = value;

    if (this.maxItems && this.maxItems > 0) {
        while (this.keys.length > this.maxItems) {
            const key = this.keys.shift();
            delete this.items[key];
        }
    }
}

function itemCacheTest() {
    let a = new ItemCache(4);
    a.add(8, 4);
    a.add(5, 2);
    a.add(4, 2);
    a.add(3, 2);
    a.add(1, 2);
    a.add(1, 3);
    a.add(1, 5);
    let items = JSON.stringify(a.items)
    let keys = JSON.stringify(a.keys);
    const expectedItems = '{"1":5,"3":2,"4":2,"5":2}';
    const expectedKeys = '[5,4,3,1]';
    if (items != expectedItems || keys != expectedKeys || g.get(1) != 5) {
        console.error(`ItemCache broken!`);
        console.log(`got:      items: ${items} keys: ${keys}`);
        console.log(`expected: items: ${expectedItems} keys: ${expectedKeys}`);
    } else {
        console.log(`ItemCache tested correctly!`);
    }
}
