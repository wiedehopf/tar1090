"use strict";

function PlaneObject(icao) {

    Planes[icao] = this;
    PlanesOrdered.push(this);

    // Info about the plane
    this.icao      = icao;
    this.icaorange = findICAORange(icao);
    this.flight    = null;
    this.name = '_' + this.icao.toUpperCase();
    this.squawk    = null;
    this.selected  = false;
    this.category  = null;
    this.dataSource = "modeS";

    this.numHex = parseInt(icao.replace('~', '1'), 16);

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
    this.rotationCache = 999;

    this.nac_p			= null;
    this.nac_v			= null;
    this.nic_baro		= null;
    this.sil_type		= null;
    this.sil			= null;

    this.baro_rate      = null;
    this.geom_rate      = null;
    this.vert_rate      = null;


    this.wd = null;
    this.ws = null;
    this.oat = null;
    this.tat = null;

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
    this.seen = NaN;
    this.seen_pos = null;

    // Display info
    this.visible = false;
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
    this.typeLong = null;
    this.wtc = null;


    this.regLoaded = false;
    // request metadata
    this.checkForDB();

    // military icao ranges
    if (this.milRange()) {
        this.military = true;
    }
}
PlaneObject.prototype.checkLayers = function() {
    if (!this.trail_features)
        this.createFeatures();
    if ((showTrace || trackLabels) && !this.trail_labels)
        this.createLabels();
};

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
};

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
};

PlaneObject.prototype.logSel = function(loggable) {
    if (debugTracks && this.selected && !SelectedAllPlanes && !globeIndex)
        console.log(loggable);
    return;
};

PlaneObject.prototype.isFiltered = function() {
    if (this.selected && !SelectedAllPlanes)
        return false;

    if (noRegOnly && (this.registration || this.icao.startsWith('~')))
        return true;

    if (onlySelected && !this.selected) {
        return true;
    }

    if (onlyMilitary && !this.military) {
        return true;
    }

    if (onlyDataSource && this.dataSource != onlyDataSource) {
        return true;
    }

    if (filterTISB && this.dataSource == "tisb") {
        return true;
    }

    if (!filterTracks && altFiltered(this.altitude))
        return true;

    if (PlaneFilter.sources && PlaneFilter.sources.length > 0 && !PlaneFilter.sources.includes(this.dataSource)) {
        return true;
    }

    let flags = PlaneFilter.flagFilter;
    if (flags && flags.length > 0) {
        let found = false;
        for (let i in flags) {
            if (this[flags[i]]) {
                found = true;
            }
        }
        if (!found) {
            return true;
        }
    }

    if (PlaneFilter.icao && !this.icao.match(PlaneFilter.icao) ) {
        return true;
    }

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
    if (PlaneFilter.groundVehicles == 'filtered') {
        if (typeof this.category === 'string' && this.category.startsWith('C'))
            return true;
        if (this.altitude == 'ground' && (this.addrtype == 'adsb_icao_nt' || this.addrtype == 'tisb_other'))
            return true;
    }

    // filter out blocked MLAT flights
    if (PlaneFilter.blockedMLAT == 'filtered') {
        if (typeof this.icao === 'string' && this.icao.startsWith('~'))
            return true;
    }

    if (this.sitedist && this.sitedist > filterMaxRange)
        return true;

    return false;
};


