// Some global variables are defined in early.js
// early.js takes care of getting some history files while the html page and
// some javascript libraries are still loading, hopefully speeding up loading

"use strict";

// Define our global variables
let tabHidden = false;
let webgl = false;
let webglFeatures = new ol.source.Vector();
let webglLayer;
let OLMap = null;
let OLProj = null;
let PlaneIconFeatures = new ol.source.Vector();
let trailGroup = new ol.Collection();
let siteCircleLayer;
let siteCircleFeatures = new ol.source.Vector();
let locationDotLayer;
let locationDotFeatures = new ol.source.Vector();
let iconLayer;
let trailLayers;
let heatFeatures = [];
let heatFeaturesSpread = 1024;
let heatLayers = [];
let realHeatFeatures = new ol.source.Vector();
let realHeat;
let iconCache = {};
let addToIconCache = [];
let lineStyleCache = {};
let Planes        = {};
let PlanesOrdered = [];
let PlaneFilter   = {};
let SelectedPlane = null;
let sp = null;
let SelPlanes = [];
let SelectedAllPlanes = false;
let HighlightedPlane = null;
let FollowSelected = false;
let followPos = [];
let loadFinished = false;
let loadStart = new Date().getTime();
let mapResizeTimeout;
let pointerMoveTimeout;
let iconSize = 1;
let debugTracks = false;
let debugAll = false;
let trackLabels = false;
let grouptype_checkbox;
let multiSelect = false;
let uat_data = null;
let enableLabels = false;
let extendedLabels = 0;
let mapIsVisible = true;
let tableInView = false;
let onlyMilitary = false;
let onlySelected = false;
let onlyDataSource = null;
let debug = false;
let debugJump = false;
let jumpTo = null;
let noMLAT = false;
let noVanish = false;
let filterTracks = false; // altitude filter: don't filter planes but rather their tracks by altitude
let refreshId = 0;
let lastFetch = 0;
let globeIndexNow = {};
let globeIndexDist = {};
let globeIndexSpecialLookup = {};
let globeTilesViewCount = 0;
let globeTableLimitBase = 80;
let globeTableLimit = 80;
let fetchCounter = 0;
let lastGlobeExtent;
let pendingFetches = 0;
let firstFetch = true;
let debugCounter = 0;
let pathName = window.location.pathname.replace(/\/+/, '/') || "/";
let icaoFilter = null;
let sourcesFilter = null;
let sources = ['adsb', ['uat', 'adsr'], 'mlat', 'tisb', 'modeS', 'other', 'adsc'];
let flagFilter = null;
let flagFilterValues = ['military', 'pia', 'ladd'];
let showTrace = false;
let showTraceExit = false;
let showTraceWasIsolation = false;
let showTraceTimestamp = null;
let traceDate = null;
let traceDateString = null;
let traceOpts = {};
let icaoParam = null;
let globalScale = 1;
let userScale = 1;
let iconScale = 1;
let labelScale = 1;
let newWidth = lineWidth;
let SiteOverride = false;
let onJumpInput = null;
let labelFill = null;
let blackFill = null;
let labelStroke = null;
let labelStrokeNarrow = null;
let bgFill = null;
let legSel = -1;
let geoMag = null;
let solidT = false;
let lastActive = new Date().getTime();
let overrideMapType = null;
let enableOverlays = [];
let halloween = false;
let noRegOnly = false;
let triggerRefresh = 0;
let firstDraw = true;
let darkerColors = false;
let updateLocation = false;
let autoselect = false;
let nogpsOnly = false;
let trace_hist_only = false;
let traces_high_res = false;
let show_rId = true;

let infoBlockWidth = baseInfoBlockWidth;

const renderBuffer = 45;

let shareLink = '';

let onMobile = false;

let CenterLat = 0;
let CenterLon = 0;
let ZoomLvl = 5;
let ZoomLvlCache;

let TrackedAircraft = 0;
let globeTrackedAircraft = 0;
let TrackedAircraftPositions = 0;
let TrackedHistorySize = 0;

let SitePosition = null;

// timestamps
let now = 0;
let last = 0;
let uat_now = 0;
let uat_last = 0;
let FetchPending = [];
let FetchPendingUAT = null;

let MessageCountHistory = [];
let MessageRate = 0;

let layers;
let layers_group;

const nullStyle = new ol.style.Style({});

let estimateStyle;
let estimateStyleSlim;
let badLine;
let badLineMlat;
let badDot;
let badDotMlat;

let showingReplayBar = false;

// TAR1090 application object
let TAR;
TAR = (function (global, jQuery, TAR) {
    return TAR;
}(window, jQuery, TAR || {}));


function processAircraft(ac, init, uat) {
    let isArray = Array.isArray(ac);
    let hex = isArray ? ac[0] : ac.hex;

    // Do we already have this plane object in Planes?
    // If not make it.

    /*
        if ( ac.messages < 2) {
            return;
        }
        */
    if (icaoFilter && !icaoFilter.includes(hex))
        return;

    if (uatNoTISB && uat && ac.type && ac.type.substring(0,4) == "tisb") {
        // drop non ADS-B planes from UAT (TIS-B)
        return;
    }

    let plane = Planes[hex]

    if (!plane) {
        plane = new PlaneObject(hex);
        if (uat)
            plane.uat = true;
    }


    if (showTrace)
        return;

    // Call the function update
    if (globeIndex) {
        if (!onlyMilitary || plane.military || (ac.dbFlags && ac.dbFlags & 1)) {
            plane.updateData(now, last, ac, init);
        } else {
            plane.last_message_time = now - ac.seen;
        }
        return;
    }
    // don't use data if the position is more than 1 second older than the position we have
    if (ac.seen_pos != null && plane.position_time > now - ac.seen_pos + 1)
        return;
    if (!uat) {
        if (!plane.uat
            || (ac.seen_pos < 2 && plane.seen_pos > 4)
            || (plane.seen > 10 && ac.seen < 0.8 * plane.seen) || isNaN(plane.seen)
            || init) {
            plane.uat = false;
            plane.updateData(now, last, ac, init);
        }
    } else {
        if (plane.uat
            || (ac.seen_pos < 2 && (plane.seen_pos > 4 || plane.dataSource == "mlat"))
            || (plane.seen > 10 && ac.seen < 0.8 * plane.seen) || isNaN(plane.seen)
            || init) {
            let tisb = Array.isArray(ac) ? (ac[7] == "tisb") : (ac.tisb != null && ac.tisb.indexOf("lat") >= 0);
            if (tisb && plane.dataSource == "adsb") {
                // ignore TIS-B data for current ADS-B 1090 planes
            } else {
                plane.uat = true;
                plane.updateData(uat_now, uat_last, ac, init);
            }
        }
    }
}

let backwardsCounter = 0;
function processReceiverUpdate(data, init) {
    // update now and last
    let uat = data.uat_978;
    if (uat) {
        if (data.now <= uat_now)
            return;
        uat_last = uat_now;
        uat_now = data.now;
    } else {
        if (data.now <= now && !globeIndex && !uuid) {
            if (data.now < now) {
                console.log('timestep backwards, ignoring data:' + now + ' -> ' + data.now);
                if (backwardsCounter++ > 5) {
                    backwardsCounter = 0;
                    console.log('resetting now:' + now + ' -> ' + data.now);
                    now = data.now;
                    last = now - 1;
                }
            }
            return;
        }
        if (data.now > now) {
            backwardsCounter = 0;
            last = now;
            now = data.now;
        }
    }

    if (globeIndex) {
        if ((showGrid || loStore['globeGrid'] == 'true')
            && globeIndexNow[data.globeIndex] == null)
            drawTileBorder(data);
        globeTrackedAircraft = data.global_ac_count_withpos;
        globeIndexNow[data.globeIndex] = data.now;
    }

    if (!uat && !init && !globeIndex)
        updateMessageRate(data);

    // Loop through all the planes in the data packet
    for (let j=0; j < data.aircraft.length; j++)
        processAircraft(data.aircraft[j], init, uat);
}

let debugFetch = false;
let C429 = 0;
function fetchData(options) {
    options = options || {};
    if (heatmap || replay || showTrace || pTracks || !loadFinished)
        return;
    let currentTime = new Date().getTime();

    if (!options.force && (currentTime - lastFetch < refreshInt() || pendingFetches > 0)) {
        return;
    }
    if (debugFetch)
        console.log((currentTime - lastFetch)/1000);
    lastFetch = currentTime;

    FetchPending = [];
    if (FetchPendingUAT != null) {
        // don't double up on fetches, let the last one resolve
        return;
    }

    //console.timeEnd("Starting Fetch");
    //console.time("Starting Fetch");

    if (enable_uat) {
        FetchPendingUAT = jQuery.ajax({ url: 'chunks/978.json',
            dataType: 'json' });

        FetchPendingUAT.done(function(data) {
            uat_data = data;
            FetchPendingUAT = null;
        });
        FetchPendingUAT.fail(function(jqxhr, status, error) {
            FetchPendingUAT = null;
        });
    }

    let ac_url = [];
    if (uuid != null) {
        for (let i in uuid) {
            ac_url.push('uuid/?feed=' + uuid[i]);
        }
    } else if (globeIndex) {
        let indexes = globeIndexes();
        const ancient = (currentTime - 2 * refreshInt() / globeSimLoad * globeTilesViewCount) / 1000;
        for (let i in indexes) {
            const k = indexes[i];
            if (globeIndexNow[k] < ancient) {
                globeIndexNow[k] = null;
            }
        }
        indexes.sort(function(x,y) {
            if (!globeIndexNow[x] && !globeIndexNow[y]) {
                return globeIndexDist[x] - globeIndexDist[y];
            }
            if (globeIndexNow[x] == null)
                return -1;
            if (globeIndexNow[y] == null)
                return 1;
            return (globeIndexNow[x] - globeIndexNow[y]);
        });

        if (binCraft && onlyMilitary && ZoomLvl < 5.5) {
            ac_url.push('data/globeMil_42777.binCraft');
        } else {

            indexes = indexes.slice(0, globeSimLoad);

            let suffix = binCraft ? '.binCraft' : '.json'
            let mid = (binCraft && onlyMilitary) ? 'Mil_' : '_';
            for (let i in indexes) {
                ac_url.push('data/globe' + mid + indexes[i].toString().padStart(4, '0') + suffix);
            }
        }
    } else if (binCraft) {
        ac_url.push('data/aircraft.binCraft');
    } else {
        ac_url.push('data/aircraft.json');
    }

    pendingFetches += ac_url.length;
    fetchCounter += ac_url.length;

    for (let i in ac_url) {
        //console.log(ac_url[i]);
        let req;
        if (binCraft) {
            req = jQuery.ajax({
                url: `${ac_url[i]}`, method: 'GET',
                xhr: arraybufferRequest,
                timeout: 15000,
                urlIndex: i,
            });
        } else {
            req = jQuery.ajax({ url: `${ac_url[i]}`, dataType: 'json', urlIndex: i });
        }
        FetchPending.push(req);

        req
            .done(function(data) {
                pendingFetches--;
                if (data == null) {
                    return;
                }
                if (binCraft) {
                    data = { buffer: data, };
                    wqi(data);
                }
                data.urlIndex = this.urlIndex;

                if (!data.aircraft || !data.now) {
                    let error = data.error;
                    if (error) {
                        jQuery("#update_error_detail").text(error);
                        jQuery("#update_error").css('display','block');
                        StaleReceiverCount++;
                    }
                    return;
                }

                //console.time("Process " + data.globeIndex);
                processReceiverUpdate(data);
                //console.timeEnd("Process " + data.globeIndex);
                data = null;

                if (uat_data) {
                    processReceiverUpdate(uat_data);
                    uat_data = null;
                }

                if (pendingFetches <= 0 && !tabHidden) {
                    triggerRefresh++;
                    checkMovement();
                    if (firstFetch) {
                        firstFetch = false;
                        if (uuid) {
                            const ext = myExtent(OLMap.getView().calculateExtent(OLMap.getSize()));
                            let jump = true;
                            for (let i = 0; i < PlanesOrdered.length; ++i) {
                                const plane = PlanesOrdered[i];
                                if (plane.visible && inView(plane.position, ext)) {
                                    jump = false;
                                    break;
                                }
                            }
                            if (jump) {
                                followRandomPlane();
                                deselectAllPlanes();
                                OLMap.getView().setZoom(6);
                            }
                        }
                        checkRefresh();
                    }
                }


                // Check for stale receiver data
                if (last == now && !globeIndex) {
                    StaleReceiverCount++;
                    if (StaleReceiverCount > 5) {
                        jQuery("#update_error_detail").text("The data from the server hasn't been updated in a while.");
                        jQuery("#update_error").css('display','block');
                    }
                } else if (StaleReceiverCount > 0){
                    StaleReceiverCount = 0;
                    jQuery("#update_error").css('display','none');
                }
            })
            .fail(function(jqxhr, status, error) {
                pendingFetches--;
                if (pendingFetches <= 0 && !tabHidden) {
                    triggerRefresh++;
                    checkMovement();
                }
                status = jqxhr.status;
                if (jqxhr.readyState == 0) error = "Can't connect to server, check your network!";
                let errText = status + (error ? (": " + error) : "");
                console.log(jqxhr);
                console.log(error);
                if (status != 429 && status != '429') {
                    jQuery("#update_error_detail").text(errText);
                    jQuery("#update_error").css('display','block');
                    StaleReceiverCount++;
                } else {
                    if (C429++ > 16) {
                        globeRateUpdate();
                        C429 = 0;
                    }
                }
            });
    }
}

// this function is called from index.html on body load
// kicks off the whole rabbit hole
function initialize() {
    if (usp.has('iconTest')) {
        iconTest();
        return;
    }

    jQuery.when(configureReceiver, heatmapDefer).done(function() {

        if (receiverJson) {
            if (receiverJson.trace_hist_only)
                trace_hist_only = true;
            if (receiverJson.json_trace_interval < 2)
                traces_high_res = true;
            if (receiverJson.lat != null) {
                SiteLat = receiverJson.lat;
                SiteLon = receiverJson.lon;
                DefaultCenterLat = receiverJson.lat;
                DefaultCenterLon = receiverJson.lon;
            }
            if (receiverJson.jaeroTimeout) {
                jaeroTimeout = receiverJson.jaeroTimeout * 60;
            }


            if (receiverJson.readsb) {
                positionFilter = false;
                altitudeFilter = false;
            }
        }
        configureReceiver = null;

        // Initialize stuff
        initPage();
        initMap();

        // Wait for history item downloads and append them to the buffer
        push_history();

        jQuery.when(historyLoaded).done(function() {
            startPage();
        });
    });
}

function replaySpeedChange(arg) {
    traceOpts.replaySpeed = arg;
    console.log(arg);
    if (traceOpts.animate)
        return;
    legShift(0);
};


function initPage() {
    let value;
    onMobile = window.mobilecheck();

    if (usp.has('nowebgl')) {
        loStore['webgl'] = "false";
    }
    if (usp.has('showGrid')) {
        showGrid = true;
        loStore['layer_site_pos'] = 'true';
    }

    if (usp.has('halloween'))
        halloween = true;

    if (usp.has('onlyDataSource'))
        onlyDataSource = usp.get('onlyDataSource');

    if (usp.has('outlineWidth')) {
        let tmp = parseInt(usp.get('outlineWidth'));
        if (!isNaN(tmp))
            outlineWidth = tmp;
    }

    if (usp.has('kiosk')) {
        tempTrails = true;
        hideButtons = true;
        userScale = 2;
    }

    if (pTracks) {
        noVanish = true;
        buttonActive('#P', noVanish);
        filterTracks = true;
        selectAllPlanes();
    }

    if (usp.has('mobile'))
        onMobile = true;
    if (usp.has('desktop'))
        onMobile = false;

    if (usp.has('hideSidebar'))
        loStore['sidebar_visible'] = "false";
    if (usp.has('sidebarWidth')) {
        loStore['sidebar_width'] = usp.get('sidebarWidth');
        loStore['sidebar_visible'] = "true";
    }

    if (usp.has('SiteLat') && usp.has('SiteLon')) {
        loStore['SiteLat'] = usp.get('SiteLat');
        loStore['SiteLon'] = usp.get('SiteLon');
    }
    if (loStore['SiteLat'] != null && loStore['SiteLon'] != null) {
        if (usp.has('SiteClear')
            || isNaN(parseFloat(loStore['SiteLat']))
            || isNaN(parseFloat(loStore['SiteLat']))) {
            loStore.removeItem('SiteLat');
            loStore.removeItem('SiteLon');
        } else {
            SiteLat = CenterLat = DefaultCenterLat = parseFloat(loStore['SiteLat']);
            SiteLon = CenterLon = DefaultCenterLon = parseFloat(loStore['SiteLon']);
            SiteOverride = true;
        }
    }

    if (usp.has('tempTrails')) {
        tempTrails = true;
        let tmp = parseInt(usp.get('tempTrails'));
        if (tmp > 0)
            tempTrailsTimeout = tmp;
    }
    if (usp.has('squareMania')) {
        squareMania = true;
    }
    if (usp.has('mapDim')) {
        let dim = parseFloat(usp.get('mapDim'));
        if (!isNaN(dim))
            mapDimPercentage = dim;
    } else if (heatmap) {
        mapDimPercentage = 0.6;
        MapDim = true;
    }

    if (usp.has('noRegOnly'))
        noRegOnly = true;

    if (usp.has('nogpsOnly') || usp.has('badgps'))
        nogpsOnly = true;

    if (usp.has('mapContrast')) {
        let contrast = parseFloat(usp.get('mapContrast'));
        if (!isNaN(contrast))
            mapContrastPercentage = contrast;
    }

    if (value = usp.getFloat('labelScale')) {
        labelScale = value;
    }

    if (value = usp.getFloat('largeMode')) {
        userScale = Math.pow(1.2, value) / 1.2;
        iconScale = 1;
    }

    if (value = usp.getFloat('iconScale')) {
        iconScale = value;
    } else if (loStore['iconScale'] != null) {
        iconScale = loStore['iconScale'];
    }

    if (value = usp.getFloat('scale')) {
        userScale = value;
    } else if (loStore['userScale'] != null) {
        userScale = loStore['userScale'];
    }

    const slideBase = 0.6;
    jQuery('#iconScaleSlider').slider({
        value: Math.pow(iconScale, 1 / slideBase),
        step: 0.02,
        min: 0.1,
        max: 3,
        change: function(event, ui) {
            iconScale = Math.pow(ui.value, slideBase);
            checkScale();
            mapRefresh();
            loStore['iconScale'] = iconScale;
        },
    });

    jQuery('#userScaleSlider').slider({
        value: Math.pow(userScale, 1 / slideBase),
        step: 0.02,
        min: 0.5,
        max: 3,
        change: function(event, ui) {
            userScale = Math.pow(ui.value, slideBase);
            checkScale();
            mapRefresh();
            loStore['userScale'] = userScale;

            setGlobalScale(userScale);
        },
    });
    setGlobalScale(userScale, "init");

    if (usp.has('hideButtons'))
        hideButtons = true;

    if (usp.has('baseMap'))
        overrideMapType = usp.get('baseMap');

    if (usp.has('overlays'))
        enableOverlays = usp.get('overlays').split(',');

    if (value = usp.get('icaoFilter')) {
        icaoFilter = value.toLowerCase().split(',');
    }

    if (value = usp.getFloat('filterMaxRange')) {
        filterMaxRange = value;
    }
    filterMaxRange *= 1852; // convert from nmi to meters


    if (value = usp.getFloat('mapOrientation')) {
        mapOrientation = value;
    }
    mapOrientation *= (Math.PI/180); // adjust to radians

    if (usp.has('r') || usp.has('replay')) {
        let numbers = (usp.get('r') || usp.get('replay') || "").split(/(?:-|:)/);
        let ts = new Date();
        if (numbers.length == 5) {
            ts.setUTCFullYear(numbers[0]);
            ts.setUTCMonth(numbers[1] - 1);
            ts.setUTCDate(numbers[2]);
            ts.setUTCHours(numbers[3]);
            ts.setUTCMinutes(numbers[4]);
        }
        if (isNaN(ts)) {
            ts = new Date();
        }
        console.log(ts);
        replay = replayDefaults(ts);
    }

    //Pulling filters from params
    if (usp.has('filterAltMin')) {
        const minAlt = usp.getInt('filterAltMin');
        if (minAlt !== null)  {
            PlaneFilter.minAltitude = minAlt;
            PlaneFilter.enabled = true;
            PlaneFilter.maxAltitude = 1000000;
        }
    }
    if (usp.has('filterAltMax')) {
        const maxAlt = usp.getInt('filterAltMax');
        if (maxAlt !== null)  {
            PlaneFilter.maxAltitude = maxAlt;
            PlaneFilter.enabled = true;
            if (PlaneFilter.minAltitude === undefined) {
                PlaneFilter.minAltitude = -1000000;
            }
        }
    }

    if (usp.has('filterCallSign')) {
        PlaneFilter.callsign = usp.get('filterCallSign');
    }
    if (usp.has('filterType')) {
        PlaneFilter.type = usp.get('filterType');
    }
    if (usp.has('filterDescription')) {
        PlaneFilter.description = usp.get('filterDescription');
    }
    if (usp.has('filterIcao')) {
        PlaneFilter.icao = usp.get('filterIcao');
    }

    if (usp.has('filterSources')) {
        PlaneFilter.sources = usp.get('filterSources').split(',');
    }
    if (usp.has('filterDbFlag')) {
        PlaneFilter.flagFilter = usp.get('filterDbFlag').split(',');
    }


    if (onMobile)
        enableMouseover = false;

    if (false && iOSVersion() <= 12 && !('PointerEvent' in window)) {
        jQuery("#generic_error_detail").text("Enable Settings - Safari - Advanced - Experimental features - Pointer Events");
        jQuery("#generic_error").css('display','block');
        setTimeout(function() {
            jQuery("#generic_error").css('display','none');
        }, 30000);
    }

    if (loStore['enableLabels'] == 'true' || usp.has('enableLabels')) {
        toggleLabels();
    }
    if (usp.has('extendedLabels')) {
        extendedLabels = parseInt(usp.getFloat('extendedLabels'));
        toggleExtendedLabels({ noIncrement: true });
    } else if (loStore['extendedLabels']) {
        extendedLabels = parseInt(loStore['extendedLabels']);
        toggleExtendedLabels({ noIncrement: true });
    }
    if (loStore['trackLabels'] == "true" || usp.has('trackLabels')) {
        toggleTrackLabels();
    }
    if (loStore['tableInView'] == "true") {
        toggleTableInView(true);
    }
    if (loStore['debug'] == "true")
        debug = true;
    if (loStore['debugPosFilter'] == "true")
        debugPosFilter = true;

    if (loStore['noVanish'] == "true" || usp.has('noVanish')) {
        noVanish = true;
        //filterTracks = noVanish;
        //loStore['noVanish'] = "false";
        buttonActive('#P', noVanish);
    }

    jQuery('#tabs').tabs({
        active: loStore['active_tab'],
        activate: function (event, ui) {
            loStore['active_tab'] = jQuery("#tabs").tabs("option", "active");
        },
        collapsible: true
    });

    // Set page basics
    document.title = PageName;

    initializeUnitsSelector();
    TAR.planeMan.init();

    // Set up map/sidebar splitter
    jQuery("#sidebar_container").resizable({
        handles: {
            w: '#splitter'
        },
        minWidth: 150,
        maxWidth: (jQuery(window).innerWidth() *0.8),
    });

    jQuery("#splitter").dblclick(function() {
        jQuery('#legend').hide();
        jQuery('#sidebar_container').width('auto');
        updateMapSize();
        loStore['sidebar_width'] = jQuery('#sidebar_container').width();
        jQuery('#sidebar_container').width(loStore['sidebar_width']);
        jQuery('#legend').show();
    });

    if (loStore['sidebar_width'] != null)
        jQuery('#sidebar_container').width(loStore['sidebar_width']);
    else
        jQuery('#sidebar_container').width('25%');

    if (jQuery('#sidebar_container').width() > jQuery(window).innerWidth() *0.8)
        jQuery('#sidebar_container').width('30%');

    loStore['sidebar_width'] = jQuery('#sidebar_container').width();

    jQuery('#sidebar_container').on('resize', function() {
        loStore['sidebar_width'] = jQuery('#sidebar_container').width();
    });

    // Set up event handlers for buttons
    jQuery("#expand_sidebar_button").click(expandSidebar);
    jQuery("#shrink_sidebar_button").click(showMap);

    // Set up altitude filter button event handlers and validation options
    jQuery("#altitude_filter_form").submit(onFilterByAltitude);
    jQuery("#callsign_filter_form").submit(updateCallsignFilter);
    jQuery("#type_filter_form").submit(updateTypeFilter);
    jQuery("#description_filter_form").submit(updateDescriptionFilter);
    jQuery("#icao_filter_form").submit(updateIcaoFilter);
    jQuery("#source_filter_form").submit(updateSourceFilter);
    jQuery("#flag_filter_form").submit(updateFlagFilter);

    // Initialize other controls
    jQuery("#search_form").submit(onSearch);
    jQuery("#search_clear_button").click(onSearchClear);
    jQuery("#jump_clear_button").click(function() {
        jQuery("#jump_input").val("");
        jQuery("#jump_input").blur();
    });
    jQuery("#jump_form").submit(onJump);

    jQuery("#show_trace").click(toggleShowTrace);
    jQuery("#trace_back_1d").click(function() {shiftTrace(-1)});
    jQuery("#trace_jump_1d").click(function() {shiftTrace(1)});

    jQuery("#histDatePicker").datepicker({
        maxDate: '+1d',
        dateFormat: "yy-mm-dd",
        onSelect: function(date){
            setTraceDate({string: date});
            shiftTrace();
            jQuery("#histDatePicker").blur();
        },
        autoSize: true,
        onClose: !onMobile ? null : function(dateText, inst){
            jQuery("#histDatePicker").attr("disabled", false);
        },
        beforeShow: !onMobile ? null : function(input, inst){
            jQuery("#histDatePicker").attr("disabled", true);
        },
    });

    jQuery("#replayPlay").click(function(){

        if (replay.playing){
            //if playing, pause.
            playReplay(false);

        } else {
            //if paused, play.
            playReplay(true);
        }
    });

    jQuery("#leg_prev").click(function() {legShift(-1)});
    jQuery("#leg_next").click(function() {legShift(1)});

    jQuery("#altitude_filter_reset_button").click(onResetAltitudeFilter);
    jQuery("#callsign_filter_reset_button").click(onResetCallsignFilter);
    jQuery("#type_filter_reset_button").click(onResetTypeFilter);
    jQuery("#description_filter_reset_button").click(onResetDescriptionFilter);
    jQuery("#icao_filter_reset_button").click(onResetIcaoFilter);
    jQuery("#source_filter_reset_button").click(onResetSourceFilter);
    jQuery("#flag_filter_reset_button").click(onResetFlagFilter);

    jQuery('#settingsCog').on('click', function() {
        jQuery('#settings_infoblock').toggle();
    });

    jQuery('#settings_close').on('click', function() {
        jQuery('#settings_infoblock').hide();
    });

    jQuery('#groundvehicle_filter').on('click', function() {
        filterGroundVehicles(true);
        refresh();
    });

    jQuery('#blockedmlat_filter').on('click', function() {
        filterBlockedMLAT(true);
        refresh();
    });

    jQuery('#grouptype_checkbox').on('click', function() {
        if (jQuery('#grouptype_checkbox').hasClass('settingsCheckboxChecked')) {
            TAR.planeMan.cols.distance.sort();
        } else {
            TAR.planeMan.cols.data_source.sort();
        }
    });

    new Toggle({
        key: "lastLeg",
        display: "Last Leg only",
        container: "#settingsLeft",
        init: true,
        setState: function(state) {
            lastLeg = state;
            if (loadFinished && !showTrace) {
                for (let i in SelPlanes) {
                    SelPlanes[i].processTrace();
                }
            }
        }
    });
    new Toggle({
        key: "labelsGeom",
        display: "Labels: geom. alt. (WGS84)",
        container: "#settingsLeft",
        init: labelsGeom,
        setState: function(state) {
            labelsGeom = state;
            if (loadFinished) {
                remakeTrails();
                refreshSelected();
            }
        }
    });
    new Toggle({
        key: "geomUseEGM",
        display: "Geom. alt.: WGS84 -> EGM conversion (long load)",
        container: "#settingsLeft",
        init: geomUseEGM,
        setState: function(state) {
            geomUseEGM = state;
            if (geomUseEGM) {
                let egm = loadEGM();
                if (egm) {
                    egm.addEventListener('load', function() {
                        remakeTrails();
                        refreshSelected();
                    });
                    return;
                }
            }
            if (loadFinished) {
                remakeTrails();
                refreshSelected();
            }
        }
    });

    new Toggle({
        key: "utcTimesLive",
        display: "Live track labels: UTC",
        container: "#settingsLeft",
        init: utcTimesLive,
        setState: function(state) {
            utcTimesLive = state;
            remakeTrails();
            refreshSelected();
        }
    });

    new Toggle({
        key: "utcTimesHistoric",
        display: "Historic track labels: UTC",
        container: "#settingsLeft",
        init: utcTimesHistoric,
        setState: function(state) {
            utcTimesHistoric = state;
            remakeTrails();
            refreshSelected();
        }
    });

    new Toggle({
        key: "windLabelsSlim",
        display: "Smaller wind labels",
        container: "#settingsLeft",
        init: windLabelsSlim,
        setState: function(state) {
            windLabelsSlim = state;
            if (!loadFinished)
                return;
            for (let key in PlanesOrdered) {
                PlanesOrdered[key].updateMarker();
            }
        }
    });

    new Toggle({
        key: "showLabelUnits",
        display: "Label units",
        container: "#settingsLeft",
        init: showLabelUnits,
        setState: function(state) {
            showLabelUnits = state;
            if (!loadFinished)
                return;
            for (let key in PlanesOrdered) {
                PlanesOrdered[key].updateMarker();
            }
            remakeTrails();
            refreshSelected();
        }
    });


    jQuery('#tStop').on('click', function() { traceOpts.replaySpeed = 0; gotoTime(traceOpts.showTime); });
    jQuery('#t1x').on('click', function() { replaySpeedChange(1); });
    jQuery('#t5x').on('click', function() { replaySpeedChange(5); });
    jQuery('#t10x').on('click', function() { replaySpeedChange(10); });
    jQuery('#t20x').on('click', function() { replaySpeedChange(20); });
    jQuery('#t40x').on('click', function() { replaySpeedChange(40); });

    new Toggle({
        key: "shareFilters",
        display: "Include Filters In URLs",
        container: "#settingsRight",
        init: false,
        setState: function(state) {
            updateAddressBar();
        }
    });

    new Toggle({
        key: "debugTracks",
        display: "Debug Tracks",
        container: "#settingsRight",
        init: false,
        setState: function(state) {
            debugTracks = state;
            remakeTrails();
        }
    });

    new Toggle({
        key: "debugAll",
        display: "Debug show all",
        container: "#settingsRight",
        init: false,
        setState: function(state) {
            if (state)
                debugAll = true;
            else
                debugAll = false;
        }
    });

    /*
    new Toggle({
        key: "SiteCircles",
        display: "Distance Circles",
        container: "#settingsRight",
        init: SiteCircles,
        setState: function(state) {
            SiteCircles = state;
            if (loadFinished)
                initSitePos();
        }
    });
    */

    new Toggle({
        key: "updateLocation",
        display: "update GPS location",
        container: "#settingsRight",
        init: updateLocation,
        setState: function(state) {
            updateLocation = state;
            watchPosition();
        }
    });

    new Toggle({
        key: "autoselect",
        display: "auto-select plane",
        container: "#settingsRight",
        init: autoselect,
        setState: function(state) {
            autoselect = state;
            setAutoselect();
        }
    });
    if (usp.has('autoselect')) {
        autoselect = true;
        setAutoselect();
    }

    new Toggle({
        key: "ColoredPlanes",
        display: "Colored Planes",
        container: "#settingsRight",
        init: true,
        setState: function(state) {
            if (state)
                monochromeMarkers = null;
            else
                monochromeMarkers = "#EEEEEE";

            refreshFeatures();
        }
    });

    new Toggle({
        key: "ColoredTrails",
        display: "Colored Trails",
        container: "#settingsRight",
        init: true,
        setState: function(state) {
            if (state)
                monochromeTracks = null;
            else
                monochromeTracks = "#000000";

            remakeTrails();
        }
    });

    if (globeIndex) {
        function setGlobeTableLimit() {
            let mult = 1 + 4 * toggles['moreTableLines1'].state + 16 * (toggles['moreTableLines2'] && toggles['moreTableLines2'].state);
            globeTableLimit = globeTableLimitBase * mult;
            if (toggles['allTableLines'] && toggles['allTableLines'].state)
                globeTableLimit = 1e9;
            if (onMobile)
                globeTableLimit /= 2;
        };
        new Toggle({
            key: "moreTableLines1",
            display: "More Table Lines",
            container: "#sidebar-table",
            init: false,
            setState: setGlobeTableLimit,
        });
        new Toggle({
            key: "moreTableLines2",
            display: "Even More Table Lines",
            container: "#sidebar-table",
            init: false,
            setState: setGlobeTableLimit,
        });
        new Toggle({
            key: "allTableLines",
            display: "All Table Lines",
            container: "#sidebar-table",
            init: false,
            setState: setGlobeTableLimit,
        });
    }

    new Toggle({
        key: "sidebar_visible",
        display: "Sidebar visible",
        container: null,
        checkbox: null,
        button: '#toggle_sidebar_button',
        init: (onMobile ? false : true),
        setState: function (state) {
            if (state) {
                jQuery("#sidebar_container").show();
                jQuery("#expand_sidebar_control").show();
                jQuery("#toggle_sidebar_button").removeClass("show_sidebar");
                jQuery("#toggle_sidebar_button").addClass("hide_sidebar");
            } else {
                jQuery("#sidebar_container").hide();
                jQuery("#expand_sidebar_control").hide();
                jQuery("#toggle_sidebar_button").removeClass("hide_sidebar");
                jQuery("#toggle_sidebar_button").addClass("show_sidebar");
            }
            updateMapSize();
        },
    });

    if (!showPictures) {
        planespottingAPI = false;
        planespottersAPI = false;
    }
    new Toggle({
        key: "planespottingAPI",
        display: "Pictures planespotting.be",
        container: "#settingsRight",
        init: planespottingAPI,
        setState: function(state) {
            planespottingAPI = state;
            if (state) {
                toggles['planespottersAPI'] && toggles['planespottersAPI'].toggle(false);
            }
            setPictureVisibility();
            refreshSelected();
        }
    });
    new Toggle({
        key: "planespottersAPI",
        display: "Pictures planespotters.net",
        container: "#settingsRight",
        init: planespottersAPI,
        setState: function(state) {
            planespottersAPI = state;
            if (state) {
                toggles['planespottingAPI'] && toggles['planespottingAPI'].toggle(false);
            }
            setPictureVisibility();
            refreshSelected();
        }
    });

    new Toggle({
        key: "selectedDetails",
        display: "Enable Infoblock",
        container: "#settingsRight",
        init: true,
        setState: function(state) {
            adjustInfoBlock();
        }
    });

    new Toggle({
        key: "wideInfoblock",
        display: "Wide Infoblock",
        container: "#settingsRight",
        init: wideInfoBlock,
        setState: function(state) {
            wideInfoBlock = state;
            adjustInfoBlock();
        }
    });


    jQuery('#selectall_checkbox').on('click', function() {
        if (jQuery('#selectall_checkbox').hasClass('settingsCheckboxChecked')) {
            deselectAllPlanes();
        } else {
            selectAllPlanes();
        }
    })

    // Force map to redraw if sidebar container is resized - use a timer to debounce
    jQuery("#sidebar_container").on("resize", function() {
        clearTimeout(mapResizeTimeout);
        mapResizeTimeout = setTimeout(updateMapSize, 20);
    });

    filterGroundVehicles(false);
    filterBlockedMLAT(false);

    TAR.altitudeChart.init();

    if (adsbexchange) {
        jQuery('#adsbexchange_header').show();
        jQuery('#credits').show();
        if (!onMobile) {
            jQuery('#creditsSelected').show();
        }
        jQuery('#selected_infoblock').addClass('adsbx-selected-bg');
        if (false && window.self != window.top) {
            window.top.location.href = "https://www.adsbexchange.com/";
            return;
        }
    }
}

