import * as jscad from "@jscad/modeling";
import * as THREE from "three"


export function toBufferGeometry( geom3 ) {

    const polygons = jscad.geometries.geom3.toPolygons( geom3 );
    const vertices = [];
    const indices = [];
  
    polygons.forEach( polygon => {

        const baseIndex = vertices.length / 3;
        const points = jscad.geometries.poly3.toPoints( polygon );

        points.forEach( point => {
            vertices.push( point[0], point[2], -point[1] ); //  ENU to OGL
        });

        for ( let i = 1; i < points.length - 1; i++ ) {
            indices.push( baseIndex, baseIndex + i, baseIndex + i + 1 );
        }
        
    });
  
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute( "position", new THREE.Float32BufferAttribute( vertices, 3 ) );
    geometry.setIndex( indices );
    geometry = geometry.toNonIndexed();
    geometry.computeVertexNormals();
  
    return geometry;

}


export function extrude( geom2, height ) {
    return jscad.extrusions.extrudeLinear( { height }, geom2 );
}


export function mergeAll( geom3s ) {

    if ( geom3s.length === 0 ) {
        return undefined;
    }

    if ( geom3s.length === 1 ) {
        return geom3s[ 0 ];
    }

    const n = geom3s.length;
    const half = Math.floor( n / 2 );
    const left = mergeAll( geom3s.slice( 0, half ) );
    const right = mergeAll( geom3s.slice( half, n ) );
    return jscad.booleans.union( left, right );

}