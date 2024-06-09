import * as THREE from "three";


export const STATE = {

    container: null,
    containerSize: new THREE.Vector2(),

    scene: null,
    camera: null,
    renderer: null,
    controls: null,

    center: null,

    config: {
        bounds: null,
        container: "container",
    },

}