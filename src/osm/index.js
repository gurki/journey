import { build } from "./src/build.js";
import { initialize } from "./src/initialize.js";
import {GPXLoader} from '@loaders.gl/kml';
import {load} from '@loaders.gl/core';
import * as util from "../arc/src/util.js";
import { STATE as $ } from "./src/state.js";
import * as THREE from "three"
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import * as jscad from "@jscad/modeling";
import { export3MF, exportSTL } from "./src/export.js";
import { CSG } from "three-csg-ts";
import { geom3, poly3 } from '@jscad/modeling/src/geometries';


initialize();
// await build();


/**
 * Convert a JSCAD geom3 object to a Three.js BufferGeometry
 * @param {geom3} jscadGeom3 - The JSCAD geom3 object
 * @returns {THREE.BufferGeometry} - The converted Three.js BufferGeometry object
 */
function convertGeom3ToBufferGeometry(jscadGeom3) {
  const polygons = geom3.toPolygons(jscadGeom3);
  const vertices = [];
  const indices = [];

  polygons.forEach(polygon => {
    const baseIndex = vertices.length / 3;
    const points = poly3.toPoints(polygon);

    points.forEach(point => {
      vertices.push(point[0], point[1], point[2]);
    });

    for (let i = 1; i < points.length - 1; i++) {
      indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);

  geometry.computeVertexNormals(); // Optionally compute normals

  return geometry;
}


/**
 * Convert a Three.js BufferGeometry to a JSCAD geom3 object
 * @param {THREE.BufferGeometry} bufferGeometry - The Three.js BufferGeometry object
 * @returns {geom3} - The converted JSCAD geom3 object
 */
function convertBufferGeometryToGeom3(bufferGeometry) {
  const positions = bufferGeometry.attributes.position.array;
  const index = bufferGeometry.index ? bufferGeometry.index.array : null;
  const polygons = [];

  if (index) {
    // Indexed geometry
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i] * 3;
      const b = index[i + 1] * 3;
      const c = index[i + 2] * 3;
      const polygon = [
        [positions[a], positions[a + 1], positions[a + 2]],
        [positions[b], positions[b + 1], positions[b + 2]],
        [positions[c], positions[c + 1], positions[c + 2]],
      ];
      polygons.push(poly3.fromPoints(polygon));
    }
  } else {
    // Non-indexed geometry
    for (let i = 0; i < positions.length; i += 9) {
      const polygon = [
        [positions[i], positions[i + 1], positions[i + 2]],
        [positions[i + 3], positions[i + 4], positions[i + 5]],
        [positions[i + 6], positions[i + 7], positions[i + 8]],
      ];
      polygons.push(poly3.fromPoints(polygon));
    }
  }

  return geom3.create(polygons);
}



const geom3A = jscad.primitives.geodesicSphere( { radius: 70 } );
const geom3B = jscad.primitives.cylinder( { height: 100, radius: 50 } );
let union3 = jscad.booleans.union( geom3A, geom3B );
// console.log( union3 );
union3 = jscad.modifiers.generalize( { snap: true, simplify: true, triangulate: true }, union3 );
// console.log( union3 );
let union = convertGeom3ToBufferGeometry( union3 );
// let union = csgA.union( csgB ).toGeometry( new THREE.Matrix4() );
// union = mergeVertices( union, 0.1 );
// console.log( geomA.attributes.position );
// console.log( geomB.attributes.position );
// console.log( union.attributes.position );
const mesh = new THREE.Mesh( union, new THREE.MeshStandardMaterial( { color: "green" } ) );
$.city.add( mesh );

// export3MF( union3 );
// exportSTL();

// const wireframe = new THREE.WireframeGeometry( union );
// $.scene.add( new THREE.LineSegments( wireframe ) );
// const normals = new VertexNormalsHelper( mesh, 10, 0xff0000 )
// mesh.add( normals );


// $.city.traverse( child => {
//     if ( ! child.isMesh ) return;
//     child.material.transparent = true;
//     child.material.opacity = 0.5;
// });


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