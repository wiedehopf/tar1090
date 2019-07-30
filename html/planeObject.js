"use strict";

function PlaneObject(icao) {
	// Info about the plane
	this.icao      = icao;
	this.icaorange = findICAORange(icao);
	this.flight    = null;
	this.squawk    = null;
	this.selected  = false;
	this.category  = null;
	this.uat       = false;

	// Basic location information
	this.altitude       = null;
	this.alt_baro       = null;
	this.alt_geom       = null;

	this.speed          = null;
	this.gs             = null;
	this.ias            = null;
	this.tas            = null;

	this.track          = null;
	this.track_rate     = null;
	this.mag_heading    = null;
	this.true_heading   = null;
	this.mach           = null;
	this.roll           = null;
	this.nav_altitude   = null;
	this.nav_heading    = null;
	this.nav_modes      = null;
	this.nav_qnh        = null;
	this.rc				= null;

	this.nac_p			= null;
	this.nac_v			= null;
	this.nic_baro		= null;
	this.sil_type		= null;
	this.sil			= null;

	this.baro_rate      = null;
	this.geom_rate      = null;
	this.vert_rate      = null;

	this.version        = null;

	this.prev_position = null;
	this.prev_position_time = null;
	this.prev_track = null;
	this.position  = null;
	this.position_from_mlat = false
	this.sitedist  = null;

	// Data packet numbers
	this.messages  = null;
	this.rssi      = null;
	this.rssa      = null;
	this.rindex    = 0;

	// Track history as a series of line segments
	this.elastic_feature = null;
	this.track_linesegs = [];
	this.history_size = 0;

	// Track (direction) at the time we last appended to the track history
	this.tail_track = null;
	// Timestamp of the most recent point appended to the track history
	this.tail_update = null;

	// When was this last updated (receiver timestamp)
	this.last_message_time = null;
	this.last_position_time = null;

	// When was this last updated (seconds before last update)
	this.seen = null;
	this.seen_pos = null;

	// Display info
	this.visible = true;
	this.marker = null;
	this.markerStyle = null;
	this.markerIcon = null;
	this.markerStaticStyle = null;
	this.markerStaticIcon = null;
	this.markerStyleKey = null;
	this.markerSvgKey = null;
	this.filter = {};

	// start from a computed registration, let the DB override it
	// if it has something else.
	this.registration = registration_from_hexid(this.icao);
	this.icaotype = null;
	this.typeDescription = null;
	this.wtc = null;

	// request metadata
	getAircraftData(this.icao).done(function(data) {
		if ("r" in data) {
			this.registration = data.r;
		}

		if ("t" in data) {
			this.icaotype = data.t;
		}

		if ("desc" in data) {
			this.typeDescription = data.desc;
		}

		if ("wtc" in data) {
			this.wtc = data.wtc;
		}

		if (this.selected) {
			refreshSelected();
		}
	}.bind(this));
}

PlaneObject.prototype.isFiltered = function() {
	if (this.filter.minAltitude !== undefined && this.filter.maxAltitude !== undefined) {
		if (this.altitude == null) {
			return true;
		}
		var planeAltitude = this.altitude === "ground" ? 0 : convert_altitude(this.altitude, this.filter.altitudeUnits);
		return planeAltitude < this.filter.minAltitude || planeAltitude > this.filter.maxAltitude;
	}

	// filter out ground vehicles
	if (typeof this.filter.groundVehicles !== 'undefined' && this.filter.groundVehicles === 'filtered') {
		if (typeof this.category === 'string' && this.category.startsWith('C')) {
			return true;
		}
	}

	// filter out blocked MLAT flights
	if (typeof this.filter.blockedMLAT !== 'undefined' && this.filter.blockedMLAT === 'filtered') {
		if (typeof this.icao === 'string' && this.icao.startsWith('~')) {
			return true;
		}
	}

	return false;
}

