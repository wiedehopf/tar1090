// --------------------------------------------------------
//
// This file is for the default settings, use config.js instead to make settings.
//
// --------------------------------------------------------
"use strict";

// avoid errors for people who don't understand javascript and change config.js
let yes = true;
let no = false;
let enabled = true;
let disabled = false;

// -- Title Settings --------------------------------------
// Show number of aircraft and/or messages per second in the page title
let PlaneCountInTitle = false;
let MessageRateInTitle = false;

// -- Output Settings -------------------------------------
// The DisplayUnits setting controls whether nautical (ft, nmi, kt),
// metric (m, km, km/h) or imperial (ft, mi, mph) units are used in the 
// plane table and in the detailed plane info. Valid values are
// "nautical", "metric", or "imperial".
let DisplayUnits = "nautical";

// -- Map settings ----------------------------------------
// These settings are overridden by any position information
// provided by dump1090 itself. All positions are in decimal
// degrees.

// Default center of the map.
let DefaultCenterLat = 40.56;
let DefaultCenterLon = -73.66
// The google maps zoom level, 0 - 16, lower is further out
let DefaultZoomLvl   = 9;

let showGrid = false;

// Center marker. If dump1090 provides a receiver location,
// that location is used and these settings are ignored.

let SiteShow    = true;           // true to show a center marker
let SiteLat     = null;            // position of the marker
let SiteLon     = null;
let SiteName    = "My Radar Site"; // tooltip of the marker

// Color controls for the range outline
let range_outline_color = '#0000DD';
let range_outline_width = 1.7;
let range_outline_colored_by_altitude = false;
let range_outline_dash = null; // null - solid line, [5, 5] - dashed line with 5 pixel lines and spaces in between

// Style controls for the actal range outline:
let actual_range_outline_color = '#00596b';
let actual_range_outline_width = 1.7;
let actual_range_outline_dash = null; // null - solid line, [5, 5] - dashed line with 5 pixel lines and spaces in between
//
let actual_range_show = true;

// which map is displayed to new visitors
let MapType_tar1090 = "osm_adsbx";
let defaultOverlays = [];
let dwdLayers = 'dwd:RX-Produkt';

// Default map dim state
let MapDim = true;
let mapDimPercentage = 0.45;
let mapContrastPercentage = 0;

let offlineMapDetail = -1;

// -- Marker settings -------------------------------------

// different marker size depending on zoom lvl
let markerZoomDivide = 8.5;
// marker size when the zoom level is less than markerZoomDivide
let markerSmall = 1;
// marker size when the zoom level is more than markerZoomDivide
let markerBig = 1.18;

let largeMode = 1;

let lineWidth = 1.15;

// Outline color for aircraft icons
let OutlineADSBColor = '#000000';

// Outline width for aircraft icons
let outlineWidth = 1;

// constant html color for markers / tracks
let monochromeMarkers = null;
let monochromeTracks = null;