function altFiltered(altitude) {
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
};

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
};

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

    if (this.position[0] > 180 || this.position[0] < -180 || this.position[1] > 90 || this.position[1] < -90) {
        console.log("Ignoring Impossible Position for " + this.icao + ": " + this.position);
        return false;
    }

    if (this.position && SitePosition) {
        if (pTracks && this.sitedist)
            this.sitedist = Math.max(ol.sphere.getDistance(SitePosition, this.position), this.sitedist);
        else
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

    let lastseg = this.track_linesegs[this.track_linesegs.length - 1];

    if (!this.prev_position) {
        return this.updateTail();
    }

    let projPrev = ol.proj.fromLonLat(this.prev_position);

    if (!this.tail_position) {
        lastseg.fixed.appendCoordinate(projPrev);
        return this.updateTail();
    }

    let distance = ol.sphere.getDistance(this.position, this.prev_position);
    let elapsed = this.position_time - this.prev_time;

    let derivedMach = 0.01;
    let filterSpeed = 10000;

    const pFilter = !serverTrack && (positionFilter == true || (positionFilter == 'onlyMLAT' && this.dataSource == "mlat"));

    if (pFilter) {
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
        lastseg.fixed.appendCoordinate(projPrev);

        this.cross180(on_ground, is_leg);

        this.history_size += 258;

        return this.updateTail();
    }


    // Determine if track data are intermittent/stale
    // Time difference between two position updates should not be much
    // greater than the difference between data inputs
    let time_difference = (this.position_time - this.prev_time) - 2;
    if (!loadFinished || serverTrack)
        time_difference = (this.position_time - this.prev_time) - (now - last);

    //let stale_timeout = lastseg.estimated ? 5 : 10;
    let stale_timeout = 15;

    // MLAT data are given some more leeway
    if (this.dataSource == "mlat")
        stale_timeout = 15;

    // On the ground you can't go that quick
    if (on_ground)
        stale_timeout = 30;

    if (pTracks) {
        stale = false;
        stale_timeout = 60;
        if (this.dataSource == "adsc")
            stale_timeout = jaeroTimeout;
    }
    if (replay)
        stale_timeout = replay.ival / 1000 + 5;

    // Also check if the position was already stale when it was exported by dump1090
    // Makes stale check more accurate for example for 30s spaced history points

    let estimated = (time_difference > stale_timeout) || ((now - this.position_time) > stale_timeout) || stale;

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
        || (!pTracks && this.prev_time > lastseg.ts + 15)
        || estimated != lastseg.estimated
        || estimated
        || tempTrails
        || debugAll
        || serverTrack
        || !globeIndex && (
            track_change > 5
            || Math.abs(this.prev_speed - lastseg.speed) > 10
            || Math.abs(this.prev_alt - lastseg.alt_real) > 200
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

        this.logSel("sec_elapsed: " + since_update.toFixed(1) + " alt_change: "+ alt_change.toFixed(0) + " derived_speed(kts/Mach): " + (distance_traveled/since_update*1.94384).toFixed(0) + " / " + (distance_traveled/since_update/343).toFixed(1) + " dist:" + distance_traveled.toFixed(0));

        let points = [projPrev];

        if (since_update > 3600 && distance_traveled / since_update * 3.6 < 100) {
            // don't draw a line if a long time has elapsed but no great distance was traveled
        } else {
            lastseg.fixed.appendCoordinate(projPrev);
        }

        // draw great circle path for long distances
        if (distance > 30000
            && !(elapsed > 3600 && distance / elapsed * 3.6 < 100)
            // don't draw a line if a long time has elapsed but no great distance was traveled
        ) {
            if (!pTracks) {
                estimated = true;
            }
            let nPoints = distance / 19000;
            let greyskull = Math.ceil(Math.log(nPoints) / Math.log(2));
            //console.log(Math.round(nPoints) + ' ' + greyskull);
            points = makeCircle([this.prev_position, this.position], greyskull);
            for (let i in points)
                points[i] = ol.proj.fromLonLat(points[i]);
        }

        this.track_linesegs.push({ fixed: new ol.geom.LineString(points),
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
    if (pTracks) turn_density = 3;
    if (
        since_update > 86 + !!pTracks * 90 ||
        (!on_ground && since_update > (100/turn_density)/track_change) ||
        (!on_ground && isNaN(track_change) && since_update > 8 + !!pTracks * 22) ||
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
    this.linesDrawn = false;
    if (this.layer && this.layer.getVisible()) {
        this.layer.setVisible(false);
    }
    if (this.layer_labels && this.layer_labels.getVisible())
        this.layer_labels.setVisible(false);
};

PlaneObject.prototype.getDataSourceNumber = function() {
    // MLAT
    if (this.dataSource == "modeS")
        return 5;
    if (this.dataSource == "adsc")
        return 6;
    if (this.dataSource == "mlat") {
        return 3;
    }
    if (this.dataSource == "uat" || (this.addrtype && this.addrtype.substring(0,4) == "adsr"))
        return 2; // UAT

    // Not MLAT, but position reported - ADSB or letiants
    if (this.dataSource == "tisb")
        return 4; // TIS-B
    if (this.dataSource == "adsb")
        return 1;

    // Otherwise Mode S
    return 7;

    // TODO: add support for Mode A/C
};

PlaneObject.prototype.getDataSource = function() {
    // MLAT
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
    return 'modeS';

    // TODO: add support for Mode A/C
};

PlaneObject.prototype.getMarkerColor = function(options) {
    options |= {}
    if (monochromeMarkers) {
        return hexToHSL(monochromeMarkers);
    }

    let alt = options.noRound ? this.altitude : this.alt_rounded;
    if (this.category == 'C3' || this.icaoType == 'TWR' || (this.icaoType == null && this.squawk == 7777))
        alt = 'ground';

    let h, s, l;

    let colorArr = altitudeColor(alt);

    h = colorArr[0];
    s = colorArr[1];
    l = colorArr[2];

    // If we have not seen a recent position update, change color
    if ((this.dataSource == 'adsc' && this.seen_pos > 20 * 60)
        || (!globeIndex && this.dataSource != 'adsc' && this.seen_pos > 15))  {
        h += ColorByAlt.stale.h;
        s += ColorByAlt.stale.s;
        l += ColorByAlt.stale.l;
    }
    if (alt == "ground") {
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

    if (s < 0) s = 0;
    else if (s > 95) s = 95;

    if (l < 0) l = 0;
    else if (l > 95) l = 95;

    return [h, s, l];
};

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
    if (toggles['darkerColors'].state) {
        l *= 0.8;
        s *= 0.7;
    }

    if (h < 0) {
        h = (h % 360) + 360;
    } else if (h >= 360) {
        h = h % 360;
    }

    if (s < 0) s = 0;
    else if (s > 95) s = 95;

    if (l < 0) l = 0;
    else if (l > 95) l = 95;

    return [h, s, l];
}

PlaneObject.prototype.setMarkerRgb = function() {
    let hsl = this.getMarkerColor({noRound: true});
    let rgb = hslToRgb(hsl, 'array');
    if (this.shape && this.shape.svg)
        rgb = [255, 255, 255];
    this.glMarker.set('r', rgb[0]);
    this.glMarker.set('g', rgb[1]);
    this.glMarker.set('b', rgb[2]);
};

PlaneObject.prototype.updateIcon = function() {

    let fillColor = hslToRgb(this.getMarkerColor());
    let svgKey  = fillColor + '!' + this.shape.name + '!' + this.strokeWidth;
    let labelText = null;

    if ( enableLabels && (!multiSelect || (multiSelect && this.selected)) &&
        (
            (ZoomLvl >= labelZoom && this.altitude != "ground")
            || (ZoomLvl >= labelZoomGround-2 && this.speed > 5 && this.icao[0] != '~')
            || ZoomLvl >= labelZoomGround
            || (this.selected && !SelectedAllPlanes)
        )
    ) {
        const unknown = NBSP+NBSP+"?"+NBSP+NBSP;
        if (extendedLabels == 2) {
            labelText = NBSP + (this.icaoType ? this.icaoType : unknown) + NBSP + "\n" + NBSP + (this.registration ? this.registration : unknown)+ NBSP + "\n" + NBSP + this.name + NBSP;
        } else if (extendedLabels == 1 ) {
            const altitude = (this.altitude == null) ? unknown : this.altitude;
            if ((!this.onGround || (this.speed && this.speed > 18) || (this.selected && !SelectedAllPlanes))) {
                let speedString = (this.speed == null) ? (NBSP+'?'+NBSP) : Number(this.speed).toFixed(0).toString().padStart(4, NBSP);
                labelText =  speedString + NBSP + NBSP
                    + altitude.toString().padStart(5, NBSP) + NBSP + "\n" + NBSP + this.name + NBSP;
            } else {
                labelText =  NBSP + this.name + NBSP;
            }
        } else {
            labelText = NBSP + this.name + NBSP;
        }
    }
    if (!webgl && (this.markerStyle == null || this.markerIcon == null || (this.markerSvgKey != svgKey))) {
        //console.log(this.icao + " new icon and style " + this.markerSvgKey + " -> " + svgKey);

        if (iconCache[svgKey] == undefined) {
            let svgURI = svgShapeToURI(this.shape, fillColor, OutlineADSBColor, this.strokeWidth);

            addToIconCache.push([svgKey, null, svgURI]);

            if (TrackedAircraftPositions < 200) {
                this.markerIcon = new ol.style.Icon({
                    scale: this.scale,
                    imgSize: [this.shape.w, this.shape.h],
                    src: svgURI,
                    rotation: (this.shape.noRotate ? 0 : this.rotation * Math.PI / 180.0),
                    rotateWithView: (this.shape.noRotate ? false : true),
                });
                this.scaleCache = this.scale;
            } else {
                svgKey = this.markerSvgKey;
            }
        } else {
            this.markerIcon = new ol.style.Icon({
                scale: this.scale,
                imgSize: [this.shape.w, this.shape.h],
                img: iconCache[svgKey],
                rotation: (this.shape.noRotate ? 0 : this.rotation * Math.PI / 180.0),
                rotateWithView: (this.shape.noRotate ? false : true),
            });
            this.scaleCache = this.scale;
        }
        this.markerSvgKey = svgKey;

        //iconCache[svgKey] = undefined; // disable caching for testing
    }
    if (!this.markerIcon && !webgl)
        return;

    let styleKey = (webgl ? '' : svgKey) + '!' + labelText + '!' + this.scale;

    if (this.styleKey != styleKey) {
        this.styleKey = styleKey;
        let style;
        if (labelText) {
            style = {
                image: this.markerIcon,
                text: new ol.style.Text({
                    text: labelText,
                    fill: labelFill,
                    backgroundFill: bgFill,
                    stroke: labelStrokeNarrow,
                    textAlign: 'left',
                    textBaseline: "top",
                    font: labelFont,
                    offsetX: (this.shape.w *0.5*0.74*this.scale),
                    offsetY: (this.shape.w *0.5*0.74*this.scale),
                }),
                zIndex: this.zIndex,
            };
        } else {
            style = {
                image: this.markerIcon,
                zIndex: this.zIndex,
            };
        }
        if (webgl)
            delete style.image;
        this.markerStyle = new ol.style.Style(style);
        this.marker.setStyle(this.markerStyle);
    }
    if (webgl)
        return;

    /*
    if (this.opacityCache != opacity) {
        this.opacityCache = opacity;
        this.markerIcon.setOpacity(opacity);
    }
    */
    const iconRotation = this.shape.noRotate ? 0 : this.rotation;
    if (this.rotationCache != iconRotation && Math.abs(this.rotationCache - iconRotation) > 0.35) {
        this.rotationCache = iconRotation;
        this.markerIcon.setRotation(iconRotation * Math.PI / 180.0);
    }

    if (this.scaleCache != this.scale) {
        this.scaleCache = this.scale;
        this.markerIcon.setScale(this.scale);
    }

    return;
};

PlaneObject.prototype.processTrace = function() {
    this.dataChanged();

    if (showTrace)
        this.setNull();

    let legStart = traceOpts.legStart;
    let legEnd = traceOpts.legEnd;
    this.checkLayers();
    let trace = null;
    let timeZero, _now, _last = 0;
    this.history_size = 0;
    let points_in_trace = 0;
    let pointsRecent = 0;

    let tempPlane = {};
    const oldSegs = this.track_linesegs;
    if (!traceOpts.showTime) {
        this.track_linesegs = [];
        this.remakeTrail();
    }

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

    if (this.fullTrace && this.fullTrace.trace
        && this.recentTrace && this.recentTrace.trace) {
        let t1 = this.fullTrace.trace;
        let t2 = this.recentTrace.trace;
        let end1 = this.fullTrace.timestamp + t1[t1.length-1][0];
        let start2 = this.recentTrace.timestamp;
        if (end1 < start2)
            console.log("Insufficient recent trace overlap!");
    }

    let stop = 0;
    for (let j = 0; j < 2 && !stop; j++) {
        let start;
        let end;
        if (j == 0) {
            if (!this.fullTrace || !this.fullTrace.trace)
                continue;
            if (onlyRecent)
                continue;
            timeZero = this.fullTrace.timestamp;

            _last = timeZero - 1;

            trace = this.fullTrace.trace;

            start = 0;
            end = trace.length;
            if (legStart != null)
                start = legStart;
            if (legEnd != null)
                end = legEnd;
        } else {
            if (legEnd != null)
                continue;
            if (!this.recentTrace || !this.recentTrace.trace)
                continue;
            timeZero = this.recentTrace.timestamp;
            if (!trace) {
                _last = timeZero - 1;
            }
            trace = this.recentTrace.trace;
            start = 0;
            end = trace.length;
        }

        if (lastLeg && !showTrace) {
            for (let i = trace.length - 1; i >= 0; i--) {
                if (trace[i][6] & 2) {
                    start = i;
                    break;
                }
            }
        }

        for (let i = start; i < end; i++) {
            const state = trace[i];
            const timestamp = timeZero + state[0];
            let stale = state[6] & 1;
            const leg_marker = state[6] & 2;

            _now = timestamp;
            if (_now <= _last)
                continue;

            if (i == start) {
                //console.log(timestamp);
                //console.log(traceOpts.startStamp);
            }
            if (traceOpts.showTime && timestamp > traceOpts.showTime) {
                traceOpts.showTimeEnd = timestamp;
                if (traceOpts.replaySpeed > 0) {
                    clearTimeout(traceOpts.showTimeout);
                    traceOpts.animateRealtime = (timestamp - traceOpts.showTime) * 1000;
                    traceOpts.animateTime = traceOpts.animateRealtime / traceOpts.replaySpeed;
                    let fps = webgl ? 28 : 1;
                    traceOpts.animateSteps = Math.round(traceOpts.animateTime / (1000 / fps));
                    traceOpts.animateCounter = traceOpts.animateSteps; // will count down

                    traceOpts.animateStepTime = traceOpts.animateRealtime / traceOpts.replaySpeed / traceOpts.animateSteps;

                    if (traceOpts.animateSteps < 2) {
                        traceOpts.showTimeout = setTimeout(gotoTime, traceOpts.animateTime);
                        traceOpts.animate = false;
                    } else {
                        //console.timeEnd('step');
                        //console.time('step');
                        //console.log(traceOpts.animateTime);
                        traceOpts.animate = true;

                        traceOpts.animateFromLon = this.position[0];
                        traceOpts.animateFromLat = this.position[1];
                        traceOpts.animateToLon = state[2];
                        traceOpts.animateToLat = state[1];

                        traceOpts.animatePos = [traceOpts.animateFromLon, traceOpts.animateFromLat];

                        //console.log('from: ', fromProj);
                        //console.log('to:   ', toProj);

                        traceOpts.showTimeout = setTimeout(gotoTime, traceOpts.animateStepTime);
                    }
                }
                stop = 1;
                break;
            }

            if (traceOpts.startStamp != null && timestamp < traceOpts.startStamp)
                continue;
            if (traceOpts.endStamp != null && timestamp > traceOpts.endStamp)
                break;

            if (now - timestamp < 3 * 60 * 60) {
                pointsRecent++;
            }

            points_in_trace++;

            this.updateTraceData(state, _now);

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

            if (!traceOpts.showTime) {
                this.updateTrack(_now, _last, true, stale);
            }
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

    if (tempPlane.position_time >= this.position_time && !showTrace) {
        //console.log('reusing current aircraft data after processing trace.');
        let newSegs = this.track_linesegs;
        let newSize = this.history_size;
        Object.assign(this, tempPlane);
        this.track_linesegs = newSegs;
        this.history_size = newSize;
    }

    if (showTrace && !traceOpts.showTime) {

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

    if (showTrace) {
        if (this.position_time) {
            const date = new Date(this.position_time * 1000);
            let timestamp =
                date.getUTCHours().toString().padStart(2,'0')
                + ":" + date.getUTCMinutes().toString().padStart(2,'0')
                + ":" + date.getUTCSeconds().toString().padStart(2,'0')
                + NBSP + "Z";
            $('#trace_time').text('UTC:\n' + timestamp);
        } else {
            $('#trace_time').text('UTC:\n');
        }
        this.seen = 0;
        this.seen_pos = 0;
    }

    this.visible = true;

    if (traceOpts.follow)
        toggleFollow(true);
    if (traceOpts.showTime) {
        this.updateMarker(true);
    } else {
        this.updateFeatures(true);
    }

    let mapSize = OLMap.getSize();
    let size = [Math.max(5, mapSize[0] - 280), mapSize[1]];
    if (!traceOpts.showTime && (showTrace || showTraceExit)
        && this.position
        && !noPan
        && !inView(this.position, myExtent(OLMap.getView().calculateExtent(size)))
        && !inView(firstPos, myExtent(OLMap.getView().calculateExtent(size))))
    {
        OLMap.getView().setCenter(ol.proj.fromLonLat(this.position));
    }

    noPan = false;
    showTraceExit = false;

    this.checkForDB(this.recentTrace || this.fullTrace);
    refreshSelected();

    TAR.planeMan.refresh();
    updateAddressBar();

    if (debugTracks) {
        console.log('3h: ' + pointsRecent.toString().padStart(4, ' ') + ' total: ' + points_in_trace);
    }
};

PlaneObject.prototype.updatePositionData = function(now, last, data, init) {
    let newPos = this.updateTrack(now, last);

    this.drawLine |= newPos;

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

    this.dataChanged();
}
// Update our data
PlaneObject.prototype.updateData = function(now, last, data, init) {
    // get location data first, return early if only those are needed.

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
    let seen_pos = isArray? data[6] : data.seen_pos;
    seen = (seen == null) ? 5 : seen;
    seen_pos = (seen_pos == null && lat) ? 5 : seen_pos;
    let type = isArray? data[7] : data.type;
    if (!isArray && data.mlat != null && data.mlat.indexOf("lat") >= 0) type = 'mlat';
    const mlat = (type == 'mlat');
    const tisb = (type && type.substring(0,4) == "tisb");
    const flight = isArray? data[8] : data.flight;

    this.last_message_time = now - seen;

    // remember last known position even if stale
    // do not show or process mlat positions when filtered out.
    if (lat != null && lon != null && !(noMLAT && mlat)) {
        this.position   = [lon, lat];
        this.position_time = now - seen_pos;
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

    this.updateAlt();

    if (this.altitude == null) {
        this.onGround = null;
        this.zIndex = 10;
    } else if (this.altitude == "ground") {
        this.onGround = true;
        this.zIndex = 5;
    } else {
        this.onGround = false;
        this.zIndex = this.altitude + 10000;
    }
    if (this.category == 'C3' || this.icaoType == 'TWR') {
        this.zIndex = 1;
    }
    if (this.icao[0] == '~')
        this.zIndex -= 100000;

    // needed for track labels
    if (pTracks) {
        this.speed = Math.max(this.speed, gs);
    } else {
        this.speed = gs;
    }

    if (gs != null)
        this.gs = gs;
    else if (data.speed != null)
        this.gs = data.speed;
    else if (!pTracks)
        this.gs = null;

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
        this.flight = flight;
    }
    if (this.flight && this.flight.trim()) {
        this.name = this.flight.trim();
    } else if (this.registration) {
        this.name = '_' + this.registration;
    } else {
        this.name = '_' + this.icao.toUpperCase();
    }

    if (mlat && noMLAT) {
        this.dataSource = "modeS";
    } else if (mlat) {
        this.dataSource = "mlat";
    } else if (!displayUATasADSB && this.uat && !tisb) {
        this.dataSource = "uat";
    } else if (tisb) {
        this.dataSource = "tisb";
    } else if (type && type.substring(0,4) == "adsr") {
        this.dataSource = "adsr";
    } else if ((lat != null && type == null) || (type && (type.substring(0,4) == "adsb" || type.substring(0,4) == "adsr"))) {
        this.dataSource = "adsb";
    }

    if (type == 'adsc') {
        this.dataSource = "adsc";
    } else if (type == 'unknown' || type == 'other') {
        this.dataSource = "unknown";
    }

    if (isArray) {
        this.messages = data[9];
        this.updatePositionData(now, last, data, init);
        return;
    }

    // Update all of our data

    if (data.messages < this.messages && binCraft) this.messages -= 65536;
    const elapsed = now - this.last;
    if (elapsed > 0) {
        let messageRate = 0;
        if (!this.uat) {
            messageRate = (data.messages - this.msgs1090)/(now - this.last);
            this.msgs1090 = data.messages;
        } else {
            messageRate = (data.messages - this.msgs978)/(uat_now - uat_last);
            this.msgs978 = data.messages;
        }
        if (elapsed > 60) messageRate = 0;
        this.messageRate = (messageRate + this.messageRateOld)/2;
        this.messageRateOld = messageRate;
    }
    this.messages = data.messages;

    this.rssi = data.rssi;

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
    if (!replay || data.squawk != null)
        this.squawk = data.squawk;
    this.wd = data.wd;
    this.ws = data.ws;
    this.oat = data.oat;
    this.tat = data.tat;
    this.receiverCount = data.receiverCount;

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

    if (type != null)
        this.addrtype = type;
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

    this.checkForDB(data);
    this.last = now;
    this.updatePositionData(now, last, data, init);
    return;
};

PlaneObject.prototype.updateTick = function(redraw) {
    this.visible = this.checkVisible() && !this.isFiltered();
    this.updateFeatures(redraw);
};

PlaneObject.prototype.updateFeatures = function(redraw) {

    if (this.visible) {
        if (this.drawLine || redraw || this.lastVisible != this.visible)
            this.updateLines();

        this.updateMarker(redraw);
    }
    if (!this.visible && this.lastVisible) {
        this.clearMarker();
        this.clearLines();
        deselect(this);
    }

    this.lastVisible = this.visible;
};

PlaneObject.prototype.clearMarker = function() {
    this.markerDrawn = false;
    if (this.marker && this.marker.visible) {
        PlaneIconFeatures.removeFeature(this.marker);
        this.marker.visible = false;
    }
    if (this.glMarker && this.glMarker.visible) {
        webglFeatures.removeFeature(this.glMarker);
        this.glMarker.visible = false;
    }
};

// Update our marker on the map
PlaneObject.prototype.updateMarker = function(moved) {
    if (!this.visible || this.position == null || (pTracks && (SelectedAllPlanes || !this.selected))) {
        if (this.markerDrawn)
            this.clearMarker();
        return;
    }
    this.markerDrawn = true;

    this.setProjection();

    let eastbound = this.rotation < 180;
    let icaoType = this.icaoType;
    if (icaoType == 'V22' && this.speed > 120)
        icaoType = 'V22F';
    if (icaoType == null && this.squawk == 7777)
        icaoType = 'TWR';
    let baseMarkerKey = (this.category ? this.category : "A0") + "_"
        + this.typeDescription + "_" + this.wtc  + "_" + icaoType + '_' + (this.altitude == "ground") + eastbound;

    if (!this.shape || this.baseMarkerKey != baseMarkerKey) {
        this.baseMarkerKey = baseMarkerKey;
        let baseMarker = getBaseMarker(this.category, icaoType, this.typeDescription, this.wtc, this.addrtype, this.altitude, eastbound);
        this.shape = shapes[baseMarker[0]]
        this.baseScale = baseMarker[1] * 0.96;
        if (!this.shape)
            console.log(baseMarkerKey);
    }
    this.scale = scaleFactor * this.baseScale;
    this.strokeWidth = outlineWidth * ((this.selected && !SelectedAllPlanes && !onlySelected) ? 1.15 : 0.7) / this.baseScale;

    if (!this.marker && (!webgl || enableLabels)) {
        this.marker = new ol.Feature(this.olPoint);
        this.marker.hex = this.icao;
    }
    if (webgl && !enableLabels && this.marker) {
        if (this.marker.visible) {
            PlaneIconFeatures.removeFeature(this.marker);
            this.marker.visible = false;
        }
    }

    if (webgl) {
        if (!this.glMarker) {
            this.glMarker = new ol.Feature(this.olPoint);
            this.glMarker.hex = this.icao;
        }

        this.setMarkerRgb();
        const iconRotation = this.shape.noRotate ? 0 : this.rotation;
        this.glMarker.set('rotation', iconRotation * Math.PI / 180.0 + mapOrientation);
        this.glMarker.set('size', this.scale * Math.max(this.shape.w, this.shape.h));
        this.glMarker.set('cx', getSpriteX(this.shape) / glImapWidth);
        this.glMarker.set('cy', getSpriteY(this.shape) / glImapHeight);
        this.glMarker.set('dx', (getSpriteX(this.shape) + 1) / glImapWidth);
        this.glMarker.set('dy', (getSpriteY(this.shape) + 1) / glImapHeight);
    }

    if (this.marker && (!webgl || enableLabels)) {
        this.updateIcon();
        if (!this.marker.visible) {
            this.marker.visible = true;
            PlaneIconFeatures.addFeature(this.marker);
        }
    }
    if (webgl && this.glMarker && !this.glMarker.visible) {
        this.glMarker.visible = true;
        webglFeatures.addFeature(this.glMarker);
    }
    if (!webgl && this.glMarker && this.glMarker.visible) {
        webglFeatures.removeFeature(this.glMarker);
        this.glMarker.visible = false;
    }
};


// return the styling of the lines based on altitude
function altitudeLines (segment) {
    let colorArr = altitudeColor(segment.altitude);
    if (segment.estimated)
        colorArr = [colorArr[0], colorArr[1], colorArr[2] * 0.8];
    //let color = 'hsl(' + colorArr[0].toFixed(0) + ', ' + colorArr[1].toFixed(0) + '%, ' + colorArr[2].toFixed(0) + '%)';

    let color = hslToRgb(colorArr);

    if (monochromeTracks)
        color = monochromeTracks;

    const lineKey = color + '_' + debugTracks + '_' + noVanish + '_' + segment.estimated + '_' + newWidth;

    if (lineStyleCache[lineKey])
        return lineStyleCache[lineKey];

    let multiplier = segment.estimated ? 0.6 : 1;

    if (noVanish)
        multiplier *= (segment.estimated ? 0.3 : 0.6);

    let join = 'round';
    let cap = 'square';
    if (!debugTracks) {
        if (segment.estimated && !noVanish) {
            lineStyleCache[lineKey]	= [
                new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'black',
                        width: 2 * newWidth * 0.3,
                        lineJoin: join,
                        lineCap: cap,
                    })
                }),
                new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: 2 * newWidth,
                        lineDash: [10, 20 + 3 * newWidth],
                        lineDashOffset: 5,
                        lineJoin: join,
                        lineCap: cap,
                    }),
                })
            ];
        } else if (segment.estimated && pTracks) {
            lineStyleCache[lineKey]	= new ol.style.Style({});
        } else {
            lineStyleCache[lineKey]	= new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: color,
                    width: 2 * newWidth * multiplier,
                    lineJoin: join,
                    lineCap: cap,
                })
            });
        }
    } else {
        if (segment.noLabel || segment.estimated) {
            lineStyleCache[lineKey] = [
                new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: 2 * newWidth * multiplier,
                        lineJoin: join,
                        lineCap: cap,
                    })
                }),
            ];
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
                        lineJoin: join,
                        lineCap: cap,
                    })
                })
            ];
        }
    }
    return lineStyleCache[lineKey];
}