// Appends data to the running track so we can get a visual tail on the plane
// Only useful for a long running browser session.
PlaneObject.prototype.updateTrack = function(receiver_timestamp, last_timestamp) {
	if (this.position == null)
		return false;
	if (this.prev_position && this.position[0] == this.prev_position[0] && this.position[1] == this.prev_position[1])
		return false;

	var projHere = ol.proj.fromLonLat(this.position);
	var projPrev;
	var prev_time;
	if (this.prev_position) {
		projPrev = ol.proj.fromLonLat(this.prev_position);
		prev_time = this.prev_position_time;
	} else {
		projPrev = projHere;
		prev_time = this.last_position_time;
	}
	var prev_track = this.prev_track;

	var on_ground = (this.altitude === "ground");

	this.prev_position = this.position;
	this.prev_position_time = this.last_position_time;
	this.prev_track = this.track;

	if (this.track_linesegs.length == 0) {
		// Brand new track
		//console.log(this.icao + " new track");
		var newseg = { fixed: new ol.geom.LineString([projHere]),
			feature: null,
			estimated: false,
			ground: on_ground,
			altitude: this.altitude
		};
		this.track_linesegs.push(newseg);
		this.tail_update = prev_time;
		this.tail_track = prev_track;
		this.history_size ++;
		return;
	}

	var lastseg = this.track_linesegs[this.track_linesegs.length - 1];

	// Determine if track data are intermittent/stale
	// Time difference between two position updates should not be much
	// greater than the difference between data inputs
	var time_difference = (this.last_position_time - prev_time) - (receiver_timestamp - last_timestamp);

	// MLAT data are given some more leeway
	var stale_timeout = (this.position_from_mlat ? 15 : 6);
	var est_track = (time_difference > stale_timeout);

	// Also check if the position was already stale when it was exported by dump1090
	// Makes stale check more accurate for example for 30s spaced history points

	est_track = est_track || ((receiver_timestamp - this.last_position_time) > stale_timeout);

	if (est_track) {

		if (!lastseg.estimated) {
			// >5s gap in data, create a new estimated segment
			//console.log(this.icao + " switching to estimated");
			lastseg.fixed.appendCoordinate(projPrev);
			this.track_linesegs.push({ fixed: new ol.geom.LineString([projPrev]),
				feature: null,
				altitude: 0,
				estimated: true });
			this.tail_update = prev_time;
			this.tail_track = prev_track;
			this.history_size += 2;
		} else {
			// Keep appending to the existing dashed line; keep every point
			lastseg.fixed.appendCoordinate(projPrev);
			this.tail_update = prev_time;
			this.tail_track = prev_track;
			this.history_size++;
		}

		return true;
	}

	if (lastseg.estimated) {
		// We are back to good data (we got two points close in time), switch back to
		// solid lines.
		lastseg.fixed.appendCoordinate(projPrev);
		lastseg = { fixed: new ol.geom.LineString([projPrev]),
			feature: null,
			estimated: false,
			ground: on_ground,
			altitude: this.altitude };
		this.track_linesegs.push(lastseg);
		this.tail_update = prev_time;
		this.tail_track = prev_track;
		this.history_size += 2;
		return true;
	}

	var alt_change = Math.abs(this.altitude - lastseg.altitude);
	var since_update = prev_time - this.tail_update;

	if ( (lastseg.ground != on_ground) || (!on_ground && isNaN(alt_change)) || alt_change >= 300 || (this.altitude < 10000 && alt_change >= 75) ) {
		//console.log(this.icao + " ground state changed");
		// Create a new segment as the ground state or the altitude changed.
		// The new state is only drawn after the state has changed
		// and we then get a new position.

		// Let's assume the ground state change happened somewhere between the previous and current position
		// Represent that assumption. With altitude it's not quite as critical.
		if (lastseg.ground != on_ground) {
			projPrev = [(projPrev[0]+projHere[0])/2,(projPrev[1]+projHere[1])/2];
		}
		lastseg.fixed.appendCoordinate(projPrev);
		this.track_linesegs.push({ fixed: new ol.geom.LineString([projPrev]),
			feature: null,
			estimated: false,
			altitude: this.altitude,
			ground: on_ground });
		this.tail_update = prev_time;
		this.tail_track = prev_track;
		this.history_size += 2;
		return true;
	}

	// Add current position to the existing track.
	// We only retain some points depending on time elapsed and track change
	var track_change = (this.tail_track && this.track) ? Math.abs(this.tail_track - this.track) : -1;

	if ( since_update > 32 ||
		(track_change > 4.5) ||
		(track_change > 1 && since_update > 2.5) ||
		(track_change > 0.25 && since_update > 7.7) ||
		(this.position_from_mlat && since_update > 4.5) ||
		(track_change == -1 && since_update > 4.5) )
	{
		// enough time has elapsed; retain the last point and add a new one
		//if (this.selected) console.log(track_change.toPrecision(2) + "  " + since_update.toPrecision(3) + "  " +this.history_size);
		lastseg.fixed.appendCoordinate(projPrev);
		this.tail_update = prev_time;
		this.tail_track = prev_track;
		this.history_size ++;
	}

	return true;
};