function initLegend(colors) {
    let html = '';
    html += '<div class="legendTitle" style="background-color:' + colors['adsb'] + ';">ADS-B</div>';
    if (!globeIndex)
        html += '<div class="legendTitle" style="background-color:' + colors['uat'] + ';">UAT / ADS-R</div>';
    if (globeIndex)
        html += '<div class="legendTitle" style="background-color:' + colors['uat'] + ';">ADS-C/R / UAT</div>';
    html += '<div class="legendTitle" style="background-color:' + colors['mlat'] + ';">MLAT</div>';
    html += '<br>';
    html += '<div class="legendTitle" style="background-color:' + colors['tisb'] + ';">TIS-B</div>';
    if (!globeIndex)
        html += '<div class="legendTitle" style="background-color:' + colors['modeS'] + ';">Mode-S</div>';
    if (globeIndex)
        html += '<div class="legendTitle" style="background-color:' + colors['other'] + ';">Other</div>';

    document.getElementById('legend').innerHTML = html;
}

function initSourceFilter(colors) {
    const createFilter = function (color, text, key) {
        return '<li class="ui-widget-content" style="background-color:' + color + ';" id="source-filter-' + key + '">' + text + '</li>';
    };

    let html = '';
    html += createFilter(colors['adsb'], 'ADS-B', sources[0]);

    html += createFilter(colors['uat'], 'UAT / ADS-R', sources[1][0]);
    html += createFilter(colors['mlat'], 'MLAT', sources[2]);
    html += createFilter(colors['tisb'], 'TIS-B', sources[3]);

    //if (!globeIndex)
    html += createFilter(colors['modeS'], 'Mode-S', sources[4]);
    if (globeIndex)
        html += createFilter(colors['other'], 'Other', sources[5]);

    if (globeIndex)
        html += createFilter(colors['uat'], 'ADS-C', sources[6]);

    document.getElementById('sourceFilter').innerHTML = html;

    jQuery("#sourceFilter").selectable({
        stop: function () {
            sourcesFilter = [];
            jQuery(".ui-selected", this).each(function () {
                const index = jQuery("#sourceFilter li").index(this);
                if (Array.isArray(sources[index]))
                    sources[index].forEach(member => { sourcesFilter.push(member); });
                else
                    sourcesFilter.push(sources[index]);
            });
        }
    });

    jQuery("#sourceFilter").on("selectablestart", function (event, ui) {
        event.originalEvent.ctrlKey = true;
    });
}

function initFlagFilter(colors) {
    const createFilter = function (color, text, key) {
        return '<li class="ui-widget-content" style="background-color:' + color + ';" id="flag-filter-' + key + '">' + text + '</li>';
    };

    let html = '';
    html += createFilter(colors['tisb'], 'Military', flagFilterValues[0]);
    //html += createFilter(colors['mlat'], 'Interesting');
    html += createFilter(colors['uat'], 'PIA', flagFilterValues[1]);
    html += createFilter(colors['adsb'], 'LADD', flagFilterValues[2]);

    document.getElementById('flagFilter').innerHTML = html;

    jQuery("#flagFilter").selectable({
        stop: function () {
            flagFilter = [];
            jQuery(".ui-selected", this).each(function () {
                const index = jQuery("#flagFilter li").index(this);
                if (Array.isArray(flagFilterValues[index]))
                    flagFilterValues[index].forEach(member => { flagFilter.push(member); });
                else
                    flagFilter.push(flagFilterValues[index]);
            });
        }
    });

    jQuery("#flagFilter").on("selectablestart", function (event, ui) {
        event.originalEvent.ctrlKey = true;
    });
}

function initFilters() {
    new Filter({
        key: 'flight',
        name: 'Callsign',
        container: "#filterTable",
    });

    initSourceFilter(tableColors.unselected);
    initFlagFilter(tableColors.unselected);

    if (PlaneFilter) {
        if (PlaneFilter.minAltitude && PlaneFilter.minAltitude > -1000000) {
            jQuery('#altitude_filter_min').val(PlaneFilter.minAltitude);
        }
        if (PlaneFilter.maxAltitude && PlaneFilter.maxAltitude < 1000000) {
            jQuery('#altitude_filter_max').val(PlaneFilter.maxAltitude);
        }

        if (PlaneFilter.callsign) {
            jQuery('#callsign_filter').val(PlaneFilter.callsign);
        }
        if (PlaneFilter.type) {
            jQuery('#type_filter').val(PlaneFilter.type);
        }
        if (PlaneFilter.description) {
            jQuery('#description_filter').val(PlaneFilter.description);
        }
        if (PlaneFilter.icao) {
            jQuery('#icao_filter').val(PlaneFilter.icao);
        }

        if (PlaneFilter.sources) {
            sourcesFilter = PlaneFilter.sources
            sourcesFilter.map((f) => jQuery('#source-filter-' + f).addClass('ui-selected'))
        }

        if (PlaneFilter.flagFilter) {
            flagFilter = PlaneFilter.flagFilter
            flagFilter.map((f) => jQuery('#flag-filter-' + f).addClass('ui-selected'))
        }
    }
}


function push_history() {
    jQuery("#loader_progress").attr('max',nHistoryItems*2);
    for (let i = 0; i < nHistoryItems; i++) {
        push_history_item(i);
    }
    if (globeIndex) {
        parseHistory();
    } else if (!nHistoryItems) {
        parseHistory();
        console.log("History loading failed");
    }
}

function push_history_item(i) {

    jQuery.when(deferHistory[i])
        .done(function(json) {

            if (HistoryChunks) {
                if (json && json.files) {
                    for (let i in json.files) {
                        PositionHistoryBuffer.push(json.files[i]);
                    }
                } else if (json && json.now) {
                    PositionHistoryBuffer.push(json);
                }
            } else {
                PositionHistoryBuffer.push(json);
            }


            jQuery("#loader_progress").attr('value',HistoryItemsReturned);
            HistoryItemsReturned++;
            if (HistoryItemsReturned == nHistoryItems) {
                parseHistory();
            }
        })

        .fail(function(jqxhr, status, error) {

            //Doesn't matter if it failed, we'll just be missing a data point
            jQuery("#loader_progress").attr('value',HistoryItemsReturned);
            //console.log(error);
            HistoryItemsReturned++;
            if (HistoryItemsReturned == nHistoryItems) {
                parseHistory();
            }
        });
}

function parseHistory() {
    if (nHistoryItems) {
        console.timeEnd("Downloaded History");
        console.time("Loaded aircraft tracks from History");
    }

    for (let i in deferHistory)
        deferHistory[i] = null;


    if (PositionHistoryBuffer.length > 0) {

        // Sort history by timestamp
        console.log("Sorting history: " + PositionHistoryBuffer.length);
        PositionHistoryBuffer.sort(function(x,y) { return (y.now - x.now); });

        // Process history
        let data;
        let h = 0;
        let pruneInt = Math.floor(PositionHistoryBuffer.length/5);
        let currentTime = new Date().getTime()/1000;
        while (data = PositionHistoryBuffer.pop()) {

            if (pTracks && currentTime - data.now > pTracks * 3600) {
                continue;
            }

            // process new data
            if (PositionHistoryBuffer.length < 10) {
                processReceiverUpdate(data, false);
            } else {
                processReceiverUpdate(data, true);
            }

            if (h==1) {
                console.log("Applied history " + h + " from: "
                    + (new Date(now * 1000)).toLocaleTimeString());
            }

            // prune aircraft list
            if (h++ % pruneInt == pruneInt - 1) {

                console.log("Applied history " + h + " from: "
                    + (new Date(now * 1000)).toLocaleTimeString());

                reaper();
            }
        }

        // Final pass to update all planes to their latest state
        console.log("Final history cleanup pass");
        for (let i in PlanesOrdered) {
            let plane = PlanesOrdered[i];

            if (plane.position && SitePosition)
                plane.sitedist = ol.sphere.getDistance(SitePosition, plane.position);

            if (uatNoTISB && plane.uat && plane.type && plane.type.substring(0,4) == "tisb") {
                plane.last_message_time -= 999;
            }
        }

        refreshFeatures();
        TAR.planeMan.refresh();
    }

    PositionHistoryBuffer = null;

    if (nHistoryItems)
        console.timeEnd("Loaded aircraft tracks from History");

    historyLoaded.resolve();
}

let timers = {};
function clearIntervalTimers() {
    if (loadFinished) {
        jQuery("#update_error_detail").text('Timers paused (tab hidden).');
        jQuery("#update_error").css('display','block');
    }
    console.log("clear timers");
    const entries = Object.entries(timers);
    for (let i in entries) {
        clearInterval(entries[i][1]);
    }
}

function setIntervalTimers() {
    if (loadFinished) {
        jQuery("#update_error").css('display','none');
    }
    console.log("set timers");
    if ((adsbexchange || dynGlobeRate) && !uuid) {
        timers.globeRateUpdate = setInterval(globeRateUpdate, 180000);
    }
    pollPositionInterval();
    setAutoselect();

    timers.checkMove = setInterval(checkMovement, 50);
    timers.everySecond = setInterval(everySecond, 850);
    timers.reaper = setInterval(reaper, 20000);
    //reaper();
    if (tempTrails) {
        timers.trailReaper = window.setInterval(trailReaper, 10000);
        trailReaper(now);
    }
    if (enable_pf_data && !pTracks && !globeIndex) {
        jQuery('#pf_info_contianer').removeClass('hidden');
        timers.pf_data = window.setInterval(fetchPfData, RefreshInterval*10.314);
        fetchPfData();
    }
    if (receiverJson && receiverJson.outlineJson) {
        timers.drawOutline = window.setInterval(drawOutlineJson, 30000);
        drawOutlineJson();
    }
}


function startPage() {
    console.log("Completing init");

    if (!globeIndex) {
        jQuery("#lastLeg_cb").parent().hide();
        jQuery('#show_trace').hide();
    }
    if (globeIndex) {
        jQuery('#V').hide();
    } else {
    }

    if (hideButtons) {
        jQuery('#header_top').hide();
        jQuery('#header_side').hide();
        jQuery('#splitter').hide();
        jQuery('#tabs').hide();
        jQuery('#filterButton').hide();
        jQuery('.ol-control').hide();
        jQuery('.ol-attribution').show();
    }

    if (!icaoFilter && globeIndex)
        toggleTableInView(true);

    changeZoom("init");
    changeCenter("init");

    clearIntervalTimers();
    setIntervalTimers();

    processURLParams();
    if (usp.has('reg')) {
        let req = regIcaoDownload();
        req.done(function() {
            const queries = usp.get('reg').split(',');
            for (let i in queries) {
                let icao = regCache[queries[i].toUpperCase()];
                if (icao) {
                    icao = icao.toLowerCase();
                    urlIcaos.push(icao);
                }
            }
            processURLParams();
        });
    }

    loadFinished = true;

    // Kick off first refresh.
    fetchData();

    if (tempTrails)
        selectAllPlanes();

    if (!heatmap)
        jQuery("#loader").addClass("hidden");

    if (replay) {
        showReplayBar();
        loadReplay(replay.ts);
    }

    geoMag = geoMagFactory(cof2Obj());

    mapRefresh();

    if (heatmap) {
        drawHeatmap();
    }

    initVisibilityChange();

    if (pTracks)
        setTimeout(TAR.planeMan.refresh, 10000);
}

//
// Utils begin
//
(function (global, jQuery, TAR) {
    let utils = TAR.utils = TAR.utils || {};

    // Make a LineString with 'points'-number points
    // that is a closed circle on the sphere such that the
    // great circle distance from 'center' to each point is
    // 'radius' meters
    utils.make_geodesic_circle = function (center, radius, points) {
        const angularDistance = radius / 6378137.0;
        const lon1 = center[0] * Math.PI / 180.0;
        const lat1 = center[1] * Math.PI / 180.0;

        let geom;
        for (let i = 0; i <= points; ++i) {
            const bearing = i * 2 * Math.PI / points;

            let lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) +
                Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing));
            let lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
                Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2));

            lat2 = lat2 * 180.0 / Math.PI;
            lon2 = lon2 * 180.0 / Math.PI;

            if (!geom)
                geom = new ol.geom.LineString([[lon2, lat2]]);
            else
                geom.appendCoordinate([lon2, lat2]);
        }
        return geom;
    }

    return TAR;
}(window, jQuery, TAR || {}));
//
// Utils end
//
//

function webglAddLayer() {
    let success = false;

    const icao = '~c0ffee';
    if (icaoFilter) {
        icaoFilter.push(icao);
    }
    processAircraft({hex: icao, lat: CenterLat, lon: CenterLon, type: 'tisb_other', seen: 0, seen_pos: 0,
        alt_baro: 25000, });
    let plane = Planes['~c0ffee'];

    try {
        let glStyle = {
            symbol: {
                symbolType: 'image',
                src: 'images/sprites011.png',
                size: [ 'get', 'size' ],
                offset: [0, 0],
                textureCoord: [ 'array',
                    [ 'get', 'cx' ],
                    [ 'get', 'cy' ],
                    [ 'get', 'dx' ],
                    [ 'get', 'dy' ]
                ],
                color: [
                    'color',
                    [ 'get', 'r' ],
                    [ 'get', 'g' ],
                    [ 'get', 'b' ],
                    1
                ],
                rotateWithView: false,
                rotation: [ 'get', 'rotation' ],
            },
        };
        if (heatmap) {
            glStyle = {
                symbol: {
                    symbolType: "circle",
                    size: heatmap.radius * globalScale * 2.5,
                    offset: [0, 0],
                    opacity: heatmap.alpha || 1,
                    color: [
                        'color',
                        [ 'get', 'r' ],
                        [ 'get', 'g' ],
                        [ 'get', 'b' ],
                        1
                    ],
                }
            }
        }

        webglLayer = new ol.layer.WebGLPoints({
            name: 'webglLayer',
            type: 'overlay',
            title: 'Aircraft pos. webGL',
            source: webglFeatures,
            declutter: false,
            zIndex: 200,
            style: glStyle,
            renderBuffer: renderBuffer,
        });
        if (!webglLayer || !webglLayer.getRenderer())
            return false;

        layers.push(webglLayer);

        webgl = true;
        plane.visible = true;
        plane.updateMarker();
        OLMap.renderSync();

        success = true;
    } catch (error) {
        try {
            layers.remove(webglLayer);
        } catch (error) {
            console.error(error);
        }
        console.error(error);
        loStore['webglFailStamp'] = new Date().getTime();
        success = false;
        if (loStore['webgl'] == 'true')
            loStore.removeItem('webgl');
    }
    delete Planes[plane.icao];
    PlanesOrdered.splice(PlanesOrdered.indexOf(plane), 1);
    plane.destroy();

    return success;
}

function webglInit() {
    let init = true;
    // if webGL failed in the last 7 days, don't even try unless people click the toggle.
    if (loStore['webglFailStamp'] && Number(loStore['webglFailStamp']) +  7 * 24 * 3600 * 1000 > new Date().getTime()) {
        init = false;
        if (loStore['webgl'] == undefined)
            console.log('webGL failed in the past 7 days, not even trying to initialize it');
    }
    new Toggle({
        key: "webgl",
        display: "WebGL",
        container: "#settingsRight",
        init: init,
        setState: function(state) {
            if (state) {
                if (webglLayer) {
                    webgl = true;
                } else {
                    webgl = webglAddLayer();
                }

                if (!webgl) {
                    console.error('Unable to initialize the webGL Layer! Falling back to non-webGL icons, performance will be reduced significantly!');
                    webglLayer = null;
                }
                if (!webgl)
                    return false;
                // returning false means the toggle will flip back as the activation of the webgl layer was unsuccessful.
            } else {
                webgl = false;
                if (loadFinished) {
                    webglFeatures && webglFeatures.clear();
                    for (let i in PlanesOrdered) {
                        const plane = PlanesOrdered[i];
                        delete plane.glMarker;
                    }
                }
            }
            if (loadFinished) {
                refreshFilter();
                checkPointermove();
            }
        },
    });
}