// Update our planes tail line,
PlaneObject.prototype.updateLines = function() {
    this.drawLine = false;
    if (!this.visible || this.position == null || (!this.selected && !SelectedAllPlanes)) {
        if (this.linesDrawn) this.clearLines();
        return;
    }

    this.linesDrawn = true;

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
    if (this.elastic_feature) {
        this.trail_features.removeFeature(this.elastic_feature);
        this.elastic_feature = null;
    }

    // create any missing fixed line features

    for (let i = this.track_linesegs.length-1; i >= 0; i--) {
        let seg = this.track_linesegs[i];
        if (seg.feature && (!trackLabels || seg.label))
            break;

        if ((filterTracks && altFiltered(seg.altitude)) || altitudeLines(seg) == nullStyle) {
            seg.feature = true;
        } else if (!seg.feature) {
            seg.feature = new ol.Feature(seg.fixed);
            seg.feature.setStyle(altitudeLines(seg));
            seg.feature.hex = this.icao;
            seg.feature.timestamp = seg.ts;
            trail_add.push(seg.feature);
        }

        if (seg.label) {
            // nothing to do, label already present
        } else if ((filterTracks && altFiltered(seg.altitude)) || seg.noLabel) {
            seg.label = true;
        } else if (
            trackLabels ||
            ((i == 0 || i == this.track_linesegs.length-1 ||seg.leg) && showTrace && enableLabels)
        ) {
            const alt_real = (seg.alt_real != null) ? seg.alt_real : 'n/a';
            const speed = (seg.speed != null) ? seg.speed.toFixed(0).toString() : 'n/a';
            seg.label = new ol.Feature(new ol.geom.Point(seg.fixed.getFirstCoordinate()));
            let timestamp;
            const date = new Date(seg.ts * 1000);
            if (showTrace) {
                timestamp =
                    date.getUTCHours().toString().padStart(2,'0')
                    + ":" + date.getUTCMinutes().toString().padStart(2,'0')
                    + ":" + date.getUTCSeconds().toString().padStart(2,'0');
                timestamp = "".padStart(0, NBSP) + timestamp + NBSP + "Z";
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
                speed.padStart(3, NBSP) + "  "
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
                zIndex += 123499;
            }
            if (seg.leg == 'end') {
                fill = new ol.style.Fill({color: '#8888CC' });
                zIndex += 123455;
            }
            const otherDiag = seg.track != null && ((seg.track > 270 && seg.track < 360) || (seg.track > 90 && seg.track < 180));
            seg.label.setStyle(
                new ol.style.Style({
                    text: new ol.style.Text({
                        text: text,
                        fill: fill,
                        stroke: labelStroke,
                        textAlign: 'left',
                        //backgroundFill: bgFill,
                        textBaseline: otherDiag ? 'bottom' : 'top',
                        font: labelFont,
                        offsetX: (otherDiag ? 4 : 8) * globalScale,
                        offsetY: (otherDiag ? -4 : 8) * globalScale,
                    }),
                    image: new ol.style.Circle({
                        radius: 2 * globalScale,
                        fill: blackFill,
                    }),
                    zIndex: zIndex,
                })
            );
            seg.label.hex = this.icao;
            seg.label.timestamp = seg.ts;
            seg.label.isLabel = true;
            label_add.push(seg.label)
        }
    }

    let lastseg = this.track_linesegs[this.track_linesegs.length - 1];
    let lastfixed = lastseg.fixed.getCoordinateAt(1.0);
    let geom = new ol.geom.LineString([lastfixed, ol.proj.fromLonLat(this.position)]);


    if (!showTrace) {
        this.elastic_feature = new ol.Feature(geom);
        if (filterTracks && altFiltered(lastseg.altitude)) {
            this.elastic_feature.setStyle(nullStyle);
        } else {
            this.elastic_feature.setStyle(altitudeLines(lastseg));
        }
        this.elastic_feature.hex = this.icao;
        trail_add.push(this.elastic_feature);
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

};

PlaneObject.prototype.makeTR = function (trTemplate) {

    this.trCache = [];
    this.bgColorCache = undefined;
    this.tr = trTemplate;

    this.clickListener = function(evt) {
        if (evt.srcElement instanceof HTMLAnchorElement) {
            evt.stopPropagation();
            return;
        }

        if(!mapIsVisible) {
            selectPlaneByHex(this.icao, {follow: true});
        } else {
            selectPlaneByHex(this.icao, {follow: false});
        }
        evt.preventDefault();
    }.bind(this);

    this.tr.addEventListener('click', this.clickListener);

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
};
PlaneObject.prototype.destroyTR = function (trTemplate) {
    if (this.tr == null)
        return;

    this.tr.removeEventListener('click', this.clickListener);
    this.tr.removeEventListener('dblclick', this.dblclickListener);

    if (this.tr.parentNode)
        this.tr.parentNode.removeChild(this.tr);

    this.tr = null;
};

PlaneObject.prototype.destroy = function() {
    this.clearLines();
    this.clearMarker();
    this.visible = false;
    deselect(this);
    this.destroyTR();
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
    for (let key in Object.keys(this)) {
        delete this[key];
    }
};

function calcAltitudeRounded(altitude) {
    if (altitude == null) {
        return null;
    } else if (altitude == "ground") {
        return altitude;
    } else if (altitude > 8000 || heatmap) {
        return (altitude/500).toFixed(0)*500;
    } else {
        return (altitude/125).toFixed(0)*125;
    }
};

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
};

