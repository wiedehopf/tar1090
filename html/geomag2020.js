/*	2012-03-26
    Copyright 2012 Christopher Weiss (cmweiss@gmail.com)

    Suggestions for improvements are appreciated.

    Adapted from the geomagc software and World Magnetic Model of the NOAA
    Satellite and Information Service, National Geophysical Data Center
    http://www.ngdc.noaa.gov/geomag/WMM/DoDWMM.shtml

    geoMagFactory() requires a world magnetic model (WMM) object. The helper
    function cof2Obj(), available in cof2Obj.js, takes the text of WMM.COF and
    returns an object suitable for geoMagFactory(). A syncronous XMLHttpRequest
    to fetch the WMM.COF is recommended in a web environment. The helper
    function syncXHR(), available in syncXHR.js, takes the url of the WMM.COF
    file and returns the WMM.COF file as text.

    Usage:
    geoMagFactory(wmm) returns a function which can compute the Earth's
    magnetic field.
    The returned function requires two arguments, latitude and longitude (in
    decimal degrees), and, optionally, altitude in feet (default is 0), and
    a date object (default is the current system time).

    let cof = syncXHR('http://host/path/WMM.COF'),
	    wmm = cof2Obj(cof),
	    geoMag = geoMagFactory(wmm),
	    latitude = 40.0,                // decimal degrees (north is positive)
	    longitude = -80.0,              // decimal degrees (east is positive)
	    altitude = 0,                   // feet (optional, default is 0)
	    time = new Date(2012, 4, 20),   // (optional, default is the current
                                        // system time)
	    myGeoMag = geoMag(latitude, longitude, altitude, time),
	    magneticletiation = myGeoMag.dec,   // Geomagnetic declination
                                            // (letiation) in decimal degrees
                                            // -- east is positive
	    magneticDip = myGeoMag.dip, // Geomagnetic dip in decimal degrees
                                    // (down is positive)
	    magneticFieldIntensity = myGeoMag.ti,   // Total intensity of the
                                                // geomagnetic field in
                                                // nanoteslas
	    magneticBH = myGeoMag.bh,   // Horizontal intensity of the geomagnetic
                                    // field in nT
	    magneticBX = myGeoMag.bx,   // North component of the geomagnetic field
                                    // in nT
	    magneticBY = myGeoMag.by,   // East component of the geomagnetic field
                                    // in nT
	    magneticBZ = myGeoMag.bz,   // Vertical component of the geomagnetic
                                    // field (down is positive)
	    lat = myGeoMag.lat, // input latitude
	    lon = myGeoMag.lon; // input longitude
*/

