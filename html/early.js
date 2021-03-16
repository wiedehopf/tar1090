// This was functionality of script.js, moved it to here to start the downloading of track history earlier
"use strict";

let Dump1090Version = "unknown version";
let RefreshInterval = 1000;
let enable_uat = false;
let enable_pf_data = false;
let HistoryChunks = false;
let nHistoryItems = 0;
let HistoryItemsReturned = 0;
let chunkNames = [];
let PositionHistoryBuffer = [];
var	receiverJson;
let deferHistory = [];
let historyLoaded = $.Deferred();
let configureReceiver = $.Deferred();
let historyTimeout = 60;
let globeIndex = 0;
let globeIndexGrid = 0;
let globeIndexSpecialTiles;
let dynGlobeRate = false;
let binCraft = false;
let dbServer = false;
let l3harris = false;
let heatmap = false;
let heatLoaded = 0;
let heatmapDefer = $.Deferred();
let heatChunks = [];
let heatPoints = [];
let replay = false;
let rData = [];
let StaleReceiverCount = 0;
let pTracks = false;
let lastTraceGet = 0;
let traceRate = 0;
let _aircraft_type_cache = null;
let tfrs = false;
let initialURL = window.location.href;

let uuid = null;

let usp;
try {
    // let's make this case insensitive
    usp = {
        params: new URLSearchParams(),
        has: function(s) {return this.params.has(s.toLowerCase());},
        get: function(s) {return this.params.get(s.toLowerCase());},
    };
    const inputParams = new URLSearchParams(window.location.search);
    for (const [k, v] of inputParams) {
        usp.params.append(k.toLowerCase(), v);
    }
} catch (error) {
    console.error(error);
    usp = {
        has: function() {return false;},
        get: function() {return null;},
    }
}

if (usp.has('reset')) {
    localStorage.clear();
    if (window.history && window.history.replaceState) {
        window.history.replaceState("object or string", "Title", window.location.pathname);
        location.reload();
    }
}
const feed = usp.get('feed');
if (feed != null) {
    uuid = feed;
    console.log('uuid: ' + uuid);
    if (uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)) {
        console.log('redirecting the idiot, oui!');
        let URL = 'https://www.adsbexchange.com/api/feeders/tar1090/?feed=' + uuid;
        console.log(URL);
        //window.history.pushState(URL, "Title", URL);
        window.location.href = URL;
    }
}
if (usp.has('tfrs')) {
    tfrs = true;
}

const customTiles = usp.get('customTiles');
if (customTiles)
    localStorage['customTiles'] = customTiles;
if (customTiles == 'remove')
    localStorage.removeItem('customTiles');

const bingKey = usp.get('BingMapsAPIKey');
if (bingKey)
    localStorage['bingKey'] = bingKey;
if (bingKey == 'remove')
    localStorage.removeItem('bingKey');

if (usp.has('L3Harris') || usp.has('l3harris'))
    l3harris = true;
if (usp.has('r')) {
    replay = true;
}

if (usp.has('heatmap')) {

    heatmap = {};

    heatmap.max = 32000;
    heatmap.init = true;
    heatmap.duration = 24;
    heatmap.end = (new Date()).getTime();

    let tmp = parseFloat(usp.get('heatDuration'));
    if (!isNaN(tmp))
        heatmap.duration = tmp;
    if (heatmap.duration < 0.5)
        heatmap.duration = 0.5;
    tmp = parseFloat(usp.get('heatEnd'));
    if (!isNaN(tmp))
        heatmap.end -= tmp * 3600 * 1000;
    if (usp.has('heatLines'))
        heatmap.lines = true;
    tmp = parseFloat(usp.get('heatAlpha'));
    if (!isNaN(tmp)) {
        heatmap.alpha = tmp;
        console.log('heatmap.alpha = ' + tmp);
    }
    heatmap.radius = 2.5;
    if (usp.has('realHeat')) {
        heatmap.max = 50000;
        heatmap.real = true;
        heatmap.radius = 1.5;
        heatmap.blur = 4;
        heatmap.weight = 0.25;

        tmp = parseFloat(usp.get('heatBlur'));
        if (!isNaN(tmp))
            heatmap.blur = tmp;

        tmp = parseFloat(usp.get('heatWeight'));
        if (!isNaN(tmp))
            heatmap.weight = tmp;
    }
    tmp = parseFloat(usp.get('heatRadius'));
    if (!isNaN(tmp))
        heatmap.radius = tmp;
    let val;
    if (val = parseInt(usp.get('heatmap'), 10))
        heatmap.max = val;
    if (usp.has('heatManualRedraw'))
        heatmap.manualRedraw = true;
}

