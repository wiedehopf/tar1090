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
- icaoFilter=hex1,hex2,hex3 - Only show the mentioned hex ids, no other aircraft will ever be displayed
- reg=registration - Direct link to specific aircraft registration(s). Separate multiple with commas. ?icao is preferred as this option takes longer to load.

## Troubleshooting

- reset - reset page settings
- showerrors - show errors on screen

## Rendering parameters

- zoom=1-20 - set zoom level.
- enableLabels - enable labels on aircraft ("L" button).
- extendedLabels=value - select the labels type ("O" button) / Valid values are 0,1,2.
- trackLabels - enable track labels ("K" button).
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
- outlineWidth=value - set width for the for aircraft icons (only works with webGL disabled)
- outlineColor=xxxxxx - set outline color (parameter is an hexadecimal color, only works with webGL disabled)
- sidebarWidth=xxx - size of sidebar in pixels.
- hideSideBar - hides sidebar.
- hideButtons - hides all buttons.
- centerReceiver - conter the view on receiver position.
- nowebgl - force rendering without WebGL.

## Toggles

- mil - Military/Interesting.
- tempTrails - enable temporary aircraft trails.
- mobile - Force mobile view.
- desktop - force desktop view.
- kiosk - force kiosk mode (tempTrails=true / hideButtons=true / userScale=2).