/*jslint plusplus: true */
function geoMagFactory(wmm) {
	'use strict';
	function rad2deg(rad) {
		return rad * (180 / Math.PI);
	}
	function deg2rad(deg) {
		return deg * (Math.PI / 180);
	}

	let i, model, epoch = wmm.epoch,
		z = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		maxord = 12,
		tc = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice()],
		sp = z.slice(),
		cp = z.slice(),
		pp = z.slice(),
		p = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice()],
		dp = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice()],
		a = 6378.137,
		b = 6356.7523142,
		re = 6371.2,
		a2 = a * a,
		b2 = b * b,
		c2 = a2 - b2,
		a4 = a2 * a2,
		b4 = b2 * b2,
		c4 = a4 - b4,
		c = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice()],
		cd = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice()],
		n, m,
		snorm = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice(), z.slice()],
		j,
		k = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
			z.slice()],
		flnmj,
		fn = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
		fm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
		D2;

	tc[0][0] = 0;
	sp[0] = 0.0;
	cp[0] = 1.0;
	pp[0] = 1.0;
	p[0][0] = 1;

	model = wmm.wmm;
	for (i in model) {
		if (model.hasOwnProperty(i)) {
			if (model[i].m <= model[i].n) {
				c[model[i].m][model[i].n] = model[i].gnm;
				cd[model[i].m][model[i].n] = model[i].dgnm;
				if (model[i].m !== 0) {
					c[model[i].n][model[i].m - 1] = model[i].hnm;
					cd[model[i].n][model[i].m - 1] = model[i].dhnm;
				}
			}
		}
	}
	wmm = null;
	model = null;

	/* CONVERT SCHMIDT NORMALIZED GAUSS COEFFICIENTS TO UNNORMALIZED */
	snorm[0][0] = 1;

	for (n = 1; n <= maxord; n++) {
		snorm[0][n] = snorm[0][n - 1] * (2 * n - 1) / n;
		j = 2;

		for (m = 0, D2 = (n - m + 1); D2 > 0; D2--, m++) {
			k[m][n] = (((n - 1) * (n - 1)) - (m * m)) /
				((2 * n - 1) * (2 * n - 3));
			if (m > 0) {
				flnmj = ((n - m + 1) * j) / (n + m);
				snorm[m][n] = snorm[m - 1][n] * Math.sqrt(flnmj);
				j = 1;
				c[n][m - 1] = snorm[m][n] * c[n][m - 1];
				cd[n][m - 1] = snorm[m][n] * cd[n][m - 1];
			}
			c[m][n] = snorm[m][n] * c[m][n];
			cd[m][n] = snorm[m][n] * cd[m][n];
		}
	}
	k[1][1] = 0.0;

	return function (glat, glon, h, date) {
		function decimalDate(date) {
			date = date || new Date();
			let year = date.getUTCFullYear(),
				daysInYear = 365 +
					(((year % 400 === 0) || (year % 4 === 0 && (year % 100 > 0))) ? 1 : 0),
				msInYear = daysInYear * 24 * 60 * 60 * 1000;

			return date.getUTCFullYear() + (date.valueOf() - Date.UTC(year, 0)) / msInYear;
		}

		let alt = (h / 3280.8399) || 0, // convert h (in feet) to kilometers or set default of 0
			time = decimalDate(date),
			dt = time - epoch,
			rlat = deg2rad(glat),
			rlon = deg2rad(glon),
			srlon = Math.sin(rlon),
			srlat = Math.sin(rlat),
			crlon = Math.cos(rlon),
			crlat = Math.cos(rlat),
			srlat2 = srlat * srlat,
			crlat2 = crlat * crlat,
			q,
			q1,
			q2,
			ct,
			st,
			r2,
			r,
			d,
			ca,
			sa,
			aor,
			ar,
			br = 0.0,
			bt = 0.0,
			bp = 0.0,
			bpp = 0.0,
			par,
			temp1,
			temp2,
			parp,
			D4,
			bx,
			by,
			bz,
			bh,
			ti,
			dec,
			dip,
			gv;
		sp[1] = srlon;
		cp[1] = crlon;

		/* CONVERT FROM GEODETIC COORDS. TO SPHERICAL COORDS. */
		q = Math.sqrt(a2 - c2 * srlat2);
		q1 = alt * q;
		q2 = ((q1 + a2) / (q1 + b2)) * ((q1 + a2) / (q1 + b2));
		ct = srlat / Math.sqrt(q2 * crlat2 + srlat2);
		st = Math.sqrt(1.0 - (ct * ct));
		r2 = (alt * alt) + 2.0 * q1 + (a4 - c4 * srlat2) / (q * q);
		r = Math.sqrt(r2);
		d = Math.sqrt(a2 * crlat2 + b2 * srlat2);
		ca = (alt + d) / r;
		sa = c2 * crlat * srlat / (r * d);

		for (m = 2; m <= maxord; m++) {
			sp[m] = sp[1] * cp[m - 1] + cp[1] * sp[m - 1];
			cp[m] = cp[1] * cp[m - 1] - sp[1] * sp[m - 1];
		}

		aor = re / r;
		ar = aor * aor;

		for (n = 1; n <= maxord; n++) {
			ar = ar * aor;
			for (m = 0, D4 = (n + m + 1); D4 > 0; D4--, m++) {

		/*
				COMPUTE UNNORMALIZED ASSOCIATED LEGENDRE POLYNOMIALS
				AND DERIVATIVES VIA RECURSION RELATIONS
		*/
				if (n === m) {
					p[m][n] = st * p[m - 1][n - 1];
					dp[m][n] = st * dp[m - 1][n - 1] + ct *
						p[m - 1][n - 1];
				} else if (n === 1 && m === 0) {
					p[m][n] = ct * p[m][n - 1];
					dp[m][n] = ct * dp[m][n - 1] - st * p[m][n - 1];
				} else if (n > 1 && n !== m) {
					if (m > n - 2) { p[m][n - 2] = 0; }
					if (m > n - 2) { dp[m][n - 2] = 0.0; }
					p[m][n] = ct * p[m][n - 1] - k[m][n] * p[m][n - 2];
					dp[m][n] = ct * dp[m][n - 1] - st * p[m][n - 1] -
						k[m][n] * dp[m][n - 2];
				}

		/*
				TIME ADJUST THE GAUSS COEFFICIENTS
		*/

				tc[m][n] = c[m][n] + dt * cd[m][n];
				if (m !== 0) {
					tc[n][m - 1] = c[n][m - 1] + dt * cd[n][m - 1];
				}

		/*
				ACCUMULATE TERMS OF THE SPHERICAL HARMONIC EXPANSIONS
		*/
				par = ar * p[m][n];
				if (m === 0) {
					temp1 = tc[m][n] * cp[m];
					temp2 = tc[m][n] * sp[m];
				} else {
					temp1 = tc[m][n] * cp[m] + tc[n][m - 1] * sp[m];
					temp2 = tc[m][n] * sp[m] - tc[n][m - 1] * cp[m];
				}
				bt = bt - ar * temp1 * dp[m][n];
				bp += (fm[m] * temp2 * par);
				br += (fn[n] * temp1 * par);
		/*
					SPECIAL CASE:  NORTH/SOUTH GEOGRAPHIC POLES
		*/
				if (st === 0.0 && m === 1) {
					if (n === 1) {
						pp[n] = pp[n - 1];
					} else {
						pp[n] = ct * pp[n - 1] - k[m][n] * pp[n - 2];
					}
					parp = ar * pp[n];
					bpp += (fm[m] * temp2 * parp);
				}
			}
		}

		bp = (st === 0.0 ? bpp : bp / st);
		/*
			ROTATE MAGNETIC VECTOR COMPONENTS FROM SPHERICAL TO
			GEODETIC COORDINATES
		*/
		bx = -bt * ca - br * sa;
		by = bp;
		bz = bt * sa - br * ca;

		/*
			COMPUTE DECLINATION (DEC), INCLINATION (DIP) AND
			TOTAL INTENSITY (TI)
		*/
		bh = Math.sqrt((bx * bx) + (by * by));
		ti = Math.sqrt((bh * bh) + (bz * bz));
		dec = rad2deg(Math.atan2(by, bx));
		dip = rad2deg(Math.atan2(bz, bh));

		/*
			COMPUTE MAGNETIC GRID letIATION IF THE CURRENT
			GEODETIC POSITION IS IN THE ARCTIC OR ANTARCTIC
			(I.E. GLAT > +55 DEGREES OR GLAT < -55 DEGREES)
			OTHERWISE, SET MAGNETIC GRID letIATION TO -999.0
		*/

		if (Math.abs(glat) >= 55.0) {
			if (glat > 0.0 && glon >= 0.0) {
				gv = dec - glon;
			} else if (glat > 0.0 && glon < 0.0) {
				gv = dec + Math.abs(glon);
			} else if (glat < 0.0 && glon >= 0.0) {
				gv = dec + glon;
			} else if (glat < 0.0 && glon < 0.0) {
				gv = dec - Math.abs(glon);
			}
			if (gv > 180.0) {
				gv -= 360.0;
			} else if (gv < -180.0) { gv += 360.0; }
		}

		return {dec: dec, dip: dip, ti: ti, bh: bh, bx: bx, by: by, bz: bz, lat: glat, lon: glon, gv: gv, epoch: epoch};
	};
}
/*
	cof2Obj.js
	Converts the WMM.COF text to a JSON object usable by geoMagFactory().
*/