if (usp.has('pTracks')) {
    let tmp = parseFloat(usp.get('pTracks'))
    if (tmp > 0 && tmp < 9999)
        pTracks = tmp;
    else
        pTracks = 9999;
}

function zDateString(date) {
    let string = date.getUTCFullYear() + '-'
        + (date.getUTCMonth() + 1).toString().padStart(2, '0') + '-'
        + date.getUTCDate().toString().padStart(2, '0')
    return string;
}

function sDateString(date) {
    let string = date.getUTCFullYear() + '/'
        + (date.getUTCMonth() + 1).toString().padStart(2, '0') + '/'
        + date.getUTCDate().toString().padStart(2, '0')
    return string;
}

function lDateString(date) {
    let string = date.getFullYear() + '-'
        + (date.getMonth() + 1).toString().padStart(2, '0') + '-'
        + date.getDate().toString().padStart(2, '0')
    return string;
}

let get_receiver_defer;
let test_chunk_defer;
if (uuid) {
    // don't need receiver / chunks json
} else if (!window.location.href.match(/globe.*adsbexchange.com/)) {
    // get configuration json files, will be used in initialize function
    get_receiver_defer = $.ajax({
        url: 'data/receiver.json',
        cache: false,
        dataType: 'json',
        timeout: 10000,
    });
    test_chunk_defer = $.ajax({
        url:'chunks/chunks.json',
        cache: false,
        dataType: 'json',
        timeout: 4000,
    });
} else {
    console.log("Using adsbexchange fast-path load!");
    let data = JSON.parse('{"refresh":1600,"history":1,"dbServer":true,"binCraft":true,"globeIndexGrid":3,"globeIndexSpecialTiles":[{"south":60,"east":0,"north":90,"west":-126},{"south":60,"east":150,"north":90,"west":0},{"south":51,"east":-126,"north":90,"west":150},{"south":9,"east":-126,"north":51,"west":150},{"south":51,"east":-69,"north":60,"west":-126},{"south":45,"east":-114,"north":51,"west":-120},{"south":45,"east":-102,"north":51,"west":-114},{"south":45,"east":-90,"north":51,"west":-102},{"south":45,"east":-75,"north":51,"west":-90},{"south":45,"east":-69,"north":51,"west":-75},{"south":42,"east":18,"north":48,"west":12},{"south":42,"east":24,"north":48,"west":18},{"south":48,"east":24,"north":54,"west":18},{"south":54,"east":24,"north":60,"west":12},{"south":54,"east":12,"north":60,"west":3},{"south":54,"east":3,"north":60,"west":-9},{"south":42,"east":0,"north":48,"west":-9},{"south":42,"east":51,"north":51,"west":24},{"south":51,"east":51,"north":60,"west":24},{"south":30,"east":90,"north":60,"west":51},{"south":30,"east":120,"north":60,"west":90},{"south":30,"east":129,"north":39,"west":120},{"south":30,"east":138,"north":39,"west":129},{"south":30,"east":150,"north":39,"west":138},{"south":39,"east":150,"north":60,"west":120},{"south":9,"east":111,"north":21,"west":90},{"south":21,"east":111,"north":30,"west":90},{"south":9,"east":129,"north":24,"west":111},{"south":24,"east":120,"north":30,"west":111},{"south":24,"east":129,"north":30,"west":120},{"south":9,"east":150,"north":30,"west":129},{"south":9,"east":69,"north":30,"west":51},{"south":9,"east":90,"north":30,"west":69},{"south":-90,"east":51,"north":9,"west":-30},{"south":-90,"east":111,"north":9,"west":51},{"south":-90,"east":160,"north":-18,"west":111},{"south":-18,"east":160,"north":9,"west":111},{"south":-90,"east":-90,"north":-42,"west":160},{"south":-42,"east":-90,"north":9,"west":160},{"south":-9,"east":-42,"north":9,"west":-90},{"south":-90,"east":-63,"north":-9,"west":-90},{"south":-21,"east":-42,"north":-9,"west":-63},{"south":-90,"east":-42,"north":-21,"west":-63},{"south":-90,"east":-30,"north":9,"west":-42},{"south":9,"east":-117,"north":33,"west":-126},{"south":9,"east":-102,"north":30,"west":-117},{"south":9,"east":-90,"north":27,"west":-102},{"south":24,"east":-84,"north":30,"west":-90},{"south":9,"east":-69,"north":18,"west":-90},{"south":18,"east":-69,"north":24,"west":-90},{"south":36,"east":18,"north":42,"west":6},{"south":36,"east":30,"north":42,"west":18},{"south":9,"east":6,"north":39,"west":-9},{"south":9,"east":30,"north":36,"west":6},{"south":9,"east":51,"north":42,"west":30},{"south":24,"east":-69,"north":39,"west":-75},{"south":9,"east":-33,"north":30,"west":-69},{"south":30,"east":-33,"north":60,"west":-69},{"south":9,"east":-9,"north":30,"west":-33},{"south":30,"east":-9,"north":60,"west":-33}],"version":"adsbexchange backend"}');
    get_receiver_defer = $.Deferred().resolve(data);
    test_chunk_defer = $.Deferred().reject();
}