// Initalizes the map and starts up our timers to call various functions
function initMap() {

    if (globeIndex) {
        jQuery('#dump1090_total_history_td').hide();
        jQuery('#dump1090_message_rate_td').hide();
    }

    // Load stored map settings if present
    CenterLon = Number(loStore['CenterLon']) || DefaultCenterLon;
    CenterLat = Number(loStore['CenterLat']) || DefaultCenterLat;
    ZoomLvl = Number(loStore['ZoomLvl']) || DefaultZoomLvl;
    ZoomLvlCache = ZoomLvl;

    if (overrideMapType)
        MapType_tar1090 = overrideMapType;
    else if (loStore['MapType_tar1090']) {
        MapType_tar1090 = loStore['MapType_tar1090'];
    }

    // Initialize OpenLayers

    layers_group = createBaseLayers();
    layers = layers_group.getLayers();

    siteCircleLayer = new ol.layer.Vector({
        name: 'siteCircles',
        type: 'overlay',
        title: 'Range rings',
        source: siteCircleFeatures,
        visible: SiteCircles,
        zIndex: 100,
        renderOrder: null,
        renderBuffer: renderBuffer,
    });
    layers.push(siteCircleLayer);

    siteCircleLayer.on('change:visible', function(evt) {
        if (evt.target.getVisible()) {
            geoFindMe();
        }
    });

    locationDotLayer = new ol.layer.Vector({
        name: 'locationDot',
        type: 'overlay',
        title: (receiverJson && receiverJson.lat != null) ? 'Site position' : 'Your position',
        source: locationDotFeatures,
        visible: SiteShow,
        zIndex: 100,
        renderOrder: null,
        renderBuffer: renderBuffer,
    });
    layers.push(locationDotLayer);

    locationDotLayer.on('change:visible', function(evt) {
        if (evt.target.getVisible()) {
            geoFindMe();
        }
    });


    if (receiverJson && receiverJson.outlineJson) {
        actualOutlineFeatures = new ol.source.Vector();
        actualOutlineStyle = new ol.style.Style({
            fill: null,
            stroke: new ol.style.Stroke({
                color: actual_range_outline_color,
                width: actual_range_outline_width,
                lineDash: actual_range_outline_dash,
            }),
        });
        actualOutlineLayer = new ol.layer.Vector({
            name: 'actualRangeOutline',
            type: 'overlay',
            title: 'actual range outline',
            source: actualOutlineFeatures,
            zIndex: 101,
            renderBuffer: renderBuffer,
            style: actualOutlineStyle,
        });
        layers.push(actualOutlineLayer);
    }
    if (calcOutlineData) {
        calcOutlineLayer = new ol.layer.Vector({
            name: 'calcOutline',
            type: 'overlay',
            title: 'terrain-based range outline',
            source: calcOutlineFeatures,
            zIndex: 100,
            renderOrder: null,
            renderBuffer: renderBuffer,
        });
        layers.push(calcOutlineLayer);
        drawUpintheair();
    }


    const dummyLayer = new ol.layer.Vector({
        name: 'dummy',
        renderOrder: null,
    });

    trailGroup.push(dummyLayer);

    trailLayers = new ol.layer.Group({
        name: 'ac_trail',
        title: 'Aircraft trails',
        type: 'overlay',
        layers: trailGroup,
        zIndex: 150,
    });

    layers.push(trailLayers);

    iconLayer = new ol.layer.Vector({
        name: 'iconLayer',
        type: 'overlay',
        title: 'Aircraft positions',
        source: PlaneIconFeatures,
        declutter: false,
        zIndex: 200,
        renderBuffer: renderBuffer,
    });
    layers.push(iconLayer);


    OLMap = new ol.Map({
        target: 'map_canvas',
        layers: layers,
        view: new ol.View({
            center: ol.proj.fromLonLat([CenterLon, CenterLat]),
            zoom: ZoomLvl,
            multiWorld: true,
        }),
        controls: [new ol.control.Zoom({delta: 1, duration: 0, target: 'map_canvas',}),
            new ol.control.Attribution({collapsed: true}),
            new ol.control.ScaleLine({units: DisplayUnits})
        ],
        interactions: new ol.interaction.defaults({altShiftDragRotate:false, pinchRotate:false,}),
    });

    console.time('webglInit');
    webglInit();
    console.timeEnd('webglInit');

    let foundType = false;
    ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
        if (lyr.get('name') && lyr.get('type') == 'base') {
            if (MapType_tar1090 == lyr.get('name')) {
                foundType = true;
            }
        }
    });
    if (!foundType) {
        MapType_tar1090 = "osm_adsbx";
    }

    ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
        if (!lyr.get('name'))
            return;

        if (lyr.get('type') == 'base') {
            if (MapType_tar1090 == lyr.get('name')) {
                foundType = true;
                lyr.setVisible(true);
            } else {
                lyr.setVisible(false);
            }

            lyr.on('change:visible', function(evt) {
                if (evt.target.getVisible()) {
                    MapType_tar1090 = loStore['MapType_tar1090'] = evt.target.get('name');
                }
            });
        } else if (lyr.get('type') === 'overlay') {
            if (loStore['layer_' + lyr.get('name')] == 'true' || enableOverlays.indexOf(lyr.get('name')) >= 0) {
                lyr.setVisible(true);
            }
            if (loStore['layer_' + lyr.get('name')] == 'false') {
                lyr.setVisible(false);
            }

            lyr.on('change:visible', function(evt) {
                loStore['layer_' + evt.target.get('name')] = evt.target.getVisible();
            });
        }
    })

    if (!foundType) {
        ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
            if (foundType)
                return;
            if (lyr.get('type') === 'base') {
                lyr.setVisible(true);
                foundType = true;
            }
        });
    }

    OLProj = OLMap.getView().getProjection();

    OLMap.getView().setRotation(mapOrientation); // adjust orientation

    OLMap.addControl(new ol.control.LayerSwitcher({
        groupSelectStyle: 'none',
        activationMode: 'click', // click sucks in the current implementation
        target: 'map_canvas',
    }));

    OLMap.on('moveend', function(event) {
        checkMovement();
    });

    OLMap.on(['click', 'dblclick'], function(evt) {
        let trailHex = null;
        let trailTS = null;
        let planeHex = null;

        let features = webgl ? webglFeatures : PlaneIconFeatures;
        let evtCoords = evt.map.getCoordinateFromPixel(evt.pixel);
        let feature = features.getClosestFeatureToCoordinate(evtCoords);
        if (feature) {
            let fPixel = evt.map.getPixelFromCoordinate(feature.getGeometry().getCoordinates());
            let a = fPixel[0] - evt.pixel[0];
            let b = fPixel[1] - evt.pixel[1];
            let c = globalScale * (onMobile ? 30 : 20);
            if (a**2 + b**2 < c**2)
                planeHex = feature.hex;
        }

        if (!planeHex || showTrace) {
            let features = evt.map.getFeaturesAtPixel(
                evt.pixel,
                {
                    layerFilter: function(layer) { return (layer.get('isTrail') == true); },
                    hitTolerance: globalScale * (onMobile ? 30 : 20),
                }
            );
            if (features.length > 0) {
                let close = 10000000000000;
                let closest = features[0];
                for (let j in features) {
                    let feature = features[j];
                    let coords;
                    if (feature.isLabel)
                        coords = [feature.getGeometry().getCoordinates()];
                    else
                        coords = feature.getGeometry().getCoordinates();

                    for (let k in coords) {
                        let fPixel = evt.map.getPixelFromCoordinate(coords[k]);
                        let a = fPixel[0] - evt.pixel[0];
                        let b = fPixel[1] - evt.pixel[1];
                        let distance = a**2 + b**2;
                        if (distance < close) {
                            closest = feature;
                            close = distance;
                        }
                    }
                }
                if (showTrace)
                    trailTS = closest.timestamp;
                else
                    trailHex = closest.hex;
            }
        }

        const dblclick = (evt.type === 'dblclick') && !showTrace;

        if (showTrace && trailTS) {
            gotoTime(trailTS);
        }
        let hex = planeHex || trailHex;
        if (hex) {
            selectPlaneByHex(hex, {noDeselect: dblclick, follow: dblclick});
        }

        if (!hex && !multiSelect && !showTrace) {
            if (onlySelected)
                toggleIsolation();
            deselect(SelectedPlane);
            refreshFilter();
            updateAddressBar();
        }
        evt.stopPropagation();
    });

    jQuery('#infoblock_close').on('click', function () {

        if (showTrace)
            toggleShowTrace();
        if (onlySelected)
            toggleIsolation();

        deselect(SelectedPlane);
        refreshFilter();
        updateAddressBar();
    });


    // show the hover box
    if (!globeIndex && ZoomLvl > 5.5 && enableMouseover) {
        OLMap.on('pointermove', onPointermove);
    }

    // handle the layer settings pane checkboxes
    OLMap.once('postrender', function(e) {
        //toggleLayer('#nexrad_checkbox', 'nexrad');
        //toggleLayer('#sitepos_checkbox', 'site_pos');
        //toggleLayer('#actrail_checkbox', 'ac_trail');
        //toggleLayer('#acpositions_checkbox', 'webglLayer');
    });

    new Toggle({
        key: "darkerColors",
        display: "Darker Colors",
        container: "#settingsLeft",
        init: darkerColors,
        setState: function(state) {
            darkerColors = state;
            if (loadFinished) {
                refreshFeatures();
                remakeTrails();
            }
        }
    });

    tableColorsLight = tableColors;
    tableColorsDark = JSON.parse(JSON.stringify(tableColors));
    let darkVals = Object.values(tableColorsDark);
    for (let i in ['selected', 'unselected']) {
        let obj = darkVals[i];
        let keys = Object.keys(obj)
        for (let j in keys) {
            let key = keys[j];
            let hsl = hexToHSL(obj[key]);
            hsl[1] *= 0.4;
            hsl[2] *= 0.3;
            obj[key] = hslToRgb(hsl);
        }
    }
    new Toggle({
        key: "darkMode",
        display: "Dark Mode",
        container: "#settingsLeft",
        init: darkModeDefault,
        setState: function(state) {
            let root = document.documentElement;
            jQuery(".layer-switcher .panel").css("background", "var(--BGCOLOR1)");
            jQuery(".layer-switcher .panel").css("border", "4px solid var(--BGCOLOR1)");
            if (state) {
                root.style.setProperty("--BGCOLOR1", '#313131');
                root.style.setProperty("--BGCOLOR2", '#242424');
                root.style.setProperty("--TXTCOLOR1","#BFBFBF");
                root.style.setProperty("--TXTCOLOR2","#D8D8D8");
                root.style.setProperty("--TXTCOLOR3","#a8a8a8");
                //invert the "x" images
                jQuery(".infoblockCloseBox").css('filter','invert(100%)');
                jQuery(".infoblockCloseBox").css(' -webkit-filter','invert(100%)');
                jQuery(".settingsCloseBox").css('filter','invert(100%)');
                jQuery(".settingsCloseBox").css(' -webkit-filter','invert(100%)');
                tableColors = tableColorsDark;
            } else {
                root.style.setProperty("--BGCOLOR1", '#F8F8F8');
                root.style.setProperty("--BGCOLOR2", '#CCCCCC');
                root.style.setProperty("--TXTCOLOR1","#003f4b");
                root.style.setProperty("--TXTCOLOR2","#050505");
                root.style.setProperty("--TXTCOLOR3","#003f4b");
                jQuery(".infoblockCloseBox").css('filter','invert(0%)');
                jQuery(".infoblockCloseBox").css(' -webkit-filter','invert(0%)');
                jQuery(".settingsCloseBox").css('filter','invert(0%)');
                jQuery(".settingsCloseBox").css(' -webkit-filter','invert(0%)');

                tableColors = tableColorsLight;
            }
            if (loadFinished) {
                TAR.planeMan.redraw();
                refreshFilter();
                initLegend(tableColors.unselected);
                initSourceFilter(tableColors.unselected);
                initFlagFilter(tableColors.unselected);
            }
        }
    });

    initLegend(tableColors.unselected);

    initFilters();

    new Toggle({
        key: "MapDim",
        display: "Dim Map",
        container: "#settingsLeft",
        init: MapDim,
        setState: function(state) {
            if (!state) {
                ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
                    if (lyr.get('type') != 'base')
                        return;
                    ol.Observable.unByKey(lyr.dimKey);
                });
            } else {
                ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
                    if (lyr.get('type') != 'base')
                        return;
                    lyr.dimKey = lyr.on('postrender', dim);
                });
            }
            OLMap.render();
            buttonActive('#B', state);
        }
    });

    window.addEventListener('keydown', function(e) {
        active();
        if (e.defaultPrevented ) {
            return; // Do nothing if the event was already processed
        }
        if (e.target.type == "text") {
            return;
        }
        if (e.srcElement.nodeName == 'INPUT') {
            return;
        }

        if( e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }
        let oldCenter, extent, newCenter;
        switch (e.key) {
            case "c":
            case "Esc":
            case "Escape":
                deselectAllPlanes();
                break;
                // zoom and movement
            case "q":
                zoomOut();
                break;
            case "e":
                zoomIn();
                break;
            case "w":
                oldCenter = OLMap.getView().getCenter();
                extent = OLMap.getView().calculateExtent(OLMap.getSize());
                newCenter = [oldCenter[0], (oldCenter[1] + extent[3])/2];
                OLMap.getView().setCenter(newCenter);
                toggleFollow(false);
                break;
            case "s":
                oldCenter = OLMap.getView().getCenter();
                extent = OLMap.getView().calculateExtent(OLMap.getSize());
                newCenter = [oldCenter[0], (oldCenter[1] + extent[1])/2];
                OLMap.getView().setCenter(newCenter);
                toggleFollow(false);
                break;
            case "a":
                oldCenter = OLMap.getView().getCenter();
                extent = OLMap.getView().calculateExtent(OLMap.getSize());
                newCenter = [(oldCenter[0] + extent[0])/2, oldCenter[1]];
                OLMap.getView().setCenter(newCenter);
                toggleFollow(false);
                break;
            case "d":
                oldCenter = OLMap.getView().getCenter();
                extent = OLMap.getView().calculateExtent(OLMap.getSize());
                newCenter = [(oldCenter[0] + extent[2])/2,  oldCenter[1]];
                OLMap.getView().setCenter(newCenter);
                toggleFollow(false);
                break;
                // misc
            case "b":
                toggles['MapDim'].toggle();
                break;
            case "m":
                toggleMultiSelect();
                break;
            case "v":
                toggleTableInView();
                break;
            case "r":
                if (heatmap)
                    drawHeatmap();
                else
                    followRandomPlane();
                break;
            case "R":
                fetchData();
                break;
            case "t":
                selectAllPlanes();
                break;
            case "G":
                nogpsOnly = !nogpsOnly;
                refreshFilter();
                break;
            case "h":
                resetMap();
                break;
            case "H":
                if (!hideButtons) {
                    jQuery('#header_top').hide();
                    jQuery('#header_side').hide();
                    jQuery('#splitter').hide();
                    jQuery('#tabs').hide();
                    jQuery('#filterButton').hide();
                    jQuery('.ol-control').hide();
                    jQuery('.ol-attribution').show();
                } else {
                    jQuery('#header_top').show();
                    jQuery('#header_side').show();
                    jQuery('#splitter').show();
                    jQuery('#tabs').show();
                    jQuery('#filterButton').show();
                    jQuery('.ol-control').show();
                    jQuery('#expand_sidebar_control').hide();
                    toggles['sidebar_visible'].restore();
                    TAR.altitudeChart.render();
                }
                hideButtons = !hideButtons;
                break;
            case "f":
                toggleFollow();
                break;
                // filters
            case "T":
                filterTISB = !filterTISB;
                refreshFilter();
                break;
            case "u":
                toggleMilitary();
                break;
            case "i":
                toggleIsolation();
                break;
                // persistence mode
            case "p":
                togglePersistence();
                break;
                // Labels
            case "l":
                toggleLabels();
                break;
            case "o":
                toggleExtendedLabels();
                break;
            case "k":
                toggleTrackLabels();
                break;
                // debug stuff
            case "L":
                toggles['lastLeg'].toggle();
                break;
            case "D":
                debug = !debug;
                loStore['debug'] = debug;
                console.log('debug = ' + debug);
                break;
            case "P":
                debugPosFilter = !debugPosFilter;
                loStore['debugPosFilter'] = debugPosFilter;
                console.log('debugPosFilter = ' + debugPosFilter);
                break;
            case "?":
                if (!SelectedPlane) {
                    console.log("No plane selected");
                    break;
                }
                console.log(SelectedPlane.icao + ": " + SelectedPlane.baseMarkerKey + "  " + SelectedPlane.shape);
                console.log(SelectedPlane);
                console.log(SelectedPlane.milRange());
                break;
            case "j":
                selectPlaneByHex(jumpTo, {follow: true});
                break;
            case "J":
                debugJump = !debugJump;
                loStore['debugJump'] = debugJump;
                console.log('debugJump = ' + debugJump);
                break;
            case "N":
                noMLAT = !noMLAT;
                loStore['noMLAT'] = noMLAT;
                console.log('noMLAT = ' + noMLAT);
                break;
        }
    }, true);

    if (window && window.location && window.location.protocol == 'https:'
        && !SiteOverride && (globeIndex || uuid || askLocation)
        && !usp.has('icao') && !usp.has("lat") && !usp.has("lon")
        && loStore['geoFindMeFirstVisit'] == undefined) {
        jQuery("#geoFindMeDialog").dialog({
            resizable: false,
            height: "auto",
            width: "auto",
            buttons: {
                "Yes": function() {
                    geoFindMe();
                    jQuery(this).dialog( "close" );
                },
                "No": function() {
                    loStore['geoFindMeFirstVisit'] = 'no'
                    jQuery(this).dialog( "close" );
                }
            }
        });
    } else {
        geoFindMe();
    }
}

// This looks for planes to reap out of the master Planes variable
let lastReap = 0;
function reaper(all) {
    console.log("Reaping started..");
    if (noVanish && !all)
        return;

    if (lastReap == "in_progress") {
        return;
    }

    lastReap = "in_progress";

    // Look for planes where we have seen no messages for >300 seconds
    let plane;
    let length = PlanesOrdered.length;
    let temp = []
    for (let i = 0; i < length; i++) {
        plane = PlanesOrdered[i];
        if (plane == null)
            continue;
        plane.seen = now - plane.last_message_time;
        if ( all || ((!plane.selected)
            && plane.seen > 300
            && (plane.dataSource != 'adsc' || plane.seen > jaeroTimeout))
        ) {
            // Reap it.
            //console.log("Removed " + plane.icao);
            delete Planes[plane.icao];
            plane.destroy();
            continue;
        }

        // Keep it.
        temp.push(plane);

        if (globeIndex) {
            if (plane.clearTraceAfter) {
                //console.log(now - plane.clearTraceAfter);
                if (now > plane.clearTraceAfter) {
                    plane.clearTrace();
                    //console.log("clearTrace: " + plane.icao);
                }
            } else if (!plane.linesDrawn) {
                plane.clearTraceAfter = now + 300;
            }
        }
    }
    PlanesOrdered = temp;

    lastReap = now;
    //console.log(length - PlanesOrdered.length);
    return (length - PlanesOrdered.length);
}

// Page Title update function
function refreshPageTitle() {
    if (pTracks)
        return;
    if (!PlaneCountInTitle && !MessageRateInTitle) {
        return;
    }

    let subtitle = "";

    if (PlaneCountInTitle) {
        if (globeIndex) {
            subtitle += 'tracking ' + globeTrackedAircraft + ' aircraft';
        } else {
            subtitle += TrackedAircraftPositions + '/' + TrackedAircraft;
        }
    }

    if (MessageRateInTitle && MessageRate != null) {
        if (subtitle) subtitle += ' | ';
        subtitle += MessageRate.toFixed(1) + '/s';
    }

    document.title = PageName + ' - ' + subtitle;
}

function displaySil() {
    jQuery('#copyrightInfo').html("");
    if (!showSil) {
        setPhotoHtml("");
        return;
    }
    let selected = SelectedPlane;
    let new_html="";
    let type = selected.icaoType ? selected.icaoType : 'ZZZZ';
    let hex = selected.icao.toUpperCase();
    new_html = "<img id='silhouette' width='"+ 151 * globalScale + "' src='aircraft_sil/" + type + ".png' />";
    setPhotoHtml(new_html);
    selected.icao.toUpperCase();
}

function displayPhoto() {
    if (!SelectedPlane)
        return;
    if (!SelectedPlane.psAPIresponse) {
        displaySil();
        return;
    }
    let photos = SelectedPlane.psAPIresponse["photos"] || SelectedPlane.psAPIresponse["images"];
    if (!photos || photos.length == 0) {
        displaySil();
        adjustInfoBlock();
        return;
    }
    let new_html="";
    let photoToPull = photos[0]["thumbnail"]["src"] || photos[0]["thumbnail"];
    let linkToPicture = photos[0]["link"];
    //console.log(linkToPicture);
    new_html = '<a class=\"link\" href="'+linkToPicture+'" target="_blank" rel="noopener noreferrer"><img id="airplanePhoto" src=' +photoToPull+'></a>';
    let copyright = photos[0]["photographer"] || photos[0]["user"];
    jQuery('#copyrightInfo').html("<span>Image © " + copyright +"</span>");
    setPhotoHtml(new_html);
    adjustInfoBlock();
}

function refreshPhoto(selected) {
    if (!showPictures || selected.icao[0] == '~' || (!planespottingAPI && !planespottersAPI)) {
        displaySil();
        return;
    }
    let urlTail;
    let param;
    if (!selected.dbinfoLoaded) {
        displaySil();
        return;
    } else if (selected.registration != null && selected.registration.match(/^[0-9]{0,2}\+?[0-9]{0,2}$/)) {
        displaySil();
        return;
    } else if (selected.registration != null) {
        urlTail = '/hex/' + selected.icao.toUpperCase() + '?reg=' + selected.registration;
        const type = selected.icaoType;
        if (type && type != 'E170' && !type.startsWith('E75')) {
            urlTail += '&icaoType=' + type;
        }
        param = 'DB';
    } else {
        urlTail = 'hex/' + selected.icao.toUpperCase();
        param = 'hex';
    }


    const ts = new Date().getTime();
    if (param == selected.psAPIparam) {
        if (selected.psAPIresponse) {
            displayPhoto();
            return;
        }
        if (selected.psAPIresponseTS && selected.psAPIresponseTS - ts < 10000) {
            return;
        }
    }
    selected.psAPIparam = param;

    setPhotoHtml("<p>Loading image...</p>");
    jQuery('#copyrightInfo').html("<span></span>");
    //console.log(ts/1000 + 'sending psAPI request');
    selected.psAPIresponseTS = ts;

    if (planespottersAPI) {
        let req = jQuery.ajax({
            url: 'https://api.planespotters.net/pub/photos/' + urlTail,
            dataType: 'json',
            plane: selected,
        });

        req.done(function(data) {
            this.plane.psAPIresponse = data;
            if (SelectedPlane == this.plane) {
                displayPhoto();
            }
        });
    } else if (planespottingAPI) {
        let req = jQuery.ajax({
            url: 'https://www.planespotting.be/api/objects/imagesRegistration.php?registration=' + selected.registration,
            dataType: 'json',
            plane: selected,
        });

        req.done(function(data) {
            this.plane.psAPIresponse = data;
            if (SelectedPlane == this.plane) {
                displayPhoto();
            }
        });
        req.fail(function() {
            this.plane.psAPIresponse = {'photos': []};
            if (SelectedPlane == this.plane) {
                displayPhoto();
            }
        });
    }
}

let selCall = null;
let selIcao = null;
let selReg = null;

let somethingSelected = false;
// Refresh the detail window about the plane
function refreshSelected() {
    const selected = SelectedPlane;

    if (!selected) {
        if (somethingSelected) {
            adjustInfoBlock();
            buttonActive('#F', FollowSelected);
        }
        somethingSelected = false;
        return;
    }
    somethingSelected = true;
    buttonActive('#F', FollowSelected);

    selected.checkVisible();
    selected.checkForDB();

    refreshPhoto(selected);

    jQuery('#selected_callsign').updateText(selected.name);

    if (showTrace) {
        if (selected.position_time) {
            const date = new Date(selected.position_time * 1000);
            let timestamp = utcTimesHistoric ? (zuluTime(date) + NBSP + 'Z') : (lDateString(date) + ' ' + localTime(date) + NBSP + TIMEZONE);
            jQuery('#trace_time').updateText('Time:\n' + timestamp);
        } else {
            jQuery('#trace_time').updateText('Time:\n');
        }
    }

    if (flightawareLinks) {
        jQuery('#selected_flightaware_link').html(getFlightAwareModeSLink(selected.icao, selected.flight, "Visit Flight Page"));
    }

    if (selected.isNonIcao() && selected.source != 'mlat') {
        jQuery('#anon_mlat_info').addClass('hidden');
        jQuery('#reg_info').addClass('hidden');
        jQuery('#tisb_info').removeClass('hidden');
    } else if (selected.isNonIcao() && selected.source == 'mlat') {
        jQuery('#reg_info').addClass('hidden');
        jQuery('#tisb_info').addClass('hidden');
        jQuery('#anon_mlat_info').removeClass('hidden');
    } else {
        jQuery('#tisb_info').addClass('hidden');
        jQuery('#anon_mlat_info').addClass('hidden');
        jQuery('#reg_info').removeClass('hidden');
    }

    let checkReg = selected.registration + ' ' + selected.dbinfoLoaded;
    if (checkReg != selReg) {
        selReg = checkReg;
        if (selected.registration) {
            if (flightawareLinks) {
                jQuery('#selected_registration').html(getFlightAwareIdentLink(selected.registration, selected.registration));
            } else if (registrationLinks && registrationLink(selected)) {
                jQuery('#selected_registration').html(`<a class="link" target="_blank" href="${registrationLink(selected)}">${selected.registration}</a>`);
            } else {
                jQuery('#selected_registration').updateText(selected.registration);
            }
        } else {
            jQuery('#selected_registration').updateText("n/a");
        }
    }
    let dbFlags = "";
    if (selected.ladd)
        dbFlags += ' <a class="link" target="_blank" href="https://ladd.faa.gov/" rel="noreferrer">LADD</a> / ';
    if (selected.pia)
        dbFlags += '<a class="link" target="_blank" href="https://www.faa.gov/nextgen/equipadsb/privacy/" rel="noreferrer">PIA</a> / ';
    if (selected.military)
        dbFlags += 'military / ';
    if (dbFlags.length == 0) {
        jQuery('#selected_dbFlags').updateText("none");
    } else {
        jQuery('#selected_dbFlags').html(dbFlags.slice(0, -3));
    }

    if (selected.icaoType) {
        jQuery('#selected_icaotype').updateText(selected.icaoType);
    } else {
        jQuery('#selected_icaotype').updateText("n/a");
    }
    if (selected.typeDescription)
        jQuery('#selected_typedesc').updateText(selected.typeDescription);
    else
        jQuery('#selected_typedesc').updateText("n/a");

    let typeLine = "";
    if (selected.year)
        typeLine += selected.year + " "
    if (selected.typeLong)
        typeLine += selected.typeLong;
    if (!typeLine)
        typeLine = "n/a"

    jQuery('#selected_typelong').updateText(typeLine);

    if (selected.ownOp)
        jQuery('#selected_ownop').updateText(selected.ownOp);
    else
        jQuery('#selected_ownop').updateText("");

    if (selected.rId && show_rId) {
        jQuery('#receiver_id').updateText(selected.rId);
        jQuery('#receiver_id_div').removeClass('hidden');
    } else {
        jQuery('#receiver_id_div').addClass('hidden');
    }


    jQuery("#selected_altitude1").updateText(format_altitude_long(selected.altitude, selected.vert_rate, DisplayUnits));
    jQuery("#selected_altitude2").updateText(format_altitude_long(selected.altitude, selected.vert_rate, DisplayUnits));

    jQuery('#selected_onground').updateText(format_onground(selected.altitude));

    if (selected.squawk == null || selected.squawk == '0000') {
        jQuery('#selected_squawk1').updateText('n/a');
        jQuery('#selected_squawk2').updateText('n/a');
    } else {
        jQuery('#selected_squawk1').updateText(selected.squawk);
        jQuery('#selected_squawk2').updateText(selected.squawk);
    }

    let magResult = null;

    if (geoMag && selected.position != null) {
        let lon = selected.position[0];
        let lat = selected.position[1];
        let alt = selected.altitude == "ground" ? 0 : selected.altitude;
        magResult = geoMag(lat, lon, alt);
        jQuery('#selected_mag_declination').updateText(format_track_brief(magResult.dec));
    } else {
        jQuery('#selected_mag_declination').updateText('n/a');
    }

    let heading = null;
    if (selected.true_heading != null && selected.track != null) {
        heading = selected.true_heading;
    } else if (magResult && selected.mag_heading != null && selected.track != null) {
        heading = selected.mag_heading + magResult.dec;
    }
    if (heading != null && heading < 0)
        heading += 360;
    if (heading != null && heading > 360)
        heading -= 360;

    jQuery('#selected_mag_heading').updateText(format_track_brief(selected.mag_heading));

    if (selected.wd != null && selected.ws != null) {
        jQuery('#selected_wd').updateText(format_track_brief(selected.wd, true));
        jQuery('#selected_ws').updateText(format_speed_long(selected.ws, DisplayUnits));
    } else if (!globeIndex && magResult && selected.gs != null && selected.tas != null && selected.track != null && selected.mag_heading != null) {

        const trk = (Math.PI / 180) * selected.track;
        const hdg = (Math.PI / 180) * heading;
        const tas = selected.tas;
        const gs = selected.gs;
        const ws = Math.round(Math.sqrt(Math.pow(tas - gs, 2) + 4 * tas * gs * Math.pow(Math.sin((hdg - trk) / 2), 2)));
        let wd = trk + Math.atan2(tas * Math.sin(hdg - trk), tas * Math.cos(hdg - trk) - gs);
        if (wd < 0) {
            wd = wd + 2 * Math.PI;
        }
        if (wd > 2 * Math.PI) {
            wd = wd - 2 * Math.PI;
        }
        wd = Math.round((180 / Math.PI) * wd);
        jQuery('#selected_wd').updateText(format_track_brief(wd, true));
        jQuery('#selected_ws').updateText(format_speed_long(ws, DisplayUnits));
    } else {
        jQuery('#selected_wd').updateText('n/a');
        jQuery('#selected_ws').updateText('n/a');
    }


    if (!globeIndex && selected.true_heading == null && heading != null)
        jQuery('#selected_true_heading').updateText(format_track_brief(heading));
    else
        jQuery('#selected_true_heading').updateText(format_track_brief(selected.true_heading));


    let oat = null;
    let tat = null;

    if (selected.tat != null && selected.oat != null) {
        oat = selected.oat;
        tat = selected.tat;
    } else if (!globeIndex && selected.mach != null && selected.tas != null && selected.mach > 0.395) {
        oat = Math.pow((selected.tas / 661.47 / selected.mach), 2) * 288.15 - 273.15;
        tat = -273.15 + (oat + 273.15) * (1 + 0.2 * selected.mach * selected.mach);
    }


    if (oat != null)
        jQuery('#selected_temp').updateText(Math.round(tat) + ' / ' + Math.round(oat)  + ' °C');
    else
        jQuery('#selected_temp').updateText('n/a');

    jQuery('#selected_speed1').updateText(format_speed_long(selected.gs, DisplayUnits));
    jQuery('#selected_speed2').updateText(format_speed_long(selected.gs, DisplayUnits));
    jQuery('#selected_ias').updateText(format_speed_long(selected.ias, DisplayUnits));
    jQuery('#selected_tas').updateText(format_speed_long(selected.tas, DisplayUnits));
    jQuery('#selected_vert_rate').updateText(format_vert_rate_long(selected.vert_rate, DisplayUnits));
    jQuery('#selected_baro_rate').updateText(format_vert_rate_long(selected.baro_rate, DisplayUnits));
    jQuery('#selected_geom_rate').updateText(format_vert_rate_long(selected.geom_rate, DisplayUnits));
    if (selected.icao != selIcao) {
        selIcao = selected.icao;
        let hex_html = "<span style='font-family: monospace;' class=identSmall>Hex:" + NBSP + selected.icao.toUpperCase() + "</span>";
        if (globeIndex || shareBaseUrl) {
            let icao_link = "<span  class=identSmall><a class='link identSmall' target=\"_blank\" href=\"" + shareLink + "\">Share</a></span>";
            hex_html = hex_html + NBSP + NBSP + NBSP + icao_link;
        }
        jQuery('#selected_icao').html(hex_html);
    }
    if (globeIndex || shareBaseUrl) {
        const shareElement = jQuery('a.identSmall');
        if (shareElement.prop('href') !== shareLink) {
            shareElement.prop('href',shareLink);
        }
    }
    jQuery('#selected_pf_info').updateText((selected.pfRoute ? selected.pfRoute : "") );
    //+" "+ (selected.pfFlightno ? selected.pfFlightno : "")
    jQuery('#airframes_post_icao').attr('value',selected.icao);
    jQuery('#selected_track1').updateText(format_track_brief(selected.track));
    jQuery('#selected_track2').updateText(format_track_brief(selected.track));

    if (selected.seen != null && selected.seen < 1000000) {
        jQuery('#selected_seen').updateText(format_duration(selected.seen));
    } else {
        jQuery('#selected_seen').updateText('n/a');
    }
    if (selected.position_time != null) {
        jQuery('#selected_pos_epoch').updateText(Math.round(selected.position_time));
    } else {
        jQuery('#selected_pos_epoch').updateText('n/a');
    }
    if (selected.seen_pos != null && selected.seen_pos < 1000000) {
        jQuery('#selected_seen_pos').updateText(format_duration(selected.seen_pos));
    } else {
        jQuery('#selected_seen_pos').updateText('n/a');
    }

    jQuery('#selected_country').updateText(selected.icaorange.country.replace("special use", "special"));
    if (ShowFlags && selected.icaorange.flag_image !== null) {
        jQuery('#selected_flag').removeClass('hidden');
        jQuery('#selected_flag img').attr('src', FlagPath + selected.icaorange.flag_image);
        jQuery('#selected_flag img').attr('title', selected.icaorange.country);
    } else {
        jQuery('#selected_flag').addClass('hidden');
    }

    if (selected.position == null) {
        jQuery('#selected_position').updateText('n/a');
    } else {

        if (selected.seen_pos > -1) {
            jQuery('#selected_position').updateText(format_latlng(selected.position));
        } else {
            jQuery('#selected_position').updateText(format_latlng(selected.position));
        }
    }
    if (selected.position && SitePosition) {
        selected.sitedist = ol.sphere.getDistance(SitePosition, selected.position);
    }
    jQuery('#selected_source').updateText(format_data_source(selected.dataSource));
    jQuery('#selected_category').updateText(selected.category ? selected.category : "n/a");
    jQuery('#selected_category_label').updateText(get_category_label(selected.category));
    jQuery('#selected_sitedist1').updateText(format_distance_long(selected.sitedist, DisplayUnits));
    jQuery('#selected_sitedist2').updateText(format_distance_long(selected.sitedist, DisplayUnits));
    jQuery('#selected_rssi1').updateText(selected.rssi != null ? selected.rssi.toFixed(1) : "n/a");
    if (globeIndex && binCraft && !showTrace) {
        jQuery('#selected_message_count').prev().updateText('Receivers:');
        jQuery('#selected_message_count').prop('title', 'Number of receivers receiving this aircraft');
        if (selected.receiverCount >= 5 && selected.dataSource != 'mlat') {
            jQuery('#selected_message_count').updateText('> ' + selected.receiverCount);
        } else {
            jQuery('#selected_message_count').updateText(selected.receiverCount);
        }
    } else {
        jQuery('#selected_message_count').prev().updateText('Messages:');
        jQuery('#selected_message_count').prop('title', 'The total number of messages received from this aircraft');
        jQuery('#selected_message_count').updateText(selected.messages);
    }
    jQuery('#selected_message_rate').updateText((selected.messageRate != null) ? (selected.messageRate.toFixed(1)) : "n/a");
    jQuery('#selected_photo_link').html(getPhotoLink(selected));

    jQuery('#selected_altitude_geom1').updateText(format_altitude_long(selected.alt_geom, selected.geom_rate, DisplayUnits));
    jQuery('#selected_altitude_geom2').updateText(format_altitude_long(selected.alt_geom, selected.geom_rate, DisplayUnits));
    jQuery('#selected_ias').updateText(format_speed_long(selected.ias, DisplayUnits));
    jQuery('#selected_tas').updateText(format_speed_long(selected.tas, DisplayUnits));
    if (selected.mach == null) {
        jQuery('#selected_mach').updateText('n/a');
    } else {
        jQuery('#selected_mach').updateText(selected.mach.toFixed(3));
    }
    if (selected.roll == null) {
        jQuery('#selected_roll').updateText('n/a');
    } else {
        jQuery('#selected_roll').updateText(selected.roll.toFixed(1));
    }
    if (selected.track_rate == null) {
        jQuery('#selected_trackrate').updateText('n/a');
    } else {
        jQuery('#selected_trackrate').updateText(selected.track_rate.toFixed(2));
    }
    jQuery('#selected_geom_rate').updateText(format_vert_rate_long(selected.geom_rate, DisplayUnits));
    if (selected.nav_qnh == null) {
        jQuery('#selected_nav_qnh').updateText("n/a");
    } else {
        jQuery('#selected_nav_qnh').updateText(selected.nav_qnh.toFixed(1) + " hPa");
    }
    jQuery('#selected_nav_altitude').updateText(format_altitude_long(selected.nav_altitude, 0, DisplayUnits));
    jQuery('#selected_nav_heading').updateText(format_track_brief(selected.nav_heading));
    if (selected.nav_modes == null) {
        jQuery('#selected_nav_modes').updateText("n/a");
    } else {
        jQuery('#selected_nav_modes').updateText(selected.nav_modes.join());
    }
    if (selected.nic_baro == null) {
        jQuery('#selected_nic_baro').updateText("n/a");
    } else {
        if (selected.nic_baro == 1) {
            jQuery('#selected_nic_baro').updateText("cross-checked");
        } else {
            jQuery('#selected_nic_baro').updateText("not cross-checked");
        }
    }

    jQuery('#selected_nac_p').updateText(format_nac_p(selected.nac_p));
    jQuery('#selected_nac_v').updateText(format_nac_v(selected.nac_v));
    if (selected.rc == null) {
        jQuery('#selected_rc').updateText("n/a");
    } else if (selected.rc == 0) {
        jQuery('#selected_rc').updateText("unknown");
    } else {
        jQuery('#selected_rc').updateText(format_distance_short(selected.rc, DisplayUnits));
    }

    if (selected.sil == null || selected.sil_type == null) {
        jQuery('#selected_sil').updateText("n/a");
    } else {
        let sampleRate = "";
        let silDesc = "";
        if (selected.sil_type == "perhour") {
            sampleRate = " per flight hour";
        } else if (selected.sil_type == "persample") {
            sampleRate = " per sample";
        }

        switch (selected.sil) {
            case 0:
                silDesc = "&gt; 1e-3";
                break;
            case 1:
                silDesc = "≤ 1e-3";
                break;
            case 2:
                silDesc = "≤ 1e-5";
                break;
            case 3:
                silDesc = "≤ 1e-7";
                break;
            default:
                silDesc = "n/a";
                sampleRate = "";
                break;
        }
        jQuery('#selected_sil').html(silDesc + sampleRate);
    }

    if (selected.version == null) {
        jQuery('#selected_version').updateText('none');
    } else if (selected.version == 0) {
        jQuery('#selected_version').updateText('v0 (DO-260)');
    } else if (selected.version == 1) {
        jQuery('#selected_version').updateText('v1 (DO-260A)');
    } else if (selected.version == 2) {
        jQuery('#selected_version').updateText('v2 (DO-260B)');
    } else {
        jQuery('#selected_version').updateText('v' + selected.version);
    }

    adjustInfoBlock();
}

