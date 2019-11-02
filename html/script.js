// Some global variables are defined in early.js
// early.js takes care of getting some history files while the html page and
// some javascript libraries are still loading, hopefully speeding up loading

"use strict";

// Define our global variables
var OLMap         = null;
var StaticFeatures = new ol.Collection();
var SiteCircleFeatures = new ol.Collection();
var PlaneIconFeatures = new ol.Collection();
var trailGroup = new ol.Collection();
var iconLayer;
var trailLayers;
var iconCache = {};
var addToIconCache = [];
var lineStyleCache = {};
var Planes        = {};
var PlanesOrdered = [];
var PlaneFilter   = {};
var SelectedPlane = null;
var SelectedAllPlanes = false;
var HighlightedPlane = null;
var FollowSelected = false;
var infoBoxOriginalPosition = {};
var customAltitudeColors = true;
var loadtime = "loadtime";
var loadFinished = false;
var mapResizeTimeout;
var refresh;
var scaleFactor;
var debugTracks = false;
var debugAll = false;
var trackLabels = false;
var fragment;
var grouptype_checkbox;
var multiSelect = false;
var uat_data = null;
var enableLabels = false;
var extendedLabels = false;
var mapIsVisible = true;
var columnVis = Array(30).fill(true);
var emptyStyle = new ol.style.Style({});
var show_squawk_warning_cache = false;
var tableInView = false;
var historyOutdated = false;
var onlyMLAT = false;
var onlyADSB = false;
var onlySelected = false;
var fetchingPf = false;
var reaping = false;
var debug = false;
var debugJump = false;
var jumpTo = null;
var noMLAT = false;
var noVanish = false;
var sidebarVisible = true;
var filterTracks = false;

var SpecialSquawks = {
	'7500' : { cssClass: 'squawk7500', markerColor: 'rgb(255, 85, 85)', text: 'Aircraft Hijacking' },
	'7600' : { cssClass: 'squawk7600', markerColor: 'rgb(0, 255, 255)', text: 'Radio Failure' },
	'7700' : { cssClass: 'squawk7700', markerColor: 'rgb(255, 255, 0)', text: 'General Emergency' }
};

// Get current map settings
var CenterLat, CenterLon, ZoomLvl, ZoomLvlCache, MapType_tar1090;
var zoomTimeout;


var PlaneRowTemplate = null;

var TrackedAircraft = 0;
var TrackedAircraftPositions = 0;
var TrackedHistorySize = 0;

var SitePosition = null;

// timestamps
var now=0, last=0, uat_now=0, uat_last=0;
var StaleReceiverCount = 0;
var FetchPending = null;
var FetchPendingUAT = null;

var MessageCountHistory = [];
var MessageRate = 0;

var NBSP='\u00a0';

var layers;
var layers_group;

// piaware vs flightfeeder
var isFlightFeeder = false;



function processReceiverUpdate(data, init) {


	// update now and last
	var uat = false;
	if (data.uat_978 == "true") {
		uat = true;
		uat_last = uat_now;
		uat_now = data.now;
	} else {
		last = now;
		now = data.now;
	}

	// Loop through all the planes in the data packet
	var acs = data.aircraft;

	if (!uat && !init) {
		// Detect stats reset
		if (MessageCountHistory.length > 0 && MessageCountHistory[MessageCountHistory.length-1].messages > data.messages) {
			MessageCountHistory = [{'time' : MessageCountHistory[MessageCountHistory.length-1].time,
				'messages' : 0}];
		}

		// Note the message count in the history
		MessageCountHistory.push({ 'time' : now, 'messages' : data.messages});
		// .. and clean up any old values
		if ((now - MessageCountHistory[0].time) > 30)
			MessageCountHistory.shift();

		if (MessageCountHistory.length > 1) {
			var message_time_delta = MessageCountHistory[MessageCountHistory.length-1].time - MessageCountHistory[0].time;
			var message_count_delta = MessageCountHistory[MessageCountHistory.length-1].messages - MessageCountHistory[0].messages;
			if (message_time_delta > 0)
				MessageRate = message_count_delta / message_time_delta;
		} else {
			MessageRate = null;
		}
	}

	for (var j=0; j < acs.length; j++) {
		var ac = acs[j];
		var isArray = Array.isArray(ac);
		var hex = isArray ? ac[0] : ac.hex;
		var plane = null;

		// Do we already have this plane object in Planes?
		// If not make it.

		/*
		if ( ac.messages < 2) {
			continue;
		}
		*/

		plane = Planes[hex];

		if (uatNoTISB && !init && uat && ac.type && ac.type.substring(0,4) == "tisb") {
			// drop non ADS-B planes from UAT (TIS-B)
			continue;
		}

		if (!plane) {
			plane = new PlaneObject(hex);
			plane.filter = PlaneFilter;

			if (!init)
				setupPlane(hex,plane);

			Planes[hex] = plane;
			PlanesOrdered.push(plane);
			if (uat) {
				plane.receiver = "uat";
			} else {
				plane.receiver = "1090";
			}
		}

		// Call the function update
		if (uat) {
			if (plane.receiver == "uat" || ac.seen_pos < 1.8 || init) {
				plane.receiver = "uat";
				plane.updateData(uat_now, uat_last, ac, init);
			}
		} else {
			if (plane.receiver == "1090" || ac.seen_pos < 1.8 || init) {
				plane.receiver = "1090";
				plane.updateData(now, last, ac, init);
			}
		}
	}
}

function setupPlane(hex, plane) {

	plane.tr = PlaneRowTemplate.cloneNode(true);

	if (hex[0] === '~') {
		// Non-ICAO address
		plane.tr.cells[0].textContent = hex.substring(1);
		$(plane.tr).css('font-style', 'italic');
	} else {
		plane.tr.cells[0].textContent = hex;
	}

	// set flag image if available
	if (ShowFlags && plane.icaorange.flag_image !== null) {
		$('img', plane.tr.cells[1]).attr('src', FlagPath + plane.icaorange.flag_image);
		$('img', plane.tr.cells[1]).attr('title', plane.icaorange.country);
	} else {
		$('img', plane.tr.cells[1]).css('display', 'none');
	}

	plane.clickListener = function(h, evt) {
		if (evt.srcElement instanceof HTMLAnchorElement) {
			evt.stopPropagation();
			return;
		}

		if(!mapIsVisible) {
			selectPlaneByHex(h, true);
			showMap();
		} else {
			selectPlaneByHex(h, false);
		}
		adjustSelectedInfoBlockPosition();
		evt.preventDefault();
	}.bind(undefined, hex);

	plane.dblclickListener = function(h, evt) {
		if (!$("#map_container").is(":visible")) {
			showMap();
		}
		selectPlaneByHex(h, true);
		adjustSelectedInfoBlockPosition();
		evt.preventDefault();
	}.bind(undefined, hex);

	plane.tr.addEventListener('click', plane.clickListener);
	plane.tr.addEventListener('dblclick', plane.dblclickListener);
}