// These settings control the coloring of aircraft by altitude.
// All color values are given as Hue (0-359) / Saturation (0-100) / Lightness (0-100)
let ColorByAlt = {
	// HSL for planes with unknown altitude:
	unknown : { h: 0,   s: 0,   l: 20 },

	// HSL for planes that are on the ground:
	ground  : { h: 220, s: 0, l: 30 },

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
		h: [ { alt: 0,  val: 20 },    // orange
			{ alt: 2000, val: 32.5 },   // yellow
			{ alt: 4000, val: 43 },   // yellow
			{ alt: 6000, val: 54 },   // yellow
			{ alt: 8000, val: 72 },   // yellow
			{ alt: 9000, val: 85 },   // green yellow
			{ alt: 11000, val: 140 },   // light green
			{ alt: 40000, val: 300 } , // magenta
			{ alt: 51000, val: 360 } , // red
		],
		s: 88,
		l: [
			{ h: 0,   val: 53},
			{ h: 20,  val: 50},
			{ h: 32,  val: 54},
			{ h: 40,  val: 52},
			{ h: 46,  val: 51},
			{ h: 50,  val: 46},
			{ h: 60,  val: 43},
			{ h: 80,  val: 41},
			{ h: 100, val: 41},
			{ h: 120, val: 41},
			{ h: 140, val: 41},
			{ h: 160, val: 40},
			{ h: 180, val: 40},
			{ h: 190, val: 44},
			{ h: 198, val: 50},
			{ h: 200, val: 58},
			{ h: 220, val: 58},
			{ h: 240, val: 58},
			{ h: 255, val: 55},
			{ h: 266, val: 55},
			{ h: 270, val: 58},
			{ h: 280, val: 58},
			{ h: 290, val: 47},
			{ h: 300, val: 43},
			{ h: 310, val: 48},
			{ h: 320, val: 48},
			{ h: 340, val: 52},
			{ h: 360, val: 53},
		],
	},

	// Changes added to the color of the currently selected plane
	selected : { h: 0, s: 10, l: 5 },

	// Changes added to the color of planes that have stale position info
	stale :    { h: 0, s: -35, l: 9 },

	// Changes added to the color of planes that have positions from mlat
	mlat :     { h: 0, s: 0, l: 0 }
};

// For a monochrome display try this:
// ColorByAlt = {
//         unknown :  { h: 0, s: 0, l: 40 },
//         ground  :  { h: 0, s: 0, l: 30 },
//         air :      { h: [ { alt: 0, val: 0 } ], s: 0, l: 50 },
//         selected : { h: 0, s: 0, l: +30 },
//         stale :    { h: 0, s: 0, l: +30 },
//         mlat :     { h: 0, s: 0, l: -10 }
// };

// Also called range rings :)
let SiteCircles = true; // true to show circles (only shown if the center marker is shown)
// In miles, nautical miles, or km (depending settings value 'DisplayUnits')
let SiteCirclesDistances = new Array(100, 150, 200);
// When more circles defined than cirle colors last color will be used or black by default
let SiteCirclesColors = ['#000000', '#000000', '#000000'];
// Show circles using dashed line (CAUTION, can be slow, especially when zooming in a lot)
let SiteCirclesLineDash = null; // null - solid line, [5, 5] - dashed line with 5 pixel lines and spaces in between

// Controls page title, righthand pane when nothing is selected
let PageName = "tar1090";

// Show country flags by ICAO addresses?
let ShowFlags = true;

// Path to country flags (can be a relative or absolute URL; include a trailing /)
let FlagPath = "flags-tiny/";

// Set to false to disable the ChartBundle base layers (US coverage only)
let ChartBundleLayers = true;

// Provide a Bing Maps API key here to enable the Bing imagery layer.
// You can obtain a free key (with usage limits) at
// https://www.bingmapsportal.com/ (you need a "basic key")
//
// Be sure to quote your key:
//   BingMapsAPIKey = "your key here";
//
let BingMapsAPIKey = null;

let pf_data = ["chunks/pf.json"]

let mapOrientation = 0; // This determines what is up, normally north (0 degrees)

// NO LONGER USED
let utcTimes = null;

// Use UTC for live labels
let utcTimesLive = false;

// Use UTC for historic labels
let utcTimesHistoric = true;

// Only display labels when zoomed in this far:
let labelZoom = 0;
let labelZoomGround = 14.8;

let labelFont = 'bold 12px tahoma';

let displayUATasADSB = false;
let uatNoTISB = false;

// Don't display any TIS-B planes
let filterTISB = false;

let flightawareLinks = false;
let shareBaseUrl = false;
let planespottersLinks = false;

// show links to various registration websites (not all countries)
let registrationLinks = true;

