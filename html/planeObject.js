"use strict";

function PlaneObject(icao) {
    // Info about the plane
    this.icao      = icao;
    this.icaorange = findICAORange(icao);
    this.flight    = null;
    this.squawk    = null;
    this.selected  = false;
    this.category  = null;
    this.dataSource = "other";
    this.hasADSB   = false;
    this.adsbOnGround = null;

    this.trCache = [];

    // Basic location information
    this.altitude       = null;
    this.alt_baro       = null;
    this.alt_geom       = null;
    this.altitudeTime   = 0;
    this.bad_alt        = null;
    this.bad_altTime    = null;
    this.alt_reliable   = 0;

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

    this.rotation       = 0;

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
    this.prev_time = null;
    this.prev_track = null;
    this.position  = null;
    this.sitedist  = null;
    this.too_fast = 0;

    // Data packet numbers
    this.messages  = 0;
    this.rssi      = null;
    this.msgs1090  = 0;
    this.msgs978   = 0;
    this.messageRate = 0;
    this.messageRateOld = 0;

    // Track history as a series of line segments
    this.elastic_feature = null;
    this.track_linesegs = [];
    this.history_size = 0;
    this.trace = []; // save last 30 seconds of positions

    // Track (direction) at the time we last appended to the track history
    this.tail_track = null;
    this.tail_true = null;
    // Timestamp of the most recent point appended to the track history
    this.tail_update = null;

    // When was this last updated (receiver timestamp)
    this.last_message_time = 0;
    this.position_time = 0;

    this.last = 0; // last json this plane was included in

    // When was this last updated (seconds before last update)
    this.seen = null;
    this.seen_pos = null;

    // Display info
    this.visible = true;
    this.marker = null;
    this.markerStyle = null;
    this.markerIcon = null;
    this.markerStyleKey = null;
    this.markerSvgKey = null;
    this.baseScale = 1;

    // start from a computed registration, let the DB override it
    // if it has something else.
    this.registration = registration_from_hexid(this.icao);
    this.icaoType = null;
    this.typeDescription = null;
    this.wtc = null;


    // request metadata
    this.getAircraftData();

}
PlaneObject.prototype.checkLayers = function() {
    if (!this.trail_features)
        this.createFeatures();
    if ((showTrace || trackLabels) && !this.trail_labels)
        this.createLabels();
}

PlaneObject.prototype.createFeatures = function() {
    this.trail_features = new ol.source.Vector();

    this.layer = new ol.layer.Vector({
        name: this.icao,
        isTrail: true,
        source: this.trail_features,
        declutter: false,
        zIndex: 150,
    });

    trailGroup.push(this.layer);
}

PlaneObject.prototype.createLabels = function() {
    this.trail_labels = new ol.source.Vector();

    this.layer_labels = new ol.layer.Vector({
        name: this.icao + '_labels',
        isTrail: true,
        source: this.trail_labels,
        declutter: true,
        zIndex: 151,
    });

    trailGroup.push(this.layer_labels);
}

PlaneObject.prototype.logSel = function(loggable) {
    if (debugTracks && this.selected && !SelectedAllPlanes)
        console.log(loggable);
    return;
}

PlaneObject.prototype.isFiltered = function() {
    if (this.selected && !SelectedAllPlanes)
        return false;

    if (onlySelected && !this.selected) {
        return true;
    }

    if (onlyMLAT && !(this.dataSource == "mlat" || (this.dataSource == "other" && this.position == null))) {
        return true;
    }

    if (onlyMilitary && !this.military) {
        return true;
    }

    if (onlyADSB && this.dataSource != "adsb" && this.dataSource != "uat") {
        return true;
    }

    if (filterTISB && this.dataSource == "tisb") {
        return true;
    }

    if (!filterTracks && this.altFiltered(this.altitude))
        return true;

    if (PlaneFilter.type && (!this.icaoType || !this.icaoType.match(PlaneFilter.type)) ) {
        return true;
    }

    if (PlaneFilter.description && (!this.typeDescription || !this.typeDescription.match(PlaneFilter.description)) ) {
        return true;
    }

    if (PlaneFilter.callsign
        && (!this.flight || !this.flight.match(PlaneFilter.callsign))
        && (!this.squawk || !this.squawk.match(PlaneFilter.callsign))
    ) {
        return true;
    }

    // filter out ground vehicles
    if (typeof PlaneFilter.groundVehicles !== 'undefined' && PlaneFilter.groundVehicles === 'filtered') {
        if (typeof this.category === 'string' && this.category.startsWith('C')) {
            return true;
        }
    }

    // filter out blocked MLAT flights
    if (typeof PlaneFilter.blockedMLAT !== 'undefined' && PlaneFilter.blockedMLAT === 'filtered') {
        if (typeof this.icao === 'string' && this.icao.startsWith('~')) {
            return true;
        }
    }

    return false;
}


PlaneObject.prototype.altFiltered = function(altitude) {
    if (PlaneFilter.minAltitude == null || PlaneFilter.maxAltitude == null)
        return false;
    if (altitude == null) {
        return true;
    }
    const planeAltitude = altitude === "ground" ? 0 : altitude;
    if (planeAltitude < PlaneFilter.minAltitude || planeAltitude > PlaneFilter.maxAltitude) {
        return true;
    }
    return false;
}

PlaneObject.prototype.updateTail = function() {

    this.tail_update = this.prev_time;
    this.tail_track = this.prev_track;
    this.tail_rot = this.prev_rot;
    this.tail_true = this.prev_true;
    this.tail_position = this.prev_position;

    return this.updateTrackPrev();
}

PlaneObject.prototype.updateTrackPrev = function() {

    this.prev_position = this.position;
    this.prev_time = this.position_time;
    this.prev_track = this.track;
    this.prev_rot = this.rotation;
    this.prev_true = this.true_head;
    this.prev_alt = this.altitude;
    this.prev_alt_rounded = this.alt_rounded;
    this.prev_speed = this.speed;

    return true;
}

