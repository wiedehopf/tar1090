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
    let layers = new ol.Collection();
    let layers_group = new ol.layer.Group({
        layers: layers,
    });

    let world = new ol.Collection();
    let us = new ol.Collection();
    let europe = new ol.Collection();
    let custom = new ol.Collection();

    if (localStorage['customTiles'] != undefined) {
        custom.push(new ol.layer.Tile({
            source: new ol.source.OSM({
                "url" : localStorage['customTiles'],
                maxZoom: 15,
            }),
            name: 'custom_tiles',
            title: 'Custom tiles',
            type: 'base',
        }));
    }
    /*
    world.push(new ol.layer.Tile({
        source: new ol.source.OSM({
            "url" : "https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png"
        }),
        name: 'wikimedia',
        title: 'OpenStreetMap Wikimedia',
        type: 'base',
    }));
    */


    world.push(new ol.layer.Tile({
        source: new ol.source.OSM({
            "url" : "https://map.adsbexchange.com/mapproxy/tiles/1.0.0/osm/osm_grid/{z}/{x}/{y}.png",
             //'hosted by <a href="https://adsbexchange.com/">adsbexchange.com</a> '
            "attributions" : '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>  contributors.',
            attributionsCollapsible: false,
            maxZoom: 16,
        }),
        name: 'osm_adsbx',
        title: 'OpenStreetMap ADSBx',
        type: 'base',
    }));

    world.push(new ol.layer.Tile({
        source: new ol.source.OSM({
            maxZoom: 17,
        }),
        name: 'osm',
        title: 'OpenStreetMap',
        type: 'base',
    }));

    world.push(new ol.layer.Tile({
        source: new ol.source.XYZ({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

            attributions: 'Powered by <a href="https://www.esri.com">Esri.com</a>' +
            '— Sources: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            attributionsCollapsible: false,
            maxZoom: 17,
        }),
        name: 'esri',
        title: 'ESRI Sat.',
        type: 'base',
    }));

    if (0) {
        let vtlayer = new ol.layer.VectorTile({
            source: new ol.source.VectorTile({
                url: "http://test02.dev.adsbexchange.com/tiles/{z}/{x}/{y}.pbf",
                format: new ol.format.MVT(),
                maxZoom: 9,
            }),
            name: 'vtlayer',
            title: 'TEST VECTOR',
            type: 'base',
            renderMode: 'image',
        });

        jQuery.ajax({
            url: 'osm-liberty/style.json',
            dataType: 'json',
            layer: vtlayer,
            cache: false,
        }).done(function(glStyle) {
            ol.mbApplyStyle(this.layer, glStyle, 'openmaptiles');
        });

        world.push(vtlayer);
    }

    const date = new Date(Date.now() - 86400 * 1000);
    const yesterday = date.getUTCFullYear() + '-' + (date.getUTCMonth() + 1).toString().padStart(2, '0') + '-' + date.getUTCDate().toString().padStart(2, '0');
    world.push(new ol.layer.Tile({
        source: new ol.source.OSM({
            url: 'https://gibs-{a-c}.earthdata.nasa.gov/wmts/epsg3857/best/' +
            'MODIS_Terra_CorrectedReflectance_TrueColor/default/' +
            yesterday + '/' +
            'GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
            attributions: '<a href="https://terra.nasa.gov/about/terra-instruments/modis">MODIS Terra</a> ' +
            yesterday + ' Provided by NASA\'s Global Imagery Browse Services (GIBS), part of NASA\'s Earth Observing System Data and Information System (EOSDIS)',
            maxZoom: 9,
        }),
        name: 'gibs',
        title: 'NASA GIBS ' + yesterday,
        type: 'base',
    }));
    // carto.com basemaps, see the following URLs for details on them:
    // http://basemaps.cartocdn.com
    // https://github.com/CartoDB/cartodb/wiki/BaseMaps-available

    let basemaps = [ "dark_all", "dark_nolabels",
        "light_all", "light_nolabels"
    ]

    if (1) {
        for (let i in basemaps) {
            let basemap_id = basemaps[i];

            world.push(new ol.layer.Tile({
                source: new ol.source.OSM({
                    "url" : "https://{a-d}.basemaps.cartocdn.com/"+ basemap_id + "/{z}/{x}/{y}.png",
                    "attributions" : 'Powered by <a href="https://carto.com">CARTO.com</a>'
                    + ' using data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
                    attributionsCollapsible: false,
                    maxZoom: 15,
                }),
                name: "carto_" + basemap_id,
                title: 'CARTO.com ' +basemap_id,
                type: 'base',
            }));
        }
    }

    if (localStorage['bingKey'] != undefined)
        BingMapsAPIKey = localStorage['bingKey'];

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
                imagerySet: 'RoadOnDemand'
            }),
            name: 'bing_roads',
            title: 'Bing Roads',
            type: 'base',
        }));
    }

    if (ChartBundleLayers) {

        let chartbundleTypes = {
            sec: "Sectional Charts",
            enrh: "IFR Enroute High Charts"
        };

        for (let type in chartbundleTypes) {
            us.push(new ol.layer.Tile({
                source: new ol.source.TileWMS({
                    url: 'https://map.adsbexchange.com/mapproxy/wms',
                    params: {LAYERS: type},
                    projection: 'EPSG:3857',
                    attributions: 'Tiles courtesy of <a href="http://www.chartbundle.com/">ChartBundle</a>',
                    attributionsCollapsible: false,
                    maxZoom: 12, // doesn't work for WMS
                }),
                name: 'chartbundle_' + type,
                title: chartbundleTypes[type],
                type: 'base',
                group: 'chartbundle'}));
        }
        chartbundleTypes = {
            tac: "Terminal Area Charts",
            hel: "Helicopter Charts",
            enrl: "IFR Enroute Low Charts",
            enra: "IFR Area Charts",
            secgrids: "Sect. w/ SAR grid",
        };

        for (let type in chartbundleTypes) {
            us.push(new ol.layer.Tile({
                source: new ol.source.TileWMS({
                    url: 'https://wms.chartbundle.com/wms',
                    params: {LAYERS: type},
                    projection: 'EPSG:3857',
                    attributions: 'Tiles courtesy of <a href="http://www.chartbundle.com/">ChartBundle</a>',
                    attributionsCollapsible: false,
                    maxZoom: 12, // doesn't work for WMS
                }),
                name: 'chartbundle_' + type,
                title: chartbundleTypes[type],
                type: 'base',
                group: 'chartbundle'}));
        }
    }

    world.push(new ol.layer.Tile({
        source: new ol.source.XYZ({
            "url" : "https://map.adsbexchange.com/mapproxy/tiles/1.0.0/openaip/ul_grid/{z}/{x}/{y}.png",
            "attributions" : "openAIP.net",
            attributionsCollapsible: false,
            maxZoom: 12,
        }),
        name: 'openaip',
        title: 'openAIP TMS',
        type: 'overlay',
        opacity: 0.7,
        visible: false,
        zIndex: 99,
        maxZoom: 13,
    }));

    if (tfrs) {
        world.push(new ol.layer.Vector({
            source: new ol.source.Vector({
                url: 'tfrs.kml',
                format: new ol.format.KML(),
            }),
            name: 'tfr',
            title: 'TFRs',
            type: 'overlay',
            opacity: 0.7,
            visible: true,
            zIndex: 99,
        }));
    }

    let nexrad = new ol.layer.Tile({
        name: 'nexrad',
        title: 'NEXRAD',
        type: 'overlay',
        opacity: 0.35,
        visible: false,
        zIndex: 99,
    });

    let refreshNexrad = function() {
        // re-build the source to force a refresh of the nexrad tiles
        let now = new Date().getTime();
        nexrad.setSource(new ol.source.XYZ({
            url : 'https://mesonet{1-3}.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png?_=' + now,
            attributions: 'NEXRAD courtesy of <a href="https://mesonet.agron.iastate.edu/">IEM</a>',
            attributionsCollapsible: false,
            maxZoom: 8,
        }));
    };

    refreshNexrad();
    window.setInterval(refreshNexrad, 2 * 60 * 1000);

    let noaaRadarSource = new ol.source.ImageWMS({
        attributions: ['NOAA'],
        attributionsCollapsible: false,
        url: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WMSServer',
        params: {'LAYERS': '1'},
        projection: 'EPSG:3857',
        maxZoom: 10,
    });

    let noaaRadar = new ol.layer.Image({
        title: 'NOAA Radar',
        name: 'noaa_radar',
        zIndex: 99,
        type: 'overlay',
        visible: false,
        source: noaaRadarSource,
        opacity: 0.35,
    });

    let dwd;
    if (enableDWD) {
        dwd = new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: 'https://maps.dwd.de/geoserver/wms',
                params: {LAYERS: 'dwd:RX-Produkt', validtime: (new Date()).getTime()},
                projection: 'EPSG:3857',
                attributions: 'Deutscher Wetterdienst (DWD)',
                attributionsCollapsible: false,
                maxZoom: 8,
            }),
            name: 'radolan',
            title: 'DWD RADOLAN',
            type: 'overlay',
            opacity: 0.3,
            visible: false,
            zIndex: 99,
        });


        let refreshDwd = function () {
            dwd.getSource().updateParams({"validtime": (new Date()).getTime()});
        };
        refreshDwd();
        window.setInterval(refreshDwd, 2 * 60 * 1000);

        europe.push(dwd);
    }

    us.push(nexrad);
    us.push(noaaRadar);

    let createGeoJsonLayer = function (title, name, url, fill, stroke, showLabel = true) {
        return new ol.layer.Vector({
            type: 'overlay',
            title: title,
            name: name,
            zIndex: 99,
            visible: false,
            source: new ol.source.Vector({
              url: url,
              format: new ol.format.GeoJSON({
                defaultDataProjection :'EPSG:4326',
                    projection: 'EPSG:3857'
              })
            }),
            style: function style(feature) {
                return new ol.style.Style({
                    fill: new ol.style.Fill({
                        color : fill
                    }),
                    stroke: new ol.style.Stroke({
                        color: stroke,
                        width: 1
                    }),
                    text: new ol.style.Text({
                        text: showLabel ? feature.get("name") : "",
                        overflow: OLMap.getView().getZoom() > 5,
                        scale: 1.25,
                        fill: new ol.style.Fill({
                            color: '#000000'
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#FFFFFF',
                            width: 2
                        })
                    })
                });
            }
        });
    };

    // Taken from https://github.com/alkissack/Dump1090-OpenLayers3-html
    europe.push(createGeoJsonLayer('UK Radar Corridors', 'ukradarcorridors', 'geojson/UK_Mil_RC.geojson', 'rgba(22, 171, 22, 0.3)', 'rgba(22, 171, 22, 1)'));
    europe.push(createGeoJsonLayer('UK A2A Refueling', 'uka2arefueling', 'geojson/UK_Mil_AAR_Zones.geojson', 'rgba(52, 50, 168, 0.3)', 'rgba(52, 50, 168, 1)'));
    europe.push(createGeoJsonLayer('UK AWACS Orbits', 'uka2awacsorbits', 'geojson/UK_Mil_AWACS_Orbits.geojson', 'rgba(252, 186, 3, 0.3)', 'rgba(252, 186, 3, 1)', false));

    us.push(createGeoJsonLayer('US A2A Refueling', 'usa2arefueling', 'geojson/US_A2A_refueling.geojson', 'rgba(52, 50, 168, 0.3)', 'rgba(52, 50, 168, 1)'));

    us.push(createGeoJsonLayer('US ARTCC Boundaries', 'usartccboundaries', 'geojson/US_ARTCC_boundaries.geojson', 'rgba(255, 0, 255, 0.3)', 'rgba(255, 0, 255, 1)', false));

    if (l3harris) {
        let files = ['IFT_NAV_Routes.geojson','IFT_Training_Areas.geojson','USAFA_Training_Areas.geojson'];
        for (let i in files) {
            let name = files[i].split('.')[0];
            us.push(createGeoJsonLayer(name, 'ift' + i, 'geojson/IFT/' + files[i], 'rgba(52, 50, 168, 0.3)', 'rgba(52, 50, 168, 1)'));
        }
    }

    if (custom.getLength() > 0) {
        layers.push(new ol.layer.Group({
            name: 'custom',
            title: 'Custom',
            layers: new ol.Collection(custom.getArray().reverse()),
        }));
    }

    if (europe.getLength() > 0) {
        layers.push(new ol.layer.Group({
            name: 'europe',
            title: 'Europe',
            layers: new ol.Collection(europe.getArray().reverse()),
            //fold: 'close',
        }));
    }

    if (us.getLength() > 0) {
        layers.push(new ol.layer.Group({
            name: 'us',
            title: 'US',
            layers: new ol.Collection(us.getArray().reverse()),
            //fold: 'close',
        }));
    }

    if (world.getLength() > 0) {
        layers.push(new ol.layer.Group({
            name: 'world',
            title: 'Worldwide',
            layers: new ol.Collection(world.getArray().reverse()),
            //fold: 'open',
        }));
    }




    return layers_group;
}
