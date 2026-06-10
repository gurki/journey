import { STATE as $ } from "./state.js";
import * as util from "../../arc/src/util.js";
import { parseArcJourney, mergeJourneys } from "./journey/parse.js";

const DEFAULT_PRINT = {
    widthMm: Math.round( $.config.tileSize.width * 1000 ),
    heightMm: Math.round( $.config.tileSize.height * 1000 ),
    bezelMm: Math.round( $.config.bezelSize.width * 1000 ),
};

function getInitialCenter() {
    return [
        ( $.config.bounds.xmin + $.config.bounds.xmax ) / 2,
        ( $.config.bounds.ymin + $.config.bounds.ymax ) / 2,
    ];
}

function getInitialZoom() {
    return 13.4;
}

function createSelectionShell() {
    const screen = document.createElement( "main" );
    const detailOptions = Object.entries( $.config.mapbox.detailOptions )
        .map( ( [ value, option ] ) => `
            <option value="${value}" ${value === $.config.mapbox.detail ? "selected" : ""}>
                ${option.label} · z${option.zoom}
            </option>
        ` )
        .join( "" );

    screen.id = "selection";
    screen.className = "selection";
    screen.innerHTML = `
        <div id="selection-map" class="selection__map"></div>
        <div class="selection__frame-wrap" aria-hidden="true">
            <div id="selection-frame" class="selection__frame">
                <span class="selection__corner selection__corner--tl"></span>
                <span class="selection__corner selection__corner--tr"></span>
                <span class="selection__corner selection__corner--br"></span>
                <span class="selection__corner selection__corner--bl"></span>
            </div>
        </div>
        <section class="selection__panel" aria-label="Print setup">
            <div class="selection__heading">
                <p>Journey</p>
                <h1>Select Print Area</h1>
            </div>
            <label class="field">
                <span>Print width</span>
                <div class="field__control">
                    <input id="print-width" type="number" min="40" max="300" step="1" value="${DEFAULT_PRINT.widthMm}">
                    <span>mm</span>
                </div>
            </label>
            <label class="field">
                <span>Print height</span>
                <div class="field__control">
                    <input id="print-height" type="number" min="40" max="300" step="1" value="${DEFAULT_PRINT.heightMm}">
                    <span>mm</span>
                </div>
            </label>
            <label class="field">
                <span>Bezel</span>
                <div class="field__control">
                    <input id="print-bezel" type="number" min="0" max="30" step="0.5" value="${DEFAULT_PRINT.bezelMm}">
                    <span>mm</span>
                </div>
            </label>
            <label class="field">
                <span>Detail</span>
                <div class="field__control field__control--select">
                    <select id="map-detail">
                        ${detailOptions}
                    </select>
                </div>
            </label>
            <label class="field">
                <span>Journey (Arc .json — select one or many)</span>
                <div class="field__control field__control--file">
                    <input id="journey-file" type="file" accept=".json,application/json" multiple>
                </div>
                <small id="journey-status" class="field__status">No journey loaded — pick a region manually, or load one or more recordings to auto-fit.</small>
            </label>
            <div class="readout" aria-live="polite">
                <div>
                    <span>Map area</span>
                    <strong id="selection-area-size">-</strong>
                </div>
                <div>
                    <span>Scale</span>
                    <strong id="selection-scale">-</strong>
                </div>
                <div>
                    <span>Tile zoom</span>
                    <strong id="selection-zoom">-</strong>
                </div>
                <div>
                    <span>Bounds</span>
                    <strong id="selection-bounds">-</strong>
                </div>
            </div>
            <button id="build-city" class="selection__button" type="button">Build City</button>
        </section>
    `;

    document.body.prepend( screen );
    return screen;
}

function getFrameSize( frame, mapEl ) {
    const frameRect = frame.getBoundingClientRect();
    const mapRect = mapEl.getBoundingClientRect();
    return {
        width: frameRect.width,
        height: frameRect.height,
        left: frameRect.left - mapRect.left,
        top: frameRect.top - mapRect.top,
    };
}

function getBoundsFromFrame( map, frame, mapEl ) {
    const box = getFrameSize( frame, mapEl );
    const nw = map.unproject( [ box.left, box.top ] );
    const se = map.unproject( [ box.left + box.width, box.top + box.height ] );

    return {
        xmin: Math.min( nw.lng, se.lng ),
        ymin: Math.min( nw.lat, se.lat ),
        xmax: Math.max( nw.lng, se.lng ),
        ymax: Math.max( nw.lat, se.lat ),
    };
}

