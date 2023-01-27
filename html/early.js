// This was functionality of script.js, moved it to here to start the downloading of track history earlier
"use strict";


// TAR1090 application object
let TAR;
TAR = (function (global, jQuery, TAR) {
    return TAR;
}(window, jQuery, TAR || {}));

// global object to store big stuff ... avoid clojur stupidity keeping the reference to big objects
let g = {};

let Dump1090Version = "unknown version";
let RefreshInterval = 1000;
let globeSimLoad = 6;
let adsbexchange = false;
let enable_uat = false;
let enable_pf_data = false;
let HistoryChunks = false;
let nHistoryItems = 0;
let HistoryItemsReturned = 0;
let chunkNames = [];
let PositionHistoryBuffer = [];
var	receiverJson;
let deferHistory = [];
let historyLoaded = jQuery.Deferred();
let configureReceiver = jQuery.Deferred();
let historyTimeout = 60;
let globeIndex = 0;
let globeIndexGrid = 0;
let globeIndexSpecialTiles;
let dynGlobeRate = false;
let binCraft = false;
let reApi = false;
let zstd = true; // init hasn't failed
let dbServer = false;
let l3harris = false;
let heatmap = false;
let heatLoaded = 0;
let heatmapDefer = jQuery.Deferred();
let heatChunks = [];
let heatPoints = [];
let replay = false;
let rData = [];
let StaleReceiverCount = 0;
let pTracks = false;
let pTracksInterval = 15;
let lastTraceGet = 0;
let traceRate = 0;
let tfrs = false;
let initialURL = window.location.href;
let milRanges = [];
let guessModeS = window.location.href.match(/devg/) ? true : false;
let calcOutlineData = null;

let uuid = null;
let uuidCache = [];

let inhibitFetch = false;
let zstdDecode = null;

