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
        colors: {
            buildings: "#ccc",  //  houses and more
            greenery: "#294",   //  trees, bushes, shrubbery
            ground: "#161616",  //  baseplate
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