function measureBounds( bounds ) {
    const center = {
        latitude: ( bounds.ymin + bounds.ymax ) / 2,
        longitude: ( bounds.xmin + bounds.xmax ) / 2,
    };
    const bottomLeft = { latitude: bounds.ymin, longitude: bounds.xmin };
    const topRight = { latitude: bounds.ymax, longitude: bounds.xmax };
    const bl = util.gpsToEnu( center, bottomLeft );
    const tr = util.gpsToEnu( center, topRight );

    return {
        width: Math.abs( tr.x - bl.x ),
        height: Math.abs( tr.y - bl.y ),
    };
}

function formatMeters( value ) {
    return value >= 1000 ? `${( value / 1000 ).toFixed( 2 )} km` : `${Math.round( value )} m`;
}

function formatBounds( bounds ) {
    return `${bounds.ymin.toFixed( 5 )}, ${bounds.xmin.toFixed( 5 )}`;
}

function chooseVectorTileZoom( detail ) {
    return $.config.mapbox.detailOptions[ detail ].zoom;
}

function syncFrameAspect( frame, widthInput, heightInput ) {
    const widthMm = Number( widthInput.value );
    const heightMm = Number( heightInput.value );
    const aspect = widthMm / heightMm;
    frame.style.aspectRatio = `${widthMm} / ${heightMm}`;
    frame.classList.toggle( "selection__frame--portrait", aspect < 0.9 );
}

function readPrintSettings( widthInput, heightInput, bezelInput ) {
    return {
        widthMm: Number( widthInput.value ),
        heightMm: Number( heightInput.value ),
        bezelMm: Number( bezelInput.value ),
    };
}

function applySelection( bounds, dimensions, print, detail ) {
    $.config.bounds = bounds;
    $.config.tileSize = {
        width: print.widthMm / 1000,
        height: print.heightMm / 1000,
    };
    $.config.bezelSize = {
        width: print.bezelMm / 1000,
        height: print.bezelMm / 1000,
    };
    $.config.printScale = dimensions.width / $.config.tileSize.width;
    $.config.mapbox.detail = detail;
    $.config.mapbox.vectorTileZoom = chooseVectorTileZoom( detail );

    console.log( "🖼️ print area selected" );
    console.log(
        `   print ${print.widthMm}x${print.heightMm}mm + ${print.bezelMm}mm bezel`
    );
    console.log(
        `   world ${formatMeters( dimensions.width )} x ${formatMeters( dimensions.height )} at 1:${Math.round( $.config.printScale ).toLocaleString()}`
    );
    console.log(
        `   bounds ${bounds.ymin.toFixed( 6 )},${bounds.xmin.toFixed( 6 )} -> ${bounds.ymax.toFixed( 6 )},${bounds.xmax.toFixed( 6 )}`
    );
    console.log( `   Mapbox detail "${detail}" using vector tiles z${$.config.mapbox.vectorTileZoom}` );
}