let somethingHighlighted = false;
function refreshHighlighted() {
    // this is following nearly identical logic, etc, as the refreshSelected function, but doing less junk for the highlighted pane
    let highlighted = HighlightedPlane;

    if (!highlighted) {
        if (somethingHighlighted)
            jQuery('#highlighted_infoblock').hide();
        somethingHighlighted = false;
        return;
    }
    somethingHighlighted = true;

    highlighted.checkVisible();

    jQuery('#highlighted_infoblock').show();

    let infoBox = jQuery('#highlighted_infoblock');

    let marker = highlighted.marker || highlighted.glMarker;
    let geom;
    let markerCoordinates;
    if (!marker || !(geom = marker.getGeometry()) || !(markerCoordinates = geom.getCoordinates()) ) {
        jQuery('#highlighted_infoblock').hide();
        return;
    }
    let markerPosition = OLMap.getPixelFromCoordinate(markerCoordinates);
    if (!markerPosition)
        return;

    let mapSize = OLMap.getSize();
    if (markerPosition[0] + 200 < mapSize[0])
        infoBox.css("left", markerPosition[0] + 20);
    else
        infoBox.css("left", markerPosition[0] - 200);
    if (markerPosition[1] + 250 < mapSize[1])
        infoBox.css("top", markerPosition[1] + 50);
    else
        infoBox.css("top", markerPosition[1] - 250);

    jQuery('#highlighted_callsign').text(highlighted.name);

    if (highlighted.icaoType !== null) {
        jQuery('#highlighted_icaotype').text(highlighted.icaoType);
    } else {
        jQuery('#highlighted_icaotype').text("n/a");
    }

    jQuery('#highlighted_source').text(format_data_source(highlighted.getDataSource()));

    if (highlighted.registration !== null) {
        jQuery('#highlighted_registration').text(highlighted.registration);
    } else {
        jQuery('#highlighted_registration').text("n/a");
    }

    jQuery('#highlighted_speed').text(format_speed_long(highlighted.gs, DisplayUnits));

    jQuery("#highlighted_altitude").text(format_altitude_long(highlighted.altitude, highlighted.vert_rate, DisplayUnits));

    jQuery('#highlighted_pf_route').text((highlighted.pfRoute ? highlighted.pfRoute : highlighted.icao.toUpperCase()));

    jQuery('#highlighted_rssi').text(highlighted.rssi != null ? highlighted.rssi.toFixed(1) + ' dBFS' : "n/a");
}

function removeHighlight() {
    HighlightedPlane = null;
    refreshHighlighted();
}

function refreshFeatures() {
    for (let i in PlanesOrdered) {
        PlanesOrdered[i].updateFeatures(true);
    }
}

//
// Planes table begin
//
(function (global, jQuery, TAR) {
    let planeMan = TAR.planeMan = TAR.planeMan || {};

    function compareAlpha(xa,ya) {
        if (xa === ya)
            return 0;
        if (xa < ya)
            return -1;
        return 1;
    }

    function compareBeta(xa, ya) {
        if (xa === ya)
            return 0;
        if (sortAscending && xa < ya)
            return -1;
        if (!sortAscending && (xa.replace(/ /g, "").split("").reverse().join("") > ya.replace(/ /g, "").split("").reverse().join("")))
            return -1;
        return 1;
    }

    function compareNumeric(xf,yf) {
        if (Math.abs(xf - yf) < 1e-9)
            return 0;

        return xf - yf;
    }

    const cols = planeMan.cols = {};

    cols.icao = {
        text: 'Hex id',
        sort: function () { sortBy('icao', compareAlpha, function(x) { return x.icao; }); },
        value: function(plane) { return plane.icao; },
        td: '<td class="icaoCodeColumn">',
    };
    cols.flag = {
        text: 'Flag',
        header: function() { return ""; },
        sort: function () { sortBy('country', compareAlpha, function(x) { return x.icaorange.country; }); },
        value: function(plane) { return (plane.icaorange.flag_image ? ('<img width="20" height="12" style="display: block;margin: auto;" src="' + FlagPath + plane.icaorange.flag_image + '" title="' + plane.icaorange.country + '"></img>') : ''); },
        hStyle: 'style="width: 20px; padding: 3px;"',
        html: true,
    };
    cols.flight = {
        sort: function () { sortBy('flight', compareAlpha, function(x) { return x.flight }); },
        value: function(plane) {
            if (flightawareLinks)
                return getFlightAwareModeSLink(plane.icao, plane.flight, plane.name);
            return plane.name;
        },
        html: flightawareLinks,
        text: 'Callsign' };
    cols.registration = {
        sort: function () { sortBy('registration', compareAlpha, function(x) { return x.registration; }); },
        value: function(plane) { return (flightawareLinks ? getFlightAwareIdentLink(plane.registration, plane.registration) : (plane.registration ? plane.registration : "")); },
        html: flightawareLinks,
        text: 'Registration' };
    cols.aircraft_type = {
        sort: function () { sortBy('type', compareAlpha, function(x) { return x.icaoType; }); },
        value: function(plane) { return (plane.icaoType != null ? plane.icaoType : ""); },
        text: 'Type' };
    cols.squawk = {
        text: 'Squawk',
        sort: function () { sortBy('squawk', compareAlpha, function(x) { return x.squawk; }); },
        value: function(plane) { return (plane.squawk != null ? plane.squawk : ""); },
        align: 'right' };
    cols.altitude = {
        text: 'Altitude',
        sort: function () { sortBy('altitude',compareNumeric, function(x) { return (x.altitude == "ground" ? -100000 : x.altitude); }); },
        value: function(plane) { return format_altitude_brief(plane.altitude, plane.vert_rate, DisplayUnits); },
        align: 'right',
        header: function () { return 'Altitude(' + get_unit_label("altitude", DisplayUnits) + ')';},
    };
    cols.speed = {
        text: pTracks ? 'Max. Speed' : 'Speed',
        sort: function () { sortBy('speed', compareNumeric, function(x) { return x.speed; }); },
        value: function(plane) { return format_speed_brief(plane.speed, DisplayUnits); },
        align: 'right',
        header: function () { return (pTracks ? 'Max. ' : '') + 'Spd(' + get_unit_label("speed", DisplayUnits) + ')';},
    };
    cols.vert_rate = {
        text: 'Vertical Rate',
        sort: function () { sortBy('vert_rate', compareNumeric, function(x) { return x.vert_rate; }); },
        value: function(plane) { return format_vert_rate_brief(plane.vert_rate, DisplayUnits); },
        align: 'right',
        header: function () { return 'V. Rate(' + get_unit_label("verticalRate", DisplayUnits) + ')';},
    };
    cols.distance = {
        text: pTracks ? 'Max. Distance' : 'Distance',
        sort: function () { sortBy('sitedist',compareNumeric, function(x) { return x.sitedist; }); },
        value: function(plane) { return format_distance_brief(plane.sitedist, DisplayUnits); },
        align: 'right',
        header: function () { return (pTracks ? 'Max. ' : '') + 'Dist.(' + get_unit_label("distance", DisplayUnits) + ')';},
    };
    cols.track = {
        text: 'Track',
        sort: function () { sortBy('track', compareNumeric, function(x) { return x.track; }); },
        value: function(plane) { return format_track_brief(plane.track); },
        align: 'right' };
    cols.msgs = {
        text: 'Messages',
        sort: function () { sortBy('msgs', compareNumeric, function(x) { return x.messages; }); },
        value: function(plane) { return plane.messages; },
        align: 'right' };
    cols.seen = {
        text: 'Seen',
        sort: function () { sortBy('seen', compareNumeric, function(x) { return x.seen; }); },
        value: function(plane) { return plane.seen.toFixed(0); },
        align: 'right' };
    cols.rssi = {
        text: 'RSSI',
        sort: function () { sortBy('rssi', compareNumeric, function(x) { return x.rssi; }); },
        value: function(plane) { return (plane.rssi != null ? plane.rssi.toFixed(1) : ""); },
        align: 'right' };
    cols.lat = {
        text: 'Latitude',
        sort: function () { sortBy('lat', compareNumeric, function(x) { return (x.position !== null ? x.position[1] : null); }); },
        value: function(plane) { return (plane.position != null ? plane.position[1].toFixed(4) : ""); },
        align: 'right' };
    cols.lon = {
        text: 'Longitude',
        sort: function () { sortBy('lon', compareNumeric, function(x) { return (x.position !== null ? x.position[0] : null); }); },
        value: function(plane) { return (plane.position != null ? plane.position[0].toFixed(4) : ""); },
        align: 'right' };
    cols.data_source = {
        text: 'Source',
        sort: function () { sortBy('data_source', compareNumeric, function(x) { return x.getDataSourceNumber(); } ); },
        value: function(plane) { return format_data_source(plane.getDataSource()); },
        align: 'right' };
    cols.military = {
        text: 'Mil.',
        sort: function () { sortBy('military', compareAlpha, function(x) { return (x.military ? 'yes' : 'no'); } ); },
        value: function(plane) { return (plane.military ? 'yes' : 'no'); },
        align: 'right' };
    cols.wd = {
        text: 'Wind D',
        sort: function () { sortBy('wd', compareNumeric, function(x) { return plane.wd; }); },
        value: function(plane) { return plane.wd != null ? (plane.wd + '°') : ''; },
        align: 'right' };
    cols.ws = {
        text: 'Wind speed',
        sort: function () { sortBy('ws', compareNumeric, function(x) { return x.ws; }); },
        value: function(plane) { return format_speed_brief(plane.ws, DisplayUnits); },
        align: 'right',
        header: function () { return 'Wind(' + get_unit_label("speed", DisplayUnits) + ')';},
    };

    const colsEntries = Object.entries(cols);
    for (let i in colsEntries) {
        let key = colsEntries[i][0];
        let value = colsEntries[i][1];
        value.id = key;
        value.text = value.text ? value.text : "";
        value.header = value.header ? value.header : function() { return value.text; };
        value.hStyle = value.hStyle ? value.hStyle : "";
        if (!value.td)
            value.td = value.align ? ('<td style="text-align: ' + value.align + '">') : '<td>';
    }

    let columns = createOrderedColumns();
    let activeCols = null;

    let initializing = true;

    let planeRowTemplate = null;
    planeMan.lastRenderExtent = null;
    let htmlTable = null;
    let tbody = null;

    planeMan.init = function () {
        // initialize columns
        htmlTable = document.getElementById('planesTable');
        for (let i in columns) {
            let col = columns[i];
            col.visible = true;
            col.toggleKey = 'column_' + col.id;

            if (HideCols.includes('#' + col.id)) {
                planeMan.setColumnVis(col.id, false);
            }
        }

        createColumnToggles();

        if (!ShowFlags) {
            planeMan.setColumnVis('flag', false);
        }

        planeMan.redraw();
        initializing = false;
    }

    planeMan.redraw = function () {
        activeCols = [];
        for (let i in columns) {
            let col = columns[i];
            if (col.visible || !mapIsVisible) {
                activeCols.push(col);
            }
        }
        for (let i = 0; i < PlanesOrdered.length; ++i) {
            PlanesOrdered[i].destroyTR();
        }
        let table = '';
        table += '<thead class="aircraft_table_header">';
        table += '  <tr>';
        for (let i in activeCols) {
            let col = activeCols[i];
            table += '<td id="' + col.id + '" onclick="TAR.planeMan.cols.' + col.id + '.sort();"' + col.hStyle + '>'+ col.header() +'</td>';
        }
        table += '  </tr>';
        table += '</thead>';
        table += '<tbody>';
        table += '</tbody>';
        htmlTable.innerHTML = table;
        tbody = htmlTable.tBodies[0];

        planeRowTemplate = document.createElement('tr');
        let template = ''
        for (let i in activeCols) {
            let col = activeCols[i];
            template += col.td;
            template += '</td>';
        }
        planeRowTemplate.innerHTML = template;

        planeMan.refresh();
    }

    planeMan.setColumnVis = function (col, visible) {
        cols[col].visible = visible;

        if (!initializing)
            planeMan.redraw();
    }

    // Refreshes the larger table of all the planes
    planeMan.refresh = function () {
        if (initializing)
            return;

        const ctime = false; // gets enabled for debugging table refresh speed
        // globeTableLimit = 1000; for testing performance

        ctime && console.time("planeMan.refresh()");


        if (mapIsVisible || planeMan.lastRenderExtent === null) {
            const size = [OLMap.getSize()[0] + 45, OLMap.getSize()[1] + 45];
            planeMan.lastRenderExtent = myExtent(OLMap.getView().calculateExtent(size));
        }

        TrackedAircraft = 0;
        TrackedAircraftPositions = 0;
        TrackedHistorySize = 0;

        ctime && console.time("inView");
        let pList = []; // list of planes that might go in the table and need sorting
        for (let i = 0; i < PlanesOrdered.length; ++i) {
            const plane = PlanesOrdered[i];

            plane.visible = plane.checkVisible() && !plane.isFiltered()
            plane.inView = inView(plane.position, planeMan.lastRenderExtent);

            TrackedHistorySize += plane.history_size;

            if (tableInView) {
                if (plane.visible)
                    TrackedAircraft++;
                if ((plane.inView && plane.visible) || plane.selected) {
                    pList.push(plane);
                    TrackedAircraftPositions++;
                }
            } else {
                if (plane.visible) {
                    TrackedAircraft++;
                    pList.push(plane);
                    if (plane.position != null)
                        TrackedAircraftPositions++;
                }
            }
        }
        ctime && console.timeEnd("inView");

        ctime && console.time("resortTable");
        resortTable(pList);
        ctime && console.timeEnd("resortTable");

        const sidebarVisible = toggles['sidebar_visible'].state;

        let inTable = []; // list of planes that will actually be displayed in the table

        ctime && console.time("modTRs");
        for (let i in pList) {
            const plane = pList[i];

            if (!sidebarVisible || (inTable.length > globeTableLimit && mapIsVisible && globeIndex)) {
                break;
            }
            inTable.push(plane);

            if (plane.tr == null) {
                plane.makeTR(planeRowTemplate.cloneNode(true));
                plane.tr.id = plane.icao;
                plane.refreshTR = 0;
            }

            if (now - plane.refreshTR > 5 || plane.selected != plane.selectCache) {
                plane.refreshTR = now;
                let colors = tableColors.unselected;
                let bgColor = "#F8F8F8"

                plane.selectCache = plane.selected;
                if (plane.selected)
                    colors = tableColors.selected;

                if (plane.dataSource && plane.dataSource in colors)
                    bgColor = colors[plane.dataSource];

                if (plane.squawk in tableColors.special) {
                    bgColor = tableColors.special[plane.squawk];
                    plane.bgColorCache = bgColor;
                    plane.tr.style = "background-color: " + bgColor + "; color: black;";
                } else if (plane.bgColorCache != bgColor) {
                    plane.bgColorCache = bgColor;
                    plane.tr.style = "background-color: " + bgColor + ";";
                }

                for (let cell in activeCols) {
                    let col = activeCols[cell];
                    if (!col.value)
                        continue;
                    let newValue = col.value(plane);
                    if (newValue != plane.trCache[cell]) {
                        plane.trCache[cell] = newValue;
                        if (col.html) {
                            plane.tr.cells[cell].innerHTML = newValue;
                        } else {
                            plane.tr.cells[cell].textContent = newValue;
                        }
                    }
                }
            }
        }
        ctime && console.timeEnd("modTRs");

        global.refreshPageTitle();
        jQuery('#dump1090_total_history').updateText(TrackedHistorySize);
        jQuery('#dump1090_message_rate').updateText(MessageRate === null ? 'n/a' : MessageRate.toFixed(1));
        jQuery('#dump1090_total_ac').updateText(globeIndex ? globeTrackedAircraft : TrackedAircraft);
        jQuery('#dump1090_total_ac_positions').updateText(TrackedAircraftPositions);



        ctime && console.time("DOM1");

        let newBody = document.createElement('tbody');
        for (let i in inTable) {
            const plane = inTable[i];
            newBody.appendChild(plane.tr);
        }

        ctime && console.timeEnd("DOM1");
        ctime && console.time("DOM2");

        htmlTable.replaceChild(newBody, tbody);
        tbody = newBody;

        ctime && console.timeEnd("DOM2");

        ctime && console.timeEnd("planeMan.refresh()");
    }

    //
    // ---- table sorting begin ----
    //

    let sortId = '';
    let sortCompare = null;
    let sortExtract = null;
    let sortAscending = true;

    function sortFunction(x,y) {
        const xv = x._sort_value;
        const yv = y._sort_value;

        // always sort missing values at the end, regardless of
        // ascending/descending sort
        if (xv == null && yv == null) return x._sort_pos - y._sort_pos;
        if (xv == null) return 1;
        if (yv == null) return -1;

        const c = sortAscending ? sortCompare(xv,yv) : sortCompare(yv,xv);
        if (c !== 0) return c;

        return x._sort_pos - y._sort_pos;
    }

    function resortTable(pList) {
        if (!sortExtract)
            return;
        if (globeIndex) {
            // don't presort for globeIndex
        }
        // presort by dataSource
        else if (sortId == "sitedist") {
            for (let i = 0; i < pList.length; ++i) {
                pList[i]._sort_pos = i;
            }
            pList.sort(function(x,y) {
                const a = x.getDataSourceNumber();
                const b = y.getDataSourceNumber();
                if (a == b)
                    return (x._sort_pos - y._sort_pos);

                return (a-b);
            });
        }
        // or distance
        else if (sortId == "data_source") {
            pList.sort(function(x,y) {
                return (x.sitedist - y.sitedist);
            });
        }
        // or longitude
        else {
            pList.sort(function(x,y) {
                return (x.position ? x.position[0] : 500) - (y.position ? y.position[0] : 500);
            });
        }

        // number the existing rows so we can do a stable sort
        // regardless of whether sort() is stable or not.
        // Also extract the sort comparison value.
        if (globeIndex) {
            for (let i = 0; i < pList.length; ++i) {
                pList[i]._sort_pos = pList[i].numHex;
                pList[i]._sort_value = sortExtract(pList[i]);
            }
        } else {
            for (let i = 0; i < pList.length; ++i) {
                pList[i]._sort_pos = i;
                pList[i]._sort_value = sortExtract(pList[i]);
            }
        }

        pList.sort(sortFunction);

        // In multiSelect put selected planes on top, do a stable sort!
        if (multiSelect) {
            for (let i = 0; i < pList.length; ++i) {
                pList[i]._sort_pos = i;
            }
            pList.sort(function(x,y) {
                if (x.selected && y.selected) {
                    return (x._sort_pos - y._sort_pos);
                }
                if (x.selected)
                    return -1;
                if (y.selected)
                    return 1;

                return (x._sort_pos - y._sort_pos);
            });
        }
    }

    function sortBy(id, sc, se) {
        if (id != 'data_source' && grouptype_checkbox) {
            jQuery('#grouptype_checkbox').removeClass('settingsCheckboxChecked');
            grouptype_checkbox = false;
        } else if (id == 'data_source' && !grouptype_checkbox) {
            jQuery('#grouptype_checkbox').addClass('settingsCheckboxChecked');
            grouptype_checkbox = true;
        }

        if (id === sortId) {
            sortAscending = !sortAscending;
            PlanesOrdered.reverse(); // this correctly flips the order of rows that compare equal
        } else {
            sortAscending = true;
        }

        sortId = id;
        sortCompare = sc;
        sortExtract = se;

        planeMan.refresh();
    }

    //
    // ---- table sorting end ----
    //

    function createColumnToggles() {
        const prefix = 'dd_';
        const sortableColumns = jQuery('#sortableColumns').sortable({
            update: function (event, ui) {
                const order = [];
                jQuery('#sortableColumns li').each(function (e) {
                    order.push(jQuery(this).attr('id').replace(prefix, ''));
                });

                loStore['columnOrder'] = JSON.stringify(order);
                columns = createOrderedColumns();

                planeMan.redraw();
            }
        });

        for (let col of columns) {
            sortableColumns.append(`<li class="ui-state-default" id="${prefix + col.id}"></li>`);

            new Toggle({
                key: col.toggleKey,
                display: col.text,
                container: jQuery(`#${prefix + col.id}`),
                init: col.visible,
                setState: function (state) {
                    planeMan.setColumnVis(col.id, state);
                }
            });
        }
    }

    function createOrderedColumns() {
        const order = loStore['columnOrder'];
        if (order !== undefined) {
            const columns = [];
            for (let col of JSON.parse(order)) {
                const column = cols[col];
                if (column !== undefined) {
                    columns.push(column);
                }
            }
            if (columns.length > 0) {
                return columns;
            }
        }
        return Object.values(cols);
    }

    return TAR;
}(window, jQuery, TAR || {}));
//
// Planes table end
//

function deselect(plane) {
    if (!plane || !plane.selected)
        return;
    plane.selected = false;
    const index = SelPlanes.indexOf(plane);
    if (index > -1)
        SelPlanes.splice(index, 1);
    if (plane == SelectedPlane) {
        sp = SelectedPlane = null;
        refreshSelected();
    }

    plane.updateTick('redraw');
}
let scount = 0;
function select(plane, options) {
    if (!plane)
        return;
    options = options || {};
    //console.log("select()", plane.icao, options);
    plane.selected = true;
    if (!SelPlanes.includes(plane))
        SelPlanes.push(plane);

    sp = SelectedPlane = plane;
    updateAddressBar();
    refreshSelected();
    plane.updateTick('redraw');

    if (options.follow) {
        toggleFollow(true);
        if (!options.zoom)
            options.zoom = 'follow';
    } else {
        toggleFollow(false);
    }
}

