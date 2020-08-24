// Some global letiables are defined in early.js
// early.js takes care of getting some history files while the html page and
// some javascript libraries are still loading, hopefully speeding up loading

"use strict";

// Define our global letiables
let OLMap         = null;
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
let dotCache = {};
let useDots = false;
let lineStyleCache = {};
let Planes        = {};
let PlanesOrdered = [];
let PlaneFilter   = {};
let SelectedPlane = null;
let SelectedAllPlanes = false;
let HighlightedPlane = null;
let FollowSelected = false;
let noPan = false;
let infoBoxOriginalPosition = {};
let customAltitudeColors = true;
let loadtime = "loadtime";
let loadFinished = false;
let mapResizeTimeout;
let pointerMoveTimeout;
let refresh;
let scaleFactor;
let debugTracks = false;
let debugAll = false;
let trackLabels = false;
let fragment;
let grouptype_checkbox;
let multiSelect = false;
let uat_data = null;
let enableLabels = false;
let extendedLabels = 0;
let mapIsVisible = true;
let columnVis = Array(30).fill(true);
let emptyStyle = new ol.style.Style({});
let show_squawk_warning_cache = false;
let tableInView = false;
let historyOutdated = false;
let onlyMLAT = false;
let onlyMilitary = false;
let onlyADSB = false;
let onlySelected = false;
let fetchingPf = false;
let reaping = false;
let debug = false;
let debugJump = false;
let jumpTo = null;
let noMLAT = false;
let noVanish = false;
let sidebarVisible = true;
let filterTracks = false;
let refreshId = 0;
let globeIndexGrid = 0;
let globeIndexNow = {};
let globeIndexSpecialTiles;
let globeSimLoad = 4;
let globeTableLimit = 80;
let showGrid = false;
let lastRealExtent;
let lastGlobeExtent;
let lastRenderExtent;
let globeIndexExtent;
let PendingFetches = 0;
let lastRequestFiles = 0;
let debugCounter = 0;
let selectedPhotoCache = null;
let pathName = null;
let icaoFilter = null;
let showTrace = false;
let showTraceExit = false;
let showTraceWasIsolation = false;
let traceDate = null;
let traceDateString = null;
let traceDay = null;
let traceOpts = {};
let icaoParam = null;
let globalScale = 1;
let newWidth = lineWidth;
let SitePosInitialized = false;
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
let firstFetchDone = false;
let overrideMapType = null;
let pTracks = false;
let inactive = 0;

let shareLink = '';

let onMobile = false;

let SpecialSquawks = {
    '7500' : { cssClass: 'squawk7500', markerColor: 'rgb(255, 85, 85)', text: 'Aircraft Hijacking' },
    '7600' : { cssClass: 'squawk7600', markerColor: 'rgb(0, 255, 255)', text: 'Radio Failure' },
    '7700' : { cssClass: 'squawk7700', markerColor: 'rgb(255, 255, 0)', text: 'General Emergency' }
};

// Get current map settings
let CenterLat, CenterLon, ZoomLvl, ZoomLvlCache;
let zoomTimeout;
let noMovement;
let checkMoveZoom;
let checkMoveCenter = [0, 0];


let PlaneRowTemplate = null;
let tableinfoFragment = null;

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

let estimateStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '#808080',
        width: 1.2 * lineWidth,
    })
});
let estimateStyleSlim = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '#808080',
        width: 0.4 * lineWidth,
    })
});

const nullStyle = new ol.style.Style({});

let badLine =  new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '#FF0000',
        width: 2 * lineWidth,
    })
});
let badLineMlat =  new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '#FFA500',
        width: 2 * lineWidth,
    })
});

let badDot = new ol.style.Style({
    image: new ol.style.Circle({
        radius: 3.5 * lineWidth,
        fill: new ol.style.Fill({
            color: '#FF0000',
        })
    }),
});
let badDotMlat = new ol.style.Style({
    image: new ol.style.Circle({
        radius: 3.5 * lineWidth,
        fill: new ol.style.Fill({
            color: '#FFA500',
        })
    }),
});


function processAircraft(ac, init, uat) {
    let isArray = Array.isArray(ac);
    let hex = isArray ? ac[0] : ac.hex;
    let plane = null;

    // Do we already have this plane object in Planes?
    // If not make it.

    /*
        if ( ac.messages < 2) {
            return;
        }
        */
    if (icaoFilter && !icaoFilter.includes(hex))
        return;

    plane = Planes[hex];

    if (uatNoTISB && uat && ac.type && ac.type.substring(0,4) == "tisb") {
        // drop non ADS-B planes from UAT (TIS-B)
        return;
    }

    if (!plane) {
        plane = new PlaneObject(hex);

        Planes[hex] = plane;
        PlanesOrdered.push(plane);
        if (uat) {
            plane.receiver = "uat";
        } else {
            plane.receiver = "1090";
        }
    }

    if (showTrace)
        return;

    // Call the function update
    if (globeIndex) {
        if (!onlyMilitary || plane.military)
            plane.updateData(now, last, ac, init);
        else
            plane.last_message_time = now - ac.seen;
    } else if (uat) {
        if (plane.receiver == "uat" || ac.seen_pos < 1.8 || init) {
            let tisb = Array.isArray(ac) ? (ac[7] == "tisb") : (ac.tisb != null && ac.tisb.indexOf("lat") >= 0);
            if (tisb && plane.dataSource == "adsb") {
                // ignore TIS-B data for current ADS-B 1090 planes
            } else {
                plane.receiver = "uat";
                plane.updateData(uat_now, uat_last, ac, init);
            }
        }
    } else {
        if (plane.receiver == "1090"
            || (ac.seen_pos < 1.8 && (plane.seen_pos > 5 || !(ac.mlat && ac.mlat.indexOf("lat") >= 0)))
            || init) {
            plane.receiver = "1090";
            plane.updateData(now, last, ac, init);
        }
    }
}

function processReceiverUpdate(data, init) {
    // update now and last
    let uat = false;
    let time_delta = 0;
    if (data.uat_978 == "true") {
        uat = true;
        uat_last = uat_now;
        uat_now = data.now;
    } else {
        if (data.now > now || globeIndex) {
            last = now;
            now = data.now;
            today = new Date(now * 1000).getDate();
            time_delta = now - last;
        }
    }

    // Loop through all the planes in the data packet
    let acs = data.aircraft;

    if (!uat && !init && !globeIndex) {
        if (data.messages && uuid == null) {
            // Detect stats reset
            if (MessageCountHistory.length > 0 && MessageCountHistory[MessageCountHistory.length-1].messages > data.messages) {
                MessageCountHistory = [{'time' : MessageCountHistory[MessageCountHistory.length-1].time,
                    'messages' : 0}];
            }

            // Note the message count in the history
            MessageCountHistory.push({ 'time' : now, 'messages' : data.messages});

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
            if (time_delta > 0.5) {
                let message_delta = 0;
                for (let j=0; j < acs.length; j++) {
                    let data = acs[j];
                    let plane = Planes[data.hex]
                    if (plane) {
                        message_delta += (data.messages - plane.messages);
                    }
                }
                MessageRate = message_delta / time_delta;
            }
        } else {
            MessageRate = null;
        }
    }

    for (let j=0; j < acs.length; j++) {
        processAircraft(acs[j], init, uat);
    }
}