// Appends data to the running track so we can get a visual tail on the plane
// Only useful for a long running browser session.
PlaneObject.prototype.updateTrack = function(now, last, serverTrack, stale) {
    if (this.position == null)
        return false;
    if (this.prev_position && this.position[0] == this.prev_position[0] && this.position[1] == this.prev_position[1]
        && !serverTrack)
        return false;
    if (this.bad_position && this.position[0] == this.bad_position[0] && this.position[1] == this.bad_position[1])
        return false;

    if (this.position && SitePosition) {
        this.sitedist = ol.sphere.getDistance(SitePosition, this.position);
    }

    let projHere = ol.proj.fromLonLat(this.position);
    let on_ground = (this.altitude === "ground");

    let is_leg = false;
    if (this.leg_ts == now)
        is_leg = 'end';
    if (this.leg_ts == last)
        is_leg = 'start';

    if (this.track_linesegs.length == 0) {
        // Brand new track
        //console.log(this.icao + " new track");
        if (this.leg_ts == now)
            is_leg = 'start';
        let newseg = { fixed: new ol.geom.LineString([projHere]),
            feature: null,
            estimated: false,
            ground: on_ground,
            altitude: this.alt_rounded,
            alt_real: this.altitude,
            speed: this.speed,
            ts: now,
            track: this.rotation,
            leg: is_leg,
        };
        this.track_linesegs.push(newseg);
        this.history_size ++;
        this.updateTrackPrev();
        return this.updateTail();
    }

    let projPrev = ol.proj.fromLonLat(this.prev_position);
    let lastseg = this.track_linesegs[this.track_linesegs.length - 1];

    let distance = 1000;
    let derivedMach = 0.01;
    let filterSpeed = 10000;

    const pFilter = (positionFilter == true || (positionFilter == 'onlyMLAT' && this.dataSource == "mlat"));

    if (pFilter) {
        distance = ol.sphere.getDistance(this.position, this.prev_position);
        derivedMach = (distance/(this.position_time - this.prev_time + 0.4))/343;
        filterSpeed = on_ground ? positionFilterSpeed/10 : positionFilterSpeed;
        filterSpeed = (this.speed != null && this.prev_speed != null) ? (positionFilterGsFactor*(Math.max(this.speed, this.prev_speed)+10+(this.dataSource == "mlat")*100)/666) : filterSpeed;
    }

    // ignore the position if the object moves faster than positionFilterSpeed (default Mach 3.5)
    // or faster than twice the transmitted groundspeed
    if (pFilter && derivedMach > filterSpeed && this.too_fast < 1) {
        this.bad_position = this.position;
        this.too_fast++;
        if (debugPosFilter) {
            console.log(this.icao + " / " + this.name + " ("+ this.dataSource + "): Implausible position filtered: " + this.bad_position[0] + ", " + this.bad_position[1] + " (kts/Mach " + (derivedMach*666).toFixed(0) + " > " + (filterSpeed*666).toFixed(0)   + " / " + derivedMach.toFixed(2) + " > " + filterSpeed.toFixed(2) + ") (" + (this.position_time - this.prev_time + 0.2).toFixed(1) + "s)");
        }
        this.position = this.prev_position;
        this.position_time = this.prev_time;
        if (debugPosFilter) {
            this.drawRedDot(this.bad_position);
            jumpTo = this.icao;
        }
        return false;
    } else {
        this.too_fast = Math.max(-5, this.too_fast-0.8);
    }

    if (this.request_rotation_from_track && this.prev_position) {
        this.rotation = bearingFromLonLat(this.prev_position, this.position);
    }


    // special case crossing the 180 -180 longitude line by just starting a new track
    if ((this.position[0] < -90 && this.prev_position[0] > 90)
        || (this.position[0] > 90 && this.prev_position[0] < -90)
    ) {
        let sign1 = Math.sign(this.prev_position[0]);
        let sign2 = Math.sign(this.position[0]);
        let londiff1 = 180 - Math.abs(this.prev_position[0]);
        let londiff2 = 180 - Math.abs(this.position[0]);
        let ratio1 = londiff1 / (londiff1 + londiff2);
        let ratio2 = londiff2 / (londiff1 + londiff2);
        let tryLat = ratio1 * this.prev_position[1] + ratio2 *this.position[1];
        let minDistance = 50 * 1000* 1000;
        let midLat = 0;
        for (let i = 0; i < 100; i += 1) {
            let distance1 = ol.sphere.getDistance(this.prev_position, [sign1 * 180, tryLat - i]);
            let distance2 = ol.sphere.getDistance(this.position, [sign2 * 180, tryLat - i]);

            let distance = distance1 + distance2;
            if (distance < minDistance) {
                minDistance = distance;
                midLat = tryLat - i;
            } else {
                break;
            }
        }
        for (let i = 1; i < 100; i+= 1) {
            let distance1 = ol.sphere.getDistance(this.prev_position, [sign1 * 180, tryLat + i]);
            let distance2 = ol.sphere.getDistance(this.position, [sign2 * 180, tryLat + i]);

            let distance = distance1 + distance2;

            if (distance < minDistance) {
                minDistance = distance;
                midLat = tryLat + i;
            } else {
                break;
            }
        }
        let midPoint1 = ol.proj.fromLonLat([sign1 * 180, midLat]);
        let midPoint2 = ol.proj.fromLonLat([sign2 * 180, midLat]);

        lastseg.fixed.appendCoordinate(projPrev);
        this.track_linesegs.push({ fixed: new ol.geom.LineString([projPrev, midPoint1]),
            feature: null,
            estimated: true,
            altitude: this.prev_alt_rounded,
            alt_real: this.prev_alt,
            speed: this.prev_speed,
            ground: on_ground,
            ts: this.prev_time,
            track: this.prev_rot,
            leg: is_leg,
        });
        this.track_linesegs.push({ fixed: new ol.geom.LineString([midPoint2, projHere]),
            feature: null,
            estimated: true,
            ts: NaN,
            altitude: this.prev_alt_rounded,
            alt_real: this.prev_alt,
            speed: this.prev_speed,
            ground: on_ground,
            ts: NaN,
            track: this.prev_rot,
            noLabel: true,
        });
        this.history_size += 2;

        return this.updateTail();
    }


    // Determine if track data are intermittent/stale
    // Time difference between two position updates should not be much
    // greater than the difference between data inputs
    let time_difference = (this.position_time - this.prev_time) - (now - last);

    //let stale_timeout = lastseg.estimated ? 5 : 10;
    let stale_timeout = 15;

    // MLAT data are given some more leeway
    if (this.dataSource == "mlat")
        stale_timeout = 15;

    // On the ground you can't go that quick
    if (on_ground)
        stale_timeout = 30;

    // Also check if the position was already stale when it was exported by dump1090
    // Makes stale check more accurate for example for 30s spaced history points

    const estimated = (time_difference > stale_timeout) || ((now - this.position_time) > stale_timeout) || stale;

    /*
    let track_change = this.track != null ? Math.abs(this.tail_track - this.track) : NaN;
    track_change = track_change < 180 ? track_change : Math.abs(track_change - 360);
    let true_change =  this.trueheading != null ? Math.abs(this.tail_true - this.true_heading) : NaN;
    true_change = true_change < 180 ? true_change : Math.abs(true_change - 360);
    if (!isNaN(true_change)) {
        track_change = isNaN(track_change) ? true_change : Math.max(track_change, true_change);
    }
    */
    let track_change = Math.abs(this.tail_rot - this.rotation);

    let alt_change = Math.abs(this.alt_rounded - lastseg.altitude);
    let since_update = this.prev_time - this.tail_update;
    let distance_traveled = ol.sphere.getDistance(this.tail_position, this.prev_position);

    if (
        this.prev_alt_rounded !== lastseg.altitude
        || this.prev_time > lastseg.ts + 300
        || estimated != lastseg.estimated
        || tempTrails
        || debugAll ||
        (
            serverTrack &&
            (
                this.prev_time - lastseg.ts > 5
                || estimated
                || track_change > 2
                || Math.abs(this.prev_speed - lastseg.speed) > 5
                || Math.abs(this.prev_alt - lastseg.alt_real) > 50
                || is_leg
            )
        )

        //lastseg.ground != on_ground
        //|| (!on_ground && isNaN(alt_change))
        //|| (alt_change > 700)
        //|| (alt_change > 375 && this.alt_rounded < 9000)
        //|| (alt_change > 150 && this.alt_rounded < 5500)
    ) {
        // Create a new segment as the ground state or the altitude changed.
        // The new state is only drawn after the state has changed
        // and we then get a new position.

        this.logSel("sec_elapsed: " + since_update.toFixed(1) + " alt_change: "+ alt_change.toFixed(0) + " derived_speed(kts/Mach): " + (distance_traveled/since_update*1.94384).toFixed(0) + " / " + (distance_traveled/since_update/343).toFixed(1));

        lastseg.fixed.appendCoordinate(projPrev);
        this.track_linesegs.push({ fixed: new ol.geom.LineString([projPrev]),
            feature: null,
            estimated: estimated,
            altitude: this.prev_alt_rounded,
            alt_real: this.prev_alt,
            speed: this.prev_speed,
            ground: on_ground,
            ts: this.prev_time,
            track: this.prev_rot,
            leg: is_leg,
        });

        this.history_size += 2;

        return this.updateTail();
    }


    // Add current position to the existing track.
    // We only retain some points depending on time elapsed and track change
    let turn_density = 6.5;
    if (
        since_update > 86 ||
        (!on_ground && since_update > (100/turn_density)/track_change) ||
        (!on_ground && isNaN(track_change) && since_update > 8) ||
        (on_ground && since_update > (120/turn_density)/track_change && distance_traveled > 20) ||
        (on_ground && distance_traveled > 50 && since_update > 5) ||
        debugAll
    ) {

        lastseg.fixed.appendCoordinate(projPrev);
        this.history_size ++;

        this.logSel("sec_elapsed: " + since_update.toFixed(1) + " " + (on_ground ? "ground" : "air") +  " dist:" + distance_traveled.toFixed(0) +  " track_change: "+ track_change.toFixed(1) + " derived_speed(kts/Mach): " + (distance_traveled/since_update*1.94384).toFixed(0) + " / " + (distance_traveled/since_update/343).toFixed(1));

        return this.updateTail();
    }

    return this.updateTrackPrev();
};

