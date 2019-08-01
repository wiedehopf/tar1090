// Some global variables are defined in early.js
// early.js takes care of getting some history files while the html page and
// some javascript libraries are still loading, hopefully speeding up loading

// Define our global variables
var OLMap         = null;
var StaticFeatures = new ol.Collection();
var SiteCircleFeatures = new ol.Collection();
var PlaneIconFeatures = new ol.Collection();
var PlaneTrailFeatures = new ol.Collection();
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
var mapResizeTimeout;
var HistoryItemsReturned = 0;
var refresh;

var SpecialSquawks = {
	'7500' : { cssClass: 'squawk7500', markerColor: 'rgb(255, 85, 85)', text: 'Aircraft Hijacking' },
	'7600' : { cssClass: 'squawk7600', markerColor: 'rgb(0, 255, 255)', text: 'Radio Failure' },
	'7700' : { cssClass: 'squawk7700', markerColor: 'rgb(255, 255, 0)', text: 'General Emergency' }
};

// Get current map settings
var CenterLat, CenterLon, ZoomLvl, MapType;


var PlaneRowTemplate = null;

var TrackedAircraft = 0;
var TrackedAircraftPositions = 0;
var TrackedHistorySize = 0;

var SitePosition = null;

var LastReceiverTimestamp = 0;
var StaleReceiverCount = 0;
var FetchPending = null;
var FetchPendingUAT = null;

var MessageCountHistory = [];
var MessageRate = 0;

var NBSP='\u00a0';

var layers;

// piaware vs flightfeeder
var isFlightFeeder = false;

// this will be needed later, get it right when the script is loaded
$.getJSON("db/aircraft_types/icao_aircraft_types.json")
	.done(function(typeLookupData) {
		_aircraft_type_cache = typeLookupData;
	})


