// --------------------------------------------------------
//
// This file is to configure the configurable settings.
//
// --------------------------------------------------------
"use strict";
// -- Title Settings --------------------------------------
// Show number of aircraft and/or messages per second in the page title
//PlaneCountInTitle = false;
//MessageRateInTitle = false;

// -- Output Settings -------------------------------------
// The DisplayUnits setting controls whether nautical (ft, nmi, kt),
// metric (m, km, km/h) or imperial (ft, mi, mph) units are used in the
// plane table and in the detailed plane info. Valid values are
// "nautical", "metric", or "imperial".
//DisplayUnits = "nautical";

// -- Map settings ----------------------------------------
// These settings are overridden by any position information
// provided by dump1090 itself. All positions are in decimal
// degrees.

// The google maps zoom level, 0 - 16, lower is further out
//DefaultZoomLvl   = 7;

// specify lat lon that the 'auto-select plane' feature will choose the closest plane to
// autoselectCoords = [42, 21];

//SiteShow    = false;           // true to show a center marker
//SiteName    = "My Radar Site"; // tooltip of the marker

// Update GPS location (keep map centered on GPS location)
//updateLocation = false;

// Color controls for the range outline
//range_outline_color = '#0000DD';
//range_outline_alpha = 1.0;
//range_outline_width = 1.7;
//range_outline_colored_by_altitude = false;
// NOTE: dashed lines cause slowdown when zooming in, not recommended
//range_outline_dash = [5, 5]; // null - solid line, [5, 5] - dashed line with 5 pixel lines and spaces in between
//
//
// Style controls for the actal range outline:
// actual_range_outline_color = '#00596b';
// actual_range_outline_width = 1.7;
// NOTE: dashed lines cause slowdown when zooming in, not recommended
// actual_range_outline_dash = null; // null - solid line, [5, 5] - dashed line with 5 pixel lines and spaces in between

// Enable / disable showing the actual range outline when first visiting the page
// actual_range_show = true;

// which map is displayed to new visitors
// MapType_tar1090 = "carto_light_all";
//
// valid values for the above setting:
// osm
// esri
// carto_light_all
// carto_light_nolabels
// carto_dark_all
// carto_dark_nolabels
// gibs
// osm_adsbx
// chartbundle_sec: "Sectional Charts",
// chartbundle_tac: "Terminal Area Charts",
// chartbundle_hel: "Helicopter Charts",
// chartbundle_enrl: "IFR Enroute Low Charts",
// chartbundle_enra: "IFR Area Charts",
// chartbundle_enrh: "IFR Enroute High Charts"
//
// only with bing key:
// bing_aerial
// bing_roads


// default these overlays to on for visitors which haven't disabled them in the browser in a previous session
// defaultOverlays = ['radolan', 'nexrad'];

// change which product from DWD to use
// dwdLayers = 'dwd:RX-Produkt';

// Default map dim state, true or false.
// MapDim = true;
// mapDimPercentage = 0.45;
// mapContrastPercentage = 0;

// opacities for various overlays
// nexradOpacity = 0.35
// dwdRadolanOpacity = 0.30;
// rainViewerRadarOpacity = 0.30;
// rainViewerCloudsOpacity = 0.30;
// noaaInfraredOpacity = 0.35;
// noaaRadarOpacity = 0.35;
// openAIPOpacity = 0.70;
// tfrOpacity = 0.70;

// -- Marker settings -------------------------------------
// (marker == aircraft icon)

// aircraft icon opacity (normal and while the user is moving the map)
// webglIconOpacity = 1.0;
// webglIconMapMoveOpacity = 1.0;

// if more than by default 2000 aircraft are on the screen, reduce icon opacity when moving the screen:
// webglIconMapMoveOpacityCrowded = 0.25;
// webglIconMapMoveOpacityCrowdedThreshold = 2000;

// different marker size depending on zoom lvl
// markerZoomDivide = 8.5;
// marker size when the zoom level is less than markerZoomDivide
// markerSmall = 1;
// marker size when the zoom level is more than markerZoomDivide
// markerBig = 1.18;

//largeMode = 1;

//lineWidth = 1;
//
// Outline color for aircraft icons
// OutlineADSBColor = '#000000';

// Outline width for aircraft icons
// outlineWidth = 1;

// constant html color for markers / tracks
//monochromeMarkers = "#FFFFFF";
//monochromeTracks = "#000000";
//

// altitudeChartDefaultState = true;

// These settings control the coloring of aircraft by altitude.
// All color values are given as Hue (0-359) / Saturation (0-100) / Lightness (0-100)
//
// To enable these colors instead of the defaults, remove the /* and */ above and below the next block