// This is to remove the line from the screen if we deselect the plane
PlaneObject.prototype.clearLines = function() {
    if (this.layer && this.layer.getVisible()) {
        this.layer.setVisible(false);
    }
    if (this.layer_labels && this.layer_labels.getVisible())
        this.layer_labels.setVisible(false);
};

PlaneObject.prototype.getDataSourceNumber = function() {
    // MLAT
    if (this.jaero || this.sbs)
        return 5;
    if (this.dataSource == "mlat") {
        return 3;
    }
    if (this.dataSource == "uat")
        return 2; // UAT

    // Not MLAT, but position reported - ADSB or letiants
    if (this.dataSource == "tisb")
        return 4; // TIS-B
    if (this.dataSource == "adsb")
        return 1;

    // Otherwise Mode S
    return 5;

    // TODO: add support for Mode A/C
};

PlaneObject.prototype.getDataSource = function() {
    // MLAT
    if (this.jaero)
        return 'jaero';

    if (this.sbs)
        return 'unknown';

    if (this.dataSource == "mlat") {
        return 'mlat';
    }
    if (this.dataSource == "uat" && this.dataSource != "tisb")
        return 'uat';

    if (this.addrtype) {
        return this.addrtype;
    }

    if (this.dataSource == "adsb")
        return "adsb_icao";

    if (this.dataSource == "tisb")
        return "tisb";

    // Otherwise Mode S
    return 'mode_s';

    // TODO: add support for Mode A/C
};

PlaneObject.prototype.getMarkerColor = function() {
    // Emergency squawks override everything else
    if (this.squawk in SpecialSquawks)
        return SpecialSquawks[this.squawk].markerColor;

    if (monochromeMarkers) {
        return monochromeMarkers;
    }

    let h, s, l;

    let colorArr = altitudeColor(this.alt_rounded);

    h = colorArr[0];
    s = colorArr[1];
    l = colorArr[2];

    // If we have not seen a recent position update, change color
    if (this.seen_pos > 15 && !globeIndex)  {
        h += ColorByAlt.stale.h;
        s += ColorByAlt.stale.s;
        l += ColorByAlt.stale.l;
    }
    if (this.alt_rounded == "ground") {
        l += 15;
    }

    // If this marker is selected, change color
    if (this.selected && !SelectedAllPlanes && !onlySelected){
        h += ColorByAlt.selected.h;
        s += ColorByAlt.selected.s;
        l += ColorByAlt.selected.l;
    }

    // If this marker is a mlat position, change color
    if (this.dataSource == "mlat") {
        h += ColorByAlt.mlat.h;
        s += ColorByAlt.mlat.s;
        l += ColorByAlt.mlat.l;
    }

    if (h < 0) {
        h = (h % 360) + 360;
    } else if (h >= 360) {
        h = h % 360;
    }

    //if (s < 5) s = 5;
    if (s > 95) s = 95;

    if (l < 5) l = 5;
    else if (l > 95) l = 95;

    return 'hsl(' + h.toFixed(0) + ',' + s.toFixed(0) + '%,' + l.toFixed(0) + '%)'
}