function fetchData() {
    if (heatmap)
        return;
    ZoomLvl = OLMap.getView().getZoom();
    let center = ol.proj.toLonLat(OLMap.getView().getCenter());
    localStorage['CenterLon'] = CenterLon = center[0];
    localStorage['CenterLat'] = CenterLat = center[1];
    clearTimeout(refreshId);
    refreshId = setTimeout(fetchData, refreshInt());
    //console.log("fetch");
    if (showTrace)
        return;
    if (PendingFetches > 0)
        return;
    for (let i in FetchPending) {
        if (FetchPending[i] != null && FetchPending[i].state() == 'pending') {
            // don't double up on fetches, let the last one resolve
            return;
        }
    }
    FetchPending = [];
    if (FetchPendingUAT != null) {
        // don't double up on fetches, let the last one resolve
        return;
    }

    PendingFetches = 1;

    //console.timeEnd("Starting Fetch");
    //console.time("Starting Fetch");


    updateIconCache();

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
    buttonActive('#F', FollowSelected);

    let ac_url = [];
    if (uuid != null) {
        ac_url[0] = 'uuid/?feed=' + encodeURIComponent(uuid);
        $("#lastLeg_checkbox").parent().hide();
    } else if (globeIndex) {
        let indexes = globeIndexes();
        let count = 0;
        indexes.sort(function(x,y) {
            if (!globeIndexNow[x] && !globeIndexNow[y])
                return 0;
            if (globeIndexNow[x] == null)
                return -1;
            if (globeIndexNow[y] == null)
                return 1;
            return (globeIndexNow[x] - globeIndexNow[y]);
        });
        indexes = indexes.slice(0, globeSimLoad);
        for (let i in indexes) {
            ac_url.push('data/globe_' + indexes[i].toString().padStart(4, '0') + '.json');
        }
    } else {
        ac_url[0] = 'data/aircraft.json';
        $("#lastLeg_checkbox").parent().hide();
    }
    lastRequestFiles = ac_url.length;
    PendingFetches = ac_url.length;

    if (globeIndex) {
        clearTimeout(refreshId);
        refreshId = setTimeout(fetchData, 25000);
    }

    for (let i in ac_url) {
        //console.log(ac_url[i]);
        let req = $.ajax({ url: ac_url[i],
            dataType: 'json' });
        FetchPending.push(req);

        req.done(function(data) {
            if (data == null) {
                return;
            }
            if (globeIndex) {
                globeTrackedAircraft = data.global_ac_count_withpos;
                if ((showGrid || localStorage['globeGrid'] == 'true') && globeIndexNow[data.globeIndex] == null) {
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
                globeIndexNow[data.globeIndex] = data.now;
            }

            if (data.now >= now || globeIndex) {
                //console.time("Process " + data.globeIndex);
                processReceiverUpdate(data);
                //console.timeEnd("Process " + data.globeIndex);
            }
            if (uat_data && uat_data.now > uat_now) {
                processReceiverUpdate(uat_data);
                uat_data = null;
            }


            if (PendingFetches <= 1) {
                //console.time("refreshTable");
                refreshTableInfo();
                //console.timeEnd("refreshTable");
                refreshClock(new Date(now * 1000));
                refreshSelected();
                refreshHighlighted();
            }

            if (globeIndex) {
                clearTimeout(refreshId);
                refreshId = setTimeout(fetchData, refreshInt());
            }
            PendingFetches--;

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

            if (!firstFetchDone) {
                firstFetchDone = true;
                if (uuid) {
                    followRandomPlane();
                    OLMap.getView().setZoom(6);
                }
            }
        });

        req.fail(function(jqxhr, status, error) {
            $("#update_error_detail").text("AJAX call failed (" + status + (error ? (": " + error) : "") + ").");
            console.log("AJAX call failed (" + status + (error ? (": " + error) : "") + ").");
            console.log(jqxhr);
            console.log(status);
            console.log(error);
            $("#update_error").css('display','block');
            StaleReceiverCount++;
            PendingFetches--;
            clearTimeout(refreshId);
            refreshId = setTimeout(fetchData, refreshInt());
        });
    }
}



// this function is called from index.html on body load
// kicks off the whole rabbit hole
function initialize() {

    onMobile = window.mobilecheck();

    today = new Date().getDate();

    let largeModeStorage = localStorage['largeMode'];
    if (largeModeStorage != undefined && parseInt(largeModeStorage, 10)) {
        largeMode = parseInt(largeModeStorage, 10);
    }


    try {
        const search = new URLSearchParams(window.location.search);
        if (search.has('showGrid'))
            showGrid = true;

        if (search.has('outlineWidth')) {
            let tmp = parseInt(search.get('outlineWidth'));
            if (!isNaN(tmp))
                outlineWidth = tmp;
        }

        if (search.has('kiosk')) {
            tempTrails = true;
            hideButtons = true;
            largeMode = 2;
        }

        if (search.has('pTracks')) {
            pTracks = true;
            noVanish = true;
            buttonActive('#P', noVanish);
            filterTracks = true;
            selectAllPlanes();
        }

        if (search.has('largeMode')) {
            let tmp = parseInt(search.get('largeMode'));
            console.log(tmp);
            if (!isNaN(tmp))
                largeMode = tmp;
        }

        if (search.has('mobile'))
            onMobile = true;
        if (search.has('desktop'))
            onMobile = false;

        if (search.has('hideSidebar'))
            localStorage['sidebar_visible'] = "false";
        if (search.has('sidebarWidth')) {
            localStorage['sidebar_width'] = search.get('sidebarWidth');
            localStorage['sidebar_visible'] = "true";
        }

        if (search.has('SiteLat') && search.has('SiteLon')) {
            localStorage['SiteLat'] = search.get('SiteLat');
            localStorage['SiteLon'] = search.get('SiteLon');
        }
        if (localStorage['SiteLat'] != null && localStorage['SiteLon'] != null) {
            if (search.has('SiteClear')
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

        if (search.has('tempTrails')) {
            tempTrails = true;
            let tmp = parseInt(search.get('tempTrails'));
            if (tmp > 0)
                tempTrailsTimeout = tmp;
        }
        if (search.has('mapDim')) {
            let dim = parseFloat(search.get('mapDim'));
            if (!isNaN(dim))
                mapDimPercentage = dim;
        } else if (heatmap) {
            mapDimPercentage = 0.6;
            MapDim = true;
        }


        if (search.has('mapContrast')) {
            let contrast = parseFloat(search.get('mapContrast'));
            if (!isNaN(contrast))
            mapContrastPercentage = contrast;
        }

        if (search.has('hideButtons'))
            hideButtons = true;

        if (search.has('baseMap'))
            overrideMapType = search.get('baseMap');

        icaoFilter = search.get('icaoFilter');
        if (icaoFilter)
            icaoFilter = icaoFilter.toLowerCase().split(',');

        if (search.has('filterMaxRange')) {
            let tmp = parseFloat(search.get('filterMaxRange'));
            if (!isNaN(tmp))
                filterMaxRange = tmp;
        }
        filterMaxRange *= 1852; // convert from nmi to meters
    } catch (error) {
        console.log(error);
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

    if (document.getElementById('adsense') != null || adsbexchange) {
        if (onMobile || hideButtons) {
            try {
                document.getElementById('adsense').style.display='none';
            } catch (error) {
                console.log(error);
            }
        } else {
            setTimeout(function() {
                try {
                    (adsbygoogle = window.adsbygoogle || []).push({});
                } catch (error) {
                    console.log(error);
                }

                let countDown = 20;
                let i = setInterval(function () {

                    let b1 = document.getElementById('waittohide');
                    let b2 = document.getElementById('letuserhide');

                    if (!b1 || !b2)
                        return;

                    if(countDown === 1) {
                        if(b1['style'].display == 'none') {
                            b1['style'].display = 'block';
                            b2['style'].display = 'none';
                        } else {
                            b1['style'].display = 'none';
                            b2['style'].display = 'block';
                        }
                        clearInterval(i);
                    }
                    countDown--;
                    b1.innerHTML = 'Hide in ' + countDown + ' seconds';


                }, 1000);
            }, 1000);
        }
    }

    mapOrientation *= (Math.PI/180); // adjust to radians

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
    if (localStorage['noMLAT'] == "true") {
        // disable remembering this for now
        //noMLAT = true;
        //localStorage['noMLAT'] = "false";
    }

    if (localStorage['noVanish'] == "true") {
        noVanish = true;
        filterTracks = noVanish;
        //localStorage['noVanish'] = "false";
        buttonActive('#P', noVanish);
    }

    $.when(configureReceiver, heatmapDefer).done(function() {
        configureReceiver = null;

        // Initialize stuff
        init_page();

        // Wait for history item downloads and append them to the buffer
        push_history();
        // this will be needed later
        $.getJSON(databaseFolder + "/icao_aircraft_types.js")
            .done(function(typeLookupData) {
                _aircraft_type_cache = typeLookupData;
            });
        if (!onMobile && !hideButtons && !heatmap) {
            $.getJSON(databaseFolder + "/files.js")
                .done(function(data) {
                    for (let i in data) {
                        const icao = data[i].padEnd(6, 0);
                        //console.log(icao);
                        let req = getAircraftData(icao);
                        req.icao = icao;
                        req.fail(function(jqXHR,textStatus,errorThrown) {
                            if (textStatus == 'timeout') {
                                getAircraftData(this.icao);
                                console.log('Database load timeout:' + this.icao);
                            } else {
                                console.log(this.icao + ': Database load error: ' + textStatus + ' at URL: ' + jqXHR.url);
                            }
                        });
                    }
                });
        }
    });

    let coll = document.getElementsByClassName("collapseButton");

    for (let i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function() {
            this.classList.toggle("active");
            let content = this.nextElementSibling;
            if (content.style.display === "block") {
                content.style.display = "none";
            } else {
                content.style.display = "block";
            }
        });
    }

}

function init_page() {
    // Set page basics
    document.title = PageName;

    PlaneRowTemplate = document.getElementById("plane_row_template");

    $('#clock_div').text(new Date().toLocaleString());

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
        $('#sidebar_container').width('auto');
        updateMapSize();
        localStorage['sidebar_width'] = $('#sidebar_container').width();
        $('#sidebar_container').width(localStorage['sidebar_width']);
    });

    if (localStorage['sidebar_width'] != null)
        $('#sidebar_container').width(localStorage['sidebar_width']);
    else
        $('#sidebar_container').width('25%');

    if ($('#sidebar_container').width() > $(window).innerWidth() *0.8)
        $('#sidebar_container').width('30%');

    localStorage['sidebar_width'] = $('#sidebar_container').width();
    /*
        // Set up datablock splitter
    $('#selected_infoblock').resizable({
        handles: {
            s: '#splitter-infoblock'
        },
        containment: "#sidebar_container",
        minHeight: 50
    });
    */

  $('#infoblock_close').on('click', function () {
    if (SelectedPlane) {
      SelectedPlane.selected = null;
      SelectedPlane.clearLines();
      SelectedPlane.updateMarker();
      SelectedPlane = null;
      refreshSelected();
      refreshHighlighted();
      $('#selected_infoblock').hide();
      refreshTableInfo();
    }
  });

    /*
        // this is a little hacky, but the best, most consitent way of doing this. change the margin bottom of the table container to the height of the overlay
    $('#selected_infoblock').on('resize', function() {
        $('#sidebar_canvas').css('margin-bottom', $('#selected_infoblock').height() + 'px');
    });
// look at the window resize to resize the pop-up infoblock so it doesn't float off the bottom or go off the top
    $(window).on('resize', function() {
        let topCalc = ($(window).height() - $('#selected_infoblock').height() - 25);
// check if the top will be less than zero, which will be overlapping/off the screen, and set the top correctly. 
        if (topCalc < 0) {
            topCalc = 0;
            $('#selected_infoblock').css('height', ($(window).height() - 25) +'px');
        }
        $('#selected_infoblock').css('top', topCalc + 'px');
    });
    */

    $('#sidebar_container').on('resize', function() {
        localStorage['sidebar_width'] = $('#sidebar_container').width();
    });

    // Set up event handlers for buttons
    $("#toggle_sidebar_button").click(toggleSidebarVisibility);
    $("#expand_sidebar_button").click(expandSidebar);
    $("#shrink_sidebar_button").click(showMap);

    $("#large_mode_button").click(toggleLargeMode);

    // Set initial element visibility
    setColumnVisibility();

    // Initialize other controls
    initializeUnitsSelector();

    // Set up altitude filter button event handlers and validation options
    $("#altitude_filter_form").submit(onFilterByAltitude);
    $("#callsign_filter_form").submit(updateCallsignFilter);
    $("#type_filter_form").submit(updateTypeFilter);
    $("#description_filter_form").submit(updateDescriptionFilter);
    $("#icao_filter_form").submit(updateIcaoFilter);

    $("#search_form").submit(onSearch);
    $("#jump_form").submit(onJump);

    $("#show_trace").click(toggleShowTrace);
    $("#trace_back_1d").click(function() {shiftTrace(-1)});
    $("#trace_jump_1d").click(function() {shiftTrace(1)});

    $("#leg_prev").click(function() {legShift(-1)});
    $("#leg_next").click(function() {legShift(1)});


    $("#altitude_filter_reset_button").click(onResetAltitudeFilter);
    $("#callsign_filter_reset_button").click(onResetCallsignFilter);
    $("#type_filter_reset_button").click(onResetTypeFilter);
    $("#description_filter_reset_button").click(onResetDescriptionFilter);
    $("#icao_filter_reset_button").click(onResetIcaoFilter);

    // check if the altitude color values are default to enable the altitude filter
    if (ColorByAlt.air.h.length === 3 && ColorByAlt.air.h[0].alt === 2000 && ColorByAlt.air.h[0].val === 20 && ColorByAlt.air.h[1].alt === 10000 && ColorByAlt.air.h[1].val === 140 && ColorByAlt.air.h[2].alt === 40000 && ColorByAlt.air.h[2].val === 300) {
        customAltitudeColors = false;
    }

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
        refreshTableInfo();
    });

    $('#blockedmlat_filter').on('click', function() {
        filterBlockedMLAT(true);
        refreshSelected();
        refreshHighlighted();
        refreshTableInfo();
    });

    $('#grouptype_checkbox').on('click', function() {
        if ($('#grouptype_checkbox').hasClass('settingsCheckboxChecked')) {
            sortByDistance();
        } else {
            sortByDataSource();
        }

    });

    /*
    $('#altitude_checkbox').on('click', function() {
        toggleAltitudeChart(true);
    });
    */

    $('#lastLeg_checkbox').on('click', function() {
        toggleLastLeg();
    });

    if (onMobile) {
        $('#large_mode_button').css('width', 'calc( 45px * let(--SCALE))');
        $('#large_mode_button').css('height', 'calc( 45px * let(--SCALE))');
        if (localStorage['largeMode'] == undefined && largeMode == 1)
            largeMode = 2;
        globeTableLimit = 40;
    }

    largeMode--;
    toggleLargeMode();

    if (localStorage['lastLeg'] === "true")
        lastLeg = true;
    else if (localStorage['lastLeg'] === "false")
        lastLeg = false;

    if (lastLeg)
        $('#lastLeg_checkbox').addClass('settingsCheckboxChecked');
    else
        $('#lastLeg_checkbox').removeClass('settingsCheckboxChecked');

    $('#debugAll_checkbox').on('click', function() {
        toggleDebugAll();
    });

    if (localStorage['debugAll'] === "true") {
        debugAll = true;
        $('#debugAll_checkbox').addClass('settingsCheckboxChecked');
    } else {
        debugAll = false;
        $('#debugAll_checkbox').removeClass('settingsCheckboxChecked');
    }

    $('#debug_checkbox').on('click', function() {
        toggleDebugTracks();
    });

    if (localStorage['debugTracks'] === "true") {
        debugTracks = true;
        $('#debug_checkbox').addClass('settingsCheckboxChecked');
    } else {
        debugTracks = false;
        $('#debug_checkbox').removeClass('settingsCheckboxChecked');
    }
    $('#tStop').on('click', function() { traceOpts.replaySpeed = 0; });
    $('#t1x').on('click', function() { traceOpts.replaySpeed = 1; legShift(); });
    $('#t5x').on('click', function() { traceOpts.replaySpeed = 5; legShift(); });
    $('#t10x').on('click', function() { traceOpts.replaySpeed = 10; legShift(); });
    $('#t20x').on('click', function() { traceOpts.replaySpeed = 20; legShift(); });
    $('#t40x').on('click', function() { traceOpts.replaySpeed = 40; legShift(); });

    new Toggle("ColoredPlanes", true, function(state) {
        if (state)
            monochromeMarkers = null;
        else
            monochromeMarkers = "#EEEEEE";

        refreshFeatures();
    });
    new Toggle("ColoredTrails", true, function(state) {
        if (state)
            monochromeTracks = null;
        else
            monochromeTracks = "#000000";

        remakeTrails();
    });

    $('#selectall_checkbox').on('click', function() {
        if ($('#selectall_checkbox').hasClass('settingsCheckboxChecked')) {
            deselectAllPlanes();
        } else {
            selectAllPlanes();
        }
    })
    $('#mapdim_checkbox').on('click', function() {
        toggleMapDim();
    });

    // Force map to redraw if sidebar container is resized - use a timer to debounce
    $("#sidebar_container").on("resize", function() {
        clearTimeout(mapResizeTimeout);
        mapResizeTimeout = setTimeout(updateMapSize, 20);
    });

    filterGroundVehicles(false);
    filterBlockedMLAT(false);
    //toggleAltitudeChart(false);
    //
}