function hexToHSL(hex) {
    let r = +('0x'+ hex[1] + hex[2]) / 255;
    let g = +('0x'+ hex[3] + hex[4]) / 255;
    let b = +('0x'+ hex[5] + hex[6]) / 255;
    let cmin = Math.min(r,g,b);
    let cmax = Math.max(r,g,b);
    let delta = cmax - cmin;
    let h = 0, s = 0, l = 0;
    if (delta == 0)
        h = 0;
    else if (cmax == r)
        h = ((g - b) / delta) % 6;
    else if (cmax == g)
        h = (b - r) / delta + 2;
    else
        h = (r - g) / delta + 4;

    h = Math.round(h * 60);

    if (h < 0)
        h += 360;

    l = (cmax + cmin) / 2;
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    s *= 100;
    l *= 100;

    return [h, s, l];
};

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
function hslToRgb(arr, opacity){
    let h = arr[0];
    let s = arr[1];
    let l = arr[2];
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

    if (opacity == 'array')
        return [ Math.round(r * 255), Math.round(g * 255), Math.round(b * 255) ];

    if (opacity != null)
        return 'rgba(' + Math.round(r * 255) + ', ' + Math.round(g * 255) + ', ' +  Math.round(b * 255) + ', ' + opacity + ')';
    else
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
};

