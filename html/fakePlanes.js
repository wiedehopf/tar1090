// fake-planes.js - Fake airplane generation for testing tar1090
const types = (Object.keys(TypeCodeIcons))
const categories = Object.keys(CategoryIcons)

function randSort(arr) {
    return arr.map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
}

class FakePlane {
    constructor(index, trajectory, speed, aircraftType, aircraftCategory, totalPlanes) {
        this.index = index;
        this.trajectory = trajectory;
        this.speed = speed; // Base speed in knots
        this.aircraftType = aircraftType;
        this.aircraftCategory = aircraftCategory;
        this.totalPlanes = totalPlanes;

        // Fixed plane data
        this.hex = this.generateICAO(index);
        this.flight = `FAKE${(index + 1).toString().padStart(3, '0')} `;
        this.r = `FAKE-${index.toString().padStart(3, '0')}`;
        this.t = aircraftType;
        this.category = aircraftCategory;
        this.squawk = (1000 + index).toString().padStart(4, '0');
        this.type = index % 3 === 0 ? 'adsb_icao' : index % 3 === 1 ? 'mode_s' : 'adsb_icao_nt';
        
        // ADS-B technical data (mostly fixed)
        this.messages = Math.floor(Math.random() * 100) + 50;
        this.nic = 8;
        this.nac_p = 9;
        this.nac_v = 1;
        this.sil = 3;
        this.sil_type = 3;
        this.rc = Math.floor(Math.random() * 25);
        this.rssi = -30 - Math.random() * 10;
        this.receiverCount = Math.floor(Math.random() * 3);
        
        // Fixed status data
        this.airground = 2; // Airborne
        this.dbFlags = 0;
        this.extraFlags = 0;
        this.nogps = 0;
        this.alert1 = 0;
        this.spi = 0;
        this.version = 0;
        this.adsb_version = 2;
        this.adsr_version = 0;
        this.tisb_version = 0;
        
        // Initialize dynamic data
        this.lastUpdateTime = Date.now() / 1000;
        this.currentPosition = this.getPosition(this.lastUpdateTime);
        this.currentHeading = this.calculateHeading(this.lastUpdateTime);
        
        // Initialize plane data object
        this.updatePlaneData();
    }

    // Generate unique ICAO codes
    generateICAO(index) {
        const letters = 'ABCDEF';
        const base = 0xABC000 + index;
        return letters[Math.floor(index/1000)%6] +
               letters[Math.floor(index/100)%6] +
               (base % 1000).toString().padStart(3, '0');
    }