// This is to remove the line from the screen if we deselect the plane
PlaneObject.prototype.clearLines = function() {
	for (var i = this.track_linesegs.length - 1; i >= 0 ; --i) {
		var seg = this.track_linesegs[i];
		if (seg.feature !== null) {
			PlaneTrailFeatures.remove(seg.feature);
			seg.feature = null;
		}
	}

	if (this.elastic_feature !== null) {
		PlaneTrailFeatures.remove(this.elastic_feature);
		this.elastic_feature = null;
	}
};

PlaneObject.prototype.getDataSource = function() {
	// MLAT
	if (this.position_from_mlat) {
		return 'mlat';
	}
	if (this.uat)
		return 'uat';

	// Not MLAT, but position reported - ADSB or variants
	if (this.position != null) {
		return this.addrtype;
	}

	// Otherwise Mode S
	return 'mode_s';

	// TODO: add support for Mode A/C
};

PlaneObject.prototype.getMarkerColor = function() {
	// Emergency squawks override everything else
	if (this.squawk in SpecialSquawks)
		return SpecialSquawks[this.squawk].markerColor;

	var h, s, l;

	var colorArr = this.getAltitudeColor();

	h = colorArr[0];
	s = colorArr[1];
	l = colorArr[2];

	// If we have not seen a recent position update, change color
	if (this.seen_pos > 15 && this.altitude !== "ground") {
		h += ColorByAlt.stale.h;
		s += ColorByAlt.stale.s;
		l += ColorByAlt.stale.l;
	}

	// If this marker is selected, change color
	if (this.selected && !SelectedAllPlanes){
		h += ColorByAlt.selected.h;
		s += ColorByAlt.selected.s;
		l += ColorByAlt.selected.l;
	}

	// If this marker is a mlat position, change color
	if (this.position_from_mlat) {
		h += ColorByAlt.mlat.h;
		s += ColorByAlt.mlat.s;
		l += ColorByAlt.mlat.l;
	}

	if (h < 0) {
		h = (h % 360) + 360;
	} else if (h >= 360) {
		h = h % 360;
	}

	if (s < 5) s = 5;
	else if (s > 95) s = 95;

	if (l < 5) l = 5;
	else if (l > 95) l = 95;

	return 'hsl(' + (h/5).toFixed(0)*5 + ',' + (s/5).toFixed(0)*5 + '%,' + (l/5).toFixed(0)*5 + '%)'
}