PlaneObject.prototype.getAircraftData = function() {
    let req = dbLoad(this.icao);

    req.done(function(data) {
        this.regLoaded = true;
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
            this.setTypeData();
        }

        if (data[3]) {
            this.typeLong = data[3];
        }

        if (data[2]) {
            this.military = (data[2][0] == '1');
            this.interesting = (data[2][1] == '1');
            this.pia = (data[2][2] == '1');
            this.ladd = (data[2][3] == '1');
            if (this.pia)
                this.registration = null;
        }

        this.dataChanged();

        data = null;
    }.bind(this));

    req.fail(function(jqXHR,textStatus,errorThrown) {
        if (textStatus == 'timeout')
            this.getAircraftData();
        else
            console.log(this.icao + ': Database load error: ' + textStatus + ' at URL: ' + jqXHR.url);
    }.bind(this));
};

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
};


PlaneObject.prototype.milRange = function() {
    if (this.icao[0] == '~')
        return false;
    let i = parseInt(this.icao, 16);
    return (
        false
        // us military
        //adf7c8-adf7cf = united states mil_5(uf)
        //adf7d0-adf7df = united states mil_4(uf)
        //adf7e0-adf7ff = united states mil_3(uf)
        //adf800-adffff = united states mil_2(uf)
        //ae0000-afffff = united states mil_1(uf)
        || (i >= 0xadf7c8 && i <= 0xafffff)

        //010070-01008f = egypt_mil
        || (i >= 0x010070 && i <= 0x01008f)

        //0a4000-0a4fff = algeria mil(ap)
        || (i >= 0x0a4000 && i <= 0x0a4fff)

        //33ff00-33ffff = italy mil(iy)
        || (i >= 0x33ff00 && i <= 0x33ffff)

        //350000-37ffff = spain mil(sp)
        || (i >= 0x350000 && i <= 0x37ffff)

        //3a8000-3affff = france mil_1(fs)
        || (i >= 0x3a8000 && i <= 0x3affff)
        //3b0000-3bffff = france mil_2(fs)
        || (i >= 0x3b0000 && i <= 0x3bffff)

        //3ea000-3ebfff = germany mil_1(df)
        || (i >= 0x3ea000 && i <= 0x3ebfff)
        //3f4000-3f7fff = germany mil_2(df)
        //3f8000-3fbfff = germany mil_3(df)
        || (i >= 0x3f4000 && i <= 0x3fbfff)

        //400000-40003f = united kingdom mil_1(ra)
        || (i >= 0x400000 && i <= 0x40003f)
        //43c000-43cfff = united kingdom mil(ra)
        || (i >= 0x43c000 && i <= 0x43cfff)

        //444000-446fff = austria mil(aq)
        || (i >= 0x444000 && i <= 0x446fff)

        //44f000-44ffff = belgium mil(bc)
        || (i >= 0x44f000 && i <= 0x44ffff)

        //457000-457fff = bulgaria mil(bu)
        || (i >= 0x457000 && i <= 0x457fff)

        //45f400-45f4ff = denmark mil(dg)
        || (i >= 0x45f400 && i <= 0x45f4ff)

        //468000-4683ff = greece mil(gc)
        || (i >= 0x468000 && i <= 0x4683ff)

        //473c00-473c0f = hungary mil(hm)
        || (i >= 0x473c00 && i <= 0x473c0f)

        //478100-4781ff = norway mil(nn)
        || (i >= 0x478100 && i <= 0x4781ff)
        //480000-480fff = netherlands mil(nm)
        || (i >= 0x480000 && i <= 0x480fff)
        //48d800-48d87f = poland mil(po)
        || (i >= 0x48d800 && i <= 0x48d87f)
        //497c00-497cff = portugal mil(pu)
        || (i >= 0x497c00 && i <= 0x497cff)
        //498420-49842f = czech republic mil(ct)
        || (i >= 0x498420 && i <= 0x49842f)

        //4b7000-4b7fff = switzerland mil(su)
        || (i >= 0x4b7000 && i <= 0x4b7fff)
        //4b8200-4b82ff = turkey mil(tq)
        || (i >= 0x4b8200 && i <= 0x4b82ff)

        //506f00-506fff = slovenia mil(sj)
        || (i >= 0x506f00 && i <= 0x506fff)

        //70c070-70c07f = oman mil(on)
        || (i >= 0x70c070 && i <= 0x70c07f)

        //710258-71025f = saudi arabia mil_1(sx)
        //710260-71027f = saudi arabia mil_2(sx)
        //710280-71028f = saudi arabia mil_3(sx)
        || (i >= 0x710258 && i <= 0x71028f)
        //710380-71039f = saudi arabia mil_4(sx)
        || (i >= 0x710380 && i <= 0x71039f)

        //738a00-738aff = israel mil(iz)
        || (i >= 0x738a00 && i <= 0x738aff)

        //7c822e-7c84ff = australia mil_1(av)
        || (i >= 0x7c822e && i <= 0x7c84ff)
        //7c8800-7c8fff = australia mil_7(av)
        || (i >= 0x7c8800 && i <= 0x7c88ff)
        //7c9000-7c9fff = australia mil_8(av)
        //7ca000-7cbfff = australia mil_9(av)
        || (i >= 0x7c9000 && i <= 0x7cbfff)
        //7d0000-7dffff = australia mil_11(av)
        //7e0000-7fffff = australia mil_12(av)
        || (i >= 0x7d0000 && i <= 0x7fffff)

        //800200-8002ff = india mil(im)
        || (i >= 0x800200 && i <= 0x8002ff)

        //c20000-c3ffff = canada mil(cb)
        || (i >= 0xc20000 && i <= 0xc3ffff)

        //e40000-e41fff = brazil mil(bq)
        || (i >= 0xe40000 && i <= 0xe41fff)

        //e80600-e806ff = chile mil(cq)
        //|| (i >= 0xe80600 && i <= 0xe806ff)
        // disabled due to civilian aircraft in hex range
    );
};