    // Calculate position for trajectory at given time
    getPosition(time) {
        const elapsed = time - this.trajectory.startTime;
        
        // Calculate distance traveled based on speed in knots
        // Speed in knots = nautical miles per hour
        // Convert to nautical miles traveled
        const hoursElapsed = elapsed / 3600; // Convert seconds to hours
        const distanceTraveled = this.speed * hoursElapsed; // Nautical miles
        
        // Convert nautical miles to degrees latitude (approx 1 NM = 0.01667 degrees)
        const degreesTraveled = distanceTraveled * 0.01667;
        
        // Use degrees traveled as the phase for the trajectory pattern
        // This makes faster planes move further along their pattern
        // Normalize by pattern size (use radius for circular patterns, width for eastwest)
        const patternSize = this.trajectory.pattern.radius || this.trajectory.pattern.width || 1;
        const phase = degreesTraveled / patternSize; // Normalize by pattern size
        
        let lat = this.trajectory.centerLat;
        let lon = this.trajectory.centerLon;

        switch(this.trajectory.pattern.type) {
            case 'circle':
                lat += Math.sin(phase + this.trajectory.offset) * this.trajectory.pattern.radius;
                lon += Math.cos(phase + this.trajectory.offset) * this.trajectory.pattern.radius;
                break;
            case 'figure8':
                lat += Math.sin(phase * 2 + this.trajectory.offset) * this.trajectory.pattern.radius;
                lon += Math.cos(phase + this.trajectory.offset) * this.trajectory.pattern.radius;
                break;
            case 'linear':
                const direction = this.trajectory.offset;
                const distance = this.trajectory.pattern.distance * Math.sin(phase);
                lat += Math.sin(direction) * distance;
                lon += Math.cos(direction) * distance;
                break;
            case 'oval':
                lat += Math.sin(phase + this.trajectory.offset) * this.trajectory.pattern.radiusY;
                lon += Math.cos(phase + this.trajectory.offset) * this.trajectory.pattern.radiusX;
                break;
            case 'triangle':
                // Create triangular pattern
                const trianglePhase = (phase % (2 * Math.PI)) / (2 * Math.PI / 3);
                const segment = Math.floor(trianglePhase * 3);
                const localPhase = (trianglePhase * 3) % 1;

                let triangleLat = 0, triangleLon = 0;
                switch(segment) {
                    case 0: // From center to top
                        triangleLat = localPhase * this.trajectory.pattern.radius;
                        triangleLon = 0;
                        break;
                    case 1: // From top to bottom-right
                        triangleLat = this.trajectory.pattern.radius - localPhase * this.trajectory.pattern.radius * 2;
                        triangleLon = localPhase * this.trajectory.pattern.radius;
                        break;
                    case 2: // From bottom-right to center
                        triangleLat = -this.trajectory.pattern.radius + localPhase * this.trajectory.pattern.radius;
                        triangleLon = this.trajectory.pattern.radius - localPhase * this.trajectory.pattern.radius;
                        break;
                }
                
                lat += triangleLat;
                lon += triangleLon;
                break;
            case 'square':
                // Square grid pattern - planes arranged in a grid with guaranteed minimum separation
                // Calculate grid dimensions - try to make it as square as possible
                const gridSize = Math.ceil(Math.sqrt(this.totalPlanes));
                const rows = gridSize;
                const cols = Math.ceil(this.totalPlanes / gridSize);
                
                // Define minimum separation between planes (in degrees, same as eastwest bands)
                const minSeparation = 0.02; // Minimum 0.02 degrees between adjacent planes
                
                // Calculate required spacing for rows and columns
                const rowSpacing = rows > 1 ? this.trajectory.pattern.size / (rows - 1) : 0;
                const colSpacing = cols > 1 ? this.trajectory.pattern.size / (cols - 1) : 0;
                
                // Ensure minimum separation by adjusting effective size if needed
                const effectiveSize = Math.max(
                    this.trajectory.pattern.size,
                    rows > 1 ? minSeparation * (rows - 1) : 0,
                    cols > 1 ? minSeparation * (cols - 1) : 0
                );
                
                // Calculate this plane's position in the grid (row-major order: left to right, top to bottom)
                const row = Math.floor(this.index / cols);
                const col = this.index % cols;
                
                // Convert grid position to coordinates within the square with guaranteed separation
                // Top-left is (-effectiveSize/2, effectiveSize/2), bottom-right is (effectiveSize/2, -effectiveSize/2)
                lat+= (effectiveSize / 2) - (row / Math.max(rows - 1, 1)) * effectiveSize;
                lon+= (-effectiveSize / 2) + (col / Math.max(cols - 1, 1)) * effectiveSize;
                break;
            case 'eastwest':
                // East-west corridor pattern - each band has a fixed direction
                // Planes are already positioned in correct bands via centerLat in trajectory
                const bandEW = this.index % this.trajectory.pattern.bands;
                const flightDirection = bandEW % 2; // Even bands (0,2,4...): west to east, Odd bands (1,3,5...): east to west
                
                // Calculate regular positioning along the band
                // Count planes in this band and find this plane's position within the band
                let planesInBand = 0;
                let positionInBand = 0;
                for (let j = 0; j < this.totalPlanes; j++) {
                    if ((j % this.trajectory.pattern.bands) === bandEW) {
                        planesInBand++;
                        if (j < this.index) positionInBand++;
                    }
                }
                
                // Initial phase offset for regular distribution along the band
                const initialPhaseOffset = planesInBand > 1 ? positionInBand / (planesInBand - 1) : 0;
                
                // Combine time-based phase with initial positioning
                const timeBasedPhase = phase % 1;
                const combinedPhase = (timeBasedPhase + initialPhaseOffset) % 1;
                
                // East-west movement based on direction
                if (flightDirection === 0) {
                    // Even bands (west to east): start from left (-width/2), move right to (+width/2)
                    lon += (combinedPhase * 2 - 1) * this.trajectory.pattern.width / 2;
                } else {
                    // Odd bands (east to west): start from right (+width/2), move left to (-width/2)
                    lon += (1 - combinedPhase * 2) * this.trajectory.pattern.width / 2;
                }
                break;
        }

        // Keep planes within map bounds if available
        if (this.trajectory.mapBounds) {
            lat = Math.max(this.trajectory.mapBounds.minLat, Math.min(this.trajectory.mapBounds.maxLat, lat));
            lon = Math.max(this.trajectory.mapBounds.minLon, Math.min(this.trajectory.mapBounds.maxLon, lon));
        }

        return { lat, lon };
    }

