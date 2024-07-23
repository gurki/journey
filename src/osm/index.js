import { STATE as $ } from "./src/state.js";
import { build } from "./src/build.js";
import { initialize } from "./src/initialize.js";
import { fetchHeightmapsForBounds } from "./src/heightmap.js";
import * as THREE from "three";


initialize();
// await build();

const heightmaps = await fetchHeightmapsForBounds( $.worldOuterBounds, 14, import.meta.env.VITE_MAPBOX_ACCESS_TOKEN );
const heights = heightmaps[ 0 ].data;

const plane = new THREE.PlaneGeometry( 256, 256, 255, 255 );
plane.rotateX( - Math.PI / 2 );
const verts = plane.attributes.position.array;

console.log( verts.length / 3, heights.length );

for ( let i = 0; i < heights.length; i++ ) {
    verts[ 3 * i + 1 ] = heights[ i ];
}

plane.computeVertexNormals();
$.city.add( new THREE.Mesh( plane, new THREE.MeshStandardMaterial( { color: 0xffff00 } ) ));


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