PlaneObject.prototype.updateTraceData = function(state, _now) {
    const lat = state[1];
    const lon = state[2];
    const altitude = state[3];
    const gs = state[4];
    const track = state[5];
    const rate_geom = state[6] & 4;
    const alt_geom = state[6] & 8;
    const rate = state[7];
    const data = state[8];


    this.position = [lon, lat];
    this.position_time = _now;
    this.last_message_time = Math.max(_now, this.last_message_time);
    this.altitude = altitude;

    this.updateAlt();

    if (alt_geom) {
        this.alt_geom = altitude;
        //this.alt_baro = null;
    } else {
        this.alt_baro = altitude;
        //this.alt_geom = null;
    }
    this.speed = gs;
    this.gs = gs;

    if (altitude == 'ground') {
        this.true_heading = track;
        this.track = null;
    } else {
        this.track = track;
        //this.true_heading = null;
    }

    if (track)
        this.rotation = track;

    this.vert_rate = rate;
    if (rate_geom) {
        this.geom_rate = rate;
        this.baro_rate = null;
    } else {
        this.baro_rate = rate;
        this.geom_rate = null;
    }

    if (data != null) {
        if (data.type.substring(0,4) == "adsb") {
            this.dataSource = "adsb";
        } else if (data.type.substring(0,4) == "adsr") {
            this.dataSource = "adsr";
        } else if (data.type == "mlat") {
            this.dataSource = "mlat";
        } else if (data.type == "adsb_icao_nt") {
            this.dataSource = "modeS";
        } else if (data.type.substring(0,4) == "tisb") {
            this.dataSource = "tisb";
        } else if (data.type == 'adsc') {
            this.dataSource = "adsc";
        } else if (data.type == 'unknown') {
            this.dataSource = "unknown";
        }

        if (data.flight != null) {
            this.flight = data.flight;
        }
        if (this.flight && this.flight.trim()) {
            this.name = this.flight.trim();
        } else if (this.registration) {
            this.name = '_' + this.registration;
        } else {
            this.name = '_' + this.icao.toUpperCase();
        }

        this.addrtype = data.type;

        this.alt_geom = data.alt_geom;
        this.ias = data.ias;
        this.tas = data.tas;
        this.track = data.track;
        this.mag_heading = data.mag_heading;
        this.true_heading = data.true_heading;
        this.mach = data.mach;
        this.track_rate = data.track_rate;
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

        this.wd = data.wd;
        this.ws = data.ws;
        this.oat = data.oat;
        this.tat = data.tat;

        // fields with more complex behaviour

        this.version = data.version;
        if (data.category != null) {
            this.category = data.category;
        }

        if (data.nav_altitude_fms != null) {
            this.nav_altitude = data.nav_altitude_fms;
        } else if (data.nav_altitude_mcp != null){
            this.nav_altitude = data.nav_altitude_mcp;
        } else {
            this.nav_altitude = null;
        }
    }
};