function selectPlaneByHex(hex, options) {
    active();
    console.log("SELECTING", hex, options);
    options = options || {};
    //console.log("select: " + hex);
    // If SelectedPlane has something in it, clear out the selected
    if (SelectedAllPlanes) {
        deselectAllPlanes();
    }
    // already selected plane
    let oldPlane = SelectedPlane;
    // plane to be selected
    let newPlane = Planes[hex];

    if (!options.noFetch && globeIndex && hex)
        newPlane = getTrace(newPlane, hex, options);

    // If we are clicking the same plane, we are deselecting it unless noDeselect is specified
    if (oldPlane == newPlane && (options.noDeselect || showTrace)) {
        oldPlane = null;
    } else {
        if (multiSelect) {
            // multiSelect deselect
            if (newPlane && newPlane.selected && !onlySelected) {
                deselect(newPlane);
                newPlane = null;
                hex = null;
            }
        } else if (oldPlane) {
            // normal deselect
            if (oldPlane != newPlane) {
                deselect(oldPlane);
                oldPlane = null;
            }
            if (oldPlane == newPlane) {
                deselect(newPlane);
                oldPlane = null;
                newPlane = null;
                hex = null;
            }
        }
    }

    // Assign the new selected
    select(newPlane, options);

    if (!newPlane) {
        toggleFollow(false);
    }

    if (options.zoom == 'follow') {
        //if (OLMap.getView().getZoom() < 8)
        //    OLMap.getView().setZoom(8);
    } else if (options.zoom) {
        OLMap.getView().setZoom(options.zoom);
    }

    pTracks || TAR.planeMan.refresh();

    return newPlane !== undefined;
}

// loop through the planes and mark them as selected to show the paths for all planes
function selectAllPlanes() {
    HighlightedPlane = null;
    // if all planes are already selected, deselect them all
    if (SelectedAllPlanes) {
        deselectAllPlanes();
        return;
    }
    buttonActive('#T', true);
    // If SelectedPlane has something in it, clear out the selected
    if (SelectedPlane)
        deselect(SelectedPlane);

    toggleIsolation("off");

    SelectedAllPlanes = true;

    if (globeIndex) {
        for (let i in PlanesOrdered) {
            let plane = PlanesOrdered[i];
            if (plane.visible && plane.inView)
                plane.processTrace();
        }
    }
    refreshFeatures();

    jQuery('#selectall_checkbox').addClass('settingsCheckboxChecked');

    refreshSelected();
    refreshHighlighted();
    pTracks || TAR.planeMan.refresh();
}

// deselect all the planes
function deselectAllPlanes(keepMain) {
    if (showTrace && !keepMain)
        return;
    if (!multiSelect && SelectedPlane)
        toggleIsolation("off");

    clearTimeout(getTraceTimeout);

    if (SelectedAllPlanes) {
        buttonActive('#T', false);
        jQuery('#selectall_checkbox').removeClass('settingsCheckboxChecked');
        SelectedAllPlanes = false;
        refreshFilter();
        return;
    }

    let bounce = [];
    for (let i in SelPlanes) {
        const plane = SelPlanes[i];
        if (keepMain && plane == SelectedPlane)
            continue;
        bounce.push(plane);
    }
    for (let i in bounce) {
        deselect(bounce[i]);
    }
    refreshFilter();
    updateAddressBar();
}

function toggleFollow(override) {
    if (override == true)
        FollowSelected = true;
    else if (override == false)
        FollowSelected = false;
    else
        FollowSelected = !FollowSelected;

    traceOpts.follow = FollowSelected;

    if (FollowSelected) {
        if (!SelectedPlane || !SelectedPlane.position)
            FollowSelected = false;
    }
    if (FollowSelected) {
        //if (override == undefined && OLMap.getView().getZoom() < 8)
        //    OLMap.getView().setZoom(8);
        SelectedPlane.setProjection('follow');
    }
    buttonActive('#F', FollowSelected);
}

function resetMap() {
    if (SitePosition) {
        CenterLon = SiteLon;
        CenterLat = SiteLat;
    } else {
        CenterLon = DefaultCenterLon;
        CenterLat = DefaultCenterLat;
    }
    // Reset loStore values and map settings
    loStore['CenterLat'] = CenterLat
    loStore['CenterLon'] = CenterLon
    //loStore['ZoomLvl']   = ZoomLvl = DefaultZoomLvl;

    // Set and refresh
    //OLMap.getView().setZoom(ZoomLvl);
    OLMap.getView().setCenter(ol.proj.fromLonLat([CenterLon, CenterLat]));
    OLMap.getView().setRotation(mapOrientation);

    //selectPlaneByHex(null,false);
    jQuery("#update_error").css('display','none');
    geoFindMe();
}

function updateMapSize() {
    if (OLMap)
        OLMap.updateSize();
}

function expandSidebar(e) {
    e.preventDefault();
    jQuery("#map_container").hide()
    mapIsVisible = false;
    jQuery("#toggle_sidebar_control").hide();
    jQuery("#splitter").hide();
    jQuery("#shrink_sidebar_button").show();
    jQuery("#sidebar_container").width("100%");
    TAR.planeMan.redraw();
    updateMapSize();
    adjustInfoBlock();
}

function showMap() {
    jQuery('#sidebar_container').width(loStore['sidebar_width']).css('margin-left', '0');
    jQuery("#map_container").show()
    mapIsVisible = true;
    jQuery("#toggle_sidebar_control").show();
    jQuery("#splitter").show();
    jQuery("#shrink_sidebar_button").hide();
    TAR.planeMan.redraw();
    updateMapSize();
}


let selectedPhotoCache = null;

function setPhotoHtml(source) {
    if (selectedPhotoCache == source)
        return;
    //console.log(source + ' ' + selectedPhotoCache);
    selectedPhotoCache = source;
    jQuery('#selected_photo').html(source);
}

function adjustInfoBlock() {
    if (wideInfoBlock ) {
        infoBlockWidth = baseInfoBlockWidth + 40;
    } else {
        infoBlockWidth = baseInfoBlockWidth;
    }
    jQuery('#selected_infoblock').css("width", infoBlockWidth * globalScale + 'px');

    jQuery('.ol-scale-line').css('left', (infoBlockWidth * globalScale + 8) + 'px');
    jQuery('#replayBar').css('left', (infoBlockWidth * globalScale + 8) + 'px');

    if (SelectedPlane && toggles['selectedDetails'].state) {

        if (!mapIsVisible)
            jQuery("#sidebar_container").css('margin-left', '140pt');
        //jQuery('#sidebar_canvas').css('margin-bottom', jQuery('#selected_infoblock').height() + 'px');
        //
        if (mapIsVisible && document.getElementById('map_canvas').clientWidth < parseFloat(jQuery('#selected_infoblock').css('width')) * 3) {
            jQuery('#selected_infoblock').css('height', '290px');
            jQuery('#selected_typedesc').parent().parent().hide();
            jQuery('#credits').css('bottom', '295px');
            jQuery('#credits').css('left', '5px');
        } else {
            jQuery('#selected_infoblock').css('height', '100%');
            jQuery('#credits').css('bottom', '');
            jQuery('#credits').css('left', '');
        }

        jQuery('#selected_infoblock').show();
    } else {
        if (!mapIsVisible)
            jQuery("#sidebar_container").css('margin-left', '0');
        //jQuery('#sidebar_canvas').css('margin-bottom', 0);

        jQuery('.ol-scale-line').css('left', '8px');
        jQuery('#replayBar').css('left', '0px');
        jQuery('#credits').css('bottom', '');
        jQuery('#credits').css('left', '');

        jQuery('#selected_infoblock').hide();
    }

    let photoWidth = document.getElementById('photo_container').clientWidth;
    let refWidth = infoBlockWidth * globalScale - 29;
    if (Math.abs(photoWidth / refWidth - 1) > 0.05)
        photoWidth = refWidth;

    jQuery('#airplanePhoto').css("width", photoWidth + 'px');
    jQuery('#selected_photo').css("width", photoWidth + 'px');

    if (showPictures) {
        if (planespottersAPI || planespottingAPI) {
            jQuery('#photo_container').css('height', photoWidth * 0.883 + 'px');
        } else {
            jQuery('#photo_container').css('height', '40px');
        }
    }
}

function initializeUnitsSelector() {
    // Get display unit preferences from local storage
    if (!loStore.getItem('displayUnits')) {
        loStore['displayUnits'] = 'nautical';
    }

    DisplayUnits = loStore['displayUnits'];

    // Initialize drop-down
    jQuery('#units_selector')
        .val(DisplayUnits)
        .on('change', onDisplayUnitsChanged);

    jQuery(".altitudeUnit").text(get_unit_label("altitude", DisplayUnits));
    jQuery(".speedUnit").text(get_unit_label("speed", DisplayUnits));
    jQuery(".distanceUnit").text(get_unit_label("distance", DisplayUnits));
    jQuery(".verticalRateUnit").text(get_unit_label("verticalRate", DisplayUnits));
}

function onDisplayUnitsChanged(e) {
    loStore['displayUnits'] = DisplayUnits = e.target.value;

    TAR.altitudeChart.render();

    // Update filters
    updateAltFilter();

    // Refresh data
    refreshFilter();

    // Draw range rings
    if (siteCircleLayer.getVisible()) {
        drawSiteCircle();
    }

    // Reset map scale line units
    OLMap.getControls().forEach(function(control) {
        if (control instanceof ol.control.ScaleLine) {
            control.setUnits(DisplayUnits);
        }
    });

    jQuery(".altitudeUnit").text(get_unit_label("altitude", DisplayUnits));
    jQuery(".speedUnit").text(get_unit_label("speed", DisplayUnits));
    jQuery(".distanceUnit").text(get_unit_label("distance", DisplayUnits));
    jQuery(".verticalRateUnit").text(get_unit_label("verticalRate", DisplayUnits));
    TAR.planeMan.redraw();

    remakeTrails();
    refreshSelected();
}

function onFilterByAltitude(e) {
    e.preventDefault();
    jQuery("#altitude_filter_min").blur();
    jQuery("#altitude_filter_max").blur();

    updateAltFilter();
    refreshFilter();
}

function refreshFilter() {
    if (filterTracks)
        remakeTrails();

    TAR.planeMan.refresh();
    refreshSelected();
    refreshHighlighted();
    mapRefresh(true);

    drawHeatmap();
    if (toggles.shareFilters && toggles.shareFilters.state) {
        updateAddressBar()
    }
}

function filterGroundVehicles(switchFilter) {
    if (typeof loStore['groundVehicleFilter'] === 'undefined') {
        loStore['groundVehicleFilter'] = 'not_filtered';
    }
    let groundFilter = loStore['groundVehicleFilter'];
    if (switchFilter === true) {
        groundFilter = (groundFilter === 'not_filtered') ? 'filtered' : 'not_filtered';
    }
    if (groundFilter === 'not_filtered') {
        jQuery('#groundvehicle_filter').addClass('settingsCheckboxChecked');
    } else {
        jQuery('#groundvehicle_filter').removeClass('settingsCheckboxChecked');
    }
    loStore['groundVehicleFilter'] = groundFilter;
    PlaneFilter.groundVehicles = groundFilter;
}

function filterBlockedMLAT(switchFilter) {
    if (typeof loStore['blockedMLATFilter'] === 'undefined') {
        loStore['blockedMLATFilter'] = 'not_filtered';
    }
    let blockedMLATFilter = loStore['blockedMLATFilter'];
    if (switchFilter === true) {
        blockedMLATFilter = (blockedMLATFilter === 'not_filtered') ? 'filtered' : 'not_filtered';
    }
    if (blockedMLATFilter === 'not_filtered') {
        jQuery('#blockedmlat_filter').addClass('settingsCheckboxChecked');
    } else {
        jQuery('#blockedmlat_filter').removeClass('settingsCheckboxChecked');
    }
    loStore['blockedMLATFilter'] = blockedMLATFilter;
    PlaneFilter.blockedMLAT = blockedMLATFilter;
}

function buttonActive(id, state) {
    if (state) {
        jQuery(id).addClass('activeButton');
        jQuery(id).removeClass('inActiveButton');
    } else {
        jQuery(id).addClass('inActiveButton');
        jQuery(id).removeClass('activeButton');
    }
}

function toggleIsolation(state) {
    let prevState = onlySelected;
    if (showTrace && state !== "on")
        return;
    onlySelected = !onlySelected;
    if (state === "on")
        onlySelected = true;
    if (state === "off")
        onlySelected = false;

    buttonActive('#I', onlySelected);

    if (prevState != onlySelected)
        refreshFilter();
}

function toggleMilitary() {
    onlyMilitary = !onlyMilitary;
    buttonActive('#U', onlyMilitary);

    refreshFilter();
    active();
    if (onlyMilitary)
        fetchData({force: true});
}

function togglePersistence() {
    noVanish = !noVanish;
    //filterTracks = noVanish;

    buttonActive('#P', noVanish);

    remakeTrails();

    if (!noVanish)
        reaper();
    loStore['noVanish'] = noVanish;
    console.log('noVanish = ' + noVanish);

    refreshFilter();
}

function dim(evt) {
    try {
        const dim = mapDimPercentage * (1 + 0.25 * toggles['darkerColors'].state);
        const contrast = mapContrastPercentage * (1 + 0.1 * toggles['darkerColors'].state);
        if (dim > 0.0001) {
            evt.context.globalCompositeOperation = 'multiply';
            evt.context.fillStyle = 'rgba(0,0,0,'+dim+')';
            evt.context.fillRect(0, 0, evt.context.canvas.width, evt.context.canvas.height);
        } else if (dim < -0.0001) {
            evt.context.globalCompositeOperation = 'screen';
            console.log(evt.context.globalCompositeOperation);
            evt.context.fillStyle = 'rgba(255, 255, 255,'+(-dim)+')';
            evt.context.fillRect(0, 0, evt.context.canvas.width, evt.context.canvas.height);
        }
        if (contrast > 0.0001) {
            evt.context.globalCompositeOperation = 'overlay';
            evt.context.fillStyle = 'rgba(0,0,0,'+contrast+')';
            evt.context.fillRect(0, 0, evt.context.canvas.width, evt.context.canvas.height);
        } else if (contrast < -0.0001) {
            evt.context.globalCompositeOperation = 'overlay';
            evt.context.fillStyle = 'rgba(255, 255, 255,'+ (-contrast)+')';
            evt.context.fillRect(0, 0, evt.context.canvas.width, evt.context.canvas.height);
        }
        evt.context.globalCompositeOperation = 'source-over';
    } catch (error) {
        console.error(error);
    }
}
function invertMap(evt){
  const ctx=evt.context;
  ctx.globalCompositeOperation='difference';
  ctx.fillStyle = "white";
  ctx.globalAlpha = alpha;  // alpha 0 = no effect 1 = full effect
  ctx.fillRect(0, 0, evt.ctx.canvas.width, ctx.canvas.height);

  
}
//
// Altitude Chart begin
//
(function (global, jQuery, TAR) {
    let altitudeChart = TAR.altitudeChart = TAR.altitudeChart || {};

    function createLegendGradientStops() {
        const mapOffsetToAltitude = [[0.033, 500], [0.066, 1000], [0.126, 2000], [0.19, 4000], [0.253, 6000], [0.316, 8000], [0.38, 10000], [0.59, 20000], [0.79, 30000], [1, 40000]];

        let stops = '';
        for (let i in mapOffsetToAltitude) {
            let map = mapOffsetToAltitude[i];
            const color = altitudeColor(map[1]);
            stops += '<stop offset="' + map[0] + '" stop-color="hsl(' + color[0] + ',' + color[1] + '%,' + color[2] + '%)" />';
        }
        return stops;
    }

    function createLegendUrl(data) {
        jQuery(data).find('#linear-gradient').html(createLegendGradientStops());

        const svg = jQuery('svg', data).prop('outerHTML');

        return 'url("data:image/svg+xml;base64,' + global.btoa(svg) + '")';
    }

    function loadLegend() {
        let baseLegend = (DisplayUnits === 'metric') ? 'images/alt_legend_meters.svg' : 'images/alt_legend_feet.svg';

        jQuery.get(baseLegend, function (data) {
            jQuery('#altitude_chart_button').css("background-image", createLegendUrl(data));
        });
    }

    altitudeChart.render = function () {
        if (toggles['altitudeChart'].state) {
            loadLegend();
            jQuery('#altitude_chart').show();
        } else {
            jQuery('#altitude_chart').hide();
        }
    }

    altitudeChart.init = function () {
        new Toggle({
            key: "altitudeChart",
            display: "Altitude Chart",
            container: "#settingsRight",
            init: (onMobile ? false : true),
            setState: altitudeChart.render
        });
    }

    return TAR;
}(window, jQuery, TAR || {}));
//
// Altitude Chart end
//

function followRandomPlane() {
    if (showTrace)
        return;
    let this_one = null;
    let tired = 0;
    do {
        this_one = PlanesOrdered[Math.floor(Math.random()*PlanesOrdered.length)];
        if (!this_one || tired++ > 1000)
            break;
    } while ((this_one.isFiltered() && !onlySelected) || !this_one.position || (now - this_one.position_time > 30));
    //console.log(this_one.icao);
    if (this_one)
        selectPlaneByHex(this_one.icao, {follow: true});
}

function toggleTableInView(switchOn) {
    if (switchOn || (globeIndex && !icaoFilter)) {
        tableInView = true;
    } else {
        tableInView = !tableInView;
        TAR.planeMan.refresh();
    }
    loStore['tableInView'] = tableInView;

    jQuery('#with_positions').text(tableInView ? "On Screen:" : "With Position:");

    buttonActive('#V', tableInView);
}

function toggleLabels() {
    enableLabels = !enableLabels;
    loStore['enableLabels'] = enableLabels;
    for (let key in PlanesOrdered) {
        PlanesOrdered[key].updateMarker();
    }
    refreshFeatures();
    buttonActive('#L', enableLabels);

    if (showTrace)
        remakeTrails();
}

function toggleExtendedLabels(options) {
    if (isNaN(extendedLabels))
        extendedLabels = 0;

    options = options || {};
    if (!options.noIncrement) {
        extendedLabels++;
    }
    extendedLabels %= 4;
    //console.log(extendedLabels);
    loStore['extendedLabels'] = extendedLabels;
    for (let key in PlanesOrdered) {
        PlanesOrdered[key].updateMarker();
    }
    buttonActive('#O', extendedLabels);
}

function toggleTrackLabels() {
    trackLabels = !trackLabels;
    loStore['trackLabels'] = trackLabels;

    remakeTrails();

    buttonActive('#K', trackLabels);
}

function toggleMultiSelect(newState) {
    let prevState = multiSelect;
    multiSelect = !multiSelect;

    if (newState == "on")
        multiSelect = true;
    if (newState == "off")
        multiSelect = false;

    if (!multiSelect) {
        if (!SelectedPlane)
            toggleIsolation("off");
        if (prevState != multiSelect)
            deselectAllPlanes("keepMain");
    }

    buttonActive('#M', multiSelect);
}

function onJump(e) {
    toggleFollow(false);
    if (e) {
        e.preventDefault();
        onJumpInput = jQuery("#jump_input").val();
        jQuery("#jump_input").val("");
        jQuery("#jump_input").blur();
    }
    let coords = null;
    let airport = null;
    if (onJumpInput.indexOf(",") >= 0) {
        let values = onJumpInput.split(',');
        if (!values || values.length != 2) {
            showSearchWarning('Input format decimal coordinates: LATI.TUDE, LONGI.TUDE');
        }
        coords = [parseFloat(values[0]), parseFloat(values[1])];
    } else {
        airport = onJumpInput.trim().toUpperCase();
    }
    if (airport) {
        if (!_airport_coords_cache) {
            jQuery.getJSON(databaseFolder + "/airport-coords.js")
                .done(function(data) {
                    _airport_coords_cache = data;
                    onJump();
                });
            return;
        }
        coords = _airport_coords_cache[airport];
    }
    if (coords) {
        console.log("jumping to: " + coords[0] + " " + coords[1]);
        OLMap.getView().setCenter(ol.proj.fromLonLat([coords[1], coords[0]]));

        if (ZoomLvl >= 7) {
            fetchData({force: true});
        }

        refreshFilter();
        hideSearchWarning();
    } else {
        showSearchWarning('Failed to find airport ' + airport);
    }
}

function hideSearchWarning() {
    const searchWarning = jQuery('#search_warning');
    if (searchWarning.css('display') !== 'none') {
        searchWarning.hide('slow');
    }
}

function showSearchWarning(message) {
    const searchWarning = jQuery('#search_warning');
    searchWarning.text(message)
    if (searchWarning.css('display') === 'none') {
        searchWarning.show();
    }

    //auto hide after 15 seconds
    setTimeout(() => hideSearchWarning(), 15000);
}

function onSearch(e) {
    e.preventDefault();
    const searchTerm = jQuery("#search_input").val().trim();
    jQuery("#search_input").val("");
    jQuery("#search_input").blur();
    let results = [];
    if (searchTerm)
        results = findPlanes(searchTerm, "byIcao", "byCallsign", "byReg", "byType", true);
    if (results.length > 0 && globeIndex) {
        toggleIsolation("on");
        if (results.length < 100) {
            getTrace(null, null, {list: results});
        }
    }
    return false;
}
function onSearchClear(e) {
    deselectAllPlanes();
    toggleIsolation("off");
    toggleMultiSelect("off");
    jQuery("#search_input").val("");
    jQuery("#search_input").blur();
}

function onResetCallsignFilter(e) {
    jQuery("#callsign_filter").val("");
    jQuery("#callsign_filter").blur();

    updateCallsignFilter();
}

function updateCallsignFilter(e) {
    if (e)
        e.preventDefault();

    jQuery("#callsign_filter").blur();

    PlaneFilter.callsign = jQuery("#callsign_filter").val().trim().toUpperCase();

    refreshFilter();
}

function onResetTypeFilter(e) {
    jQuery("#type_filter").val("");
    jQuery("#type_filter").blur();

    updateTypeFilter();
}

function updateTypeFilter(e) {
    if (e)
        e.preventDefault();

    jQuery("#type_filter").blur();
    let type = jQuery("#type_filter").val().trim();

    PlaneFilter.type = type.toUpperCase();

    refreshFilter();
}

function onResetIcaoFilter(e) {
    jQuery("#icao_filter").val("");
    jQuery("#icao_filter").blur();

    updateIcaoFilter();
}

function updateIcaoFilter(e) {
    if (e)
        e.preventDefault();

    jQuery("#icao_filter").blur();
    let icao = jQuery("#icao_filter").val().trim();

    PlaneFilter.icao = icao.toLowerCase();

    refreshFilter();
}

function onResetDescriptionFilter(e) {
    jQuery("#description_filter").val("");
    jQuery("#description_filter").blur();

    updateTypeFilter();
}

function updateDescriptionFilter(e) {
    if (e)
        e.preventDefault();

    jQuery("#description_filter").blur();
    let description = jQuery("#description_filter").val().trim();

    PlaneFilter.description = description.toUpperCase();

    refreshFilter();
}

function onResetAltitudeFilter(e) {
    jQuery("#altitude_filter_min").val("");
    jQuery("#altitude_filter_max").val("");
    jQuery("#altitude_filter_min").blur();
    jQuery("#altitude_filter_max").blur();

    updateAltFilter();
    refreshFilter();
}

function updateAltFilter() {
    let minAltitude = parseFloat(jQuery("#altitude_filter_min").val().trim());
    let maxAltitude = parseFloat(jQuery("#altitude_filter_max").val().trim());
    let enabled = false;

    if (minAltitude < -1e6 || minAltitude > 1e6 || isNaN(minAltitude))
        minAltitude = -1e6;
    else
        enabled = true;
    if (maxAltitude < -1e6 || maxAltitude > 1e6 || isNaN(maxAltitude))
        maxAltitude = 1e6;
    else
        enabled = true;

    if (!enabled) {
        PlaneFilter.enabled = false;
        PlaneFilter.minAltitude = undefined;
        PlaneFilter.maxAltitude = undefined;
    }

    PlaneFilter.enabled = enabled;

    if (DisplayUnits == "metric") {
        PlaneFilter.minAltitude = minAltitude * 3.2808;
        PlaneFilter.maxAltitude = maxAltitude * 3.2808;
    } else {
        PlaneFilter.minAltitude = minAltitude;
        PlaneFilter.maxAltitude = maxAltitude;
    }
}

function getFlightAwareIdentLink(ident, linkText) {
    if (ident !== null && ident !== "") {
        if (!linkText) {
            linkText = ident;
        }
        return '<a class="link" target="_blank" href="https://flightaware.com/live/flight/' + ident.trim() + '" rel="noreferrer">' + linkText + '</a>';
    }

    return "";
}

function onResetSourceFilter(e) {
    jQuery('#sourceFilter .ui-selected').removeClass('ui-selected');

    sourcesFilter = null;

    updateSourceFilter();
}

function updateSourceFilter(e) {
    if (e)
        e.preventDefault();

    PlaneFilter.sources = sourcesFilter;

    refreshFilter();
}

function onResetFlagFilter(e) {
    jQuery('#flagFilter .ui-selected').removeClass('ui-selected');

    flagFilter = null;

    updateFlagFilter();
}

function updateFlagFilter(e) {
    if (e)
        e.preventDefault();

    PlaneFilter.flagFilter = flagFilter;

    refreshFilter();
}


function getFlightAwareModeSLink(code, ident, linkText) {
    if (code !== null && code.length > 0 && code[0] !== '~' && code !== "000000") {
        if (!linkText) {
            linkText = "FlightAware: " + code.toUpperCase();
        }

        let linkHtml = "<a class=\"link\" target=\"_blank\" href=\"https://flightaware.com/live/modes/" + code ;
        if (ident != null && ident !== "") {
            linkHtml += "/ident/" + ident.trim();
        }
        linkHtml += "/redirect\" rel=\"noreferrer\">" + linkText + "</a>";
        return linkHtml;
    }

    return "";
}

function getPhotoLink(ac) {
    if (jetphotoLinks) {
        if (ac.registration == null || ac.registration == "")
            return "";
        return "<a class=\"link\" target=\"_blank\" href=\"https://www.jetphotos.com/photo/keyword/" + ac.registration.replace(/[^0-9a-z]/ig,'') + "\" rel=\"noreferrer\">Jetphotos</a>";
    } else if (flightawareLinks) {
        if (ac.registration == null || ac.registration == "")
            return "";
        return "<a class=\"link\" target=\"_blank\" href=\"https://flightaware.com/photos/aircraft/" + ac.registration.replace(/[^0-9a-z]/ig,'') + "\" rel=\"noreferrer\">FA Photos</a>";
    } else if (showPictures) {
        return "<a class=\"link\" target=\"_blank\" href=\"https://www.planespotters.net/hex/" + ac.icao.toUpperCase() + "\" rel=\"noreferrer\">View on Planespotters</a>";
    }
}

// takes in an elemnt jQuery path and the OL3 layer name and toggles the visibility based on clicking it
function toggleLayer(element, layer) {
    // set initial checked status
    ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
        if (lyr.get('name') === layer && lyr.getVisible()) {
            jQuery(element).addClass('settingsCheckboxChecked');
        }
    });
    jQuery(element).on('click', function() {
        let visible = false;
        if (jQuery(element).hasClass('settingsCheckboxChecked')) {
            visible = true;
        }
        ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
            if (lyr.get('name') === layer) {
                if (visible) {
                    lyr.setVisible(false);
                    jQuery(element).removeClass('settingsCheckboxChecked');
                } else {
                    lyr.setVisible(true);
                    jQuery(element).addClass('settingsCheckboxChecked');
                }
            }
        });
    });
}

let fetchingPf = false;
function fetchPfData() {
    if (fetchingPf)
        return;
    fetchingPf = true;
    for (let i in pf_data) {
        const req = jQuery.ajax({ url: pf_data[i],
            dataType: 'json' });
        jQuery.when(req).done(function(data) {
            for (let i in PlanesOrdered) {
                const plane = PlanesOrdered[i];
                const ac = data.aircraft[plane.icao.toUpperCase()];
                if (!ac) {
                    continue;
                }
                plane.pfRoute = ac.route;
                plane.pfMach = ac.mach;
                plane.pfFlightno = ac.flightno;
                if (!plane.registration && ac.reg && ac.reg != "????" && ac.reg != "z.NO-REG")
                    plane.registration = ac.reg;
                if (!plane.icaoType && ac.type && ac.type != "????" && ac.type != "ZVEH") {
                    plane.icaoType = ac.type;
                    plane.setTypeData();
                }
            }
            fetchingPf = false;
        });
    }
}

function solidGoldT(arg) {
    solidT = true;
    let list = [[], [], [], []];
    for (let i = 0; i < PlanesOrdered.length; i++) {
        let plane = PlanesOrdered[i];
        //console.log(plane);
        if (plane.visible) {
            list[Math.floor(4*i/PlanesOrdered.length)].push(plane);
        }
    }
    getTrace(null, null, {onlyRecent: arg == 2, onlyFull: arg == 1, list: list[0],});
    getTrace(null, null, {onlyRecent: arg == 2, onlyFull: arg == 1, list: list[1],});
    getTrace(null, null, {onlyRecent: arg == 2, onlyFull: arg == 1, list: list[2],});
    getTrace(null, null, {onlyRecent: arg == 2, onlyFull: arg == 1, list: list[3],});
}