    // Calculate heading based on trajectory movement
    calculateHeading(time) {
        const nextTime = time + 1;
        const currentPos = this.getPosition(time);
        const nextPos = this.getPosition(nextTime);
        const heading = Math.atan2(nextPos.lon - currentPos.lon, nextPos.lat - currentPos.lat) * 180 / Math.PI;
        return Math.round((heading + 360) % 360 * 10) / 10;
    }

    // Update plane position and properties based on time
    update(currentTime) {
        const timeDelta = currentTime - this.lastUpdateTime;
        
        // Update position based on speed and time
        this.currentPosition = this.getPosition(currentTime);
        this.currentHeading = this.calculateHeading(currentTime);
        this.lastUpdateTime = currentTime;
        
        // Update plane data
        this.updatePlaneData();
    }

    // Update the plane data object with current values
    updatePlaneData() {
        const currentTime = this.lastUpdateTime;
        
        // Position and timing
        this.lat = this.currentPosition.lat;
        this.lon = this.currentPosition.lon;
        this.seen = Math.random() * 2;
        this.seen_pos = Math.random() * 1;

        // Altitude with variation
        const altitudePhase = (currentTime * 0.005 + this.index * 0.5) % (2 * Math.PI);
        const altitude = Math.max(0, Math.min(50000, 25000 + Math.sin(altitudePhase) * 25000));
        this.alt_baro = Math.round(altitude);
        this.alt_geom = Math.round(altitude - 50);
        this.baro_rate = Math.round(Math.cos(currentTime * 0.01 + this.index) * 1000);
        this.geom_rate = Math.round(Math.cos(currentTime * 0.01 + this.index) * 950);

        // Speed with variation
        const speedVariation = Math.sin(currentTime * 0.02 + this.index) * 100;
        const groundSpeed = Math.max(0, this.speed + speedVariation);
        this.gs = Math.round(groundSpeed);
        this.tas = Math.round(groundSpeed * (1 + altitude / 100000));
        this.ias = Math.round(this.tas * (1 - altitude / 100000));
        this.mach = Math.round((groundSpeed / 343) * 1000) / 1000;

        // Heading and track
        this.track = this.currentHeading;
        this.track_rate = Math.round(Math.sin(currentTime * 0.05 + this.index) * 2 * 10) / 10;
        this.mag_heading = this.currentHeading;
        this.true_heading = this.currentHeading;
        this.nav_heading = this.currentHeading;

        // Navigation data
        this.nav_altitude_mcp = Math.max(0, Math.min(50000, Math.round(altitude + Math.sin(currentTime * 0.005 + this.index) * 5000)));
        this.nav_qnh = 1013.25;
    }