/*

ColorByAlt = {
	// HSL for planes with unknown altitude:
	unknown : { h: 0,   s: 0,   l: 75 },

	// HSL for planes that are on the ground:
	ground  : { h: 0, s: 0, l: 45 },

	air : {
		// These define altitude-to-hue mappings
		// at particular altitudes; the hue
		// for intermediate altitudes that lie
		// between the provided altitudes is linearly
		// interpolated.
		//
		// Mappings must be provided in increasing
		// order of altitude.
		//
		// Altitudes below the first entry use the
		// hue of the first entry; altitudes above
		// the last entry use the hue of the last
		// entry.
		h: [ { alt: 2000,  val: 20 },    // orange
			 { alt: 10000, val: 140 },   // light green
			 { alt: 40000, val: 300 } ], // magenta
		s: 88,
		l: 44,
	},

	// Changes added to the color of the currently selected plane
	selected : { h: 0, s: -10, l: +20 },

	// Changes added to the color of planes that have stale position info
	stale :    { h: 0, s: -10, l: +30 },

	// Changes added to the color of planes that have positions from mlat
	mlat :     { h: 0, s: -10, l: -10 }
};

*/

// For a monochrome display try this:
// ColorByAlt = {
//         unknown :  { h: 0, s: 0, l: 40 },
//         ground  :  { h: 0, s: 0, l: 30 },
//         air :      { h: [ { alt: 0, val: 0 } ], s: 0, l: 50 },
//         selected : { h: 0, s: 0, l: +30 },
//         stale :    { h: 0, s: 0, l: +30 },
//         mlat :     { h: 0, s: 0, l: -10 }
// };

// Range rings

// Also called range rings :)
//SiteCircles = true; // true to show circles (only shown if the center marker is shown)
// In miles, nautical miles, or km (depending settings value 'DisplayUnits')
//SiteCirclesDistances = new Array(100,150,200,250);
// When more circles defined than cirle colors last color will be used or black by default
//SiteCirclesColors = ['#FF0000', '#0000FF', '#00FF00'];
// Show circles using dashed line (CAUTION, can be slow, especially when zooming in a lot)
//SiteCirclesLineDash = [5, 5]; // null - solid line, [5, 5] - dashed line with 5 pixel lines and spaces in between

// Controls page title, righthand pane when nothing is selected
//PageName = "tar1090";

// Show country flags by ICAO addresses?
//ShowFlags = true;

// Set to false to disable the ChartBundle base layers (US coverage only)
//ChartBundleLayers = true;

// Provide a Bing Maps API key here to enable the Bing imagery layer.
// You can obtain a free key (with usage limits) at
// https://www.bingmapsportal.com/ (you need a "basic key")
//
// Be sure to quote your key:
//   BingMapsAPIKey = "your key here";
//
BingMapsAPIKey = null;

// Provide a Mapbox API key here to enable the Mapbox vector layers.
// You can obtain a free key (with usage limits) at
// https://www.mapbox.com/
//
// Be sure to quote your key:
//   MapboxAPIKey = "your key here";
//
MapboxAPIKey = null;

// This determines what is up, default is north (0 degrees)
//mapOrientation = 0;

// Use UTC for live labels
// utcTimesLive = false;

// Use UTC for historic labels
// utcTimesHistoric = true;

// Only display labels when zoomed in this far:
//labelZoom = 8;
//labelZoomGround = 12.5;

//labelFont = 'bold 12px tahoma';

//displayUATasADSB = false;
//uatNoTISB = true;

// Don't display any TIS-B planes
// filterTISB = false;

// image configuration link (back to a webUI for feeder setup)
// if the link is supposed to point to the same host that tar1090
// is running on the token 'HOSTNAME' (without quotes) in the Link
// text will be replaced with the current hostname at runtime
//
// imageConfigLink = "";
// imageConfigText = "";

//flightawareLinks = false;
//shareBaseUrl = 'https://adsb.lol/';
//shareBaseUrl = 'https://globe.adsb.fi/';
//shareBaseUrl = 'https://globe.airplanes.live/';
//shareBaseUrl = 'https://globe.adsbexchange.com/';
// planespottersLinks = false;

// show links to various registration websites (not all countries)
// registrationLinks = true;

// Filter implausible positions (required speed > Mach 3.5)
// valid values: true, false, "onlyMLAT" ("" required)
// positionFilter = true;
// positionFilterSpeed = 3.5; // in Mach
// filter speed is based on transmitted ground speed if available
// this factor is used to give the actual filter speed
// positionFilterGsFactor = 1.8;
// debugPosFilter = false; // draw red dots for filtered positions

// altitudeFilter = true;

// time in seconds before an MLAT position is accepted after receiving a
// more reliable position
//mlatTimeout = 30;

// enable/disable mouseover/hover aircraft information
//enableMouseover = true;