// Filter implausible positions (required speed > Mach 2.5)
// valid values: true, false, "onlyMLAT" ("" required)
let positionFilter = false;
let positionFilterSpeed = 2.5; // in Mach
// filter speed is based on transmitted ground speed if available
// this factor is used to give the actual filter speed
let positionFilterGsFactor = 2.2;
let debugPosFilter = false;

let altitudeFilter = false;

// time in seconds before an MLAT position is accepted after receiving a
// more reliable position
let mlatTimeout = 30;

// enable/disable mouseover/hover aircraft information
let enableMouseover = true;

// enable/disable temporary aircraft trails
let tempTrails = false;
let tempTrailsTimeout = 90;
let squareMania = false;

// Columns that have a // in front of them are shown.
let HideCols = [
	"#icao",
//	"#flag",
//	"#flight",
	"#registration",
//	"#aircraft_type",
//	"#squawk",
//	"#altitude",
//	"#speed",
	"#vert_rate",
//	"#distance",
	"#track",
	"#msgs",
	"#seen",
//	"#rssi",
	"#lat",
	"#lon",
	"#data_source",
	"#military",
]


// show aircraft pictures
let showPictures = true;
// get pictures from planespotters.net
let planespottersAPI = true;
// get pictures from planespotting.be
let planespottingAPI = false;

// show a link to jetphotos, only works if planespottersAPI is disabled
let jetphotoLinks = false;

let showSil = false;
// this shows small pictures in the details but they need to be provided by the user in the folder /usr/local/share/tar1090/aircraft_sil
// showPictures needs to be enabled as well
// to only get these pictures disable the planespottersAPI
// pictures need to be named A330.png and so forth with the type code in the form TYPE.png
// provide ZZZZ.png to be shown when the type is not known.
// this feature is provided as is please don't expect tar1090's support for getting the pictures right.

let labelsGeom = false; // labels: uses geometric altitude (WGS84 ellipsoid unless geomUseEGM is enabled
let geomUseEGM = false; // use EGM96 for displaying geometric altitudes (extra load time!)

let windLabelsSlim = false;
let showLabelUnits = true;

let wideInfoBlock = false;
let baseInfoBlockWidth = 200;

// enable DWD Radolan (NEXRAD like weather for Germany)
let enableDWD = true;

let lastLeg = true;

let hideButtons = false;

let askLocation = false; // requires https for geolocation

let filterMaxRange = 1e8; // 100 000 km should include all planes on earth ;)

let jaeroTimeout = 35 * 60; // in seconds

let seenTimeout = 58; // in seconds
let seenTimeoutMlat = 58; // in seconds

let darkModeDefault = true; // turn on dark mode by default (change in browser possible)

let tableInView = false; // only show aircraft in current view (V button)

// legacy variables
let OutlineMlatColor = null;

let tableColorsDark;
let tableColorsLight;
let tableColors = {
    unselected: {
        adsb:      "#d8f4ff",
        mlat:      "#FDF7DD",
        uat:       "#C4FFDC",
        adsr:      "#C4FFDC",
        adsc:      "#C4FFDC",
        modeS:     "#d8d8ff",
        tisb:      "#ffd8e6",
        unknown:   "#dcdcdc",
        other:   "#dcdcdc",
    },
    selected: {
        adsb:      "#88DDFF",
        mlat:      "#F1DD83",
        uat:       "#66FFA6",
        adsr:      "#66FFA6",
        adsc:      "#66FFA6",
        modeS:     "#BEBEFF",
        tisb:      "#FFC1D8",
        unknown:   "#bcbcbc",
        other:   "#bcbcbc",
    },
    special: {
        7500:      "#ff0000",
        7600:      "#ff0000",
        7700:      "#ff0000",
    }
};

let disableGeoLocation = false;

// when data is available from both 1090 and 978, give some preference to the 978 data for up to X seconds old 978 data (set this to 15 or 30 for example)
let prefer978 = 0;


let dynGlobeRate = false; // enable use of globeRates.json in index.html directory to steer client refresh rate
