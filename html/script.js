// Some global variables are defined in early.js
// early.js takes care of getting some history files while the html page and
// some javascript libraries are still loading, hopefully speeding up loading

"use strict";

// Define our global variables
let webgl = false;
let webglFeatures = new ol.source.Vector();
let webglLayer;
let OLMap = null;
let OLProj = null;
let StaticFeatures = new ol.source.Vector();
let PlaneIconFeatures = new ol.source.Vector();
let trailGroup = new ol.Collection();
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
let SelPlanes = [];
let SelectedAllPlanes = false;
let HighlightedPlane = null;
let FollowSelected = false;
let followPos = [];
let noPan = false;
let loadFinished = false;
let mapResizeTimeout;
let pointerMoveTimeout;
let scaleFactor = 1;
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
let fetchingPf = false;
let debug = false;
let debugJump = false;
let jumpTo = null;
let noMLAT = false;
let noVanish = false;
let filterTracks = false;
let refreshId = 0;
let lastFetch = 0;
let refreshMultiplier = 1;
let globeIndexNow = {};
let globeIndexDist = {};
let globeIndexSpecialLookup = {};
let globeTilesViewCount = 0;
let globeSimLoad = 6;
let globeUseBigMil = false;
let globeTableLimitBase = 80;
let globeTableLimit = 80;
let fetchCounter = 0;
let lastGlobeExtent;
let pendingFetches = 0;
let firstFetch = true;
let debugCounter = 0;
let pathName = null;
let icaoFilter = null;
let sourcesFilter = null;
let sources = ['adsb', ['uat', 'adsr'], 'mlat', 'tisb', ['modeS', 'unknown'], 'adsc'];
let flagFilter = null;
let flagFilterValues = ['military', 'pia', 'ladd'];
let showTrace = false;
let showTraceExit = false;
let showTraceWasIsolation = false;
let traceDate = null;
let traceDateString = null;
let traceDay = null;
let traceOpts = {};
let icaoParam = null;
let globalScale = 1;
let userScale = 1;
let iconScale = 1;
let labelScale = 1;
let newWidth = lineWidth;
let SiteOverride = false;
let airport = null;
let labelFill = null;
let blackFill = null;
let labelStroke = null;
let labelStrokeNarrow = null;
let bgFill = null;
let legSel = -1;
let geoMag = null;
let globalCompositeTested = false;
let solidT = false;
let lastActive = new Date().getTime();
let overrideMapType = null;
let enableOverlays = [];
let halloween = false;
let noRegOnly = false;
let triggerRefresh = 0;
let firstDraw = true;

let infoBlockWidth = baseInfoBlockWidth;

const renderBuffer = 45;

let shareLink = '';

let onMobile = false;

let CenterLat, CenterLon, ZoomLvl, ZoomLvlCache;

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
let today = 0;
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

// TAR1090 application object
let TAR;
TAR = (function (global, $, TAR) {
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
        if (!onlyMilitary || plane.military)
            plane.updateData(now, last, ac, init);
        else
            plane.last_message_time = now - ac.seen;
        return;
    }
    if (uat) {
        if (plane.uat
            || (ac.seen_pos < 1.8 && (plane.seen_pos > 2 || plane.dataSource == "mlat"))
            || plane.seen > 10 || isNaN(plane.seen)
            || init) {
            let tisb = Array.isArray(ac) ? (ac[7] == "tisb") : (ac.tisb != null && ac.tisb.indexOf("lat") >= 0);
            if (tisb && plane.dataSource == "adsb") {
                // ignore TIS-B data for current ADS-B 1090 planes
            } else {
                plane.uat = true;
                plane.updateData(uat_now, uat_last, ac, init);
            }
        }
    } else {
        if (!plane.uat
            || (ac.seen_pos < 1.8 && plane.seen_pos > 2 && (plane.seen_pos > 5 || !(ac.mlat && ac.mlat.indexOf("lat") >= 0)))
            || plane.seen > 10 || isNaN(plane.seen)
            || init) {
            plane.updateData(now, last, ac, init);
        }
    }
}

function processReceiverUpdate(data, init) {
    // update now and last
    let uat = data.uat_978;
    if (uat) {
        if (data.now <= uat_now)
            return;
        uat_last = uat_now;
        uat_now = data.now;
    } else {
        if (data.now <= now && !globeIndex)
            return;
        if (data.now > now) {
            last = now;
            now = data.now;
        }
    }

    if (globeIndex) {
        if ((showGrid || localStorage['globeGrid'] == 'true')
            && globeIndexNow[data.globeIndex] == null)
            drawTileBorder(data);
        globeTrackedAircraft = data.global_ac_count_withpos;
        globeIndexNow[data.globeIndex] = data.now;
    }

    if (!uat && !init && !globeIndex && !binCraft)
        updateMessageRate(data);

    // Loop through all the planes in the data packet
    for (let j=0; j < data.aircraft.length; j++)
        processAircraft(data.aircraft[j], init, uat);
}

let nextFetch = 0;
function fetchSoon() {
    clearTimeout(refreshId);
    refreshId = setTimeout(fetchData, refreshInt());
    nextFetch = new Date().getTime() + refreshInt();
}