PlaneObject.prototype.getAltitudeColor = function(altitude) {
	var h, s, l;

	if (typeof altitude === 'undefined') {
		altitude = this.altitude;
	}

	if (altitude === null) {
		h = ColorByAlt.unknown.h;
		s = ColorByAlt.unknown.s;
		l = ColorByAlt.unknown.l;
	} else if (altitude === "ground") {
		h = ColorByAlt.ground.h;
		s = ColorByAlt.ground.s;
		l = ColorByAlt.ground.l;
	} else {
		s = ColorByAlt.air.s;
		l = ColorByAlt.air.l;

		// find the pair of points the current altitude lies between,
		// and interpolate the hue between those points
		var hpoints = ColorByAlt.air.h;
		h = hpoints[0].val;
		for (var i = hpoints.length-1; i >= 0; --i) {
			if (altitude > hpoints[i].alt) {
				if (i == hpoints.length-1) {
					h = hpoints[i].val;
				} else {
					h = hpoints[i].val + (hpoints[i+1].val - hpoints[i].val) * (altitude - hpoints[i].alt) / (hpoints[i+1].alt - hpoints[i].alt)
				}
				break;
			}
		}
	}

	if (h < 0) {
		h = (h % 360) + 360;
	} else if (h >= 360) {
		h = h % 360;
	}

	if (s < 5) s = 5;
	else if (s > 95) s = 95;

	if (l < 5) l = 5;
	else if (l > 95) l = 95;

	return [h, s, l];
}

PlaneObject.prototype.updateIcon = function() {
	var scaleFactor = Math.max(0.2, Math.min(1.2, 0.15 * Math.pow(1.25, ZoomLvl))).toFixed(1);

	var col = this.getMarkerColor();
	var opacity = 1.0;
	var outline = (this.position_from_mlat ? OutlineMlatColor : OutlineADSBColor);
	var add_stroke = (this.selected && !SelectedAllPlanes) ? ' stroke="black" stroke-width="1px"' : '';
	var baseMarker = getBaseMarker(this.category, this.icaotype, this.typeDescription, this.wtc);
	var rotation = this.track;
	if (rotation == null) {
		rotation = this.true_heading;
	} else if (rotation == null) {
		rotation = this.mag_heading;
	} else if (rotation == null) {
		rotation = 0;
	}

	//var transparentBorderWidth = (32 / baseMarker.scale / scaleFactor).toFixed(1);

	var svgKey = col + '!' + outline + '!' + baseMarker.svg + '!' + add_stroke + "!" + scaleFactor;
	var styleKey = opacity + '!' + rotation;

	if (this.markerStyle == null || this.markerIcon == null || this.markerSvgKey != svgKey) {
		//console.log(this.icao + " new icon and style " + this.markerSvgKey + " -> " + svgKey);

		var icon = new ol.style.Icon({
			anchor: [0.5, 0.5],
			anchorXUnits: 'fraction',
			anchorYUnits: 'fraction',
			scale: 1.2 * scaleFactor,
			imgSize: baseMarker.size,
			src: svgPathToURI(baseMarker.svg, outline, col, add_stroke),
			rotation: (baseMarker.noRotate ? 0 : rotation * Math.PI / 180.0),
			opacity: opacity,
			rotateWithView: (baseMarker.noRotate ? false : true)
		});

		this.markerIcon = icon;
		this.markerStyle = new ol.style.Style({
			image: this.markerIcon
		});
		this.markerStaticIcon = null;
		this.markerStaticStyle = new ol.style.Style({});

		this.markerStyleKey = styleKey;
		this.markerSvgKey = svgKey;

		if (this.marker) {
			this.marker.setStyle(this.markerStyle);
			this.markerStatic.setStyle(this.markerStaticStyle);
		}
	}

	if (this.markerStyleKey != styleKey) {
		//console.log(this.icao + " new rotation");
		this.markerIcon.setRotation(rotation * Math.PI / 180.0);
		this.markerIcon.setOpacity(opacity);
		if (this.staticIcon) {
			this.staticIcon.setOpacity(opacity);
		}
		this.markerStyleKey = styleKey;
	}

	return true;
};