function bearingFromLonLat(position1, position2) {
    // Positions in format [lon in deg, lat in deg]
    const lon1 = position1[0]*Math.PI/180;
    const lat1 = position1[1]*Math.PI/180;
    const lon2 = position2[0]*Math.PI/180;
    const lat2 = position2[1]*Math.PI/180;

    const y = Math.sin(lon2-lon1)*Math.cos(lat2);
    const x = Math.cos(lat1)*Math.sin(lat2)
        - Math.sin(lat1)*Math.cos(lat2)*Math.cos(lon2-lon1);
    return (Math.atan2(y, x)* 180 / Math.PI + 360) % 360;
}

function zoomIn() {
    const zoom = OLMap.getView().getZoom();
    OLMap.getView().setZoom((zoom+1).toFixed());
    if (FollowSelected)
        toggleFollow(true);
}

function zoomOut() {
    const zoom = OLMap.getView().getZoom();
    OLMap.getView().setZoom((zoom-1).toFixed());
    if (FollowSelected)
        toggleFollow(true);
}

function changeZoom(init) {
    if (!OLMap)
        return;

    ZoomLvl = OLMap.getView().getZoom();

    checkScale();

    // small zoomstep, no need to change aircraft scaling
    if (!init && Math.abs(ZoomLvl-ZoomLvlCache) < 0.4)
        return;

    loStore['ZoomLvl'] = ZoomLvl;
    ZoomLvlCache = ZoomLvl;

    if (!init && showTrace)
        updateAddressBar();

    checkPointermove();
}

function checkScale() {
    if (ZoomLvl > markerZoomDivide)
        iconSize = markerBig;
    else
        iconSize = markerSmall;

    // scale markers according to global scaling
    iconSize *= Math.pow(1.3, globalScale) * globalScale * iconScale;
    // disable, doesn't work well
    // iconSize *= 1 - 0.37 * Math.pow(TrackedAircraftPositions + 1, 0.8) / Math.pow(10000, 0.8);
}
function setGlobalScale(scale, init) {
    globalScale = scale;
    document.documentElement.style.setProperty("--SCALE", globalScale);

    labelFont = "bold " + (12 * globalScale * labelScale) + "px/" + (14 * globalScale * labelScale) + "px Tahoma, Verdana, Helvetica, sans-serif";

    checkScale();
    setLineWidth();
    if (!init) {
        refreshFeatures();
        refreshSelected();
        refreshHighlighted();
        remakeTrails();
    }
}

function checkPointermove() {
    if ((webgl || ZoomLvl > 5.5) && enableMouseover && !onMobile) {
        OLMap.on('pointermove', onPointermove);
    } else {
        OLMap.un('pointermove', onPointermove);
        removeHighlight();
    }
}


function changeCenter(init) {
    const rawCenter = OLMap.getView().getCenter();
    const center = ol.proj.toLonLat(rawCenter);

    const centerChanged = (Math.abs(center[1] - CenterLat) < 0.000001 && Math.abs(center[0] - CenterLon) < 0.000001);

    loStore['CenterLon'] = CenterLon = center[0];
    loStore['CenterLat'] = CenterLat = center[1];

    if (!init && showTrace && centerChanged) {
        updateAddressBar();
    }

    if (rawCenter[0] < OLProj.extent_[0] || rawCenter[0] > OLProj.extent_[2]) {
        OLMap.getView().setCenter(ol.proj.fromLonLat(center));
        mapRefresh();
    }
    if (center[1] < -85)
        OLMap.getView().setCenter(ol.proj.fromLonLat([center[0], -85]));
    if (center[1] > 85)
        OLMap.getView().setCenter(ol.proj.fromLonLat([center[0], 85]));
}

let lastMovement = 0;
let checkMoveZoom;
let checkMoveCenter = [0, 0];
let checkMoveDone = 0;

function checkMovement() {
    if (!OLMap)
        return;
    const zoom = OLMap.getView().getZoom();
    const center = ol.proj.toLonLat(OLMap.getView().getCenter());
    const ts = new Date().getTime();

    if (
        checkMoveZoom != zoom ||
        checkMoveCenter[0] != center[0] ||
        checkMoveCenter[1] != center[1]
    ) {
        checkMoveDone = 0;
        checkFollow();
        active();
        lastMovement = ts;
    }

    checkMoveZoom = zoom;
    checkMoveCenter[0] = center[0];
    checkMoveCenter[1] = center[1];

    changeZoom();
    changeCenter();

    const elapsed = Math.abs(ts - lastMovement);

    if (!checkMoveDone && heatmap && elapsed > 300) {
        if (!heatmap.manualRedraw)
            drawHeatmap();
        checkMoveDone = 1;
    }
    if (elapsed > 500 || (!onMobile && elapsed > 45)) {
        checkRefresh();
    }

    fetchData();
}

function getZoom() {
    return OLMap.getView().getZoom();
}

function getCenter() {
    return ol.proj.toLonLat(OLMap.getView().getCenter());
}

let lastRefresh = 0;
let refreshZoom, refreshCenter;
function checkRefresh() {
    if (showTrace)
        return;
    if (triggerRefresh) {
        refresh();
        return;
    }
    const center = getCenter();
    const zoom = getZoom();
    if (zoom != refreshZoom || !refreshCenter || center[0] != refreshCenter[0] || center[1] != refreshCenter[1]) {
        const ts = new Date().getTime();
        const elapsed = Math.abs(ts - lastRefresh);
        let num = Math.min(1500, Math.max(250, TrackedAircraftPositions / 300 * 250));
        if (elapsed > num) {
            refresh();
        }
    }
}
function refresh() {
    lastRefresh = new Date().getTime();

    refreshZoom = getZoom();
    refreshCenter = getCenter();

    if (replay) {
        for (let i in SelPlanes) {
            const plane = SelPlanes[i];
            plane.processTrace();
        }
    }

    //console.time("refreshTable");
    TAR.planeMan.refresh();
    //console.timeEnd("refreshTable");
    mapRefresh();

    triggerRefresh = 0;

    refreshSelected();
    refreshHighlighted();
}

function mapRefresh(redraw) {
    if (!mapIsVisible || heatmap)
        return;
    //console.log('mapRefresh()');
    let addToMap = [];
    let nMapPlanes = 0;
    if (globeIndex && !icaoFilter) {
        for (let i in PlanesOrdered) {
            const plane = PlanesOrdered[i];
            delete plane.glMarker;
            // disable mobile limitations when using webGL
            if (
                (!onMobile || webgl || nMapPlanes < 150)
                && (!onMobile || webgl || ZoomLvl > 10 || !plane.onGround)
                && plane.visible
                && plane.inView
            ) {
                addToMap.push(plane);
                nMapPlanes++;
            } else if (plane.selected) {
                addToMap.push(plane);
                nMapPlanes++;
            } else {
                plane.markerDrawn && plane.clearMarker();
                plane.linesDrawn && plane.clearLines();
            }
        }
    } else {
        for (let i in PlanesOrdered) {
            const plane = PlanesOrdered[i];
            addToMap.push(plane);
            delete plane.glMarker;
        }
    }

    // webGL zIndex hack:
    // sort all planes by altitude
    // clear the vector source
    // delete all feature objects so they are recreated, this is important
    // draw order will be insertion / updateFeatures / updateTick order

    addToMap.sort(function(x, y) { return x.zIndex - y.zIndex; });
    //console.log('maprefresh(): ' + addToMap.length);
    if (webgl) {
        webglFeatures.clear();
    }
    if (globeIndex && !icaoFilter) {
        for (let i in addToMap) {
            addToMap[i].updateFeatures(redraw);
        }
    } else {
        for (let i in addToMap) {
            addToMap[i].updateTick(redraw);
        }
    }
}

function onPointermove(evt) {
    //clearTimeout(pointerMoveTimeout);
    //pointerMoveTimeout = setTimeout(highlight(evt), 100);
    highlight(evt);
}

function highlight(evt) {
    const hex = evt.map.forEachFeatureAtPixel(evt.pixel,
        function(feature, layer) {
            return feature.hex;
        },
        {
            layerFilter: function(layer) {
                return (layer == iconLayer || layer == webglLayer);
            },
            hitTolerance: 5 * globalScale,
        }
    );

    if (HighlightedPlane && hex == HighlightedPlane.icao)
        return;

    //clearTimeout(pointerMoveTimeout);

    if (hex) {
        HighlightedPlane = Planes[hex];
    } else {
        HighlightedPlane = null;
    }
    //pointerMoveTimeout = setTimeout(refreshHighlighted(), 300);
    refreshHighlighted();
}
let urlIcaos = [];
function parseURLIcaos() {
    if (usp.has('icao')) {
        let inArray = usp.get('icao').toLowerCase().split(',');
        for (let i = 0; i < inArray.length; i++) {
            const icao = inArray[i].toLowerCase();
            if (icao && (icao.length == 7 || icao.length == 6) && icao.toLowerCase().match(/[a-f,0-9]{6}/)) {
                urlIcaos.push(icao);
                let newPlane = Planes[icao] || new PlaneObject(icao);
                newPlane.last_message_time = NaN;
                newPlane.position_time = NaN;
                newPlane.selected = true;
                SelPlanes.push(newPlane);
                //console.log(newPlane);
                // preliminary adding of URL specified icaos
            }
        }
    }
}
function processURLParams(){
    if (usp.has('showTrace')) {
        let date = setTraceDate({string: usp.get('showTrace')});
        if (date && usp.has('startTime')) {
            let numbers =  usp.get('startTime').split(':');
            traceOpts.startHours = numbers[0] ? parseInt(numbers[0]) : 0;
            traceOpts.startMinutes = numbers[1] ? parseInt(numbers[1]) : 0;
            traceOpts.startSeconds = numbers[2] ? parseInt(numbers[2]) : 0;
        }
        if (date && usp.has('endTime')) {
            let numbers = usp.get('endTime').split(':');
            traceOpts.endHours = numbers[0] ? parseInt(numbers[0]) : 24;
            traceOpts.endMinutes = numbers[1] ? parseInt(numbers[1]) : 0;
            traceOpts.endSeconds = numbers[2] ? parseInt(numbers[2]) : 0;
        }
        if (date && usp.getFloat('timestamp')) {
            showTraceTimestamp = usp.getFloat('timestamp');
        }
    }

    const callsign = usp.get('callsign');
    let zoom = null;
    let follow = true;
    if (usp.get("zoom")) {
        try {
            zoom = parseFloat(usp.get("zoom"));
            if (zoom === 0)
                zoom = 8;
        } catch (error) {
            console.log("Error parsing zoom:", error);
        }
    }

    if (usp.get("lat") && usp.get("lon")) {
        try {
            const lat = parseFloat(usp.get("lat"));
            const lon = parseFloat(usp.get("lon"));
            OLMap.getView().setCenter(ol.proj.fromLonLat([lon, lat]));
            follow = false;
            traceOpts.noFollow = new Date().getTime() / 1000;
        }
        catch (error) {
            console.log("Error parsing lat/lon:", error);
        }
    }

    if (urlIcaos.length > 0) {
        const icaos = urlIcaos;
        if (!usp.has('noIsolation'))
            toggleIsolation("on");
        if (icaos.length > 1) {
            toggleMultiSelect("on");
            //follow = false;
        }
        for (let i = 0; i < icaos.length; i++) {
            const icao = icaos[i];
            console.log('Selected ICAO id: '+ icao + ' traceDate: ' + traceDateString);
            let options = {follow: follow, noDeselect: true};
            if (traceDate != null) {
                let newPlane = Planes[icao] || new PlaneObject(icao);
                newPlane.last_message_time = NaN;
                newPlane.position_time = NaN;
                newPlane.selected = true;
                select(newPlane, options);

                if (!zoom)
                    zoom = 5;
            } else {
                if (!zoom)
                    zoom = 7;
                selectPlaneByHex(icao, options)
            }
        }
        if (traceDate != null)
        {
            toggleShowTrace();
            toggleFollow(follow);
        }
        updateAddressBar();
    } else if (callsign != null) {
        findPlanes(callsign, false, true, false, false, false);
    }

    if (zoom) {
        OLMap.getView().setZoom(zoom);
    }

    if (usp.has('mil'))
        toggleMilitary();

    if (usp.has('airport')) {
        onJumpInput = usp.get('airport').trim().toUpperCase();
        onJump();
    }

    if (usp.has('leg')) {
        legSel = parseInt(usp.get('leg'), 10);
        if (isNaN(legSel) || legSel < -1)
            legSel = -1;
        else
            legSel--;
    }

    let tracks = usp.get('monochromeTracks');
    if (tracks != undefined) {
        if (tracks.length == 6)
            monochromeTracks = '#' + tracks;
        else
            monochromeTracks = "#000000";
    }

    let markers = usp.get('monochromeMarkers');
    if (markers != undefined) {
        if (markers.length == 6)
            monochromeMarkers = '#' + markers;
        else
            monochromeMarkers = "#FFFFFF";
    }

    let outlineColor = usp.get('outlineColor');
    if (outlineColor != undefined) {
        if (outlineColor.length == 6)
            OutlineADSBColor = '#' + outlineColor;
        else
            OutlineADSBColor = "#000000";
    }

    if (usp.has('centerReceiver')) {
        OLMap.getView().setCenter(ol.proj.fromLonLat([SiteLon, SiteLat]));
    }
}

let regIcaoDownloadRunning = false;
function regIcaoDownload(opts) {
    regIcaoDownloadRunning = true;
    let req = jQuery.ajax({ url: databaseFolder + "/regIcao.js",
        cache: true,
        timeout: 60000,
        dataType : 'json',
        opts: opts,
    });
    req.done(function(data) {
        regCache = data;
    });
    req.always(function() {
        regIcaoDownloadRunning = false;
    });
    return req;
}
function findPlanes(queries, byIcao, byCallsign, byReg, byType, showWarnings) {
    if (queries == null)
        return;
    queries = queries.toLowerCase();
    queries = queries.split(',');
    if (queries.length > 1)
        toggleMultiSelect("on");
    let results = [];
    for (let i in queries) {
        const query = queries[i];
        if (byReg) {
            let upper = query.toUpperCase();
            if (regCache) {
                if (regCache[upper]) {
                    selectPlaneByHex(regCache[upper].toLowerCase(), {noDeselect: true, follow: true});
                }
            } else if (!regIcaoDownloadRunning) {
                let req = regIcaoDownload({ upper: `${upper}` });
                req.done(function() {
                    if (regCache[this.opts.upper]) {
                        selectPlaneByHex(regCache[this.opts.upper].toLowerCase(), {noDeselect: true, follow: true});
                    }
                });
            }
        }
        for (let i in PlanesOrdered) {
            const plane = PlanesOrdered[i];
            if (
                (byCallsign && plane.flight != null && plane.flight.toLowerCase().match(query))
                || (byIcao && plane.icao.toLowerCase().match(query))
                || (byReg && plane.registration != null && plane.registration.toLowerCase().match(query))
                || (byType && plane.icaoType != null && plane.icaoType.toLowerCase().match(query))
            ) {
                if (globeIndex) {
                    if (plane.inView)
                        results.push(plane);
                } else {
                    if (plane.checkVisible())
                        results.push(plane);
                }
            }
        }
    }
    if (results.length > 1) {
        toggleMultiSelect("on");
        for (let i in results) {
            select(results[i], {});
            results[i].updateTick(true);
            SelectedPlane = null;
        }
        showWarnings && hideSearchWarning();
    } else if (results.length == 1) {
        selectPlaneByHex(results[0].icao, {noDeselect: true, follow: true});
        console.log("query selected: " + queries);
        showWarnings && hideSearchWarning();
    } else {
        console.log("No match found for query: " + queries);
        let foundByHex = 0;
        if (globeIndex) {
            for (let i in queries) {
                const query = queries[i];
                if (query.toLowerCase().match(/~?[a-f,0-9]{6}/)) {
                    console.log("maybe it's an icao, let's try to fetch the history for it!");
                    selectPlaneByHex(query, {noDeselect: true, follow: true}) && foundByHex++
                }
            }
        }
        if (foundByHex === 0 && showWarnings) {
            if (globeIndex) {
                showSearchWarning("No match found in current view: " + queries);
            } else {
                showSearchWarning("No match found for query: " + queries);
            }
        }
    }
    return results;
}

function trailReaper() {
    for (let i in PlanesOrdered) {
        PlanesOrdered[i].reapTrail();
    }
}

function setIndexDistance(index, center, coords) {
    if (index >= 1000) {
        globeIndexDist[index] = ol.sphere.getDistance(center, coords);
        return;
    }
    let tile = globeIndexSpecialTiles[index];
    let min = ol.sphere.getDistance(center, [tile[1], tile[0]]);
    min = Math.min(min, ol.sphere.getDistance(center, [tile[1], tile[2]]));
    min = Math.min(min, ol.sphere.getDistance(center, [tile[3], tile[0]]));
    min = Math.min(min, ol.sphere.getDistance(center, [tile[3], tile[2]]));
    globeIndexDist[index] = min;
}

function globeIndexes() {
    const center = ol.proj.toLonLat(OLMap.getView().getCenter());
    if (mapIsVisible || lastGlobeExtent == null) {
        let mapSize = OLMap.getSize();
        let size = [mapSize[0] * 1.02, mapSize[1] * 1.02];
        lastGlobeExtent = myExtent(OLMap.getView().calculateExtent(size));
    }
    let extent = lastGlobeExtent.extent;
    const bottomLeft = ol.proj.toLonLat([extent[0], extent[1]]);
    const topRight = ol.proj.toLonLat([extent[2], extent[3]]);
    let x1 = bottomLeft[0];
    let y1 = bottomLeft[1];
    let x2 = topRight[0];
    let y2 = topRight[1];
    if (Math.abs(extent[2] - extent[0]) > 40075016) {
        // all longtitudes in view, only check latitude
        x1 = -179;
        x2 = 179;
    }
    if (y1 < -89.5)
        y1 = -89.5;
    if (y2 > 89.5)
        y2 = 89.5;
    let indexes = [];
    //console.log(x1 + ' ' + x2);
    let grid = globeIndexGrid;

    let x3 = x1 < x2 ? x2 : 199;
    let count = 0;

    //console.time('indexes');
    for (let lon = x1; lon < x3 + grid; lon += grid) {
        if (x1 > x2 && lon > 180) {
            lon -= 360;
            x3 = x2;
        }
        if (lon > x3)
            lon = x3 + 0.01;
        if (count++ > 360 / grid) {
            console.log("globeIndexes fail, lon: " + lon);
        }
        let count2 = 0;
        for (let lat = y1; lat < y2 + grid; lat += grid) {
            if (count2++ > 180 / grid) {
                console.log("globeIndexes fail, lon: " + lon + ", lat: " + lat);
                break;
            }
            if (lat > y2)
                lat = y2 + 0.01;
            if (lat > 90)
                break;
            let index = globe_index(lat, lon);
            //console.log(lat + ' ' + lon + ' ' + index);
            if (!indexes.includes(index)) {
                setIndexDistance(index, center, [lon, lat]);
                indexes.push(index);
            }
        }
    }
    //console.timeEnd('indexes');
    globeTilesViewCount = indexes.length;
    return indexes;
}

function globe_index(lat, lon) {
    let grid = globeIndexGrid;

    lat = grid * Math.floor((lat + 90) / grid) - 90;
    lon = grid * Math.floor((lon + 180) / grid) - 180;

    let i = Math.floor((lat+90) / grid);
    let j = Math.floor((lon+180) / grid);

    let lat_multiplier = Math.floor(360 / grid + 1);
    let defaultIndex = i * lat_multiplier + j + 1000;

    let index = globeIndexSpecialLookup[defaultIndex];
    if (index) {
        return index;
    }

    // not yet in lookup, check special tiles
    for (let i = 0; i < globeIndexSpecialTiles.length; i++) {
        let tile = globeIndexSpecialTiles[i];
        if ((lat >= tile[0] && lat < tile[2])
            && ((tile[1] < tile[3] && lon >= tile[1] && lon < tile[3])
                || (tile[1] > tile[3] && (lon >= tile[1] || lon < tile[3])))) {
            globeIndexSpecialLookup[defaultIndex] = index = i;
        }
    }
    if (index == null) {
        // not a special tile, set lookup to default index
        globeIndexSpecialLookup[defaultIndex] = index = defaultIndex;
    }

    return index;
}

function myExtent(extent) {
    let bottomLeft = ol.proj.toLonLat([extent[0], extent[1]]);
    let topRight = ol.proj.toLonLat([extent[2], extent[3]]);
    return {
        extent: extent,
        minLon: bottomLeft[0],
        maxLon: topRight[0],
        minLat: bottomLeft[1],
        maxLat: topRight[1],
    }
}

function inView(pos, ex) {
    if (pos == null)
        return false;

    if (solidT)
        return true;

    let extent = ex.extent;
    let lon = pos[0];
    let lat = pos[1];

    //console.log((currExtent[2]-currExtent[0])/40075016);
    //console.log([bottomLeft[0], topRight[0]]);
    //console.log([bottomLeft[1], topRight[1]]);
    //const proj = ol.proj.fromLonLat(pos);
    if (lat < ex.minLat || lat > ex.maxLat)
        return false;

    if (extent[2] - extent[0] > 40075016) {
        // all longtitudes in view, only check latitude
        return true;
    } else if (ex.minLon < ex.maxLon) {
        // no wraparound: view not crossing 179 to -180 transition line
        return (lon > ex.minLon && lon < ex.maxLon);
    } else {
        // wraparound: view crossing 179 to -180 transition line
        return (lon > ex.minLon || lon < ex.maxLon);
    }
}
let lastAddressBarUpdate = 0;
let updateAddressBarTimeout;
let updateAddressBarPushed = false;
function updateAddressBar() {
    if (!window.history || !window.history.replaceState)
        return;
    if (heatmap || pTracks || !CenterLat)
        return;
    let time = new Date().getTime();
    if (time < lastAddressBarUpdate + 200) {
        clearTimeout(updateAddressBarTimeout);
        updateAddressBarTimeout = setTimeout(updateAddressBar, 205);
        return;
    }
    lastAddressBarUpdate = time;

    let posString = 'lat=' + CenterLat.toFixed(3) + '&lon=' + CenterLon.toFixed(3) + '&zoom=' + ZoomLvl.toFixed(1);
    let string = '';
    if (((showTrace) && SelectedPlane) || replay) {
        posString = "&" + posString;
    } else {
        posString = ""
    }

    if (SelPlanes.length > 0) {
        string += '?icao=' + SelPlanes.map((s) => encodeURIComponent(s.icao)).join(',')
    } else if (replay) {
        string += '?replay=';
        string += zDateString(replay.ts);
        string += '-' + replay.ts.getUTCHours().toString().padStart(2,'0');
        string += ':' + replay.ts.getUTCMinutes().toString().padStart(2,'0');
    }

    string += posString;

    if (SelectedPlane && (showTrace || replay)) {
        string += '&showTrace=' + traceDateString;
        if (legSel != -1)
            string += '&leg=' + (legSel + 1);
        if (traceOpts.startHours != null) {
            string += '&startTime=';
            string += traceOpts.startHours.toString().padStart(2, '0');
            string += ':' + traceOpts.startMinutes.toString().padStart(2, '0');
            if (traceOpts.startSeconds) {
                string += ':' + traceOpts.startSeconds.toString().padStart(2, '0');
            }
        }
        if (traceOpts.endHours != null) {
            string += '&endTime=';
            string += traceOpts.endHours.toString().padStart(2, '0');
            string += ':' + traceOpts.endMinutes.toString().padStart(2, '0');
            if (traceOpts.endSeconds) {
                string += ':' + traceOpts.endSeconds.toString().padStart(2, '0');
            }
        }
        if (trackLabels) {
            string += '&trackLabels';
        }
        if (traceOpts.showTime) {
            string += '&timestamp=';
            string += Math.ceil(traceOpts.showTime);
        }
    }

    let shareFilter = '';
    if (toggles.shareFilters  && toggles.shareFilters.state) {
        let filterStrings = [];
        if (string === '') {
            shareFilter = '?';
        } else {
            shareFilter = '&'
        }

        if (PlaneFilter.minAltitude > -1000000) {
            filterStrings.push('filterAltMin=' + PlaneFilter.minAltitude);
        }
        if (PlaneFilter.maxAltitude < 1000000) {
            filterStrings.push('filterAltMax=' + PlaneFilter.maxAltitude);
        }
        if (PlaneFilter.callsign) {
            filterStrings.push('filterCallSign=' + encodeURIComponent(PlaneFilter.callsign));
        }
        if (PlaneFilter.type) {
            filterStrings.push('filterType=' + encodeURIComponent(PlaneFilter.type));
        }
        if (PlaneFilter.description) {
            filterStrings.push('filterDescription=' + encodeURIComponent(PlaneFilter.description));
        }
        if (PlaneFilter.icao) {
            filterStrings.push('filterIcao=' + encodeURIComponent(PlaneFilter.icao));
        }

        if (PlaneFilter.sources) {
            filterStrings.push('filterSources=' + PlaneFilter.sources.map(f => encodeURIComponent(f)).join(','));
        }
        if (PlaneFilter.flagFilter) {
            filterStrings.push('filterDbFlag=' + PlaneFilter.flagFilter.map(f => encodeURIComponent(f)).join(','));
        }

        if (filterStrings.length > 0) {
            shareFilter = shareFilter + filterStrings.join('&');
        } else {
            shareFilter = '';
        }
    }

    string += shareFilter;
    shareLink = (shareBaseUrl ? shareBaseUrl : pathName) + string;

    if (uuid)
        return;
    if (icaoFilter)
        return;

    if (SelPlanes.length == 0 && initialURL && initialURL.indexOf("icao") < 0 && !replay && shareFilter == '') {
        string = initialURL;
    } else {
        string = pathName + string;
    }

    if (!updateAddressBarPushed) {
        // make sure we keep the thing we clicked on first in the browser history
        window.history.pushState("object or string", "Title", string);
        updateAddressBarPushed = true;
    } else {
        // but don't create a new history entry for every plane we click on
        window.history.replaceState("object or string", "Title", string);
    }
}

function refreshInt() {
    let refresh = RefreshInterval;

    if (uuid)
        return 5000;

    // handle non globe case
    if (!globeIndex) {
        return refresh;
    }

    // handle globe case

    if (binCraft && globeIndex && onlyMilitary && OLMap.getView().getZoom() < 5.5) {
        refresh = 8000;
    }

    let inactive = getInactive();

    if (inactive < 70)
        inactive = 70;
    if (inactive > 240)
        inactive = 240;

    refresh *= inactive / 70;

    if (!mapIsVisible)
        refresh *= 2;

    if (adsbexchange && window.self != window.top) {
        refresh *= 1.5;
    } else if (onMobile && TrackedAircraftPositions > 800) {
        refresh *= 1.5;
    }


    return refresh;
}

function toggleShowTrace() {
    if (!showTrace) {
        showTrace = true;
        toggleFollow(false);
        showTraceWasIsolation = onlySelected;
        toggleIsolation("on");
        shiftTrace();
    } else {
        showTrace = false;
        traceOpts = {};
        fetchData();
        legSel = -1;
        jQuery('#leg_sel').text('Legs: All');
        if (!showTraceWasIsolation)
            toggleIsolation("off");
        //let string = pathName + '?icao=' + SelectedPlane.icao;
        //window.history.replaceState("object or string", "Title", string);
        //shareLink = string;
        updateAddressBar();
        const hex = SelectedPlane.icao;
        sp = SelectedPlane = null;
        showTraceExit = true;
        for (let i in SelPlanes) {
            const plane = SelPlanes[i];
            plane.setNull();
        }
        selectPlaneByHex(hex, {noDeselect: true, follow: true, zoom: ZoomLvl,});
    }

    jQuery('#history_collapse').toggle();
    jQuery('#show_trace').toggleClass('active');
}

