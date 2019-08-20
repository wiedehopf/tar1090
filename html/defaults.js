// --------------------------------------------------------
//
// This file is for the default settings, use config.js instead to make settings.
//
// --------------------------------------------------------
"use strict";
// -- Title Settings --------------------------------------
// Show number of aircraft and/or messages per second in the page title
var PlaneCountInTitle = true;
var MessageRateInTitle = false;

// -- Output Settings -------------------------------------
// The DisplayUnits setting controls whether nautical (ft, NM, knots), 
// metric (m, km, km/h) or imperial (ft, mi, mph) units are used in the 
// plane table and in the detailed plane info. Valid values are
// "nautical", "metric", or "imperial".
var DisplayUnits = "nautical";

// -- Map settings ----------------------------------------
// These settings are overridden by any position information
// provided by dump1090 itself. All positions are in decimal
// degrees.

// Default center of the map.
var DefaultCenterLat = 45.0;
var DefaultCenterLon = 9.0;
// The google maps zoom level, 0 - 16, lower is further out
var DefaultZoomLvl   = 7;

// Center marker. If dump1090 provides a receiver location,
// that location is used and these settings are ignored.

var SiteShow    = false;           // true to show a center marker
var SiteLat     = 45.0;            // position of the marker
var SiteLon     = 9.0;
var SiteName    = "My Radar Site"; // tooltip of the marker

// Color controls for the range outline
var range_outline_color = '#0000DD';
var range_outline_width = 1.7;
var range_outline_colored_by_altitude = false;

// -- Marker settings -------------------------------------

// These settings control the coloring of aircraft by altitude.
// All color values are given as Hue (0-359) / Saturation (0-100) / Lightness (0-100)
var ColorByAlt = {
	// HSL for planes with unknown altitude:
	unknown : { h: 0,   s: 0,   l: 60 },

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
			{ h: 0,   val: 54},
			{ h: 20,  val: 50},
			{ h: 40,  val: 44},
			{ h: 60,  val: 42},
			{ h: 80,  val: 42},
			{ h: 100, val: 42},
			{ h: 120, val: 43},
			{ h: 140, val: 43},
			{ h: 160, val: 41},
			{ h: 180, val: 41},
			{ h: 200, val: 48},
			{ h: 220, val: 53},
			{ h: 240, val: 55},
			{ h: 260, val: 51},
			{ h: 280, val: 51},
			{ h: 290, val: 49},
			{ h: 300, val: 44},
			{ h: 310, val: 49},
			{ h: 320, val: 50},
			{ h: 340, val: 54},
			{ h: 360, val: 56},
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

// Outline color for aircraft icons with an ADS-B position
var OutlineADSBColor = '#000000';

// Outline color for aircraft icons with a mlat position
var OutlineMlatColor = '#001F66';

var SiteCircles = true; // true to show circles (only shown if the center marker is shown)
// In miles, nautical miles, or km (depending settings value 'DisplayUnits')
var SiteCirclesDistances = new Array(100,150,200,250);

// Controls page title, righthand pane when nothing is selected
var PageName = "dump1090-fa";

// Show country flags by ICAO addresses?
var ShowFlags = true;

// Path to country flags (can be a relative or absolute URL; include a trailing /)
var FlagPath = "flags-tiny/";

// Set to false to disable the ChartBundle base layers (US coverage only)
var ChartBundleLayers = true;

// Provide a Bing Maps API key here to enable the Bing imagery layer.
// You can obtain a free key (with usage limits) at
// https://www.bingmapsportal.com/ (you need a "basic key")
//
// Be sure to quote your key:
//   BingMapsAPIKey = "your key here";
//
var BingMapsAPIKey = null;

// Turn on display of extra Mode S EHS / ADS-B v1/v2 data
// This is not polished yet (and so is disabled by default),
// currently it's just a data dump of the new fields with no UX work.
var ExtendedData = false;
var pf_data = ["chunks/pf.json"]
/*
60
54
44
38
40
42
42
42
41
40
48
59
64
60
56
50
44
51
52
58
60

old:
69
60
45
36
39
41
42
42
40
39
51
67
74
69
62
54
45
55
57
65
69
*/
