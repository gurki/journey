//
//  Mesh builders for the partition pipeline.
//
//  Two flavors:
//    - buildCapMesh: a constant-thickness carpet draped on terrain.
//                    Bottom flush with terrain surface, top at +topOffset.
//                    Used for water / green / streets caps.
//    - buildPrismMeshes: vertical prisms anchored into the terrain slab.
//                    Used for building footprints.
//
//  Coordinate convention: 2D partition coords are (x_east, y_north).
//  3D mapping: x_3d = x_east, z_3d = -y_north, y_3d = altitude.
//

import * as THREE from "three";


//
//  Subdivide a ring so every edge length ≤ maxEdge.
//  Input/output ring: [ [x,y], ... ], not closed (no duplicate end point).
//


function subdivideRing( ring, maxEdge ) {
    if ( ring.length < 2 ) return ring.slice();

    const out = [];
    const n = ring.length;

    for ( let i = 0; i < n; i++ ) {
        const a = ring[ i ];
        const b = ring[ ( i + 1 ) % n ];
        const dx = b[ 0 ] - a[ 0 ];
        const dy = b[ 1 ] - a[ 1 ];
        const len = Math.hypot( dx, dy );

        out.push( a );

        if ( len > maxEdge ) {
            const steps = Math.ceil( len / maxEdge );
            for ( let s = 1; s < steps; s++ ) {
                const t = s / steps;
                out.push( [ a[ 0 ] + dx * t, a[ 1 ] + dy * t ] );
            }
        }
    }

    return out;
}


//
//  Strip the closing-duplicate point that polygon-clipping / GeoJSON tend
//  to include.  Earcut & ShapeUtils both prefer open rings.
//


function openRing( ring ) {
    const r = ring.slice();
    if ( r.length > 2 ) {
        const a = r[ 0 ], b = r[ r.length - 1 ];
        if ( a[ 0 ] === b[ 0 ] && a[ 1 ] === b[ 1 ] ) r.pop();
    }
    return r;
}


//
//  Cap mesh — one BufferGeometry covering all polygons of a region.
//
//  For each polygon we triangulate the 2D shape, then for each 2D vertex emit
//  two 3D vertices (bottom flush with terrain, top at terrain+topOffset).
//


export function buildCapMesh( multiPolygon, opts ) {

    const { terrain, topOffset, maxEdge, material } = opts;

    const positions = [];
    const indices = [];

    function sampleTerrain( x2d, y2d ) {
        if ( ! terrain ) return 0;
        return terrain.sampleLocal( x2d, -y2d );
    }

    for ( const polygon of multiPolygon ) {
        if ( polygon.length === 0 ) continue;

        const outer = subdivideRing( openRing( polygon[ 0 ] ), maxEdge );
        if ( outer.length < 3 ) continue;
        const holes = polygon.slice( 1 ).map( h => subdivideRing( openRing( h ), maxEdge ) ).filter( h => h.length >= 3 );

        //  combined order matches ShapeUtils.triangulateShape's index space:
        //    [ ...outer, ...hole0, ...hole1, ... ]
        const combined = outer.concat( ...holes );

        const contourV2 = outer.map( p => new THREE.Vector2( p[ 0 ], p[ 1 ] ) );
        const holesV2 = holes.map( h => h.map( p => new THREE.Vector2( p[ 0 ], p[ 1 ] ) ) );

        let faces;
        try {
            //  ShapeUtils mutates input arrays (pops dup end point) — we already opened them.
            faces = THREE.ShapeUtils.triangulateShape( contourV2, holesV2 );
        } catch ( err ) {
            continue;
        }
        if ( ! faces || faces.length === 0 ) continue;

        //  ShapeUtils' indices reference [ ...contourV2, ...holesV2.flat() ].
        //  Because we may have popped a duplicate from contourV2/holesV2,
        //  combined must match the post-pop ordering — which it already does
        //  since openRing() pops the same way.

        const baseVertex = positions.length / 3;

        //  Two 3D vertices per 2D point: bottom (terrain) then top (terrain + offset).
        for ( let i = 0; i < combined.length; i++ ) {
            const p = combined[ i ];
            const t = sampleTerrain( p[ 0 ], p[ 1 ] );
            positions.push( p[ 0 ], t,             -p[ 1 ] ); //  bottom
            positions.push( p[ 0 ], t + topOffset, -p[ 1 ] ); //  top
        }

        //  helpers to address the two parallel vertex layers
        const bot = i => baseVertex + 2 * i;
        const top = i => baseVertex + 2 * i + 1;

        //  Top face: ShapeUtils gives CCW indices in 2D (east, north).
        //  The 2D→3D map y_2d → -z_3d preserves CCW when viewed from +Y → top face faces up. ✓
        for ( const tri of faces ) {
            indices.push( top( tri[ 0 ] ), top( tri[ 1 ] ), top( tri[ 2 ] ) );
        }

        //  Bottom face: same triangulation, reversed winding → faces down.
        for ( const tri of faces ) {
            indices.push( bot( tri[ 0 ] ), bot( tri[ 2 ] ), bot( tri[ 1 ] ) );
        }

        //  Side walls per ring.  Outer ring CCW: outward normal is to the right
        //  of edge direction in 2D, which maps to outward in 3D.
        let offset = 0;
        const ringLengths = [ outer.length, ...holes.map( h => h.length ) ];
        for ( const ringLen of ringLengths ) {
            for ( let i = 0; i < ringLen; i++ ) {
                const a = offset + i;
                const b = offset + ( ( i + 1 ) % ringLen );
                //  (bot_a, bot_b, top_b) + (bot_a, top_b, top_a)
                indices.push( bot( a ), bot( b ), top( b ) );
                indices.push( bot( a ), top( b ), top( a ) );
            }
            offset += ringLen;
        }
    }

    if ( positions.length === 0 ) return null;

    const geometry = makeFlatShadedGeometry( positions, indices );

    return new THREE.Mesh( geometry, material );
}


