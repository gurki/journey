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
    geometries: {},
    city: new THREE.Group(),
    
    config: {
        colors: {
            parks: "#2c4",
            water: "#0ff",
            stone: "#cc7",
            greenery: "#294",
            buildings: "#ccc",
            street: "#777",
            path: "#aaa",
            pedestrian: "#555",
            railway: "#666",
            ground: "#161616",
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
        // bounds:  { ymin: 47.47749, xmin: 19.0287947, ymax: 47.52146, xmax: 19.0854007 }, //  total
        bounds: { ymin: 47.5089, xmin: 19.0722, ymax: 47.5190, xmax: 19.0867 }, //  hom
        container: "container",
    },
    
    center: null,
    localBounds: null,
    dimensions: null,
    materials: {},
        
}