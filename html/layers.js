// -*- mode: javascript; indent-tabs-mode: nil; c-basic-offset: 8 -*-
"use strict";

// IBOSOFT CUSTOMIZATION: Base layers, aviation overlays and weather layers are all replaced by AIS Map SDK.
// Only the empty group structure is kept so tar1090's aircraft vector layers can
// be pushed into it via initMapEarly() / initMap().
// (New tar1090 version added OpenFreeMap, GIBS, and other providers — also replaced by AIS Map SDK.)
function createBaseLayers() {

    // Main layers collection (no base tiles or aviation layers – AIS Map SDK owns those)

    let layers = new ol.Collection();
    let layers_group = new ol.layer.Group({
        layers: layers,
    });

    return layers_group;
}

/* IBOSOFT CUSTOMIZATION: REMOVED — old base/aviation/weather/LOS layers replaced by AIS Map SDK ---

    let world = new ol.Collection();
    let aviation = new ol.Collection();
    let weather = new ol.Collection();
    let los = new ol.Collection();

    // ###########

    const tileTransition = onMobile ? 0 : 0;



    // World base layers

    world.push(new ol.layer.Tile({
        source: new ol.source.OSM({
            maxZoom: 17,
            attributionsCollapsible: false,
            transition: tileTransition,
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
            transition: tileTransition,
        }),
        name: 'esri',
        title: 'ESRI Satellite',
        type: 'base',
    }));
    world.push(new ol.layer.Tile({
        source: new ol.source.XYZ({
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
            attributions: 'Powered by <a href="https://www.esri.com">Esri.com</a>' +
            '— Sources: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            attributionsCollapsible: false,
            maxZoom: 16,
            transition: tileTransition,
        }),
        name: 'esri_gray',
        title: 'ESRI Gray',
        type: 'base',
    }));
    world.push(new ol.layer.Tile({
        source: new ol.source.XYZ({
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
            attributions: 'Powered by <a href="https://www.esri.com">Esri.com</a>' +
            '— Sources: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            attributionsCollapsible: false,
            maxZoom: 17,
            transition: tileTransition,
        }),
        name: 'esri_streets',
        title: 'ESRI Streets',
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
                    transition: tileTransition,
                }),
                name: "carto_" + basemap_id,
                title: 'CARTO.com ' + basemap_id,
                type: 'base',
            }));
        }
    }

    if (loStore['mapboxKey'] != undefined)
        MapboxAPIKey = loStore['mapboxKey'];

    if (MapboxAPIKey) {
        world.push(new ol.mapboxStyle.MapboxVectorLayer({
            styleUrl: 'mapbox://styles/mapbox/streets-v10',
            accessToken: MapboxAPIKey,
            properties: {
                name: 'mapbox_streets',
                title: 'Mapbox Streets',
                type: 'base',
            },
        }));
        world.push(new ol.mapboxStyle.MapboxVectorLayer({
            styleUrl: 'mapbox://styles/mapbox/light-v11',
            accessToken: MapboxAPIKey,
            properties: {
                name: 'mapbox_light',
                title: 'Mapbox Light',
                type: 'base',
            },
        }));
        world.push(new ol.mapboxStyle.MapboxVectorLayer({
            styleUrl: 'mapbox://styles/mapbox/dark-v11',
            accessToken: MapboxAPIKey,
            properties: {
                name: 'mapbox_dark',
                title: 'Mapbox Dark',
                type: 'base',
            },
        }));
        world.push(new ol.mapboxStyle.MapboxVectorLayer({
            styleUrl: 'mapbox://styles/mapbox/outdoors-v10',
            accessToken: MapboxAPIKey,
            properties: {
                name: 'mapbox_outdoors',
                title: 'Mapbox Outdoors',
                type: 'base',
            },
        }));
    }


    // Aviation layers

    aviation.push(new ol.layer.Tile({
        source: new ol.source.XYZ({
            "url" : "https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=96e4ac0fa12fcb28d1da0f7f80d9b203",
            "attributions" : "OpenAIP, openaip.net",
            attributionsCollapsible: false,
            maxZoom: 19,
            minZoom: 0,
            transition: tileTransition,
        }),
        name: 'openaip',
        title: 'openAIP',
        type: 'overlay',
        //opacity: openAIPOpacity,
        opacity: 1.0,
        visible: true,
        zIndex: 99,
        maxZoom: 19,
        minZoom: 0,
    }));



    // Weather layers

    g.getRainviewerLayers = async function(key) {
        const response = await fetch("https://api.rainviewer.com/public/weather-maps.json", {credentials: "omit",});
        const jsonData = await response.json();
        return jsonData[key];
    }
    const rainviewerRadar = new ol.layer.Tile({
        name: 'rainviewer_radar',
        title: 'RainViewer Radar',
        type: 'overlay',
        opacity: rainViewerRadarOpacity,
        visible: false,
        zIndex: 99,
    });
    g.refreshRainviewerRadar = async function() {
        const latestLayer = await g.getRainviewerLayers('radar');
        const rainviewerRadarSource = new ol.source.XYZ({
            url: 'https://tilecache.rainviewer.com/v2/radar/' + latestLayer.past[latestLayer.past.length - 1].time + '/512/{z}/{x}/{y}/6/1_1.png',
            attributions: '<a href="https://www.rainviewer.com/api.html" target="_blank">RainViewer.com</a>',
            attributionsCollapsible: false,
            maxZoom: 20,
        });
        rainviewerRadar.setSource(rainviewerRadarSource);
    };
    rainviewerRadar.on('change:visible', function(evt) {
        if (evt.target.getVisible()) {
            g.refreshRainviewerRadar();
            g.refreshRainviewerRadarInterval = window.setInterval(g.refreshRainviewerRadar, 2 * 60 * 1000);
        } else {
            clearInterval(g.refreshRainviewerRadarInterval);
        }
    });
    weather.push(rainviewerRadar);

        // Refresh sat layer every 15 minutes
        refreshNoaaSat();
        window.setInterval(refreshNoaaSat, 15 * 60 * 1000);

        us.push(noaaSat);
    }
    if (true) {
        let noaaRadarSource = new ol.source.ImageWMS({
            attributions: ['NOAA'],
            attributionsCollapsible: false,
            url: 'https://nowcoast.noaa.gov/geoserver/weather_radar/wms',
            params: {'LAYERS': 'base_reflectivity_mosaic'},
            projection: 'EPSG:3857',
            resolutions: [156543.03392804097, 78271.51696402048, 39135.75848201024, 19567.87924100512, 9783.93962050256, 4891.96981025128, 2445.98490512564, 1222.99245256282],
            ratio: 1,
            transition: tileTransition,
        });

        let noaaRadar = new ol.layer.Image({
            title: 'NOAA Radar',
            name: 'noaa_radar',
            zIndex: 99,
            type: 'overlay',
            visible: false,
            source: noaaRadarSource,
            opacity: noaaRadarOpacity,
            extent: naExtent,
        });

        let refreshNoaaRadar = function () {
            noaaRadarSource.refresh();
        }
        refreshNoaaRadar();
        window.setInterval(refreshNoaaRadar, 5 * 60 * 1000);

        us.push(noaaRadar);
    }

    if (enableDWD) {
        const bottomLeft = ol.proj.fromLonLat([1.9,46.2]);
        const topRight = ol.proj.fromLonLat([16.0,55.0]);
        const dwdExtent = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]];

        let dwdSource = new ol.source.TileWMS({
            url: 'https://maps.dwd.de/geoserver/wms',
            params: {LAYERS: dwdLayers, validtime: (new Date()).getTime()},
            projection: 'EPSG:3857',
            attributions: 'Deutscher Wetterdienst (DWD)',
            attributionsCollapsible: false,
            tileGrid: ol.tilegrid.createXYZ({
                extent: ol.tilegrid.extentFromProjection('EPSG:3857'),
                maxResolution: 156543.03392804097,
                maxZoom: 8,
                minZoom: 0,
                tileSize: 512,
            }),
            transition: tileTransition,
        });

        let dwd = new ol.layer.Tile({
            source: dwdSource,
            name: 'radolan',
            title: 'DWD RADOLAN',
            type: 'overlay',
            opacity: dwdRadolanOpacity,
            visible: false,
            zIndex: 99,
            //extent: dwdExtent,
            // extent somehow bugged
        });

        let dwdValidtime = "";

        let refreshDwd = function () {
            let ms = Date.now();
            let validtime = (ms - ms % (5 * 60 * 1000)) / 1000;
            if (validtime != dwdValidtime) {
                //console.log(`dwd validtime ${zuluTime(new Date(validtime * 1000))}`);
                dwd.getSource().updateParams({validtime: validtime});
                dwdValidtime = validtime;
            }
        };
        refreshDwd();
        window.setInterval(refreshDwd, 15 * 1000);


    if (true) {
        g.getRainviewerMaps = async function() {
            const response = await fetch("https://api.rainviewer.com/public/weather-maps.json", {credentials: "omit",});
            return await response.json();
        }

        const rainviewerRadar = new ol.layer.Tile({
            name: 'rainviewer_radar',
            title: 'RainViewer Radar',
            type: 'overlay',
            opacity: rainViewerRadarOpacity,
            visible: false,
            zIndex: 99,
        });
        g.refreshRainviewerRadar = async function() {
            const maps = await g.getRainviewerMaps();
            const past = maps.radar.past;
            const rainviewerRadarSource = new ol.source.XYZ({
                url: maps.host + past[past.length - 1].path + '/512/{z}/{x}/{y}/6/1_1.png',
                attributions: '<a href="https://www.rainviewer.com/api.html" target="_blank">RainViewer.com</a>',
                attributionsCollapsible: false,
                maxZoom: 7,
            });
            rainviewerRadar.setSource(rainviewerRadarSource);
        };

        rainviewerRadar.on('change:visible', function(evt) {
            if (evt.target.getVisible()) {
                g.refreshRainviewerRadar();
                g.refreshRainviewerRadarInterval = window.setInterval(g.refreshRainviewerRadar, 2 * 60 * 1000);
            } else {
                clearInterval(g.refreshRainviewerRadarInterval);
            }
        });

        world.push(rainviewerRadar);
    }

    let createGeoJsonLayer = function (title, name, url, fill, stroke, showLabel = true, defaultVisible = false) {
        return new ol.layer.Vector({
            type: 'overlay',
            title: title,
            name: name,
            zIndex: 99,
            visible: defaultVisible,
            source: new ol.source.Vector({
                url: url,
                transition: tileTransition,
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



    // Line-of-Sight layers

    // Surveillance layers
    let surveillance = new ol.layer.Group({
        title: 'Surveillance',
        fold: 'open',
        layers: [
            createGeoJsonLayer(
                '5000 ft',
                'surv_5000',
                'https://atc.ibosoft.net.tr/geojson-proxy.php?file=los-surv/5000.geojson',
                'rgba(0, 0, 0, 0)',
                '#00FF00',
                false
            ),
            createGeoJsonLayer(
                '10000 ft',
                'surv_10000',
                'https://atc.ibosoft.net.tr/geojson-proxy.php?file=los-surv/10000.geojson',
                'rgba(0, 0, 0, 0)',
                '#00FFFF',
                false,
                true
            ),
            createGeoJsonLayer(
                '20000 ft',
                'surv_20000',
                'https://atc.ibosoft.net.tr/geojson-proxy.php?file=los-surv/20000.geojson',
                'rgba(0, 0, 0, 0)',
                '#0088FF',
                false
            ),
            createGeoJsonLayer(
                '30000 ft',
                'surv_30000',
                'https://atc.ibosoft.net.tr/geojson-proxy.php?file=los-surv/30000.geojson',
                'rgba(0, 0, 0, 0)',
                '#8800FF',
                false,
                true
            ),
            createGeoJsonLayer(
                '40000 ft',
                'surv_40000',
                'https://atc.ibosoft.net.tr/geojson-proxy.php?file=los-surv/40000.geojson',
                'rgba(0, 0, 0, 0)',
                '#FF00FF',
                false
            )
        ]
    });

    // ATC VHF layers
    let atcVhf = new ol.layer.Group({
        title: 'ATC VHF',
        fold: 'open',
        layers: [
            createGeoJsonLayer(
                '5000 ft',
                'atc_vhf_5000',
                'https://atc.ibosoft.net.tr/geojson-proxy.php?file=los-atc-vhf/5000.geojson',
                'rgba(0, 0, 0, 0)',
                '#00FF00',
                false
            ),
            createGeoJsonLayer(
                '10000 ft',
                'atc_vhf_10000',
                'https://atc.ibosoft.net.tr/geojson-proxy.php?file=los-atc-vhf/10000.geojson',
                'rgba(0, 0, 0, 0)',
                '#00FFFF',
                false
            ),
            createGeoJsonLayer(
                '20000 ft',
                'atc_vhf_20000',
                'https://atc.ibosoft.net.tr/geojson-proxy.php?file=los-atc-vhf/20000.geojson',
                'rgba(0, 0, 0, 0)',
                '#0088FF',
                false
            ),
            createGeoJsonLayer(
                '30000 ft',
                'atc_vhf_30000',
                'https://atc.ibosoft.net.tr/geojson-proxy.php?file=los-atc-vhf/30000.geojson',
                'rgba(0, 0, 0, 0)',
                '#8800FF',
                false
            ),
            createGeoJsonLayer(
                '40000 ft',
                'atc_vhf_40000',
                'https://atc.ibosoft.net.tr/geojson-proxy.php?file=los-atc-vhf/40000.geojson',
                'rgba(0, 0, 0, 0)',
                '#FF00FF',
                false
            )
        ]
    });

    los.push(surveillance);
    los.push(atcVhf);



    // Add layer groups to main layers collection

    layers.push(new ol.layer.Group({
         name: 'weather',
         title: 'Weather',
         layers: new ol.Collection(weather.getArray().reverse()),
         //fold: 'open',
    }));
    layers.push(new ol.layer.Group({
         name: 'aviation',
         title: 'Aeronautical Data',
         layers: new ol.Collection(aviation.getArray().reverse()),
         //fold: 'open',
    }));
    layers.push(new ol.layer.Group({
         name: 'los',
         title: 'Theoretical Line-of-Sight',
         layers: new ol.Collection(los.getArray().reverse()),
         //fold: 'open',
    }));
    layers.push(new ol.layer.Group({
         name: 'world',
         title: 'Worldwide',
         layers: new ol.Collection(world.getArray().reverse()),
         //fold: 'open',
    }));


    return layers_group;
}

--- end removed layers --- */
