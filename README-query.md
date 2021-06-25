# Query parameters

You can use query parameters in the TAR1090 URL.

Multiple parameters are separated by "&", like this:
http://192.168.x.yy/tar1090/?icao=456789&enableLabels&extendedLabels=2&trackLabels&zoom=11&mapDim=0.4

- Some parameters need a value. If no value if passed, the default one is used.
- Some parameters do not take a value. They are active if used in the URL.(hideSideBar, hideButtons, ...).

## Search / filter

- icao=icao - selects and isolates the selected plane(s). Separate multiple with commas.
- icaoFilter=hex1,hex2,hex3 – Displays only the listed planes.
- reg=registration - Direct link to specific aircraft registration(s). Separate multiple with commas.

## Rendering parameters

- zoom=1-20 : set zoom level.
- enableLabels=true : enable labels on aircraft ("L" button).
- extendedLabels=value : select the labels type ("O" button) / Valid values are 0,1,2.
- trackLabels=true : enable track labels ("K" button).
- noVanish=true : persistence mode ("P" button).
- outlineWidth=value : set width for the for aircraft icons
- iconScale=0.1-x : scale the aircraft icon.
- labelScale=0.1-x : scale the aircraft labels.
- tempTrails=value : shows temporary trails for ## seconds of history.
- largeMode=1-4 : cycles Icons size.
- mapDim=0.1-1 : dim the map
- mapContrast=0.1-1 : set the map contrast.
- filterMaxRange=value : maximum distance of rendered tracks.
- baseMap=maptype : change the map type (as defined in config.js).
- mapOrientation=value : (in degrees).
- monochromeMarkers=xxxxxx : set constant html color for markers (parameter is an hexadecimal color).
- monochromeTracks=xxxxxx : set constant html color for tracks (parameter is an hexadecimal color).
- outlineColor=xxxxxx : set outline color (parameter is an hexadecimal color).
- sidebarWidth=xxx : size of sidebar in pixels.

## Toggles

- noIsolation : enable multiselect when multiple ICAO are used.
- mil : Military/Interesting.
- hideSideBar : hides sidebar.
- hideButtons : hides all buttons.
- centerReceiver : conter the view on receiver position.
- tempTrails : enable temporary aircraft trails.
- nowebgl : force rendering without WebGL.
- mobile : Force mobile view.
- desktop : force desktop view.
- kiosk : force kiosk mode (tempTrails=true / hideButtons=true / userScale=2).