function altitudeColor(altitude) {
    let h, s, l;

    if (altitude == null) {
        h = ColorByAlt.unknown.h;
        s = ColorByAlt.unknown.s;
        l = ColorByAlt.unknown.l;
    } else if (altitude === "ground") {
        h = ColorByAlt.ground.h;
        s = ColorByAlt.ground.s;
        l = ColorByAlt.ground.l;
    } else {
        s = ColorByAlt.air.s;

        // find the pair of points the current altitude lies between,
        // and interpolate the hue between those points
        let hpoints = ColorByAlt.air.h;
        h = hpoints[0].val;
        for (let i = hpoints.length-1; i >= 0; --i) {
            if (altitude > hpoints[i].alt) {
                if (i == hpoints.length-1) {
                    h = hpoints[i].val;
                } else {
                    h = hpoints[i].val + (hpoints[i+1].val - hpoints[i].val) * (altitude - hpoints[i].alt) / (hpoints[i+1].alt - hpoints[i].alt)
                }
                break;
            }
        }
        let lpoints = ColorByAlt.air.l;
        lpoints = lpoints.length ? lpoints : [{h:0, val:lpoints}];
        l = lpoints[0].val;
        for (let i = lpoints.length-1; i >= 0; --i) {
            if (h > lpoints[i].h) {
                if (i == lpoints.length-1) {
                    l = lpoints[i].val;
                } else {
                    l = lpoints[i].val + (lpoints[i+1].val - lpoints[i].val) * (h - lpoints[i].h) / (lpoints[i+1].h - lpoints[i].h)
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

    let col = this.getMarkerColor();
    let baseMarkerKey = (this.category ? this.category : "A0") + "_"
        + this.typeDescription + "_" + this.wtc  + "_" + this.icaoType;

    if (!this.baseMarker || this.baseMarkerKey != baseMarkerKey) {
        this.baseMarkerKey = baseMarkerKey;
        this.baseMarker = getBaseMarker(this.category, this.icaoType, this.typeDescription, this.wtc);
        this.shape = this.baseMarker[0];
        this.baseScale = this.baseMarker[1];
        this.baseMarker = shapes[this.shape]
        if (!this.baseMarker)
            console.log(baseMarkerKey);
    }
    let outline = (this.shape != 'md11') ?
        ' stroke="'+OutlineADSBColor+'" stroke-width="0.4px"' :
        ' stroke="'+OutlineADSBColor+'" stroke-width="2px"';
    let add_stroke = (this.selected && !SelectedAllPlanes && !onlySelected) ? outline : '';

    this.scale = scaleFactor * this.baseScale;
    let svgKey  = col + '!' + this.shape + '!' + add_stroke;
    let labelText = null;
    if ( enableLabels && !showTrace && (!multiSelect || (multiSelect && this.selected)) &&
        (
            (ZoomLvl >= labelZoom && this.altitude != "ground")
            || (ZoomLvl >= labelZoomGround-2 && this.speed > 5)
            || ZoomLvl >= labelZoomGround
            || (this.selected && !SelectedAllPlanes)
        )
    ) {
        if (extendedLabels == 2) {
            labelText = NBSP + (this.icaoType ? this.icaoType : "  ?  ") + NBSP + "\n" + NBSP + (this.registration ? this.registration : "  ?  ")+ NBSP + "\n" + NBSP + this.name + NBSP;
        } else if (extendedLabels == 1 ) {
            const altitude = this.altitude ? this.altitude : '  ?  ';
            if ((!this.onGround || (this.speed && this.speed > 18) || (this.selected && !SelectedAllPlanes))) {
                labelText =  Number(this.speed).toFixed(0).toString().padStart(4, NBSP)+ "  "
                    + altitude.toString().padStart(5, NBSP) + " \n " + this.name + " ";
            } else {
                labelText =  " " + this.name + " ";
            }
        } else {
            labelText = " " + this.name + " ";
        }
    }
    let styleKey = svgKey + '!' + labelText + '!' + this.scale;

    if (this.markerStyle == null || this.markerIcon == null || (this.markerSvgKey != svgKey)) {
        //console.log(this.icao + " new icon and style " + this.markerSvgKey + " -> " + svgKey);

        this.markerSvgKey = svgKey;
        this.rotationCache = this.rotation;

        if (iconCache[svgKey] == undefined) {
            let svgURI = svgPathToURI(this.baseMarker.svg, OutlineADSBColor, col, add_stroke);

            addToIconCache.push([svgKey, null, svgURI]);

            this.markerIcon = new ol.style.Icon({
                scale: this.scale,
                imgSize: this.baseMarker.size,
                src: svgURI,
                rotation: (this.baseMarker.noRotate ? 0 : this.rotation * Math.PI / 180.0),
                rotateWithView: (this.baseMarker.noRotate ? false : true),
            });
        } else {
            this.markerIcon = new ol.style.Icon({
                scale: this.scale,
                imgSize: this.baseMarker.size,
                img: iconCache[svgKey],
                rotation: (this.baseMarker.noRotate ? 0 : this.rotation * Math.PI / 180.0),
                rotateWithView: (this.baseMarker.noRotate ? false : true),
            });
        }
        //iconCache[svgKey] = undefined; // disable caching for testing
    }
    if (this.styleKey != styleKey) {
        this.styleKey = styleKey;
        if (labelText) {
            this.markerStyle = new ol.style.Style({
                image: this.markerIcon,
                text: new ol.style.Text({
                    text: labelText,
                    fill: labelFill,
                    backgroundFill: bgFill,
                    stroke: labelStrokeNarrow,
                    textAlign: 'left',
                    textBaseline: "top",
                    font: labelFont,
                    offsetX: (this.baseMarker.size[0]*0.5*0.74*this.scale),
                    offsetY: (this.baseMarker.size[0]*0.5*0.74*this.scale),
                }),
                zIndex: this.zIndex,
            });
        } else {
            this.markerStyle = new ol.style.Style({
                image: this.markerIcon,
                zIndex: this.zIndex,
            });
        }
        this.marker.setStyle(this.markerStyle);
    }

    /*
    if (this.opacityCache != opacity) {
        this.opacityCache = opacity;
        this.markerIcon.setOpacity(opacity);
    }
    */

    if (this.rotationCache == null || Math.abs(this.rotationCache - this.rotation) > 0.15) {
        this.rotationCache = this.rotation;
        this.markerIcon.setRotation(this.baseMarker.noRotate ? 0 : this.rotation * Math.PI / 180.0);
    }

    if (this.scaleCache != this.scale) {
        this.scaleCache = this.scale;
        this.markerIcon.setScale(this.scale);
    }

    return true;
};

PlaneObject.prototype.processTrace = function(options) {
    if (!options)
        options = {};
    let legStart = options.legStart;
    let legEnd = options.legEnd;
    let follow = options.follow;
    this.checkLayers();
    let trace = null;
    let timeZero, _now, _last = 0;
    this.history_size = 0;
    let points_in_trace = 0;

    let tempPlane = {};
    const oldSegs = this.track_linesegs;
    this.track_linesegs = [];
    this.remakeTrail();

    let firstPos = null;

    Object.assign(tempPlane, this);

    this.position = null;

    let onlyRecent = 0;

    if (lastLeg && !showTrace && this.recentTrace && this.recentTrace.trace) {
        trace = this.recentTrace.trace;
        for (let i = trace.length - 1; i >= 0; i--) {
            if (trace[i][6] & 2) {
                onlyRecent = 1;
                break;
            }
        }
    }

    for (let j = 0; j < 2; j++) {
        if (j == 0) {
            if (!this.fullTrace || !this.fullTrace.trace)
                continue;
            if (onlyRecent)
                continue;
            timeZero = this.fullTrace.timestamp;

            _last = timeZero - 1;

            trace = this.fullTrace.trace;
        } else {
            if (!this.recentTrace || !this.recentTrace.trace)
                continue;
            timeZero = this.recentTrace.timestamp;
            if (!trace) {
                _last = timeZero - 1;
            }
            trace = this.recentTrace.trace;
        }
        let start = 0;
        let end = trace.length;

        if (lastLeg && !showTrace) {
            for (let i = trace.length - 1; i >= 0; i--) {
                if (trace[i][6] & 2) {
                    start = i;
                    break;
                }
            }
        }

        if (legStart != null)
            start = legStart;
        if (legEnd != null)
            end = legEnd;

        for (let i = start; i < end; i++) {
            const state = trace[i];
            const timestamp = timeZero + state[0];
            const lat = state[1];
            const lon = state[2];
            const altitude = state[3];
            const gs = state[4];
            const track = state[5];
            const stale = state[6] & 1;
            const leg_marker = state[6] & 2;

            _now = timestamp;

            if (_now <= _last)
                continue;

            points_in_trace++;

            this.position = [lon, lat];
            this.position_time = _now;
            this.last_message_time = _now;
            this.altitude = altitude;
            this.alt_rounded = calcAltitudeRounded(this.altitude);
            this.speed = gs;
            this.track = track;
            if (track)
                this.rotation = track

            if (firstPos == null)
                firstPos = this.position;

            if (leg_marker)
                this.leg_ts = _now;
            if (legStart != null && legStart > 0 && legStart == i)
                this.leg_ts = _now;
            if (legEnd != null && legEnd < trace.length && legEnd == i + 1)
                this.leg_ts = _now;

            if (_last - _now > 320) {
                stale = true;
            }

            this.updateTrack(_now, _last, true, stale);
            _last = _now;
        }
    }

    for (let i = 0; i < this.trace.length; i++) {
        if (showTrace)
            break;
        const state = this.trace[i];
        if (_now >= state.now)
            continue;

        _now = state.now;
        this.position = state.position;
        this.position_time = _now;
        this.altitude = state.altitude;
        this.alt_rounded = state.alt_rounded;
        this.speed = state.speed;
        this.track = state.track;
        this.rotation = state.rotation;

        if (_last - _now > 30) {
            _last = _now - 1;
        }

        this.updateTrack(_now, _last);
        _last = _now;
    }

    if (!tempPlane.prev_position) {
        tempPlane.prev_position = this.position;
    }

    if (tempPlane.last_message_time > this.last_message_time && !showTrace) {
        let newSegs = this.track_linesegs;
        let newSize = this.history_size;
        Object.assign(this, tempPlane);
        this.track_linesegs = newSegs;
        this.history_size = newSize;
    }

    if (showTrace) {

        if (this.track_linesegs.length > 0 && this.position) {
            const proj = ol.proj.fromLonLat(this.position);
            this.track_linesegs[this.track_linesegs.length - 1].fixed.appendCoordinate(proj);
            this.track_linesegs.push({ fixed: new ol.geom.LineString([proj]),
                feature: null,
                estimated: false,
                altitude: this.alt_rounded,
                alt_real: this.altitude,
                speed: this.speed,
                ground: (this.altitude == "ground"),
                ts: this.position_time,
                track: this.rotation,
            });
        }

        now = new Date().getTime()/1000;
    }
    this.updateFeatures(now, _last);

    let mapSize = OLMap.getSize();
    let size = [Math.max(5, mapSize[0] - 280), mapSize[1]];
    if ((showTrace || showTraceExit)
        && !inView(this.position, OLMap.getView().calculateExtent(size))
        && !inView(firstPos, OLMap.getView().calculateExtent(size)))
        OLMap.getView().setCenter(ol.proj.fromLonLat(this.position));

    showTraceExit = false;

    this.updateMarker(true);
    this.updateLines();

    if (this.position && follow) {
        toggleFollow(true);
    }

    refreshSelected();

    console.log(this.history_size + ' ' + points_in_trace);
}

// Update our data
PlaneObject.prototype.updateData = function(now, last, data, init) {
    // get location data first, return early if only those are needed.

    this.updated = true;
    let newPos = false;

    let isArray = Array.isArray(data);
    // [.hex, .alt_baro, .gs, .track, .lat, .lon, .seen_pos, "mlat"/"tisb"/.type , .flight, .messages]
    //    0      1        2     3       4     5     6                 7               8        9
    // this format is only valid for chunk loading the history
    const alt_baro = isArray? data[1] : data.alt_baro;
    const gs = isArray? data[2] : data.gs;
    const track = isArray? data[3] : data.track;
    const lat = isArray? data[4] : data.lat;
    const lon = isArray? data[5] : data.lon;
    let seen = isArray? data[6] : data.seen;
    const seen_pos = isArray? data[6] : data.seen_pos;
    seen = (seen == null) ? 5 : seen;
    const type = isArray? data[7] : data.type;
    let mlat = isArray? (data[7] == "mlat") : (data.mlat != null && data.mlat.indexOf("lat") >= 0);
    let tisb = isArray? (data[7] == "tisb") : (data.tisb != null && data.tisb.indexOf("lat") >= 0);
    tisb = tisb || (type && type.substring(0,4) == "tisb");
    const flight = isArray? data[8] : data.flight;

    this.last_message_time = now - seen;

    // remember last known position even if stale
    // and some other magic to avoid mlat positions when a current ads-b position is available
    if (lat != null && this.hasADSB && this.dataSource != "mlat" && mlat
        && (now - this.position_time) < (mlatTimeout + 0.5 * mlatTimeout * this.adsbOnGround)) {
        mlat = false;
        // don't use MLAT for mlatTimeout (default 30) seconds after getting an ADS-B position
        // console.log(this.icao + ': mlat position ignored');
        if (debug && this.prev_position) {
            this.drawRedDot([lon, lat]);
        }
    } else if (lat != null && seen_pos < (now - this.position_time + 2) && !(noMLAT && mlat)) {
        this.position   = [lon, lat];
        this.position_time = now - seen_pos;
        newPos = true;
    }

    // remember last known altitude even if stale
    let newAlt = null;
    if (alt_baro != null) {
        newAlt = alt_baro;
        this.alt_baro = alt_baro;
    } else if (data.altitude != null) {
        newAlt = data.altitude;
        this.alt_baro = data.altitude;
    } else {
        this.alt_baro = null;
        if (data.alt_geom != null) {
            newAlt = data.alt_geom;
        }
    }
    // Filter anything greater than 12000 fpm


    if (newAlt == null || (newAlt == this.bad_alt && this.seen_pos > 5)) {
        // do nothing
    } else if (
        !altitudeFilter
        || this.altitude == null
        || newAlt == "ground"
        || this.altitude == "ground"
        || (seen_pos != null && seen_pos < 2)
    ) {
        this.altitude = newAlt;
        this.altitudeTime = now;
    } else if (
        this.alt_reliable > 0 && this.altBad(newAlt, this.altitude, this.altitudeTime, data)
        && (this.bad_alt == null || this.altBad(newAlt, this.bad_alt, this.bad_altTime, data))
    ) {
        // filter this altitude!
        this.alt_reliable--;
        this.bad_alt = newAlt;
        this.bad_altTime = now;
        if (debugPosFilter) {
            console.log((now%1000).toFixed(0) + ': AltFilter: ' + this.icao
                + ' oldAlt: ' + this.altitude
                + ' newAlt: ' + newAlt
                + ' elapsed: ' + (now-this.altitudeTime).toFixed(0) );
            jumpTo = this.icao;
        }
    } else {
        // good altitude
        this.altitude = newAlt;
        this.altitudeTime = now;
        this.alt_reliable = Math.min(this.alt_reliable + 1, 3);
    }

    this.alt_rounded = calcAltitudeRounded(this.altitude);

    if (this.altitude == null) {
        this.onGround = null;
        this.zIndex = -10000;
    } else if (this.altitude == "ground") {
        this.onGround = true;
        this.zIndex = -10000;
    } else {
        this.onGround = false;
        this.zIndex = this.alt_rounded;
    }

    // needed for track labels
    this.speed = gs;

    this.track = track;
    if (track != null) {
        this.rotation = track;
        this.request_rotation_from_track = false;
    } else if (data.calc_track) {
        this.rotation = data.calc_track;
    } else {
        this.request_rotation_from_track = true;
    }
    // don't expire callsigns
    if (flight != null) {
        this.flight	= flight;
        this.name = flight;
    }

    if (mlat && noMLAT) {
        this.dataSource = "other";
    } else if (mlat) {
        this.dataSource = "mlat";
    } else if (!displayUATasADSB && this.receiver == "uat" && !tisb) {
        this.dataSource = "uat";
    } else if (type == "adsb_icao" || type == "adsb_other") {
        this.dataSource = "adsb";
    } else if (type && type.substring(0,4) == "adsr") {
        this.dataSource = "adsb";
    } else if (type == "adsb_icao_nt") {
        this.dataSource = "other";
    } else if (tisb) {
        this.dataSource = "tisb";
    } else if (lat != null && type == null) {
        this.dataSource = "adsb";
        this.hasADSB = true;
        this.adsbOnGround = (alt_baro == "ground");
    }

    if (isArray) {
        this.messages = data[9];
        return;
    }

    this.jaero = data.jaero;
    this.sbs = data.sbs_other;

    if (this.jaero)
        this.dataSource = "jaero";
    if (this.sbs)
        this.dataSource = "unknown";

    // Update all of our data

    if (now - this.last > 0) {
        if (this.receiver == "1090") {
            const messageRate = (data.messages - this.msgs1090)/(now - this.last);
            this.messageRate = (messageRate + this.messageRateOld)/2;
            this.messageRateOld = messageRate; 
            this.msgs1090 = data.messages;
        } else {
            const messageRate = (data.messages - this.msgs978)/(uat_now - uat_last);
            this.messageRate = (messageRate + this.messageRateOld)/2;
            this.messageRateOld = messageRate; 
            this.msgs978 = data.messages;
        }
    }
    this.messages = data.messages;

    this.rssi = data.rssi;

    if (data.gs != null)
        this.gs = data.gs;
    else if (data.speed != null)
        this.gs = data.speed;
    else
        this.gs = null;

    if (data.baro_rate != null)
        this.baro_rate = data.baro_rate;
    else if (data.vert_rate != null)
        this.baro_rate = data.vert_rate;
    else
        this.baro_rate = null;

    // simple fields
    this.alt_geom = data.alt_geom;
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
    this.geom_rate = data.geom_rate;
    this.rc = data.rc;
    this.squawk = data.squawk;
    this.wd = data.wd;
    this.ws = data.ws;
    this.oat = data.oat;

    // fields with more complex behaviour

    if (data.version != null) {
        this.version = data.version;
    }
    if (data.category != null) {
        this.category = data.category;
    }

    if (data.true_heading != null)
        this.true_heading = data.true_heading;
    else
        this.true_heading = null;

    if (data.type != null)
        this.addrtype	= data.type;
    else
        this.addrtype = null;

    // Pick a selected altitude
    if (data.nav_altitude_fms != null) {
        this.nav_altitude = data.nav_altitude_fms;
    } else if (data.nav_altitude_mcp != null){
        this.nav_altitude = data.nav_altitude_mcp;
    } else {
        this.nav_altitude = null;
    }

    // Pick vertical rate from either baro or geom rate
    // geometric rate is generally more reliable (smoothed etc)
    if (data.geom_rate != null ) {
        this.vert_rate = data.geom_rate;
    } else if (data.baro_rate != null) {
        this.vert_rate = data.baro_rate;
    } else if (data.vert_rate != null) {
        // legacy from mut v 1.15
        this.vert_rate = data.vert_rate;
    } else {
        this.vert_rate = null;
    }

    this.request_rotation_from_track = false;
    if (this.altitude == "ground") {
        if (this.true_heading != null)
            this.rotation = this.true_heading;
        else if (this.mag_heading != null)
            this.rotation = this.mag_heading;
        else if (data.calc_track)
            this.rotation = data.calc_track;
    } else if (this.track != null) {
        this.rotation = this.track;
    } else if (this.true_heading != null) {
        this.rotation = this.true_heading;
    } else if (this.mag_heading != null) {
        this.rotation = this.mag_heading;
    } else if (data.calc_track) {
        this.rotation = data.calc_track;
    } else {
        this.request_rotation_from_track = true;
    }

    if (globeIndex && newPos) {
        let state = {};
        state.now = this.position_time;
        state.position = this.position;
        state.altitude = this.altitude;
        state.alt_rounded = this.alt_rounded;
        state.speed = this.speed;
        state.track = this.track;
        state.rotation = this.rotation;
        this.trace.push(state);
        if (this.trace.length > 20) {
            this.trace.slice(-15);
        }
    }

    this.last = now;
};

PlaneObject.prototype.updateTick = function(redraw) {
    if (this.dataSource == "uat")
        this.updateFeatures(uat_now, uat_last, redraw);
    else
        this.updateFeatures(now, last, redraw);
}

PlaneObject.prototype.updateFeatures = function(now, last, redraw) {

    // recompute seen and seen_pos
    this.seen = Math.max(0, now - this.last_message_time)
    this.seen_pos = Math.max(0, now - this.position_time);

    if (globeIndex && this.isFiltered())
        return;

    let moved = false;

    if (this.updated) {
        if (this.flight && this.flight.trim()) {
            this.name = this.flight;
        } else if (this.registration) {
            this.name = '_' + this.registration;
        } else {
            this.name = '_' + this.icao.toUpperCase();
        }
        this.name = this.name.trim();

        moved = this.updateTrack(now, last);
    }

    const zoomedOut = 40 * Math.max(0, 7 - ZoomLvl);
    const jaeroTime = this.jaero ? 35*60 : 0;
    const tisbReduction = (this.icao[0] == '~') ? 15 : 0;
    // If no packet in over 58 seconds, clear the plane.
    // Only clear the plane if it's not selected individually


    if ( !this.isFiltered() &&
        (
            (!globeIndex && this.seen < (58 - tisbReduction))
            || (globeIndex && this.seen_pos < (40 + zoomedOut + jaeroTime - tisbReduction))
            || (this.selected && (onlySelected || (!SelectedAllPlanes && !multiSelect)))
            || noVanish
        )
    ) {
        const lastVisible = this.visible;
        this.visible = true;
        if (SelectedAllPlanes)
            this.selected = true;

        let lines = false;
        let marker = false;


        marker = true;
        /*
        this.scale = scaleFactor * this.baseScale;
        if (this.scaleCache != this.scale)
            marker = true;
        */
        if (redraw || moved || lastVisible != this.visible)
            marker = lines = true;

        if (lines)
            this.updateLines();
        if (marker)
            this.updateMarker(true);
    } else {
        if (this.visible) {
            //console.log("hiding " + this.icao);
            this.clearMarker();
            this.clearLines();
            this.visible = false;
            this.selected = false;
            if (SelectedPlane == this.icao)
                selectPlaneByHex(null,false);
        }
    }
    this.updated = false;
};

PlaneObject.prototype.clearMarker = function() {
    if (this.marker && this.marker.visible) {
        PlaneIconFeatures.removeFeature(this.marker);
        this.marker.visible = false;
    }
};

// Update our marker on the map
PlaneObject.prototype.updateMarker = function(moved) {
    if (!this.visible || this.position == null || this.isFiltered()) {
        this.clearMarker();
        return;
    }
    if (!this.marker) {
        this.marker = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(this.position)));
        this.marker.hex = this.icao;
        PlaneIconFeatures.addFeature(this.marker);
        this.marker.visible = true;
    } else if (moved) {
        this.marker.setGeometry(new ol.geom.Point(ol.proj.fromLonLat(this.position)));
    }

    this.updateIcon();

    if (!this.marker.visible) {
        this.marker.visible = true;
        PlaneIconFeatures.addFeature(this.marker);
    }
};


// return the styling of the lines based on altitude
function altitudeLines (segment) {
    let colorArr = altitudeColor(segment.altitude);
    if (segment.estimated)
        colorArr = [colorArr[0], colorArr[1], colorArr[2] * 0.9];
    //let color = 'hsl(' + colorArr[0].toFixed(0) + ', ' + colorArr[1].toFixed(0) + '%, ' + colorArr[2].toFixed(0) + '%)';

    let color = hslToRgb(colorArr[0], colorArr[1], colorArr[2]);

    if (monochromeTracks)
        color = monochromeTracks;

    const lineKey = color + '_' + debugTracks + '_' + noVanish + '_' + segment.estimated + '_' + newWidth;

    if (lineStyleCache[lineKey])
        return lineStyleCache[lineKey];

    let multiplier = segment.estimated ? 0.6 : 1;

    if (noVanish && !globeIndex)
        multiplier *= (segment.estimated ? 0.3 : 0.6);

    if (!debugTracks) {
        if (segment.estimated && (!noVanish || globeIndex)) {
            lineStyleCache[lineKey]	= new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: color,
                    width: 2 * newWidth,
                    lineJoin: 'miter',
                    lineCap: 'square',
                    lineDash: [10, 10 + 3 * newWidth],
                })
            });
        } else {
            lineStyleCache[lineKey]	= new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: color,
                    width: 2 * newWidth * multiplier,
                    lineJoin: 'miter',
                    lineCap: 'square',
                })
            });
        }
    } else {
        lineStyleCache[lineKey] = [
            new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 2 * newWidth,
                    fill: new ol.style.Fill({
                        color: color
                    })
                }),
                geometry: function(feature) {
                    return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
                }
            }),
            new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: color,
                    width: 2 * newWidth * multiplier,
                })
            })
        ];
    }
    return lineStyleCache[lineKey];
}