//
//  Build a flat-shaded BufferGeometry: every triangle has its own 3 vertices
//  so per-face normals aren't averaged across hard edges (top↔wall seams,
//  building corners, sliver triangles in road unions).
//


function makeFlatShadedGeometry( positions, indices ) {
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute( "position", new THREE.Float32BufferAttribute( positions, 3 ) );
    geometry.setIndex( indices );
    geometry = geometry.toNonIndexed();
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}


//
//  Prism meshes for building footprints.
//
//  One mesh per footprint so individual buildings remain selectable and
//  per-feature heights are honored.  Bottom Y = terrain_min - sink so the
//  prism cleanly intersects the terrain slab on any slope; top Y = roof.
//


export function buildPrismMeshes( polygons, heights, opts ) {

    const { terrain, material, sinkBelowTerrain, slabBottomY, maxEdge } = opts;

    function sampleTerrain( x2d, y2d ) {
        if ( ! terrain ) return 0;
        return terrain.sampleLocal( x2d, -y2d );
    }

    function terrainStats( ring ) {
        let min = Infinity, sum = 0, n = 0;
        for ( const p of ring ) {
            const t = sampleTerrain( p[ 0 ], p[ 1 ] );
            if ( t < min ) min = t;
            sum += t; n += 1;
        }
        return { min: n > 0 ? min : 0, mean: n > 0 ? sum / n : 0 };
    }

    const meshes = [];

    for ( let pIdx = 0; pIdx < polygons.length; pIdx++ ) {

        const polygon = polygons[ pIdx ];
        if ( polygon.length === 0 ) continue;

        const outer = subdivideRing( openRing( polygon[ 0 ] ), maxEdge );
        if ( outer.length < 3 ) continue;
        const holes = polygon.slice( 1 ).map( h => subdivideRing( openRing( h ), maxEdge ) ).filter( h => h.length >= 3 );

        const stats = terrainStats( outer );
        const height = heights[ pIdx ] ?? 0;
        //  sink the prism foot below the local terrain min so the box reliably
        //  intersects the slab on slopes, but never dip below the printable base.
        const bottomY = Math.max( stats.min - sinkBelowTerrain, slabBottomY );
        const topY    = stats.mean + height;
        if ( topY <= bottomY ) continue;

        const positions = [];
        const indices = [];

        const combined = outer.concat( ...holes );
        const contourV2 = outer.map( p => new THREE.Vector2( p[ 0 ], p[ 1 ] ) );
        const holesV2 = holes.map( h => h.map( p => new THREE.Vector2( p[ 0 ], p[ 1 ] ) ) );

        let faces;
        try {
            faces = THREE.ShapeUtils.triangulateShape( contourV2, holesV2 );
        } catch ( err ) {
            continue;
        }
        if ( ! faces || faces.length === 0 ) continue;

        for ( let i = 0; i < combined.length; i++ ) {
            const p = combined[ i ];
            positions.push( p[ 0 ], bottomY, -p[ 1 ] );
            positions.push( p[ 0 ], topY,    -p[ 1 ] );
        }

        const bot = i => 2 * i;
        const top = i => 2 * i + 1;

        for ( const tri of faces ) {
            indices.push( top( tri[ 0 ] ), top( tri[ 1 ] ), top( tri[ 2 ] ) );
            indices.push( bot( tri[ 0 ] ), bot( tri[ 2 ] ), bot( tri[ 1 ] ) );
        }

        let offset = 0;
        const ringLengths = [ outer.length, ...holes.map( h => h.length ) ];
        for ( const ringLen of ringLengths ) {
            for ( let i = 0; i < ringLen; i++ ) {
                const a = offset + i;
                const b = offset + ( ( i + 1 ) % ringLen );
                indices.push( bot( a ), bot( b ), top( b ) );
                indices.push( bot( a ), top( b ), top( a ) );
            }
            offset += ringLen;
        }

        const geometry = makeFlatShadedGeometry( positions, indices );

        meshes.push( new THREE.Mesh( geometry, material ) );
    }

    return meshes;
}
