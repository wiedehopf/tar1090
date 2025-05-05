# Query parameters

- The query parameters are appended to the URL you would normally use for tar1090.
- Before the first query parameter a question mark ? is prepended, for each additional parameter an ampersand & is prepended.
- Example: http://192.168.x.yy/tar1090/?icao=456789&enableLabels&extendedLabels=2&trackLabels&zoom=11&mapDim=0.4

- Some parameters need a value. If no value if passed, the default one is used.
- Some parameters do not take a value. They are active if used in the URL.(hideSideBar, hideButtons, ...).
- Query parameters in tar1090 are not case sensitive.

## Search / filter

- icao=icao - selects and isolates the selected plane(s). Separate multiple with commas.
- noIsolation - show other planes and not only the ones selected by ?icao
- icaoFilter=hex1,hex2,hex3 - Only show the mentioned hex IDs, no other aircraft will ever be displayed
- icaoBlacklist=hex1,hex2,hex3 - Never show the mentioned hex IDs
- reg=registration - Direct link to specific aircraft registration(s). Separate multiple with commas. ?icao is preferred as this option takes longer to load.
- filterAltMin=500 - filter minimum altitute to 500 ft
- filterAltMax=5000 - filter maximum altitute to 5000 ft
- filterCallSign=^(UAL|DAL) - filter callsign to United or Delta. Take care to escape special characters ( %5E(UAL%7CDAL) in this case).
- filterType=B738 - filter to aircraft type code B738 aka 737-800
- filterDescription=L2J - filter aircraft by type description
- filterIcao=^a - filter icao that start with a (escape with %5Ea).
- filterSources=adsb,uat,adsr,mlat,tisb,modeS - filter planes by source type.
- filterDbFlag=military,pia,ladd - filter planes by the db flags.
- sortBy=column - (possible values: icao, flag, flight, registration, aircraft_type, squawk, altitude, speed, vert_rate, distance, track, msgs, seen, rssi, lat, lon, data_source, military, ws, wd
- sortByReverse - reverse the sorting specified using sortBy

There is a setting in the webinterface to update the URL according to used filters, this can be simpler than building the query string by hand.
See the main readme for more examples on how to use the filters

## Troubleshooting

- reset - reset page settings
- showerrors - show errors on screen

## Rendering parameters

- zoom=1-20 - set zoom level.
- enableLabels - enable labels on aircraft ("L" button).
- extendedLabels=value - select the labels type ("O" button) / Valid values are 0,1,2.
- trackLabels - enable track labels ("K" button).
- labelsGeom - use geometric altitude in track labels
- geomEGM - show geometric altitudes in EGM96 (MSL) instead of WGS84 (simpler geoid reference)
- noVanish - persistence mode ("P" button).
- scale=0.1-x - overall interface scaling.
- iconScale=0.1-x - scale the aircraft icons. (multiplies with ?scale)
- labelScale=0.1-x - scale the aircraft labels. (multiplies with ?scale)
- tempTrails=value - shows temporary trails for ## seconds of history.
- mapDim=0.1-1.0 - reduce map brightness (negative values increase brightness)
- mapContrast=0.1-1.0 - increase the map contrast (negative values decrease brightness)
- filterMaxRange=value - maximum distance of rendered tracks.
- baseMap=maptype - change the map type (as defined in config.js).
- mapOrientation=0-360 - normally true north faces up, use this to change which true direction is pointing up.
- monochromeMarkers=xxxxxx - set constant html color for markers (parameter is an hexadecimal color).
- monochromeTracks=xxxxxx - set constant html color for tracks (parameter is an hexadecimal color).
- atcStyle - use a style somewhat like an ATC display
- outlineWidth=value - set width for the for aircraft icons (only works with webGL disabled)
- outlineColor=xxxxxx - set outline color (parameter is an hexadecimal color, only works with webGL disabled)
- sidebarWidth=xxx - size of sidebar in pixels.
- hideSideBar - hides sidebar.
- hideButtons - hides all buttons.
- autoselect - keeps the plane closest to the center of the screen selected, for use with centerReceiver or lockDotCentered
- centerReceiver - center the view on receiver position.
- lockDotCentered - center the view on receiver position and keep it positioned there even when GPS might update it.
- nowebgl - force rendering without WebGL.
- tableInView - button V / only show aircraft in view in the table
- screenshot - For automatic screenshotting, disables updates after the first load of all aircraft in view
- rangeRings=0,1 - 0 or 1 to enable or disable
- altitudeChart=0,1 - 0 or 1 to enable or disable
- SiteLat=45.0 SiteLon=10.0 - Override the receiver location for this visit

## Toggles

- mil - Military/Interesting.
- tempTrails - enable temporary aircraft trails / tracks.
- mobile - Force mobile view.
- desktop - force desktop view.
- kiosk - force kiosk mode (tempTrails=true / hideButtons=true / userScale=2).
- allTracks - enable tracks as if pressing T

## heatmap / replay (only available with readsb --heatmap parameter)

- replay - replay history of all planes
- replaySpeed - adjust replay speed
- replayPaused - load replay paused
- heatmap - show a heatmap for the last 24h by default (optional: supply the maximum number of dots drawn, default 32000)
- heatDuration - how many hours to show in the heatmap
- heatEnd - how many hours to shift the heatmap time window into the past
- heatAlpha - 0.1 to 1.0 - how transparent the dots will be
- heatRadius - dot size for heatmap
- heatManualRedraw - only redraw dots when pressing r
- heatFilters - significant slowdown / experimental: enable filtering by type code / type description / hex / DB flags / military / registration / country of registration / data source

- realHeat - real heatmap instead of dots
- heatBlur - parameter for realHeat
- heatWeight - parameter for realHeat

## showTrace (only available with readsb globe-history)

- icao=71be20 - select a plane (multiple planes with comma works but is a bit glitchy)
- showTrace=2024-07-04 - show the trace for a particular UTC date (can be selected via the history tab in the aircraft details)
- startTime=08:31:30 - only show data after this UTC time
- endTime=08:38:30 - only show data before this UTC time
- timestamp=1720081992 - show aircraft details for a particular time as an UNIC epoch timestamp (needs to be within the showTrace date) (clicking on the trace will change this in the URL bar)
