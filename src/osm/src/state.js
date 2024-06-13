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
        bounds: { ymin: 47.5089, xmin: 19.0722, ymax: 47.5190, xmax: 19.0867 }, //  hom
        scale: 7500,
        tileSize: { width: 0.15, height: 0.15 },
        layerHeightMm: 0.2,   
        colors: {
            parks: "#2c4",      //  parks, gardens
            water: "#0ff",      //  lakes, rivers, oceans
            stone: "#cc7",      //  stones, rocks, boulders
            greenery: "#294",   //  trees, bushes, shrubbery
            buildings: "#ccc",  //  houses and more
            street: "#777",     //  often has "lanes" 
            path: "#aaa",       //  often has "width"
            pedestrian: "#555", //  highway, but polygon
            railway: "#666",    //  rails
            ground: "#161616",  //  baseplate
        },
        heights: {
            parks: 1,
            water: 2,
            stone: 2,
            greenery: 2,
            buildings: 5,   //  per level
            street: 3,
            path: 4,
            pedestrian: 2,
            railway: 2,
            ground: 10,
        },
        widths: {
            base: 4, //  fallback, e.g. neither lanes nor width
            propWidth: 1,
            propLane: 5, 
            railway: 3,
        },
        defaults: {
            lanes: 1,
            levels: 4,
            steps: 20
        },
        container: "container",
    },
    
    materials: {},

    center: null,
    innerBounds: null,
    innerDimensions: null,
    outerBounds: null,
    outerDimensions: null,
    worldOuterBounds: null,
    worldTileSize: null,
    worldLayerHeight: null,
    tileCount: null
        
}