// Update our planes tail line,
PlaneObject.prototype.updateLines = function() {
    if (!this.visible || this.position == null || (!this.selected && !SelectedAllPlanes) || this.isFiltered())
        return this.clearLines();

    if (this.track_linesegs.length == 0)
        return;

    this.checkLayers();

    let trail_add = [];
    let label_add = [];

    if (!this.layer.getVisible())
        this.layer.setVisible(true);

    if (trackLabels || showTrace) {
        if (!this.layer_labels.getVisible())
            this.layer_labels.setVisible(true);
    } else if (this.layer_labels && this.layer_labels.getVisible()) {
        this.layer_labels.setVisible(false);
    }

    // create the new elastic band feature
    if (this.elastic_feature)
        this.trail_features.removeFeature(this.elastic_feature);

    let lastseg = this.track_linesegs[this.track_linesegs.length - 1];
    let lastfixed = lastseg.fixed.getCoordinateAt(1.0);
    let geom = new ol.geom.LineString([lastfixed, ol.proj.fromLonLat(this.position)]);


    this.elastic_feature = new ol.Feature(geom);
    if (filterTracks && this.altFiltered(lastseg.altitude)) {
        this.elastic_feature.setStyle(nullStyle);
    } else {
        this.elastic_feature.setStyle(altitudeLines(lastseg));
    }

    trail_add.push(this.elastic_feature);

    // create any missing fixed line features

    for (let i = this.track_linesegs.length-1; i >= 0; i--) {
        let seg = this.track_linesegs[i];
        if (seg.feature && (!trackLabels || seg.label))
            break;

        if ((filterTracks && this.altFiltered(seg.altitude)) || altitudeLines(seg) == nullStyle) {
            seg.feature = true;
        } else if (!seg.feature) {
            seg.feature = new ol.Feature(seg.fixed);
            seg.feature.setStyle(altitudeLines(seg));
            seg.feature.hex = this.icao;
            trail_add.push(seg.feature);
        }

        if (seg.label) {
            // nothing to do, label already present
        } else if ((filterTracks && this.altFiltered(seg.altitude)) || seg.noLabel) {
            seg.label = true;
        } else if (
            trackLabels ||
            ((i == 0 || i == this.track_linesegs.length-1 ||seg.leg) && showTrace && enableLabels)
        ) {
            const alt_real = (seg.alt_real != null) ? seg.alt_real : 'n/a';
            seg.label = new ol.Feature(new ol.geom.Point(seg.fixed.getFirstCoordinate()));
            let timestamp;
            const date = new Date(seg.ts * 1000);
            if (showTrace) {
                timestamp =
                    date.getUTCHours().toString().padStart(2,'0')
                    + ":" + date.getUTCMinutes().toString().padStart(2,'0')
                    + ":" + date.getUTCSeconds().toString().padStart(2,'0');
                timestamp = "".padStart(0, NBSP) + timestamp + NBSP + "Z";
                date.getUTCHours()
                if (traceDay != date.getUTCDate())
                    timestamp = "".padStart(0, NBSP) + zDateString(date) + '\n' + timestamp;
            } else {
                timestamp = date.getHours().toString().padStart(2,'0')
                    + ":" + date.getMinutes().toString().padStart(2,'0')
                    + ":" + date.getSeconds().toString().padStart(2,'0');
                timestamp = "".padStart(2, NBSP) + timestamp;
                if (today != date.getDate())
                    timestamp = "".padStart(0, NBSP) + lDateString(date) + '\n' + timestamp;
            }
            let text =
                Number(seg.speed).toFixed(0).toString().padStart(3, NBSP) + "  "
                + (alt_real == "ground" ? ("Ground") : (alt_real.toString().padStart(6, NBSP)))
                + "\n"
                //+ NBSP + format_track_arrow(seg.track)
                + timestamp;

            if (showTrace && !trackLabels)
                text = timestamp;

            let fill = labelFill;
            let zIndex = -i - 50 * (seg.alt_real == null);
            if (seg.leg == 'start') {
                fill = new ol.style.Fill({color: '#88CC88' });
                zIndex = 123456;
            }
            if (seg.leg == 'end') {
                fill = new ol.style.Fill({color: '#8888CC' });
                zIndex = 123455;
            }
            seg.label.setStyle(
                new ol.style.Style({
                    text: new ol.style.Text({
                        text: text,
                        fill: fill,
                        stroke: labelStroke,
                        textAlign: 'left',
                        textBaseline: "top",
                        font: labelFont,
                        offsetX: 8 * globalScale,
                        offsetY: 8 * globalScale,
                    }),
                    image: new ol.style.Circle({
                        radius: 2 * globalScale,
                        fill: blackFill,
                    }),
                    zIndex: zIndex,
                })
            );
            seg.label.hex = this.icao;
            label_add.push(seg.label)
        }
    }

    if (trail_add.length > 0)
        this.trail_features.addFeatures(trail_add);
    if (this.trail_labels && label_add.length > 0)
        this.trail_labels.addFeatures(label_add);

};