function legShift(offset, plane) {
    if(!offset)
        offset = 0;
    if (!plane) {
        legSel += offset;
        for (let i in SelPlanes) {
            legShift(offset, SelPlanes[i]);
        }
        return;
    }


    if (offset != 0)
        traceOpts.showTime = null;

    if (!multiSelect && !plane.fullTrace) {
        jQuery('#leg_sel').text('No Data available for\n' + traceDateString);
        jQuery('#trace_time').text('UTC:\n');
    }
    if (!plane.fullTrace) {
        plane.processTrace();
        return;
    }

    let trace = plane.fullTrace.trace;
    let legStart = null;
    let legEnd = null;
    let count = 0;

    for (let i = 1; i < trace.length; i++) {
        let timestamp = trace[i][0];
        if (traceOpts.startStamp != null && timestamp < traceOpts.startStamp) {
            continue;
        }
        if (traceOpts.endStamp != null && timestamp > traceOpts.endStamp)
            break;
        if (legStart == null) {
            legStart = i;
            i++;
            if (i >= trace.length)
                break;
        }
        if (trace[i][6] & 2) {
            count++;
        }
    }
    if (legSel < -1)
        legSel = count;
    if (legSel > count)
        legSel = -1;

    if (legSel == -1) {
        jQuery('#leg_sel').text('Legs: All');
        traceOpts.legStart = null;
        traceOpts.legEnd = null;
        plane.processTrace();
        updateAddressBar();
        return;
    }

    count = 0;
    for (let i = legStart + 1; i < trace.length; i++) {
        let timestamp = trace[i][0];
        if (traceOpts.endStamp != null && timestamp > traceOpts.endStamp)
            break;
        if (trace[i][6] & 2) {
            if (count == legSel - 1)
                legStart = i;
            if (count == legSel)
                legEnd = i; // exclusive
            count++;
        }
    }
    jQuery('#leg_sel').text('Leg: ' + (legSel + 1));
    traceOpts.legStart = legStart;
    traceOpts.legEnd = legEnd;
    plane.processTrace();

    updateAddressBar();
}

function setTraceDate(options) {
    options = options || {};
    let numbers = options.string ? options.string.split('-') : [];
    if (numbers.length == 3) {
        traceDate = new Date();
        traceDate.setUTCFullYear(numbers[0]);
        traceDate.setUTCMonth(numbers[1] - 1, numbers[2]);
    } else if (options.ts) {
        traceDate = new Date(options.ts);
    } else {
        return null;
    }
    traceDate.setUTCHours(0);
    traceDate.setUTCMinutes(0);
    traceDate.setUTCSeconds(0);

    let tomorrow = (new Date()).getTime() + 86400e3;
    if (traceDate.getTime() > tomorrow) {
        traceDate = new Date(tomorrow);
    }

    traceDateString = zDateString(traceDate);

    return traceDate;
}

function shiftTrace(offset) {
    if (traceRate > 180) {
        jQuery('#leg_sel').text('Slow down! ...');
        return;
    }

    // reset some traceOpts stuff (important)
    traceOpts.startStamp = null;
    traceOpts.endStamp = null;
    traceOpts.showTimeEnd = null;
    traceOpts.showTime = null;

    jQuery('#leg_sel').text('Loading ...');
    if (!traceDate || offset == "today") {
        setTraceDate({ ts: new Date().getTime() });
    } else if (offset) {
        setTraceDate({ ts: traceDate.getTime() + offset * 86400 * 1000 });
    }

    //jQuery('#trace_date').text('UTC day:\n' + traceDateString);
    jQuery("#histDatePicker").datepicker('setDate', traceDateString);

    for (let i in SelPlanes) {
        selectPlaneByHex(SelPlanes[i].icao, {noDeselect: true, zoom: ZoomLvl});
    }

    updateAddressBar();
}


function setLineWidth() {
    newWidth = lineWidth * Math.pow(2, globalScale) / 2 * globalScale

    estimateStyle = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#808080',
            width: 1.2 * newWidth,
        })
    });
    estimateStyleSlim = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#808080',
            width: 0.4 * newWidth,
        })
    });

    badLine =  new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#FF0000',
            width: 2 * newWidth,
        })
    });
    badLineMlat =  new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#FFA500',
            width: 2 * newWidth,
        })
    });

    badDot = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 3.5 * newWidth,
            fill: new ol.style.Fill({
                color: '#FF0000',
            })
        }),
    });
    badDotMlat = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 3.5 * newWidth,
            fill: new ol.style.Fill({
                color: '#FFA500',
            })
        }),
    });

    labelFill = new ol.style.Fill({color: 'white' });
    blackFill = new ol.style.Fill({color: 'black' });
    labelStroke = new ol.style.Stroke({color: 'rgba(0,0,0,0.7', width: 4 * globalScale});
    labelStrokeNarrow = new ol.style.Stroke({color: 'rgba(0,0,0,0.7', width: 2.5 * globalScale});
    bgFill = new ol.style.Stroke({color: 'rgba(0,0,0,0.25'});
}
let lastCallLocationChange = 0;
function onLocationChange(position) {
    lastCallLocationChange = new Date().getTime();
    changeCenter();
    const moveMap = (Math.abs(SiteLat - CenterLat) < 0.000001 && Math.abs(SiteLon - CenterLon) < 0.000001);
    SiteLat = CenterLat = DefaultCenterLat = position.coords.latitude;
    SiteLon = CenterLon = DefaultCenterLon = position.coords.longitude;
    SitePosition = [SiteLon, SiteLat];

    drawSiteCircle();
    createLocationDot();

    if (moveMap) {
        OLMap.getView().setCenter(ol.proj.fromLonLat([SiteLon, SiteLat]));
    }
    console.log('Location from browser: '+ SiteLat +', ' + SiteLon);
    //followRandomPlane();
    //togglePersistence();
}
function logArg(error) {
    console.log(error);
}

let watchPositionId;
let pollPositionSeconds = 10;
function pollPositionInterval() {
    if (!updateLocation)
        return;
    // interval position polling every half minute for browsers that are shit
    //console.trace();
    clearInterval(timers.pollPosition);
    timers.pollPosition = window.setInterval(function() {

        // if we recently got a new location via watchPosition(), don't query
        if (new Date().getTime() - lastCallLocationChange < pollPositionSeconds * 0.85 * 1000)
            return;

        if (tabHidden)
            return;

        console.log('pollPositionInterval: querying position');
        const geoposOptions = {
            enableHighAccuracy: false,
            timeout: pollPositionSeconds * 1000,
            maximumAge: pollPositionSeconds * 1000 ,
        };
        navigator.geolocation.getCurrentPosition(function(position) {
            onLocationChange(position);
        }, logArg, geoposOptions);
    }, pollPositionSeconds * 1000);
}

function watchPosition() {
    if (watchPositionId != null) {
        navigator.geolocation.clearWatch(watchPositionId);
    }
    if (!updateLocation) {
        return;
    }
    const geoposOptions = {
        enableHighAccuracy: false,
        timeout: Infinity,
        maximumAge: 25 * 1000,
    };
    watchPositionId = navigator.geolocation.watchPosition(function(position) {
        onLocationChange(position);
        pollPositionSeconds = 60;
    }, logArg, geoposOptions);
    pollPositionInterval();
}

let geoFindInterval = null;
function geoFindMe() {
    if (SiteOverride || (!globeIndex && !uuid && !askLocation)) {
        initSitePos();
        return;
    }

    function success(position) {
        SiteLat = DefaultCenterLat = position.coords.latitude;
        SiteLon = DefaultCenterLon = position.coords.longitude;
        if (loStore['geoFindMeFirstVisit'] == undefined && !(usp.has("lat") && usp.has("lon"))) {
            OLMap.getView().setCenter(ol.proj.fromLonLat([SiteLon, SiteLat]));
            loStore['geoFindMeFirstVisit'] = 'no';
            siteCircleLayer.setVisible(true);
        }
        initSitePos();
        console.log('Location from browser: '+ SiteLat +', ' + SiteLon);


        {
            // always update user location every 15 minutes
            clearInterval(geoFindInterval);
            geoFindInterval = window.setInterval(function() {
                if (tabHidden)
                    return;
                const geoposOptions = {
                    enableHighAccuracy: false,
                    timeout: 15 * 60 * 1000,
                    maximumAge: 5 * 60 * 1000 ,
                };
                navigator.geolocation.getCurrentPosition(onLocationChange, logArg, geoposOptions);
            }, 15 * 60 * 1000);
        }
    }

    function error() {
        console.log("Unable to query location.");
        initSitePos();
    }

    if (!navigator.geolocation) {
        console.log('Geolocation is not supported by your browser');
    } else {
        // change SitePos on location change
        console.log('Locating…');
        const geoposOptions = {
            enableHighAccuracy: false,
            timeout: Infinity,
            maximumAge: 300 * 1000,
        };
        navigator.geolocation.getCurrentPosition(success, error, geoposOptions);
    }
}

window.mobilecheck = function() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};

function initSitePos() {
    let lastSitePosition = SitePosition;
    // Set SitePosition
    if (SiteLat != null && SiteLon != null) {
        SitePosition = [SiteLon, SiteLat];
        // Add home marker if requested
        drawSiteCircle();
        createLocationDot();
    } else {
        TAR.planeMan.setColumnVis('distance', false);
    }

    if (!lastSitePosition) {
        if (SitePosition) {
            TAR.planeMan.cols.distance.sort();
        } else {
            TAR.planeMan.cols.altitude.sort();
            TAR.planeMan.cols.altitude.sort();
        }
    }
}

/*
function drawAlt() {
    processAircraft({hex: 'c0ffee', });
    let plane = Planes['c0ffee'];
    newWidth = 4;
    for (let i = 0; i <= 50000; i += 500) {
        plane.position = [i/10000, 0];
        plane.altitude = i;
        plane.alt_rounded = calcAltitudeRounded(plane.altitude);
        plane.updateTrack(now - i, now - i - 5000, { serverTrack: true });
    }
}
*/

function remakeTrails() {
    for (let i in PlanesOrdered) {
        PlanesOrdered[i].remakeTrail();
        PlanesOrdered[i].updateFeatures(true);
    }
}

function createLocationDot() {
    locationDotFeatures.clear();
    let markerStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 7,
            snapToPixel: false,
            fill: new ol.style.Fill({color: 'black'}),
            stroke: new ol.style.Stroke({
                color: 'white', width: 2
            })
        })
    });

    let feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(SitePosition)));
    feature.setStyle(markerStyle);
    locationDotFeatures.addFeature(feature);
}
function drawSiteCircle() {
    siteCircleFeatures.clear();

    if (!SitePosition)
        return;

    let circleColor = '#000000';

    for (let i = 0; i < SiteCirclesDistances.length; i++) {
        circleColor = i < SiteCirclesColors.length ? SiteCirclesColors[i] : circleColor;

        let conversionFactor = 1000.0;
        if (DisplayUnits === "nautical") {
            conversionFactor = 1852.0;
        } else if (DisplayUnits === "imperial") {
            conversionFactor = 1609.0;
        }

        let distance = SiteCirclesDistances[i] * conversionFactor;
        let circle = TAR.utils.make_geodesic_circle(SitePosition, distance, 180);
        circle.transform('EPSG:4326', 'EPSG:3857');
        let feature = new ol.Feature(circle);

        let circleStyle = new ol.style.Style({
            fill: null,
            stroke: new ol.style.Stroke({
                color: circleColor,
                lineDash: SiteCirclesLineDash,
                width: globalScale,
            }),
            text: new ol.style.Text({
                font: ((10 * globalScale) + 'px Helvetica Neue, Helvetica, Tahoma, Verdana, sans-serif'),
                fill: new ol.style.Fill({ color: '#000' }),
                offsetY: -8,
                text: format_distance_long(distance, DisplayUnits, 0),
            })
        });

        feature.setStyle(circleStyle);
        siteCircleFeatures.addFeature(feature);
    }
}

let calcOutlineFeatures = new ol.source.Vector();
let calcOutlineLayer;
function drawUpintheair() {
    // Add terrain-limit rings. To enable this:
    //
    //  create a panorama for your receiver location on heywhatsthat.com
    //
    //  note the "view" value from the URL at the top of the panorama
    //    i.e. the XXXX in http://www.heywhatsthat.com/?view=XXXX
    //
    // fetch a json file from the API for the altitudes you want to see:
    //
    //  wget -O /usr/local/share/tar1090/html/upintheair.json \
    //    'http://www.heywhatsthat.com/api/upintheair.json?id=XXXX&refraction=0.25&alts=3048,9144'
    //
    // NB: altitudes are in _meters_, you can specify a list of altitudes
    //
    if (!calcOutlineData)
        return;

    let data = calcOutlineData;
    for (let i = 0; i < data.rings.length; ++i) {
        let geom = null;
        let points = data.rings[i].points;
        let altitude = (3.28084 * data.rings[i].alt).toFixed(0);
        let color = range_outline_color;
        if (range_outline_colored_by_altitude) {
            let colorArr = altitudeColor(altitude);
            color = 'hsl(' + colorArr[0].toFixed(0) + ',' + colorArr[1].toFixed(0) + '%,' + colorArr[2].toFixed(0) + '%)';
        }
        let outlineStyle = new ol.style.Style({
            fill: null,
            stroke: new ol.style.Stroke({
                color: color,
                width: range_outline_width,
                lineDash: range_outline_dash,
            })
        });
        if (points.length > 0) {
            geom = new ol.geom.LineString([[ points[0][1], points[0][0] ]]);
            for (let j = 0; j < points.length; ++j) {
                geom.appendCoordinate([ points[j][1], points[j][0] ]);
            }
            geom.appendCoordinate([ points[0][1], points[0][0] ]);
            geom.transform('EPSG:4326', 'EPSG:3857');

            let feature = new ol.Feature(geom);
            feature.setStyle(outlineStyle);
            calcOutlineFeatures.addFeature(feature);
        }
    }
}
let actualOutlineLayer;
let actualOutlineFeatures;
let actualOutlineStyle;

function drawOutlineJson() {
    if (!receiverJson || !receiverJson.outlineJson)
        return;
    let request = jQuery.ajax({ url: 'data/outline.json',
        cache: false,
        dataType: 'json' });
    request.done(function(data) {
        actualOutlineFeatures.clear();
        let points;
        if (data.actualRange && data.actualRange.last24h) {
            points = data.actualRange.last24h.points;
        } else {
            points = data.points;
        }
        if (!points || !points.length)
            return;
        let geom = null;
        let lastLon = null;
        for (let j = 0; j < points.length + 1; ++j) {
            const k = j % points.length;
            const lat = points[k][0];
            const lon = points[k][1];
            const proj = ol.proj.fromLonLat([lon, lat]);
            if (!geom || (lastLon && Math.abs(lon - lastLon) > 270)) {
                geom = new ol.geom.LineString([proj]);
                actualOutlineFeatures.addFeature(new ol.Feature(geom));
            } else {
                geom.appendCoordinate(proj);
            }
            lastLon = lon;
        }
    });

    request.fail(function() {
        // no rings available, do nothing
    });
}

function gotoTime(timestamp) {
    clearTimeout(traceOpts.showTimeout);
    if (timestamp) {
        traceOpts.showTime = timestamp;
        traceOpts.animate = false;
    }
    if (!traceOpts.animate) {
        legShift(0);
    } else {
        let marker = SelectedPlane.glMarker || SelectedPlane.marker;
        if (marker) {

            traceOpts.animatePos[0] += (traceOpts.animateToLon - traceOpts.animateFromLon) / traceOpts.animateSteps;
            traceOpts.animatePos[1] += (traceOpts.animateToLat - traceOpts.animateFromLat) / traceOpts.animateSteps;

            SelectedPlane.updateMarker();
        }
        if (--traceOpts.animateCounter == 1) {
            traceOpts.animate = false;
            traceOpts.showTime = traceOpts.showTimeEnd;
            console.log(traceOpts.showTime);
        }

        traceOpts.animateStepTime = traceOpts.animateRealtime / traceOpts.replaySpeed / traceOpts.animateSteps;
        traceOpts.showTimeout = setTimeout(gotoTime, traceOpts.animateStepTime);
    }
}

function checkFollow() {
    if (!FollowSelected)
        return false;
    if (!SelectedPlane || !SelectedPlane.position) {
        toggleFollow(false);
        return false;
    }
    const center = OLMap.getView().getCenter();
    let proj = SelectedPlane.proj;

    if (!proj) {
        return false;
    }

    if (Math.abs(center[0] - proj[0]) > 1 ||
        Math.abs(center[1] - proj[1]) > 1)
    {
        toggleFollow(false);
        return false;
    }
    return true;
}

function everySecond() {
    if (traceRate > 0)
        traceRate = traceRate  * 0.985 - 1;
    updateIconCache();
}

let getTraceTimeout = null;
function getTrace(newPlane, hex, options) {

    if (options.list) {
        newPlane = options.list.pop()
        if (!newPlane) {
            return;
        }
        hex = newPlane.icao;
    }

    if (!newPlane) {
        newPlane = Planes[hex] || new PlaneObject(hex);
        newPlane.last_message_time = NaN;
        newPlane.position_time = NaN;
        select(newPlane, options);
    }

    let time = new Date().getTime();
    let backoff = 200;
    if (!showTrace && !solidT && traceRate > 140 && time < lastTraceGet + backoff) {
        clearTimeout(getTraceTimeout);
        getTraceTimeout = setTimeout(getTrace, lastTraceGet + backoff + 20 - time, newPlane, hex, options);
        return newPlane;
    }

    lastTraceGet = time;

    let URL1;
    let URL2;
    //console.log('Requesting trace: ' + hex);

    // use non historic traces until 60 min after midnight
    let today = new Date();
    if (
        (showTrace || replay) &&
        (
            !(today.getTime() > traceDate.getTime() && today.getTime() < traceDate.getTime() + (24 * 3600 + 60 * 60) * 1000)
            || trace_hist_only
        )
    ) {
        let dateString = traceDateString || zDateString(today);
        URL1 = null;
        URL2 = 'globe_history/' + dateString.replace(/-/g, '/') + '/traces/' + hex.slice(-2) + '/trace_full_' + hex + '.json';
        traceRate += 3;
    } else {
        URL1 = 'data/traces/'+ hex.slice(-2) + '/trace_recent_' + hex + '.json';
        URL2 = 'data/traces/'+ hex.slice(-2) + '/trace_full_' + hex + '.json';
        traceRate += 2;
    }

    traceOpts.follow = (options.follow == true);

    if (showTrace) {
        //console.log(today.toUTCString() + ' ' + traceDate.toUTCString());

        if (traceOpts.startHours == null || traceOpts.startHours < 0)
            traceOpts.startStamp = traceDate.getTime() / 1000;
        else
            traceOpts.startStamp = traceDate.getTime() / 1000 + traceOpts.startHours * 3600 + traceOpts.startMinutes * 60 + traceOpts.startSeconds;

        if (traceOpts.endHours == null || traceOpts.endHours >= 24)
            traceOpts.endStamp = traceDate.getTime() / 1000 + 24 * 3600;
        else
            traceOpts.endStamp = traceDate.getTime() / 1000 + traceOpts.endHours * 3600 + traceOpts.endMinutes * 60 + traceOpts.endSeconds;
    }

    if (newPlane && (showTrace || showTraceExit)) {
        newPlane.trace = [];
        newPlane.recentTrace = null;
        newPlane.fullTrace = null;
    }

    //console.log(URL2);

    //options = JSON.parse(JSON.stringify(options));
    options.plane = `${newPlane.icao}`;
    options.defer = jQuery.Deferred();

    if (URL1 && !options.onlyFull) {
        jQuery.ajax({ url: `${URL1}`,
            dataType: 'json',
            options: options,
        })
            .done(function(data) {
                const options = this.options;
                const plane = Planes[options.plane];
                plane.recentTrace = normalizeTraceStamps(data);
                if (!showTrace) {
                    plane.processTrace();
                    if (options.follow)
                        toggleFollow(true);
                }
                options.defer.resolve(options);
                if (options.onlyRecent && options.list) {
                    newPlane.updateLines();
                    getTrace(null, null, options);
                }
                this.options = null;
            });
    } else {
        options.defer.resolve(options);
    }

    if (options.onlyRecent)
        return newPlane;

    jQuery.ajax({ url: `${URL2}`,
        dataType: 'json',
        options: options,
    })
        .done(function(data) {
        const options = this.options;
        const plane = Planes[options.plane];
        plane.fullTrace = normalizeTraceStamps(data);
        options.defer.done(function(options) {
            const plane = Planes[options.plane];
            if (showTrace) {
                legShift(0, plane);
                if (!multiSelect) {
                    gotoTime(showTraceTimestamp);
                }
            } else {
                plane.processTrace();
                if (options.follow)
                    toggleFollow(true);
            }
        });
        if (options.list) {
            newPlane.updateLines();
            getTrace(null, null, options);
        }
        options.defer = null;
        this.options = null;
    })
        .fail(function() {
        const options = this.options;
        const plane = Planes[options.plane];
        if (showTrace)
            legShift(0, plane);
        else
            plane.processTrace();

        if (options.list) {
            getTrace(null, null, options);
        } else {
            plane.getAircraftData();
            refreshSelected();
        }
        this.options = null;
    });

    return newPlane;
}

function initHeatmap() {
    heatmap.init = false;
    if (heatFeatures.length == 0) {
        for (let i = 0; i < heatFeaturesSpread; i++) {
            heatFeatures.push(new ol.source.Vector());
            heatLayers.push(new ol.layer.Vector({
                name: ('heatLayer' + i),
                isTrail: true,
                source: heatFeatures[i],
                declutter: (heatmap.declutter ? true : false),
                zIndex: 150,
                renderOrder: null,
                renderBuffer: 5,
            }));
            trailGroup.push(heatLayers[i]);
        }
    }
    realHeat = new ol.layer.Heatmap({
        source: realHeatFeatures,
        name: realHeat,
        isTrail: true,
        zIndex: 150,
        weight: x => heatmap.weight,
        radius: heatmap.radius,
        blur: heatmap.blur,
    });
    trailGroup.push(realHeat);
}

function setSize(set) {
    let count = 0;
    for (const i in set.values())
        count++;
    return count;
}

function drawHeatmap() {
    if (!heatmap)
        return;
    if (heatmap.init) {
        initHeatmap();
    }

    console.time("drawHeat");

    let ext = myExtent(OLMap.getView().calculateExtent(OLMap.getSize()));
    let maxLat = ext.maxLat * 1000000;
    let minLat = ext.minLat * 1000000;

    webglFeatures.clear();
    for (let i = 0; i < heatFeaturesSpread; i++)
        heatFeatures[i].clear();
    realHeatFeatures.clear();

    let pointCount = 0;
    let features = [];
    if (lineStyleCache["scale"] != globalScale) {
        lineStyleCache = {};
        lineStyleCache["scale"] = globalScale;
    }
    let done = new Set();
    let iterations = 0;
    let maxIter = 1000 * 1000;


    let tempPoints = [];
    for (let k = 0; k < heatChunks.length; k++) {
        if (heatPoints[k] != null) {
            true; // do nothing
        } else if (heatChunks[k] != null) {
            if (heatChunks[k].byteLength % 16 != 0) {
                console.log("Invalid heatmap file (byteLength): " + k);
                continue;
            }
            let points = heatPoints[k] = new Int32Array(heatChunks[k]);
            let found = 0;
            for (let i = 0; i < points.length; i += 4) {
                if (points[i] == 0xe7f7c9d) {
                    found = 1;
                    break;
                }
            }
            if (!found) {
                heatPoints[k] = heatChunks[k] = null;
                console.log("Invalid heatmap file (magic number): " + k);
            }
        } else {
            continue;
        }
        tempPoints.push(heatPoints[k]);
    }

    //console.log('tempPoints.length: ' + tempPoints.length);
    let myPoints = [];
    if (tempPoints.length <= 2) {
        myPoints = tempPoints;
    } else {
        let len = tempPoints.length;
        let arr1 = tempPoints.splice(0, Math.round(tempPoints.length / 3));
        let arr2 = tempPoints.splice(0, Math.round(tempPoints.length / 2));
        let arr3 = tempPoints;
        myPoints.push(arr2.splice(0, 1));
        myPoints.push(arr3.splice(0, 1));
        myPoints.push(arr1.splice(0, 1));
        len -= 3;
        for (let i = 0; i < Math.ceil(len / 3); i++) {
            myPoints.push(arr2.splice(0, 1));
            myPoints.push(arr3.splice(0, 1));
            myPoints.push(arr1.splice(0, 1));
        }
    }
    myPoints = myPoints.flat();

    //console.log('myPoints.length: ' + myPoints.length);

    let indexes = [];
    for (let k = 0; k < myPoints.length; k++) {
        let points = myPoints[k];
        let index = [];
        let i = 0;
        if (!points)
            continue;
        while(points[i] != 0xe7f7c9d && i < points.length) {
            index.push(points[i]);
            //console.log(points[i]);
            i += 4;
        }
        if (!heatmap.lines)
            index.sort((a, b) => (Math.random() - 0.5));
        indexes.push(index);
    }

    let offsets = Array(myPoints.length).fill(0);

    while (pointCount < heatmap.max && done.size < myPoints.length && iterations++ < maxIter) {
        for (let k = 0; k < myPoints.length && pointCount < heatmap.max; k++) {

            if (offsets[k] > indexes[k].length) {
                continue;
            }
            if (offsets[k] == indexes[k].length) {
                done.add(k);
                offsets[k]++;
                continue;
            }

            let points = myPoints[k];

            let i = 4 * indexes[k][offsets[k]];

            if (points[i] == 0xe7f7c9d)
                i += 4;

            if (i < 0) {
                console.log('wat ' + i);
                break;
            }
            for (; i < points.length; i += 4) {
                if (points[i] == 0xe7f7c9d)
                    break;
                let lat = points[i+1];
                if (lat > maxLat || lat < minLat)
                    continue;

                lat /= 1000000;
                let lon = points[i + 2] / 1000000;
                let pos = [lon, lat];

                if (!inView(pos, ext))
                    continue;

                let alt = points[i + 3] & 65535;
                if (alt & 32768)
                    alt |= -65536;
                if (alt == -123)
                    alt = 'ground';
                else
                    alt *= 25;

                let gs = points[i + 3] >> 16;
                if (gs == -1)
                    gs = null;
                else
                    gs /= 10;

                if (PlaneFilter.enabled && altFiltered(alt))
                    continue;

                pointCount++;
                //console.log(pos);

                alt = calcAltitudeRounded(alt);
                let projHere = ol.proj.fromLonLat(pos);
                let style = lineStyleCache[alt];
                let hsl = altitudeColor(alt);
                hsl[1] = hsl[1] * 0.85;
                hsl[2] = hsl[2] * 0.8;
                if (!style) {
                    let col;
                    if (heatmap.alpha == null)
                        col = hslToRgb(hsl);
                    else
                        col = hslToRgb(hsl, heatmap.alpha);

                    style = new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: heatmap.radius * globalScale,
                            fill: new ol.style.Fill({
                                color: col,
                            }),
                        }),
                        zIndex: i,
                    });
                    lineStyleCache[alt] = style;
                }
                let feat = new ol.Feature(new ol.geom.Point(projHere));
                if (webgl) {
                    let rgb = hslToRgb(hsl, 'array');
                    feat.set('r', rgb[0]);
                    feat.set('g', rgb[1]);
                    feat.set('b', rgb[2]);
                } else {
                    feat.setStyle(style);
                }
                features.push(feat);
                //console.log(alt);
            }
            offsets[k] += 1;
        }
    }
    if (iterations >= maxIter)
        console.log("drawHeatmap: MAX_ITERATIONS!");
    //console.log(setSize(done));
    console.log("files: " + myPoints.length + ", points drawn: " + pointCount);
    if (heatmap.real) {
        realHeatFeatures.addFeatures(features);
    } else {

        if (webgl) {
            webglFeatures.addFeatures(features);
        } else {
            for (let i = 0; i < heatFeaturesSpread; i++) {

                heatFeatures[i].addFeatures(features.splice(0, pointCount / heatFeaturesSpread + 1));
                //console.log(features.length);
            }
        }
    }
    console.timeEnd("drawHeat");
    jQuery("#loader").addClass("hidden");
}

function currentExtent(factor) {
    let size = OLMap.getSize();
    if (factor != null)
        size = [size[0] * factor, size[1] * factor];
    return myExtent(OLMap.getView().calculateExtent(size));
}

function replayDefaults(ts) {
    jQuery("#replayPlay").html("Pause");
    return {
        playing: true,
        ts: ts,
        ival: 60 * 1000,
        speed: 30,
        dateText: zDateString(ts),
        hours: ts.getUTCHours(),
        minutes: ts.getUTCMinutes(),
    };
}

function replayClear() {
    clearTimeout(refreshId);
    reaper(true);
    refreshFilter();
}