PlaneObject.prototype.setNull = function() {
    this.position = null;
    this.callsign = null;
    this.track = null;
    this.rotation = null;
    this.altitude = null;
    this.messages = NaN;
    this.seen = NaN;
    this.last_message_time = NaN;
    this.seen_pos = NaN;
    this.position_time = NaN;

    this.flight    = null;
    this.name = '_' + this.icao.toUpperCase();
    this.squawk    = null;
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

    this.wd = null;
    this.ws = null;
    this.oat = null;
    this.tat = null;

    this.version        = null;

    this.prev_position = null;
    this.prev_time = null;
    this.prev_track = null;
    this.position  = null;
    this.sitedist  = null;
    this.too_fast = 0;

    this.messages  = 0;
    this.rssi      = null;
    this.msgs1090  = 0;
    this.msgs978   = 0;
    this.messageRate = 0;
    this.messageRateOld = 0;
};

function makeCircle(points, greyskull) {
    let out = points;
    //console.log('1: ' + out.map(x => [Math.round(x[0]), Math.round(x[1])]));
    for (let k = 0; k < greyskull; k++) {
        out = [points[0]];
        for (let j = 1; j < points.length; j++) {
            let i = j - 1;
            out.push(midpoint(points[i], points[j]));
            out.push(points[j]);
            //console.log('added 2: ' + out.map(x => [Math.round(x[0]), Math.round(x[1])]));
        }
        points = out;
    }

    return out;
}

