import * as THREE from "three";


export const STATE = {

    container: null,
    containerSize: new THREE.Vector2(),
    pane: null,
    fpsGraph: null,

    scene: null,
    camera: null,
    renderer: null,
    controls: null,

    data: null,
    operations: {},
    geometries: {},
    polygons: {},
    city: new THREE.Group(),
    
    config: {
        pipeline: "legacy",   //  "legacy" | "partition"
        bounds:  { ymin: 47.47749, xmin: 19.0287947, ymax: 47.52146, xmax: 19.0854007 }, //  total
        // bounds: { xmin: 19.0722, ymin: 47.5089, xmax: 19.0867, ymax: 47.5190 }, //  hom
        // bounds: { xmin: 11.747047, ymin: 47.633330, xmax: 11.886271, ymax: 47.724868 }, //  alps
        printScale: 15000,
        renderScale: 1000,
        tileSize: { width: 0.141, height: 0.141 },
        bezelSize: { width: 0.009, height: 0.009 },
        layerHeightMm: 0.2,   
        mapbox: {
            vectorTileZoom: 15,
            detail: "street",
            detailOptions: {
                country: {
                    label: "Country",
                    zoom: 9,
                    types: [ "water", "street", "railway" ],
                    roadClasses: [ "motorway", "motorway_link", "trunk", "trunk_link", "primary" ],
                    railClasses: [ "major_rail" ],
                    includePaths: false,
                    roadSimplifyMm: 0.8,
                    minRoadLengthMm: 2,
                },
                city: {
                    label: "City",
                    zoom: 12,
                    types: [ "buildings", "water", "parks", "greenery", "stone", "pedestrian", "street", "railway", "path" ],
                    roadClasses: [ "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "street", "street_limited" ],
                    railClasses: [ "major_rail", "minor_rail" ],
                    includePaths: false,
                    roadSimplifyMm: 0.35,
                    minRoadLengthMm: 1.4,
                },
                street: {
                    label: "Street",
                    zoom: 15,
                    types: [ "buildings", "water", "parks", "greenery", "stone", "pedestrian", "street", "railway", "path" ],
                    roadClasses: [ "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "street", "street_limited" ],
                    railClasses: [ "major_rail", "minor_rail", "service_rail" ],
                    includePaths: true,
                    roadSimplifyMm: 0.18,
                    minRoadLengthMm: 0.8,
                },
            },
        },
        terrain: {
            enabled: true,
            demZoom: 13,
            exaggeration: 1,
            segments: 160,
            overlayThicknessLayers: 1,
            transportThicknessLayers: 1,
            roadExpansionSegments: 6,
            drapeSupersampling: {
                enabled: true,
                maxEdgeMm: 0.8,
                maxDepth: 7,
            },
            placement: {
                buildings: "rigid",
                water: "flat",
                parks: "overlay",
                greenery: "overlay",
                stone: "overlay",
                pedestrian: "overlay",
                street: "overlay",
                railway: "overlay",
                path: "overlay",
            },
        },
        journey: {
            //  half-tube cross-section
            widthMm:        1.6,    //  diameter at the base of the half-tube (radius = widthMm/2)
            //  vertical offset of the tube base above the underlying surface.
            //  0 → flush with the surface (printable, no floating).  small negative
            //  (e.g. -0.1) buries the base slightly to guarantee a clean union with
            //  the surface when slicing.
            anchorOffsetMm: -0.1,
            //  number of radial segments around the half-circle cross-section
            //  (higher = smoother tube, more triangles)
            radialSegments: 12,
            //  sample spacing along the path in print mm — the smoothed Catmull-Rom
            //  curve is resampled at this resolution, so smaller = smoother curve
            sampleSpacingMm: 0.8,
            //  per-sample filtering when parsing the source JSON
            maxAccuracyMeters: 50,
            minSpacingMeters:  3,
            simplifyMeters:    4,
            //  consecutive samples whose timestamps differ by more than this
            //  break the ribbon (avoids bridging across day boundaries / gaps)
            timeGapBreakSeconds: 600,
            //  XZ neighborhood radius for road snapping when draping a path point.
            //  if the streets cap is hit anywhere within this radius of a sample,
            //  the sample uses the streets cap Y — keeps the ribbon at road level
            //  even when GPS noise puts an individual sample on a sidewalk / park.
            //  ~0.5mm at 1:15000 = ~7.5m world, covers typical GPS noise + sidewalk.
            roadSnapRadiusMm: 0.5,
            //  Gaussian smoothing on Y values along the path (in path-sample units).
            //  larger sigma → smoother elevation profile, kills remaining cap-to-
            //  terrain transitions.  0 disables.
            ySmoothingSigma: 3,
        },
        partition: {
            //  bas-relief step heights above terrain, in printed millimeters.
            //  each cap is a constant-thickness carpet draped on terrain: its
            //  bottom flush with the terrain surface, top at +offset above.
            //  kept low enough that even modest real-world buildings (≥10m)
            //  poke above the tallest cap (streets) at city print scales.
            //  ordered so caps never share top-Y → no z-fighting by construction.
            //  practical floor: ≥0.2mm = 1 layer at 0.2mm layer height.
            capOffsetsMm: {
                water:    0.2,
                green:    0.4,
                streets:  0.6,
            },
            //  max edge length on subdivided rings (print mm).
            //  smaller = better terrain following on long polygon edges, more tris.
            maxEdgeMm: 1.5,
            //  buildings sink this far below local terrain min to ensure clean union.
            buildingFootSinkMm: 1.0,
            //  trim caps to just inside the tile by this much to avoid bezel z-fight.
            tileInsetMm: 0.0,
        },
        colors: {
            buildings: "#ccc",  //  houses and more
            greenery: "#294",   //  trees, bushes, shrubbery
            ground: "#161616",  //  baseplate
            journey: "#ff5a36", //  recorded GPS path accent
            parks: "#2c4",      //  parks, gardens
            path: "#aaa",       //  often has "width"
            pedestrian: "#555", //  highway, but polygon
            railway: "#666",    //  rails
            stone: "#cc7",      //  stones, rocks, boulders
            street: "#777",     //  often has "lanes"
            unknown: "#f00",
            water: "#0ff",      //  lakes, rivers, oceans
        },
        heights: {  //  [printLayers] if not stated otherwise
            buildings: 15,  //  meters
            greenery: 4,
            ground: 3,
            parks: 2,
            path: 6,
            pedestrian: 6,
            railway: 4,     
            stone: 6,
            street: 4,
            water: 4,
            unknown: 12,
        },
        heightOffsets: { 
            buildings: 0,
            greenery: 0,
            ground: 0,
            parks: 0,
            path: 0,
            pedestrian: 0,
            railway: 0,     
            stone: 0,
            street: 0,
            unknown: 0,
            water: 0,
        },
        widths: {           //  [m]
            base: 2,        //  fallback, e.g. neither lanes nor width
            propWidth: 1,
            propLane: 3.5, 
            railway: 4,
        },
        defaults: {
            lanes: 1,
            levels: 4
        },
        container: "container",
    },
    
    materials: {},
    heights: {},

    journey: null,    //  { points: [{lon, lat, alt, t, speed, moving}], bbox: {xmin,ymin,xmax,ymax} }

    center: null,
    innerBounds: null,
    innerDimensions: null,
    outerBounds: null,
    outerDimensions: null,
    worldOuterBounds: null,
    worldTileSize: null,
    worldBezelSize: null,
    worldLayerHeight: null,
    tileCount: null,
    terrain: null,

}