let usp;
try {
    // let's make this case insensitive
    usp = {
        params: new URLSearchParams(),
        has: function(s) {return this.params.has(s.toLowerCase());},
        get: function(s) {return this.params.get(s.toLowerCase());},
        getFloat: function(s) {
            if (!this.params.has(s.toLowerCase())) return null;
            const param =  this.params.get(s.toLowerCase());
            if (!param) return null;
            const val = parseFloat(param);
            if (isNaN(val)) return null;
            return val;
        },
        getInt: function(s)  {
            if (!this.params.has(s.toLowerCase())) return null;
            const param =  this.params.get(s.toLowerCase());
            if (!param) return null;
            const val = parseInt(param, 10);
            if (isNaN(val)) return null;
            return val;
        }
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

var loStore;

// Fake localStorage implementation.
// Mimics localStorage, including events.
// It will work just like localStorage, except for the persistant storage part.

var fakeLocalStorage = function() {
  var fakeLocalStorage = {};
  var storage;
  // If Storage exists we modify it to write to our fakeLocalStorage object instead.
  // If Storage does not exist we create an empty object.
  loStore = {};
  storage = loStore;
  // For older IE
  if (!window.location.origin) {
    window.location.origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '');
  }
  var dispatchStorageEvent = function(key, newValue) {
    var oldValue = (key == null) ? null : storage.getItem(key); // `==` to match both null and undefined
    var url = location.href.substr(location.origin.length);
    var storageEvent = document.createEvent('StorageEvent'); // For IE, http://stackoverflow.com/a/25514935/1214183
    storageEvent.initStorageEvent('storage', false, false, key, oldValue, newValue, url, null);
    window.dispatchEvent(storageEvent);
  };
  storage.key = function(i) {
    var key = Object.keys(fakeLocalStorage)[i];
    return typeof key === 'string' ? key : null;
  };
  storage.getItem = function(key) {
    return typeof fakeLocalStorage[key] === 'string' ? fakeLocalStorage[key] : null;
  };
  storage.setItem = function(key, value) {
    dispatchStorageEvent(key, value);
    fakeLocalStorage[key] = String(value);
  };
  storage.removeItem = function(key) {
    dispatchStorageEvent(key, null);
    delete fakeLocalStorage[key];
  };
  storage.clear = function() {
    dispatchStorageEvent(null, null);
    fakeLocalStorage = {};
  };
};


if (window.location.href.match(/adsbexchange.com/) && window.location.pathname == '/') {
    adsbexchange = true;
}
if (0 && window.self != window.top) {
    fakeLocalStorage();
} else {
    try {
        loStore = window.localStorage;
        loStore.setItem('localStorageTest', 1);
        loStore.removeItem('localStorageTest');
    } catch (error) {

        fakeLocalStorage();
        /*
    const splat = "Your browser isn't supporting localStorage.\nSafari / Apple: turn off \"Block Cookies\"!";
    jQuery("#js_error").text(splat);
    jQuery("#js_error").css('display','block');
    throw 'FATAL, your browser does not support localStorage!';
    */
    }
}

let firstError = true;
if (usp.has('showerrors') || usp.has('jse')) {
    window.onerror = function (msg, url, lineNo, columnNo, error) {
        if (firstError) {
            firstError = false;
            let splat = '';
            splat += 'Uncaught JS Error:' + url + ' line ' + lineNo + '\n';
            splat += msg + '\n';
            if (error && error.stack)
                splat += '\n' + error.stack;
            jQuery("#js_error").text(splat);
            jQuery("#js_error").css('display','block');
        }
        return false;
    }
} else {
    window.onerror = function (msg, url, lineNo, columnNo, error) {
        return false;
    }
}

function resetSettings() {
    loStore.clear();
    if (window.history && window.history.replaceState) {
        window.history.replaceState("object or string", "Title", window.location.pathname);
        location.reload();
    }
}
if (usp.has('reset')) {
    resetSettings();
}

const feed = usp.get('feed');
if (feed != null) {
    console.log('feed: ' + feed);
    let split = feed.split(',');
    if (split.length > 0) {
        uuid = [];
        for (let i in split) {
            uuid.push(encodeURIComponent(split[i]));
        }
        if (uuid[0].length > 18) {
            console.log('redirecting the idiot, oui!');
            let URL = 'https://www.adsbexchange.com/api/feeders/tar1090/?feed=' + uuid[0];
            console.log(URL);
            //window.history.pushState(URL, "Title", URL);
            window.location.href = URL;
        }
    } else {
        console.error('uuid / feed fail!');
    }
}
if (usp.has('tfrs')) {
    tfrs = true;
}

let uk_advisory = false;
if (usp.has('uk_advisory')) {
    uk_advisory = true;
}

const customTiles = usp.get('customTiles');
if (customTiles)
    loStore['customTiles'] = customTiles;
if (customTiles == 'remove')
    loStore.removeItem('customTiles');

const bingKey = usp.get('BingMapsAPIKey');
if (bingKey)
    loStore['bingKey'] = bingKey;
if (bingKey == 'remove')
    loStore.removeItem('bingKey');

if (usp.has('l3harris') || usp.has('ift')) {
    l3harris = true;
}
if (usp.has('r') || usp.has('replay')) {
    replay = true;
}
function arraybufferRequest() {
    let xhrOverride = new XMLHttpRequest();
    xhrOverride.responseType = 'arraybuffer';
    return xhrOverride;
}

if (usp.has('heatmap') || usp.has('realHeat')) {

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
{
    let value;
    if ((value = usp.getFloat('pTracksInterval')) != null) {
        pTracksInterval = value;
    }
}
if (usp.has('pTracks')) {
    let tmp = parseFloat(usp.get('pTracks'))
    if (tmp > 0 && tmp < 9999)
        pTracks = tmp;
    else
        pTracks = 9999;
}

function getDay(date) {
    if ((utcTimesLive && !showTrace) || (utcTimesHistoric && showTrace))
        return date.getUTCDate();
    else
        return date.getDate();
}
function zuluTime(date) {
    return date.getUTCHours().toString().padStart(2,'0')
        + ":" + date.getUTCMinutes().toString().padStart(2,'0')
        + ":" + date.getUTCSeconds().toString().padStart(2,'0');
}
const TIMEZONE = new Date().toLocaleTimeString(undefined,{timeZoneName:'short'}).split(' ')[2];
function localTime(date) {
    return date.getHours().toString().padStart(2,'0')
        + ":" + date.getMinutes().toString().padStart(2,'0')
        + ":" + date.getSeconds().toString().padStart(2,'0');
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
const hostname = window.location.hostname;
if (uuid) {
    // don't need receiver / chunks json
} else if (0 || (adsbexchange && (hostname.startsWith('globe.') || hostname.startsWith('globe-')))) {
    console.log("Using adsbexchange fast-path load!");
    let data = {"zstd":true,"reapi":true,"refresh":1600,"history":1,"dbServer":true,"binCraft":true,"globeIndexGrid":3,"globeIndexSpecialTiles":[],"version":"adsbexchange backend"};
    get_receiver_defer = jQuery.Deferred().resolve(data);
    test_chunk_defer = jQuery.Deferred().reject();
} else {
    // get configuration json files, will be used in initialize function

    {get_receiver_defer = jQuery.ajax({
        url: 'data/receiver.json',
        cache: false,
        dataType: 'json',
        timeout: 10000,
    });}
    {test_chunk_defer = jQuery.ajax({
        url:'chunks/chunks.json',
        cache: false,
        dataType: 'json',
        timeout: 4000,
    });}
}

{jQuery.getJSON(databaseFolder + "/ranges.js").done(function(ranges) {
    if (!ranges || !ranges.military) {
        console.error("couldn't load milRanges.");
        return;
    }
    for (let i in ranges.military) {
        const r = ranges.military[i];
        const a = +("0x" + r[0]);
        const b = +("0x" + r[1]);
        if (isNaN(a) || isNaN(b))
            continue;
        milRanges.push([a, b]);
    }
});}


let heatmapLoadingState = {};
function loadHeatChunk() {
    if (heatmapLoadingState.index > heatChunks.length) {
        heatmapDefer.resolve();
        return; // done, stop recursing
    }


    let time = new Date(heatmapLoadingState.start + heatmapLoadingState.index * heatmapLoadingState.interval);
    let sDate = sDateString(time);
    let index = 2 * time.getUTCHours() + Math.floor(time.getUTCMinutes() / 30);

    let base = "globe_history/";

    let URL = base + sDate + "/heatmap/" +
        index.toString().padStart(2, '0') + ".bin.ttf";
    let req = jQuery.ajax({
        url: URL,
        method: 'GET',
        num: heatmapLoadingState.index,
        xhr: arraybufferRequest,
    });
    {req.done(function (responseData) {
        heatChunks[this.num] = responseData;
        loadHeatChunk();
    });}
    {req.fail(function(jqxhr, status, error) {
        loadHeatChunk();
    });}
    heatmapLoadingState.index++;
}

if (!heatmap) {
    heatmapDefer.resolve();
} else {
    let end = heatmap.end;
    let start = end - heatmap.duration * 3600 * 1000; // timestamp in ms
    let interval = 1800 * 1000;
    let numChunks = Math.round((end - start) / interval);
    console.log('numChunks: ' + numChunks + ' heatDuration: ' + heatmap.duration + ' heatEnd: ' + new Date(heatmap.end));
    heatChunks = Array(numChunks).fill(null);
    heatPoints = Array(numChunks).fill(null);
    // load chunks sequentially via recursion:
    heatmapLoadingState.index = 0;
    heatmapLoadingState.interval = interval;
    heatmapLoadingState.start = start;
    // 2 async chains of heat chunk loading:
    loadHeatChunk();
    loadHeatChunk();
}

init_zstddec();

function historyQueued() {
    if (!globeIndex && !uuid) {
        let request = jQuery.ajax({ url: 'upintheair.json',
            cache: true,
            dataType: 'json' });
        request.done(function(data) {
            calcOutlineData = data;
        });
        request.always(function() {
            configureReceiver.resolve();
        });
    } else {
        configureReceiver.resolve();
    }
}

if (uuid != null) {
    receiverJson = null;
    Dump1090Version = 'unknown';
    RefreshInterval = 5000;
    configureReceiver.resolve();
    //console.time("Downloaded History");
    zstd = false;
} else {
    get_receiver_defer.fail(function(data){

        setTimeout(function() {
            jQuery("#loader").addClass("hidden");
            jQuery("#update_error_detail").text("似乎解码器/接收器/后端工作不正常！");
            jQuery("#update_error").css('display','block');
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
        binCraft = data.binCraft ? true : false || data.aircraft_binCraft ? true : false;
        zstd = zstd && data.zstd; // check if it already failed, leave it off then
        reApi = data.reapi ? true : false;
        if (usp.has('noglobe') || usp.has('ptracks')) {
            data.globeIndexGrid = null; // disable globe on user request
        }
        dbServer = (data.dbServer) ? true : false;

        if (heatmap || replay) {
            if (replay && data.globeIndexGrid != null)
                globeIndex = 1;
            HistoryChunks = false;
            nHistoryItems = 0;
            get_history();
            historyQueued();
        } else if (data.globeIndexGrid != null) {
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
            historyQueued();
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
                historyQueued();
            }).fail(function() {
                HistoryChunks = false;
                get_history();
                historyQueued();
            });
        }
    });
}

function get_history() {

    if (nHistoryItems > 0) {
        nHistoryItems++;
        let request = jQuery.ajax({ url: 'data/aircraft.json',
            timeout: historyTimeout*800,
            cache: false,
            dataType: 'json' });
        deferHistory.push(request);
        if (enable_uat) {
            nHistoryItems++;
            request = jQuery.ajax({ url: 'chunks/978.json',
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
        request = jQuery.ajax({ url: 'chunks/' + chunkNames[i],
            timeout: historyTimeout * 1000,
            dataType: 'json'
        });
    } else {

        request = jQuery.ajax({ url: 'data/history_' + i + '.json',
            timeout: nHistoryItems * 80, // Allow 40 ms load time per history entry
            cache: false,
            dataType: 'json' });
    }
    deferHistory.push(request);
}

function getCookie(cname) {
  let name = cname + "=";
  let ca = decodeURIComponent(document.cookie).split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') { c = c.substring(1); }
    if (c.indexOf(name) == 0) { return c.substring(name.length, c.length); }
  }
  return "";
}

function setCookie(cname, cvalue, exdays) {
    let d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    let expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}


function globeRateUpdate() {
    if (adsbexchange) {
        dynGlobeRate = true;
        const cookieExp = getCookie('adsbx_sid').split('_')[0];
        const ts = new Date().getTime();
        if (!cookieExp || cookieExp < ts + 3600*1000)
            setCookie('adsbx_sid', ((ts + 2*86400*1000) + '_' + Math.random().toString(36).substring(2, 15)), 2);
    }
    if (dynGlobeRate) {
        return jQuery.ajax({url:'/globeRates.json', cache: false, dataType: 'json', }).done(function(data) {
            if (data.simload != null)
                globeSimLoad = data.simload;
            if (data.refresh != null && globeIndex)
                RefreshInterval = data.refresh;
        });
    } else {
        return jQuery.Deferred().resolve();
    }
}
globeRateUpdate();

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
        jQuery(this.container).append((
            '<div class="settingsOptionContainer">'
            + '<div class="settingsCheckbox" id="' + this.key + '_cb' + '"></div>'
            + '<div class="settingsText">' + this.display + '</div>'
            + '</div>'));
    }

    if (this.button) {
        jQuery(this.button).on('click', () => {this.toggle()});
    }

    if (loStore[this.key] == 'true')
        this.state = true;
    if (loStore[this.key] == 'false')
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
            jQuery(this.checkbox).removeClass('settingsCheckboxChecked');
        } else {
            jQuery(this.checkbox).addClass('settingsCheckboxChecked');
        }
    }

    if (!init)
        loStore[this.key] = this.state;
}

Toggle.prototype.restore = function () {
    if (this.setState)
        this.setState(this.state);
}

Toggle.prototype.hideCheckbox = function () {
    if (this.checkbox)
        jQuery(this.checkbox).parent().hide();
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
if (!Object.keys) {
  Object.keys = (function() {
    'use strict';
    var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
        dontEnums = [
          'toString',
          'toLocaleString',
          'valueOf',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'constructor'
        ],
        dontEnumsLength = dontEnums.length;

    return function(obj) {
      if (typeof obj !== 'function' && (typeof obj !== 'object' || obj === null)) {
        throw new TypeError('Object.keys called on non-object');
      }

      var result = [], prop, i;

      for (prop in obj) {
        if (hasOwnProperty.call(obj, prop)) {
          result.push(prop);
        }
      }

      if (hasDontEnumBug) {
        for (i = 0; i < dontEnumsLength; i++) {
          if (hasOwnProperty.call(obj, dontEnums[i])) {
            result.push(dontEnums[i]);
          }
        }
      }
      return result;
    };
  }());
}

if (!Object.entries) {
  Object.entries = function( obj ){
    var ownProps = Object.keys( obj ),
        i = ownProps.length,
        resArray = new Array(i); // preallocate the Array
    while (i--)
      resArray[i] = [ownProps[i], obj[ownProps[i]]];

    return resArray;
  };
}

let custom_layers = new ol.Collection();
function add_kml_overlay(url, name, opacity) {
    custom_layers.push(new ol.layer.Vector({
        source: new ol.source.Vector({
            url: url,
            format: new ol.format.KML(),
        }),
        name: name,
        title: 'custom_' + name,
        type: 'overlay',
        opacity: opacity,
        visible: true,
        zIndex: 99,
    }));
}


function webAssemblyFail(e) {
    zstdDecode = null;
    zstd = false;
    binCraft = false;
    if (adsbexchange && !uuid) {
        inhibitFetch = true;
        reApi = false;
        jQuery("#generic_error_detail").text("Your browser is not supporting webassembly, this website does not work without webassembly.");
        jQuery("#generic_error").css('display','block');
    }
    if (e) {
        console.log(e);
    }
    console.error("Error loading zstddec, probable cause: webassembly not present or not working");
}

function init_zstddec() {
    try {
        zstddec.decoder = new zstddec.ZSTDDecoder();
        zstddec.promise = zstddec.decoder.init();
        zstdDecode = zstddec.decoder.decode;
    } catch (e) {
        webAssemblyFail(e);
    }
}


let onMobile = (
    () => {
    let a = (navigator.userAgent||navigator.vendor||window.opera);
    if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) {
        return true;
    } else {
        return false;
    }
}
)();
