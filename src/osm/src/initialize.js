import { STATE as $ } from "./state.js";

import * as THREE from "three"
import { MapControls } from "three/examples/jsm/controls/MapControls";
import Stats from "three/examples/jsm/libs/stats.module";


function initialize() {

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
    $.camera.position.set( 300, 200, 1000 );

    $.controls = new MapControls( $.camera, $.renderer.domElement );
    $.controls.enableDamping = true;

    const size = 1000;
    const divisions = 10;
    const gridHelper = new THREE.GridHelper( size, divisions, "#444", "#222" );
    $.scene.add( gridHelper );

    const axesHelper = new THREE.AxesHelper( 100 );
    $.scene.add( axesHelper );


	let ambient = new THREE.AmbientLight( 0xffffff, 0.5 );
    let sun = new THREE.DirectionalLight( 0xffffff, 0.5 );
    sun.position.set( 300, 500, 100 );
	$.scene.add( ambient );
	$.scene.add( sun );
    

    // const points = [
    //     new THREE.Vector3( 0, 0, 0 ),
    //     new THREE.Vector3( 10, 0, 0 ),
    //     new THREE.Vector3( 20, 0, -20 ),
    //     new THREE.Vector3( 40, 0, -10 ),
    // ];
    
    // const curvePath = new THREE.CurvePath();

    // for (let i = 0; i < points.length - 1; i++) {
    //     const lineCurve = new THREE.LineCurve3(points[i], points[i + 1]);
    //     curvePath.add(lineCurve);
    // }
    
    // const roadWidth = 5;
    // const roadHeight = 0.1;
    // const shape = new THREE.Shape();
    // shape.moveTo( -roadWidth / 2, 0 );
    // shape.lineTo( roadWidth / 2, 0 );
    // shape.lineTo( roadWidth / 2, roadHeight );
    // shape.lineTo( -roadWidth / 2, roadHeight );
    // shape.lineTo( -roadWidth / 2, 0 );

    // const geom = new THREE.ExtrudeGeometry( shape, {     
    //     steps: 200,
    //     bevelEnabled: false,
    //     extrudePath: curvePath
    // });
    // const mat = new THREE.MeshPhongMaterial( { color: "#00ff00" } );
    // const mesh = new THREE.Mesh( geom, mat );
    // $.scene.add( mesh );


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