function cof2Obj() {
let cof=" 2020.0 WMM-2020 12/10/2019|1 0 -29404.5 0.0 6.7 0.0|1 1 -1450.7 4652.9 7.7 -25.1|2 0 -2500.0 0.0 -11.5 0.0|2 1 2982.0 -2991.6 -7.1 -30.2|2 2 1676.8 -734.8 -2.2 -23.9|3 0 1363.9 0.0 2.8 0.0|3 1 -2381.0 -82.2 -6.2 5.7|3 2 1236.2 241.8 3.4 -1.0|3 3 525.7 -542.9 -12.2 1.1|4 0 903.1 0.0 -1.1 0.0|4 1 809.4 282.0 -1.6 0.2|4 2 86.2 -158.4 -6.0 6.9|4 3 -309.4 199.8 5.4 3.7|4 4 47.9 -350.1 -5.5 -5.6|5 0 -234.4 0.0 -0.3 0.0|5 1 363.1 47.7 0.6 0.1|5 2 187.8 208.4 -0.7 2.5|5 3 -140.7 -121.3 0.1 -0.9|5 4 -151.2 32.2 1.2 3.0|5 5 13.7 99.1 1.0 0.5|6 0 65.9 0.0 -0.6 0.0|6 1 65.6 -19.1 -0.4 0.1|6 2 73.0 25.0 0.5 -1.8|6 3 -121.5 52.7 1.4 -1.4|6 4 -36.2 -64.4 -1.4 0.9|6 5 13.5 9.0 -0.0 0.1|6 6 -64.7 68.1 0.8 1.0|7 0 80.6 0.0 -0.1 0.0|7 1 -76.8 -51.4 -0.3 0.5|7 2 -8.3 -16.8 -0.1 0.6|7 3 56.5 2.3 0.7 -0.7|7 4 15.8 23.5 0.2 -0.2|7 5 6.4 -2.2 -0.5 -1.2|7 6 -7.2 -27.2 -0.8 0.2|7 7 9.8 -1.9 1.0 0.3|8 0 23.6 0.0 -0.1 0.0|8 1 9.8 8.4 0.1 -0.3|8 2 -17.5 -15.3 -0.1 0.7|8 3 -0.4 12.8 0.5 -0.2|8 4 -21.1 -11.8 -0.1 0.5|8 5 15.3 14.9 0.4 -0.3|8 6 13.7 3.6 0.5 -0.5|8 7 -16.5 -6.9 0.0 0.4|8 8 -0.3 2.8 0.4 0.1|9 0 5.0 0.0 -0.1 0.0|9 1 8.2 -23.3 -0.2 -0.3|9 2 2.9 11.1 -0.0 0.2|9 3 -1.4 9.8 0.4 -0.4|9 4 -1.1 -5.1 -0.3 0.4|9 5 -13.3 -6.2 -0.0 0.1|9 6 1.1 7.8 0.3 -0.0|9 7 8.9 0.4 -0.0 -0.2|9 8 -9.3 -1.5 -0.0 0.5|9 9 -11.9 9.7 -0.4 0.2|10 0 -1.9 0.0 0.0 0.0|10 1 -6.2 3.4 -0.0 -0.0|10 2 -0.1 -0.2 -0.0 0.1|10 3 1.7 3.5 0.2 -0.3|10 4 -0.9 4.8 -0.1 0.1|10 5 0.6 -8.6 -0.2 -0.2|10 6 -0.9 -0.1 -0.0 0.1|10 7 1.9 -4.2 -0.1 -0.0|10 8 1.4 -3.4 -0.2 -0.1|10 9 -2.4 -0.1 -0.1 0.2|10 10 -3.9 -8.8 -0.0 -0.0|11 0 3.0 0.0 -0.0 0.0|11 1 -1.4 -0.0 -0.1 -0.0|11 2 -2.5 2.6 -0.0 0.1|11 3 2.4 -0.5 0.0 0.0|11 4 -0.9 -0.4 -0.0 0.2|11 5 0.3 0.6 -0.1 -0.0|11 6 -0.7 -0.2 0.0 0.0|11 7 -0.1 -1.7 -0.0 0.1|11 8 1.4 -1.6 -0.1 -0.0|11 9 -0.6 -3.0 -0.1 -0.1|11 10 0.2 -2.0 -0.1 0.0|11 11 3.1 -2.6 -0.1 -0.0|12 0 -2.0 0.0 0.0 0.0|12 1 -0.1 -1.2 -0.0 -0.0|12 2 0.5 0.5 -0.0 0.0|12 3 1.3 1.3 0.0 -0.1|12 4 -1.2 -1.8 -0.0 0.1|12 5 0.7 0.1 -0.0 -0.0|12 6 0.3 0.7 0.0 0.0|12 7 0.5 -0.1 -0.0 -0.0|12 8 -0.2 0.6 0.0 0.1|12 9 -0.5 0.2 -0.0 -0.0|12 10 0.1 -0.9 -0.0 -0.0|12 11 -1.1 -0.0 -0.0 0.0|12 12 -0.3 0.5 -0.1 -0.1"
	'use strict';
	let modelLines = cof.split('|'),
		wmm = [],
		i, vals, epoch, model, modelDate;
	for (i in modelLines) {
		if (modelLines.hasOwnProperty(i)) {
			vals = modelLines[i].replace(/^\s+|\s+$/g, "").split(/\s+/);
			if (vals.length === 3) {
				epoch = parseFloat(vals[0]);
				model = vals[1];
				modelDate = vals[2];
			} else if (vals.length === 6) {
				wmm.push({
					n: parseInt(vals[0], 10),
					m: parseInt(vals[1], 10),
					gnm: parseFloat(vals[2]),
					hnm: parseFloat(vals[3]),
					dgnm: parseFloat(vals[4]),
					dhnm: parseFloat(vals[5])
				});
			}
		}
	}

	return {epoch: epoch, model: model, modelDate: modelDate, wmm: wmm};
}