// adapted from https://github.com/seangrogan/great_circle_calculator
function midpoint(from, to) {
    let lon1 = from[0] * (Math.PI/180);
    let lat1 = from[1] * (Math.PI/180);
    let lon2 = to[0] * (Math.PI/180);
    let lat2 = to[1] * (Math.PI/180);

    let b_x = Math.cos(lat2) * Math.cos(lon2 - lon1);
    let b_y = Math.cos(lat2) * Math.sin(lon2 - lon1);
    let lat3 = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + b_x) * (Math.cos(lat1) + b_x) + b_y * b_y));
    let lon3 = lon1 + Math.atan2(b_y, Math.cos(lat1) + b_x);
    lat3 /= (Math.PI/180);
    lon3 /= (Math.PI/180);
    lon3 = (lon3 + 540) % 360 - 180;
    return [lon3, lat3];
}

PlaneObject.prototype.cross180 = function(on_ground, is_leg) {
    let sign1 = Math.sign(this.prev_position[0]);
    let sign2 = Math.sign(this.position[0]);

    let out = makeCircle([this.prev_position, this.position], 8);

    //console.log([...out]);

    let seg1 = [];
    let seg2 = [];

    let tmp;

    while ((tmp = out.shift()) != null) {
        if (sign1 == Math.sign(tmp[0]))
            seg1.push(tmp);
        else
            seg2.push(tmp);
    }
    //console.log([...seg1]);
    //console.log([...seg2]);
    let before = seg1[seg1.length - 1];
    let after = seg2[0];
    // weight according to the opposite distance, well longitude difference
    // not perfect, good enough
    let afterWeight = Math.abs(sign1 * 180 - before[0]);
    let beforeWeight = Math.abs(sign2 * 180 - after[0]);
    let midLat = (beforeWeight * before[1] + afterWeight * after[1]) / (beforeWeight + afterWeight);

    let midPoint1 = [sign1 * 180, midLat];
    let midPoint2 = [sign2 * 180, midLat];

    seg1.push(midPoint1);
    seg2.unshift(midPoint2);

    for (let i in seg1)
        seg1[i] = ol.proj.fromLonLat(seg1[i]);
    for (let i in seg2)
        seg2[i] = ol.proj.fromLonLat(seg2[i]);

    seg1.unshift(seg1[0]);

    this.track_linesegs.push({ fixed: new ol.geom.LineString([seg1.shift()]),
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

    this.track_linesegs.push({ fixed: new ol.geom.LineString(seg1),
        feature: null,
        estimated: true,
        altitude: this.prev_alt_rounded,
        alt_real: this.prev_alt,
        speed: this.prev_speed,
        ground: on_ground,
        track: this.prev_rot,
        ts: NaN,
        noLabel: true,
    });

    this.track_linesegs.push({ fixed: new ol.geom.LineString(seg2),
        feature: null,
        estimated: true,
        altitude: this.prev_alt_rounded,
        alt_real: this.prev_alt,
        speed: this.prev_speed,
        ground: on_ground,
        track: this.prev_rot,
        ts: NaN,
        noLabel: true,
    });
};

PlaneObject.prototype.dataChanged = function() {
    this.refreshTR = true;
    if (tabHidden)
        return;

    if (this.selected) {
        this.checkVisible();
        refreshSelected();
    }

    if (this == HighlightedPlane) {
        this.checkVisible();
        refreshHighlighted();
    }
}

PlaneObject.prototype.isNonIcao = function() {
    if (this.icao[0] == '~')
        return true;
    else
        return false;
};

PlaneObject.prototype.checkVisible = function() {
    const zoomedOut = 2 * refreshInt() / globeSimLoad * globeTilesViewCount / 1000;
    const jaeroTime = (this.dataSource == "adsc") ? jaeroTimeout : 0;
    const mlatTime = (this.dataSource == "mlat") ? 25 : 0;
    const tisbReduction = (this.icao[0] == '~') ? 15 : 0;
    // If no packet in over 58 seconds, clear the plane.
    // Only clear the plane if it's not selected individually

    // recompute seen and seen_pos
    let __now = now;
    if (this.dataSource == "uat")
        __now = uat_now;
    this.seen = Math.max(0, __now - this.last_message_time);
    this.seen_pos = Math.max(0, __now - this.position_time);

    return (
        (!globeIndex && this.seen < (58 - tisbReduction + jaeroTime))
        || (globeIndex && this.seen_pos < (40 + zoomedOut + jaeroTime + mlatTime - tisbReduction))
        || this.selected
        || noVanish
    );
};

PlaneObject.prototype.setTypeData = function() {
	if (_aircraft_type_cache == null || !this.icaoType || this.icaoType == this.icaoTypeCache)
        return;
    this.updateMarker();
    this.icaoTypeCache = this.icaoType;

    let typeDesignator = this.icaoType.toUpperCase();
    if (!(typeDesignator in _aircraft_type_cache))
        return;

    let typeData = _aircraft_type_cache[typeDesignator];
    if (typeData.desc != null && typeData.desc.length == 3)
        this.typeDescription = typeData.desc;
    if (typeData.wtc != null)
        this.wtc = typeData.wtc;
};

PlaneObject.prototype.checkForDB = function(t) {
    if (!this.regLoaded && (!dbServer || showTrace || (!globeIndex && this.selected) || replay)) {
        this.getAircraftData();
        return;
    }
    if (!t) {
        return;
    }

    if (t.desc) this.typeLong = t.desc;
    if (t.r) this.registration = t.r;

    if (t.ownOp) this.ownOp = t.ownOp;
    if (t.year) this.year = t.year;

    if (t.t) {
        this.icaoType = t.t;
        this.setTypeData();
    }
    if (t.dbFlags) {
        this.military = t.dbFlags & 1;
        this.interesting = t.dbFlags & 2;
        this.pia = t.dbFlags & 4;
        this.ladd = t.dbFlags & 8;
        if (this.pia)
            this.registration = null;
    }
    this.regLoaded = true;
    this.dataChanged();
};
PlaneObject.prototype.updateAlt = function(t) {
    this.alt_rounded = calcAltitudeRounded(this.altitude);
    if (this.altitude == 'ground')
        this.altSort = -100001;
    else if (this.altitude)
        this.altSort = this.altitude;
    else
        this.altSort = -100000;
}
PlaneObject.prototype.setProjection = function(arg) {
    let pos = traceOpts.animate ? traceOpts.animatePos : this.position;

    let lon = pos[0];
    let lat = pos[1];
    let moved = false;

    //let trace = new Error().stack.toString();
    //console.log(lat + ' ' + trace);

    // manual wrap around
    if (webgl && Math.abs(CenterLon - lon) > 180) {
        if (CenterLon < 0)
            lon -= 360;
        else
            lon += 360;
    }
    //console.log([lat, lon]);

    let proj = ol.proj.fromLonLat([lon, lat]);

    if (this.selected && (arg == 'follow' || checkFollow())) {
        OLMap.getView().setCenter(proj);
    }

    if (this.proj) {
        moved |= (this.proj[0] != proj[0] || this.proj[1] != proj[1]);
    } else {
        moved = true;
    }
    this.proj = proj;

    if (!this.olPoint) {
        this.olPoint = new ol.geom.Point(proj);
    } else if (moved) {
        this.olPoint.setCoordinates(proj);
    }
}