function fetchData(options) {
    options = options || {};
    if (heatmap || replay || showTrace || pTracks)
        return;
    fetchSoon();
    //console.log("fetch");
    let currentTime = new Date().getTime();
    if (!options.force && (currentTime - lastFetch < refreshInt() || pendingFetches > 0)) {
        return;
    }
    lastFetch = currentTime;

    FetchPending = [];
    if (FetchPendingUAT != null) {
        // don't double up on fetches, let the last one resolve
        return;
    }

    pendingFetches = 1;

    //console.timeEnd("Starting Fetch");
    //console.time("Starting Fetch");

    if (enable_uat) {
        FetchPendingUAT = $.ajax({ url: 'chunks/978.json',
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
        ac_url[0] = 'uuid/?feed=' + encodeURIComponent(uuid);
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

        if (binCraft && onlyMilitary && indexes.length > 12) {
            ac_url.push('data/globeMil_42777.binCraft');
            globeUseBigMil = true;
        } else {
            globeUseBigMil = false;

            indexes = indexes.slice(0, globeSimLoad);

            let suffix = binCraft ? '.binCraft' : '.json'
            let mid = (binCraft && onlyMilitary) ? 'Mil_' : '_';
            for (let i in indexes) {
                ac_url.push('data/globe' + mid + indexes[i].toString().padStart(4, '0') + suffix);
            }
        }
    } else {
        ac_url[0] = 'data/aircraft.json';
    }

    pendingFetches = ac_url.length;
    fetchCounter += pendingFetches;

    if (globeIndex) {
        fetchSoon();
    } else {
        $("#lastLeg_cb").parent().hide();
    }


    for (let i in ac_url) {
        //console.log(ac_url[i]);
        let req;
        if (binCraft) {
            let xhrOverride = new XMLHttpRequest();
            xhrOverride.responseType = 'arraybuffer';
            req = $.ajax({
                url: ac_url[i], method: 'GET',
                xhr: function() { return xhrOverride; },
                timeout: 5000,
            });
        } else {
            req = $.ajax({ url: ac_url[i], dataType: 'json' });
        }
        FetchPending.push(req);

        req.done(function(data) {
            if (data == null) {
                return;
            }
            if (binCraft) {
                data = { buffer: data, };
                wqi(data);
            }

            //console.time("Process " + data.globeIndex);
            processReceiverUpdate(data);
            //console.timeEnd("Process " + data.globeIndex);
            data = null;

            if (uat_data) {
                processReceiverUpdate(uat_data);
                uat_data = null;
            }

            if (pendingFetches <= 1) {
                if (globeIndex)
                    clearTimeout(refreshId);

                triggerRefresh++;
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
                checkMovement();

                if (globeIndex)
                    fetchSoon();
            }
            pendingFetches--;


            // Check for stale receiver data
            if (last == now && !globeIndex) {
                StaleReceiverCount++;
                if (StaleReceiverCount > 5) {
                    $("#update_error_detail").text("The data from the server hasn't been updated in a while.");
                    $("#update_error").css('display','block');
                }
            } else if (StaleReceiverCount > 0){
                StaleReceiverCount = 0;
                $("#update_error").css('display','none');
            }
        });

        req.fail(function(jqxhr, status, error) {
            status = jqxhr.status;
            if (jqxhr.readyState == 0) error = "Can't connect to server, check your network!";
            let errText = status + (error ? (": " + error) : "");
            console.log(jqxhr);
            console.log(error);
            if (status != 429 && status != '429') {
                $("#update_error_detail").text(errText);
                $("#update_error").css('display','block');
                StaleReceiverCount++;
            }
            pendingFetches--;
            if (globeIndex)
                fetchSoon();
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

    $.when(configureReceiver, heatmapDefer).done(function() {
        configureReceiver = null;

        // Initialize stuff
        initPage();
        initMap();

        // Wait for history item downloads and append them to the buffer
        push_history();

        $.when(historyLoaded).done(function() {
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

    onMobile = window.mobilecheck();

    today = new Date().getDate();

    let largeModeStorage = localStorage['largeMode'];
    if (largeModeStorage != undefined && parseInt(largeModeStorage, 10)) {
        largeMode = parseInt(largeModeStorage, 10);
    }

    if (usp.has('nowebgl')) {
        localStorage['webgl'] = "false";
    }
    if (usp.has('showGrid')) {
        showGrid = true;
        localStorage['layer_site_pos'] = 'true';
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
        largeMode = 2;
    }

    if (pTracks) {
        noVanish = true;
        buttonActive('#P', noVanish);
        filterTracks = true;
        selectAllPlanes();
    }

    if (usp.has('largeMode')) {
        let tmp = parseInt(usp.get('largeMode'));
        console.log(tmp);
        if (!isNaN(tmp))
            largeMode = tmp;
    }

    if (usp.has('mobile'))
        onMobile = true;
    if (usp.has('desktop'))
        onMobile = false;

    if (usp.has('hideSidebar'))
        localStorage['sidebar_visible'] = "false";
    if (usp.has('sidebarWidth')) {
        localStorage['sidebar_width'] = usp.get('sidebarWidth');
        localStorage['sidebar_visible'] = "true";
    }

    if (usp.has('SiteLat') && usp.has('SiteLon')) {
        localStorage['SiteLat'] = usp.get('SiteLat');
        localStorage['SiteLon'] = usp.get('SiteLon');
    }
    if (localStorage['SiteLat'] != null && localStorage['SiteLon'] != null) {
        if (usp.has('SiteClear')
            || isNaN(parseFloat(localStorage['SiteLat']))
            || isNaN(parseFloat(localStorage['SiteLat']))) {
            localStorage.removeItem('SiteLat');
            localStorage.removeItem('SiteLon');
        } else {
            SiteLat = CenterLat = DefaultCenterLat = parseFloat(localStorage['SiteLat']);
            SiteLon = CenterLon = DefaultCenterLon = parseFloat(localStorage['SiteLon']);
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

    if (usp.has('mapContrast')) {
        let contrast = parseFloat(usp.get('mapContrast'));
        if (!isNaN(contrast))
            mapContrastPercentage = contrast;
    }

    if (usp.has('iconScale')) {
        let scale = parseFloat(usp.get('iconScale'));
        if (!isNaN(scale))
            iconScale = scale;
    }

    if (usp.has('labelScale')) {
        let scale = parseFloat(usp.get('labelScale'));
        if (!isNaN(scale))
            labelScale = scale;
    }

    if (usp.has('scale')) {
        let scale = parseFloat(usp.get('scale'));
        if (!isNaN(scale))
            userScale = scale;
    }

    if (usp.has('hideButtons'))
        hideButtons = true;

    if (usp.has('baseMap'))
        overrideMapType = usp.get('baseMap');

    if (usp.has('overlays'))
        enableOverlays = usp.get('overlays').split(',');

    icaoFilter = usp.get('icaoFilter');
    if (icaoFilter)
        icaoFilter = icaoFilter.toLowerCase().split(',');

    if (usp.has('filterMaxRange')) {
        let tmp = parseFloat(usp.get('filterMaxRange'));
        if (!isNaN(tmp))
            filterMaxRange = tmp;
    }
    filterMaxRange *= 1852; // convert from nmi to meters


    if (usp.has('mapOrientation')) {
        mapOrientation = parseFloat(usp.get('mapOrientation'));
    }
    mapOrientation *= (Math.PI/180); // adjust to radians

    if (usp.has('r')) {
        let numbers = (usp.get('r') || "").split('-');
        let ts = new Date();
        ts.setUTCHours(ts.getUTCHours() - 1);
        if (numbers.length == 5) {
            ts.setUTCFullYear(numbers[0]);
            ts.setUTCMonth(numbers[1] - 1);
            ts.setUTCDate(numbers[2]);
            ts.setUTCHours(numbers[3]);
            ts.setUTCMinutes(numbers[4]);
        }

        replay = {
            ts: ts,
            ival: 60 * 1000,
            speed: 40,
        };
    }

    if (onMobile)
        enableMouseover = false;

    if (false && iOSVersion() <= 12 && !('PointerEvent' in window)) {
        $("#generic_error_detail").text("Enable Settings - Safari - Advanced - Experimental features - Pointer Events");
        $("#generic_error").css('display','block');
        setTimeout(function() {
            $("#generic_error").css('display','none');
        }, 30000);
    }

    if ((adsbexchange || dynGlobeRate) && !uuid) {
        setInterval(globeRateUpdate(), 300000);
    }

    if (localStorage['enableLabels'] == 'true'){
        toggleLabels();
    }
    if (localStorage['extendedLabels']){
        extendedLabels = parseInt(localStorage['extendedLabels']) + 2;
        toggleExtendedLabels();
    }
    if (localStorage['trackLabels'] == "true") {
        toggleTrackLabels();
    }
    if (localStorage['tableInView'] == "true") {
        toggleTableInView(true);
    }
    if (localStorage['debug'] == "true")
        debug = true;
    if (localStorage['debugPosFilter'] == "true")
        debugPosFilter = true;

    if (localStorage['noVanish'] == "true") {
        noVanish = true;
        //filterTracks = noVanish;
        //localStorage['noVanish'] = "false";
        buttonActive('#P', noVanish);
    }

    $('#tabs').tabs({
        active: localStorage['active_tab'],
        activate: function (event, ui) {
            localStorage['active_tab'] = $("#tabs").tabs("option", "active");
        },
        collapsible: true
    });

    // Set page basics
    document.title = PageName;

    TAR.planeMan.init();

    if (ExtendedData || window.location.hash == '#extended') {
        $("#extendedData").removeClass("hidden");
    }

    // Set up map/sidebar splitter
    $("#sidebar_container").resizable({
        handles: {
            w: '#splitter'
        },
        minWidth: 150,
        maxWidth: ($(window).innerWidth() *0.8),
    });

    $("#splitter").dblclick(function() {
        $('#legend').hide();
        $('#sidebar_container').width('auto');
        updateMapSize();
        localStorage['sidebar_width'] = $('#sidebar_container').width();
        $('#sidebar_container').width(localStorage['sidebar_width']);
        $('#legend').show();
    });

    if (localStorage['sidebar_width'] != null)
        $('#sidebar_container').width(localStorage['sidebar_width']);
    else
        $('#sidebar_container').width('25%');

    if ($('#sidebar_container').width() > $(window).innerWidth() *0.8)
        $('#sidebar_container').width('30%');

    localStorage['sidebar_width'] = $('#sidebar_container').width();

    $('#infoblock_close').on('click', function () {

        if (showTrace) {
            toggleShowTrace();
        }
        if (SelectedPlane) {
            SelectedPlane.selected = null;
            SelectedPlane.clearLines();
            SelectedPlane.updateMarker();
            SelectedPlane = null;
            refreshSelected();
            adjustInfoBlock();
            TAR.planeMan.refresh();
            updateAddressBar();
        }
    });

    $('#sidebar_container').on('resize', function() {
        localStorage['sidebar_width'] = $('#sidebar_container').width();
    });

    // Set up event handlers for buttons
    $("#expand_sidebar_button").click(expandSidebar);
    $("#shrink_sidebar_button").click(showMap);

    $("#large_mode_button").click(toggleLargeMode);

    // Initialize other controls
    initializeUnitsSelector();

    // Set up altitude filter button event handlers and validation options
    $("#altitude_filter_form").submit(onFilterByAltitude);
    $("#callsign_filter_form").submit(updateCallsignFilter);
    $("#type_filter_form").submit(updateTypeFilter);
    $("#description_filter_form").submit(updateDescriptionFilter);
    $("#icao_filter_form").submit(updateIcaoFilter);
    $("#source_filter_form").submit(updateSourceFilter);
    $("#flag_filter_form").submit(updateFlagFilter);

    $("#search_form").submit(onSearch);
    $("#jump_form").submit(onJump);

    $("#show_trace").click(toggleShowTrace);
    $("#trace_back_1d").click(function() {shiftTrace(-1)});
    $("#trace_jump_1d").click(function() {shiftTrace(1)});

    $("#histDatePicker").datepicker({
        maxDate: '+1d',
        dateFormat: "yy-mm-dd",
        onSelect: function(date){
            setTraceDate(date);
            shiftTrace();
            $("#histDatePicker").blur();
        },
        autoSize: true,
        onClose: !onMobile ? null : function(dateText, inst){
            $("#histDatePicker").attr("disabled", false);
        },
        beforeShow: !onMobile ? null : function(input, inst){
            $("#histDatePicker").attr("disabled", true);
        },
    });


    $("#leg_prev").click(function() {legShift(-1)});
    $("#leg_next").click(function() {legShift(1)});

    $("#altitude_filter_reset_button").click(onResetAltitudeFilter);
    $("#callsign_filter_reset_button").click(onResetCallsignFilter);
    $("#type_filter_reset_button").click(onResetTypeFilter);
    $("#description_filter_reset_button").click(onResetDescriptionFilter);
    $("#icao_filter_reset_button").click(onResetIcaoFilter);
    $("#source_filter_reset_button").click(onResetSourceFilter);
    $("#flag_filter_reset_button").click(onResetFlagFilter);

    $('#settingsCog').on('click', function() {
        $('#settings_infoblock').toggle();
    });

    $('#settings_close').on('click', function() {
        $('#settings_infoblock').hide();
    });

    $('#groundvehicle_filter').on('click', function() {
        filterGroundVehicles(true);
        refreshSelected();
        refreshHighlighted();
        TAR.planeMan.refresh();
        mapRefresh();
    });

    $('#blockedmlat_filter').on('click', function() {
        filterBlockedMLAT(true);
        refreshSelected();
        refreshHighlighted();
        TAR.planeMan.refresh();
        mapRefresh();
    });

    $('#grouptype_checkbox').on('click', function() {
        if ($('#grouptype_checkbox').hasClass('settingsCheckboxChecked')) {
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
            if (SelectedPlane && !showTrace)
                SelectedPlane.processTrace();
        }
    });

    new Toggle({
        key: "selectedDetails",
        display: "Selected Aircraft Details",
        container: "#settingsLeft",
        init: true,
        setState: function(state) {
            adjustInfoBlock();
        }
    });

    if (onMobile) {
        $('#large_mode_button').css('width', 'calc( 45px * let(--SCALE))');
        $('#large_mode_button').css('height', 'calc( 45px * let(--SCALE))');
        if (localStorage['largeMode'] == undefined && largeMode == 1)
            largeMode = 2;
    }

    largeMode--;
    toggleLargeMode();

    $('#tStop').on('click', function() { traceOpts.replaySpeed = 0; gotoTime(traceOpts.showTime); });
    $('#t1x').on('click', function() { replaySpeedChange(1); });
    $('#t5x').on('click', function() { replaySpeedChange(5); });
    $('#t10x').on('click', function() { replaySpeedChange(10); });
    $('#t20x').on('click', function() { replaySpeedChange(20); });
    $('#t40x').on('click', function() { replaySpeedChange(40); });

    new Toggle({
        key: "debugTracks",
        display: "Debug Tracks",
        container: "#settingsLeft",
        init: false,
        setState: function(state) {
            debugTracks = state;
            remakeTrails();
        }
    });

    new Toggle({
        key: "debugAll",
        display: "Debug show all",
        container: "#settingsLeft",
        init: false,
        setState: function(state) {
            if (state)
                debugAll = true;
            else
                debugAll = false;
        }
    });

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

    new Toggle({
        key: "darkerColors",
        display: "Darker Colors",
        container: "#settingsRight",
        init: false,
        setState: function(state) {
            if (loadFinished) {
                refreshFeatures();
                remakeTrails();
            }
        }
    });

    tableColorsLight = tableColors;
    tableColorsDark = JSON.parse(JSON.stringify(tableColors));
    let darkVals = Object.values(tableColorsDark);
    for (let i in darkVals) {
        let obj = darkVals[i];
        let keys = Object.keys(obj)
        for (let j in keys) {
            let key = keys[j];
            let hsl = hexToHSL(obj[key]);
            hsl[1] *= 0.5;
            hsl[2] *= 0.6;
            obj[key] = hslToRgb(hsl);
        }
    }
    new Toggle({
        key: "darkMode",
        display: "Dark Mode",
        container: "#settingsRight",
        init: false,
        setState: function(state) {
            let root = document.documentElement;
            if (state) {
                document.body.style.background = '#989898'
                root.style.setProperty("--BGCOLOR1", '#989898');
                root.style.setProperty("--BGCOLOR2", '#A8A8A8');
                tableColors = tableColorsDark;
            } else {
                document.body.style.background = '#F8F8F8'
                root.style.setProperty("--BGCOLOR1", '#F8F8F8');
                root.style.setProperty("--BGCOLOR2", '#C8C8C8');
                tableColors = tableColorsLight;
            }
            if (loadFinished) {
                TAR.planeMan.redraw();
                refreshFilter();
            }

            initLegend(tableColors.unselected);
            initSourceFilter(tableColors.unselected);
            initFlagFilter(tableColors.unselected);
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
                $("#sidebar_container").show();
                $("#expand_sidebar_control").show();
                $("#toggle_sidebar_button").removeClass("show_sidebar");
                $("#toggle_sidebar_button").addClass("hide_sidebar");
            } else {
                $("#sidebar_container").hide();
                $("#expand_sidebar_control").hide();
                $("#toggle_sidebar_button").removeClass("hide_sidebar");
                $("#toggle_sidebar_button").addClass("show_sidebar");
            }
            updateMapSize();
        },
    });

    new Toggle({
        key: "wideInfoblock",
        display: "Wide infoblock",
        container: "#settingsRight",
        init: wideInfoBlock,
        setState: function(state) {
            wideInfoBlock = state;
            adjustInfoBlock();
        }
    });


    $('#selectall_checkbox').on('click', function() {
        if ($('#selectall_checkbox').hasClass('settingsCheckboxChecked')) {
            deselectAllPlanes();
        } else {
            selectAllPlanes();
        }
    })

    // Force map to redraw if sidebar container is resized - use a timer to debounce
    $("#sidebar_container").on("resize", function() {
        clearTimeout(mapResizeTimeout);
        mapResizeTimeout = setTimeout(updateMapSize, 20);
    });

    filterGroundVehicles(false);
    filterBlockedMLAT(false);

    TAR.altitudeChart.init();

    if (adsbexchange) {
        $('#adsbexchange_header').show();
        $('#credits').show();
        $('#selected_infoblock').addClass('adsbx-selected-bg');
        if (window.self != window.top) {
            window.top.location.href = "https://www.adsbexchange.com/"
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
        html += '<div class="legendTitle" style="background-color:' + colors['unknown'] + ';">Unknown</div>';

    document.getElementById('legend').innerHTML = html;
}

function initSourceFilter(colors) {
    const createFilter = function (color, text) {
        return '<li class="ui-widget-content" style="background-color:' + color + ';">' + text + '</li>';
    };

    let html = '';
    html += createFilter(colors['adsb'], 'ADS-B');

    html += createFilter(colors['uat'], 'UAT / ADS-R');
    html += createFilter(colors['mlat'], 'MLAT');
    html += createFilter(colors['tisb'], 'TIS-B');

    if (!globeIndex)
        html += createFilter(colors['modeS'], 'Mode-S');
    if (globeIndex)
        html += createFilter(colors['unknown'], 'Unknown');

    if (globeIndex)
        html += createFilter(colors['uat'], 'ADS-C');

    document.getElementById('sourceFilter').innerHTML = html;

    $("#sourceFilter").selectable({
        stop: function () {
            sourcesFilter = [];
            $(".ui-selected", this).each(function () {
                const index = $("#sourceFilter li").index(this);
                if (Array.isArray(sources[index]))
                    sources[index].forEach(member => { sourcesFilter.push(member); });
                else
                    sourcesFilter.push(sources[index]);
            });
        }
    });

    $("#sourceFilter").on("selectablestart", function (event, ui) {
        event.originalEvent.ctrlKey = true;
    });
}

function initFlagFilter(colors) {
    const createFilter = function (color, text) {
        return '<li class="ui-widget-content" style="background-color:' + color + ';">' + text + '</li>';
    };

    let html = '';
    html += createFilter(colors['tisb'], 'Military');
    //html += createFilter(colors['mlat'], 'Interesting');
    html += createFilter(colors['uat'], 'PIA');
    html += createFilter(colors['adsb'], 'LADD');

    document.getElementById('flagFilter').innerHTML = html;

    $("#flagFilter").selectable({
        stop: function () {
            flagFilter = [];
            $(".ui-selected", this).each(function () {
                const index = $("#flagFilter li").index(this);
                if (Array.isArray(flagFilterValues[index]))
                    flagFilterValues[index].forEach(member => { flagFilter.push(member); });
                else
                    flagFilter.push(flagFilterValues[index]);
            });
        }
    });

    $("#flagFilter").on("selectablestart", function (event, ui) {
        event.originalEvent.ctrlKey = true;
    });
}

function push_history() {
    $("#loader_progress").attr('max',nHistoryItems*2);
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

    $.when(deferHistory[i])
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


            $("#loader_progress").attr('value',HistoryItemsReturned);
            HistoryItemsReturned++;
            if (HistoryItemsReturned == nHistoryItems) {
                parseHistory();
            }
        })

        .fail(function(jqxhr, status, error) {

            //Doesn't matter if it failed, we'll just be missing a data point
            $("#loader_progress").attr('value',HistoryItemsReturned);
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

function startPage() {
    console.log("Completing init");

    // Kick off first refresh.
    fetchData();

    if (!globeIndex) {
        $('#show_trace').hide();
    }
    if (globeIndex) {
        $('#V').hide();
    } else {
    }

    if (hideButtons) {
        $('#large_mode_control').hide();
        $('#header_top').hide();
        $('#header_side').hide();
        $('#splitter').hide();
        $('#tabs').hide();
        $('#filterButton').hide();
        $('.ol-control').hide();
        $('.ol-attribution').show();
    }

    // Setup our timer to poll from the server.
    window.setInterval(reaper, 20000);
    if (tempTrails) {
        window.setInterval(trailReaper, 10000);
        trailReaper(now);
    }
    if (enable_pf_data) {
        $('#pf_info_contianer').removeClass('hidden');
        window.setInterval(fetchPfData, RefreshInterval*10.314);
    }
    setInterval(everySecond, 850);

    pathName = window.location.pathname;
    processURLParams();

    if (!icaoFilter && globeIndex)
        toggleTableInView(true);

    changeZoom("init");
    changeCenter("init");

    setInterval(checkMovement, 50);


    loadFinished = true;

    if (tempTrails)
        selectAllPlanes();

    if (!heatmap)
        $("#loader").addClass("hidden");

    if (replay)
        loadReplay(replay.ts);

    geoMag = geoMagFactory(cof2Obj());

    drawUpintheair();
    mapRefresh();

    if (heatmap) {
        drawHeatmap();
    }

    handleVisibilityChange();

    if (pTracks)
        setTimeout(TAR.planeMan.refresh, 10000);
}

//
// Utils begin
//
(function (global, $, TAR) {
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
                src: 'images/sprites006.png',
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
        localStorage['webglFailStamp'] = new Date().getTime();
        success = false;
        if (localStorage['webgl'] == 'true')
            localStorage.removeItem('webgl');
    }
    delete Planes[plane.icao];
    PlanesOrdered.splice(PlanesOrdered.indexOf(plane), 1);
    plane.destroy();

    return success;
}

function webglInit() {
    let init = true;
    // if webGL failed in the last 7 days, don't even try unless people click the toggle.
    if (localStorage['webglFailStamp'] && Number(localStorage['webglFailStamp']) +  7 * 24 * 3600 * 1000 > new Date().getTime()) {
        init = false;
        if (localStorage['webgl'] == undefined)
            console.log('webGL failed in the past 7 days, not even trying to initialize it');
    }
    new Toggle({
        key: "webgl",
        display: "WebGL",
        container: "#settingsLeft",
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
        $('#dump1090_total_history_td').hide();
        $('#dump1090_message_rate_td').hide();
    }

    // Load stored map settings if present
    CenterLon = Number(localStorage['CenterLon']) || DefaultCenterLon;
    CenterLat = Number(localStorage['CenterLat']) || DefaultCenterLat;
    ZoomLvl = Number(localStorage['ZoomLvl']) || DefaultZoomLvl;
    ZoomLvlCache = ZoomLvl;

    if (overrideMapType)
        MapType_tar1090 = overrideMapType;
    else if (localStorage['MapType_tar1090']) {
        MapType_tar1090 = localStorage['MapType_tar1090'];
    }

    // Initialize OpenLayers

    layers_group = createBaseLayers();
    layers = layers_group.getLayers();

    layers.push(
        new ol.layer.Vector({
            name: 'site_pos',
            type: 'overlay',
            title: 'Site position and range rings',
            source: StaticFeatures,
            visible: !adsbexchange,
            zIndex: 100,
            renderOrder: null,
            renderBuffer: renderBuffer,
        }));


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
        controls: [new ol.control.Zoom({delta: 1, duration: 0, target: 'map_container',}),
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
                    MapType_tar1090 = localStorage['MapType_tar1090'] = evt.target.get('name');
                }
            });
        } else if (lyr.get('type') === 'overlay') {
            if (localStorage['layer_' + lyr.get('name')] == 'true' || enableOverlays.indexOf(lyr.get('name')) >= 0)
                lyr.setVisible(true);

            lyr.on('change:visible', function(evt) {
                localStorage['layer_' + evt.target.get('name')] = evt.target.getVisible();
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
        target: 'map_container',
    }));

    OLMap.on('moveend', function(event) {
        checkMovement();
    });
    /*
    // Listeners for newly created Map
    OLMap.getView().on('change:center', function(event) {
        const center = ol.proj.toLonLat(OLMap.getView().getCenter(), OLMap.getView().getProjection());
        CenterLat = center[1];
        CenterLon = center[0];
        if (FollowSelected) {
            // On manual navigation, disable follow
            if (!SelectedPlane || !SelectedPlane.position ||
                (Math.abs(center[0] - SelectedPlane.position[0]) > 0.0001 &&
                    Math.abs(center[1] - SelectedPlane.position[1]) > 0.0001)){
                FollowSelected = false;
                refreshSelected();
                refreshHighlighted();
            }
        }
    });
    */

    /*
    OLMap.getView().on('change:resolution', function(event) {
        ZoomLvl = OLMap.getView().getZoom();
    });
    */

    OLMap.on(['click', 'dblclick'], function(evt) {
        let res = null;

        if (!res && !showTrace) {
            let features = webgl ? webglFeatures : PlaneIconFeatures;
            let evtCoords = evt.map.getCoordinateFromPixel(evt.pixel);
            let feature = features.getClosestFeatureToCoordinate(evtCoords);
            if (feature) {
                let fPixel = evt.map.getPixelFromCoordinate(feature.getGeometry().getCoordinates());
                let a = fPixel[0] - evt.pixel[0];
                let b = fPixel[1] - evt.pixel[1];
                let c = globalScale * 25;
                if (a**2 + b**2 < c**2)
                    res = feature.hex;
            }
        }

        if (!res) {
            let features = evt.map.getFeaturesAtPixel(
                evt.pixel,
                {
                    layerFilter: function(layer) { return (layer.get('isTrail') == true); },
                    hitTolerance: globalScale * 20,
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
                    res = closest.timestamp;
                else
                    res = closest.hex;
            }
        }

        if (showTrace && res) {
            gotoTime(res);
        } else if (res) {
            const double = (evt.type === 'dblclick');
            selectPlaneByHex(res, {noDeselect: double, follow: double});
        } else if (!multiSelect) {
            deselectAllPlanes();
        }
        evt.stopPropagation();
    });


    // show the hover box
    if (!globeIndex && ZoomLvl > 5.5 && enableMouseover) {
        OLMap.on('pointermove', onPointermove);
    }

    // handle the layer settings pane checkboxes
    OLMap.once('postrender', function(e) {
        toggleLayer('#nexrad_checkbox', 'nexrad');
        //toggleLayer('#sitepos_checkbox', 'site_pos');
        toggleLayer('#actrail_checkbox', 'ac_trail');
        //toggleLayer('#acpositions_checkbox', 'webglLayer');
    });

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

    new Toggle({
        key: "showPictures",
        display: "Show Pictures",
        container: "#settingsLeft",
        init: showPictures,
        setState: function(state) {
            showPictures = state;
            if (state) {
                $('#photo_container').removeClass('hidden');
            } else {
                $('#photo_container').addClass('hidden');
            }
            if (showPictures && planespottersAPI && !flightawareLinks) {
                $('#photoLinkRow').addClass('hidden');
            } else {
                $('#photoLinkRow').removeClass('hidden');
            }
            refreshSelected();
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
            case "h":
                resetMap();
                break;
            case "H":
                if (!hideButtons) {
                    $('#large_mode_control').hide();
                    $('#header_top').hide();
                    $('#header_side').hide();
                    $('#splitter').hide();
                    $('#tabs').hide();
                    $('#filterButton').hide();
                    $('.ol-control').hide();
                    $('.ol-attribution').show();
                } else {
                    $('#large_mode_control').show();
                    $('#header_top').show();
                    $('#header_side').show();
                    $('#splitter').show();
                    $('#tabs').show();
                    $('#filterButton').show();
                    $('.ol-control').show();
                    $('#expand_sidebar_control').hide();
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
                localStorage['debug'] = debug;
                console.log('debug = ' + debug);
                break;
            case "P":
                debugPosFilter = !debugPosFilter;
                localStorage['debugPosFilter'] = debugPosFilter;
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
                localStorage['debugJump'] = debugJump;
                console.log('debugJump = ' + debugJump);
                break;
            case "N":
                noMLAT = !noMLAT;
                localStorage['noMLAT'] = noMLAT;
                console.log('noMLAT = ' + noMLAT);
                break;
        }
    }, true);

    if (globeIndex || uuid || askLocation)
        geoFindMe();
    else {
        initSitePos();
    }
}

// This looks for planes to reap out of the master Planes variable
function reaper(all) {
    if (tabHidden)
        return;
    //console.log("Reaping started..");
    today = new Date().getDate();
    if (noVanish)
        return;

    // Look for planes where we have seen no messages for >300 seconds
    let plane;
    let length = PlanesOrdered.length;
    for (let i = 0; i < length; i++) {
        plane = PlanesOrdered.shift()
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
        } else {
            // Keep it.
            PlanesOrdered.push(plane);
        }
    };

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
    $('#copyrightInfo').html("");
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
    let photos = SelectedPlane.psAPIresponse["photos"];
    if (!photos || photos.length == 0) {
        displaySil();
        adjustInfoBlock();
        return;
    }
    let new_html="";
    let photoToPull = photos[0]["thumbnail"]["src"];
    let linkToPicture = photos[0]["link"];
    //console.log(linkToPicture);
    new_html = '<a href="'+linkToPicture+'" target="_blank" rel="noopener noreferrer"><img id="airplanePhoto" src=' +photoToPull+'></a>';
    $('#copyrightInfo').html("<span>Image © " + photos[0]["photographer"]+"</span>");
    setPhotoHtml(new_html);
    adjustInfoBlock();
}

function refreshPhoto(selected) {
    if (!showPictures || !planespottersAPI || selected.icao[0] == '~') {
        displaySil();
        return;
    }
    let urlTail;
    let param;
    if (selected.registration != null) {
        urlTail = '/hex/' + selected.icao.toUpperCase() + '?reg=' + selected.registration;
        if (selected.icaoType) {
            urlTail += '&icaoType=' + selected.icaoType;
        }
        param = 'DB';
    } else if (!selected.regLoaded) {
        return;
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
    $('#copyrightInfo').html("<span></span>");
    //console.log(ts/1000 + 'sending psAPI request');
    selected.psAPIresponseTS = ts;
    let req = $.ajax({
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
}

let selCall = null;
let selIcao = null;
let selReg = null;

// Refresh the detail window about the plane
function refreshSelected() {

    buttonActive('#F', FollowSelected);

    /*
    if (SelectedPlane && SelectedPlane.isFiltered()) {
        SelectedPlane.selected = false;
        SelectedPlane.clearLines();
        SelectedPlane = null;
    }
    */

    if (!SelectedPlane) {
        adjustInfoBlock();
        return;
    }
    const selected = SelectedPlane;

    selected.checkForDB();

    refreshPhoto(selected);

    if (selected.flight != selCall) {
        selCall = selected.flight;
        if (selected.flight && selected.flight.trim()) {
            $('#selected_callsign').text(selected.flight);
        } else {
            $('#selected_callsign').text('n/a');
        }
    }
    if (flightawareLinks) {
        $('#selected_flightaware_link').html(getFlightAwareModeSLink(selected.icao, selected.flight, "Visit Flight Page"));
    }

    if (selected.isNonIcao() && selected.source != 'mlat') {
        $('#anon_mlat_info').addClass('hidden');
        $('#reg_info').addClass('hidden');
        $('#tisb_info').removeClass('hidden');
    } else if (selected.isNonIcao() && selected.source == 'mlat') {
        $('#reg_info').addClass('hidden');
        $('#tisb_info').addClass('hidden');
        $('#anon_mlat_info').removeClass('hidden');
    } else {
        $('#tisb_info').addClass('hidden');
        $('#anon_mlat_info').addClass('hidden');
        $('#reg_info').removeClass('hidden');
    }
    let checkReg = selected.registration + ' ' + selected.regLoaded;
    if (checkReg != selReg) {
        selReg = checkReg;
        if (selected.registration) {
            if (flightawareLinks) {
                $('#selected_registration').html(getFlightAwareIdentLink(selected.registration, selected.registration));
            } else {
                $('#selected_registration').text(selected.registration);
            }
        } else {
            $('#selected_registration').text("n/a");
        }
    }
    let dbFlags = "";
    if (selected.ladd)
        dbFlags += ' <a style="color: blue" target="_blank" href="https://ladd.faa.gov/" rel="noreferrer">LADD</a> / ';
    if (selected.pia)
        dbFlags += '<a style="color: blue" target="_blank" href="https://www.faa.gov/nextgen/equipadsb/privacy/" rel="noreferrer">PIA</a> / ';
    if (selected.military)
        dbFlags += 'military / ';
    if (dbFlags.length == 0) {
        $('#selected_dbFlags').text("none");
    } else {
        $('#selected_dbFlags').html(dbFlags.slice(0, -3));
    }

    if (selected.icaoType) {
        $('#selected_icaotype').text(selected.icaoType);
    } else {
        $('#selected_icaotype').text("n/a");
    }
    if (selected.typeDescription)
        $('#selected_typedesc').text(selected.typeDescription);
    else
        $('#selected_typedesc').text("n/a");

    let typeLine = "";
    if (selected.year)
        typeLine += selected.year + " "
    if (selected.typeLong)
        typeLine += selected.typeLong;
    if (!typeLine)
        typeLine = "n/a"

    $('#selected_typelong').text(typeLine);

    if (selected.ownOp)
        $('#selected_ownop').text(selected.ownOp);
    else
        $('#selected_ownop').text("");



    $("#selected_altitude1").text(format_altitude_long(selected.altitude, selected.vert_rate, DisplayUnits));
    $("#selected_altitude2").text(format_altitude_long(selected.altitude, selected.vert_rate, DisplayUnits));

    $('#selected_onground').text(format_onground(selected.altitude));

    if (selected.squawk == null || selected.squawk == '0000') {
        $('#selected_squawk1').text('n/a');
        $('#selected_squawk2').text('n/a');
    } else {
        $('#selected_squawk1').text(selected.squawk);
        $('#selected_squawk2').text(selected.squawk);
    }

    let magResult = null;

    if (geoMag && selected.position != null) {
        let lon = selected.position[0];
        let lat = selected.position[1];
        let alt = selected.altitude == "ground" ? 0 : selected.altitude;
        magResult = geoMag(lat, lon, alt);
        $('#selected_mag_declination').text(format_track_brief(magResult.dec));
    } else {
        $('#selected_mag_declination').text('n/a');
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

    $('#selected_mag_heading').text(format_track_brief(selected.mag_heading));

    if (selected.wd != null && selected.ws != null) {
        $('#selected_wd').text(format_track_brief(selected.wd, true));
        $('#selected_ws').text(format_speed_long(selected.ws, DisplayUnits));
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
        $('#selected_wd').text(format_track_brief(wd, true));
        $('#selected_ws').text(format_speed_long(ws, DisplayUnits));
    } else {
        $('#selected_wd').text('n/a');
        $('#selected_ws').text('n/a');
    }


    if (!globeIndex && selected.true_heading == null && heading != null)
        $('#selected_true_heading').text(format_track_brief(heading));
    else
        $('#selected_true_heading').text(format_track_brief(selected.true_heading));


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
        $('#selected_temp').text(Math.round(tat) + ' / ' + Math.round(oat)  + ' °C');
    else
        $('#selected_temp').text('n/a');

    $('#selected_speed1').text(format_speed_long(selected.gs, DisplayUnits));
    $('#selected_speed2').text(format_speed_long(selected.gs, DisplayUnits));
    $('#selected_ias').text(format_speed_long(selected.ias, DisplayUnits));
    $('#selected_tas').text(format_speed_long(selected.tas, DisplayUnits));
    if (selected.geom_rate != null) {
        $('#selected_vert_rate').text(format_vert_rate_long(selected.geom_rate, DisplayUnits));
    } else {
        $('#selected_vert_rate').text(format_vert_rate_long(selected.baro_rate, DisplayUnits));
    }
    $('#selected_baro_rate').text(format_vert_rate_long(selected.baro_rate, DisplayUnits));
    $('#selected_geom_rate').text(format_vert_rate_long(selected.geom_rate, DisplayUnits));
    if (selected.icao != selIcao) {
        selIcao = selected.icao;
        let hex_html = "<span style='font-family: monospace;' class=identSmall>Hex:" + NBSP + selected.icao.toUpperCase() + "</span>";
        if (globeIndex) {
            let icao_link = "<span  class=identSmall><a class='link identSmall' target=\"_blank\" href=\"" + shareLink + "\">Share</a></span>";
            hex_html = hex_html + NBSP + NBSP + NBSP + icao_link;
        }
        $('#selected_icao').html(hex_html);
    }
    $('#selected_pf_info').text((selected.pfRoute ? selected.pfRoute : "") );
    //+" "+ (selected.pfFlightno ? selected.pfFlightno : "")
    $('#airframes_post_icao').attr('value',selected.icao);
    $('#selected_track1').text(format_track_brief(selected.track));
    $('#selected_track2').text(format_track_brief(selected.track));

    if (selected.seen != null && selected.seen < 1000000) {
        $('#selected_seen').text(format_duration(selected.seen));
    } else {
        $('#selected_seen').text('n/a');
    }

    if (selected.seen_pos != null && selected.seen_pos < 1000000) {
        $('#selected_seen_pos').text(format_duration(selected.seen_pos));
    } else {
        $('#selected_seen_pos').text('n/a');
    }

    $('#selected_country').text(selected.icaorange.country.replace("special use", "special"));
    if (ShowFlags && selected.icaorange.flag_image !== null) {
        $('#selected_flag').removeClass('hidden');
        $('#selected_flag img').attr('src', FlagPath + selected.icaorange.flag_image);
        $('#selected_flag img').attr('title', selected.icaorange.country);
    } else {
        $('#selected_flag').addClass('hidden');
    }

    if (selected.position == null) {
        $('#selected_position').text('n/a');
    } else {

        if (selected.seen_pos > -1) {
            $('#selected_position').text(format_latlng(selected.position));
        } else {
            $('#selected_position').text(format_latlng(selected.position));
        }
    }
    if (selected.position && SitePosition) {
        selected.sitedist = ol.sphere.getDistance(SitePosition, selected.position);
    }
    $('#selected_source').text(format_data_source(selected.getDataSource()));
    $('#selected_category').text(selected.category ? selected.category : "n/a");
    $('#selected_sitedist1').text(format_distance_long(selected.sitedist, DisplayUnits));
    $('#selected_sitedist2').text(format_distance_long(selected.sitedist, DisplayUnits));
    $('#selected_rssi1').text(selected.rssi != null ? selected.rssi.toFixed(1) : "n/a");
    if (globeIndex && binCraft && !showTrace) {
        $('#selected_message_count').prev().text('Receivers:');
        $('#selected_message_count').prop('title', 'Number of receivers receiving this aircraft');
        if (selected.receiverCount >= 5 && selected.dataSource != 'mlat') {
            $('#selected_message_count').text('> ' + selected.receiverCount);
        } else {
            $('#selected_message_count').text(selected.receiverCount);
        }
    } else {
        $('#selected_message_count').prev().text('Messages:');
        $('#selected_message_count').prop('title', 'The total number of messages received from this aircraft');
        $('#selected_message_count').text(selected.messages);
    }
    $('#selected_message_rate').text((selected.messageRate != null) ? (selected.messageRate.toFixed(1)) : "n/a");
    $('#selected_photo_link').html(getPhotoLink(selected));

    $('#selected_altitude_geom').text(format_altitude_long(selected.alt_geom, selected.geom_rate, DisplayUnits));
    $('#selected_ias').text(format_speed_long(selected.ias, DisplayUnits));
    $('#selected_tas').text(format_speed_long(selected.tas, DisplayUnits));
    if (selected.mach == null) {
        $('#selected_mach').text('n/a');
    } else {
        $('#selected_mach').text(selected.mach.toFixed(3));
    }
    if (selected.roll == null) {
        $('#selected_roll').text('n/a');
    } else {
        $('#selected_roll').text(selected.roll.toFixed(1));
    }
    if (selected.track_rate == null) {
        $('#selected_trackrate').text('n/a');
    } else {
        $('#selected_trackrate').text(selected.track_rate.toFixed(2));
    }
    $('#selected_geom_rate').text(format_vert_rate_long(selected.geom_rate, DisplayUnits));
    if (selected.nav_qnh == null) {
        $('#selected_nav_qnh').text("n/a");
    } else {
        $('#selected_nav_qnh').text(selected.nav_qnh.toFixed(1) + " hPa");
    }
    $('#selected_nav_altitude').text(format_altitude_long(selected.nav_altitude, 0, DisplayUnits));
    $('#selected_nav_heading').text(format_track_brief(selected.nav_heading));
    if (selected.nav_modes == null) {
        $('#selected_nav_modes').text("n/a");
    } else {
        $('#selected_nav_modes').text(selected.nav_modes.join());
    }
    if (selected.nic_baro == null) {
        $('#selected_nic_baro').text("n/a");
    } else {
        if (selected.nic_baro == 1) {
            $('#selected_nic_baro').text("cross-checked");
        } else {
            $('#selected_nic_baro').text("not cross-checked");
        }
    }

    $('#selected_nac_p').text(format_nac_p(selected.nac_p));
    $('#selected_nac_v').text(format_nac_v(selected.nac_v));
    if (selected.rc == null) {
        $('#selected_rc').text("n/a");
    } else if (selected.rc == 0) {
        $('#selected_rc').text("unknown");
    } else {
        $('#selected_rc').text(format_distance_short(selected.rc, DisplayUnits));
    }

    if (selected.sil == null || selected.sil_type == null) {
        $('#selected_sil').text("n/a");
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
                silDesc = "&gt; 1×10<sup>-3</sup>";
                break;
            case 1:
                silDesc = "≤ 1×10<sup>-3</sup>";
                break;
            case 2:
                silDesc = "≤ 1×10<sup>-5</sup>";
                break;
            case 3:
                silDesc = "≤ 1×10<sup>-7</sup>";
                break;
            default:
                silDesc = "n/a";
                sampleRate = "";
                break;
        }
        $('#selected_sil').html(silDesc + sampleRate);
    }

    if (selected.version == null) {
        $('#selected_version').text('none');
    } else if (selected.version == 0) {
        $('#selected_version').text('v0 (DO-260)');
    } else if (selected.version == 1) {
        $('#selected_version').text('v1 (DO-260A)');
    } else if (selected.version == 2) {
        $('#selected_version').text('v2 (DO-260B)');
    } else {
        $('#selected_version').text('v' + selected.version);
    }

    adjustInfoBlock();
}

function refreshHighlighted() {
    // this is following nearly identical logic, etc, as the refreshSelected function, but doing less junk for the highlighted pane
    let highlighted = HighlightedPlane;

    if (!highlighted) {
        $('#highlighted_infoblock').hide();
        return;
    }

    $('#highlighted_infoblock').show();

    let infoBox = $('#highlighted_infoblock');

    let marker = highlighted.marker || highlighted.glMarker;
    let geom;
    let markerCoordinates;
    if (!marker || !(geom = marker.getGeometry()) || !(markerCoordinates = geom.getCoordinates()) ) {
        $('#highlighted_infoblock').hide();
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

    $('#highlighted_callsign').text(highlighted.name);

    if (highlighted.icaoType !== null) {
        $('#highlighted_icaotype').text(highlighted.icaoType);
    } else {
        $('#highlighted_icaotype').text("n/a");
    }

    $('#highlighted_source').text(format_data_source(highlighted.getDataSource()));

    if (highlighted.registration !== null) {
        $('#highlighted_registration').text(highlighted.registration);
    } else {
        $('#highlighted_registration').text("n/a");
    }

    $('#highlighted_speed').text(format_speed_long(highlighted.gs, DisplayUnits));

    $("#highlighted_altitude").text(format_altitude_long(highlighted.altitude, highlighted.vert_rate, DisplayUnits));

    $('#highlighted_pf_route').text((highlighted.pfRoute ? highlighted.pfRoute : highlighted.icao.toUpperCase()));

    $('#highlighted_rssi').text(highlighted.rssi != null ? highlighted.rssi.toFixed(1) + ' dBFS' : "n/a");
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
(function (global, $, TAR) {
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
        value: function(plane) { return (flightawareLinks ? getFlightAwareModeSLink(plane.icao, plane.flight, plane.name) : plane.name); },
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
        sort: function () { sortBy('data_source', compareNumeric, function(x) { return x.getDataSourceNumber() } ); },
        value: function(plane) { return format_data_source(plane.getDataSource()); },
        align: 'right' };

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
            plane.inView = plane.visible && inView(plane.position, planeMan.lastRenderExtent);

            TrackedHistorySize += plane.history_size;

            if (tableInView) {
                if (plane.visible)
                    TrackedAircraft++;
                if (plane.inView || plane.selected) {
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
                plane.refreshTR = true;
            }

            if (plane.refreshTR || plane.selected != plane.selectCache) {
                plane.refreshTR = false;
                let colors = tableColors.unselected;
                let bgColor = "#F8F8F8"

                plane.selectCache = plane.selected;
                if (plane.selected)
                    colors = tableColors.selected;

                if (plane.dataSource && plane.dataSource in colors)
                    bgColor = colors[plane.dataSource];

                if (plane.squawk in tableColors.special)
                    bgColor = tableColors.special[plane.squawk];

                if (plane.bgColorCache != bgColor) {
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
        $('#dump1090_total_history').text(TrackedHistorySize);
        $('#dump1090_message_rate').text(MessageRate === null ? 'n/a' : MessageRate.toFixed(1));
        $('#dump1090_total_ac').text(globeIndex ? globeTrackedAircraft : TrackedAircraft);
        $('#dump1090_total_ac_positions').text(TrackedAircraftPositions);



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
            $('#grouptype_checkbox').removeClass('settingsCheckboxChecked');
            grouptype_checkbox = false;
        } else if (id == 'data_source' && !grouptype_checkbox) {
            $('#grouptype_checkbox').addClass('settingsCheckboxChecked');
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
        const sortableColumns = $('#sortableColumns').sortable({
            update: function (event, ui) {
                const order = [];
                $('#sortableColumns li').each(function (e) {
                    order.push($(this).attr('id').replace(prefix, ''));
                });

                localStorage['columnOrder'] = JSON.stringify(order);
                columns = createOrderedColumns();

                planeMan.redraw();
            }
        });

        for (let col of columns) {
            sortableColumns.append(`<li class="ui-state-default" id="${prefix + col.id}"></li>`);

            new Toggle({
                key: col.toggleKey,
                display: col.text,
                container: $(`#${prefix + col.id}`),
                init: col.visible,
                setState: function (state) {
                    planeMan.setColumnVis(col.id, state);
                }
            });
        }
    }

    function createOrderedColumns() {
        const order = localStorage['columnOrder'];
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
        SelectedPlane = null;
        refreshSelected();
    }

    plane.updateTick('redraw');
}
let scount = 0;
function select(plane, options) {
    if (!plane)
        return;
    options = options || {};
    plane.selected = true;
    if (!SelPlanes.includes(plane))
        SelPlanes.push(plane);

    SelectedPlane = plane;
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
    //console.log("SELECTING", hex, options);
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

    // If we are clicking the same plane, we are deselecting it unless noDeselect is specified
    if (options.noDeselect) {
        oldPlane = null;
    } else {
        if (multiSelect) {
            // multiSelect deselect
            if (newPlane && newPlane.selected && !onlySelected && !options.noDeselect) {
                deselect(newPlane);
                newPlane = null;
                hex = null;
            }
        } else {
            // normal deselect
            if (oldPlane && oldPlane != newPlane) {
                deselect(oldPlane);
                oldPlane = null;
            }
        }
        if (oldPlane != null && oldPlane == newPlane) {
            deselect(newPlane);
            oldPlane = null;
            newPlane = null;
            hex = null;
        }
    }

    if (!options.noFetch && globeIndex && hex)
        newPlane = getTrace(newPlane, hex, options);

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

    updateAddressBar();
    pTracks || TAR.planeMan.refresh();
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

    SelectedAllPlanes = true;
    refreshFeatures();

    $('#selectall_checkbox').addClass('settingsCheckboxChecked');

    refreshSelected();
    refreshHighlighted();
    pTracks || TAR.planeMan.refresh();
}

// deselect all the planes
function deselectAllPlanes(keepMain) {
    if (showTrace)
        return;
    if (!multiSelect && SelectedPlane)
        toggleIsolation(false, "off");

    if (SelectedAllPlanes) {
        buttonActive('#T', false);
        $('#selectall_checkbox').removeClass('settingsCheckboxChecked');
        SelectedAllPlanes = false;
        for (let i in PlanesOrdered) {
            const plane = PlanesOrdered[i];
            plane.updateTick(true);
        }
        mapRefresh();
        return;
    }

    for (let i in SelPlanes) {
        const plane = SelPlanes[i];
        if (keepMain && plane == SelectedPlane)
            continue;
        deselect(plane);
    }

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

    // Reset localStorage values and map settings
    localStorage['CenterLat'] = CenterLat = DefaultCenterLat;
    localStorage['CenterLon'] = CenterLon = DefaultCenterLon;
    localStorage['ZoomLvl']   = ZoomLvl = DefaultZoomLvl;

    // Set and refresh
    OLMap.getView().setZoom(ZoomLvl);
    OLMap.getView().setCenter(ol.proj.fromLonLat([CenterLon, CenterLat]));
    OLMap.getView().setRotation(mapOrientation);

    //selectPlaneByHex(null,false);
    $("#update_error").css('display','none');
}

function updateMapSize() {
    if (OLMap)
        OLMap.updateSize();
}

function expandSidebar(e) {
    e.preventDefault();
    $("#map_container").hide()
    mapIsVisible = false;
    $("#toggle_sidebar_control").hide();
    $("#splitter").hide();
    $("#shrink_sidebar_button").show();
    $("#sidebar_container").width("100%");
    TAR.planeMan.redraw();
    clearTimeout(refreshId);
    fetchData();
    updateMapSize();
    adjustInfoBlock();
}

function showMap() {
    $('#sidebar_container').width(localStorage['sidebar_width']).css('margin-left', '0');
    $("#map_container").show()
    mapIsVisible = true;
    $("#toggle_sidebar_control").show();
    $("#splitter").show();
    $("#shrink_sidebar_button").hide();
    TAR.planeMan.redraw();
    clearTimeout(refreshId);
    fetchData();
    updateMapSize();
}


let selectedPhotoCache = null;

function setPhotoHtml(source) {
    if (selectedPhotoCache == source)
        return;
    //console.log(source + ' ' + selectedPhotoCache);
    selectedPhotoCache = source;
    $('#selected_photo').html(source);
}

function adjustInfoBlock() {
    if (wideInfoBlock ) {
        infoBlockWidth = baseInfoBlockWidth + 40;
    } else {
        infoBlockWidth = baseInfoBlockWidth;
    }
    $('#selected_infoblock').css("width", infoBlockWidth * globalScale + 'px');

    $('#large_mode_control').css('left', (infoBlockWidth * globalScale + 10) + 'px');
    $('.ol-scale-line').css('left', (infoBlockWidth * globalScale + 8) + 'px');

    if (SelectedPlane && toggles['selectedDetails'].state) {
        if (!mapIsVisible)
            $("#sidebar_container").css('margin-left', '140pt');
        //$('#sidebar_canvas').css('margin-bottom', $('#selected_infoblock').height() + 'px');
        //
        if (mapIsVisible && document.getElementById('map_canvas').clientWidth < parseFloat($('#selected_infoblock').css('width')) * 3) {
            $('#selected_infoblock').css('height', '290px');
            $('#large_mode_control').css('left', (5 * globalScale) + 'px');
            $('#selected_typedesc').parent().parent().hide();
            $('#credits').css('bottom', '295px');
            $('#credits').css('left', '5px');
        } else {
            $('#selected_infoblock').css('height', '100%');
            $('#credits').css('bottom', '');
            $('#credits').css('left', '');
        }

        $('#selected_infoblock').show();
    } else {
        if (!mapIsVisible)
            $("#sidebar_container").css('margin-left', '0');
        //$('#sidebar_canvas').css('margin-bottom', 0);

        $('#large_mode_control').css('left', (5 * globalScale) + 'px');
        $('.ol-scale-line').css('left', '8px');
        $('#credits').css('bottom', '');
        $('#credits').css('left', '');

        $('#selected_infoblock').hide();
    }

    let photoWidth = document.getElementById('photo_container').clientWidth;
    let refWidth = (infoBlockWidth - 29) * globalScale;
    if (Math.abs(photoWidth / refWidth - 1) > 0.05)
        photoWidth = refWidth;

    $('#airplanePhoto').css("width", photoWidth + 'px');
    $('#selected_photo').css("width", photoWidth + 'px');

    if (showPictures) {
        if (planespottersAPI)
            $('#photo_container').css('height', photoWidth * 0.883 + 'px');
        else
            $('#photo_container').css('height', '40px');
    }
}

function initializeUnitsSelector() {
    // Get display unit preferences from local storage
    if (!localStorage.getItem('displayUnits')) {
        localStorage['displayUnits'] = 'nautical';
    }

    DisplayUnits = localStorage['displayUnits'];

    // Initialize drop-down
    $('#units_selector')
        .val(DisplayUnits)
        .on('change', onDisplayUnitsChanged);

    $(".altitudeUnit").text(get_unit_label("altitude", DisplayUnits));
    $(".speedUnit").text(get_unit_label("speed", DisplayUnits));
    $(".distanceUnit").text(get_unit_label("distance", DisplayUnits));
    $(".verticalRateUnit").text(get_unit_label("verticalRate", DisplayUnits));
}

function onDisplayUnitsChanged(e) {
    localStorage['displayUnits'] = DisplayUnits = e.target.value;

    TAR.altitudeChart.render();

    // Update filters
    updateAltFilter();

    // Refresh data
    refreshFilter();

    // Redraw range rings
    if (SitePosition != null && SiteCircles) {
        createSiteCircleFeatures();
    }

    // Reset map scale line units
    OLMap.getControls().forEach(function(control) {
        if (control instanceof ol.control.ScaleLine) {
            control.setUnits(DisplayUnits);
        }
    });

    $(".altitudeUnit").text(get_unit_label("altitude", DisplayUnits));
    $(".speedUnit").text(get_unit_label("speed", DisplayUnits));
    $(".distanceUnit").text(get_unit_label("distance", DisplayUnits));
    $(".verticalRateUnit").text(get_unit_label("verticalRate", DisplayUnits));
    TAR.planeMan.redraw();
}

function onFilterByAltitude(e) {
    e.preventDefault();
    $("#altitude_filter_min").blur();
    $("#altitude_filter_max").blur();


    if (SelectedPlane && SelectedPlane.isFiltered()) {
        SelectedPlane.selected = false;
        SelectedPlane.clearLines();
        SelectedPlane = null;
    }

    updateAltFilter();
    refreshFilter();
}

function refreshFilter() {
    if (filterTracks)
        remakeTrails();

    TAR.planeMan.refresh();
    refreshSelected();
    refreshHighlighted();
    mapRefresh();

    drawHeatmap();
}

function filterGroundVehicles(switchFilter) {
    if (typeof localStorage['groundVehicleFilter'] === 'undefined') {
        localStorage['groundVehicleFilter'] = 'not_filtered';
    }
    let groundFilter = localStorage['groundVehicleFilter'];
    if (switchFilter === true) {
        groundFilter = (groundFilter === 'not_filtered') ? 'filtered' : 'not_filtered';
    }
    if (groundFilter === 'not_filtered') {
        $('#groundvehicle_filter').addClass('settingsCheckboxChecked');
    } else {
        $('#groundvehicle_filter').removeClass('settingsCheckboxChecked');
    }
    localStorage['groundVehicleFilter'] = groundFilter;
    PlaneFilter.groundVehicles = groundFilter;
}

function filterBlockedMLAT(switchFilter) {
    if (typeof localStorage['blockedMLATFilter'] === 'undefined') {
        localStorage['blockedMLATFilter'] = 'not_filtered';
    }
    let blockedMLATFilter = localStorage['blockedMLATFilter'];
    if (switchFilter === true) {
        blockedMLATFilter = (blockedMLATFilter === 'not_filtered') ? 'filtered' : 'not_filtered';
    }
    if (blockedMLATFilter === 'not_filtered') {
        $('#blockedmlat_filter').addClass('settingsCheckboxChecked');
    } else {
        $('#blockedmlat_filter').removeClass('settingsCheckboxChecked');
    }
    localStorage['blockedMLATFilter'] = blockedMLATFilter;
    PlaneFilter.blockedMLAT = blockedMLATFilter;
}

function buttonActive(id, state) {
    if (state) {
        $(id).addClass('activeButton');
        $(id).removeClass('inActiveButton');
    } else {
        $(id).addClass('inActiveButton');
        $(id).removeClass('activeButton');
    }
}

function toggleIsolation(on, off) {
    let prevState = onlySelected;
    if (showTrace && !on && !off)
        return;
    onlySelected = !onlySelected;
    if (on)
        onlySelected = true;
    if (off)
        onlySelected = false;

    buttonActive('#I', onlySelected);

    if (prevState != onlySelected)
        refreshFilter();
}

function toggleMilitary() {
    onlyMilitary = !onlyMilitary;
    buttonActive('#U', onlyMilitary);

    refreshFilter();
}

function togglePersistence() {
    noVanish = !noVanish;
    //filterTracks = noVanish;

    buttonActive('#P', noVanish);

    remakeTrails();

    if (!noVanish)
        reaper();
    localStorage['noVanish'] = noVanish;
    console.log('noVanish = ' + noVanish);

    refreshFilter();
}

function dim(evt) {
    if (!globalCompositeTested) {
            globalCompositeTested = true;
        evt.context.globalCompositeOperation = 'multiply';
        if (evt.context.globalCompositeOperation != 'multiply')
            globalCompositeTested = false;
        evt.context.globalCompositeOperation = 'overlay';
        if (evt.context.globalCompositeOperation != 'overlay')
            globalCompositeTested = false;
    }
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
}

//
// Altitude Chart begin
//
(function (global, $, TAR) {
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
        $(data).find('#linear-gradient').html(createLegendGradientStops());

        const svg = $('svg', data).prop('outerHTML');

        return 'url("data:image/svg+xml;base64,' + global.btoa(svg) + '")';
    }

    function loadLegend() {
        let baseLegend = (DisplayUnits === 'metric') ? 'images/alt_legend_meters.svg' : 'images/alt_legend_feet.svg';

        $.get(baseLegend, function (data) {
            $('#altitude_chart_button').css("background-image", createLegendUrl(data));
        });
    }

    altitudeChart.render = function () {
        if (toggles['altitudeChart'].state) {
            loadLegend();
            $('#altitude_chart').show();
        } else {
            $('#altitude_chart').hide();
        }
    }

    altitudeChart.init = function () {
        new Toggle({
            key: "altitudeChart",
            display: "Altitude Chart",
            container: "#settingsLeft",
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
    localStorage['tableInView'] = tableInView;

    $('#with_positions').text(tableInView ? "On Screen:" : "With Position:");

    buttonActive('#V', tableInView);
}

function toggleLabels() {
    enableLabels = !enableLabels;
    localStorage['enableLabels'] = enableLabels;
    for (let key in PlanesOrdered) {
        PlanesOrdered[key].updateMarker();
    }
    refreshFeatures();
    buttonActive('#L', enableLabels);

    if (showTrace)
        remakeTrails();
}

function toggleExtendedLabels() {
    if (isNaN(extendedLabels))
        extendedLabels = 0;

    extendedLabels++;
    extendedLabels %= 3;
    //console.log(extendedLabels);
    localStorage['extendedLabels'] = extendedLabels;
    for (let key in PlanesOrdered) {
        PlanesOrdered[key].updateMarker();
    }
    buttonActive('#O', extendedLabels);
}

function toggleTrackLabels() {
    trackLabels = !trackLabels;
    localStorage['trackLabels'] = trackLabels;

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
            toggleIsolation(false, "off");
        if (prevState != multiSelect)
            deselectAllPlanes("keepMain");
    }

    buttonActive('#M', multiSelect);
}

function onJump(e) {
    toggleFollow(false);
    if (e) {
        e.preventDefault();
        airport = $("#jump_input").val().trim().toUpperCase();
        $("#jump_input").val("");
        $("#jump_input").blur();
    }
    if (!_airport_coords_cache) {
        $.getJSON(databaseFolder + "/airport-coords.js")
            .done(function(data) {
                _airport_coords_cache = data;
                onJump();
            });
    } else {
        const coords = _airport_coords_cache[airport];
        if (coords) {
            OLMap.getView().setCenter(ol.proj.fromLonLat([coords[1], coords[0]]));

            if (ZoomLvl >= 7) {
                fetchData({force: true});
            }

            refreshFilter();
        }
    }
}

function onSearch(e) {
    e.preventDefault();
    const searchTerm = $("#search_input").val().trim();
    $("#search_input").val("");
    $("#search_input").blur();
    if (searchTerm)
        findPlanes(searchTerm, "byIcao", "byCallsign", "byReg", "byType");
    return false;
}

/*
function onSearchReg(e) {
    e.preventDefault();
    const searchTerm = $("#search_reg_input").val().trim();
    $("#search_reg_input").val("");
    $("#search_reg_input").blur();
    if (searchTerm)
        findPlanes(searchTerm, false, false, "byReg", false);
    return false;
}
*/

function onResetCallsignFilter(e) {
    $("#callsign_filter").val("");
    $("#callsign_filter").blur();

    updateCallsignFilter();
}

function updateCallsignFilter(e) {
    if (e)
        e.preventDefault();

    $("#callsign_filter").blur();

    PlaneFilter.callsign = $("#callsign_filter").val().trim().toUpperCase();

    refreshFilter();
}

function onResetTypeFilter(e) {
    $("#type_filter").val("");
    $("#type_filter").blur();

    updateTypeFilter();
}

function updateTypeFilter(e) {
    if (e)
        e.preventDefault();

    $("#type_filter").blur();
    let type = $("#type_filter").val().trim();

    PlaneFilter.type = type.toUpperCase();

    refreshFilter();
}

function onResetIcaoFilter(e) {
    $("#icao_filter").val("");
    $("#icao_filter").blur();

    updateIcaoFilter();
}

function updateIcaoFilter(e) {
    if (e)
        e.preventDefault();

    $("#icao_filter").blur();
    let icao = $("#icao_filter").val().trim();

    PlaneFilter.icao = icao.toLowerCase();

    refreshFilter();
}

function onResetDescriptionFilter(e) {
    $("#description_filter").val("");
    $("#description_filter").blur();

    updateTypeFilter();
}

function updateDescriptionFilter(e) {
    if (e)
        e.preventDefault();

    $("#description_filter").blur();
    let description = $("#description_filter").val().trim();

    PlaneFilter.description = description.toUpperCase();

    refreshFilter();
}

function onResetAltitudeFilter(e) {
    $("#altitude_filter_min").val("");
    $("#altitude_filter_max").val("");
    $("#altitude_filter_min").blur();
    $("#altitude_filter_max").blur();

    updateAltFilter();
    refreshFilter();
}

function updateAltFilter() {
    let minAltitude = parseFloat($("#altitude_filter_min").val().trim());
    let maxAltitude = parseFloat($("#altitude_filter_max").val().trim());
    let enabled = false;

    if (minAltitude < -1e6 || minAltitude > 1e6 || isNaN(minAltitude))
        minAltitude = -1e6;
    else
        enabled = true;
    if (maxAltitude < -1e6 || maxAltitude > 1e6 || isNaN(maxAltitude))
        maxAltitude = 1e6;
    else
        enabled = true;

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
        return "<a target=\"_blank\" href=\"https://flightaware.com/live/flight/" + ident.trim() + "\" rel=\"noreferrer\">" + linkText + "</a>";
    }

    return "";
}

function onResetSourceFilter(e) {
    $('#sourceFilter .ui-selected').removeClass('ui-selected');

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
    $('#flagFilter .ui-selected').removeClass('ui-selected');

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

        let linkHtml = "<a target=\"_blank\" href=\"https://flightaware.com/live/modes/" + code ;
        if (ident != null && ident !== "") {
            linkHtml += "/ident/" + ident.trim();
        }
        linkHtml += "/redirect\" rel=\"noreferrer\">" + linkText + "</a>";
        return linkHtml;
    }

    return "";
}

function getPhotoLink(ac) {
    if (flightawareLinks) {
        if (ac.registration == null || ac.registration == "")
            return "";
        return "<a target=\"_blank\" href=\"https://flightaware.com/photos/aircraft/" + ac.registration.replace(/[^0-9a-z]/ig,'') + "\" rel=\"noreferrer\">See Photos</a>";
    } else {
        return "<a target=\"_blank\" href=\"https://www.planespotters.net/hex/" + ac.icao.toUpperCase() + "\" rel=\"noreferrer\">View on Planespotters</a>";
    }
}

// takes in an elemnt jQuery path and the OL3 layer name and toggles the visibility based on clicking it
function toggleLayer(element, layer) {
    // set initial checked status
    ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
        if (lyr.get('name') === layer && lyr.getVisible()) {
            $(element).addClass('settingsCheckboxChecked');
        }
    });
    $(element).on('click', function() {
        let visible = false;
        if ($(element).hasClass('settingsCheckboxChecked')) {
            visible = true;
        }
        ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
            if (lyr.get('name') === layer) {
                if (visible) {
                    lyr.setVisible(false);
                    $(element).removeClass('settingsCheckboxChecked');
                } else {
                    lyr.setVisible(true);
                    $(element).addClass('settingsCheckboxChecked');
                }
            }
        });
    });
}

function fetchPfData() {
    if (fetchingPf || pTracks || tabHidden)
        return;
    fetchingPf = true;
    for (let i in pf_data) {
        const req = $.ajax({ url: pf_data[i],
            dataType: 'json' });
        $.when(req).done(function(data) {
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

    // small zoomstep, no need to change aircraft scaling
    if (!init && Math.abs(ZoomLvl-ZoomLvlCache) < 0.4)
        return;

    localStorage['ZoomLvl'] = ZoomLvl;
    ZoomLvlCache = ZoomLvl;

    let oldScaleFactor = scaleFactor;

    if (ZoomLvl > markerZoomDivide)
        scaleFactor = markerBig;
    else
        scaleFactor = markerSmall;

    // scale markers according to global scaling
    scaleFactor *= Math.pow(1.3, globalScale) * globalScale * iconScale;;

    if (!init && showTrace)
        updateAddressBar();

    checkPointermove();
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

    localStorage['CenterLon'] = CenterLon = center[0];
    localStorage['CenterLat'] = CenterLat = center[1];

    if (!init && showTrace)
        updateAddressBar();

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
    if (tabHidden)
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
}

let lastRefresh = 0;
let refreshZoom, refreshLat, refreshLon;
function checkRefresh() {
    if (tabHidden)
        return;
    const center = ol.proj.toLonLat(OLMap.getView().getCenter());
    const zoom = OLMap.getView().getZoom();
    if (showTrace)
        return;

    if (triggerRefresh || zoom != refreshZoom || center[0] != refreshLon || center[1] != refreshLat) {

        const ts = new Date().getTime();
        const elapsed = Math.abs(ts - lastRefresh);
        let num = Math.min(1500, Math.max(250, TrackedAircraftPositions / 300 * 250));
        if (elapsed < num) {
            return;
        }
        lastRefresh = ts;

        refreshZoom = zoom;
        refreshLat = center[1];
        refreshLon = center[0];

        //console.time("refreshTable");
        TAR.planeMan.refresh();
        //console.timeEnd("refreshTable");
        mapRefresh();

        triggerRefresh = 0;
    }
}
function mapRefresh() {
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

    addToMap.sort(function(x, y) { return x.altSort - y.altSort; });
    //console.log('maprefresh(): ' + addToMap.length);
    if (webgl) {
        webglFeatures.clear();
    }
    if (globeIndex && !icaoFilter) {
        for (let i in addToMap) {
            addToMap[i].updateFeatures();
        }
    } else {
        for (let i in addToMap) {
            addToMap[i].updateTick();
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

function processURLParams(){

    let icaos = [];
    let valid = [];
    let icao = null;
    if (usp.has('icao')) {
        icaos = usp.get('icao').toLowerCase().split(',');
        for (let i = 0; i < icaos.length; i++) {
            icao = icaos[i].toLowerCase();
            if (icao && (icao.length == 7 || icao.length == 6) && icao.toLowerCase().match(/[a-f,0-9]{6}/)) {
                valid.push(icao);
            }
        }
    }

    icaos = valid.reverse();

    if (usp.has('showTrace')) {
        let date = setTraceDate(usp.get('showTrace'));
        if (date && usp.has('startTime')) {
            let numbers =  usp.get('startTime').split(':');
            traceOpts.startHours = numbers[0] ? numbers[0] : 0;
            traceOpts.startMinutes = numbers[1] ? numbers[1] : 0;
            traceOpts.startSeconds = numbers[2] ? numbers[2] : 0;
        }
        if (date && usp.has('endTime')) {
            let numbers = usp.get('endTime').split(':');
            traceOpts.endHours = numbers[0] ? numbers[0] : 24;
            traceOpts.endMinutes = numbers[1] ? numbers[1] : 0;
            traceOpts.endSeconds = numbers[2] ? numbers[2] : 0;
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
            noPan = true;
        }
        catch (error) {
            console.log("Error parsing lat/lon:", error);
        }
    }

    if (icaos.length > 0) {
        if (!usp.has('noIsolation'))
            toggleIsolation("on", false);
        if (icaos.length > 1) {
            toggleMultiSelect("on");
            //follow = false;
        }
        for (let i = 0; i < icaos.length; i++) {
            icao = icaos[i];
            if (Planes[icao] || globeIndex) {
                console.log('Selected ICAO id: '+ icao);
                let selectOptions = {follow: follow, noDeselect: true};
                if (traceDate != null) {
                    let newPlane = Planes[icao] || new PlaneObject(icao);
                    newPlane.last_message_time = NaN;
                    newPlane.position_time = NaN;
                    newPlane.selected = true;
                    select(newPlane);
                    if (!zoom)
                        zoom = 5;
                } else {
                    if (!zoom)
                        zoom = 7;
                    selectPlaneByHex(icao, selectOptions)
                }
            } else {
                console.log('ICAO id not found: ' + icao);
            }
        }
        if (traceDate != null)
            toggleShowTrace();
        updateAddressBar();
    } else if (callsign != null) {
        findPlanes(callsign, false, true, false, false);
    }

    if (zoom) {
        OLMap.getView().setZoom(zoom);
    }

    if (usp.has('mil'))
        toggleMilitary();

    if (usp.has('airport')) {
        airport = usp.get('airport').trim().toUpperCase();
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

function findPlanes(query, byIcao, byCallsign, byReg, byType) {
    if (query == null)
        return;
    query = query.toLowerCase();
    let results = [];
    if (byReg) {
        if (regCache) {
            if (regCache[query.toUpperCase()]) {
                selectPlaneByHex(regCache[query.toUpperCase()].toLowerCase(), {follow: true});
                return;
            }
        } else {
            let req_url = databaseFolder + "/regIcao.js";
            let req = $.ajax({ url: req_url,
                cache: true,
                timeout: 10000,
                dataType : 'json'
            });
            req.done(function(data) {
                regCache = data;
                if (regCache[query.toUpperCase()]) {
                    selectPlaneByHex(regCache[query.toUpperCase()].toLowerCase(), {follow: true});
                    return;
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
            if (plane.checkVisible())
                results.push(plane);
        }
    }
    if (results.length > 1) {
        toggleMultiSelect("on");
        for (let i in results) {
            results[i].selected = true;
            results[i].updateTick(true);
        }
    } else if (results.length == 1) {
        selectPlaneByHex(results[0].icao, {follow: true});
        console.log("query selected: " + query);
    } else {
        console.log("No match found for query: " + query);
        if (globeIndex && query.length == 6 && query.toLowerCase().match(/[a-f,0-9]{6}/)) {
            console.log("maybe it's an icao, let's try to fetch the history for it!");
            selectPlaneByHex(query, {follow: true})
        }
    }
}

function trailReaper() {
    if (tabHidden)
        return;
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
    if (heatmap || pTracks)
        return;
    let now = new Date().getTime();
    if (now < lastAddressBarUpdate + 200) {
        clearTimeout(updateAddressBarTimeout);
        updateAddressBarTimeout = setTimeout(updateAddressBar, 205);
        return;
    }
    lastAddressBarUpdate = now;

    let posString = 'lat=' + CenterLat.toFixed(3) + '&lon=' + CenterLon.toFixed(3) + '&zoom=' + ZoomLvl.toFixed(1);
    let string;
    if ((showTrace || replay) && SelectedPlane) {
        posString = "&" + posString;
    } else {
        posString = ""
    }

    string = pathName;
    if (SelPlanes.length > 0) {
        string += '?icao=';
        for (let i in SelPlanes) {
            string += SelPlanes[i].icao;
            if (i < SelPlanes.length - 1)
                string += ',';
        }
    }

    string += posString;

    if (SelectedPlane && (showTrace || replay)) {
        string += '&showTrace=' + traceDateString;
        if (legSel != -1)
            string += '&leg=' + (legSel + 1);
        if (traceOpts.startHours != null) {
            string += '&startTime=';
            string += traceOpts.startHours + ':'
            string += traceOpts.startMinutes + ':';
            string += traceOpts.startSeconds;
        }
        if (traceOpts.endHours != null) {
            string += '&endTime=';
            string += traceOpts.endHours + ':'
            string += traceOpts.endMinutes + ':';
            string += traceOpts.endSeconds;
        }
    }

    shareLink = string;

    if (uuid)
        return;
    if (icaoFilter)
        return;

    if (SelPlanes.length == 0 && initialURL && initialURL.indexOf("icao") < 0)
        string = initialURL;

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

    // handle non globe case
    if (!globeIndex) {
        if (tabHidden)
            return Math.min(4000, refresh);
        else
            return refresh;
    }

    // handle globe case

    if (tabHidden)
        return 24 * 3600 * 1000; // hidden tab, don't refresh to avoid freeze when the tab is switched to again.

    if (globeUseBigMil)
        refresh = 10000;

    let inactive = getInactive();

    if (inactive < 70)
        inactive = 70;
    if (inactive > 240)
        inactive = 240;

    refresh *= inactive / 70;

    if (!mapIsVisible)
        refresh *= 2;

    if (onMobile && TrackedAircraftPositions > 800)
        refresh *= 1.5;

    return refresh * refreshMultiplier;
}

function toggleLargeMode() {
    largeMode++;
    if (!(largeMode >= 1 && largeMode <= 4))
        largeMode = 1;

    let root = document.documentElement;

    const base = 1.2;
    globalScale = Math.pow(base, largeMode) / base * userScale;
    root.style.setProperty("--SCALE", globalScale);

    labelFont = "bold " + (12 * globalScale * labelScale) + "px/" + (14 * globalScale * labelScale) + "px Tahoma, Verdana, Helvetica, sans-serif";

    localStorage['largeMode'] = largeMode;

    changeZoom("init");
    setLineWidth();
    refreshFeatures();
    refreshSelected();
    remakeTrails();
}

function toggleShowTrace() {
    if (!showTrace) {
        showTrace = true;
        toggleFollow(false);
        showTraceWasIsolation = onlySelected;
        toggleIsolation("on", null);
        shiftTrace();
    } else {
        showTrace = false;
        traceOpts = {};
        fetchData();
        legSel = -1;
        $('#leg_sel').text('Legs: All');
        if (!showTraceWasIsolation)
            toggleIsolation(null, "off");
        //let string = pathName + '?icao=' + SelectedPlane.icao;
        //window.history.replaceState("object or string", "Title", string);
        //shareLink = string;
        updateAddressBar();
        const hex = SelectedPlane.icao;
        SelectedPlane = null;
        showTraceExit = true;
        selectPlaneByHex(hex, {follow: true, zoom: ZoomLvl,});
    }

    $('#history_collapse').toggle();
    $('#show_trace').toggleClass('active');
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
        $('#leg_sel').text('No Data available for\n' + traceDateString);
        $('#trace_time').text('UTC:\n');
    }
    if (!plane.fullTrace) {
        plane.processTrace();
        return;
    }

    let trace = plane.fullTrace.trace;
    let legStart = null;
    let legEnd = null;
    let count = 0;
    let timeZero = plane.fullTrace.timestamp;

    for (let i = 1; i < trace.length; i++) {
        let timestamp = timeZero + trace[i][0];
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
        $('#leg_sel').text('Legs: All');
        traceOpts.legStart = null;
        traceOpts.legEnd = null;
        plane.processTrace();
        updateAddressBar();
        return;
    }

    count = 0;
    for (let i = legStart + 1; i < trace.length; i++) {
        let timestamp = timeZero + trace[i][0];
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
    $('#leg_sel').text('Leg: ' + (legSel + 1));
    traceOpts.legStart = legStart;
    traceOpts.legEnd = legEnd;
    plane.processTrace();

    updateAddressBar();
}

function setTraceDate(string) {
    let numbers = string.split('-');
    if (numbers.length != 3)
        return null;
    traceDate = new Date();
    traceDate.setUTCFullYear(numbers[0]);
    traceDate.setUTCMonth(numbers[1] - 1);
    traceDate.setUTCDate(numbers[2]);
    traceDateString = zDateString(traceDate);
    return traceDate;
}

function shiftTrace(offset) {
    if (traceRate > 180) {
        $('#leg_sel').text('Slow down! ...');
        return;
    }
    $('#leg_sel').text('Loading ...');
    if (!traceDate || offset == "today") {
        traceDate = new Date();
    } else if (offset) {
        let sinceEpoch = traceDate.getTime();
        traceDate.setTime(sinceEpoch + offset * 86400 * 1000);
    }
    traceDate.setUTCHours(0);
    traceDate.setUTCMinutes(0);
    traceDate.setUTCSeconds(0);

    traceDay = traceDate.getUTCDate();

    traceDateString = zDateString(traceDate);

    //$('#trace_date').text('UTC day:\n' + traceDateString);
    $("#histDatePicker").datepicker('setDate', traceDateString);

    let selectOptions = {noDeselect: true, zoom: ZoomLvl};
    for (let i in SelPlanes) {
        selectPlaneByHex(SelPlanes[i].icao, selectOptions);
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

function geoFindMe() {

    function success(position) {
        if (!SiteOverride) {
            SiteLat = CenterLat = DefaultCenterLat = position.coords.latitude;
            SiteLon = CenterLon = DefaultCenterLon = position.coords.longitude;
        }
        if (localStorage['geoFindMeFirstVisit'] == undefined) {
            OLMap.getView().setCenter(ol.proj.fromLonLat([CenterLon, CenterLat]));
            localStorage['geoFindMeFirstVisit'] = 'no';
        }
        initSitePos();
    }

    function error() {
        console.log("Unable to query location.");
        initSitePos();
    }

    if (!navigator.geolocation) {
        console.log('Geolocation is not supported by your browser');
    } else {
        console.log('Locating…');
        navigator.geolocation.getCurrentPosition(success, error);
    }
}

window.mobilecheck = function() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};

function initSitePos() {
    // Set SitePosition
    if (SiteLat != null && SiteLon != null) {
        SitePosition = [SiteLon, SiteLat];
        // Add home marker if requested
        createSiteCircleFeatures();
    } else {
        TAR.planeMan.setColumnVis('distance', false);
    }

    if (SitePosition && !onMobile) {
        TAR.planeMan.cols.distance.sort();
    } else {
        TAR.planeMan.cols.altitude.sort();
        TAR.planeMan.cols.altitude.sort();
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

function createSiteCircleFeatures() {
    StaticFeatures.clear();

    // Clear existing circles first
    if (!SitePosition)
        return;

    if (SiteShow) {
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
        StaticFeatures.addFeature(feature);
    }

    if (!SiteCircles)
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
        StaticFeatures.addFeature(feature);
    }
}

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

    // kick off an ajax request that will add the rings when it's done
    if (!globeIndex && !uuid) {
        let request = $.ajax({ url: 'upintheair.json',
            cache: true,
            dataType: 'json' });
        request.done(function(data) {
            let outlineFeatures = new ol.source.Vector();
            layers.insertAt(3,
                new ol.layer.Vector({
                    name: 'upintheair',
                    type: 'overlay',
                    title: 'terrain-based range outline',
                    source: outlineFeatures,
                    visible: !adsbexchange,
                    zIndex: 100,
                    renderOrder: null,
                    renderBuffer: renderBuffer,
                }));
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
                    outlineFeatures.addFeature(feature);
                }
            }
        });

        request.fail(function() {
            // no rings available, do nothing
        });
    }
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
    if (tabHidden)
        return;
    decrementTraceRate();
    updateIconCache();
}

function decrementTraceRate() {
    if (traceRate > 0)
        traceRate = traceRate  * 0.985 - 1;
}

function getTrace(newPlane, hex, options) {

    if (options.list) {
        newPlane = options.list.pop()
        if (!newPlane) {
            return;
        }
        hex = newPlane.icao;
    }

    let now = new Date().getTime();
    let backoff = 200;
    if (!showTrace && !solidT && traceRate > 140 && now < lastTraceGet + backoff) {
        setTimeout(getTrace, lastTraceGet + backoff + 20 - now, newPlane, hex, options);
        return;
    }

    lastTraceGet = now;

    let URL1 = 'data/traces/'+ hex.slice(-2) + '/trace_recent_' + hex + '.json';
    let URL2 = 'data/traces/'+ hex.slice(-2) + '/trace_full_' + hex + '.json';
    //console.log('Requesting trace: ' + hex);

    if (!newPlane) {
        newPlane = Planes[hex] || new PlaneObject(hex);
        newPlane.last_message_time = NaN;
        newPlane.position_time = NaN;
        select(newPlane, options);
    }

    traceOpts.follow = options.follow == true;

    if (showTrace) {
        traceRate += 3;
        let today = new Date();
        //console.log(today.toUTCString() + ' ' + traceDate.toUTCString());
        // use non historic traces for showTrace until 30 min after midnight
        if (today.getTime() > traceDate.getTime() && today.getTime() < traceDate.getTime() + (24 * 3600 + 30 * 60) * 1000) {
        } else {
            URL1 = null;
            URL2 = 'globe_history/' + traceDateString.replace(/-/g, '/') + '/traces/' + hex.slice(-2) + '/trace_full_' + hex + '.json';
        }

        if (traceOpts.startHours == null || traceOpts.startHours < 0)
            traceOpts.startStamp = traceDate.getTime() / 1000;
        else
            traceOpts.startStamp = traceDate.getTime() / 1000 + traceOpts.startHours * 3600 + traceOpts.startMinutes * 60 + traceOpts.startSeconds;

        if (traceOpts.endHours == null || traceOpts.endHours >= 24)
            traceOpts.endStamp = traceDate.getTime() / 1000 + 24 * 3600;
        else
            traceOpts.endStamp = traceDate.getTime() / 1000 + traceOpts.endHours * 3600 + traceOpts.endMinutes * 60 + traceOpts.endSeconds;

    } else if (replay) {
        traceRate += 3;
        let today = new Date();
        if (today.getTime() > traceDate.getTime() && today.getTime() < traceDate.getTime() + (24 * 3600 + 30 * 60) * 1000) {
        } else {
            URL1 = null;
            URL2 = 'globe_history/' + traceDateString.replace(/-/g, '/') + '/traces/' + hex.slice(-2) + '/trace_full_' + hex + '.json';
        }
    } else {
        traceRate += 2;
    }
    if (newPlane && (showTrace || showTraceExit)) {
        newPlane.trace = [];
        newPlane.recentTrace = null;
        newPlane.fullTrace = null;
    }

    //console.log(URL2);

    let req1 = null;
    let req2 = null;

    options.plane = newPlane;
    options.defer = $.Deferred();

    let fake1 = false;

    if (URL1 && !options.onlyFull) {
        req1 = $.ajax({ url: URL1,
            dataType: 'json',
            options: options,
        });
    } else {
        options.defer.resolve(newPlane);
        fake1 = true;
    }

    if (!fake1) {
        req1.done(function(data) {
            let plane = data.plane || this.options.plane;
            plane.recentTrace = data;
            if (!showTrace) {
                plane.processTrace();
                if (options.follow)
                    toggleFollow(true);
            }
            let defer = data.defer || this.options.defer;
            defer.resolve(plane);
            if (options.onlyRecent && options.list) {
                newPlane.updateLines();
                getTrace(null, null, options);
            }
        });
    }
    if (!options.onlyRecent) {

        req2 = $.ajax({ url: URL2,
            dataType: 'json',
            options: options,
        });

        options.req2 = req2;

        req2.done(function(data) {
            let plane = this.options.plane;
            plane.fullTrace = data;
            this.options.defer.done(function(plane) {
                if (showTrace) {
                    legShift(0, plane);
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
        });
        req2.fail(function() {
            let plane = this.options.plane;
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
        });
    }

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
    $("#loader").addClass("hidden");
}

function currentExtent(factor) {
    let size = OLMap.getSize();
    if (factor != null)
        size = [size[0] * factor, size[1] * factor];
    return myExtent(OLMap.getView().calculateExtent(size));
}

function loadReplay(ts) {
    let xhrOverride = new XMLHttpRequest();
    xhrOverride.responseType = 'arraybuffer';

    let time = new Date(ts);
    let sDate = sDateString(time);
    let index = 2 * time.getUTCHours() + Math.floor(time.getUTCMinutes() / 30);

    let base = "globe_history/";
    let URL = base + sDate + "/heatmap/" + index.toString().padStart(2, '0') + ".bin.ttf";
    let req = $.ajax({
        url: URL,
        method: 'GET',
        xhr: function() {
            return xhrOverride;
        }
    });

    traceDate = new Date(ts);
    traceDate.setUTCHours(0);
    traceDate.setUTCMinutes(0);
    traceDate.setUTCSeconds(0);
    traceDay = traceDate.getUTCDate();
    traceDateString = zDateString(traceDate);

    req.done(initReplay);
    req.fail(function(jqxhr, status, error) {
        $("#update_error_detail").text(jqxhr.status + ' --> No data for this timestamp!');
        $("#update_error").css('display','block');
        setTimeout(function() {$("#update_error").css('display','none');}, 5000);
    });
}
function initReplay(data) {
    if (!data) {
        console.log("initReplay: no data!");
        return;
    }
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

    play(0); // kick off first play
}

function play(index) {
    if (!replay)
        return;

    clearTimeout(refreshId);
    refreshId = setTimeout(play, replay.ival / replay.speed);

    if (showTrace)
        return;

    if (index == null) {
        index = replay.index + 1;
    }
    if (index >= replay.slices.length) {
        index = 0;
        reaper(true);
        refreshFilter();
    }
    replay.index = index;


    let points = replay.points;
    let i = replay.slices[index];

    console.log('index: ' + index + ', i: ' + i);

    last = now;
    now = replay.pointsU[i + 2] / 1000 + replay.pointsU[i + 1] * 4294967.296;

    traceOpts.endStamp = now;

    replay.ival = (replay.pointsU[i + 3] & 65535);

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
            ac.squawk = (lat ^ (1<<30)).toString(10).padStart(4, '0');
            processAircraft(ac, false, false);
            continue;
        }
        if (!inView(pos, ext)) {
            continue;
        }

        lat /= 1e6;
        lon /= 1e6;
        pos = [lon, lat];

        let hex = (points[i] & ((1<<24) - 1)).toString(16).padStart(6, '0');
        hex = (points[i] & (1<<24)) ? ('~' + hex) : hex;


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

        if (icaoFilter && !icaoFilter.includes(hex))
            continue;

        let ac = {
            seen: 0,
            seen_pos: 0,
            hex: hex,
            lat: lat,
            lon: lon,
            alt_baro: alt,
            gs: gs,
        };
        processAircraft(ac, false, false);
    }

    checkMovement();
    triggerRefresh = 1;
    checkRefresh();
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
    let now = new Date().getTime();
    // avoid long periods of not fetching data for active users or returning users
    if (now - lastActive > 90 * 1000 || nextFetch - lastFetch > 1.5 * refreshInt()) {
        fetchData({force: true});
    }
    lastActive = now;
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
        StaticFeatures.addFeature(tileFeature);
    } else {
        let west = new ol.geom.LineString([south180p, southWest, northWest, north180p]);
        let east = new ol.geom.LineString([south180m, southEast, northEast, north180m]);
        let westF = new ol.Feature(west);
        let eastF = new ol.Feature(east);
        westF.setStyle(estimateStyle);
        eastF.setStyle(estimateStyle);
        StaticFeatures.addFeature(westF);
        StaticFeatures.addFeature(eastF);
    }
}

function updateMessageRate(data) {
    if (data.messages && uuid == null) {
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
        let time_delta = now - last;
        if (time_delta > 0.5) {
            let message_delta = 0;
            let acs = data.aircraft;
            for (let j=0; j < acs.length; j++) {
                let plane = Planes[acs[j].hex]
                if (plane) {
                    message_delta += (acs[j].messages - plane.messages);
                }
            }
            MessageRate = message_delta / time_delta;
        }
    } else {
        MessageRate = null;
    }
}

function globeRateUpdate() {
    if (tabHidden) return;
    $.ajax({url:'/globeRates.json', cache:false, dataType: 'json', }).done(function(data) {
        if (data.simload != null)
            globeSimLoad = data.simload;
        if (data.refresh != null)
            RefreshInterval = data.refresh;
    });
}

initialize();