function push_history() {
    $("#loader_progress").attr('max',nHistoryItems*2);
    for (let i = 0; i < nHistoryItems; i++) {
        push_history_item(i);
    }
    if (globeIndex) {
        parse_history();
    } else if (!nHistoryItems) {
        parse_history();
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
                parse_history();
            }
        })

        .fail(function(jqxhr, status, error) {

            //Doesn't matter if it failed, we'll just be missing a data point
            $("#loader_progress").attr('value',HistoryItemsReturned);
            //console.log(error);
            HistoryItemsReturned++;
            if (HistoryItemsReturned == nHistoryItems) {
                parse_history();
            }
        });
}



function parse_history() {

    if (adsbexchange) {
        $('#adsbexchange_header').show();
        if (window.self != window.top) {
            window.top.location.href = "https://www.adsbexchange.com/"
            return;
        }
    }
    if (nHistoryItems) {
        console.timeEnd("Downloaded History");
        console.time("Loaded aircraft tracks from History");
    }

    for (let i in deferHistory)
        deferHistory[i] = null;

    initialize_map();

    if (PositionHistoryBuffer.length > 0) {

        // Sort history by timestamp
        console.log("Sorting history: " + PositionHistoryBuffer.length);
        PositionHistoryBuffer.sort(function(x,y) { return (y.now - x.now); });

        // Process history
        let data;
        let h = 0;
        let pruneInt = Math.floor(PositionHistoryBuffer.length/5);
        while (data = PositionHistoryBuffer.pop()) {

            // process new data
            if (PositionHistoryBuffer.length < 10) {
                processReceiverUpdate(data, false);
                if (now-new Date().getTime()/1000 > 600)
                    historyOutdated = true;
            } else {
                processReceiverUpdate(data, true);
            }

            // update aircraft tracks
            if (data.uat_978 != "true") {
                for (let i = 0; i < PlanesOrdered.length; ++i) {
                    let plane = PlanesOrdered[i];
                    if (plane.dataSource == "uat")
                        plane.updateTrack(uat_now, uat_last);
                    else
                        plane.updateTrack(now, last);
                }
            }


            if (h==1) {
                console.log("Applied history " + h + " from: "
                    + (new Date(now * 1000)).toLocaleTimeString());
            }
            // prune aircraft list
            if(h++ % pruneInt == pruneInt - 1) {

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

            if (uatNoTISB && plane.receiver == "uat" && plane.type && plane.type.substring(0,4) == "tisb") {
                plane.last_message_time -= 999;
            }
        }

        refreshFeatures();
        refreshTableInfo();
    }

    PositionHistoryBuffer = null;

    if (nHistoryItems)
        console.timeEnd("Loaded aircraft tracks from History");

    console.log("Completing init");

    refreshSelected();
    refreshHighlighted();

    // Setup our timer to poll from the server.
    window.setInterval(reaper, 20000);
    if (tempTrails) {
        window.setInterval(trailReaper, 10000);
        trailReaper(now);
    }
    if (enable_pf_data) {
        window.setInterval(fetchPfData, RefreshInterval*10.314);
    }
    //window.setInterval(refreshTableInfo, 1000);
    //window.setInterval(function() {PendingFetches--;}, 10000);

    pathName = window.location.pathname;
    processURLParams();

    if (!icaoFilter && globeIndex)
        toggleTableInView(true);

    changeZoom("init");
    changeCenter("init");

    if (heatmap)
        setInterval(checkMovement, 250);
    else if (globeIndex)
        setInterval(checkMovement, 80);
    else
        setInterval(checkMovement, 30);

    // And kick off one refresh immediately.
    if (!heatmap)
        fetchData();
    if (replay) {
        initReplay();
        play(); // kick off first play
    }

    if (!globeIndex) {
        $('#show_trace').hide();
    }
    if (globeIndex) {
        $('#V').hide();
        $('#uat_legend_2').hide();
        $('#mode_s_legend_2').hide();
    } else {
        $('#unknown_legend_2').hide();
        $('#sat_legend_2').hide();
    }

    updateMapSize();

    loadFinished = true;

    //drawAlt();

    if (localStorage['sidebar_visible'] == "false")
        toggleSidebarVisibility();

    if (onMobile && localStorage['sidebar_visible'] == undefined)
        toggleSidebarVisibility();

    if (hideButtons) {
        $('#large_mode_control').hide();
        $('#header_top').hide();
        $('#header_side').hide();
        $('#splitter').hide();
        $('#jumpSearch').hide();
        $('#filterButton').hide();
        $('.ol-control').hide();
        $('.ol-attribution').show();
    }

    if (tempTrails)
        selectAllPlanes();

    geoMag = geoMagFactory(cof2Obj());

    if (!heatmap)
        $("#loader").addClass("hidden");

}

// Make a LineString with 'points'-number points
// that is a closed circle on the sphere such that the
// great circle distance from 'center' to each point is
// 'radius' meters
function make_geodesic_circle(center, radius, points) {
    let angularDistance = radius / 6378137.0;
    let lon1 = center[0] * Math.PI / 180.0;
    let lat1 = center[1] * Math.PI / 180.0;
    let geom;
    for (let i = 0; i <= points; ++i) {
        let bearing = i * 2 * Math.PI / points;

        let lat2 = Math.asin( Math.sin(lat1)*Math.cos(angularDistance) +
            Math.cos(lat1)*Math.sin(angularDistance)*Math.cos(bearing) );
        let lon2 = lon1 + Math.atan2(Math.sin(bearing)*Math.sin(angularDistance)*Math.cos(lat1),
            Math.cos(angularDistance)-Math.sin(lat1)*Math.sin(lat2));

        lat2 = lat2 * 180.0 / Math.PI;
        lon2 = lon2 * 180.0 / Math.PI;
        if (!geom)
            geom = new ol.geom.LineString([[lon2, lat2]]);
        else
            geom.appendCoordinate([lon2, lat2]);
    }
    return geom;
}

// Initalizes the map and starts up our timers to call letious functions
function initialize_map() {
    if (receiverJson && receiverJson.lat != null) {
        SiteLat = receiverJson.lat;
        SiteLon = receiverJson.lon;
        DefaultCenterLat = receiverJson.lat;
        DefaultCenterLon = receiverJson.lon;
    }
    if (receiverJson && receiverJson.globeIndexGrid != null) {
        globeIndexGrid = receiverJson.globeIndexGrid;
        globeIndex = 1;
        globeIndexSpecialTiles = receiverJson.globeIndexSpecialTiles;
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

    // Maybe hide flag info
    if (!ShowFlags) {
        PlaneRowTemplate.cells[1].style.display = 'none'; // hide flag column
        document.getElementById("flag").style.display = 'none'; // hide flag header
    }

    // Initialize OL3

    layers_group = createBaseLayers();
    layers = layers_group.getLayers();

    iconLayer = new ol.layer.Vector({
        name: 'ac_positions',
        type: 'overlay',
        title: 'Aircraft positions',
        source: PlaneIconFeatures,
        declutter: false,
        zIndex: 200,
        renderBuffer: 20,
    });

    layers.push(
        new ol.layer.Vector({
            name: 'site_pos',
            type: 'overlay',
            title: 'Site position and range rings',
            source: StaticFeatures,
            visible: !adsbexchange,
            zIndex: 100,
            renderOrder: null,
        }));

    trailLayers = new ol.layer.Group({
        name: 'ac_trail',
        title: 'Aircraft trails',
        type: 'overlay',
        layers: trailGroup,
        zIndex: 150,
    });

    layers.push(trailLayers);

    layers.push(iconLayer);

    let foundType = false;
    let baseCount = 0;

    const dummyLayer = new ol.layer.Vector({
        name: 'dummy',
        renderOrder: null,
    });

    trailGroup.push(dummyLayer);

    ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
        if (!lyr.get('name'))
            return;

        if (lyr.get('type') === 'base') {
            baseCount++;
            if (MapType_tar1090 === lyr.get('name')) {
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
            let visible = localStorage['layer_' + lyr.get('name')];
            if (visible != undefined) {
                // javascript, why must you taunt me with gratuitous type problems
                lyr.setVisible(visible === "true");
            }

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

    OLMap = new ol.Map({
        target: 'map_canvas',
        layers: layers,
        view: new ol.View({
            center: ol.proj.fromLonLat([CenterLon, CenterLat]),
            zoom: ZoomLvl,
            minZoom: 2,
        }),
        controls: [new ol.control.Zoom({delta: 1, duration: 0, target: 'map_container',}),
            new ol.control.Attribution({collapsed: true}),
            new ol.control.ScaleLine({units: DisplayUnits})
        ],
        interactions: new ol.interaction.defaults({altShiftDragRotate:false, pinchRotate:false,}),
    });
    OLProj = OLMap.getView().getProjection();

    OLMap.getView().setRotation(mapOrientation); // adjust orientation

    if (baseCount > 1) {
        OLMap.addControl(new ol.control.LayerSwitcher({
            groupSelectStyle: 'none',
            target: 'map_container',
        }));
    }

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
        let res = evt.map.forEachFeatureAtPixel(
            evt.pixel,
            function(feature, layer) {
                if (showTrace)
                    return feature.timestamp;
                return feature.hex;
            },
            {
                layerFilter: function(layer) {
                    return (layer == iconLayer || layer.get('isTrail') == true);
                },
                hitTolerance: 6 * globalScale,
            }
        );
        if (showTrace && res) {
            gotoTime(res);
        } else if (res) {
            selectPlaneByHex(res, {follow: (evt.type === 'dblclick')});
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
        toggleLayer('#acpositions_checkbox', 'ac_positions');
    });

    if (localStorage['MapDim'] === "true" || (MapDim && localStorage['MapDim'] == null)) {
        toggleMapDim(true);
    }

    window.addEventListener('keydown', function(e) {
        lastActive = new Date().getTime();
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
                toggleMapDim();
                break;
            case "m":
                toggleMultiSelect();
                break;
            case "v":
                toggleTableInView();
                break;
            case "r":
                if (heatmap && !replay)
                    drawHeatmap();
                else
                    followRandomPlane();
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
                    $('#jumpSearch').hide();
                    $('#filterButton').hide();
                    $('.ol-control').hide();
                    $('.ol-attribution').show();
                } else {
                    $('#large_mode_control').show();
                    $('#header_top').show();
                    $('#header_side').show();
                    $('#splitter').show();
                    $('#jumpSearch').show();
                    $('#filterButton').show();
                    $('.ol-control').show();
                    $('#expand_sidebar_control').hide();
                    toggleSidebarVisibility();
                    toggleSidebarVisibility();
                }
                hideButtons = !hideButtons;
                break;
            case "f":
                toggleFollow();
                break;
                // filters
            case "M":
                onlyMLAT = !onlyMLAT;
                refreshTableInfo();
                break;
            case "T":
                filterTISB = !filterTISB;
                break;
            case "u":
                toggleMilitary();
                break;
            case "A":
                onlyADSB = !onlyADSB;
                break;
                // persistance mode
            case "i":
                toggleIsolation();
                break;
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
                toggleLastLeg();
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

// This looks for planes to reap out of the master Planes letiable
function reaper(all) {
    //console.log("Reaping started..");
    if (noVanish)
        return;
    reaping = true;

    // Look for planes where we have seen no messages for >300 seconds
    let plane;
    let length = PlanesOrdered.length;
    for (let i = 0; i < length; i++) {
        plane = PlanesOrdered.shift()
        if (plane == null)
            continue;
        plane.seen = now - plane.last_message_time;
        if ( (!plane.selected || SelectedAllPlanes)
            && (all || plane.seen > 300)
            && (plane.dataSource != 'adsc' || plane.seen > 35*60)
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
        setSelectedInfoBlockVisibility();
        return;
    }
    const selected = SelectedPlane;

    if (SelectedPlane.position && SelectedPlane.seen_pos > 25)
        SelectedPlane.updateMarker(true);
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

    if (selected.isNonIcao()) {
        $('#tisb_info').removeClass('hidden');
        $('#reg_info').addClass('hidden');
    } else {
        $('#tisb_info').addClass('hidden');
        $('#reg_info').removeClass('hidden');
    }
    if (selected.registration != selReg) {
        selReg = selected.registration
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

    if (selected.icaoType) {
        $('#selected_icaotype').text(selected.icaoType);
    } else {
        $('#selected_icaotype').text("n/a");
    }
    if (selected.typeDescription)
        $('#selected_typedesc').text(selected.typeDescription);
    else
        $('#selected_typedesc').text("n/a");

    if (selected.typeLong)
        $('#selected_typelong').text(selected.typeLong);
    else
        $('#selected_typelong').text("n/a");

    if (showPictures && selected.icaoType){
        let new_html = "<img width='150px' src='aircraft_sil/" + selected.icaoType + ".png' />";
        if (new_html != selectedPhotoCache) {
            $('#selected_photo').html(new_html);
            selectedPhotoCache = new_html;
        }
    } else {
        $('#selected_photo').text("");
    }

    // Not using this logic for the redesigned info panel at the time, but leaving it in  if/when adding it back
    // let emerg = document.getElementById('selected_emergency');
    // if (selected.squawk in SpecialSquawks) {
    //         emerg.className = SpecialSquawks[selected.squawk].cssClass;
    //         emerg.textContent = NBSP + 'Squawking: ' + SpecialSquawks[selected.squawk].text + NBSP ;
    // } else {
    //         emerg.className = 'hidden';
    // }

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

    let crab = null;
    let heading = null;
    let track = selected.track;
    if (selected.true_heading != null && selected.track != null) {
        heading = selected.true_heading;
    } else if (magResult && selected.mag_heading != null && selected.track != null) {
        heading = selected.mag_heading + magResult.dec;
    }
    if (heading != null && heading < 0)
        heading += 360;
    if (heading != null && heading > 360)
        heading -= 360;
    if (heading != null && track != null) {
        crab = heading - track;
        if (crab > 180)
            crab -= 360;
        if (crab < -180)
            crab += 360;
    }

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

    /*
    if (globeIndex && selected.true_heading == null)
        crab = null;

    $('#selected_crab').text(format_track_brief(crab));
    */


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
        if (globeIndex) {
            let icao_link = "<a style=\"color: blue\" target=\"_blank\" href=\"" + shareLink + "\">Share</a>";
            icao_link = NBSP +NBSP +NBSP +NBSP +NBSP +NBSP + icao_link;
            $('#selected_icao').html(selected.icao.toUpperCase() + icao_link);
        } else {
            $('#selected_icao').text(selected.icao.toUpperCase());
        }
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
        //$('#selected_follow').addClass('hidden');
    } else {

        if (selected.seen_pos > -1) {
            $('#selected_position').text(format_latlng(selected.position));
        } else {
            $('#selected_position').text(format_latlng(selected.position));
        }

        checkFollow();
    }
    if (selected.position && SitePosition) {
        selected.sitedist = ol.sphere.getDistance(SitePosition, selected.position);
    }
    $('#selected_source').text(format_data_source(selected.getDataSource()));
    $('#selected_category').text(selected.category ? selected.category : "n/a");
    $('#selected_sitedist1').text(format_distance_long(selected.sitedist, DisplayUnits));
    $('#selected_sitedist2').text(format_distance_long(selected.sitedist, DisplayUnits));
    $('#selected_rssi1').text(selected.rssi != null ? selected.rssi.toFixed(1) : "n/a");
    $('#selected_message_count').text(selected.messages);
    $('#selected_message_rate').text((selected.messageRate != null) ? (selected.messageRate.toFixed(1)) : "n/a");
    if (flightawareLinks) {
        $('#selected_photo_link').html(getFlightAwarePhotoLink(selected.registration));
    }

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

    setSelectedInfoBlockVisibility();
}

function refreshHighlighted() {
    // this is following nearly identical logic, etc, as the refreshSelected function, but doing less junk for the highlighted pane
    let highlighted = false;

    if (!HighlightedPlane || !(highlighted = Planes[HighlightedPlane]) ) {
        $('#highlighted_infoblock').hide();
        return;
    }

    $('#highlighted_infoblock').show();

    let infoBox = $('#highlighted_infoblock');


    let marker = highlighted.marker;
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

function refreshClock(now_date) {
    let hhmm = now_date.getHours().toString().padStart(2,'0') + ":" + now_date.getMinutes().toString().padStart(2,'0');
    let hms = hhmm + ":" + now_date.getSeconds().toString().padStart(2,'0');
    $('#clock_div').text(hms + "   " + now_date.toDateString());
}

function removeHighlight() {
    HighlightedPlane = null;
    refreshHighlighted();
}

function refreshFeatures() {
    for (let i in PlanesOrdered) {
        PlanesOrdered[i].updateTick(true);
    }
}

// Refreshes the larger table of all the planes
function refreshTableInfo() {
    if (pTracks)
        return;
    refreshPageTitle();

    resortTable(PlanesOrdered);

    //$('#dump1090_infoblock').css('display','block');
    $('#dump1090_total_history').text(TrackedHistorySize);

    if (MessageRate !== null) {
        $('#dump1090_message_rate').text(MessageRate.toFixed(1));
    } else {
        $('#dump1090_message_rate').text("n/a");
    }

    let show_squawk_warning = false;

    TrackedAircraft = 0;
    TrackedAircraftPositions = 0;
    TrackedHistorySize = 0;
    let nplanes = 0;
    let nMapPlanes = 0;

    if (mapIsVisible || lastRealExtent == null) {
        let mapSize = OLMap.getSize();

        lastRealExtent = myExtent(OLMap.getView().calculateExtent(mapSize));

        let size = [mapSize[0] * 1.2, mapSize[1] * 1.2];
        lastRenderExtent = myExtent(OLMap.getView().calculateExtent(size));
    }

    //console.time("updateCells");
    for (let i = 0; i < PlanesOrdered.length; ++i) {
        let plane = PlanesOrdered[i];
        TrackedHistorySize += plane.history_size;
        let classes;


        plane.inView = !plane.isFiltered() && inView(plane.position, lastRealExtent);

        if (globeIndex && !icaoFilter) {
            if (((nMapPlanes < 100 || !onMobile)
                && (!onMobile || ZoomLvl > 10 || !plane.onGround)
                && !plane.isFiltered()
                && inView(plane.position, lastRenderExtent)
                ) || (plane.selected && !SelectedAllPlanes)) {
                plane.updateFeatures(now, last);
            } else if (plane.visible) {
                plane.clearMarker();
                plane.clearLines();
                plane.visible = false;
            }
        } else {
            plane.updateTick();
        }


        plane.showInTable = false;
        classes = "plane_table_row";

        if (tableInView && plane.visible &&
            (plane.inView || (plane.selected && !SelectedAllPlanes))
        ) {
            plane.showInTable = true;
            ++TrackedAircraftPositions;
            nMapPlanes++;
        }

        if (!plane.isFiltered() && (plane.seen < 58 || noVanish)) {
            TrackedAircraft++;

            if (!tableInView && plane.position != null)
                ++TrackedAircraftPositions;

            if (!tableInView)
                plane.showInTable = true;
        }

        if (!sidebarVisible || (nplanes > globeTableLimit && mapIsVisible && globeIndex)) {
            plane.showInTable = false;
            continue;
        }


        if (plane.showInTable) {
            nplanes++;

            if (plane.tr == null)
                plane.makeTR();

            if (plane.dataSource == "uat" || (plane.addrtype && plane.addrtype.substring(0,4) == 'adsr')) {
                classes += " uat";
            } else if (plane.dataSource == "adsb") {
                classes += " vPosition";
            } else if (plane.dataSource == "adsc") {
                classes += " satellite";
            } else if (plane.dataSource == "mode_s") {
                classes += " other";
            } else {
                classes += " ";
                classes += plane.dataSource;
            }

            if (plane.selected && !SelectedAllPlanes)
                classes += " selected";

            if (plane.squawk in SpecialSquawks) {
                classes = classes + " " + SpecialSquawks[plane.squawk].cssClass;
                show_squawk_warning = true;
            }			                

            // ICAO doesn't change
            if (flightawareLinks) {
                updateCell(plane, 2, getFlightAwareModeSLink(plane.icao, plane.flight, plane.name), true);
                updateCell(plane, 3, getFlightAwareIdentLink(plane.registration, plane.registration), true);
            } else {
                updateCell(plane, 2, plane.name);
                updateCell(plane, 3, plane.registration ? plane.registration : "");
            }
            updateCell(plane, 4, (plane.icaoType != null ? plane.icaoType : ""));
            updateCell(plane, 5, (plane.squawk != null ? plane.squawk : ""));
            updateCell(plane, 6, format_altitude_brief(plane.altitude, plane.vert_rate, DisplayUnits));
            updateCell(plane, 7, format_speed_brief(plane.gs, DisplayUnits));
            updateCell(plane, 8, format_vert_rate_brief(plane.vert_rate, DisplayUnits));
            updateCell(plane, 9, format_distance_brief(plane.sitedist, DisplayUnits));
            updateCell(plane, 10, format_track_brief(plane.track));
            updateCell(plane, 11, plane.messages);
            updateCell(plane, 12, plane.seen.toFixed(0));
            updateCell(plane, 13, (plane.rssi != null ? plane.rssi.toFixed(1) : ""));
            updateCell(plane, 14, (plane.position != null ? plane.position[1].toFixed(4) : ""));
            updateCell(plane, 15, (plane.position != null ? plane.position[0].toFixed(4) : ""));
            updateCell(plane, 16, format_data_source(plane.getDataSource()));
            //updateCell(plane, 17, plane.baseMarkerKey);


        }
        if (plane.tr && plane.classesCache != classes) {
            plane.classesCache = classes;
            plane.tr.className = classes;
        }
    }
    //console.timeEnd("updateCells");

    /*
    if (show_squawk_warning_cache != show_squawk_warning && show_squawk_warning ) {
        $("#SpecialSquawkWarning").css('display','block');
        show_squawk_warning_cache = show_squawk_warning;
    }
    if (show_squawk_warning_cache != show_squawk_warning && !show_squawk_warning ) {
        $("#SpecialSquawkWarning").css('display','none');
        show_squawk_warning_cache = show_squawk_warning;
    }
    */

    if (!globeIndex)
        $('#dump1090_total_ac').text(TrackedAircraft);
    else
        $('#dump1090_total_ac').text(globeTrackedAircraft);
    $('#dump1090_total_ac_positions').text(TrackedAircraftPositions);


    //console.time("DOM");
    //tableinfoFragment = document.createDocumentFragment();
    let tbody = document.getElementById('tableinfo').tBodies[0];
    for (let i = 0; i < PlanesOrdered.length; ++i) {
        const plane = PlanesOrdered[i];
        if (plane.inTable) {
            tbody.removeChild(plane.tr);
            plane.inTable = false;
        }
        if (plane.showInTable) {
            tbody.appendChild(plane.tr);
            plane.inTable = true;
        }
    }
    //tbody.appendChild(tableinfoFragment);
    //console.timeEnd("DOM");
    //console.log(tableinfo);
}

//
// ---- table sorting ----
//

function compareAlpha(xa,ya) {
    if (xa === ya)
        return 0;
    if (xa < ya)
        return -1;
    return 1;
}
function compareBeta(xa,ya) {
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

function sortByICAO()     { sortBy('icao',    compareAlpha,   function(x) { return x.icao; }); }
function sortByFlight()   { sortBy('flight',  compareBeta,   function(x) { return x.flight ? x.flight : x.registration; }); }
function sortByRegistration()   { sortBy('registration',    compareAlpha,   function(x) { return x.registration; }); }
function sortByAircraftType()   { sortBy('icaoType',        compareAlpha,   function(x) { return x.icaoType; }); }
function sortBySquawk()   { sortBy('squawk',  compareAlpha,   function(x) { return x.squawk; }); }
function sortByAltitude() { sortBy('altitude',compareNumeric, function(x) { return (x.altitude == "ground" ? -1e9 : x.altitude); }); }
function sortBySpeed()    { sortBy('speed',   compareNumeric, function(x) { return x.gs; }); }
function sortByVerticalRate()   { sortBy('vert_rate',      compareNumeric, function(x) { return x.vert_rate; }); }
function sortByDistance() { sortBy('sitedist',compareNumeric, function(x) { return x.sitedist; }); }
function sortByTrack()    { sortBy('track',   compareNumeric, function(x) { return x.track; }); }
function sortByMsgs()     { sortBy('msgs',    compareNumeric, function(x) { return x.messages; }); }
function sortBySeen()     { sortBy('seen',    compareNumeric, function(x) { return x.seen; }); }
function sortByCountry()  { sortBy('country', compareAlpha,   function(x) { return x.icaorange.country; }); }
function sortByRssi()     { sortBy('rssi',    compareNumeric, function(x) { return x.rssi; }); }
function sortByLatitude()   { sortBy('lat',   compareNumeric, function(x) { return (x.position !== null ? x.position[1] : null); }); }
function sortByLongitude()  { sortBy('lon',   compareNumeric, function(x) { return (x.position !== null ? x.position[0] : null); }); }
function sortByDataSource() { sortBy('data_source',     compareNumeric, function(x) { return x.getDataSourceNumber() } ); }
function sortByBaseMarkerKey()  { sortBy('base_marker_key', compareAlpha,   function(x) { return x.baseMarkerKey; }); }

let sortId = '';
let sortCompare = null;
let sortExtract = null;
let sortAscending = true;

function sortFunction(x,y) {
    let xv = x._sort_value;
    let yv = y._sort_value;

    // always sort missing values at the end, regardless of
    // ascending/descending sort
    if (xv == null && yv == null) return x._sort_pos - y._sort_pos;
    if (xv == null) return 1;
    if (yv == null) return -1;

    let c = sortAscending ? sortCompare(xv,yv) : sortCompare(yv,xv);
    if (c !== 0) return c;

    return x._sort_pos - y._sort_pos;
}

function resortTable(pList) {
    if (!sortExtract)
        return;
    // presort by dataSource
    if (sortId == "sitedist") {
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
            const xlon = x.position ? x.position[0] : 500;
            const ylon = y.position ? y.position[0] : 500;
            return (xlon - ylon);
        });
    }
    // number the existing rows so we can do a stable sort
    // regardless of whether sort() is stable or not.
    // Also extract the sort comparison value.
    for (let i = 0; i < pList.length; ++i) {
        pList[i]._sort_pos = i;
        pList[i]._sort_value = sortExtract(pList[i]);
    }

    pList.sort(sortFunction);
    // Put selected planes on top, do a stable sort!
    // actually that's a bad idea, disable this for now
    if (!SelectedAllPlanes && multiSelect) {
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

function sortBy(id,sc,se) {
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

    refreshTableInfo();
    //resortTable(PlanesTableList);
}

function selectPlaneByHex(hex, options) {
    //console.trace();
    lastActive = new Date().getTime();
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

    if (newPlane && (showTrace || showTraceExit))
        SelectedPlane = oldPlane = null;

    // multiSelect deselect
    if (multiSelect && newPlane && newPlane.selected && !options.follow && !onlySelected) {
        newPlane.selected = false;
        newPlane.clearLines();
        newPlane.updateMarker();
        $(newPlane.tr).removeClass("selected");
        if (SelectedPlane == newPlane)
            SelectedPlane = null;
        newPlane = null;
        hex = null;
    }
    // If we are clicking the same plane, we are deselecting it.
    // (unless it was a doubleclick..)
    if (oldPlane == newPlane) {
        if (options.follow || options.noDeselect) {
            oldPlane = null;
        } else {
            newPlane = null;
            hex = null;
        }
    }
    if (!multiSelect && oldPlane) {
        oldPlane.selected = false;
        oldPlane.clearLines();
        oldPlane.updateMarker();
        $(oldPlane.tr).removeClass("selected");
        SelectedPlane = null;
        // scroll the infoblock back to the top for the next plane to be selected
        //$('.infoblock-container').scrollTop(0);
    }

    if (!options.noFetch && globeIndex && hex)
        newPlane = getTrace(newPlane, hex, options);

    if (newPlane) {
        // Assign the new selected
        SelectedPlane = newPlane;
        newPlane.selected = true;
        newPlane.updateTick(true);
        $(newPlane.tr).addClass("selected");
        newPlane.logSel(newPlane.history_size);
        //console.log(newPlane.baseMarkerKey);
    }

    if (newPlane && options.follow) {
        toggleFollow(true);
        if (!options.zoom)
            options.zoom = 'follow';
    } else {
        toggleFollow(false);
    }
    if (newPlane && newPlane.position) {
        newPlane.updateLines();
        newPlane.updateMarker(true);
    }

    if (options.zoom == 'follow') {
        //if (OLMap.getView().getZoom() < 8)
        //    OLMap.getView().setZoom(8);
    } else if (options.zoom) {
        OLMap.getView().setZoom(options.zoom);
    }

    updateAddressBar();
    refreshSelected();
    refreshTableInfo();
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
    if (SelectedPlane != null) {
        SelectedPlane.selected = false;
        SelectedPlane.clearLines();
        SelectedPlane.updateMarker();
        $(SelectedPlane.tr).removeClass("selected");
    }

    SelectedPlane = null;
    SelectedAllPlanes = true;

    refreshFeatures();

    $('#selectall_checkbox').addClass('settingsCheckboxChecked');

    refreshSelected();
    refreshHighlighted();
    refreshTableInfo();
}


// deselect all the planes
function deselectAllPlanes(keepMain) {
    if (showTrace)
        return;
    if (!multiSelect && SelectedPlane)
        toggleIsolation(false, "off");
    buttonActive('#T', false);
    for(let key in Planes) {
        if (keepMain && Planes[key] == SelectedPlane)
            continue;
        Planes[key].selected = false;
        $(Planes[key].tr).removeClass("selected");
    }
    $('#selectall_checkbox').removeClass('settingsCheckboxChecked');
    SelectedAllPlanes = false;
    if (!keepMain)
        SelectedPlane = null;
    refreshFeatures();
    refreshHighlighted();
    refreshTableInfo();

    updateAddressBar();
    refreshSelected();
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
        OLMap.getView().setCenter(ol.proj.fromLonLat(SelectedPlane.position));
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
    OLMap.updateSize();
}

function toggleSidebarVisibility(e) {
    if (e)
        e.preventDefault();
    $("#sidebar_container").toggle();
    $("#expand_sidebar_control").toggle();
    $("#toggle_sidebar_button").toggleClass("show_sidebar");
    $("#toggle_sidebar_button").toggleClass("hide_sidebar");
    localStorage['sidebar_visible'] = sidebarVisible = $("#sidebar_container").is(":visible");
    updateMapSize();
}

function expandSidebar(e) {
    e.preventDefault();
    $("#map_container").hide()
    mapIsVisible = false;
    $("#toggle_sidebar_control").hide();
    $("#splitter").hide();
    $("#shrink_sidebar_button").show();
    $("#sidebar_container").width("100%");
    setColumnVisibility();
    clearTimeout(refreshId);
    fetchData();
    refreshTableInfo();
    updateMapSize();
    setSelectedInfoBlockVisibility();
}

function showMap() {
    $('#sidebar_container').width(localStorage['sidebar_width']).css('margin-left', '0');
    $("#map_container").show()
    mapIsVisible = true;
    $("#toggle_sidebar_control").show();
    $("#splitter").show();
    $("#shrink_sidebar_button").hide();
    setColumnVisibility();
    clearTimeout(refreshId);
    fetchData();
    refreshTableInfo();
    updateMapSize();
}

function showColumn(table, columnId, visible) {
    let index = $(columnId).index();
    columnVis[index] = visible;
    if (index >= 0) {
        let cells = $(table).find("td:nth-child(" + (index + 1).toString() + ")");
        if (visible) {
            cells.show();
        } else {
            cells.hide();
        }
    }
}

function setColumnVisibility() {
    let infoTable = $("#tableinfo");

    let tbody = document.getElementById('tableinfo').tBodies[0];
    for (let i = 0; i < PlanesOrdered.length; ++i) {
        let plane = PlanesOrdered[i];
        if (plane.tr) {
            if (plane.inTable) {
                tbody.removeChild(plane.tr);
            }
            tbody.appendChild(plane.tr);
            plane.inTable = true;
        }
    }

    for (let col in HideCols) {
        showColumn(infoTable, HideCols[col], !mapIsVisible);
    }
}

function setSelectedInfoBlockVisibility() {

    if (SelectedPlane) {
        $('#selected_infoblock').show();
        if (!mapIsVisible)
            $("#sidebar_container").css('margin-left', '140pt');
        //$('#sidebar_canvas').css('margin-bottom', $('#selected_infoblock').height() + 'px');
        //
        $('#large_mode_control').css('left', (190 * globalScale) + 'px');
        $('.ol-scale-line').css('left', (180 * globalScale + 8) + 'px');
    }
    else {
        $('#selected_infoblock').hide();
        if (!mapIsVisible)
            $("#sidebar_container").css('margin-left', '0');
        //$('#sidebar_canvas').css('margin-bottom', 0);

        $('#large_mode_control').css('left', (5 * globalScale) + 'px');
        $('.ol-scale-line').css('left', '8px');
    }
}

function initializeUnitsSelector() {
    // Get display unit preferences from local storage
    if (!localStorage.getItem('displayUnits')) {
        localStorage['displayUnits'] = "nautical";
    }
    let displayUnits = localStorage['displayUnits'];
    DisplayUnits = displayUnits;

    setAltitudeLegend(displayUnits);

    // Initialize drop-down
    let unitsSelector = $("#units_selector");
    unitsSelector.val(displayUnits);
    unitsSelector.on("change", onDisplayUnitsChanged);

    $(".altitudeUnit").text(get_unit_label("altitude", DisplayUnits));
    $(".speedUnit").text(get_unit_label("speed", DisplayUnits));
    $(".distanceUnit").text(get_unit_label("distance", DisplayUnits));
    $(".verticalRateUnit").text(get_unit_label("verticalRate", DisplayUnits));
}

function onDisplayUnitsChanged(e) {
    let displayUnits = e.target.value;
    // Save display units to local storage
    localStorage['displayUnits'] = displayUnits;
    DisplayUnits = displayUnits;

    setAltitudeLegend(displayUnits);

    // Update filters
    updatePlaneFilter();

    // Refresh data
    refreshSelected();
    refreshHighlighted();
    refreshTableInfo();

    // Redraw range rings
    if (SitePosition != null && SiteCircles) {
        createSiteCircleFeatures();
    }

    // Reset map scale line units
    OLMap.getControls().forEach(function(control) {
        if (control instanceof ol.control.ScaleLine) {
            control.setUnits(displayUnits);
        }
    });

    $(".altitudeUnit").text(get_unit_label("altitude", DisplayUnits));
    $(".speedUnit").text(get_unit_label("speed", DisplayUnits));
    $(".distanceUnit").text(get_unit_label("distance", DisplayUnits));
    $(".verticalRateUnit").text(get_unit_label("verticalRate", DisplayUnits));
}

function setAltitudeLegend(units) {
    if (units === 'metric') {
        $('#altitude_chart_button').addClass('altitudeMeters');
    } else {
        $('#altitude_chart_button').removeClass('altitudeMeters');
    }
}

function onFilterByAltitude(e) {
    e.preventDefault();
    $("#altitude_filter_min").blur();
    $("#altitude_filter_max").blur();

    updatePlaneFilter();

    if (SelectedPlane && SelectedPlane.isFiltered()) {
        SelectedPlane.selected = false;
        SelectedPlane.clearLines();
        SelectedPlane = null;
    }
    refreshSelected();
    refreshHighlighted();
    refreshTableInfo();

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
    if (showTrace && !on && !off)
        return;
    onlySelected = !onlySelected;
    if (on)
        onlySelected = true;
    if (off)
        onlySelected = false;

    buttonActive('#I', onlySelected);

    refreshFeatures();
    refreshTableInfo();
}

function toggleMilitary() {
    onlyMilitary = !onlyMilitary;
    buttonActive('#U', onlyMilitary);
    refreshTableInfo();
}

function togglePersistence() {
    noVanish = !noVanish;
    filterTracks = noVanish;

    buttonActive('#P', noVanish);

    remakeTrails();

    if (!noVanish)
        reaper();
    localStorage['noVanish'] = noVanish;
    console.log('noVanish = ' + noVanish);
    refreshTableInfo();
}

function toggleLastLeg() {
    if (!globeIndex)
        return;
    if (lastLeg) {
        lastLeg = false;
        localStorage['lastLeg'] = "false";
        $('#lastLeg_checkbox').removeClass('settingsCheckboxChecked');
    } else {
        lastLeg = true;
        localStorage['lastLeg'] = "true";
        $('#lastLeg_checkbox').addClass('settingsCheckboxChecked');
    }
    if (SelectedPlane && !showTrace)
        SelectedPlane.processTrace();
}

function toggleDebugAll() {
    if (localStorage['debugAll'] === "true") {
        debugAll = false;
        localStorage['debugAll'] = "false";
        $('#debugAll_checkbox').removeClass('settingsCheckboxChecked');
    } else {
        debugAll = true;
        localStorage['debugAll'] = "true";
        $('#debugAll_checkbox').addClass('settingsCheckboxChecked');
    }
}

function toggleDebugTracks() {
    if (localStorage['debugTracks'] === "true") {
        debugTracks = false;
        localStorage['debugTracks'] = "false";
        $('#debug_checkbox').removeClass('settingsCheckboxChecked');
    } else {
        debugTracks = true;
        localStorage['debugTracks'] = "true";
        $('#debug_checkbox').addClass('settingsCheckboxChecked');
    }

    remakeTrails();
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
    const dim = mapDimPercentage;
    const contrast = mapContrastPercentage;
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

function toggleMapDim(switchOn) {
    if (!switchOn && localStorage['MapDim'] === "true") {
        localStorage['MapDim'] = "false";
        MapDim = false;

        ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
            if (lyr.get('type') != 'base')
                return;
            ol.Observable.unByKey(lyr.dimKey);
        });

        $('#mapdim_checkbox').removeClass('settingsCheckboxChecked');

        /*
        $('html').css('background-color', '#F8F8F8');
        $('body').css('background-color', '#F8F8F8');
        $('#selected_infoblock').css('background-color', '#F8F8F8');
        $('#highlighted_infoblock').css('background-color', '#F8F8F8');
        $('.altitudeFilterInput').css('background-color', '#F8F8F8');
        */
    } else {
        localStorage['MapDim'] = "true";
        MapDim = true;

        ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
            if (lyr.get('type') != 'base')
                return;
            lyr.dimKey = lyr.on('postrender', dim);
        });

        $('#mapdim_checkbox').addClass('settingsCheckboxChecked');

    }
    OLMap.render();
    buttonActive('#B', localStorage['MapDim'] == "true");
}

function toggleAltitudeChart(switchToggle) {
    if (typeof localStorage['altitudeChart'] === 'undefined') {
        localStorage['altitudeChart'] = 'show';
    }
    let altitudeChartDisplay = localStorage['altitudeChart'];
    if (switchToggle === true) {
        altitudeChartDisplay = (altitudeChartDisplay === 'show') ? 'hidden' : 'show';
    }
    // if you're using custom colors always hide the chart
    if (customAltitudeColors === true) {
        altitudeChartDisplay = 'hidden';
        // also hide the control option
        $('#altitude_chart_container').hide();
    }
    if (altitudeChartDisplay === 'show') {
        $('#altitude_checkbox').addClass('settingsCheckboxChecked');
        $('#altitude_chart').show();
    } else {
        $('#altitude_checkbox').removeClass('settingsCheckboxChecked');
        $('#altitude_chart').hide();
    }
    localStorage['altitudeChart'] = altitudeChartDisplay;
}

function followRandomPlane() {
    if (showTrace)
        return;
    let this_one = null;
    let tired = 0;
    do {
        this_one = PlanesOrdered[Math.floor(Math.random()*PlanesOrdered.length)];
        if (!this_one || tired++ > 1000)
            break;
    } while (this_one.isFiltered() || !this_one.position || (now - this_one.position_time > 30));
    //console.log(this_one.icao);
    if (this_one)
        selectPlaneByHex(this_one.icao, {follow: true});
}

function toggleTableInView(switchOn) {
    if (switchOn || (globeIndex && !icaoFilter)) {
        tableInView = true;
    } else {
        tableInView = !tableInView;
        refreshTableInfo();
    }
    localStorage['tableInView'] = tableInView;
    if (tableInView) {
        $('#with_positions').text("On Screen:");
    } else {
        $('#with_positions').text("With Position:");
    }
    buttonActive('#V', tableInView);
}

function toggleLabels(switchOn) {
    enableLabels = !enableLabels;
    localStorage['enableLabels'] = enableLabels;
    for (let key in PlanesOrdered) {
        PlanesOrdered[key].updateMarker(false);
    }
    buttonActive('#L', enableLabels);

    if (showTrace)
        remakeTrails();
}
function toggleExtendedLabels() {
    if (isNaN(extendedLabels))
        extendedLabels = 0;

    extendedLabels++;
    extendedLabels %= 3;
    console.log(extendedLabels);
    localStorage['extendedLabels'] = extendedLabels;
    for (let key in PlanesOrdered) {
        PlanesOrdered[key].updateMarker(false);
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
    multiSelect = !multiSelect;

    if (newState == "on")
        multiSelect = true;
    if (newState == "off")
        multiSelect = false;

    if (!multiSelect) {
        if (!SelectedPlane)
            toggleIsolation(false, "off");
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
            refreshTableInfo();
            if (ZoomLvl >= 7)
                fetchData();
        }
    }
}

function onSearch(e) {
    e.preventDefault();
    const searchTerm = $("#search_input").val().trim();
    $("#search_input").val("");
    $("#search_input").blur();
    if (searchTerm)
        findPlanes(searchTerm, true, true, true, true);
    return false;
}

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

    refreshSelected();
    refreshHighlighted();
    refreshTableInfo();
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

    refreshSelected();
    refreshHighlighted();
    refreshTableInfo();
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

    refreshSelected();
    refreshHighlighted();
    refreshTableInfo();
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

    refreshSelected();
    refreshHighlighted();
    refreshTableInfo();
}
function onResetAltitudeFilter(e) {
    $("#altitude_filter_min").val("");
    $("#altitude_filter_max").val("");
    $("#altitude_filter_min").blur();
    $("#altitude_filter_max").blur();

    updatePlaneFilter();
    refreshTableInfo();
}

function updatePlaneFilter() {
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

    if (filterTracks) {
        remakeTrails();
    }

    refreshFeatures();
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

function getFlightAwarePhotoLink(registration) {
    if (registration !== null && registration !== "") {
        return "<a target=\"_blank\" href=\"https://flightaware.com/photos/aircraft/" + registration.replace(/[^0-9a-z]/ig,'') + "\" rel=\"noreferrer\">See Photos</a>";
    }

    return "";   
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
    if (fetchingPf)
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
                if (ac.reg && ac.reg != "????" && ac.reg != "z.NO-REG")
                    plane.registration = ac.reg;
                if (ac.type && ac.type != "????" && ac.type != "ZVEH")
                    plane.icaoType = ac.type;
                if (plane.icaoType != plane.icaoTypeCache) {
                    let typeData = _aircraft_type_cache[plane.icaoType];
                    if (typeData) {
                        plane.typeDescription = typeData.desc;
                        plane.wtc = typeData.wtc;
                    }
                    //console.log(plane.icao +" "+ plane.flight + " was " + plane.icaoTypeCache + " and is now " + plane.icaoType + " " + plane.typeDescription + "-" + plane.wtc);
                    //console.log(plane.flight);
                    plane.icaoTypeCache = plane.icaoType;
                }

            }
            fetchingPf = false;
        });
    }
}

function solidGoldT() {
    solidT = true;
    let list = [[], [], [], []];
    for (let i = 0; i < PlanesOrdered.length; i++) {
        let plane = PlanesOrdered[i];
        //console.log(plane);
        if (plane.seen_pos && plane.seen_pos < 1200) {
            plane.visible = true;
            list[Math.floor(4*i/PlanesOrdered.length)].push(plane);
        }
    }
    getTrace(null, null, {onlyFull: true, list: list[0],});
    getTrace(null, null, {onlyFull: true, list: list[1],});
    getTrace(null, null, {onlyFull: true, list: list[2],});
    getTrace(null, null, {onlyFull: true, list: list[3],});
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
}

function zoomOut() {
    const zoom = OLMap.getView().getZoom();
    OLMap.getView().setZoom((zoom-1).toFixed());
}

function changeCenter(init) {

    const rawCenter = OLMap.getView().getCenter();
    const center = ol.proj.toLonLat(rawCenter);

    localStorage['CenterLon'] = CenterLon = center[0];
    localStorage['CenterLat'] = CenterLat = center[1];

    if (!onlySelected)
        refreshTableInfo();

    if (!init && showTrace)
        updateAddressBar();

    if (rawCenter[0] < OLProj.extent_[0] || rawCenter[0] > OLProj.extent_[3]) {
        OLMap.getView().setCenter(ol.proj.fromLonLat(center));
    }

}

function checkMovement() {
    const zoom = OLMap.getView().getZoom();
    const center = ol.proj.toLonLat(OLMap.getView().getCenter());

    if (
        checkMoveZoom != zoom ||
        checkMoveCenter[0] != center[0] ||
        checkMoveCenter[1] != center[1]
    ) {
        noMovement = 0;
    }

    if (noMovement == 0)
        checkFollow();

    checkMoveZoom = zoom;
    checkMoveCenter[0] = center[0];
    checkMoveCenter[1] = center[1];

    if (noMovement++ != 3)
        return;

    // no zoom/pan inputs for 450 ms after a zoom/pan input
    //
    //console.time("fire!");
    lastActive = new Date().getTime();
    changeZoom();
    changeCenter();

    drawHeatmap();

    //console.timeEnd("fire!");
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

    if (ZoomLvl > markerZoomDivide)
        scaleFactor = markerBig;
    else
        scaleFactor = markerSmall;

    // scale markers according to global scaling
    scaleFactor *= Math.pow(1.3, globalScale) * globalScale;

    if (!onlySelected)
        refreshTableInfo();

    if (!init && showTrace)
        updateAddressBar();

    if (ZoomLvl > 5.5 && enableMouseover) {
        OLMap.on('pointermove', onPointermove);
    } else {
        OLMap.un('pointermove', onPointermove);
        removeHighlight();
    }
}

function updateCell(plane, cell, newValue, html) {
    if (columnVis[cell] && newValue != plane.trCache[cell]) {
        plane.trCache[cell] = newValue;
        if (html) {
            plane.tr.cells[cell].innerHTML = newValue;
        } else {
            plane.tr.cells[cell].textContent = newValue;
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
                return (layer == iconLayer);
            },
            hitTolerance:5,
        }
    );

    clearTimeout(pointerMoveTimeout);
    if (hex) {
        HighlightedPlane = hex;
        pointerMoveTimeout = setTimeout(refreshHighlighted(), 300);
    } else {
        HighlightedPlane = null;
        pointerMoveTimeout = setTimeout(removeHighlight(), 300);
    }
}

