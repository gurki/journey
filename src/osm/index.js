import { STATE as $ } from "./src/state.js";
import { build } from "./src/build.js";
import { initialize } from "./src/initialize.js";

import {GPXLoader} from "@loaders.gl/kml";
import {load} from "@loaders.gl/core";


initialize();
await build();




////////////////////////////////////////////////////////////////////////////////
//  transparent city


// $.city.traverse( child => {
//     if ( ! child.isMesh ) return;
//     child.material.transparent = true;
//     child.material.opacity = 0.8;
// });



////////////////////////////////////////////////////////////////////////////////
//  gpx


// const data = await load( "2024-05-28.gpx", GPXLoader );

// for ( const feature of data.features ) {

//     const geom = feature.geometry;
    
//     if ( geom.type !== "LineString" ) {
//         console.log( geom.type );
//         continue;
//     }

//     const coords = geom.coordinates;
//     const points = coords.map( coord => {
//         const arr = util.gpsArrToEnu( $.center, coord );
//         console.log( ...arr );
//         return new THREE.Vector3( arr[0], arr[2], -arr[1] );
//     });

//     const curve = new THREE.CatmullRomCurve3( points );
//     const geometry = new THREE.TubeGeometry( curve, points.length, 2, 8, false );
//     // const geometry = new THREE.BufferGeometry().setFromPoints( points );
//     const material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
//     const track = new THREE.Mesh( geometry, material );
//     $.scene.add( track );

// }