function processReceiverUpdate(data, loading, uat) {

	// Loop through all the planes in the data packet
	var now = data.now;
	var acs = data.aircraft;

	if (!uat && !loading) {
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
		var hex = ac.hex;
		var plane = null;

		// Do we already have this plane object in Planes?
		// If not make it.

		if (Planes[hex]) {
			plane = Planes[hex];
		} else if ( ac.messages < 4) {
			continue;
		} else if ( uat && !(ac.type && ac.type.substring(0,4) == "adsb")) {
			// drop non ADS-B planes from UAT (TIS-B)
			continue;
		} else {
			plane = new PlaneObject(hex);
			plane.filter = PlaneFilter;

			if (uat && ac.type && ac.type.substring(0,4) == "adsb")
				plane.uat = true;

			if (!loading)
				setupPlane(hex,plane);

			Planes[hex] = plane;
			PlanesOrdered.push(plane);
		}

		// Call the function update
		plane.updateData(now, ac, loading);
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

	plane.tr.addEventListener('click', function(h, evt) {
		if (evt.srcElement instanceof HTMLAnchorElement) {
			evt.stopPropagation();
			return;
		}

		if (!$("#map_container").is(":visible")) {
			showMap();
		}
		selectPlaneByHex(h, false);
		adjustSelectedInfoBlockPosition();
		evt.preventDefault();
	}.bind(undefined, hex));

	plane.tr.addEventListener('dblclick', function(h, evt) {
		if (!$("#map_container").is(":visible")) {
			showMap();
		}
		selectPlaneByHex(h, true);
		adjustSelectedInfoBlockPosition();
		evt.preventDefault();
	}.bind(undefined, hex));
}

function fetchData() {
	if (FetchPending !== null && FetchPending.state() == 'pending') {
		// don't double up on fetches, let the last one resolve
		return;
	}

	if (enable_uat) {
		FetchPendingUAT = $.ajax({ url: 'chunks/978.json',
			timeout: 5000,
			cache: false,
			dataType: 'json' });
	}
	FetchPending = $.ajax({ url: 'data/aircraft.json',
		timeout: 5000,
		cache: false,
		dataType: 'json' });
	FetchPending.done(function(data) {
		if (data == null)
			return;

		var now = data.now;

		// experimental stuff
		/*
		var browserNow = (new Date()).getTime();
		var diff = browserNow -  now*1000;
		var delay = RefreshInterval;

		if (diff > -100)
			delay = Math.max(RefreshInterval*1.3 - diff,100);

		window.setTimeout(fetchData, delay);

		if ((now-LastReceiverTimestamp)*1000 >  1.5* RefreshInterval || (now-LastReceiverTimestamp)*1000 < 0.5 * RefreshInterval)
			console.log("We missed a beat: aircraft.json");
		console.log(((now-LastReceiverTimestamp)*1000).toFixed(0) + " " + diff +" "+ delay + "                  "+now);
		*/

		processReceiverUpdate(data);

		if (enable_uat) {
			$.when(FetchPendingUAT).done(function(data) {
				processReceiverUpdate(data, false, true);
			});
		}

		// update timestamps, visibility, history track for all planes - not only those updated
		for (var i = 0; i < PlanesOrdered.length; ++i) {
			var plane = PlanesOrdered[i];
			plane.updateTick(now, LastReceiverTimestamp);
		}

		selectNewPlanes();
		refreshTableInfo();
		refreshClock(new Date(now * 1000));
		refreshSelected();
		refreshHighlighted();

		// Check for stale receiver data
		if (LastReceiverTimestamp === now) {
			StaleReceiverCount++;
			if (StaleReceiverCount > 5) {
				$("#update_error_detail").text("The data from dump1090 hasn't been updated in a while. Maybe dump1090 is no longer running?");
				$("#update_error").css('display','block');
			}
		} else { 
			StaleReceiverCount = 0;
			LastReceiverTimestamp = now;
			$("#update_error").css('display','none');
		}
	});

	FetchPending.fail(function(jqxhr, status, error) {
		$("#update_error_detail").text("AJAX call failed (" + status + (error ? (": " + error) : "") + "). Maybe dump1090 is no longer running?");
		$("#update_error").css('display','block');
		fetchData();
	});
}



// this function is called from index.html on body load
// kicks off the whole rabbit hole
function initialize() {


	$.when(configureReceiver).done(function() {

		// Initialize stuff
		init_page();

		// Wait for history item downloads and append them to the buffer
		push_history();
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
		minWidth: 350
	});

	// Set up datablock splitter
	$('#selected_infoblock').resizable({
		handles: {
			s: '#splitter-infoblock'
		},
		containment: "#sidebar_container",
		minHeight: 50
	});

	$('#close-button').on('click', function() {
		if (SelectedPlane !== null) {
			var selectedPlane = Planes[SelectedPlane];
			SelectedPlane = null;
			selectedPlane.selected = null;
			selectedPlane.clearLines();
			selectedPlane.updateMarker();         
			refreshSelected();
			refreshHighlighted();
			$('#selected_infoblock').hide();
		}
	});

	// this is a little hacky, but the best, most consitent way of doing this. change the margin bottom of the table container to the height of the overlay
	$('#selected_infoblock').on('resize', function() {
		$('#sidebar_canvas').css('margin-bottom', $('#selected_infoblock').height() + 'px');
	});
	// look at the window resize to resize the pop-up infoblock so it doesn't float off the bottom or go off the top
	$(window).on('resize', function() {
		var topCalc = ($(window).height() - $('#selected_infoblock').height() - 60);
		// check if the top will be less than zero, which will be overlapping/off the screen, and set the top correctly. 
		if (topCalc < 0) {
			topCalc = 0;
			$('#selected_infoblock').css('height', ($(window).height() - 60) +'px');
		}
		$('#selected_infoblock').css('top', topCalc + 'px');
	});

	// to make the infoblock responsive 
	$('#sidebar_container').on('resize', function() {
		if ($('#sidebar_container').width() < 600) {
			$('#selected_infoblock').addClass('infoblock-container-small');
		} else {
			$('#selected_infoblock').removeClass('infoblock-container-small');
		}
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

	$('#altitude_checkbox').on('click', function() {
		toggleAltitudeChart(true);
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
		mapResizeTimeout = setTimeout(updateMapSize, 10);
	});

	filterGroundVehicles(false);
	filterBlockedMLAT(false);
	toggleAltitudeChart(false);
}



function push_history() {
	$("#loader_progress").attr('max',nHistoryItems*2);
	for (var i = 0; i < nHistoryItems; i++) {
		push_history_item(i);
	}
}

function push_history_item(i) {

	$.when(deferHistory[i])
		.done(function(json) {

			if (HistoryChunks) {
				for (var i in json.files) {
					PositionHistoryBuffer.push(json.files[i]);
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

	initialize_map();

	if (PositionHistoryBuffer.length > 0) {
		var now=0, last=0, uat_now, uat_last=0;

		// Sort history by timestamp
		console.log("Sorting history");
		PositionHistoryBuffer.sort(function(x,y) { return (x.now - y.now); });

		// Process history
		for (var h = 0; h < PositionHistoryBuffer.length; ++h) {
			var data = PositionHistoryBuffer[h];
			if (!data) {
				console.log("nothing in history buffer?!");
				//console.log(data);
				continue;
			}
			var uat = false;
			if (data.uat_978 && data.uat_978 == "true") {
				uat = true;
				uat_now = data.now;
			} else {
				now = data.now;
			}

			// process new data
			processReceiverUpdate(data, true, uat);

			// update aircraft tracks
			if (!uat) {
				for (var i = 0; i < PlanesOrdered.length; ++i) {
					var plane = PlanesOrdered[i];
					if (plane.uat)
						plane.updateTrack(uat_now, uat_last);
					else
						plane.updateTrack(now, last);
				}
			}


			// prune aircraft list
			var pruneInt = Math.floor(PositionHistoryBuffer.length/5);
			if(h % pruneInt == pruneInt - 1) {

				console.log("Applied history " + (h + 1) + "/"
					+ PositionHistoryBuffer.length + " from: "
					+ (new Date(now * 1000)).toLocaleTimeString());

				var newPlanes = [];
				for (var i = 0; i < PlanesOrdered.length; ++i) {
					var plane = PlanesOrdered[i];
					if (plane.seen > 600) {
						// Reap it.
						delete Planes[plane.icao];
						plane.destroy();
					} else {
						// Keep it.
						newPlanes.push(plane);
					}
				};

				PlanesOrdered = newPlanes;
			}

			if (uat) {
				uat_last = uat_now;
			} else {
				last = now;
				LastReceiverTimestamp = last;
			}

		}

		// Final pass to update all planes to their latest state
		console.log("Final history cleanup pass");
		for (var i = 0; i < PlanesOrdered.length; ++i) {
			var plane = PlanesOrdered[i];
			plane.updateTick(now, last, true);
		}


		for (var i in PlanesOrdered)
			setupPlane(PlanesOrdered[i].icao,PlanesOrdered[i]);

		LastReceiverTimestamp = last;
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

	// And kick off one refresh immediately.
	fetchData();

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
	CenterLat = Number(localStorage['CenterLat']) || DefaultCenterLat;
	CenterLon = Number(localStorage['CenterLon']) || DefaultCenterLon;
	ZoomLvl = Number(localStorage['ZoomLvl']) || DefaultZoomLvl;
	MapType = localStorage['MapType'];

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
		document.getElementById("infoblock_country").style.display = 'none'; // hide country row
	}

	// Initialize OL3

	layers = createBaseLayers();

	var iconsLayer = new ol.layer.Vector({
		name: 'ac_positions',
		type: 'overlay',
		title: 'Aircraft positions',
		source: new ol.source.Vector({
			features: PlaneIconFeatures,
		})
	});

	layers.push(new ol.layer.Group({
		title: 'Overlays',
		layers: [
			new ol.layer.Vector({
				name: 'site_pos',
				type: 'overlay',
				title: 'Site position and range rings',
				source: new ol.source.Vector({
					features: StaticFeatures,
				})
			}),

			new ol.layer.Vector({
				name: 'ac_trail',
				type: 'overlay',
				title: 'Selected aircraft trail',
				source: new ol.source.Vector({
					features: PlaneTrailFeatures,
				})
			}),

			iconsLayer
		]
	}));

	var foundType = false;
	var baseCount = 0;

	ol.control.LayerSwitcher.forEachRecursive(layers, function(lyr) {
		if (!lyr.get('name'))
			return;

		if (lyr.get('type') === 'base') {
			baseCount++;
			if (MapType === lyr.get('name')) {
				foundType = true;
				lyr.setVisible(true);
			} else {
				lyr.setVisible(false);
			}

			lyr.on('change:visible', function(evt) {
				if (evt.target.getVisible()) {
					MapType = localStorage['MapType'] = evt.target.get('name');
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
		ol.control.LayerSwitcher.forEachRecursive(layers, function(lyr) {
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
			zoom: ZoomLvl
		}),
		controls: [new ol.control.Zoom(),
			new ol.control.Rotate(),
			new ol.control.Attribution({collapsed: true}),
			new ol.control.ScaleLine({units: DisplayUnits})
		],
		loadTilesWhileAnimating: true,
		loadTilesWhileInteracting: true
	});

	if (baseCount > 1) {
		OLMap.addControl(new ol.control.LayerSwitcher());
	}

	// Listeners for newly created Map
	OLMap.getView().on('change:center', function(event) {
		var center = ol.proj.toLonLat(OLMap.getView().getCenter(), OLMap.getView().getProjection());
		localStorage['CenterLon'] = center[0]
		localStorage['CenterLat'] = center[1]
		if (FollowSelected) {
			// On manual navigation, disable follow
			var selected = Planes[SelectedPlane];
			if (typeof selected === 'undefined' ||
				(Math.abs(center[0] - selected.position[0]) > 0.0001 &&
					Math.abs(center[1] - selected.position[1]) > 0.0001)){
				FollowSelected = false;
				refreshSelected();
				refreshHighlighted();
			}
		}
	});

	OLMap.getView().on('change:resolution', function(event) {
		ZoomLvl = localStorage['ZoomLvl']  = OLMap.getView().getZoom();
		for (var plane in Planes) {
			Planes[plane].updateMarker(false);
		};
	});

	OLMap.on(['click', 'dblclick'], function(evt) {
		var hex = evt.map.forEachFeatureAtPixel(evt.pixel,
			function(feature, layer) {
				return feature.hex;
			},
			{ layerFilter: function(layer) {
				return (layer === iconsLayer);
			}});
		if (hex) {
			selectPlaneByHex(hex, (evt.type === 'dblclick'));
			adjustSelectedInfoBlockPosition();
			evt.stopPropagation();
		} else {
			deselectAllPlanes();
			evt.stopPropagation();
		}
	});


	// show the hover box
	OLMap.on('pointermove', function(evt) {
		var hex = evt.map.forEachFeatureAtPixel(evt.pixel,
			function(feature, layer) {
				return feature.hex;
			},
			{ layerFilter: function(layer) {
				return (layer === iconsLayer);
			}}
		);

		if (hex) {
			highlightPlaneByHex(hex);
		} else {
			removeHighlight();
		}

	})

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
		timeout: 5000,
		cache: true,
		dataType: 'json' });
	request.done(function(data) {
		var ringStyle = new ol.style.Style({
			fill: null,
			stroke: new ol.style.Stroke({
				color: '#0000DD',
				lineDash:[4,4],
				width: 2
			})
		});

		for (var i = 0; i < data.rings.length; ++i) {
			var geom = null;
			var points = data.rings[i].points;
			if (points.length > 0) {
				for (var j = 0; j < points.length; ++j) {
					if (!geom)
						geom = new ol.geom.LineString([[ points[j][1], points[j][0] ]]);
					else
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
		var circle = make_geodesic_circle(SitePosition, distance, 360);
		circle.transform('EPSG:4326', 'EPSG:3857');
		var feature = new ol.Feature(circle);
		feature.setStyle(circleStyle(distance));
		StaticFeatures.push(feature);
		SiteCircleFeatures.push(feature);
	}
}

// This looks for planes to reap out of the master Planes variable
function reaper() {
	//console.log("Reaping started..");

	// Look for planes where we have seen no messages for >300 seconds
	var newPlanes = [];
	for (var i = 0; i < PlanesOrdered.length; ++i) {
		var plane = PlanesOrdered[i];
		if (plane.seen > 600) {
			// Reap it.                                
			plane.tr.parentNode.removeChild(plane.tr);
			plane.tr = null;
			delete Planes[plane.icao];
			plane.destroy();
		} else {
			// Keep it.
			newPlanes.push(plane);
		}
	};

	PlanesOrdered = newPlanes;
	refreshTableInfo();
	refreshSelected();
	refreshHighlighted();
}

// Page Title update function
function refreshPageTitle() {
	if (!PlaneCountInTitle && !MessageRateInTitle) {
		document.title = PageName;
		return;
	}

	var subtitle = "";

	if (PlaneCountInTitle) {
		subtitle += TrackedAircraftPositions + '/' + TrackedAircraft;
	}

	if (MessageRateInTitle) {
		if (subtitle) subtitle += ' | ';
		subtitle += MessageRate.toFixed(1) + '/s';
	}

	document.title = PageName + ' - ' + subtitle;
}

// Refresh the detail window about the plane
function refreshSelected() {

	refreshPageTitle();

	var selected = false;
	if (typeof SelectedPlane !== 'undefined' && SelectedPlane != "ICAO" && SelectedPlane != null) {
		selected = Planes[SelectedPlane];
	}

	$('#dump1090_infoblock').css('display','block');
	$('#dump1090_version').text(Dump1090Version);
	$('#dump1090_total_ac').text(TrackedAircraft);
	$('#dump1090_total_ac_positions').text(TrackedAircraftPositions);
	$('#dump1090_total_history').text(TrackedHistorySize);

	if (MessageRate !== null) {
		$('#dump1090_message_rate').text(MessageRate.toFixed(1));
	} else {
		$('#dump1090_message_rate').text("n/a");
	}

	setSelectedInfoBlockVisibility();

	if (!selected) {
		return;
	}

	if (selected.flight !== null && selected.flight !== "") {
		$('#selected_callsign').text(selected.flight);
	} else {
		$('#selected_callsign').text('n/a');
	}
	$('#selected_flightaware_link').html(getFlightAwareModeSLink(selected.icao, selected.flight, "Visit Flight Page"));

	if (selected.registration !== null) {
		$('#selected_registration').text(selected.registration);
	} else {
		$('#selected_registration').text("n/a");
	}

	if (selected.icaotype !== null) {
		$('#selected_icaotype').text(selected.icaotype);
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

	$("#selected_altitude").text(format_altitude_long(selected.altitude, selected.vert_rate, DisplayUnits));

	$('#selected_onground').text(format_onground(selected.altitude));

	if (selected.squawk === null || selected.squawk === '0000') {
		$('#selected_squawk').text('n/a');
	} else {
		$('#selected_squawk').text(selected.squawk);
	}

	$('#selected_speed').text(format_speed_long(selected.gs, DisplayUnits));
	$('#selected_ias').text(format_speed_long(selected.ias, DisplayUnits));
	$('#selected_tas').text(format_speed_long(selected.tas, DisplayUnits));
	$('#selected_vertical_rate').text(format_vert_rate_long(selected.baro_rate, DisplayUnits));
	$('#selected_vertical_rate_geo').text(format_vert_rate_long(selected.geom_rate, DisplayUnits));
	$('#selected_icao').text(selected.icao.toUpperCase());
	$('#airframes_post_icao').attr('value',selected.icao);
	$('#selected_track').text(format_track_long(selected.track));

	if (selected.seen <= 1) {
		$('#selected_seen').text('now');
	} else {
		$('#selected_seen').text(selected.seen.toFixed(1) + 's');
	}

	$('#selected_country').text(selected.icaorange.country);
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

		if (selected.seen_pos > 1) {
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
	if (selected.uat) {
		$('#selected_source').text("UAT");
	} else if (selected.getDataSource() === "adsb_icao") {
		$('#selected_source').text("ADS-B");
	} else if (selected.getDataSource() === "tisb_trackfile" || selected.getDataSource() === "tisb_icao" || selected.getDataSource() === "tisb_other") {
		$('#selected_source').text("TIS-B");
	} else if (selected.getDataSource() === "mlat") {
		$('#selected_source').text("MLAT");
	} else {
		$('#selected_source').text("Other");
	}
	$('#selected_category').text(selected.category ? selected.category : "n/a");
	$('#selected_sitedist').text(format_distance_long(selected.sitedist, DisplayUnits));
	$('#selected_rssi').text(selected.rssi.toFixed(1) + ' dBFS');
	$('#selected_message_count').text(selected.messages);
	$('#selected_photo_link').html(getFlightAwarePhotoLink(selected.registration));

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

	if (highlighted.flight !== null && highlighted.flight !== "") {
		$('#highlighted_callsign').text(highlighted.flight);
	} else {
		$('#highlighted_callsign').text('n/a');
	}

	if (highlighted.icaotype !== null) {
		$('#higlighted_icaotype').text(highlighted.icaotype);
	} else {
		$('#higlighted_icaotype').text("n/a");
	}

	if (highlighted.uat) {
		$('#highlighted_source').text("UAT");
	} else if (highlighted.getDataSource() === "adsb_icao") {
		$('#highlighted_source').text("ADS-B");
	} else if (highlighted.getDataSource() === "tisb_trackfile" || highlighted.getDataSource() === "tisb_icao" || highlighted.getDataSource() === "tisb_other") {
		$('#highlighted_source').text("TIS-B");
	} else if (highlighted.getDataSource() === "mlat") {
		$('#highlighted_source').text("MLAT");
	} else {
		$('#highlighted_source').text("Other");
	}

	if (highlighted.registration !== null) {
		$('#highlighted_registration').text(highlighted.registration);
	} else {
		$('#highlighted_registration').text("n/a");
	}

	$('#highlighted_speed').text(format_speed_long(highlighted.speed, DisplayUnits));

	$("#highlighted_altitude").text(format_altitude_long(highlighted.altitude, highlighted.vert_rate, DisplayUnits));

	$('#highlighted_icao').text(highlighted.icao.toUpperCase());

	$('#highlighted_rssi').text(highlighted.rssi.toFixed(1) + ' dBFS');

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

	$(".altitudeUnit").text(get_unit_label("altitude", DisplayUnits));
	$(".speedUnit").text(get_unit_label("speed", DisplayUnits));
	$(".distanceUnit").text(get_unit_label("distance", DisplayUnits));
	$(".verticalRateUnit").text(get_unit_label("verticalRate", DisplayUnits));

	for (var i = 0; i < PlanesOrdered.length; ++i) {
		var tableplane = PlanesOrdered[i];
		TrackedHistorySize += tableplane.history_size;
		if (tableplane.seen >= 58 || tableplane.isFiltered()) {
			tableplane.tr.className = "plane_table_row hidden";
		} else {
			TrackedAircraft++;
			var classes = "plane_table_row";

			if (tableplane.position !== null && tableplane.seen_pos < 60) {
				++TrackedAircraftPositions;
			}

			if (tableplane.uat) {
				classes += " uat";
			} else if (tableplane.getDataSource() === "adsb_icao") {
				classes += " vPosition";
			} else if (tableplane.getDataSource() === "tisb_trackfile" || tableplane.getDataSource() === "tisb_icao" || tableplane.getDataSource() === "tisb_other") {
				classes += " tisb";
			} else if (tableplane.getDataSource() === "mlat") {
				classes += " mlat";
			} else {
				classes += " other";
			}

			if (tableplane.icao == SelectedPlane)
				classes += " selected";

			if (tableplane.squawk in SpecialSquawks) {
				classes = classes + " " + SpecialSquawks[tableplane.squawk].cssClass;
				show_squawk_warning = true;
			}			                

			// ICAO doesn't change
			if (tableplane.flight && tableplane.flight_cache != tableplane.flight) {
				tableplane.tr.cells[2].innerHTML = getFlightAwareModeSLink(tableplane.icao, tableplane.flight, tableplane.flight);
				tableplane.tr.cells[18].innerHTML = getFlightAwareModeSLink(tableplane.icao, tableplane.flight);
				tableplane.flight_cache = tableplane.flight;
			}
			tableplane.tr.cells[3].textContent = (tableplane.registration != null ? tableplane.registration : "");
			tableplane.tr.cells[4].textContent = (tableplane.icaotype != null ? tableplane.icaotype : "");
			tableplane.tr.cells[5].textContent = (tableplane.squawk != null ? tableplane.squawk : "");
			tableplane.tr.cells[6].textContent = format_altitude_brief(tableplane.altitude, tableplane.vert_rate, DisplayUnits);
			tableplane.tr.cells[7].textContent = format_speed_brief(tableplane.gs, DisplayUnits);
			tableplane.tr.cells[8].textContent = format_vert_rate_brief(tableplane.vert_rate, DisplayUnits);
			tableplane.tr.cells[9].textContent = format_distance_brief(tableplane.sitedist, DisplayUnits);
			tableplane.tr.cells[10].textContent = format_track_brief(tableplane.track);
			tableplane.tr.cells[11].textContent = tableplane.messages;
			tableplane.tr.cells[12].textContent = tableplane.seen.toFixed(0);
			tableplane.tr.cells[13].textContent = (tableplane.rssi != null ? tableplane.rssi.toFixed(1) : "");
			tableplane.tr.cells[14].textContent = (tableplane.position != null ? tableplane.position[1].toFixed(4) : "");
			tableplane.tr.cells[15].textContent = (tableplane.position != null ? tableplane.position[0].toFixed(4) : "");
			tableplane.tr.cells[16].textContent = format_data_source(tableplane.getDataSource());
			if (tableplane.icao_cache !== tableplane.icao) {
				tableplane.tr.cells[17].innerHTML = getAirframesModeSLink(tableplane.icao);
				tableplane.icao_cache = tableplane.icao;
			}
			if (tableplane.registration_cache !== tableplane.registration) {
				tableplane.tr.cells[19].innerHTML = getFlightAwarePhotoLink(tableplane.registration);
				tableplane.registration_cache = tableplane.registration;
				if (!tableplane.flight) {
					var label = tableplane.registration != null ? tableplane.registration : tableplane.icao.toUpperCase();
					tableplane.tr.cells[2].innerHTML = getFlightAwareModeSLink(tableplane.icao, tableplane.flight, label);
					tableplane.tr.cells[18].innerHTML = getFlightAwareModeSLink(tableplane.icao, label);
				}
			}

			tableplane.tr.className = classes;
		}
	}

	if (show_squawk_warning) {
		$("#SpecialSquawkWarning").css('display','block');
	} else {
		$("#SpecialSquawkWarning").css('display','none');
	}

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

function compareNumeric(xf,yf) {
	if (Math.abs(xf - yf) < 1e-9)
		return 0;

	return xf - yf;
}

function sortByICAO()     { sortBy('icao',    compareAlpha,   function(x) { return x.icao; }); }
function sortByFlight()   { sortBy('flight',  compareAlpha,   function(x) { return x.flight; }); }
function sortByRegistration()   { sortBy('registration',    compareAlpha,   function(x) { return x.registration; }); }
function sortByAircraftType()   { sortBy('icaotype',        compareAlpha,   function(x) { return x.icaotype; }); }
function sortBySquawk()   { sortBy('squawk',  compareAlpha,   function(x) { return x.squawk; }); }
function sortByAltitude() { sortBy('altitude',compareNumeric, function(x) { return (x.altitude == "ground" ? -1e9 : x.altitude); }); }
function sortBySpeed()    { sortBy('speed',   compareNumeric, function(x) { return x.gs; }); }
function sortByVerticalRate()   { sortBy('vert_rate',      compareNumeric, function(x) { return x.vert_rate; }); }
function sortByDistance() { sortBy('sitedist',compareNumeric, function(x) { return x.sitedist; }); }
function sortByTrack()    { sortBy('track',   compareNumeric, function(x) { return x.track; }); }
function sortByMsgs()     { sortBy('msgs',    compareNumeric, function(x) { return x.messages; }); }
function sortBySeen()     { sortBy('seen',    compareNumeric, function(x) { return x.seen; }); }
function sortByCountry()  { sortBy('country', compareAlpha,   function(x) { return x.icaorange.country; }); }
function sortByRssi()     { sortBy('rssi',    compareNumeric, function(x) { return x.rssi }); }
function sortByLatitude()   { sortBy('lat',   compareNumeric, function(x) { return (x.position !== null ? x.position[1] : null) }); }
function sortByLongitude()  { sortBy('lon',   compareNumeric, function(x) { return (x.position !== null ? x.position[0] : null) }); }
function sortByDataSource() { sortBy('data_source',     compareNumeric, function(x) { return x.getDataSourceNumber() } ); }

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
	// number the existing rows so we can do a stable sort
	// regardless of whether sort() is stable or not.
	// Also extract the sort comparison value.
	for (var i = 0; i < PlanesOrdered.length; ++i) {
		PlanesOrdered[i]._sort_pos = i;
		PlanesOrdered[i]._sort_value = sortExtract(PlanesOrdered[i]);
	}

	PlanesOrdered.sort(sortFunction);

	var tbody = document.getElementById('tableinfo').tBodies[0];
	var fragment = document.createDocumentFragment();
	for (var i = 0; i < PlanesOrdered.length; ++i) {
		fragment.appendChild(PlanesOrdered[i].tr);
	}
	tbody.appendChild(fragment);
}

function sortBy(id,sc,se) {
	if (id !== 'data_source') {
		$('#grouptype_checkbox').removeClass('settingsCheckboxChecked');
	} else {
		$('#grouptype_checkbox').addClass('settingsCheckboxChecked');
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

	if (SelectedPlane != null) {
		Planes[SelectedPlane].selected = false;
		Planes[SelectedPlane].clearLines();
		Planes[SelectedPlane].updateMarker();
		$(Planes[SelectedPlane].tr).removeClass("selected");
		// scroll the infoblock back to the top for the next plane to be selected
		$('.infoblock-container').scrollTop(0);
	}

	// If we are clicking the same plane, we are deselecting it.
	// (unless it was a doubleclick..)
	if (SelectedPlane === hex && !autofollow) {
		hex = null;
	}

	if (hex !== null) {
		// Assign the new selected
		SelectedPlane = hex;
		Planes[SelectedPlane].selected = true;
		Planes[SelectedPlane].updateLines();
		Planes[SelectedPlane].updateMarker();
		$(Planes[SelectedPlane].tr).addClass("selected");
	} else { 
		SelectedPlane = null;
	}

	if (SelectedPlane !== null && autofollow) {
		FollowSelected = true;
		if (OLMap.getView().getZoom() < 8)
			OLMap.getView().setZoom(8);
	} else {
		FollowSelected = false;
	} 

	refreshSelected();
	refreshHighlighted();
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
	} else {
		// If SelectedPlane has something in it, clear out the selected
		if (SelectedPlane != null) {
			Planes[SelectedPlane].selected = false;
			Planes[SelectedPlane].clearLines();
			Planes[SelectedPlane].updateMarker();
			$(Planes[SelectedPlane].tr).removeClass("selected");
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
	}

	$('#selectall_checkbox').addClass('settingsCheckboxChecked');

	refreshSelected();
	refreshHighlighted();
}

// on refreshes, try to find new planes and mark them as selected
function selectNewPlanes() {
	if (SelectedAllPlanes) {
		for (var key in Planes) {
			if (!Planes[key].visible || Planes[key].isFiltered()) {
				Planes[key].selected = false;
				Planes[key].clearLines();
				Planes[key].updateMarker();
			} else {
				if (Planes[key].selected !== true) {
					Planes[key].selected = true;
					Planes[key].updateLines();
					Planes[key].updateMarker();
				}
			}
		}
	}
}

// deselect all the planes
function deselectAllPlanes() {
	for(var key in Planes) {
		Planes[key].selected = false;
		Planes[key].clearLines();
		Planes[key].updateMarker();
		$(Planes[key].tr).removeClass("selected");
	}
	$('#selectall_checkbox').removeClass('settingsCheckboxChecked');
	SelectedPlane = null;
	SelectedAllPlanes = false;
	refreshSelected();
	refreshHighlighted();
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

	selectPlaneByHex(null,false);
}

function updateMapSize() {
	OLMap.updateSize();
}

function toggleSidebarVisibility(e) {
	e.preventDefault();
	$("#sidebar_container").toggle();
	$("#expand_sidebar_control").toggle();
	$("#toggle_sidebar_button").toggleClass("show_sidebar");
	$("#toggle_sidebar_button").toggleClass("hide_sidebar");
	updateMapSize();
}

function expandSidebar(e) {
	e.preventDefault();
	$("#map_container").hide()
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
	$("#map_container").show()
	$("#toggle_sidebar_control").show();
	$("#splitter").show();
	$("#sudo_buttons").show();
	$("#show_map_button").hide();
	$("#sidebar_container").width("470px");
	setColumnVisibility();
	setSelectedInfoBlockVisibility();
	updateMapSize();    
}

function showColumn(table, columnId, visible) {
	var index = $(columnId).index();
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
	var mapIsVisible = $("#map_container").is(":visible");
	var infoTable = $("#tableinfo");

	showColumn(infoTable, "#registration", !mapIsVisible);
	showColumn(infoTable, "#aircraft_type", !mapIsVisible);   
	showColumn(infoTable, "#vert_rate", !mapIsVisible);
	showColumn(infoTable, "#track", !mapIsVisible);
	showColumn(infoTable, "#lat", !mapIsVisible);
	showColumn(infoTable, "#lon", !mapIsVisible);
	showColumn(infoTable, "#data_source", !mapIsVisible);
	showColumn(infoTable, "#airframes_mode_s_link", !mapIsVisible);
	showColumn(infoTable, "#flightaware_mode_s_link", !mapIsVisible);
	showColumn(infoTable, "#flightaware_photo_link", !mapIsVisible);
}

function setSelectedInfoBlockVisibility() {
	var mapIsVisible = $("#map_container").is(":visible");
	var planeSelected = (typeof SelectedPlane !== 'undefined' && SelectedPlane != null && SelectedPlane != "ICAO");

	if (planeSelected && mapIsVisible) {
		$('#selected_infoblock').show();
		$('#sidebar_canvas').css('margin-bottom', $('#selected_infoblock').height() + 'px');
	}
	else {
		$('#selected_infoblock').hide();
		$('#sidebar_canvas').css('margin-bottom', 0);
	}
}

// Reposition selected plane info box if it overlaps plane marker
function adjustSelectedInfoBlockPosition() {
	if (typeof Planes === 'undefined' || typeof SelectedPlane === 'undefined' || Planes === null) {
		return;
	}

	var selectedPlane = Planes[SelectedPlane];

	if (selectedPlane === undefined || selectedPlane === null || selectedPlane.marker === undefined || selectedPlane.marker === null) {
		return;
	}

	try {
		// Get marker position
		var marker = selectedPlane.marker;
		var markerCoordinates = selectedPlane.marker.getGeometry().getCoordinates();
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
	catch(e) { }
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
	refreshTableInfo();
	refreshSelected();
	refreshHighlighted();

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

	updatePlaneFilter();
	refreshTableInfo();

	var selectedPlane = Planes[SelectedPlane];
	if (selectedPlane !== undefined && selectedPlane !== null && selectedPlane.isFiltered()) {
		SelectedPlane = null;
		selectedPlane.selected = false;
		selectedPlane.clearLines();
		selectedPlane.updateMarker();         
		refreshSelected();
		refreshHighlighted();
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
	} while (this_one.isFiltered() || !this_one.position || (LastReceiverTimestamp - this_one.last_position_time > 30));
	//console.log(this_one.icao);
	selectPlaneByHex(this_one.icao, true);
}


function onResetAltitudeFilter(e) {
	$("#altitude_filter_min").val("");
	$("#altitude_filter_max").val("");

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

	PlaneFilter.minAltitude = minAltitude;
	PlaneFilter.maxAltitude = maxAltitude;
	PlaneFilter.altitudeUnits = DisplayUnits;
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

function getAirframesModeSLink(code) {
	if (code !== null && code.length > 0 && code[0] !== '~' && code !== "000000") {
		return "<a href=\"http://www.airframes.org/\" onclick=\"$('#airframes_post_icao').attr('value','" + code + "'); document.getElementById('horrible_hack').submit.call(document.getElementById('airframes_post')); return false;\">Airframes.org: " + code.toUpperCase() + "</a>";
	}

	return "";   
}


// takes in an elemnt jQuery path and the OL3 layer name and toggles the visibility based on clicking it
function toggleLayer(element, layer) {
	// set initial checked status
	ol.control.LayerSwitcher.forEachRecursive(layers, function(lyr) { 
		if (lyr.get('name') === layer && lyr.getVisible()) {
			$(element).addClass('settingsCheckboxChecked');
		}
	});
	$(element).on('click', function() {
		var visible = false;
		if ($(element).hasClass('settingsCheckboxChecked')) {
			visible = true;
		}
		ol.control.LayerSwitcher.forEachRecursive(layers, function(lyr) { 
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