function processURLParams(){
    try {
        const search = new URLSearchParams(window.location.search);

        let icaos = [];
        let valid = [];
        let icao = null;
        if (search.has('icao')) {
            icaos = search.get('icao').toLowerCase().split(',');
            for (let i = 0; i < icaos.length; i++) {
                icao = icaos[i].toLowerCase();
                if (icao && (icao.length == 7 || icao.length == 6) && icao.toLowerCase().match(/[a-f,0-9]{6}/)) {
                    valid.push(icao);
                    if (i == 0)
                        icaoParam = icao;
                }
            }
        }

        icaos = valid;

        traceDateString = search.get('showTrace');
        const callsign = search.get('callsign');
        let zoom = null;
        let follow = true;
        if (search.get("zoom")) {
            try {
                zoom = parseFloat(search.get("zoom"));
                if (zoom === 0)
                    zoom = 8;
            } catch (error) {
                console.log("Error parsing zoom:", error);
            }
        }

        if (search.get("lat") && search.get("lon")) {
            try {
                const lat = parseFloat(search.get("lat"));
                const lon = parseFloat(search.get("lon"));
                OLMap.getView().setCenter(ol.proj.fromLonLat([lon, lat]));
                follow = false;
                noPan = true;
            }
            catch (error) {
                console.log("Error parsing lat/lon:", error);
            }
        }

        if (icaos.length > 0) {
            if (!search.has('noIsolation'))
                toggleIsolation("on", false);
            if (icaos.length > 1)
                toggleMultiSelect("on");
            for (let i = 0; i < icaos.length; i++) {
                icao = icaos[i];
                if (Planes[icao] || globeIndex) {
                    console.log('Selected ICAO id: '+ icao);
                    let selectOptions = {follow: follow};
                    if (traceDateString != null) {
                        toggleShowTrace();
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
        } else if (callsign != null) {
            findPlanes(callsign, false, true, false, false);
        }

        if (zoom) {
            OLMap.getView().setZoom(zoom);
        }

        if (search.has('mil'))
            toggleMilitary();

        if (search.has('airport')) {
            airport = search.get('airport').trim().toUpperCase();
            onJump();
        }

        if (search.has('leg')) {
            legSel = parseInt(search.get('leg'), 10);
            if (isNaN(legSel) || legSel < -1)
                legSel = -1;
            else
                legSel--;
        }

        let tracks = search.get('monochromeTracks');
        if (tracks != undefined) {
            if (tracks.length == 6)
                monochromeTracks = '#' + tracks;
            else
                monochromeTracks = "#000000";
        }

        let markers = search.get('monochromeMarkers');
        if (markers != undefined) {
            if (markers.length == 6)
                monochromeMarkers = '#' + markers;
            else
                monochromeMarkers = "#FFFFFF";
        }

        let outlineColor = search.get('outlineColor');
        if (outlineColor != undefined) {
            if (outlineColor.length == 6)
                OutlineADSBColor = '#' + outlineColor;
            else
                OutlineADSBColor = "#000000";
        }

        if (search.has('centerReceiver')) {
            OLMap.getView().setCenter(ol.proj.fromLonLat([SiteLon, SiteLat]));
        }

    } catch (error) {
        console.log(error);
    }
}

function findPlanes(query, byIcao, byCallsign, byReg, byType) {
    if (query == null)
        return;
    query = query.toLowerCase();
    let results = [];
    if (byReg && regCache[query.toUpperCase()]) {
        selectPlaneByHex(regCache[query.toUpperCase()].toLowerCase(), {follow: true});
        return;
    }
    for (let i in PlanesOrdered) {
        const plane = PlanesOrdered[i];
        if (
            (byCallsign && plane.flight != null && plane.flight.toLowerCase().match(query))
            || (byIcao && plane.icao.toLowerCase().match(query))
            || (byReg && plane.registration != null && plane.registration.toLowerCase().match(query))
            || (byType && plane.icaoType != null && plane.icaoType.toLowerCase().match(query))
        ) {
            if (plane.seen < 70 || noVanish)
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
    for (let i in PlanesOrdered) {
        PlanesOrdered[i].reapTrail();
    }
}

function globeIndexes() {
    if (mapIsVisible || lastGlobeExtent == null) {
        let mapSize = OLMap.getSize();
        let size = [mapSize[0] * 1.1, mapSize[1] * 1.1];
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
        x1 = -180;
        x2 = 180;
    }
    if (y1 < -90)
        y1 = -90;
    if (y2 > 90)
        y2 = 90;
    let indexes = [];
    //console.log(x1 + ' ' + x2);
    let grid = globeIndexGrid;

    let x3 = (x1 < x2) ? x2 : 300;
    let count = 0;

    for (let lon = x1; lon < x3 + grid; lon += grid) {
        if (x1 >= x2 && lon > 180) {
            lon -= 360;
            x3 = x2;
        }
        if (lon > x3)
            lon = x3 + 0.01;
        for (let lat = y1; lat < y2 + grid; lat += grid) {
            if (lat > y2)
                lat = y2 + 0.01;
            if (count++ > 2000) {
                console.log("globeIndexes fail, lon: " + lon + ", lat: " + lat);
                break;
            }
            if (lat > 90)
                break;
            let index = globe_index(lat, lon);
            //console.log(lat + ' ' + lon + ' ' + index);
            if (!indexes.includes(index)) {
                indexes.push(index);
            }
        }
    }
    return indexes;
}
function globe_index(lat, lon) {
    let grid = globeIndexGrid;

    lat = grid * Math.floor((lat + 90) / grid) - 90;
    lon = grid * Math.floor((lon + 180) / grid) - 180;

    for (let i = 0; i < globeIndexSpecialTiles.length; i++) {
        let tile = globeIndexSpecialTiles[i];
        if (lat >= tile.south && lat < tile.north) {
            if (tile.west < tile.east && lon >= tile.west && lon < tile.east) {
                return i;
            }
            if (tile.west > tile.east && (lon >= tile.west || lon < tile.east)) {
                return i;
            }
        }
    }

    let i = Math.floor((lat+90) / grid);
    let j = Math.floor((lon+180) / grid);

    let lat_multiplier = Math.floor(360 / grid + 1);
    return (i * lat_multiplier + j + 1000);
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
    //sidebarVisible = $("#sidebar_container").is(":visible");
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
function updateAddressBar() {
    if (heatmap)
        return;
    let posString = 'lat=' + CenterLat.toFixed(3) + '&lon=' + CenterLon.toFixed(3) + '&zoom=' + ZoomLvl.toFixed(1);
    let string;
    if (showTrace) {
        if (SelectedPlane)
            posString = "&" + posString;
        else
            posString = "?" + posString;
    } else {
        posString = ""
    }

    let planes = [];
    if (multiSelect && !SelectedAllPlanes) {
          for (let i = 0; i < PlanesOrdered.length; ++i) {
              let plane = PlanesOrdered[i];
              if (plane.selected)
                  planes.push(plane);
          }
    } else if (SelectedPlane) {
        planes.push(SelectedPlane);
    }

    string = pathName;
    if (planes.length > 0) {
        string += '?icao=';
        for (let i = 0; i < planes.length; i++) {
            string += planes[i].icao;
            if (i < planes.length - 1)
                string += ',';
        }
    }

    string += posString;

    if (SelectedPlane && showTrace) {
        string += '&showTrace=' + traceDateString;
        if (legSel != -1)
            string += '&leg=' + (legSel + 1);
    }

    shareLink = string;

    if (uuid)
        return;
    if (icaoFilter)
        return;

    if (SelectedPlane && globeIndex) {
        let icao_link = "<a style=\"color: blue\" target=\"_blank\" href=\"" + shareLink + "\">Share</a>";
        icao_link = NBSP +NBSP +NBSP +NBSP +NBSP +NBSP + icao_link;
        $('#selected_icao').html(SelectedPlane.icao.toUpperCase() + icao_link);
    }

    window.history && window.history.replaceState && window.history.replaceState("object or string", "Title", string);
}

function refreshInt() {
    let refresh = RefreshInterval;
    if (!globeIndex)
        return refresh;

    if (adsbexchange && refresh < 2500)
        refresh = 2500;

    inactive = (lastActive - new Date().getTime()) / 1000;

    if (inactive < 100)
        inactive = 100;
    if (inactive > 400)
        inactive = 400;

    if (document[hidden])
        refresh = 24 * 3600 * 1000; // hidden tab, don't refresh to avoid freeze when the tab is switched to again.
    else
        refresh *= inactive / 100;

    if (!mapIsVisible)
        refresh *= 2;

    if (onMobile)
        refresh *= 1.5;

    if (lastRequestFiles >= 4)
        return 1.6 * refresh;

    return refresh * (1 + 0.6 / 3 * (lastRequestFiles - 1));
}

function toggleLargeMode() {

    largeMode++;
    if (!(largeMode >= 1 && largeMode <= 4))
        largeMode = 1;

    let root = document.documentElement;

    const base = 1.2;
    globalScale = Math.pow(base, largeMode) / base;
    root.style.setProperty("--SCALE", globalScale);

    labelFont = "bold " + (12 * globalScale) + "px/" + (14 * globalScale) + "px Tahoma, Verdana, Helvetica, sans-serif";

    localStorage['largeMode'] = largeMode;

    changeZoom("init");
    setLineWidth();
    refreshFeatures();
    refreshSelected();
    remakeTrails();
}

function toggleShowTrace() {
    if (!showTrace) {
        toggleMultiSelect("off");
        showTrace = true;
        toggleFollow(false);
        showTraceWasIsolation = onlySelected;
        toggleIsolation("on", null);
        shiftTrace();
        $('#history_collapse')[0].style.display = "block";
        $('#show_trace').addClass("active");
    } else {
        showTrace = false;
        legSel = -1;
        $('#leg_sel').text('Legs: All');
        if (!showTraceWasIsolation)
            toggleIsolation(null, "off");
        //let string = pathName + '?icao=' + SelectedPlane.icao;
        //window.history.replaceState("object or string", "Title", string);
        //shareLink = string;
        updateAddressBar();
        $('#history_collapse')[0].style.display = "none";
        $('#show_trace').removeClass("active");
        const hex = SelectedPlane.icao;
        SelectedPlane = null;
        showTraceExit = true;
        selectPlaneByHex(hex, {follow: true, zoom: ZoomLvl,});
    }
}

function legShift(offset) {
    if(!offset)
        offset = 0;

    legSel += offset;

    if (offset != 0)
        traceOpts.showTime = null;

    if (!SelectedPlane.fullTrace) {
        $('#leg_sel').text('No Data available for\n' + traceDateString);
        $('#trace_time').text('UTC:\n');
        SelectedPlane.processTrace();
        return;
    }

    let trace = SelectedPlane.fullTrace.trace;
    let legStart = null;
    let legEnd = null;
    let count = 0;
    let timeZero = SelectedPlane.fullTrace.timestamp;

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
        SelectedPlane.processTrace();
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
    SelectedPlane.processTrace();

    updateAddressBar();
}

function shiftTrace(offset) {
    $('#leg_sel').text('Loading ...');
    if (traceDateString && !traceDate) {
        let numbers = traceDateString.split('-');
        traceDate = new Date();
        traceDate.setUTCFullYear(numbers[0]);
        traceDate.setUTCMonth(numbers[1] - 1);
        traceDate.setUTCDate(numbers[2]);
    }
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

    $('#trace_date').text('UTC day:\n' + traceDateString);

    let hex = SelectedPlane ? SelectedPlane.icao : icaoParam;

    let selectOptions = {noDeselect: true, zoom: ZoomLvl};
    selectPlaneByHex(hex, selectOptions);

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
    if (SitePosInitialized)
        return;

    // Set SitePosition
    if (SiteLat != null && SiteLon != null) {
        SitePosition = [SiteLon, SiteLat];
        // Add home marker if requested
        createSiteCircleFeatures();
    } else {
        SitePosition = null;
        HideCols.push("#distance");
        setColumnVisibility();
    }

    if (SitePosition && !onMobile) {
        sortByDistance();
    } else {
        sortByAltitude();
        sortByAltitude();
    }
}

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

function remakeTrails() {
    for (let i in PlanesOrdered) {
        PlanesOrdered[i].remakeTrail();
        PlanesOrdered[i].updateTick(true);
    }
}

function createSiteCircleFeatures() {
    StaticFeatures.clear();
    drawUpintheair();
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

    let circleStyle = function(distance) {
        return new ol.style.Style({
            fill: null,
            stroke: new ol.style.Stroke({
                color: '#000000',
                width: 1
            }),
            text: new ol.style.Text({
                font: '10px Helvetica Neue, sans-serif',
                fill: new ol.style.Fill({ color: '#000' }),
                offsetY: -8,
                text: format_distance_long(distance, DisplayUnits, 0)

            })
        });
    };

    let conversionFactor = 1000.0;
    if (DisplayUnits === "nautical") {
        conversionFactor = 1852.0;
    } else if (DisplayUnits === "imperial") {
        conversionFactor = 1609.0;
    }

    for (let i=0; i < SiteCirclesDistances.length; ++i) {
        let distance = SiteCirclesDistances[i] * conversionFactor;
        let circle = make_geodesic_circle(SitePosition, distance, 180);
        circle.transform('EPSG:4326', 'EPSG:3857');
        let feature = new ol.Feature(circle);
        feature.setStyle(circleStyle(distance));
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
    if (!globeIndex) {
        let request = $.ajax({ url: 'upintheair.json',
            cache: true,
            dataType: 'json' });
        request.done(function(data) {
            for (let i = 0; i < data.rings.length; ++i) {
                let geom = null;
                let points = data.rings[i].points;
                let altitude = (3.28084 * data.rings[i].alt).toFixed(0);
                let color = range_outline_color;
                if (range_outline_colored_by_altitude) {
                    let colorArr = altitudeColor(altitude);
                    color = 'hsl(' + colorArr[0].toFixed(0) + ',' + colorArr[1].toFixed(0) + '%,' + colorArr[2].toFixed(0) + '%)';
                }
                let ringStyle = new ol.style.Style({
                    fill: null,
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: range_outline_width,
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
                    feature.setStyle(ringStyle);
                    StaticFeatures.addFeature(feature);
                }
            }
        });

        request.fail(function(jqxhr, status, error) {
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
        if (SelectedPlane.marker) {

            traceOpts.animateFromLon += (traceOpts.animateToLon - traceOpts.animateFromLon) / traceOpts.animateSteps;
            traceOpts.animateFromLat += (traceOpts.animateToLat - traceOpts.animateFromLat) / traceOpts.animateSteps;

            let animatePos = [traceOpts.animateFromLon, traceOpts.animateFromLat];
            SelectedPlane.marker.setGeometry(new ol.geom.Point(animatePos));

            //console.log('int:  ', animatePos);
            if (FollowSelected)
                OLMap.getView().setCenter(animatePos);
        }
        if (--traceOpts.animateSteps == 1)
            traceOpts.animate = false;
        traceOpts.showTimeout = setTimeout(gotoTime, traceOpts.animateInterval);
    }
}

function checkFollow() {
    if (!FollowSelected || traceOpts.showTime)
        return;
    if (!SelectedPlane || !SelectedPlane.position) {
        toggleFollow(false);
        return;
    }
    const center = ol.proj.toLonLat(OLMap.getView().getCenter());
    if (Math.abs(center[0] - SelectedPlane.position[0]) > 0.001 ||
        Math.abs(center[1] - SelectedPlane.position[1]) > 0.001) {
        toggleFollow(false);
    } else {
        toggleFollow(true);
    }
}

function getTrace(newPlane, hex, options) {

    if (options.list) {
        newPlane = options.list.pop()
        if (!newPlane) {
            return;
        }
        hex = newPlane.icao;
    }

    let URL1 = 'data/traces/'+ hex.slice(-2) + '/trace_recent_' + hex + '.json';
    let URL2 = 'data/traces/'+ hex.slice(-2) + '/trace_full_' + hex + '.json';
    //console.log('Requesting trace: ' + hex);

    if (!newPlane) {
        processAircraft({hex: hex, });
        newPlane = Planes[hex];
        newPlane.last_message_time = NaN;
        newPlane.position_time = NaN;
        newPlane.selected = true;
        SelectedPlane = newPlane;
    }

    traceOpts = options;

    if (showTrace) {
        let today = new Date();
        //console.log(today.toUTCString() + ' ' + traceDate.toUTCString());
        // use non historic traces for showTrace until 30 min after midnight
        if (today.getTime() > traceDate.getTime() && today.getTime() < traceDate.getTime() + (24 * 60 * 60 + 30 * 60) * 1000) {

            today.setUTCHours(0);
            today.setUTCMinutes(0);
            today.setUTCSeconds(0);

            traceOpts.startStamp = today.getTime() / 1000;
        } else {
            URL1 = null;
            URL2 = 'globe_history/' + traceDateString + '/traces/' + hex.slice(-2) + '/trace_full_' + hex + '.json';
        }
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

    req2 = $.ajax({ url: URL2,
        dataType: 'json',
        options: options,
    });

    options.req2 = req2;

    if (!fake1) {
        req1.done(function(data) {
            let plane = data.plane || this.options.plane;
            plane.recentTrace = data;
            if (!showTrace)
                plane.processTrace();
            let defer = data.defer || this.options.defer;
            defer.resolve(plane);
        });
    }
    req2.done(function(data) {
        let plane = this.options.plane;
        plane.fullTrace = data;
        this.options.defer.done(function(plane) {
            if (showTrace)
                legShift(0);
            else
                plane.processTrace();
        });
        if (options.list) {
            newPlane.updateLines();
            getTrace(null, null, options);
        }
    });
    req2.fail(function() {
        if (showTrace)
            legShift(0);
        else
            this.options.plane.processTrace();

        if (options.list)
            getTrace(null, null, options);
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
    for (const i of set.values())
        count++;
    return count;
}

function drawHeatmap() {
    if (!heatmap || replay)
        return;
    if (heatmap.init) {
        initHeatmap();
    }

    console.time("drawHeat");

    let ext = myExtent(OLMap.getView().calculateExtent(OLMap.getSize()));
    let maxLat = ext.maxLat * 1000000;
    let minLat = ext.minLat * 1000000;

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
    while (pointCount < heatmap.max && setSize(done) < myPoints.length && iterations++ < maxIter) {
        for (let k = 0; k < myPoints.length && pointCount < heatmap.max; k++) {
            if (offsets[k] >= indexes[k].length) {
                done.add(k);
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
                if (!style) {
                    let hsl = altitudeColor(alt);
                    hsl[1] = hsl[1] * 0.85;
                    hsl[2] = hsl[2] * 0.8;
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
                feat.setStyle(style);
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
        for (let i = 0; i < heatFeaturesSpread; i++) {
            heatFeatures[i].addFeatures(features.splice(0, pointCount / heatFeaturesSpread + 1));
            //console.log(features.length);
        }
    }
    console.timeEnd("drawHeat");
    $("#loader").addClass("hidden");
}

function initReplay() {
    let index = 0;
    for (let k = 0; k < heatChunks.length; k++) {
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
    }
}


function play() {
    if (!replay)
        return;
    ZoomLvl = OLMap.getView().getZoom();
    let center = ol.proj.toLonLat(OLMap.getView().getCenter());
    localStorage['CenterLon'] = CenterLon = center[0];
    localStorage['CenterLat'] = CenterLat = center[1];
    clearTimeout(refreshId);
    refreshId = setTimeout(replay, replay.ival / replay.speed);
    if (showTrace)
        return;

    updateIconCache();

    last = now;

    for (let j=0; j < acs.length; j++) {
        if (icaoFilter && !icaoFilter.includes(hex))
            continue;

        if (!onlyMilitary || plane.military)
            plane.updateData(now, last, ac, init);
        else
            plane.last_message_time = now - ac.seen;
    }

    refreshTableInfo();
    refreshClock(new Date(now * 1000));
    refreshSelected();
    refreshHighlighted();

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
