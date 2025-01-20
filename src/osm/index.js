import { STATE as $ } from "./src/state.js";
import { build } from "./src/build.js";
import { initialize } from "./src/initialize.js";


initialize();
// await build();

import "./src/terrain.js"






////////////////////////////////////////////////////////////////////////////////
//  transparent city


// $.city.traverse( child => {
//     if ( ! child.isMesh ) return;
//     child.material.transparent = true;
//     child.material.opacity = 0.8;
// });



////////////////////////////////////////////////////////////////////////////////
//  gpx

// import { GPXLoader } from "@loaders.gl/kml";
// import { load } from "@loaders.gl/core";
// import * as util from "../arc/src/util.js";
// import * as THREE from "three";

// const files = [
//     // "data/2024-05-26.gpx",
//     // "data/2024-05-27.gpx",
//     // "data/2024-05-28.gpx",
//     "data/2024-05-29.gpx",
//     "data/2024-05-30.gpx",
// ];

// const data = await Promise.all( files.map( async file => ( await load( file, GPXLoader ) ).features ) );
// const raycaster = new THREE.Raycaster();
// const DOWN = new THREE.Vector3( 0, -1, 0 );


// function getRandomColor() {
//     const r = Math.floor(Math.random() * 256);
//     const g = Math.floor(Math.random() * 256);
//     const b = Math.floor(Math.random() * 256);
//     return new THREE.Color(`rgb(${r},${g},${b})`);
// }


// for ( const feature of data.flat() ) {

//     const geom = feature.geometry;

//     if ( geom.type !== "LineString" ) {
//         // console.log( geom.type );
//         continue;
//     }

//     const coords = geom.coordinates;
//     const points = coords.map( coord => {
//         const arr = util.lla2enu( $.center, coord );
//         const xz = new THREE.Vector3( arr[0], arr[2], -arr[1] );
//         return xz;
//     });

//     const curveA = new THREE.CatmullRomCurve3( points );
//     const spaced = curveA.getSpacedPoints( points.length * 8 );

//     const projected = spaced.map( point => {
//         raycaster.set( point, DOWN );
//         const inters = raycaster.intersectObject( $.city, true );
//         if ( inters.length > 0 ) {
//            return inters[ 0 ].point;
//         }
//         return point.setY( 3 );
//     });

//     const curveB = new THREE.CatmullRomCurve3( projected );
//     const geometry = new THREE.TubeGeometry( curveB, projected.length, 2, 4, false );
//     const material = new THREE.MeshStandardMaterial( { color: getRandomColor() } );
//     const track = new THREE.Mesh( geometry, material );
//     // const geometry = new THREE.BufferGeometry().setFromPoints( projected );
//     // const material = new THREE.PointsMaterial( { color: getRandomColor() } );
//     // const track = new THREE.Points( geometry, material );
//     $.scene.add( track );

// }



const s = $.config.renderScale / $.config.printScale;
$.scene.scale.set( s, s, s );