export async function selectPrintArea() {
    if ( ! window.mapboxgl ) {
        throw new Error( "Mapbox GL JS did not load." );
    }

    window.mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    const screen = createSelectionShell();
    const mapEl = screen.querySelector( "#selection-map" );
    const frame = screen.querySelector( "#selection-frame" );
    const widthInput = screen.querySelector( "#print-width" );
    const heightInput = screen.querySelector( "#print-height" );
    const bezelInput = screen.querySelector( "#print-bezel" );
    const detailInput = screen.querySelector( "#map-detail" );
    const areaSize = screen.querySelector( "#selection-area-size" );
    const scale = screen.querySelector( "#selection-scale" );
    const zoom = screen.querySelector( "#selection-zoom" );
    const boundsText = screen.querySelector( "#selection-bounds" );
    const buildButton = screen.querySelector( "#build-city" );
    const journeyInput = screen.querySelector( "#journey-file" );
    const journeyStatus = screen.querySelector( "#journey-status" );

    syncFrameAspect( frame, widthInput, heightInput );

    const map = new window.mapboxgl.Map({
        container: mapEl,
        style: "mapbox://styles/mapbox/streets-v12",
        center: getInitialCenter(),
        zoom: getInitialZoom(),
        pitch: 0,
        bearing: 0,
    });

    map.addControl( new window.mapboxgl.NavigationControl({ visualizePitch: false }), "bottom-right" );

    function updateReadout() {
        syncFrameAspect( frame, widthInput, heightInput );
        const print = readPrintSettings( widthInput, heightInput, bezelInput );
        const bounds = getBoundsFromFrame( map, frame, mapEl );
        const dimensions = measureBounds( bounds );
        const printScale = dimensions.width / ( print.widthMm / 1000 );
        const vectorTileZoom = chooseVectorTileZoom( detailInput.value );

        areaSize.textContent = `${formatMeters( dimensions.width )} x ${formatMeters( dimensions.height )}`;
        scale.textContent = `1:${Math.round( printScale ).toLocaleString()}`;
        zoom.textContent = `z${vectorTileZoom}`;
        boundsText.textContent = formatBounds( bounds );
    }

    await new Promise( resolve => map.once( "load", resolve ) );
    updateReadout();

    map.on( "move", updateReadout );
    map.on( "zoom", updateReadout );
    window.addEventListener( "resize", updateReadout );
    [ widthInput, heightInput, bezelInput, detailInput ].forEach( input => input.addEventListener( "input", updateReadout ) );

    function paddingForFrame() {
        const mapRect = mapEl.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect();
        return {
            top:    Math.max( 0, frameRect.top - mapRect.top ),
            left:   Math.max( 0, frameRect.left - mapRect.left ),
            right:  Math.max( 0, mapRect.right - frameRect.right ),
            bottom: Math.max( 0, mapRect.bottom - frameRect.bottom ),
        };
    }

    //  split a possibly-nulled point list into contiguous coordinate arrays
    //  so the preview shows one polyline per segment (no bridging across gaps)
    function pointsToMultiLine( points ) {
        const lines = [];
        let cur = [];
        for ( const p of points ) {
            if ( p ) { cur.push( [ p.lon, p.lat ] ); }
            else if ( cur.length >= 2 ) { lines.push( cur ); cur = []; }
            else { cur = []; }
        }
        if ( cur.length >= 2 ) lines.push( cur );
        return lines;
    }

    function showJourneyOnMap( points ) {
        if ( ! map.getSource( "journey-path" ) ) {
            map.addSource( "journey-path", {
                type: "geojson",
                data: { type: "Feature", geometry: { type: "MultiLineString", coordinates: [] } },
            });
            map.addLayer({
                id: "journey-line-outline",
                type: "line",
                source: "journey-path",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#0b0b0b", "line-width": 6, "line-opacity": 0.7 },
            });
            map.addLayer({
                id: "journey-line",
                type: "line",
                source: "journey-path",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": $.config.colors.journey, "line-width": 3 },
            });
        }
        map.getSource( "journey-path" ).setData({
            type: "Feature",
            geometry: { type: "MultiLineString", coordinates: pointsToMultiLine( points ) },
        });
    }

    journeyInput.addEventListener( "change", async ev => {
        const files = Array.from( ev.target.files ?? [] );
        if ( files.length === 0 ) return;
        journeyStatus.textContent = `Reading ${files.length} file${files.length === 1 ? "" : "s"}…`;

        try {
            const parsed = [];
            for ( const file of files ) {
                const text = await file.text();
                const raw = JSON.parse( text );
                parsed.push( parseArcJourney( raw, $.config.journey ) );
            }
            const merged = mergeJourneys( parsed, $.config.journey );

            if ( ! merged.bbox || merged.points.filter( Boolean ).length < 2 ) {
                journeyStatus.textContent = `Couldn't extract a useable path from the selected file${files.length === 1 ? "" : "s"}.`;
                return;
            }
            $.journey = merged;
            showJourneyOnMap( merged.points );
            map.fitBounds(
                [
                    [ merged.bbox.xmin, merged.bbox.ymin ],
                    [ merged.bbox.xmax, merged.bbox.ymax ],
                ],
                { padding: paddingForFrame(), duration: 600 }
            );
            const span = measureBounds( merged.bbox );
            const pointCount = merged.points.filter( Boolean ).length;
            const segmentCount = merged.points.filter( p => p === null ).length + 1;
            journeyStatus.textContent =
                `Loaded ${files.length} file${files.length === 1 ? "" : "s"} → ${pointCount} pts ` +
                `in ${segmentCount} segment${segmentCount === 1 ? "" : "s"} ` +
                `(from ${merged.raw} raw) — span ${formatMeters( span.width )} × ${formatMeters( span.height )}.`;
        } catch ( err ) {
            console.error( err );
            journeyStatus.textContent = `Failed to load: ${err.message}`;
        }
    });

    return new Promise( resolve => {
        buildButton.addEventListener( "click", () => {
            const print = readPrintSettings( widthInput, heightInput, bezelInput );
            const bounds = getBoundsFromFrame( map, frame, mapEl );
            const dimensions = measureBounds( bounds );
            applySelection( bounds, dimensions, print, detailInput.value );

            window.removeEventListener( "resize", updateReadout );
            map.remove();
            screen.remove();
            resolve();
        });
    });
}