// enable/disable temporary aircraft trails
//tempTrails = false;
//tempTrailsTimeout = 90;
//squareMania = false;

// Columns that have a // in front of them are shown.
/* // remove this line to mofify columns (and the one at the end)
HideCols = [
	"#icao",
//	"#country",
//	"#flight",
//	"#route",
	"#registration",
//	"#type",
//	"#squawk",
//	"#altitude",
//	"#speed",
	"#vert_rate",
//	"#sitedist",
	"#track",
	"#msgs",
	"#seen",
//	"#rssi",
	"#lat",
	"#lon",
	"#data_source",
	"#military",
    "#wd",
    "#ws",
]
*/ // remove this line to modify columns (and the one at the start)

// show aircraft pictures
// showPictures = true;
// get pictures from planespotters.net
// planespottersAPI = true;
// get pictures from planespotting.be
// planespottingAPI = true;

// get flight route from routeApi service default setting (toggle via settings checkbox)
// useRouteAPI = false;
// which routeApi service to use
// routeApiUrl = "https://adsb.im/api/0/routeset";
// routeApiUrl = "https://api.adsb.lol/api/0/routeset";
// routeApiUrl = ""; // to disable route API so it can't be enabled by a website visitor

// show a link to jetphotos, only works if planespottersAPI is disabled
// jetphotoLinks = false;

// showSil = false;
// this shows small pictures in the details but they need to be provided by the user in the folder /usr/local/share/tar1090/aircraft_sil
// showPictures needs to be enabled as well
// to only get these pictures disable the planespottersAPI
// pictures need to be named A330.png and so forth with the type code in the form TYPE.png
// provide ZZZZ.png to be shown when the type is not known.
// this feature is provided as is please don't expect tar1090's support for getting the pictures right.

// labelsGeom = false; // labels: uses geometric altitude (WGS84 ellipsoid unless geomUseEGM is enabled
// geomUseEGM = false; // use EGM96 for displaying geometric altitudes (extra load time!)
// baroUseQNH = false;

// windLabelsSlim = false;
// showLabelUnits = true;
//
// wideInfoBlock = false;
// baseInfoBlockWidth = 200;

//enableDWD = true;

// Display only the last leg of a flight in globeIndex mode.
//lastLeg = true;
//
//hideButtons = false;
//
//askLocation = false;  // requires https for geolocation (browsers require it)
//
//filterMaxRange = 50; // don't show aircraft further than 50 nmi from the receiver
//
//
//darkModeDefault = true; // turn on dark mode by default (change in browser possible)
//
//
//jaeroTimeout = 35 * 60; // in seconds

//seenTimeout = 58; // in seconds
//seenTimeoutMlat = 58; // in seconds

//tableInView = false; // only show aircraft in current view (V button)

//audio_url = ["", "", "", "", "", ""]; // show html5 audio player for these URLs
// example with titles: audio_url = [ ["URL1", "title1" ], ["URL2", "title2"] ];

// aiscatcher_server = "http://192.168.1.113:8100"; // update with your server address
// aiscatcher_refresh = 15; // refresh interval in seconds
// aisTimeout = 1200;

// droneJson = "";
// droneRefresh = 1;

// icaoFilter = [ "123456", "888888" ]; // only show these icaos
// icaoBlacklist = [ "123456", "888888" ]; // never show these icaos

/*
tableColors = {
    unselected: {
        adsb: "#d8f4ff",
        mlat:      "#FDF7DD",
        uat:       "#C4FFDC",
        satellite: "#C4FFDC",
        other:     "#d8d8ff",
        tisb:      "#ffd8e6",
        unknown:   "#dcdcdc",
        squawk7500:"#ff5555",
        squawk7600:"#00ffff",
        squawk7700:"#ffff00",
    },
    selected: {
        adsb:      "#88DDFF",
        mlat:      "#F1DD83",
        uat:       "#66FFA6",
        satellite: "#66FFA6",
        other:     "#BEBEFF",
        tisb:      "#FFC1D8",
        unknown:   "#bcbcbc",
    },
};
*/


// disableGeoLocation = false;

// when data is available from both 1090 and 978, give some preference to the 978 data for up to X seconds old 978 data (set this to 15 or 30 for example)
//prefer978 = 0;
//
// dynGlobeRate = false; // enable use of globeRates.json in index.html directory to steer client refresh rate

// !!! Please set the latitude / longitude in the decoder rather than
// setting it here !!!
// (graphs1090 will get the location from the decoder)
//SiteLat     = 45.0;            // position of the marker
//SiteLon     = 9.0;
// Default center of the map if no Site location is set
//DefaultCenterLat = 45.0;
//DefaultCenterLon = 9.0;
