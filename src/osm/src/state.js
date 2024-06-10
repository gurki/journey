import * as THREE from "three";


export const STATE = {

    container: null,
    containerSize: new THREE.Vector2(),

    scene: null,
    camera: null,
    renderer: null,
    controls: null,

    buildingGeom: null,
    railwayGeom: null,
    grassGeom: null,
    plantsGeom: null,
    stoneGeom: null,
    waterGeom: null,
    streetGeom: null,
    pathGeom: null,
    pedestrianGeom: null,

    city: new THREE.Group(),

    config: {
        // bounds:  { ymin: 47.47749, xmin: 19.0287947, ymax: 47.52146, xmax: 19.0854007 }, //  total
        bounds: { ymin: 47.5089, xmin: 19.0722, ymax: 47.5190, xmax: 19.0867 }, //  hom
        container: "container",
    },
    
    center: null,
    localBounds: null,
    dimensions: null,
        
}