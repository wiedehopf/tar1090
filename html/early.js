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

let databaseFolder = "db2";

let uuid = null;

try {
    const search = new URLSearchParams(window.location.search);

    const feed = search.get('feed');
    if (feed != null) {
        uuid = feed;
        console.log('uuid: ' + uuid);
    }

    const customTiles = search.get('customTiles');
    if (customTiles)
        localStorage['customTiles'] = customTiles;
    if (customTiles == 'remove')
        localStorage.removeItem('customTiles');

} catch (error) {
}

// get configuration json files, will be used in initialize function
let get_receiver_defer = $.ajax({ url: 'data/receiver.json',
    cache: false,
    dataType: 'json'
});
let test_chunk_defer = $.ajax({
    url:'chunks/chunks.json',
    cache: false,
    dataType: 'json'
});

if (uuid != null) {
    get_receiver_defer = null;
    receiverJson = null;
    Dump1090Version = 'unknown';
    RefreshInterval = 5000;
    configureReceiver.resolve();
    console.time("Downloaded History");
} else {
    $.when(get_receiver_defer).done(function(data){
        get_receiver_defer = null;
        receiverJson = data;
        Dump1090Version = data.version;
        RefreshInterval = data.refresh;
        nHistoryItems = (data.history < 2) ? 0 : data.history;
        if (data.globeIndexGrid != null) {
                HistoryChunks = false;
                nHistoryItems = 0;
                globeIndex = 1;
                get_history();
                configureReceiver.resolve();
        } else {
            $.when(test_chunk_defer).done(function(data) {
                HistoryChunks = true;
                chunkNames = data.chunks;
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

    if (!receiverJson.globeIndexGrid) {
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
