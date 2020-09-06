// This was functionality of script.js, moved it to here to start the downloading of track history earlier
"use strict";
let Dump1090Version = "unknown version";
let RefreshInterval = 1000;
let enable_uat = false;
let enable_pf_data = false;
let HistoryChunks = false;
let nHistoryItems = 0;
let HistoryItemsReturned = 0;
let chunkNames;
let PositionHistoryBuffer = [];
var	receiverJson;
let deferHistory = [];
let configureReceiver = $.Deferred();
let historyTimeout = 60;
let globeIndex = 0;
let regCache = {};
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

let databaseFolder = "db2";

let uuid = null;

try {
    const search = new URLSearchParams(window.location.search);

    const feed = search.get('feed');
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

    const customTiles = search.get('customTiles');
    if (customTiles)
        localStorage['customTiles'] = customTiles;
    if (customTiles == 'remove')
        localStorage.removeItem('customTiles');

    const bingKey = search.get('BingMapsAPIKey');
    if (bingKey)
        localStorage['bingKey'] = bingKey;
    if (bingKey == 'remove')
        localStorage.removeItem('bingKey');

    if (search.has('L3Harris') || search.has('l3harris'))
        l3harris = true;

    if (search.has('heatmap') || search.has('replay')) {

        heatmap = {};

        heatmap.max = 16000;
        heatmap.init = true;
        heatmap.duration = 24;
        heatmap.end = (new Date()).getTime();

        if (search.has('replay')) {
            replay = {
                ival: 60 * 1000,
                speed: 5,
            };
        }

        let tmp = parseFloat(search.get('heatDuration'));
        if (!isNaN(tmp))
            heatmap.duration = tmp;
        if (heatmap.duration < 0.5)
            heatmap.duration = 0.5;
        tmp = parseFloat(search.get('heatEnd'));
        if (!isNaN(tmp))
            heatmap.end -= tmp * 3600 * 1000;
        if (search.has('heatLines'))
            heatmap.lines = true;
        tmp = parseFloat(search.get('heatAlpha'));
        if (!isNaN(tmp)) {
            heatmap.alpha = tmp;
            console.log('heatmap.alpha = ' + tmp);
        }
        heatmap.radius = 2.5;
        if (search.has('realHeat')) {
            heatmap.max = 50000;
            heatmap.real = true;
            heatmap.radius = 1.5;
            heatmap.blur = 4;
            heatmap.weight = 0.25;

            tmp = parseFloat(search.get('heatBlur'));
            if (!isNaN(tmp))
                heatmap.blur = tmp;

            tmp = parseFloat(search.get('heatWeight'));
            if (!isNaN(tmp))
                heatmap.weight = tmp;
        }
        tmp = parseFloat(search.get('heatRadius'));
        if (!isNaN(tmp))
            heatmap.radius = tmp;
        let val;
        if (val = parseInt(search.get('heatmap'), 10))
            heatmap.max = val;

    }

    if (search.has('pTracks')) {
        pTracks = true;
    }

} catch (error) {
    console.log(error);
}

function zDateString(date) {
    let string = date.getUTCFullYear() + '-'
        + (date.getUTCMonth() + 1).toString().padStart(2, '0') + '-'
        + date.getUTCDate().toString().padStart(2, '0')
    return string;
}

function lDateString(date) {
    let string = date.getFullYear() + '-'
        + (date.getMonth() + 1).toString().padStart(2, '0') + '-'
        + date.getDate().toString().padStart(2, '0')
    return string;
}

// get configuration json files, will be used in initialize function
let get_receiver_defer = $.ajax({ url: 'data/receiver.json',
    cache: false,
    dataType: 'json',
    timeout: 5000,
});
let test_chunk_defer = $.ajax({
    url:'chunks/chunks.json',
    cache: false,
    dataType: 'json',
    timeout: 4000,
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
        var xhrOverride = new XMLHttpRequest();
        xhrOverride.responseType = 'arraybuffer';

        let time = new Date(start + i * interval);
        let zDate = zDateString(time);
        let index = 2 * time.getUTCHours() + Math.floor(time.getUTCMinutes() / 30);

        let base = "globe_history/";

        let URL = base + zDate + "/heatmap/" +
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
    get_receiver_defer = null;
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
        get_receiver_defer = null;
        receiverJson = data;
        Dump1090Version = data.version;
        RefreshInterval = data.refresh;
        nHistoryItems = (data.history < 2) ? 0 : data.history;
        if (data.globeIndexGrid != null || heatmap) {
                HistoryChunks = false;
                nHistoryItems = 0;
                globeIndex = 1;
                get_history();
                configureReceiver.resolve();
        } else {
            $.when(test_chunk_defer).done(function(data) {
                HistoryChunks = true;
                chunkNames = pTracks ? data.chunks_all : data.chunks;
                nHistoryItems = chunkNames.length;
                enable_uat = (data.enable_uat == "true");
                enable_pf_data = (data.pf_data == "true");
                if (enable_uat)
                    console.log("UAT/978 enabled!");
                console.log("Chunks enabled");
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

function Toggle(key, defaultState, doStuff) {
    this.key = key;
    this.state = defaultState;
    this.doStuff = doStuff;
    this.checkbox = '#' + key + '_cb';
    this.init();
}

Toggle.prototype.init = function() {
    if (this.checkbox) {
        $(this.checkbox).on('click', function() {
            this.toggle();
        }.bind(this));
    }

    if (localStorage[this.key] == null) {
        if (this.state)
            $(this.checkbox).addClass('settingsCheckboxChecked');
        else
            $(this.checkbox).removeClass('settingsCheckboxChecked');
        return;
    }
    if (localStorage[this.key] == "false")
        this.toggle(false);
    if (localStorage[this.key] == "true")
        this.toggle(true);
}

Toggle.prototype.toggle = function(override) {
    if (override == true)
        this.state = true;
    else if (override == false)
        this.state = false;
    else
        this.state = !this.state;

    if (this.state == false) {
        localStorage[this.key] = "false";
        $(this.checkbox).removeClass('settingsCheckboxChecked');
    }
    if (this.state == true) {
        localStorage[this.key] = "true";
        $(this.checkbox).addClass('settingsCheckboxChecked');
    }

    if (this.doStuff)
        this.doStuff(this.state);
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

function handleVisibilityChange() {
    if (!globeIndex)
        return;
    if (heatmap)
        return;
    if (!document[hidden]) {
        fetchData();
        if (showTrace)
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

// Warn if the browser doesn't support addEventListener or the Page Visibility API
if (typeof document.addEventListener === "undefined" || hidden === undefined) {
  console.log("hidden tab handler requires a browser that supports the Page Visibility API.");
} else {
  // Handle page visibility change
  document.addEventListener(visibilityChange, handleVisibilityChange, false);
}