    // Get the complete plane data object
    getData() {
        return {
            // Basic identification
            hex: this.hex,
            flight: this.flight,
            r: this.r,
            t: this.t,
            category: this.category,

            // Position and timing
            lat: this.lat,
            lon: this.lon,
            seen: this.seen,
            seen_pos: this.seen_pos,

            // Altitude data
            alt_baro: this.alt_baro,
            alt_geom: this.alt_geom,
            baro_rate: this.baro_rate,
            geom_rate: this.geom_rate,

            // Speed data
            gs: this.gs,
            tas: this.tas,
            ias: this.ias,
            mach: this.mach,

            // Heading and track
            track: this.track,
            track_rate: this.track_rate,
            mag_heading: this.mag_heading,
            true_heading: this.true_heading,
            nav_heading: this.nav_heading,

            // Navigation data
            nav_altitude_mcp: this.nav_altitude_mcp,
            nav_qnh: this.nav_qnh,

            // ADS-B technical data
            messages: this.messages,
            nic: this.nic,
            nac_p: this.nac_p,
            nac_v: this.nac_v,
            sil: this.sil,
            sil_type: this.sil_type,
            rc: this.rc,

            // Aircraft status
            airground: this.airground,
            squawk: this.squawk,
            type: this.type,

            // Signal and receiver data
            rssi: this.rssi,
            receiverCount: this.receiverCount,
            dbFlags: this.dbFlags,
            extraFlags: this.extraFlags,
            nogps: this.nogps,
            alert1: this.alert1,
            spi: this.spi,
            version: this.version,

            // ADS-B version info
            adsb_version: this.adsb_version,
            adsr_version: this.adsr_version,
            tisb_version: this.tisb_version
        };
    }
}

class FakePlanesManager {
    constructor() {
        this.enabled = false;
        this.planes = []; // Array of FakePlane instances
        this.numPlanes = types.length;
        this.trajectories = [];
        this.updateInterval = null;
        this.autoUpdateTrajectories = false; // Default to false - don't auto-update trajectories on map changes
    }

    // Create offset trajectories to avoid constant overlap
    createTrajectory(index, totalPlanes) {
        // Get current map bounds
        let mapBounds = null;
        try {
            if (typeof OLMap !== 'undefined' && OLMap && OLMap.getView) {
                const extent = OLMap.getView().calculateExtent(OLMap.getSize());
                mapBounds = myExtent(extent);
            }
        } catch (e) {
            console.warn('Could not get map bounds for fake planes:', e);
        }

        // Fallback to default center if map bounds unavailable
        const centerLat = mapBounds ? (mapBounds.minLat + mapBounds.maxLat) / 2 : (CenterLat || 40.0);
        const centerLon = mapBounds ? (mapBounds.minLon + mapBounds.maxLon) / 2 : (CenterLon || -74.0);
        
        // Calculate map dimensions for scaling patterns
        const mapWidth = mapBounds ? (mapBounds.maxLon - mapBounds.minLon) : 0.2;
        const mapHeight = mapBounds ? (mapBounds.maxLat - mapBounds.minLat) : 0.2;
        const mapSize = Math.min(mapWidth, mapHeight);

        // Create different flight patterns scaled to map size
        const patterns = [
            //{ type: 'circle', radius: mapSize * 0.3, speed: 0.00008 },     // Circle covering 60% of map
            //{ type: 'figure8', radius: mapSize * 0.2, speed: 0.00012 },    // Figure-8 covering 40% of map
            //{ type: 'oval', radiusX: mapSize * 0.4, radiusY: mapSize * 0.15, speed: 0.00006 }, // Oval pattern
            //{ type: 'linear', distance: mapSize * 0.6, speed: 0.00015 },   // Linear path across map
            //{ type: 'triangle', radius: mapSize * 0.25, speed: 0.00010 },   // Triangular pattern
            { type: 'square', size: mapSize * 0.6, speed: 0.00008 },        // Square grid pattern
            //{ type: 'eastwest', bands: 10/*Math.max(1, Math.min(10, Math.floor(mapHeight / 0.05)))*/, width: mapSize * 0.8, speed: 0.00010 } // East-west corridor pattern
        ];

        const pattern = patterns[index % patterns.length];
        
        // Distribute starting positions evenly across the visible map area
        let centerLatFinal = centerLat;
        let centerLonFinal = centerLon;
        
        if (pattern.type === 'eastwest') {
            // For eastwest corridors, position planes in close bands to prevent airplane overlap
            const bandSpacing = 0.02; // Tight spacing between bands (about 1.2 NM) to prevent visual overlap
            const bandEW = index % pattern.bands;
            centerLatFinal = centerLat + (bandEW - (pattern.bands - 1) / 2) * bandSpacing;
            centerLonFinal = centerLon; // Use map center, eastwest logic handles longitude movement
        } else if (pattern.type === 'square') {
            // For square pattern, all planes use the same center - getPosition handles grid positioning
            centerLatFinal = centerLat;
            centerLonFinal = centerLon;
        } else {
            // Original distribution logic for other patterns
            const angleStep = (2 * Math.PI) / totalPlanes;
            const offset = index * angleStep;
            const distributionRadius = mapSize * 0.2; // Distribute centers within 40% of map size
            const centerOffsetLat = Math.sin(offset) * distributionRadius;
            const centerOffsetLon = Math.cos(offset) * distributionRadius;
            centerLatFinal = centerLat + centerOffsetLat;
            centerLonFinal = centerLon + centerOffsetLon;
        }

        return {
            pattern: pattern,
            offset: index * 0.1, // Small offset for variety, but not used much in eastwest
            startTime: pattern.type === 'eastwest' 
                ? Date.now() / 1000 - (index * 30) // Stagger start times so planes follow each other (30 second intervals)
                : Date.now() / 1000,
            centerLat: centerLatFinal,
            centerLon: centerLonFinal,
            mapBounds: mapBounds // Store for bounds checking
        };
    }