PlaneObject.prototype.remakeTrail = function() {

    if (this.trail_features)
        this.trail_features.clear();
    if (this.trail_labels)
        this.trail_labels.clear();

    for (let i in this.track_linesegs) {
        this.track_linesegs[i].feature = undefined;
        this.track_linesegs[i].label = undefined;
    }
    this.elastic_feature = null;

    /*
    trailGroup.remove(this.layer);

    this.trail_features = new ol.Collection();

    this.layer = new ol.layer.Vector({
        name: this.icao,
        isTrail: true,
        source: new ol.source.Vector({
            features: this.trail_features,
        }),
        renderOrder: null,
    });

    trailGroup.push(this.layer);
    */

}

PlaneObject.prototype.makeTR = function() {

    this.tr = PlaneRowTemplate.cloneNode(true);

    if (this.icao[0] === '~') {
        // Non-ICAO address
        this.tr.cells[0].textContent = this.icao.substring(1);
        $(this.tr).css('font-style', 'italic');
    } else {
        this.tr.cells[0].textContent = this.icao;
    }

    // set flag image if available
    if (ShowFlags && this.icaorange.flag_image !== null) {
        $('img', this.tr.cells[1]).attr('src', FlagPath + this.icaorange.flag_image);
        $('img', this.tr.cells[1]).attr('title', this.icaorange.country);
    } else {
        $('img', this.tr.cells[1]).css('display', 'none');
    }

    this.clickListener = function(evt) {
        if (evt.srcElement instanceof HTMLAnchorElement) {
            evt.stopPropagation();
            return;
        }

        if(!mapIsVisible) {
            selectPlaneByHex(this.icao, {follow: true});
            //showMap();
        } else {
            selectPlaneByHex(this.icao, {follow: false});
        }
        evt.preventDefault();
    }.bind(this);

    if (!globeIndex) {
        this.dblclickListener = function(evt) {
            if(!mapIsVisible) {
                showMap();
            }
            selectPlaneByHex(this.icao, {follow: true});
            evt.preventDefault();
        }.bind(this);

        this.tr.addEventListener('dblclick', this.dblclickListener);
    }

    this.tr.addEventListener('click', this.clickListener);
}