$.getJSON(databaseFolder + "/icao_aircraft_types.js").done(function(typeLookupData) {
    _aircraft_type_cache = typeLookupData;
});


if (!heatmap) {
    heatmapDefer.resolve();
} else {
    let end = heatmap.end;
    let start = end - heatmap.duration * 3600 * 1000;
    let interval = 1800 * 1000;
    let numChunks = Math.round((end - start) / interval);
    console.log('numChunks: ' + numChunks + ' heatDuration: ' + heatmap.duration + ' heatEnd: ' + new Date(heatmap.end));
    heatChunks = Array(numChunks).fill(null);
    heatPoints = Array(numChunks).fill(null);
    for (let i = 0; i < numChunks; i++) {
        let xhrOverride = new XMLHttpRequest();
        xhrOverride.responseType = 'arraybuffer';

        let time = new Date(start + i * interval);
        let sDate = sDateString(time);
        let index = 2 * time.getUTCHours() + Math.floor(time.getUTCMinutes() / 30);

        let base = "globe_history/";

        let URL = base + sDate + "/heatmap/" +
            index.toString().padStart(2, '0') + ".bin.ttf";
        let req = $.ajax({
            url: URL,
            method: 'GET',
            num: i,
            xhr: function() {
                return xhrOverride;
            }
        });
        req.done(function (responseData) {
            heatChunks[this.num] = responseData;
            heatLoaded++;
            if (heatLoaded == heatChunks.length) {
                heatmapDefer.resolve();
            }
        });
        req.fail(function(jqxhr, status, error) {
            heatLoaded++;
            if (heatLoaded == heatChunks.length) {
                heatmapDefer.resolve();
            }
        });
    }
}

if (uuid != null) {
    receiverJson = null;
    Dump1090Version = 'unknown';
    RefreshInterval = 5000;
    configureReceiver.resolve();
    //console.time("Downloaded History");
} else {
    get_receiver_defer.fail(function(data){
        StaleReceiverCount++;

        setTimeout(function() {
            $("#loader").addClass("hidden");
            $("#update_error_detail").text("Seems the decoder / receiver / backend isn't working correctly!");
            $("#update_error").css('display','block');
        }, 2000);

        setTimeout(function() {
            location.reload();
        }, 10000);
    });
    get_receiver_defer.done(function(data){
        receiverJson = data;
        Dump1090Version = data.version;
        RefreshInterval = data.refresh;
        nHistoryItems = (data.history < 2) ? 0 : data.history;
        binCraft = data.binCraft ? true : false;
        dbServer = (data.dbServer && data.globeIndexGrid != null) ? true : false;

        if (receiverJson.lat != null) {
            SiteLat = receiverJson.lat;
            SiteLon = receiverJson.lon;
            DefaultCenterLat = receiverJson.lat;
            DefaultCenterLon = receiverJson.lon;
        }
        if (receiverJson.jaeroTimeout) {
            jaeroTimeout = receiverJson.jaeroTimeout * 60;
        }

        if (data.globeIndexGrid != null || heatmap || replay) {
            HistoryChunks = false;
            nHistoryItems = 0;
            globeIndex = 1;


            if (receiverJson.globeIndexGrid) {
                globeIndexGrid = receiverJson.globeIndexGrid;
                globeIndex = 1;
                globeIndexSpecialTiles = [];
                for (let i = 0; i < receiverJson.globeIndexSpecialTiles.length; i++) {
                    let tile = receiverJson.globeIndexSpecialTiles[i];
                    globeIndexSpecialTiles.push([tile.south, tile.west, tile.north, tile.east]);
                }
            }

            get_history();
            configureReceiver.resolve();
        } else {
            test_chunk_defer.done(function(data) {
                HistoryChunks = true;
                console.log("Chunks enabled!");
                chunkNames = (pTracks ? data.chunks_all : data.chunks) || [];
                nHistoryItems = chunkNames.length;
                enable_uat = (data.enable_uat == "true");
                enable_pf_data = (data.pf_data == "true");
                if (enable_uat)
                    console.log("UAT/978 enabled!");
                get_history();
                configureReceiver.resolve();
            }).fail(function() {
                HistoryChunks = false;
                get_history();
                configureReceiver.resolve();
            });
        }
    });
}