// Update our data
PlaneObject.prototype.updateData = function(receiver_timestamp, data, locOnly) {
	// get location data first, return early if only those are needed.
	if (data.mlat && data.mlat.indexOf("lat") >= 0)
		this.position_from_mlat = true;
	else
		this.position_from_mlat = false;

	if (data.lat != null) {
		this.position   = [data.lon, data.lat];
		this.last_position_time = receiver_timestamp - data.seen_pos;
	}

	this.track = data.track;
	this.altitude = data.alt_baro;
	this.last_message_time = receiver_timestamp - data.seen;

	if (locOnly)
		return;



	// Update all of our data
	this.messages	= data.messages;
	if (!this.rssa)
		this.rssa = [data.rssi,data.rssi,data.rssi,data.rssi];
	this.rssa[this.rindex++%4] = data.rssi;
	this.rssi       = (this.rssa[0] + this.rssa[1] + this.rssa[2] + this.rssa[3])/4;

	// simple fields

	this.alt_baro = data.alt_baro;
	this.alt_geom = data.alt_geom;
	this.gs = data.gs;
	this.ias = data.ias;
	this.tas = data.tas;
	this.track_rate = data.track_rate;
	this.mag_heading = data.mag_heading;
	this.mach = data.mach;
	this.roll = data.roll;
	this.nav_altitude = data.nav_altitude;
	this.nav_heading = data.nav_heading;
	this.nav_modes = data.nav_modes;
	this.nac_p = data.nac_p;
	this.nac_v = data.nac_v;
	this.nic_baro = data.nic_baro;
	this.sil_type = data.sil_type;
	this.sil = data.sil;
	this.nav_qnh = data.nav_qnh;
	this.baro_rate = data.baro_rate;
	this.geom_rate = data.geom_rate;
	this.rc = data.rc;
	this.squawk = data.squawk;
	this.category = data.category;
	this.version = data.version;
	this.alt_baro = data.alt_baro;

	// fields with more complex behaviour
	if ("true_heading" in data)
		this.true_heading = data.true_heading;

	if ('type' in data)
		this.addrtype	= data.type;
	else
		this.addrtype   = 'adsb_icao';

	// don't expire callsigns
	if ('flight' in data)
		this.flight	= data.flight;


	if ('lat' in data && SitePosition) {
		//var WGS84 = new ol.Sphere(6378137);
		//this.sitedist = WGS84.haversineDistance(SitePosition, this.position);
		this.sitedist = ol.sphere.getDistance(SitePosition, this.position);
	}

	// Pick a selected altitude
	if ('nav_altitude_fms' in data) {
		this.nav_altitude = data.nav_altitude_fms;
	} else if ('nav_altitude_mcp' in data) {
		this.nav_altitude = data.nav_altitude_mcp;
	} else {
		this.nav_altitude = null;
	}


	// Pick an altitude
	if ('alt_baro' in data) {
		this.altitude = data.alt_baro;
	} else if ('alt_geom' in data) {
		this.altitude = data.alt_geom;
	} else {
		this.altitude = null;
	}

	// Pick vertical rate from either baro or geom rate
	// geometric rate is generally more reliable (smoothed etc)
	if ('geom_rate' in data) {
		this.vert_rate = data.geom_rate;
	} else if ('baro_rate' in data) {
		this.vert_rate = data.baro_rate;
	} else {
		this.vert_rate = null;
	}

	// Pick a speed
	if ('gs' in data) {
		this.speed = data.gs;
	} else if ('tas' in data) {
		this.speed = data.tas;
	} else if ('ias' in data) {
		this.speed = data.ias;
	} else {
		this.speed = null;
	}
};

PlaneObject.prototype.updateTick = function(receiver_timestamp, last_timestamp) {
	// recompute seen and seen_pos
	this.seen = receiver_timestamp - this.last_message_time;
	this.seen_pos = (this.last_position_time != null ? receiver_timestamp - this.last_position_time : null);

	// If no packet in over 58 seconds, clear the plane.
	if (this.seen > 58 || this.position == null || this.seen_pos > 100) {
		if (this.visible) {
			//console.log("hiding " + this.icao);
			this.clearMarker();
			this.clearLines();
			this.visible = false;
			if (SelectedPlane == this.icao)
				selectPlaneByHex(null,false);
		}
	} else {
		this.visible = true;
		if (this.updateTrack(receiver_timestamp, last_timestamp)) {
			this.updateLines();
			this.updateMarker(true);
		} else { 
			this.updateMarker(false); // didn't move
		}
	}
};

