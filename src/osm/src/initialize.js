import { STATE as $ } from "./state.js";
import { initTweakpane } from "./gui.js";
import * as util from "../../arc/src/util.js";

import { MapControls } from "three/examples/jsm/controls/MapControls";
import * as THREE from "three"


function computeDerived() {
    console.log( "🧭 computing print-space coordinates ..." );
    console.time( "⏱ derive dimensions" );
    
    $.center = { 
        latitude: ( $.config.bounds.ymax + $.config.bounds.ymin ) / 2, 
        longitude: ( $.config.bounds.xmax + $.config.bounds.xmin ) / 2 
    };

    const bottomLeft = { longitude: $.config.bounds.xmin, latitude: $.config.bounds.ymin };
    const topRight = { longitude: $.config.bounds.xmax, latitude: $.config.bounds.ymax };

    const blXY = util.gpsToEnu( $.center, bottomLeft );
    const trXY = util.gpsToEnu( $.center, topRight );

    $.innerBounds = {
        xmin: blXY.x, xmax: trXY.x,
        ymin: blXY.y, ymax: trXY.y
    };

    const w = $.innerBounds.xmax - $.innerBounds.xmin;
    const h = $.innerBounds.ymax - $.innerBounds.ymin;

    $.innerDimensions = { width: w, height: h };

    for ( const type in $.config.colors ) {
        const color = $.config.colors[ type ];
        $.materials[ type ] = new THREE.MeshStandardMaterial( { color, opacity: 0.8, transparent: false } );
    }

    //  journey path looks better with slight sheen so it pops against terrain.
    $.materials.journey = new THREE.MeshStandardMaterial({
        color: $.config.colors.journey ?? "#ff5a36",
        roughness: 0.4,
        metalness: 0.05,
    });

    $.worldTileSize = {
        width: $.config.printScale * $.config.tileSize.width,
        height: $.config.printScale * $.config.tileSize.height
    };
    $.worldBezelSize = {
        width: $.config.printScale * ( $.config.tileSize.width + $.config.bezelSize.width ),
        height: $.config.printScale * ( $.config.tileSize.height + $.config.bezelSize.height )
    };
    const tx = Math.ceil( w / $.worldTileSize.width );
    const ty = Math.ceil( h / $.worldTileSize.height );
    $.tileCount = { x: tx, y: ty };

    const ow = $.worldTileSize.width;
    const oh = $.worldTileSize.height;
    // const ow = tx * $.worldTileSize.width;
    // const oh = ty * $.worldTileSize.height;
    $.outerDimensions = { width: ow, height: oh };
    
    const obl = { x:-ow / 2, y:-oh / 2 };
    const otr = { x: ow / 2, y: oh / 2 };
    $.outerBounds = {
        xmin: obl.x, ymin: obl.y,
        xmax: otr.x, ymax: otr.y
    };

    const wobl = util.enuToGps( $.center, obl );
    const wotr = util.enuToGps( $.center, otr );
    $.worldOuterBounds = {
        ymin: wobl.latitude, xmin: wobl.longitude,
        ymax: wotr.latitude, xmax: wotr.longitude
    };

    $.worldLayerHeight = $.config.layerHeightMm * $.config.printScale / 1000;
    
    for ( const type of Object.keys( $.config.heights ) ) {
        $.heights[ type ] = $.config.printScale * $.config.heights[ type ] * $.config.layerHeightMm / 1000;
        $.polygons[ type ] = [];
    }

    console.log(
        `   center ${$.center.latitude.toFixed( 6 )}, ${$.center.longitude.toFixed( 6 )}`
    );
    console.log(
        `   tile ${$.worldTileSize.width.toFixed( 1 )}m x ${$.worldTileSize.height.toFixed( 1 )}m, bezel slab ${$.worldBezelSize.width.toFixed( 1 )}m x ${$.worldBezelSize.height.toFixed( 1 )}m`
    );
    console.log(
        `   print layer height ${$.worldLayerHeight.toFixed( 2 )}m at 1:${Math.round( $.config.printScale ).toLocaleString()}`
    );
    console.timeEnd( "⏱ derive dimensions" );

}


function initRenderer() {
    console.log( "🎥 initializing renderer and camera ..." );

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

    $.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
    $.camera.position.set( 0, 160, 190 );
    // $.camera.position.set( -82.4413977990377, 36.97457209378799, 60.04733644833405 );

    $.controls = new MapControls( $.camera, $.renderer.domElement );
    $.controls.enableDamping = true;
    $.controls.target.set( 0, 0, 10 );
    // $.controls.target.set( -70.24102308526932, 0, 60.131594706143325 );
    $.controls.update();

    window.addEventListener( "resize", resize, false );

}


function initScene() {
    console.log( "💡 setting up scene lights ..." );
    
    $.scene = new THREE.Scene();

    // const size = 1000;
    // const divisions = 10;
    // const gridHelper = new THREE.GridHelper( size, divisions, "#444", "#222" );
    // $.scene.add( gridHelper );

    // const axesHelper = new THREE.AxesHelper( 100 );
    // $.scene.add( axesHelper );

	const ambient = new THREE.AmbientLight( 0xffffff, 0.2 );
    let sun = new THREE.DirectionalLight( 0xffffff, Math.PI );
    sun.position.set( 300, 500, 100 );
	$.scene.add( ambient );
	$.scene.add( sun );

    $.scene.add( $.city );

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

    $.fpsGraph.begin();

	$.renderer.render( $.scene, $.camera );
	$.controls.update();
    
    $.fpsGraph.end();
	requestAnimationFrame( animate );

}


function initialize() {
    console.log( "🧰 initializing 3D workspace ..." );
    console.time( "⏱ initialize" );
    computeDerived();
    initTweakpane();
    initRenderer();
    initScene();
    animate();
    console.timeEnd( "⏱ initialize" );

}


export { initialize };
