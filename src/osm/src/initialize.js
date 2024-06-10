import { STATE as $ } from "./state.js";

import * as util from "../../arc/src/util.js";

import * as THREE from "three"
import { MapControls } from "three/examples/jsm/controls/MapControls";
import Stats from "three/examples/jsm/libs/stats.module";


function initialize() {

    $.center = { 
        latitude: ( $.config.bounds.ymax + $.config.bounds.ymin ) / 2, 
        longitude: ( $.config.bounds.xmax + $.config.bounds.xmin ) / 2 
    };

    const bottomLeft = { longitude: $.config.bounds.xmin, latitude: $.config.bounds.ymin };
    const topRight = { longitude: $.config.bounds.xmax, latitude: $.config.bounds.ymax };

    const blXY = util.gpsToEnu( $.center, bottomLeft );
    const trXY = util.gpsToEnu( $.center, topRight );

    $.localBounds = {
        xmin: blXY.x, xmax: trXY.x,
        ymin: blXY.y, ymax: trXY.y
    };

    $.dimensions = {
        width: $.localBounds.xmax - $.localBounds.xmin, 
        height: $.localBounds.ymax - $.localBounds.ymin, 
    };

    $.container = document.getElementById( $.config.container );
    $.containerSize.x = container.clientWidth;
    $.containerSize.y = container.clientHeight;
    
    $.renderer = new THREE.WebGLRenderer();
    $.renderer.setSize( window.innerWidth, window.innerHeight );
    $.renderer.setPixelRatio(window.devicePixelRatio);
	$.renderer.shadowMap.enabled = true;
	$.renderer.shadowMap.type = THREE.BasicShadowMap;
    $.renderer.setClearColor( "#111" );
    $.container.appendChild( $.renderer.domElement );


    $.scene = new THREE.Scene();

    $.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
    $.camera.position.set( 0, 1000, 1000 );

    $.controls = new MapControls( $.camera, $.renderer.domElement );
    $.controls.enableDamping = true;
    $.controls.target.set( 0, 0, 100 );
    $.controls.update();

    const size = 1000;
    const divisions = 10;
    const gridHelper = new THREE.GridHelper( size, divisions, "#444", "#222" );
    $.scene.add( gridHelper );

    const axesHelper = new THREE.AxesHelper( 100 );
    $.scene.add( axesHelper );

	let ambient = new THREE.AmbientLight( 0xffffff, 0.2 );
    let sun = new THREE.DirectionalLight( 0xffffff, Math.PI );
    sun.position.set( 300, 500, 100 );
	$.scene.add( ambient );
	$.scene.add( sun );

    $.scene.add( $.city );


    $.stats = new Stats();
    $.container.appendChild( $.stats.dom );

    window.addEventListener( "resize", resize, false );

}


function resize() {

	$.container = document.getElementById( $.config.container );
	$.containerSize.x = container.clientWidth;
	$.containerSize.y = container.clientHeight;

	$.camera.aspect = $.containerSize.x / $.containerSize.y;
	$.camera.updateProjectionMatrix();
	$.renderer.setSize( $.containerSize.x, $.containerSize.y );

}


function animate() {

	requestAnimationFrame( animate );
	$.renderer.render( $.scene, $.camera );

    $.stats.update();
	$.controls.update();

}


export { initialize, animate };