function fetchData() {
	if (FetchPending != null) {
		// don't double up on fetches, let the last one resolve
		return;
	}
	if (FetchPendingUAT != null) {
		// don't double up on fetches, let the last one resolve
		return;
	}
	FetchPending = true;
	var center = ol.proj.toLonLat(OLMap.getView().getCenter(), OLMap.getView().getProjection());
	localStorage['CenterLon'] = CenterLon = center[0];
	localStorage['CenterLat'] = CenterLat = center[1];

	var item;
	var tryAgain = [];
	while(item = addToIconCache.pop()) {
		var svgKey = item[0];
		var element = item[1];
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
	if (enable_uat) {
		FetchPendingUAT = $.ajax({ url: 'chunks/978.json',
			timeout: 7000,
			cache: false,
			dataType: 'json' });

		FetchPendingUAT.done(function(data) {
			uat_data = data;
			FetchPendingUAT = null;
		});
		FetchPendingUAT.fail(function(jqxhr, status, error) {
			FetchPendingUAT = null;
		});
	}
	FetchPending = $.ajax({ url: 'data/aircraft.json',
		timeout: 8000,
		cache: false,
		dataType: 'json' });
	FetchPending.done(function(data) {
		if (data == null) {
			FetchPending = null;
			return;
		}

		// experimental stuff
		/*
		var browserNow = (new Date()).getTime();
		var diff = browserNow -  now*1000;
		var delay = RefreshInterval;

		if (diff > -100)
			delay = Math.max(RefreshInterval*1.3 - diff,100);

		window.setTimeout(fetchData, delay);

		if ((now-last)*1000 >  1.5* RefreshInterval || (now-last)*1000 < 0.5 * RefreshInterval)
			console.log("We missed a beat: aircraft.json");
		console.log(((now-last)*1000).toFixed(0) + " " + diff +" "+ delay + "                  "+now);
		*/

		if (data.now > now) {
			processReceiverUpdate(data);
		}
		if (uat_data && uat_data.now > uat_now) {
			processReceiverUpdate(uat_data);
			uat_data = null;
		}

		// update timestamps, visibility, history track for all planes - not only those updated
		for (var i = 0; i < PlanesOrdered.length; ++i) {
			var plane = PlanesOrdered[i];
			if (plane.receiver == "uat" && uat_now)
				plane.updateTick(uat_now, uat_last);
			else
				plane.updateTick(now, last);
		}
		selectNewPlanes();


		refreshSelected();
		refreshHighlighted();
		refreshTableInfo();
		refreshClock(new Date(now * 1000));

		// Check for stale receiver data
		if (last == now) {
			StaleReceiverCount++;
			if (StaleReceiverCount > 5) {
				$("#update_error_detail").text("The data from dump1090 hasn't been updated in a while. Maybe dump1090 is no longer running?");
				$("#update_error").css('display','block');
			}
		} else if (StaleReceiverCount > 0){
			StaleReceiverCount = 0;
			$("#update_error").css('display','none');
		}

		FetchPending = null;
	});

	FetchPending.fail(function(jqxhr, status, error) {
		$("#update_error_detail").text("AJAX call failed (" + status + (error ? (": " + error) : "") + "). Maybe dump1090 is no longer running?");
		$("#update_error").css('display','block');
		StaleReceiverCount++;
		fetchData();
		FetchPending = null;
	});
}



// this function is called from index.html on body load
// kicks off the whole rabbit hole
function initialize() {

	mapOrientation *= (Math.PI/180); // adjust to radians

	if (localStorage['enableLabels'] == 'true'){
		enableLabels = true;
	}
	if (localStorage['extendedLabels'] == 'true'){
		extendedLabels = true;
	}
	if (localStorage['trackLabels'] == "true") {
		trackLabels = true;
	}
	if (localStorage['tableInView'] == "true") {
		tableInView = true;
		toggleTableInView("noToggle")
	}
	if (localStorage['debug'] == "true")
		debug = true;
	if (localStorage['debugPosFilter'] == "true")
		debugPosFilter = true;
	if (localStorage['noMLAT'] == "true") {
		noMLAT = true;
		//localStorage['noMLAT'] = "false";
	}

	if (localStorage['noVanish'] == "true") {
		noVanish = true;
		filterTracks = noVanish;
		//localStorage['noVanish'] = "false";
	}

	$.when(configureReceiver).done(function() {
		configureReceiver = null;

		// Initialize stuff
		init_page();

		// Wait for history item downloads and append them to the buffer
		push_history();
		// this will be needed later
		$.getJSON("db/aircraft_types/icao_aircraft_types.json")
			.done(function(typeLookupData) {
				_aircraft_type_cache = typeLookupData;
			})
	});

}

function init_page() {
	// Set page basics
	document.title = PageName;

	//flightFeederCheck();

	PlaneRowTemplate = document.getElementById("plane_row_template");

	$('#clock_div').text(new Date().toLocaleString());


	$("#loader").removeClass("hidden");

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

	if (localStorage['sidebar_width'] != null)
		$('#sidebar_container').width(localStorage['sidebar_width']);
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

	$('#close-button').on('click', function() {
		if (SelectedPlane) {
			SelectedPlane.selected = null;
			SelectedPlane.clearLines();
			SelectedPlane.updateMarker();
			SelectedPlane = null;
			refreshSelected();
			refreshHighlighted();
			$('#selected_infoblock').hide();
			setSelectedInfoBlockVisibility();
		}
	});

	/*
	// this is a little hacky, but the best, most consitent way of doing this. change the margin bottom of the table container to the height of the overlay
	$('#selected_infoblock').on('resize', function() {
		$('#sidebar_canvas').css('margin-bottom', $('#selected_infoblock').height() + 'px');
	});
	// look at the window resize to resize the pop-up infoblock so it doesn't float off the bottom or go off the top
	$(window).on('resize', function() {
		var topCalc = ($(window).height() - $('#selected_infoblock').height() - 25);
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
	$("#show_map_button").click(showMap);

	// Set initial element visibility
	$("#show_map_button").hide();
	setColumnVisibility();

	// Initialize other controls
	initializeUnitsSelector();

	// Set up altitude filter button event handlers and validation options
	$("#altitude_filter_form").submit(onFilterByAltitude);

	$("#search_form").submit(onSearch);

	// check if the altitude color values are default to enable the altitude filter
	if (ColorByAlt.air.h.length === 3 && ColorByAlt.air.h[0].alt === 2000 && ColorByAlt.air.h[0].val === 20 && ColorByAlt.air.h[1].alt === 10000 && ColorByAlt.air.h[1].val === 140 && ColorByAlt.air.h[2].alt === 40000 && ColorByAlt.air.h[2].val === 300) {
		customAltitudeColors = false;
	}


	$("#altitude_filter_reset_button").click(onResetAltitudeFilter);

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
		mapResizeTimeout = setTimeout(updateMapSize, 10);
	});

	filterGroundVehicles(false);
	filterBlockedMLAT(false);
	//toggleAltitudeChart(false);

}



function push_history() {
	$("#loader_progress").attr('max',nHistoryItems*2);
	for (var i = 0; i < nHistoryItems; i++) {
		push_history_item(i);
	}
	if (!nHistoryItems) {
		parse_history();
		console.log("History loading failed");
	}
}

function push_history_item(i) {

	$.when(deferHistory[i])
		.done(function(json) {

			if (HistoryChunks) {
				if (json && json.files) {
					for (var i in json.files) {
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
	console.timeEnd("Downloaded History");

	console.time("Loaded aircraft tracks from History");
	$("#loader").addClass("hidden");

	for (i in deferHistory)
		deferHistory[i] = null;

	initialize_map();

	if (PositionHistoryBuffer.length > 0) {

		// Sort history by timestamp
		console.log("Sorting history: " + PositionHistoryBuffer.length);
		PositionHistoryBuffer.sort(function(x,y) { return (y.now - x.now); });

		// Process history
		var data;
		var h = 0;
		var pruneInt = Math.floor(PositionHistoryBuffer.length/5);
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
				for (var i = 0; i < PlanesOrdered.length; ++i) {
					var plane = PlanesOrdered[i];
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
		for (var i in PlanesOrdered) {
			var plane = PlanesOrdered[i];

			if (plane.position && SitePosition)
				plane.sitedist = ol.sphere.getDistance(SitePosition, plane.position);

			if (uatNoTISB && plane.receiver == "uat" && plane.type && plane.type.substring(0,4) == "tisb") {
				plane.last_message_time -= 999;
			}

			if (plane.dataSource == "uat")
				plane.updateTick(uat_now, uat_last, true);
			else
				plane.updateTick(now, last, true);
		}


		for (var i in PlanesOrdered)
			setupPlane(PlanesOrdered[i].icao,PlanesOrdered[i]);
	}

	PositionHistoryBuffer = null;
	console.timeEnd("Loaded aircraft tracks from History");

	console.log("Completing init");

	refreshTableInfo();
	refreshSelected();
	refreshHighlighted();

	// Setup our timer to poll from the server.
	window.setInterval(fetchData, RefreshInterval);
	window.setInterval(reaper, 60000);
	if (enable_pf_data) {
		window.setInterval(fetchPfData, RefreshInterval*10.314);
	}
	//window.setInterval(refreshTableInfo, 1000);

	// And kick off one refresh immediately.
	fetchData();

	updateMapSize();

	loadFinished = true;
	processURLParams();


	if (localStorage['sidebar_visible'] == "false")
		toggleSidebarVisibility();
}

// Make a LineString with 'points'-number points
// that is a closed circle on the sphere such that the
// great circle distance from 'center' to each point is
// 'radius' meters
function make_geodesic_circle(center, radius, points) {
	var angularDistance = radius / 6378137.0;
	var lon1 = center[0] * Math.PI / 180.0;
	var lat1 = center[1] * Math.PI / 180.0;
	var geom;
	for (var i = 0; i <= points; ++i) {
		var bearing = i * 2 * Math.PI / points;

		var lat2 = Math.asin( Math.sin(lat1)*Math.cos(angularDistance) +
			Math.cos(lat1)*Math.sin(angularDistance)*Math.cos(bearing) );
		var lon2 = lon1 + Math.atan2(Math.sin(bearing)*Math.sin(angularDistance)*Math.cos(lat1),
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

// Initalizes the map and starts up our timers to call various functions
function initialize_map() {
	if (receiverJson && receiverJson.lat != null) {
		SiteShow = true;
		SiteLat = receiverJson.lat;
		SiteLon = receiverJson.lon;
		DefaultCenterLat = receiverJson.lat;
		DefaultCenterLon = receiverJson.lon;
	}
	// Load stored map settings if present
	CenterLon = Number(localStorage['CenterLon']) || DefaultCenterLon;
	CenterLat = Number(localStorage['CenterLat']) || DefaultCenterLat;
	ZoomLvl = Number(localStorage['ZoomLvl']) || DefaultZoomLvl;
	ZoomLvlCache = ZoomLvl;
	MapType_tar1090 = localStorage['MapType_tar1090'];
	if (!MapType_tar1090)
		MapType_tar1090="carto_light_all";

	// Set SitePosition, initialize sorting
	if (SiteShow && (typeof SiteLat !==  'undefined') && (typeof SiteLon !==  'undefined')) {
		SitePosition = [SiteLon, SiteLat];
		sortByDistance();
	} else {
		SitePosition = null;
		PlaneRowTemplate.cells[9].style.display = 'none'; // hide distance column
		document.getElementById("distance").style.display = 'none'; // hide distance header
		sortByAltitude();
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
		source: new ol.source.Vector({
			features: PlaneIconFeatures,
		}),
	});

	layers.push(
		new ol.layer.Vector({
			name: 'site_pos',
			type: 'overlay',
			title: 'Site position and range rings',
			source: new ol.source.Vector({
				features: StaticFeatures,
			})
		}));

	trailLayers = new ol.layer.Group({
		name: 'ac_trail',
		title: 'Aircraft trails',
		type: 'overlay',
		layers: trailGroup,
	});

	layers.push(trailLayers);

	layers.push(iconLayer);

	var foundType = false;
	var baseCount = 0;

	const dummyLayer = new ol.layer.Vector({
		name: 'dummy',
		source: new ol.source.Vector({
			features: new ol.Collection(),
		}),
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
			var visible = localStorage['layer_' + lyr.get('name')];
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
		}),
		controls: [new ol.control.Zoom({delta: 1,}),
			new ol.control.Rotate(),
			new ol.control.Attribution({collapsed: true}),
			new ol.control.ScaleLine({units: DisplayUnits})
		],
		//loadTilesWhileAnimating: true,
		//loadTilesWhileInteracting: true,
	});

	OLMap.getView().setRotation(mapOrientation); // adjust orientation

	if (baseCount > 1) {
		OLMap.addControl(new ol.control.LayerSwitcher());
	}

	// Listeners for newly created Map
	OLMap.getView().on('change:center', function(event) {
		if (FollowSelected) {
			const center = ol.proj.toLonLat(OLMap.getView().getCenter(), OLMap.getView().getProjection());
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

	changeZoom();
	OLMap.getView().on('change:resolution', function(event) {

		ZoomLvl = OLMap.getView().getZoom();

		// small zoomstep, no need to change aircraft scaling
		if (Math.abs(ZoomLvl-ZoomLvlCache) < 0.1)
			return;

		ZoomLvlCache = ZoomLvl;

		clearTimeout(zoomTimeout);
		zoomTimeout = setTimeout(changeZoom, 20);

	});

	OLMap.on(['click', 'dblclick'], function(evt) {
		var hex = evt.map.forEachFeatureAtPixel(
			evt.pixel,
			function(feature, layer) {
				return feature.hex;
			},
			{
				layerFilter: function(layer) {
					return (layer == iconLayer || layer.get('isTrail') == true);
				},
				hitTolerance:5,
			}
		);
		if (hex) {
			selectPlaneByHex(hex, (evt.type === 'dblclick'));
			adjustSelectedInfoBlockPosition();
		} else if (!multiSelect) {
			deselectAllPlanes();
		}
		evt.stopPropagation();
	});


	// show the hover box
	if (ZoomLvl > 6.5 && enableMouseover) {
		OLMap.on('pointermove', onPointermove);
	}

	// handle the layer settings pane checkboxes
	OLMap.once('postrender', function(e) {
		toggleLayer('#nexrad_checkbox', 'nexrad');
		toggleLayer('#sitepos_checkbox', 'site_pos');
		toggleLayer('#actrail_checkbox', 'ac_trail');
		toggleLayer('#acpositions_checkbox', 'ac_positions');
	});

	// Add home marker if requested
	if (SitePosition) {
		var markerStyle = new ol.style.Style({
			image: new ol.style.Circle({
				radius: 7,
				snapToPixel: false,
				fill: new ol.style.Fill({color: 'black'}),
				stroke: new ol.style.Stroke({
					color: 'white', width: 2
				})
			})
		});

		var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(SitePosition)));
		feature.setStyle(markerStyle);
		StaticFeatures.push(feature);

		if (SiteCircles) {
			createSiteCircleFeatures();
		}
	}

	if (localStorage['MapDim'] == undefined || localStorage['MapDim'] == "true") {
		toggleMapDim(true);
	}

	window.addEventListener('keydown', function(e) {
		if (e.defaultPrevented ) {
			return; // Do nothing if the event was already processed
		}
		if (e.srcElement.nodeName == 'INPUT') {
			return;
		}

		if( e.ctrlKey || e.altKey || e.metaKey) {
			return;
		}
		var oldCenter, extent, newCenter;
		switch (e.key) {
			case "c":
			case "Esc":
			case "Escape":
				deselectAllPlanes();
				break;
			case "?":
				if (!SelectedPlane) {
					console.log("No plane selected");
					break;
				}
				console.log(SelectedPlane.icao + ": " + SelectedPlane.baseMarkerKey + "  " + SelectedPlane.shape);
				console.log(SelectedPlane);
				break;
			case "m":
				toggleMultiSelect();
				break;
			case "v":
				toggleTableInView();
				break;
			case "r":
				followRandomPlane();
				break;
			case "t":
				selectAllPlanes();
				break;
			case "h":
				resetMap();
				break;
			case "f":
				toggleFollowSelected();
				break;
			case "F":
				onlySelected = !onlySelected;
				break;
			case "l":
				toggleLabels();
				break;
			case "o":
				toggleExtendedLabels();
				break;
			case "M":
				onlyMLAT = !onlyMLAT;
				break;
			case "T":
				filterTISB = !filterTISB;
				break;
			case "A":
				onlyADSB = !onlyADSB;
				break;
			case "P":
				debugPosFilter = !debugPosFilter;
				localStorage['debugPosFilter'] = debugPosFilter;
				console.log('debugPosFilter = ' + debugPosFilter);
				break;
			case "V":
				noVanish = !noVanish;
				filterTracks = noVanish;
				localStorage['noVanish'] = noVanish;
				console.log('noVanish = ' + noVanish);
				for (var i in PlanesOrdered) {
					PlanesOrdered[i].remakeTrail();
				}
				if (!noVanish)
					reaper();
				break;
			case "D":
				debug = !debug;
				localStorage['debug'] = debug;
				console.log('debug = ' + debug);
				break;
			case "j":
				selectPlaneByHex(jumpTo, true);
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
			case "k":
				toggleTrackLabels();
				break;
			case "b":
				toggleMapDim();
				break;
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
				FollowSelected = false;
				break;
			case "s":
				oldCenter = OLMap.getView().getCenter();
				extent = OLMap.getView().calculateExtent(OLMap.getSize());
				newCenter = [oldCenter[0], (oldCenter[1] + extent[1])/2];
				OLMap.getView().setCenter(newCenter);
				FollowSelected = false;
				break;
			case "a":
				oldCenter = OLMap.getView().getCenter();
				extent = OLMap.getView().calculateExtent(OLMap.getSize());
				newCenter = [(oldCenter[0] + extent[0])/2, oldCenter[1]];
				OLMap.getView().setCenter(newCenter);
				FollowSelected = false;
				break;
			case "d":
				oldCenter = OLMap.getView().getCenter();
				extent = OLMap.getView().calculateExtent(OLMap.getSize());
				newCenter = [(oldCenter[0] + extent[2])/2,  oldCenter[1]];
				OLMap.getView().setCenter(newCenter);
				FollowSelected = false;
				break;
		}
	}, true);

	// Add terrain-limit rings. To enable this:
	//
	//  create a panorama for your receiver location on heywhatsthat.com
	//
	//  note the "view" value from the URL at the top of the panorama
	//    i.e. the XXXX in http://www.heywhatsthat.com/?view=XXXX
	//
	// fetch a json file from the API for the altitudes you want to see:
	//
	//  wget -O /usr/share/dump1090-mutability/html/upintheair.json \
	//    'http://www.heywhatsthat.com/api/upintheair.json?id=XXXX&refraction=0.25&alts=3048,9144'
	//
	// NB: altitudes are in _meters_, you can specify a list of altitudes

	// kick off an ajax request that will add the rings when it's done
	var request = $.ajax({ url: 'upintheair.json',
		timeout: 15000,
		cache: true,
		dataType: 'json' });
	request.done(function(data) {
		for (var i = 0; i < data.rings.length; ++i) {
			var geom = null;
			var points = data.rings[i].points;
			var altitude = (3.28084 * data.rings[i].alt).toFixed(0);
			var color = range_outline_color;
			if (range_outline_colored_by_altitude) {
				var colorArr = altitudeColor(altitude);
				color = 'hsl(' + colorArr[0].toFixed(0) + ',' + colorArr[1].toFixed(0) + '%,' + colorArr[2].toFixed(0) + '%)';
			}
			var ringStyle = new ol.style.Style({
				fill: null,
				stroke: new ol.style.Stroke({
					color: color,
					width: range_outline_width,
				})
			});
			if (points.length > 0) {
				geom = new ol.geom.LineString([[ points[0][1], points[0][0] ]]);
				for (var j = 0; j < points.length; ++j) {
						geom.appendCoordinate([ points[j][1], points[j][0] ]);
				}
				geom.appendCoordinate([ points[0][1], points[0][0] ]);
				geom.transform('EPSG:4326', 'EPSG:3857');

				var feature = new ol.Feature(geom);
				feature.setStyle(ringStyle);
				StaticFeatures.push(feature);
			}
		}
	});

	request.fail(function(jqxhr, status, error) {
		// no rings available, do nothing
	});
}

function createSiteCircleFeatures() {
	// Clear existing circles first
	SiteCircleFeatures.forEach(function(circleFeature) {
		StaticFeatures.remove(circleFeature); 
	});
	SiteCircleFeatures.clear();

	var circleStyle = function(distance) {
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

	var conversionFactor = 1000.0;
	if (DisplayUnits === "nautical") {
		conversionFactor = 1852.0;
	} else if (DisplayUnits === "imperial") {
		conversionFactor = 1609.0;
	}

	for (var i=0; i < SiteCirclesDistances.length; ++i) {
		var distance = SiteCirclesDistances[i] * conversionFactor;
		var circle = make_geodesic_circle(SitePosition, distance, 180);
		circle.transform('EPSG:4326', 'EPSG:3857');
		var feature = new ol.Feature(circle);
		feature.setStyle(circleStyle(distance));
		StaticFeatures.push(feature);
		SiteCircleFeatures.push(feature);
	}
}

// This looks for planes to reap out of the master Planes variable
function reaper(all) {
	//console.log("Reaping started..");
	if (noVanish)
		return;
	if (reaping)
		return;
	reaping = true;

	// Look for planes where we have seen no messages for >300 seconds
	var newPlanes = [];
	var plane;
	while (plane = PlanesOrdered.pop()) {
		plane.seen = now - plane.last_message_time;
		if (all || plane.seen > 600) {
			// Reap it.                                
			//console.log("Removed " + plane.icao);
			delete Planes[plane.icao];
			plane.destroy();
		} else {
			// Keep it.
			newPlanes.push(plane);
		}
	};

	PlanesOrdered = newPlanes;
	reaping = false;
}

// Page Title update function
function refreshPageTitle() {
	if (!PlaneCountInTitle && !MessageRateInTitle) {
		return;
	}

	var subtitle = "";

	if (PlaneCountInTitle) {
		subtitle += TrackedAircraftPositions + '/' + TrackedAircraft;
	}

	if (MessageRateInTitle && MessageRate != null) {
		if (subtitle) subtitle += ' | ';
		subtitle += MessageRate.toFixed(1) + '/s';
	}

	document.title = PageName + ' - ' + subtitle;
}

// Refresh the detail window about the plane
function refreshSelected() {

	refreshPageTitle();

	//$('#dump1090_infoblock').css('display','block');
	$('#dump1090_total_history').text(TrackedHistorySize);

	if (MessageRate !== null) {
		$('#dump1090_message_rate').text(MessageRate.toFixed(1));
	} else {
		$('#dump1090_message_rate').text("n/a");
	}

	if (!SelectedPlane) {
		return;
	}
	const selected = SelectedPlane;

	if (selected.flight && selected.flight.trim()) {
		$('#selected_callsign').text(selected.flight);
	} else {
		$('#selected_callsign').text('n/a');
	}
	if (flightawareLinks) {
		$('#selected_flightaware_link').html(getFlightAwareModeSLink(selected.icao, selected.flight, "Visit Flight Page"));
	}

	if (selected.registration) {
		if (flightawareLinks) {
			$('#selected_registration').html(getFlightAwareIdentLink(selected.registration, selected.registration));
		} else {
			$('#selected_registration').text(selected.registration);
		}
	} else {
		$('#selected_registration').text("n/a");
	}

	if (selected.icaoType) {
		$('#selected_icaotype').text(selected.icaoType);
	} else {
		$('#selected_icaotype').text("n/a");
	}

	// Not using this logic for the redesigned info panel at the time, but leaving it in  if/when adding it back
	// var emerg = document.getElementById('selected_emergency');
	// if (selected.squawk in SpecialSquawks) {
	//         emerg.className = SpecialSquawks[selected.squawk].cssClass;
	//         emerg.textContent = NBSP + 'Squawking: ' + SpecialSquawks[selected.squawk].text + NBSP ;
	// } else {
	//         emerg.className = 'hidden';
	// }

	$("#selected_altitude1").text(format_altitude_long(selected.altitude, selected.vert_rate, DisplayUnits));
	$("#selected_altitude2").text(format_altitude_long(selected.altitude, selected.vert_rate, DisplayUnits));

	$('#selected_onground').text(format_onground(selected.altitude));

	if (selected.squawk === null || selected.squawk === '0000') {
		$('#selected_squawk1').text('n/a');
		$('#selected_squawk2').text('n/a');
	} else {
		$('#selected_squawk1').text(selected.squawk);
		$('#selected_squawk2').text(selected.squawk);
	}

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
	$('#selected_icao').text(selected.icao.toUpperCase());
	$('#selected_pf_info').text((selected.pfRoute ? selected.pfRoute : "") );
	//+" "+ (selected.pfFlightno ? selected.pfFlightno : "")
	$('#airframes_post_icao').attr('value',selected.icao);
	$('#selected_track1').text(format_track_long(selected.track));
	$('#selected_track2').text(format_track_brief(selected.track));

	if (selected.seen != null && selected.seen < 1000000) {
		$('#selected_seen').text(selected.seen.toFixed(1));
	} else {
		$('#selected_seen').text('n/a');
	}
	if (selected.seen_pos != null&& selected.seen_pos < 1000000) {
		$('#selected_seen_pos').text(selected.seen_pos.toFixed(1));
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

	if (selected.position === null) {
		$('#selected_position').text('n/a');
		$('#selected_follow').addClass('hidden');
	} else {

		if (selected.seen_pos > -1) {
			$('#selected_position').text(format_latlng(selected.position));
		} else {
			$('#selected_position').text(format_latlng(selected.position));
		}

		$('#selected_follow').removeClass('hidden');
		if (FollowSelected) {
			$('#selected_follow').css('font-weight', 'bold');
			OLMap.getView().setCenter(ol.proj.fromLonLat(selected.position));
		} else {
			$('#selected_follow').css('font-weight', 'normal');
		}
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
	$('#selected_mag_heading').text(format_track_long(selected.mag_heading));
	$('#selected_true_heading').text(format_track_long(selected.true_heading));
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
	$('#selected_nav_heading').text(format_track_long(selected.nav_heading));
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
		var sampleRate = "";
		var silDesc = "";
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

}

function refreshHighlighted() {
	// this is following nearly identical logic, etc, as the refreshSelected function, but doing less junk for the highlighted pane
	var highlighted = false;

	if (!HighlightedPlane || !(highlighted = Planes[HighlightedPlane]) ) {
		$('#highlighted_infoblock').hide();
		return;
	}

	$('#highlighted_infoblock').show();

	// Get info box position and size
	var infoBox = $('#highlighted_infoblock');
	var infoBoxPosition = infoBox.position();
	if (typeof infoBoxOriginalPosition.top === 'undefined') {
		infoBoxOriginalPosition.top = infoBoxPosition.top;
		infoBoxOriginalPosition.left = infoBoxPosition.left;
	} else {
		infoBox.css("left", infoBoxOriginalPosition.left);
		infoBox.css("top", infoBoxOriginalPosition.top);
		infoBoxPosition = infoBox.position();
	}
	var infoBoxExtent = getExtent(infoBoxPosition.left, infoBoxPosition.top, infoBox.outerWidth(), infoBox.outerHeight());

	// Get map size
	var mapCanvas = $('#map_canvas');
	var mapExtent = getExtent(0, 0, mapCanvas.width(), mapCanvas.height());

	var marker = highlighted.marker;
	var geom;
	var markerCoordinates;
	if (!marker || !(geom = marker.getGeometry()) || !(markerCoordinates = geom.getCoordinates()) ) {
		$('#highlighted_infoblock').hide();
		return;
	}
	var markerPosition = OLMap.getPixelFromCoordinate(markerCoordinates);

	// Check for overlap
	//FIXME TODO: figure out this/remove this check
	if (true || isPointInsideExtent(markerPosition[0], markerPosition[1], infoBoxExtent)) {
		// Array of possible new positions for info box
		var candidatePositions = [];
		candidatePositions.push( { x: 40, y: 80 } );
		candidatePositions.push( { x: markerPosition[0] + 20, y: markerPosition[1] + 60 } );

		// Find new position
		for (var i = 0; i < candidatePositions.length; i++) {
			var candidatePosition = candidatePositions[i];
			var candidateExtent = getExtent(candidatePosition.x, candidatePosition.y, infoBox.outerWidth(), infoBox.outerHeight());

			if (!isPointInsideExtent(markerPosition[0],  markerPosition[1], candidateExtent) && isPointInsideExtent(candidatePosition.x, candidatePosition.y, mapExtent)) {
				// Found a new position that doesn't overlap marker - move box to that position
				infoBox.css("left", candidatePosition.x);
				infoBox.css("top", candidatePosition.y);
			}
		}
	}

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

	$('#highlighted_speed').text(format_speed_long(highlighted.speed, DisplayUnits));

	$("#highlighted_altitude").text(format_altitude_long(highlighted.altitude, highlighted.vert_rate, DisplayUnits));

	$('#highlighted_icao').text(highlighted.icao.toUpperCase());

	$('#highlighted_pf_route').text((highlighted.pfRoute ? highlighted.pfRoute : ""));

	$('#highlighted_rssi').text(highlighted.rssi != null ? highlighted.rssi.toFixed(1) + ' dBFS' : "n/a");

}

function refreshClock(now_date) {
    var hhmm = now_date.getHours().toString().padStart(2,'0') + ":" + now_date.getMinutes().toString().padStart(2,'0');
    var hms = hhmm + ":" + now_date.getSeconds().toString().padStart(2,'0');
    $('#clock_div').text(hms + "   " + now_date.toDateString());
}

function removeHighlight() {
	HighlightedPlane = null;
	refreshHighlighted();
}

// Refreshes the larger table of all the planes
function refreshTableInfo() {
	var show_squawk_warning = false;

	TrackedAircraft = 0
	TrackedAircraftPositions = 0
	TrackedHistorySize = 0

	var currExtent = OLMap.getView().calculateExtent(OLMap.getSize());
	//console.log((currExtent[2]-currExtent[0])/40075016);
	const bottomLeft = ol.proj.toLonLat([currExtent[0], currExtent[1]]);
	const topRight = ol.proj.toLonLat([currExtent[2], currExtent[3]]);
	//console.log([bottomLeft[0], topRight[0]]);
	//console.log([bottomLeft[1], topRight[1]]);
	//sidebarVisible = $("#sidebar_container").is(":visible");

	//console.time("updateCells");
	for (var i = 0; i < PlanesOrdered.length; ++i) {
		var tableplane = PlanesOrdered[i];
		TrackedHistorySize += tableplane.history_size;
		var classes;

		const pos = tableplane.position;
		const proj = tableplane.position ? ol.proj.fromLonLat(tableplane.position) : null;
		//const inView = proj ? ol.extent.containsCoordinate(currExtent, proj) : false;
		var inView = false;
		if (tableInView && sidebarVisible) {
			if (pos && currExtent[2]-currExtent[0] > 40075016) {
				// all longtitudes in view, only check latitude
				inView = (
					pos[1] > bottomLeft[1]
					&& pos[1] < topRight[1]
				)
			} else if (pos && bottomLeft[0] < topRight[0]) {
				// no wraparound: view not crossing 179 to -180 transition line
				inView = (
					pos[0] > bottomLeft[0]
					&& pos[0] < topRight[0]
					&& pos[1] > bottomLeft[1]
					&& pos[1] < topRight[1]
				)
			} else if (pos && bottomLeft[0] > topRight[0]) {
				// wraparound: view crossing 179 to -180 transition line
				inView = (
					(pos[0] > bottomLeft[0]
					|| pos[0] < topRight[0])
					&& pos[1] > bottomLeft[1]
					&& pos[1] < topRight[1]
				)
			}
		} else {
			inView = true;
		}


		if (tableplane.seen == null || (tableplane.seen >= 58 && (!tableplane.selected || SelectedAllPlanes)) || tableplane.isFiltered()) {
			classes = "plane_table_row hidden";
		} else if (mapIsVisible && tableInView && (!inView || !tableplane.visible) && !(tableplane.selected && !SelectedAllPlanes)) {
			TrackedAircraft++;
			classes = "plane_table_row hidden";
		} else {
			TrackedAircraft++;
			classes = "plane_table_row";

			if (tableplane.position != null && tableplane.seen_pos < 60) {
				++TrackedAircraftPositions;
			}

			if (!sidebarVisible)
				continue;

			if (tableplane.dataSource == "adsb") {
				classes += " vPosition";
			} else {
				classes += " ";
				classes += tableplane.dataSource;
			}

			if (tableplane.selected && !SelectedAllPlanes)
				classes += " selected";

			if (tableplane.squawk in SpecialSquawks) {
				classes = classes + " " + SpecialSquawks[tableplane.squawk].cssClass;
				show_squawk_warning = true;
			}			                

			// ICAO doesn't change
			if (flightawareLinks) {
				updateCell(tableplane, 2, getFlightAwareModeSLink(tableplane.icao, tableplane.flight, tableplane.name), true);
				updateCell(tableplane, 3, getFlightAwareIdentLink(tableplane.registration, tableplane.registration), true);
			} else {
				updateCell(tableplane, 2, tableplane.name);
				updateCell(tableplane, 3, tableplane.registration ? tableplane.registration : "");
			}
			updateCell(tableplane, 4, (tableplane.icaoType != null ? tableplane.icaoType : ""));
			updateCell(tableplane, 5, (tableplane.squawk != null ? tableplane.squawk : ""));
			updateCell(tableplane, 6, format_altitude_brief(tableplane.altitude, tableplane.vert_rate, DisplayUnits));
			updateCell(tableplane, 7, format_speed_brief(tableplane.gs, DisplayUnits));
			updateCell(tableplane, 8, format_vert_rate_brief(tableplane.vert_rate, DisplayUnits));
			updateCell(tableplane, 9, format_distance_brief(tableplane.sitedist, DisplayUnits));
			updateCell(tableplane, 10, format_track_brief(tableplane.track));
			updateCell(tableplane, 11, tableplane.messages);
			updateCell(tableplane, 12, tableplane.seen.toFixed(0));
			updateCell(tableplane, 13, (tableplane.rssi != null ? tableplane.rssi.toFixed(1) : ""));
			updateCell(tableplane, 14, (tableplane.position != null ? tableplane.position[1].toFixed(4) : ""));
			updateCell(tableplane, 15, (tableplane.position != null ? tableplane.position[0].toFixed(4) : ""));
			updateCell(tableplane, 16, format_data_source(tableplane.getDataSource()));
			//updateCell(tableplane, 17, tableplane.baseMarkerKey);


		}
		if (tableplane.classesCache != classes) {
			tableplane.classesCache = classes;
			tableplane.tr.className = classes;
		}
	}
	//console.timeEnd("updateCells");

	if (show_squawk_warning_cache != show_squawk_warning && show_squawk_warning ) {
		$("#SpecialSquawkWarning").css('display','block');
		show_squawk_warning_cache = show_squawk_warning;
	}
	if (show_squawk_warning_cache != show_squawk_warning && !show_squawk_warning ) {
		$("#SpecialSquawkWarning").css('display','none');
		show_squawk_warning_cache = show_squawk_warning;
	}

	$('#dump1090_total_ac').text(TrackedAircraft);
	$('#dump1090_total_ac_positions').text(TrackedAircraftPositions);

	resortTable();
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

var sortId = '';
var sortCompare = null;
var sortExtract = null;
var sortAscending = true;

function sortFunction(x,y) {
	var xv = x._sort_value;
	var yv = y._sort_value;

	// always sort missing values at the end, regardless of
	// ascending/descending sort
	if (xv == null && yv == null) return x._sort_pos - y._sort_pos;
	if (xv == null) return 1;
	if (yv == null) return -1;

	var c = sortAscending ? sortCompare(xv,yv) : sortCompare(yv,xv);
	if (c !== 0) return c;

	return x._sort_pos - y._sort_pos;
}

function resortTable() {
	// presort by dataSource
	if (sortId == "sitedist") {
		for (var i = 0; i < PlanesOrdered.length; ++i) {
			PlanesOrdered[i]._sort_pos = i;
		}
		PlanesOrdered.sort(function(x,y) {
			const a = x.getDataSourceNumber();
			const b = y.getDataSourceNumber();
			if (a == b)
				return (x._sort_pos - y._sort_pos);

			return (a-b);
		});
	}
	// or distance
	if (sortId == "data_source") {
		PlanesOrdered.sort(function(x,y) {
			return (x.sitedist - y.sitedist);
		});
	}
	// number the existing rows so we can do a stable sort
	// regardless of whether sort() is stable or not.
	// Also extract the sort comparison value.
	for (var i = 0; i < PlanesOrdered.length; ++i) {
		PlanesOrdered[i]._sort_pos = i;
		PlanesOrdered[i]._sort_value = sortExtract(PlanesOrdered[i]);
	}

	PlanesOrdered.sort(sortFunction);
	// Put selected planes on top, do a stable sort!
	// actually that's a bad idea, disable this for now
	if (!SelectedAllPlanes && multiSelect) {
		for (var i = 0; i < PlanesOrdered.length; ++i) {
			PlanesOrdered[i]._sort_pos = i;
		}
		PlanesOrdered.sort(function(x,y) {
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

	//console.time("DOM");
	var tbody = document.getElementById('tableinfo').tBodies[0];
	fragment = document.createDocumentFragment();
	for (var i = 0; i < PlanesOrdered.length; ++i) {
		fragment.appendChild(PlanesOrdered[i].tr);
	}
	tbody.appendChild(fragment);
	//console.timeEnd("DOM");
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

	resortTable();
}

function selectPlaneByHex(hex,autofollow) {
	//console.log("select: " + hex);
	// If SelectedPlane has something in it, clear out the selected
	if (SelectedAllPlanes) {
		deselectAllPlanes();
	}
	// already selected plane
	var oldPlane = SelectedPlane;
	// plane to be selected
	var newPlane = Planes[hex];

	if (!multiSelect && oldPlane) {
		oldPlane.selected = false;
		oldPlane.clearLines();
		oldPlane.updateMarker();
		$(oldPlane.tr).removeClass("selected");
		// scroll the infoblock back to the top for the next plane to be selected
		//$('.infoblock-container').scrollTop(0);
	}
	// multiSelect deselect
	if (multiSelect && newPlane && newPlane.selected && !autofollow && !noVanish) {
		newPlane.selected = false;
		newPlane.clearLines();
		newPlane.updateMarker();
		$(newPlane.tr).removeClass("selected");
		newPlane = null;
	}

	// If we are clicking the same plane, we are deselecting it.
	// (unless it was a doubleclick..)
	if (oldPlane == newPlane && !autofollow) {
		newPlane = null;
	}

	if (newPlane) {
		// Assign the new selected
		SelectedPlane = newPlane;
		newPlane.selected = true;
		newPlane.updateLines();
		newPlane.updateMarker();
		$(newPlane.tr).addClass("selected");
		newPlane.logSel(newPlane.history_size);
		//console.log(newPlane.baseMarkerKey);
	} else {
		SelectedPlane = null;
	}

	if (newPlane && autofollow) {
		FollowSelected = true;
		if (OLMap.getView().getZoom() < 8)
			OLMap.getView().setZoom(8);
	} else {
		FollowSelected = false;
	}

	refreshSelected();
	refreshHighlighted();
	setSelectedInfoBlockVisibility();
}

function highlightPlaneByHex(hex) {

	if (hex != null) {
		HighlightedPlane = hex;
	}
}

// loop through the planes and mark them as selected to show the paths for all planes
function selectAllPlanes() {
	HighlightedPlane = null;
	// if all planes are already selected, deselect them all
	if (SelectedAllPlanes) {
		deselectAllPlanes();
		return;
	}
	// If SelectedPlane has something in it, clear out the selected
	if (SelectedPlane != null) {
		SelectedPlane.selected = false;
		SelectedPlane.clearLines();
		SelectedPlane.updateMarker();
		$(SelectedPlane.tr).removeClass("selected");
	}

	SelectedPlane = null;
	SelectedAllPlanes = true;

	for(var key in Planes) {
		if (Planes[key].visible && !Planes[key].isFiltered()) {
			Planes[key].selected = true;
			Planes[key].updateLines();
			Planes[key].updateMarker();
		}
	}


	$('#selectall_checkbox').addClass('settingsCheckboxChecked');

	refreshSelected();
	refreshHighlighted();
	setSelectedInfoBlockVisibility();
}

// on refreshes, try to find new planes and mark them as selected
function selectNewPlanes() {
	if (SelectedAllPlanes) {
		for (var key in PlanesOrdered) {
			if (!PlanesOrdered[key].visible || PlanesOrdered[key].isFiltered()) {
				if (PlanesOrdered[key].selected) {
					PlanesOrdered[key].selected = false;
					PlanesOrdered[key].clearLines();
				}
			} else if (PlanesOrdered[key].selected !== true) {
				PlanesOrdered[key].selected = true;
				PlanesOrdered[key].updateLines();
			}
		}
	}
}

// deselect all the planes
function deselectAllPlanes() {
	for(var key in Planes) {
		Planes[key].selected = false;
		Planes[key].clearLines();
		$(Planes[key].tr).removeClass("selected");
	}
	$('#selectall_checkbox').removeClass('settingsCheckboxChecked');
	SelectedAllPlanes = false;
	if (multiSelect && SelectedPlane != null) {
		SelectedPlane.selected = true;
		SelectedPlane.updateLines();
		SelectedPlane.updateMarker();
	} else {
		SelectedPlane = null;
	}
	refreshSelected();
	refreshHighlighted();
	setSelectedInfoBlockVisibility();
}

function toggleFollowSelected() {
	FollowSelected = !FollowSelected;
	if (FollowSelected && OLMap.getView().getZoom() < 8)
		OLMap.getView().setZoom(8);
	refreshSelected();
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

	selectPlaneByHex(null,false);
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
	$("#sudo_buttons").hide();
	$("#show_map_button").show();
	$("#sidebar_container").width("100%");
	setColumnVisibility();
	setSelectedInfoBlockVisibility();
	updateMapSize();
}

function showMap() {
	$('#sidebar_container').width(localStorage['sidebar_width']);
	$("#map_container").show()
	mapIsVisible = true;
	$("#toggle_sidebar_control").show();
	$("#splitter").show();
	$("#sudo_buttons").show();
	$("#show_map_button").hide();
	setColumnVisibility();
	setSelectedInfoBlockVisibility();
	updateMapSize();    
	refreshTableInfo();
}

function showColumn(table, columnId, visible) {
	var index = $(columnId).index();
	columnVis[index] = visible;
	if (index >= 0) {
		var cells = $(table).find("td:nth-child(" + (index + 1).toString() + ")");
		if (visible) {
			cells.show();
		} else {
			cells.hide();
		}
	}
}

function setColumnVisibility() {
	var infoTable = $("#tableinfo");

	for (var col in HideCols) {
		showColumn(infoTable, HideCols[col], !mapIsVisible);
	}
}

function setSelectedInfoBlockVisibility() {

	if (SelectedPlane && mapIsVisible) {
		$('#selected_infoblock').show();
		//$('#sidebar_canvas').css('margin-bottom', $('#selected_infoblock').height() + 'px');
	}
	else {
		$('#selected_infoblock').hide();
		//$('#sidebar_canvas').css('margin-bottom', 0);
	}
	refreshTableInfo();
}

// Reposition selected plane info box if it overlaps plane marker
function adjustSelectedInfoBlockPosition() {
	if (true)
		return; // this function is probably obsolete
	if (!SelectedPlane || !SelectedPlane.marker) {
		return;
	}
	// Get marker position
	var marker = SelectedPlane.marker;
	var markerCoordinates = SelectedPlane.marker.getGeometry().getCoordinates();
	var markerPosition = OLMap.getPixelFromCoordinate(markerCoordinates);

	// Get map size
	var mapCanvas = $('#map_canvas');
	var mapExtent = getExtent(0, 0, mapCanvas.width(), mapCanvas.height());

	// Check for overlap
	if (isPointInsideExtent(markerPosition[0], markerPosition[1], infoBoxExtent)) {
		// Array of possible new positions for info box
		var candidatePositions = [];
		candidatePositions.push( { x: 40, y: 60 } );
		candidatePositions.push( { x: 40, y: markerPosition[1] + 80 } );

		// Find new position
		for (var i = 0; i < candidatePositions.length; i++) {
			var candidatePosition = candidatePositions[i];
			var candidateExtent = getExtent(candidatePosition.x, candidatePosition.y, infoBox.outerWidth(), infoBox.outerHeight());

			if (!isPointInsideExtent(markerPosition[0],  markerPosition[1], candidateExtent) && isPointInsideExtent(candidatePosition.x, candidatePosition.y, mapExtent)) {
				// Found a new position that doesn't overlap marker - move box to that position
				infoBox.css("left", candidatePosition.x);
				infoBox.css("top", candidatePosition.y);
				return;
			}
		}
	}
}

function getExtent(x, y, width, height) {
	return {
		xMin: x,
		yMin: y,
		xMax: x + width - 1,
		yMax: y + height - 1,
	};
}

function isPointInsideExtent(x, y, extent) {
	return x >= extent.xMin && x <= extent.xMax && y >= extent.yMin && y <= extent.yMax;
}

function initializeUnitsSelector() {
	// Get display unit preferences from local storage
	if (!localStorage.getItem('displayUnits')) {
		localStorage['displayUnits'] = "nautical";
	}
	var displayUnits = localStorage['displayUnits'];
	DisplayUnits = displayUnits;

	setAltitudeLegend(displayUnits);

	// Initialize drop-down
	var unitsSelector = $("#units_selector");
	unitsSelector.val(displayUnits);
	unitsSelector.on("change", onDisplayUnitsChanged);

	$(".altitudeUnit").text(get_unit_label("altitude", DisplayUnits));
	$(".speedUnit").text(get_unit_label("speed", DisplayUnits));
	$(".distanceUnit").text(get_unit_label("distance", DisplayUnits));
	$(".verticalRateUnit").text(get_unit_label("verticalRate", DisplayUnits));
}

function onDisplayUnitsChanged(e) {
	var displayUnits = e.target.value;
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
	if (SitePosition !== null && SitePosition !== undefined && SiteCircles) {
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
	refreshTableInfo();

	if (SelectedPlane && SelectedPlane.isFiltered()) {
		SelectedPlane.selected = false;
		SelectedPlane.clearLines();
		SelectedPlane = null;
		refreshSelected();
		refreshHighlighted();
		setSelectedInfoBlockVisibility();
	}
}

function filterGroundVehicles(switchFilter) {
	if (typeof localStorage['groundVehicleFilter'] === 'undefined') {
		localStorage['groundVehicleFilter'] = 'not_filtered';
	}
	var groundFilter = localStorage['groundVehicleFilter'];
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
	var blockedMLATFilter = localStorage['blockedMLATFilter'];
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
	for (var i in PlanesOrdered) {
		PlanesOrdered[i].remakeTrail();
	}
}

function dim(evt) {
	const dim = 0.3;
	const contrast = 0.1;
	evt.context.globalCompositeOperation = 'multiply';
	if (evt.context.globalCompositeOperation == 'multiply') {
		evt.context.fillStyle = 'rgba(0,0,0,'+dim+')';
		evt.context.fillRect(0, 0, evt.context.canvas.width, evt.context.canvas.height);
	}
	evt.context.globalCompositeOperation = 'overlay';
	if (evt.context.globalCompositeOperation == 'overlay') {
		evt.context.fillStyle = 'rgba(0,0,0,'+contrast+')';
		evt.context.fillRect(0, 0, evt.context.canvas.width, evt.context.canvas.height);
	}
	evt.context.globalCompositeOperation = 'source-over';
}

function toggleMapDim(switchOn) {
	if (!switchOn && localStorage['MapDim'] === "true") {
		localStorage['MapDim'] = "false";

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

		ol.control.LayerSwitcher.forEachRecursive(layers_group, function(lyr) {
			if (lyr.get('type') != 'base')
				return;
			lyr.dimKey = lyr.on('postcompose', dim);
		});

		$('#mapdim_checkbox').addClass('settingsCheckboxChecked');

	}
	OLMap.render();
}

function toggleAltitudeChart(switchToggle) {
	if (typeof localStorage['altitudeChart'] === 'undefined') {
		localStorage['altitudeChart'] = 'show';
	}
	var altitudeChartDisplay = localStorage['altitudeChart'];
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
	var this_one = null;
	do {
		this_one = PlanesOrdered[Math.floor(Math.random()*PlanesOrdered.length)];
	} while (this_one.isFiltered() || !this_one.position || (now - this_one.position_time > 30));
	//console.log(this_one.icao);
	selectPlaneByHex(this_one.icao, true);
}

function toggleTableInView(toggle) {
	if (toggle != "noToggle") {
		tableInView = !tableInView;
		refreshTableInfo();
	}
	localStorage['tableInView'] = tableInView;
	if (tableInView) {
		$('#with_positions').text("On Screen:");
	} else {
		$('#with_positions').text("With Position:");
	}
}

function toggleLabels() {
	enableLabels = !enableLabels;
	localStorage['enableLabels'] = enableLabels;
	for (var key in PlanesOrdered) {
		PlanesOrdered[key].updateMarker(false);
	}
}
function toggleExtendedLabels() {
	extendedLabels = !extendedLabels;
	localStorage['extendedLabels'] = extendedLabels;
	for (var key in PlanesOrdered) {
		PlanesOrdered[key].updateMarker(false);
	}
}

function toggleTrackLabels() {
	trackLabels = !trackLabels;
	localStorage['trackLabels'] = trackLabels;
	for (var i in PlanesOrdered) {
		PlanesOrdered[i].remakeTrail();
	}
}

function toggleMultiSelect() {
	if (multiSelect) {
		multiSelect = false;
		deselectAllPlanes();
	} else {
		multiSelect = true;
	}
}

function onSearch(e) {
	e.preventDefault();
	const searchTerm = $("#search_input").val().trim();
	$("#search_input").val("");
	$("#search_input").blur();
	findPlanes(searchTerm, true, true, true);
	return false;
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
	var minAltitude = parseFloat($("#altitude_filter_min").val().trim());
	var maxAltitude = parseFloat($("#altitude_filter_max").val().trim());

	if (minAltitude < -1e6 || minAltitude > 1e6 || isNaN(minAltitude))
		minAltitude = -1e6;
	if (maxAltitude < -1e6 || maxAltitude > 1e6 || isNaN(maxAltitude))
		maxAltitude = 1e6;

	if (DisplayUnits == "metric") {
		PlaneFilter.minAltitude = minAltitude * 3.2808;
		PlaneFilter.maxAltitude = maxAltitude * 3.2808;
	} else {
		PlaneFilter.minAltitude = minAltitude;
		PlaneFilter.maxAltitude = maxAltitude;
	}

	if (filterTracks) {
		for (var i in PlanesOrdered) {
			PlanesOrdered[i].remakeTrail();
		}
	}

	for (var i in PlanesOrdered) {
		var plane = PlanesOrdered[i];
		if (plane.dataSource == "uat")
			plane.updateTick(uat_now, uat_last);
		else
			plane.updateTick(now, last);
	}
}

function getFlightAwareIdentLink(ident, linkText) {
	if (ident !== null && ident !== "") {
		if (!linkText) {
			linkText = ident;
		}
		return "<a target=\"_blank\" href=\"https://flightaware.com/live/flight/" + ident.trim() + "\">" + linkText + "</a>";
	}

	return "";
}

function getFlightAwareModeSLink(code, ident, linkText) {
	if (code !== null && code.length > 0 && code[0] !== '~' && code !== "000000") {
		if (!linkText) {
			linkText = "FlightAware: " + code.toUpperCase();
		}

		var linkHtml = "<a target=\"_blank\" href=\"https://flightaware.com/live/modes/" + code ;
		if (ident != null && ident !== "") {
			linkHtml += "/ident/" + ident.trim();
		}
		linkHtml += "/redirect\">" + linkText + "</a>";
		return linkHtml;
	}

	return "";
}

function getFlightAwarePhotoLink(registration) {
	if (registration !== null && registration !== "") {
		return "<a target=\"_blank\" href=\"https://flightaware.com/photos/aircraft/" + registration.replace(/[^0-9a-z]/ig,'') + "\">See Photos</a>";
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
		var visible = false;
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

// check status.json if it has a serial number for a flightfeeder
function flightFeederCheck() {
	$.ajax('/status.json', {
		success: function(data) {
			if (data.type === "flightfeeder") {
				isFlightFeeder = true;
				updatePiAwareOrFlightFeeder();
			}
		}
	})
}

// updates the page to replace piaware with flightfeeder references
function updatePiAwareOrFlightFeeder() {
	if (isFlightFeeder) {
		$('.piAwareLogo').hide();
		$('.flightfeederLogo').show();
		PageName = 'FlightFeeder SkyAware';
	} else {
		$('.flightfeederLogo').hide();
		$('.piAwareLogo').show();
		PageName = 'PiAware SkyAware';
	}
	refreshPageTitle();
}

function fetchPfData() {
	if (fetchingPf)
		return;
	fetchingPf = true;
	for (const i in pf_data) {
		const req = $.ajax({ url: pf_data[i],
			timeout: 20000,
			cache: false,
			dataType: 'json' });
		$.when(req).done(function(data) {
			for (const i in PlanesOrdered) {
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
					var typeData = _aircraft_type_cache[plane.icaoType];
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
	OLMap.getView().setZoom((ZoomLvl+1).toFixed());
	changeZoom();
}

function zoomOut() {
	OLMap.getView().setZoom((ZoomLvl-1).toFixed());
	changeZoom();
}
function changeZoom() {
		localStorage['ZoomLvl'] = ZoomLvl;
		scaleFactor = Math.max(markerMinSize, Math.min(markerMaxSize, markerScaleFactor * 0.09 * Math.pow(1.35, ZoomLvl)));
		for (var i in PlanesOrdered) {
			var plane = PlanesOrdered[i];
			if (plane.markerIcon) {
				plane.scaleCache = scaleFactor * plane.baseScale;
				plane.markerIcon.setScale(plane.scaleCache);
			}
		}
		if (ZoomLvl > 6.5 && enableMouseover) {
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
	const hex = evt.map.forEachFeatureAtPixel(evt.pixel,
		function(feature, layer) {
			return feature.hex;
		},
		{ layerFilter: function(layer) {
			return (layer == iconLayer);
		}}
	);

	if (hex) {
		highlightPlaneByHex(hex);
	} else {
		removeHighlight();
	}

}

function processURLParams(){
	const search = new URLSearchParams(window.location.search);

	const icao = search.get('icao');
	if (icao != null) {
		if (Planes[icao.toLowerCase()]) {
			selectPlaneByHex(icao.toLowerCase(), true)
			console.log('Selected ICAO id: '+ icao);
		} else {
			console.log('ICAO id not found: ' + icao);
		}
	}

	var callsign = search.get('callsign');
	findPlanes(callsign, false, true, false);
}

function findPlanes(query, byIcao, byCallsign, byReg) {
	if (query == null)
		return;
	query = query.toLowerCase();
	var results = [];
	for (var i in PlanesOrdered) {
		const plane = PlanesOrdered[i];
		if (
			(byCallsign && plane.flight != null && plane.flight.toLowerCase().match(query))
			|| (byIcao && plane.icao.toLowerCase().match(query))
			|| (byReg && plane.registration != null && plane.registration.toLowerCase().match(query))
		) {
			if (plane.seen < 70 || noVanish)
				results.push(plane);
		}
	}
	if (results.length > 1) {
		multiSelect = true;
		for (var i in results) {
			results[i].selected = true;
			results[i].updateLines();
			results[i].updateMarker();
		}
	} else if (results.length == 1) {
		selectPlaneByHex(results[0].icao, true);
		console.log("query selected: " + query);
	} else {
		console.log("No match found for query: " + query);
	}
}