PlaneObject.prototype.destroy = function() {
    this.clearLines();
    this.clearMarker();
    this.visible = false;
    if (this.layer) {
        trailGroup.remove(this.layer);
        this.trail_features.clear();
        this.layer = null;
    }
    if (this.layer_labels) {
        trailGroup.remove(this.layer_labels);
        this.trail_labels.clear();
        this.layer_labels = null;
    }
    if (this.tr) {
        let tbody = document.getElementById('tableinfo').tBodies[0];
        if (!this.inTable) {
            tbody.appendChild(this.tr);
        }

        this.tr.removeEventListener('click', this.clickListener);
        this.tr.removeEventListener('dblclick', this.dblclickListener);

        tbody.removeChild(this.tr);

        if (this.tr.parentNode)
            this.tr.parentNode.removeChild(this.tr);
        this.tr = null;
    }
    if (this.icao == SelectedPlane)
        SelectedPlane = null;
    for (let key in Object.keys(this)) {
        delete this[key];
    }
};

function calcAltitudeRounded(altitude) {
    if (altitude == null) {
        return null;
    } else if (altitude == "ground") {
        return altitude;
    } else if (altitude > 8000) {
        return (altitude/500).toFixed(0)*500;
    } else {
        return (altitude/125).toFixed(0)*125;
    }
}

