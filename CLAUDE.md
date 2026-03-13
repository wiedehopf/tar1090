# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

tar1090 is an improved web interface for ADS-B aircraft tracking decoders (readsb/dump1090-fa). It displays real-time aircraft positions on an interactive OpenLayers map. The project is primarily vanilla JavaScript (frontend) and Bash (backend/deployment), with no build step or bundler — files are served directly.

## Development & Testing

There is no traditional build system, test framework, or linter. Development workflow:

- **Local testing:** `sudo ./install.sh test` — installs from the local directory instead of pulling from GitHub
- **Template processing:** `.tmpl` files (e.g., `layers.js.tmpl`, `api.js.tmpl`) are processed by `install.sh` using sed/bash substitution during installation
- **Cache busting:** `cachebust.sh` renames files with MD5 hashes and updates references in `index.html` and `script.js`
- **Version tagging:** `tag.sh` manages version numbers (stored in `version` file, currently 3.14.x)

No compilation, transpilation, or npm/webpack steps exist. Edit files directly and reinstall to test.

## Architecture

### Frontend (html/)

Script loading order in `index.html` matters — globals are shared across files via window scope:

1. **early.js** — Initializes the `g` global object and `TAR` namespace. Starts downloading history chunks in parallel with page load (performance optimization). Manages deferred loading via jQuery Deferreds.
2. **defaults.js** — Declares all configurable settings as global `let` variables with defaults (e.g., `DisplayUnits`, `DefaultZoomLvl`, `SiteShow`).
3. **config.js** — User overrides for settings defined in `defaults.js`. Lines are commented out by default; users uncomment to activate.
4. **dbloader.js** — Loads aircraft metadata database.
5. **registrations.js** — Aircraft registration lookup tables.
6. **formatter.js** — Data formatting utilities (altitude, speed, distance, coordinates).
7. **flags.js** — Aircraft flag/property system for categorization.
8. **layers.js** (from `.tmpl`) — Map tile layer definitions (OSM, ESRI, weather overlays, etc.).
9. **markers.js** — SVG aircraft icon rendering and caching system (~1500 lines).
10. **planeObject.js** — Aircraft data model class (~3200 lines). Handles track rendering, data updates, trail management.
11. **script.js** — Main application logic (~9200 lines). Map initialization, UI event handlers, data fetching loop, table rendering, filtering.

Key libraries in `html/libs/`: OpenLayers (`ol-custom-10.6.1.js`), jQuery 3.6.1, jQuery UI 1.13.2, Zstandard decoder (`zstddec-tar1090-0.0.5.js`).

### Backend (Bash)

- **tar1090.sh** — Runs as a systemd service. Monitors `aircraft.json` from the ADS-B decoder source directory, prunes data, creates gzip-compressed history chunks in `/run/tar1090/`.
- **install.sh** — Handles full deployment: installs dependencies via apt, configures nginx/lighttpd, sets up systemd services, processes template files, copies frontend to `/usr/local/share/tar1090/html/`.

### Data Flow

```
ADS-B Receiver (readsb/dump1090-fa)
  → aircraft.json (source directory)
  → tar1090.sh (prune/compress into history chunks)
  → /run/tar1090/ (chunks.json, current_*.gz, chunks_*.json.gz)
  → Web server (nginx/lighttpd serves static files + JSON data)
  → Browser (early.js fetches chunks → script.js renders on OpenLayers map)
```

### Configuration

- **Runtime config:** `/etc/default/tar1090` — Controls INTERVAL (snapshot frequency), HISTORY_SIZE (number of snapshots), PTRACKS (hours of persistent tracks), GZIP_LVL.
- **Web UI config:** `html/config.js` — User-facing settings. Overrides values from `defaults.js` by uncommenting lines.
- **Systemd service:** `tar1090.service` — Service unit template.
- **Web server:** `nginx.conf` and `88-tar1090.conf` (lighttpd) — Server configuration templates.

## Key Conventions

- All frontend JS uses `"use strict"` mode and shares state through global variables (no module system).
- The `g` object (defined in `early.js`) is used to store large shared data structures to avoid closure-related memory issues.
- Template files (`.tmpl`) contain placeholder tokens replaced by `install.sh` during deployment.
- The project targets Debian/Ubuntu/Raspbian systems and Raspberry Pi hardware — keep performance considerations in mind.
- Multi-instance support: multiple tar1090 instances can run on the same machine with different data sources.
