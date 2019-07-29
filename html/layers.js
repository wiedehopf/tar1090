// -*- mode: javascript; indent-tabs-mode: nil; c-basic-offset: 8 -*-
"use strict";

// Base layers configuration
			//			"url" : "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png"
			//			"url" : "http://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
			//			"url" : "http://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
			//			"url" : "https://korona.geog.uni-heidelberg.de/tiles/roads/x={x}&y={y}&z={z}"
			//			"url" : "https://korona.geog.uni-heidelberg.de/tiles/asterh/x={x}&y={y}&z={z}"
			//			"url" : "https://{a-c}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png"
			//			"url" : "http://{a-c}.tilessputnik.ru/tiles/kmt2/{z}/{x}/{y}.png"
			//			"url" : "https://{a-c}.tile.openstreetmap.se/hydda/full/{z}/{x}/{y}.png"
			//			"url" : "https://{a-c}.tile.openstreetmap.se/osm/{z}/{x}/{y}.png"

function createBaseLayers() {
	var layers = [];

	var world = [];
	var us = [];

	//		opacity: 0.9,
	world.push(new ol.layer.Tile({
		source: new ol.source.OSM({
			"url" : "https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png"
		}),
		name: 'wikimedia',
		title: 'OpenStreetMap Wikimedia',
		type: 'base',
	}));

	world.push(new ol.layer.Tile({
		source: new ol.source.OSM(),
		name: 'osm',
		title: 'OpenStreetMap',
		type: 'base',
	}));

	world.push(new ol.layer.Tile({
		source: new ol.source.OSM({
			"url" : "http://{a-d}.tile.stamen.com/terrain/{z}/{x}/{y}.png", 
			"attributions" : 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ' 
			+ 'Data by <a _href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
		}),
		name: 'terrain',
		title: 'Terrain + Roads',
		type: 'base',
	}));

	world.push(new ol.layer.Tile({
		source: new ol.source.OSM({
			"url" : "http://{a-d}.tile.stamen.com/terrain-background/{z}/{x}/{y}.png", 
			"attributions" : 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ' 
			+ 'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
		}),
		name: 'terrain',
		title: 'Terrain',
		type: 'base',
	}));

	// carto.com basemaps, see the following URLs for details on them:
	// http://basemaps.cartocdn.com
	// https://github.com/CartoDB/cartodb/wiki/BaseMaps-available
	
	var basemaps = [ "dark_all", "dark_nolabels", "dark_only_labels",
					"light_all", "light_nolabels", "light_only_labels"
	]

	for (var i in basemaps) {
		var basemap_id = basemaps[i];

		world.push(new ol.layer.Tile({
			source: new ol.source.OSM({
				"url" : "http://{a-z}.basemaps.cartocdn.com/"+ basemap_id + "/{z}/{x}/{y}.png",
				"attributions" : 'Courtesy of <a href="https://carto.com">CARTO.com</a>'
			+ ' using data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
			}),
			name: "carto_" + basemap_id,
			title: 'carto.com ' +basemap_id,
			type: 'base',
		}));
	}

	if (BingMapsAPIKey) {
		world.push(new ol.layer.Tile({
			source: new ol.source.BingMaps({
				key: BingMapsAPIKey,
				imagerySet: 'Aerial'
			}),
			name: 'bing_aerial',
			title: 'Bing Aerial',
			type: 'base',
		}));
		world.push(new ol.layer.Tile({
			source: new ol.source.BingMaps({
				key: BingMapsAPIKey,
				imagerySet: 'Road'
			}),
			name: 'bing_roads',
			title: 'Bing Roads',
			type: 'base',
		}));
	}

	if (ChartBundleLayers) {
		var chartbundleTypes = {
			sec: "Sectional Charts",
			tac: "Terminal Area Charts",
			hel: "Helicopter Charts",
			enrl: "IFR Enroute Low Charts",
			enra: "IFR Area Charts",
			enrh: "IFR Enroute High Charts"
		};

		for (var type in chartbundleTypes) {
			us.push(new ol.layer.Tile({
				source: new ol.source.TileWMS({
					url: 'http://wms.chartbundle.com/wms',
					params: {LAYERS: type},
					projection: 'EPSG:3857',
					attributions: 'Tiles courtesy of <a href="http://www.chartbundle.com/">ChartBundle</a>'
				}),
				name: 'chartbundle_' + type,
				title: chartbundleTypes[type],
				type: 'base',
				group: 'chartbundle'}));
		}
	}

	var nexrad = new ol.layer.Tile({
		name: 'nexrad',
		title: 'NEXRAD',
		type: 'overlay',
		opacity: 0.5,
		visible: false
	});
	us.push(nexrad);

	var refreshNexrad = function() {
		// re-build the source to force a refresh of the nexrad tiles
		var now = new Date().getTime();
		nexrad.setSource(new ol.source.XYZ({
			url : 'http://mesonet{1-3}.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png?_=' + now,
			attributions: 'NEXRAD courtesy of <a href="http://mesonet.agron.iastate.edu/">IEM</a>'
		}));
	};

	refreshNexrad();
	window.setInterval(refreshNexrad, 5 * 60000);

	if (world.length > 0) {
		layers.push(new ol.layer.Group({
			name: 'world',
			title: 'Worldwide',
			layers: world
		}));
	}

	if (us.length > 0) {
		layers.push(new ol.layer.Group({
			name: 'us',
			title: 'US',
			layers: us
		}));
	}

	return layers;
}