    // Update trajectories when map view changes
    updateTrajectories() {
        if (!this.enabled) return;
        
        // Recreate trajectories with current map bounds
        const oldCount = this.numPlanes;
        this.trajectories = [];
        for (let i = 0; i < oldCount; i++) {
            this.trajectories.push(this.createTrajectory(i, oldCount));
        }
        
        // Recreate planes with new trajectories
        this.createFakePlanes();
        
        console.log('Updated fake plane trajectories for new map view');
    }

    // Create FakePlane instances
    createFakePlanes() {
        this.planes = [];
        
        for (let i = 0; i < this.numPlanes; i++) {
            const trajectory = this.trajectories[i];
            // Distribute base speeds evenly between 0 and 500 knots
            const baseSpeed = 0.01; // this.numPlanes > 1 ? (i / (this.numPlanes - 1)) * 500 : 250;
            const aircraftType = types[i % types.length];
            const aircraftCategory = categories[i % categories.length];
            
            const fakePlane = new FakePlane(i, trajectory, baseSpeed, aircraftType, aircraftCategory, this.numPlanes);
            this.planes.push(fakePlane);
        }
    }

    // Start generating fake planes
    start() {
        if (this.enabled) return;

        this.enabled = true;
        this.trajectories = [];
        this.planes = [];

        // Stop real data fetching
        timersActive = false;

        // Create trajectories for each plane
        for (let i = 0; i < this.numPlanes; i++) {
            this.trajectories.push(this.createTrajectory(i, this.numPlanes));
        }

        // Create FakePlane instances
        this.createFakePlanes();

        // Set up automatic trajectory updates when map view changes (if enabled)
        if (this.autoUpdateTrajectories && typeof OLMap !== 'undefined' && OLMap) {
            this.mapMoveListener = () => {
                // Debounce updates to avoid too frequent recalculations
                if (this.updateTimeout) clearTimeout(this.updateTimeout);
                this.updateTimeout = setTimeout(() => {
                    this.updateTrajectories();
                }, 1000); // Wait 1 second after map stops moving
            };
            OLMap.getView().on('change:center', this.mapMoveListener);
            OLMap.getView().on('change:resolution', this.mapMoveListener);
        }

        // Start interval timer to update fake planes
        this.updateInterval = setInterval(() => {
            this.updateFakePlanes();
        }, 1000); // Update every second

        console.log(`Started fake planes: ${this.numPlanes} airplanes covering visible map area`);
    }

