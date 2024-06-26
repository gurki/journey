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
    city: new THREE.Group(),
    
    config: {
        // bounds:  { ymin: 47.47749, xmin: 19.0287947, ymax: 47.52146, xmax: 19.0854007 }, //  total
        bounds: { xmin: 19.0722, ymin: 47.5089, xmax: 19.0867, ymax: 47.5190 }, //  hom
        scale: 10000,
        renderScale: 1000,
        tileSize: { width: 0.15, height: 0.15 },
        layerHeightMm: 0.2,   
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
            buildings: null,    //  unused
            greenery: 2,
            ground: 3,
            parks: 1,
            path: 5,
            pedestrian: 4,
            railway: 2,     
            stone: 3,
            street: 4,
            unknown: 6,
            water: 3,
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
            base: 4,        //  fallback, e.g. neither lanes nor width
            propWidth: 1,
            propLane: 5, 
            railway: 3,
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
    worldLayerHeight: null,
    tileCount: null,

}