PlaneObject.prototype.drawRedDot = function(bad_position) {
    this.checkLayers();
    if (debugJump && loadFinished && SelectedPlane != this) {
        OLMap.getView().setCenter(ol.proj.fromLonLat(bad_position));
        selectPlaneByHex(this.icao, false);
    }
    let badFeat = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(bad_position)));
    badFeat.setStyle(this.dataSource == "mlat"  ? badDotMlat : badDot);
    this.trail_features.addFeature(badFeat);
    let geom = new ol.geom.LineString([ol.proj.fromLonLat(this.prev_position), ol.proj.fromLonLat(bad_position)]);
    let lineFeat = new ol.Feature(geom);
    lineFeat.setStyle(this.dataSource == "mlat" ? badLineMlat : badLine);
    this.trail_features.addFeature(lineFeat);
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
function hslToRgb(h, s, l){
    let r, g, b;

    h /= 360;
    s *= 0.01;
    l *= 0.01;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        let hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return 'rgb(' + Math.round(r * 255) + ', ' + Math.round(g * 255) + ', ' +  Math.round(b * 255) + ')';
}

PlaneObject.prototype.altBad = function(newAlt, oldAlt, oldTime, data) {
    let max_fpm = 12000;
    if (data.geom_rate != null)
        max_fpm = 1.3*Math.abs(data.goem_rate) + 5000;
    else if (data.baro_rate != null)
        max_fpm = 1.3*Math.abs(data.baro_rate) + 5000;

    const delta = Math.abs(newAlt - oldAlt);
    const fpm = (delta < 800) ? 0 : (60 * delta / (now - oldTime + 2));
    return fpm > max_fpm;
}
PlaneObject.prototype.getAircraftData = function() {
    let req = getAircraftData(this.icao);

    // military icao ranges
    if (this.milRange()) {
        this.military = true;
    }

    req.done(function(data) {
        if (data == null) {
            //console.log(this.icao + ': Not found in database!');
            return;
        }
        if (data == "strange") {
            //console.log(this.icao + ': Database malfunction!');
            return;
        }


        //console.log(this.icao + ': loaded!');
        // format [r:0, t:1, f:2]

        if (data[0]) {
            this.registration = data[0];
        }

        if (data[1]) {
            this.icaoType = data[1];
            this.icaoTypeCache = this.icaoType;
        }

        if (data[3]) {
            this.typeDescription = data[3];
        }

        if (data[4]) {
            this.wtc = data[4];
        }

        if (data[2]) {
            this.military = (data[2][0] == '1');
            this.interesting = (data[2][1] == '1');
        }
        if (this.selected) {
            refreshSelected();
        }

        this.updateMarker(true);

        data = null;
    }.bind(this));

    req.fail(function(jqXHR,textStatus,errorThrown) {
        if (textStatus == 'timeout')
            this.getAircraftData();
        else
            console.log(this.icao + ': Database load error: ' + textStatus + ' at URL: ' + jqXHR.url);
    }.bind(this));
}


PlaneObject.prototype.reapTrail = function() {
    const oldSegs = this.track_linesegs;
    this.track_linesegs = [];
    this.history_size = 0;
    for (let i in oldSegs) {
        const seg = oldSegs[i];
        if (seg.ts + tempTrailsTimeout > now) {
            this.history_size += seg.fixed.getCoordinates().length;
            this.track_linesegs.push(seg);
        }
    }
    if (this.track_linesegs.length != oldSegs.length) {
        this.remakeTrail();
        this.updateTick(true);
    }
}


PlaneObject.prototype.milRange = function() {
    return (
        false
        // us military
        //adf7c8-adf7cf = united states mil_5(uf)
        //adf7d0-adf7df = united states mil_4(uf)
        //adf7e0-adf7ff = united states mil_3(uf)
        //adf800-adffff = united states mil_2(uf)
        || this.icao.match(/^adf[7-9]/)
        || this.icao.match(/^adf[a-f]/)
        //ae0000-afffff = united states mil_1(uf)
        || this.icao.match(/^a(e|f)/)

        //010070-01008f = egypt_mil
        || this.icao.match(/^0100(7|8)/)

        //0a4000-0a4fff = algeria mil(ap)
        || this.icao.match(/^0a4/)

        //33ff00-33ffff = italy mil(iy)
        || this.icao.match(/^33ff/)

        //340000-37ffff = spain mil(sp)
        || this.icao.match(/^34/)

        //3a8000-3affff = france mil_1(fs)
        || this.icao.match(/^3(8|9|[a-f])/)
        //3b0000-3bffff = france mil_2(fs)
        || this.icao.match(/^3b/)

        //3e8000-3ebfff = germany mil_1(df)
        || this.icao.match(/^3e(8|9|a|b)/)
        //3f4000-3f7fff = germany mil_2(df)
        //3f8000-3fbfff = germany mil_3(df)
        || this.icao.match(/^3f([4-9]|[a-b])/)

        //400000-40003f = united kingdom mil_1(ra)
        || this.icao.match(/^4000[0-3]/)
        //43c000-43ffff = united kingdom mil(ra)
        || this.icao.match(/^43[c-f]/)

        //444000-447fff = austria mil(aq)
        || this.icao.match(/^44[4-7]/)

        //44f000-44ffff = belgium mil(bc)
        || this.icao.match(/^44f/)

        //457000-457fff = bulgaria mil(bu)
        || this.icao.match(/^457/)

        //45f400-45f4ff = denmark mil(dg)
        || this.icao.match(/^45f4/)

        //468000-4683ff = greece mil(gc)
        || this.icao.match(/^468[0-3]/)

        //473c00-473c0f = hungary mil(hm)
        || this.icao.match(/^473c0/)

        //478100-4781ff = norway mil(nn)
        || this.icao.match(/^4781/)
        //480000-480fff = netherlands mil(nm)
        || this.icao.match(/^480/)
        //48d800-48d87f = poland mil(po)
        || this.icao.match(/^48d8[0-7]/)
        //497c00-497cff = portugal mil(pu)
        || this.icao.match(/^497c/)
        //498420-49842f = czech republic mil(ct)
        || this.icao.match(/^49842/)

        //4b7000-4b7fff = switzerland mil(su)
        || this.icao.match(/^4b7/)
        //4b8200-4b82ff = turkey mil(tq)
        || this.icao.match(/^4b82/)

        //506f00-506fff = slovenia mil(sj)
        || this.icao.match(/^506f/)

        //70c070-70c07f = oman mil(on)
        || this.icao.match(/^70c07/)

        //710258-71025f = saudi arabia mil_1(sx)
        //710260-71027f = saudi arabia mil_2(sx)
        //710280-71028f = saudi arabia mil_3(sx)
        //710380-71039f = saudi arabia mil_4(sx)
        || this.icao.match(/^7102[5-8]/)
        || this.icao.match(/^7103[8-9]/)

        //738a00-738aff = israel mil(iz)
        || this.icao.match(/^738a/)

        //7c822e-7c822f = australia mil_1(av)
        //7c8230-7c823f = australia mil_2(av)
        //7c8240-7c827f = australia mil_3(av)
        //7c8280-7c82ff = australia mil_4(av)
        //7c8300-7c83ff = australia mil_5(av)
        //7c8400-7c87ff = australia mil_6(av)
        //7c8800-7c8fff = australia mil_7(av)
        || this.icao.match(/^7c8([2-4]|8)/)
        //7c9000-7c9fff = australia mil_8(av)
        || this.icao.match(/^7c9/)
        //7ca000-7cbfff = australia mil_9(av)
        //7cc000-7cffff = australia mil_10(av)
        || this.icao.match(/^7c[a-c]/)
        //7d0000-7dffff = australia mil_11(av)
        //7e0000-7fffff = australia mil_12(av)
        || this.icao.match(/^7[d-f]/)

        //800200-8002ff = india mil(im)
        || this.icao.match(/^8002/)

        //c20000-c3ffff = canada mil(cb)
        || this.icao.match(/^c[2-3]/)

        //e40000-e41fff = brazil mil(bq)
        || this.icao.match(/^e4[0-1]/)

        //e80600-e806ff = chile mil(cq)
        || this.icao.match(/^e806/)



    );
}