    // Stop generating fake planes
    stop() {
        this.enabled = false;
        this.planes = [];
        
        // Clear the update interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        // Clear map listeners
        if (this.mapMoveListener && typeof OLMap !== 'undefined' && OLMap) {
            OLMap.getView().un('change:center', this.mapMoveListener);
            OLMap.getView().un('change:resolution', this.mapMoveListener);
            this.mapMoveListener = null;
        }

        // Clear any pending update timeout
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }

        // Resume real data fetching
        timersActive = true;

        console.log('Stopped fake planes');
    }

    // Update fake planes and send to map
    updateFakePlanes() {
        if (!this.enabled || this.planes.length === 0) return;

        const currentTime = Date.now() / 1000;

        // Update each FakePlane instance
        for (const plane of this.planes) {
            plane.update(currentTime);
        }
true
        // Get plane data from all instances
        const aircraftData = this.planes.map(plane => plane.getData());

        // Create fake receiver update data
        const fakeData = {
            buffer: {},
            now: currentTime,
            global_ac_count_withpos: aircraftData.length,
            globeIndex: 314159,
            south: -90,
            west: -180,
            north: 90,
            east: 180,
            messages: aircraftData.reduce((sum, plane) => sum + (plane.messages || 0), 0),
            messageRate: 0.6,
            aircraft: aircraftData,
            urlIndex: "0"
        };

        // Call processReceiverUpdate to plot the planes on the map
        if (typeof processReceiverUpdate === 'function') {
            processReceiverUpdate(fakeData);
            triggerRefresh++;
            checkMovement();
        }
    }

    // Set number of fake planes (only works when stopped)
    setNumPlanes(num) {
        if (this.enabled) {
            console.warn('Cannot change plane count while fake planes are running. Stop first.');
            return;
        }
        this.numPlanes = Math.max(1, Math.min(num, 100)); // Limit to reasonable range
        console.log(`Set fake planes count to ${this.numPlanes}`);
    }

    // Enable or disable automatic trajectory updates when map view changes
    setAutoUpdateTrajectories(enabled) {
        if (this.autoUpdateTrajectories === enabled) return; // No change needed
        
        this.autoUpdateTrajectories = enabled;
        
        if (this.enabled) {
            if (enabled) {
                // Enable: set up listeners
                if (typeof OLMap !== 'undefined' && OLMap) {
                    this.mapMoveListener = () => {
                        if (this.updateTimeout) clearTimeout(this.updateTimeout);
                        this.updateTimeout = setTimeout(() => {
                            this.updateTrajectories();
                        }, 1000);
                    };
                    OLMap.getView().on('change:center', this.mapMoveListener);
                    OLMap.getView().on('change:resolution', this.mapMoveListener);
                }
            } else {
                // Disable: remove listeners
                if (this.mapMoveListener && typeof OLMap !== 'undefined' && OLMap) {
                    OLMap.getView().un('change:center', this.mapMoveListener);
                    OLMap.getView().un('change:resolution', this.mapMoveListener);
                    this.mapMoveListener = null;
                }
                if (this.updateTimeout) {
                    clearTimeout(this.updateTimeout);
                    this.updateTimeout = null;
                }
            }
        }
        
        console.log(`Auto-update trajectories: ${enabled ? 'enabled' : 'disabled'}`);
    }
}

// Global instance
window.fakePlanesManager = new FakePlanesManager();

// Console methods
window.startFakePlanes = () => window.fakePlanesManager.start();
window.stopFakePlanes = () => window.fakePlanesManager.stop();
window.setFakePlanesCount = (num) => window.fakePlanesManager.setNumPlanes(num);
window.setAutoUpdateTrajectories = (enabled) => window.fakePlanesManager.setAutoUpdateTrajectories(enabled);
window.updateFakePlanesTrajectories = () => window.fakePlanesManager.updateTrajectories();
window.getFakePlanesStatus = () => {
    console.log('Fake Planes Status:', {
        enabled: window.fakePlanesManager.enabled,
        count: window.fakePlanesManager.numPlanes,
        planes: window.fakePlanesManager.planes.length,
        autoUpdateTrajectories: window.fakePlanesManager.autoUpdateTrajectories
    });
};