PlaneObject.prototype.clearMarker = function() {
	if (this.marker) {
		PlaneIconFeatures.remove(this.marker);
		PlaneIconFeatures.remove(this.markerStatic);
		/* FIXME google.maps.event.clearListeners(this.marker, 'click'); */
		this.marker = this.markerStatic = null;
	}
};

// Update our marker on the map
PlaneObject.prototype.updateMarker = function(moved) {
	if (!this.visible || this.position == null || this.isFiltered()) {
		this.clearMarker();
		return;
	}

	this.updateIcon();
	if (this.marker) {
		if (moved) {
			this.marker.setGeometry(new ol.geom.Point(ol.proj.fromLonLat(this.position)));
			this.markerStatic.setGeometry(new ol.geom.Point(ol.proj.fromLonLat(this.position)));
		}
	} else {
		this.marker = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(this.position)));
		this.marker.hex = this.icao;
		this.marker.setStyle(this.markerStyle);
		PlaneIconFeatures.push(this.marker);

		this.markerStatic = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(this.position)));
		this.markerStatic.hex = this.icao;
		this.markerStatic.setStyle(this.markerStaticStyle);
		PlaneIconFeatures.push(this.markerStatic);
	}
};


// return the styling of the lines based on altitude
PlaneObject.prototype.altitudeLines = function(altitude) {
	var colorArr = this.getAltitudeColor(altitude);
	return new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: 'hsl(' + (colorArr[0]/5).toFixed(0)*5 + ',' + (colorArr[1]/5).toFixed(0)*5 + '%,' + (colorArr[2]/5).toFixed(0)*5 + '%)',
			width: 2
		})
	})
}

// Update our planes tail line,
PlaneObject.prototype.updateLines = function() {
	if (!this.selected)
		return;

	if (this.track_linesegs.length == 0)
		return;

	var estimateStyle = new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: '#a08080',
			width: 1.5,
			lineDash: [3, 3]
		})
	});

	var airStyle = new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: '#000000',
			width: 2
		})
	});

	var groundStyle = new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: '#408040',
			width: 2
		})
	});

	// find the old elastic band so we can replace it in place
	// (which should be faster than remove-and-add when PlaneTrailFeatures is large)
	var oldElastic = -1;
	if (this.elastic_feature) {
		oldElastic = PlaneTrailFeatures.getArray().indexOf(this.elastic_feature);
	}

	// create the new elastic band feature
	var lastseg = this.track_linesegs[this.track_linesegs.length - 1];
	var lastfixed = lastseg.fixed.getCoordinateAt(1.0);
	var geom = new ol.geom.LineString([lastfixed, ol.proj.fromLonLat(this.position)]);
	this.elastic_feature = new ol.Feature(geom);
	if (lastseg.estimated) {
		this.elastic_feature.setStyle(estimateStyle);
	} else {
		this.elastic_feature.setStyle(this.altitudeLines(lastseg.altitude));
	}

	if (oldElastic < 0) {
		PlaneTrailFeatures.push(this.elastic_feature);
	} else {
		PlaneTrailFeatures.setAt(oldElastic, this.elastic_feature);
	}

	// create any missing fixed line features
	for (var i = 0; i < this.track_linesegs.length; ++i) {
		var seg = this.track_linesegs[i];
		if (!seg.feature) {
			seg.feature = new ol.Feature(seg.fixed);
			if (seg.estimated) {
				seg.feature.setStyle(estimateStyle);
			} else {
				seg.feature.setStyle(this.altitudeLines(seg.altitude));
			}

			PlaneTrailFeatures.push(seg.feature);
		}
	}
};

PlaneObject.prototype.destroy = function() {
	this.clearLines();
	this.clearMarker();
};