let replayData;
let replayDataKey;
function loadReplay(ts) {
    if (isNaN(ts.getTime())) {
        ts = new Date();
    }
    let lastAvailable = new Date();
    lastAvailable.setUTCMinutes(Math.floor(lastAvailable.getUTCMinutes() / 30) * 30);
    lastAvailable.setUTCSeconds(0);
    lastAvailable = lastAvailable.getTime() - 10 * 1000;
    if (ts.getTime() > lastAvailable) {
        ts = new Date(lastAvailable);
        ts.setUTCMinutes(Math.floor(ts.getUTCMinutes() / 30) * 30 + 1);
        ts.setUTCSeconds(0);
        console.log('not available, using this time: ' + ts);
        replayClear();
    }
    replay.ts = ts;
    replaySetTimeHint();

    let time = new Date(ts);
    let sDate = sDateString(time);
    let index = 2 * time.getUTCHours() + Math.floor(time.getUTCMinutes() / 30);

    let rKey = sDate + index;
    if (rKey == replayDataKey) {
        initReplay(replayData);
    } else {
        let req = jQuery.ajax({
            url: "globe_history/" + sDate + "/heatmap/" + index.toString().padStart(2, '0') + ".bin.ttf",
            method: 'GET',
            xhr: arraybufferRequest,
            rKey: rKey,
        });

        setTraceDate({ts: ts});

        req.done(function(data) {
            if (!data) {
                console.log("initReplay: no data!");
                return;
            }
            replayData = data;
            replayDataKey = this.rKey;
            initReplay(data);
        });
        req.fail(function(jqxhr, status, error) {
            jQuery("#update_error_detail").text(jqxhr.status + ' --> No data for this timestamp!');
            jQuery("#update_error").css('display','block');
            setTimeout(function() {jQuery("#update_error").css('display','none');}, 5000);
        });
    }
}
function initReplay(data) {
    if (data.byteLength % 16 != 0) {
        console.log("Invalid heatmap file (byteLength)");
        return;
    }
    let points = new Int32Array(data);
    let pointsU = new Uint32Array(data);
    let pointsU8 = new Uint8Array(data);
    let found = 0;
    replay.slices = [];
    for (let i = 0; i < points.length; i += 4) {
        if (points[i] == 0xe7f7c9d) {
            found = 1;
            replay.slices.push(i);
        }
    }
    if (!found) {
        console.log("Invalid heatmap file (magic number)");
        replay.points = null;
        replay.pointsU = null;
        replay.pointsU8 = null;
        return;
    }
    replay.points = points;
    replay.pointsU = pointsU;
    replay.pointsU8 = pointsU8;

    refreshFilter();

    replay.ival = (replay.pointsU[replay.slices[0] + 3] & 65535) / 1000;
    replay.halfHour = (replay.ts.getUTCMinutes() >= 30) ? 1 : 0;
    let index = Math.round (((replay.ts.getUTCMinutes() % 30) * 60 + replay.ts.getUTCSeconds()) / replay.ival);
    //console.log("init with index" + replay.index);
    if (index > 0) {
        if (false && index > 1) {
            replay.index = 0
            replayStep("fast");
        }
        replay.index = index - 1;
        replayStep("fast");
    }
    replay.index = index;
    replayStep();
}

function replayOnSliderMove() {
    clearTimeout(refreshId);

    let date = new Date(replay.dateText);
    date.setUTCHours(Number(replay.hours));
    date.setUTCMinutes(Number(replay.minutes));
    replay.seconds = 0;
    date.setUTCSeconds(Number(replay.seconds));
    if (true || utcTimesHistoric) {
        jQuery("#replayDateHint").html("Date: " + zDateString(date));
        jQuery("#replayTimeHint").html("Time: " + zuluTime(date) + NBSP + 'Z');
    } else {
        jQuery("#replayDateHint").html("Date: " + lDateString(date));
        jQuery("#replayTimeHint").html("Time: " + localTime(date) + NBSP + TIMEZONE);
    }
}
let replayJumpEnabled = true;
function replayJump() {
    if (!showingReplayBar)
        return;
    if (!replayJumpEnabled)
        return;
    let date = new Date(replay.dateText);
    date.setUTCHours(Number(replay.hours));
    date.setUTCMinutes(Number(replay.minutes));
    date.setUTCSeconds(Number(replay.seconds));

    let ts = new Date(replay.ts.getTime());

    // diff less 10 seconds
    if (Math.abs(date.getTime() - ts.getTime()) < 10000) {
        return;
    }
    //console.log(replay.minutes.toString() + ' ' + ts.toString() + ' ' + (date.getTime() - ts.getTime()).toString());

    //console.trace();
    console.log('jump: ' + date.toUTCString());

    replayClear();
    loadReplay(date);
}
function replaySetTimeHint(arg) {
    replayJumpEnabled = false;
    let dateString;
    let timeString;
    if (true || utcTimesHistoric) {
        dateString = zDateString(replay.ts);
        timeString = zuluTime(replay.ts) + NBSP + 'Z';
    } else {
        dateString = lDateString(replay.ts);
        timeString = localTime(replay.ts) + NBSP + TIMEZONE;
    }
    jQuery("#replayDateHint").html("Date: " + dateString);
    jQuery("#replayTimeHint").html("Time: " + timeString);
    jQuery("#replayDatepicker").datepicker('setDate', dateString);


    let hours = replay.ts.getUTCHours();
    jQuery('#hourSelect').slider("option", "value", hours);

    let minutes = replay.ts.getUTCMinutes();
    jQuery('#minuteSelect').slider("option", "value", minutes);
    replayJumpEnabled = true;
}

function replayStep(arg) {
    if (!replay || showTrace) {
        return;
    }

    if (replay.playing) {
        clearTimeout(refreshId);
        refreshId = setTimeout(replayStep, replay.ival / replay.speed * 1000);
    }

    if (isNaN(replay.ts.getTime())) {
        loadReplay(new Date());
        return;
    }
    let index = replay.index;
    if (index >= replay.slices.length) {
        console.log('next half hour');
        let date = new Date(replay.ts.getTime() + 30 * 60 * 1000);
        date.setUTCMinutes(Math.floor(date.getUTCMinutes() / 30) * 30);
        date.setUTCSeconds(0);
        clearTimeout(refreshId);
        loadReplay(date);
        return;
    }

    let minutes = replay.halfHour * 30 + Math.floor(replay.ival * index / 60);
    let seconds = (replay.ival * index) % 60;
    //console.log(minutes.toString() + ' ' + seconds.toString());
    replay.ts.setUTCMinutes(minutes)
    replay.ts.setUTCSeconds(seconds)

    replay.hours = replay.ts.getUTCHours();
    replay.minutes = minutes;
    replay.seconds = seconds;

    let points = replay.points;
    let pointsU = replay.pointsU;
    let i = replay.slices[index];

    //console.log('index: ' + index + ', i: ' + i);

    last = now;
    now = replay.pointsU[i + 2] / 1000 + replay.pointsU[i + 1] * 4294967.296;

    traceOpts.endStamp = now + replay.ival;

    replay.ival = (replay.pointsU[i + 3] & 65535) / 1000;

    if (arg != 'fast') {
        replaySetTimeHint();
        updateAddressBar();
        if (index % 5 == 0) {
            console.log(replay.ts.toUTCString());
            reaper();
        }
    }

    i += 4;

    let ext = currentExtent(1.4);
    ext.maxLat *= 1e6;
    ext.maxLon *= 1e6;
    ext.minLat *= 1e6;
    ext.minLon *= 1e6;
    for (; i < points.length && points[i] != 0xe7f7c9d; i += 4) {
        let lat = points[i + 1];
        let lon = points[i + 2];
        let pos = [lon, lat];
        if (lat >= 1073741824) {
            let ac = {seen:0, seen_pos:0,};
            ac.hex = (points[i] & ((1<<24) - 1)).toString(16).padStart(6, '0');
            ac.hex = (points[i] & (1<<24)) ? ('~' + ac.hex) : ac.hex;
            ac.flight = "";
            if (replay.pointsU8[4 * (i + 2)] != 0) {
                for (let j = 0; j < 8; j++) {
                    ac.flight += String.fromCharCode(replay.pointsU8[4 * (i + 2) + j]);
                }
            }
            ac.squawk = (lat & 0xFFFF).toString(10).padStart(4, '0');
            processAircraft(ac, false, false);
            continue;
        }
        if (!inView(pos, ext)) {
            continue;
        }

        lat /= 1e6;
        lon /= 1e6;
        pos = [lon, lat];

        let type = (pointsU[i] >> 27) & 0x1F;
        switch (type) {
            case  0: type = 'adsb_icao';        break;
            case  1: type = 'adsb_icao_nt';     break;
            case  2: type = 'adsr_icao';        break;
            case  3: type = 'tisb_icao';        break;
            case  4: type = 'adsc';             break;
            case  5: type = 'mlat';             break;
            case  6: type = 'other';            break;
            case  7: type = 'mode_s';           break;
            case  8: type = 'adsb_other';       break;
            case  9: type = 'adsr_other';       break;
            case 10: type = 'tisb_trackfile';   break;
            case 11: type = 'tisb_other';       break;
            case 12: type = 'mode_ac';          break;
            default: type = 'unknown';
        }
        let hex = (pointsU[i] & 0xFFFFFF).toString(16).padStart(6, '0');
        hex = (pointsU[i] & 0x1000000) ? ('~' + hex) : hex;

        if (icaoFilter && !icaoFilter.includes(hex))
            continue;

        let alt = points[i + 3] & 65535;
        if (alt & 32768)
            alt |= -65536;
        if (alt == -123)
            alt = 'ground';
        else
            alt *= 25;

        let gs = points[i + 3] >> 16;
        if (gs == -1)
            gs = null;
        else
            gs /= 10;

        let ac = {
            seen: 0,
            seen_pos: 0,
            hex: hex,
            lat: lat,
            lon: lon,
            alt_baro: alt,
            gs: gs,
            type: type,
        };
        processAircraft(ac, false, false);
    }

    if (arg != "fast") {
        triggerRefresh = 1;
        checkMovement();
        checkRefresh();
    }
    replay.index = index + 1;
}

function updateIconCache() {
    let item;
    let tryAgain = [];
    while(item = addToIconCache.pop()) {
        let svgKey = item[0];
        let element = item[1];
        if (iconCache[svgKey] != undefined) {
            continue;
        }
        if (!element) {
            element = new Image();
            element.src = item[2];
            item[1] = element;
            tryAgain.push(item);
            continue;
        }
        if (!element.complete) {
            console.log("moep");
            tryAgain.push(item);
            continue;
        }

        iconCache[svgKey] = element;
    }
    addToIconCache = tryAgain;
}

function getInactive() {
    return (new Date().getTime() - lastActive) / 1000;
}

function active() {
    lastActive = new Date().getTime();
}

function drawTileBorder(data) {
    let southWest = ol.proj.fromLonLat([data.west, data.south]);
    let south180p = ol.proj.fromLonLat([180, data.south]);
    let south180m = ol.proj.fromLonLat([-180, data.south]);
    let southEast = ol.proj.fromLonLat([data.east, data.south]);
    let northEast = ol.proj.fromLonLat([data.east, data.north]);
    let north180p = ol.proj.fromLonLat([180, data.north]);
    let north180m = ol.proj.fromLonLat([-180, data.north]);
    let northWest = ol.proj.fromLonLat([data.west, data.north]);
    const estimateStyle = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#303030',
            width: 1.5,
        })
    });
    if (data.west < data.east) {
        let tile = new ol.geom.LineString([southWest, southEast, northEast, northWest, southWest]);
        let tileFeature = new ol.Feature(tile);
        tileFeature.setStyle(estimateStyle);
        siteCircleFeatures.addFeature(tileFeature);
    } else {
        let west = new ol.geom.LineString([south180p, southWest, northWest, north180p]);
        let east = new ol.geom.LineString([south180m, southEast, northEast, north180m]);
        let westF = new ol.Feature(west);
        let eastF = new ol.Feature(east);
        westF.setStyle(estimateStyle);
        eastF.setStyle(estimateStyle);
        siteCircleFeatures.addFeature(westF);
        siteCircleFeatures.addFeature(eastF);
    }
}

function updateMessageRate(data) {
    if (data.messages && data.messages > 1) {
        // Detect stats reset
        if (MessageCountHistory.length > 0 && MessageCountHistory[MessageCountHistory.length-1].messages > data.messages) {
            MessageCountHistory = [];
        }

        // Note the message count in the history
        MessageCountHistory.push({ 'time' : data.now, 'messages' : data.messages});

        if (MessageCountHistory.length > 1) {
            let message_time_delta = MessageCountHistory[MessageCountHistory.length-1].time - MessageCountHistory[0].time;
            let message_count_delta = MessageCountHistory[MessageCountHistory.length-1].messages - MessageCountHistory[0].messages;
            if (message_time_delta > 0)
                MessageRate = message_count_delta / message_time_delta;
        }

        // .. and clean up any old values
        if ((now - MessageCountHistory[0].time) > 10)
            MessageCountHistory.shift();
    } else if (uuid != null) {
        const cache = uuidCache[data.urlIndex] || { now: 0 };
        let time_delta = now - cache.now;
        if (time_delta > 0.5) {
            let newCache = uuidCache[data.urlIndex] = { now: now };
            let message_delta = 0;
            let acs = data.aircraft;
            for (let j=0; j < acs.length; j++) {
                const hex = acs[j].hex;
                const messages = acs[j].messages
                let cachedMessages = cache[hex];
                if (cachedMessages) {
                    message_delta += (messages - cachedMessages);
                }
                newCache[hex] = messages;
            }
            newCache.rate = message_delta / time_delta;
        }
        MessageRate = 0;
        for (let i in uuidCache) {
            const c = uuidCache[i];
            MessageRate += c ? c.rate : 0;
        }
    } else {
        MessageRate = null;
    }
}
function playReplay(state){
    if (!replay){
        return;
    }
    if (state) {
        replay.playing = true;
        jQuery("#replayPlay").html("Pause");
        replayStep();
    } else {
        replay.playing = false;
        jQuery("#replayPlay").html("Play");
        clearTimeout(refreshId);
    }
};

function showReplayBar(){
    console.log('showReplayBar()');
    if (showingReplayBar){
        // If you can see it, hide it
        jQuery("#replayBar").hide();
        showingReplayBar = false;
        replay = null;
        jQuery('#map_canvas').height('100%');
        jQuery('#sidebar_canvas').height('100%');
    } else {
        // If it's hidden, show it and change the currently selected date to be an hour ago
        jQuery("#replayBar").show();
        jQuery("#replayBar").css('display', 'grid');
        jQuery('#replayBar').height('100px');
        jQuery('#map_canvas').height('calc(100% - 100px)');
        jQuery('#sidebar_canvas').height('calc(100% - 110px)');
        if (!replay) {
            replay = replayDefaults(new Date());
            replay.playing = false;
        }
        //ts.setUTCMinutes((parseInt((ts.getUTCMinutes() + 7.5)/15) * 15) % 60);
        jQuery("#replayDatepicker").datepicker({
            maxDate: '+1d',
            dateFormat: "yy-mm-dd",
            autoSize: true,
            onClose: !onMobile ? null : function(dateText, inst){
                jQuery("replayDatepicker").attr("disabled", false);
            },
            beforeShow: !onMobile ? null : function(input, inst){
                jQuery("replayDatepicker").attr("disabled", true);
            },
            onSelect: function(dateText) {
                replay.dateText = dateText;
                replayJump();
            }
        });

        jQuery('#hourSelect').slider({
            step: 1,
            min: 0,
            max: 23,
            slide: function(event, ui) {
                replay.hours = ui.value;
                replayOnSliderMove();
            },
            change: function() {
                replayJump();
            }
        });
        jQuery('#minuteSelect').slider({
            step: 1,
            min: 0,
            max: 59,
            slide: function(event, ui) {
                replay.minutes = ui.value;
                replayOnSliderMove();
            },
            change: function() {
                replayJump();
            }
        });
        const slideBase = 3.0;
        jQuery('#replaySpeedSelect').slider({
            value: Math.pow(replay.speed, 1 / slideBase),
            step: 0.07,
            min: Math.pow(1, 1 / slideBase),
            max: Math.pow(250, 1 / slideBase),
            slide: function(event, ui) {
                replay.speed = Math.pow(ui.value, slideBase).toFixed(1);
                jQuery('#replaySpeedHint').text('Speed: ' + replay.speed + 'x');
            },
            change: function(event, ui) {
                replayStep();
            },
        });
        jQuery('#replaySpeedHint').text('Speed: ' + replay.speed + 'x');
        showingReplayBar = true;
    }
};

function timeoutFetch() {
    fetchData();
    timers.checkMove = setTimeout(timeoutFetch, Math.max(RefreshInterval, 10000));
    if (lastReap - now > 90000)
        reaper();
}

function handleVisibilityChange() {
    const prevHidden = tabHidden;
    if (document[hideName])
        tabHidden = true;
    else
        tabHidden = false;

    if (tabHidden) {
        clearIntervalTimers();
        if (!globeIndex) {
            timeoutFetch();
        }
    }

    // tab is no longer hidden
    if (!tabHidden && prevHidden) {

        globeRateUpdate();
        clearIntervalTimers();
        setIntervalTimers();

        active();

        refresh();
        fetchData();

        if (showTrace)
            return;
        if (heatmap)
            return;

        if (!globeIndex)
            return;

        let count = 0;
        if (multiSelect && !SelectedAllPlanes) {
            for (let i = 0; i < PlanesOrdered.length; ++i) {
                let plane = PlanesOrdered[i];
                if (plane.selected) {
                    getTrace(plane, plane.icao, {});
                    if (count++ > 20)
                        break;
                }
            }
        } else if (SelectedPlane) {
            getTrace(SelectedPlane, SelectedPlane.icao, {});
        }
    }
}

let hideName;
function initVisibilityChange() {
    // Set the name of the hidden property and the change event for visibility
    let visibilityChange;
    if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
        hideName = "hidden";
        visibilityChange = "visibilitychange";
    } else if (typeof document.msHidden !== "undefined") {
        hideName = "msHidden";
        visibilityChange = "msvisibilitychange";
    } else if (typeof document.webkitHidden !== "undefined") {
        hideName = "webkitHidden";
        visibilityChange = "webkitvisibilitychange";
    }
    // Warn if the browser doesn't support addEventListener or the Page Visibility API
    if (typeof document.addEventListener === "undefined" || hideName === undefined) {
        console.log("hidden tab handler requires a browser that supports the Page Visibility API.");
    } else {
        // Handle page visibility change
        document.addEventListener(visibilityChange, handleVisibilityChange, false);
    }
    handleVisibilityChange();
}
// for debugging visibilitychange:
function testHide() {
    Object.defineProperty(window.document,'hidden',{get:function(){return true;},configurable:true});
    Object.defineProperty(window.document,'visibilityState',{get:function(){return 'hidden';},configurable:true});
    window.document.dispatchEvent(new Event('visibilitychange'));
}
function testUnhide() {
    Object.defineProperty(window.document,'hidden',{get:function(){return false;},configurable:true});
    Object.defineProperty(window.document,'visibilityState',{get:function(){return 'visible';},configurable:true});
    window.document.dispatchEvent(new Event('visibilitychange'));
}

function selectClosest() {
    if (!loadFinished)
        return;
    let closest = null;
    let closestDistance = null;
    checkMovement();
    for (let key in PlanesOrdered) {
        const plane = PlanesOrdered[key];
        if (!closest)
            closest = plane;
        if (plane.position == null || !plane.visible)
            continue;
        const dist = ol.sphere.getDistance([CenterLon, CenterLat], plane.position);
        if (dist == null || isNaN(dist))
            continue;
        if (closestDistance == null || dist < closestDistance) {
            closestDistance = dist;
            closest = plane;
        }
    }
    if (!closest)
        return;
    selectPlaneByHex(closest.icao, {noDeselect: true, follow: FollowSelected,});
}
function setAutoselect() {
    clearInterval(timers.autoselect);
    if (!autoselect)
        return;
    timers.autoselect = window.setInterval(selectClosest, 5000);
    selectClosest();
}
function registrationLink(plane) {
    if (plane.icaorange.country === 'Brazil') {
        return `https://sistemas.anac.gov.br/aeronaves/cons_rab_resposta_en.asp?textMarca=${plane.registration}`;
    } else {
        return '';
    }
}


//simple jquery plugin to only update the text when it changes
jQuery.fn.updateText = function (text) {
    this.text() !== String(text) && this.text(text);
}

function zeroPad(num, size) {
    var s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

// Converts "hiccup"-style structures (https://github.com/weavejester/hiccup)
// to XML.
function hiccup(node) {
    if (Array.isArray(node)) {
        const [tag, attribs, ...children] = node;
        let attribStrings = [];
        for (const prop in attribs) {
            if (!attribs.hasOwnProperty(prop) || attribs[prop] === undefined) {
                continue;
            }
            attribStrings.push(`${prop}="${attribs[prop]}"`);
        }
        let xml = `<${tag} ${attribStrings.join(' ')}>`;
        for (const child of children) {
            xml += hiccup(child);
        }
        xml += `</${tag}>\n`;
        return xml;
    } else {
        return '' + node;
    }
}

// Prompts a browser to download a data: URL.
function download(name, contentType, data) {
    var link = document.createElement("a");
    link.download = name;
    link.href = 'data:' + contentType + ',' + encodeURIComponent(data);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function baseExportFilenameForAircrafts(aircrafts) {
    return aircrafts.map((a) => (a.registration || a.icao).toUpperCase()).join('-');
}

// Returns an array of {pos, alt, ts} for an aircraft.
function coordsForExport(plane) {
    let coords = [];
    let numSegs = plane.track_linesegs.length;
    for (let i = 0; i < numSegs; i++) {
        const pos = plane.track_linesegs[i].position;
        if (pos) {
            let alt = null;
            if (plane.track_linesegs[i].alt_geom != null) {
                alt = plane.track_linesegs[i].alt_geom;
                alt = Math.round(alt * 0.3048); // convert ft to m
            } else if (plane.track_linesegs[i].alt_real != null) {
                alt = plane.track_linesegs[i].alt_real;
                // Attempt to correct altitude. This could be better?
                //
                // 950 feet is the correction factor for an altimeter of 30.15.
                // 25 feet is the quantum of transponder reporting. 0 altitude
                // could be reported as -25, so just add 25.
                alt = (alt + 950 + 25) * 0.3048;
            }
            if (plane.track_linesegs[i].ground) {
                alt = "ground";
            } else if (alt != null && egmLoaded) {
                // alt is in meters at this point
                alt = Math.round(egm96.ellipsoidToEgm96(pos[1], pos[0], alt));
            }

            const ts = new Date(plane.track_linesegs[i].ts * 1000.0);
            if (alt == null) {
                console.log(`Skipping, no altitude: ${i} ${pos} ${ts}`);
                continue;
            }
            //console.log(`exporting coord: ${i} ${pos} ${alt} ${ts}`);
            coords.push({ pos: pos, alt: alt, ts: ts});
        } else {
            console.log(`Skipping ${i}`);
        }
    }
    return coords;
}

// We use this to give each aircraft a different color track in a
// multi-select export scenario. From colorbrewer, but I moved the red
// to be first.
const EXPORT_RGB_COLORS = [
    'e31a1c',
    'a6cee3',
    '1f78b4',
    'b2df8a',
    '33a02c',
    'fb9a99',
    'fdbf6f',
    'ff7f00',
    'cab2d6',
    '6a3d9a',
    'ffff99',
    'b15928'
];

// Converts "rrggbb" colors to KML format, "aabbggrr".
function RGBColorToKMLColor(c) {
    return 'ff' + c.substring(4, 6) + c.substring(2, 4) + c.substring(0, 2);
}

// Returns an array of selected planes, ordered by registration-or-ICAO.
function selectedPlanes() {
    const planes = [];
    for (let key in Planes) {
        if (Planes[key].selected) {
            planes.push(Planes[key]);
        }
    }
    planes.sort((a, b) => {
        const keyA = (a.registration || a.icao).toUpperCase();
        const keyB = (b.registration || b.icao).toUpperCase();
        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
        return 0;
    });
    return planes;
}

// Exports currently selected aircraft as KML.

let egmScript = null;
let egmLoaded = false;
function loadEGM() {
    if (egmScript) {
        return null;
    }
    egmScript = document.createElement('script');
    egmScript.src = "libs/egm96-universal-1.1.0.min.js";
    egmScript.addEventListener('load', function() {
        egmLoaded = true;
    });
    document.body.appendChild(egmScript);
    return egmScript;
}
function adjust_geom_alt(alt, pos) {
    if (geomUseEGM && egmLoaded) {
        if (alt == null) {
            return alt;
        }
        return egm96.ellipsoidToEgm96(pos[1], pos[0], alt * 0.3048) / 0.3048;
    } else {
        return alt;
    }
}
function exportKML() {
    if (!egmLoaded) {
        let egm = loadEGM()
        if (egm) {
            egm.addEventListener('load', function() {
                exportKML();
            });
        }
        return;
    }

    const planes = selectedPlanes();
    const folders = [];
    for (let planeIndex = 0; planeIndex < planes.length; planeIndex++) {
        const plane = planes[planeIndex];
        let folder = ["Folder", {},
            ["name", {}, `${(plane.registration || plane.icao).toUpperCase()} track`]
        ];
        const coords = coordsForExport(plane);
        let sections = [];
        let currentSection = null;
        let lastGround = null;
        let lastC = null;
        for (let i in coords) {
            const c = coords[i];
            const ground = (c.alt == "ground");
            if (ground !== lastGround) {
                // when changing between airborne and ground, create new section
                if (lastC && currentSection) {
                    // double up last coordinate to work around strange google earth transparency
                    currentSection.coords.push(lastC);
                }
                currentSection = { ground: ground, coords: [] };
                sections.push(currentSection);
            }
            lastGround = ground;
            if (ground) {
                c.alt = 0; // set KML altitude to zero
            }
            currentSection.coords.push(c);
            lastC = c;
        }
        if (lastC && currentSection) {
            // double up last coordinate to work around strange google earth transparency
            currentSection.coords.push(lastC);
        }
        for (let i in sections) {
            console.log("section " + i);
            const s = sections[i];
            const coords = s.coords;
            const ground = s.ground;
            const whenObjs = coords.map((c) => {
                const date = `${c.ts.getUTCFullYear()}-${zeroPad(c.ts.getUTCMonth() + 1, 2)}-${zeroPad(c.ts.getUTCDate(), 2)}`;
                const time = `T${zeroPad(c.ts.getUTCHours(), 2)}:${zeroPad(c.ts.getUTCMinutes(), 2)}:${zeroPad(c.ts.getUTCSeconds(), 2)}.${zeroPad(c.ts.getUTCMilliseconds(), 3)}Z`;
                return ["when", {}, date + time];
            });
            const coordObjs = coords.map((c) => {
                return ["gx:coord", {}, `${c.pos[0]} ${c.pos[1]} ${c.alt}`];
            });
            // splice together the xml track with / without altitude mode
            // clamptoground is google earth default while other programs error on having that option set specifically
            // so let google earth default to clamp to ground for ground track
            let xmlTrack = ["gx:Track", {}];
            if (!ground) {
                xmlTrack.push(["altitudeMode", {}, "absolute"]);
            }
            xmlTrack = xmlTrack.concat([
                ["extrude", {}, ground ? "0" : "1"],
                ...whenObjs,
                ...coordObjs
            ]);
            folder.push(
                ["Placemark", {},
                    ["name", {}, (plane.registration || plane.icao).toUpperCase()],
                    ["Style", {},
                        ["LineStyle", {},
                            ["color", {}, RGBColorToKMLColor(EXPORT_RGB_COLORS[planeIndex % EXPORT_RGB_COLORS.length])],
                            ["width", {}, 4]
                        ],
                        ["IconStyle", {},
                            ["Icon", {},
                                ["href", {}, "http://maps.google.com/mapfiles/kml/shapes/airports.png"]
                            ]
                        ]
                    ],
                    xmlTrack
                ]
            );
        }
        folders.push(folder);
    }
    const filename = baseExportFilenameForAircrafts(planes);
    const prologue = '<?xml version="1.0" encoding="UTF-8"?>\n';
    const xmlObj = ["kml", {
        "xmlns": "http://www.opengis.net/kml/2.2",
        "xmlns:gx": "http://www.google.com/kml/ext/2.2"
    },
        ["Folder", {},
            ...folders
        ]
    ];
    const xml = prologue + hiccup(xmlObj);
    download(
        filename + '-track.kml',
        'application/vnd.google-earth.kml+xml',
        xml);
}

function deleteTraces() {
    for (let i in PlanesOrdered) {
        let plane = PlanesOrdered[i];
        delete plane.recentTrace;
        delete plane.fullTrace;
    }
}

function setPictureVisibility() {
    showPictures = planespottersAPI || planespottingAPI;
    if (showPictures) {
        jQuery('#photo_container').removeClass('hidden');
    } else {
        jQuery('#photo_container').addClass('hidden');
    }
    if (planespottersLinks && !showPictures) {
        jQuery('#photoLinkRow').removeClass('hidden');
    } else {
        jQuery('#photoLinkRow').addClass('hidden');
    }
}

// just an idea, unused
let infoBits = {
    type: {
        head: 'Type:',
        title: '4 character ICAO type code (i.e.: A320,B738,G550)',
        value: function(plane) { return plane.icaoType || 'n/a'; },
    },
};


parseURLIcaos();
initialize();