function get_history() {

    if (!globeIndex) {
        nHistoryItems++;
        let request = $.ajax({ url: 'data/aircraft.json',
            timeout: historyTimeout*800,
            cache: false,
            dataType: 'json' });
        deferHistory.push(request);
        if (enable_uat) {
            nHistoryItems++;
            request = $.ajax({ url: 'chunks/978.json',
                timeout: historyTimeout*800,
                cache: false,
                dataType: 'json' });
            deferHistory.push(request);
        }
    }

    if (HistoryChunks) {
        if (nHistoryItems > 0) {
            console.log("Starting to load history (" + nHistoryItems + " chunks)");
            console.time("Downloaded History");
            for (let i = chunkNames.length-1; i >= 0; i--) {
                get_history_item(i);
            }
        }
    } else if (nHistoryItems > 0) {
        console.log("Starting to load history (" + nHistoryItems + " items)");
        console.time("Downloaded History");
        // Queue up the history file downloads
        for (let i = nHistoryItems-1; i >= 0; i--) {
            get_history_item(i);
        }
    }
}

function get_history_item(i) {

    let request;

    if (HistoryChunks) {
        request = $.ajax({ url: 'chunks/' + chunkNames[i],
            timeout: historyTimeout * 1000,
            dataType: 'json'
        });
    } else {

        request = $.ajax({ url: 'data/history_' + i + '.json',
            timeout: nHistoryItems * 80, // Allow 40 ms load time per history entry
            cache: false,
            dataType: 'json' });
    }
    deferHistory.push(request);
}

const toggles = {};

function Toggle(arg) {
    this.key = arg.key;
    this.state = (arg.init ? true : false);
    this.setState = arg.setState;
    this.checkbox = (arg.checkbox == undefined) ? ('#' + this.key + '_cb') : null;
    this.display = arg.display;
    this.container = arg.container;
    this.button = arg.button || this.checkbox;

    toggles[this.key] = this;

    this.init();
}

Toggle.prototype.init = function() {
    if (this.container) {
        $(this.container).append((
            '<div class="settingsOptionContainer">'
            + '<div class="settingsCheckbox" id="' + this.key + '_cb' + '"></div>'
            + '<div class="settingsText">' + this.display + '</div>'
            + '</div>'));
    }

    if (this.button)
        $(this.button).on('click', this.toggle.bind(this));

    if (localStorage[this.key] == 'true')
        this.state = true;
    if (localStorage[this.key] == 'false')
        this.state = false

    this.toggle(this.state, true);
}

Toggle.prototype.toggle = function(override, init) {
    if (override == true)
        this.state = true;
    else if (override == false)
        this.state = false;
    else
        this.state = !this.state;

    if (this.setState) {
        if (this.setState(this.state) == false) {
            this.state = !this.state;
            return;
        }
    }

    if (this.checkbox) {
        if (this.state == false) {
            $(this.checkbox).removeClass('settingsCheckboxChecked');
        } else {
            $(this.checkbox).addClass('settingsCheckboxChecked');
        }
    }

    if (!init)
        localStorage[this.key] = this.state;
}

Toggle.prototype.restore = function () {
    if (this.setState)
        this.setState(this.state);
}

Toggle.prototype.hideCheckbox = function () {
    if (this.checkbox)
        $(this.checkbox).parent().hide();
}

// Set the name of the hidden property and the change event for visibility
let hidden, visibilityChange;
if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
  hidden = "hidden";
  visibilityChange = "visibilitychange";
} else if (typeof document.msHidden !== "undefined") {
  hidden = "msHidden";
  visibilityChange = "msvisibilitychange";
} else if (typeof document.webkitHidden !== "undefined") {
  hidden = "webkitHidden";
  visibilityChange = "webkitvisibilitychange";
}
let tabHidden = false;

function handleVisibilityChange() {
    const prevHidden = tabHidden;
    if (document[hidden])
        tabHidden = true;
    else
        tabHidden = false;

    // tab is no longer hidden
    if (!tabHidden && prevHidden) {
        refreshHighlighted();
        refreshSelected();
        active();
        checkMovement();
        triggerRefresh = 1;
        checkRefresh();

        if (showTrace)
            return;
        if (!globeIndex)
            return;
        if (heatmap)
            return;

        reaper();

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

// Warn if the browser doesn't support addEventListener or the Page Visibility API
if (typeof document.addEventListener === "undefined" || hidden === undefined) {
  console.log("hidden tab handler requires a browser that supports the Page Visibility API.");
} else {
  // Handle page visibility change
  document.addEventListener(visibilityChange, handleVisibilityChange, false);
}
