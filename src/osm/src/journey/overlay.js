//
//  Journey overlay — drop a smooth half-tube on top of the built city.
//
//  Pipeline per contiguous segment of the path:
//    1. project each GPS sample to local XZ
//    2. raycast straight down through $.city — top non-building hit = anchor Y.
//       buildings are deliberately skipped so the ribbon sits at road level even
//       where the path crosses a building footprint; otherwise the ribbon would
//       climb up onto rooftops, which reads badly and isn't tactile-printable.
//    3. lay the points along a centripetal Catmull-Rom curve and resample
//       uniformly along arc-length → smooth path
//    4. at each resampled point build a half-circle cross-section perpendicular
//       to the tangent, then stitch consecutive cross-sections into a tube
//    5. close the underside with bottom-face quads and cap the ends with
//       half-disks → fully watertight, slicer-ready
//    6. anchor flush with the surface (anchorOffsetMm = 0) so the print is
//       physically connected, not floating
//
//  Smooth-shaded (indexed, no toNonIndexed) — gives the tube a continuous,
//  matte appearance rather than a faceted noodle.
//

import { STATE as $ } from "../state.js";
import * as util from "../../../arc/src/util.js";
import * as THREE from "three";


function mmToWorld( mm ) {
    return mm * $.config.printScale / 1000;
}


//  Cap-types whose top is the "road surface" we want the ribbon to ride on.
//  Includes both the partition pipeline's "streets" and the legacy "street".
const ROAD_CAP_TYPES = new Set( [ "streets", "street" ] );
const IGNORE_HIT_TYPES = new Set( [ "buildings", "journey" ] );


//  Sample the highest non-building hit directly under (sx, sz).
//  Returns { y, type } or null if no acceptable hit.
function topHitAt( sx, sz, halfW, halfH, raycaster, rayOrigin, downDir ) {
    if ( sx < -halfW || sx > halfW || sz < -halfH || sz > halfH ) return null;
    rayOrigin.set( sx, 1e6, sz );
    raycaster.set( rayOrigin, downDir );
    const hits = raycaster.intersectObject( $.city, true );
    for ( const hit of hits ) {
        const t = hit.object?.userData?.type;
        if ( IGNORE_HIT_TYPES.has( t ) ) continue;
        return { y: hit.point.y, type: t ?? null };
    }
    return null;
}


//  Drape one path point with road-snap preference:
//    fire 9 rays (center + 8 around it within snapRadius), prefer any streets-cap
//    hit, fall back to the highest other non-building hit at the center sample.
//  This keeps the ribbon at street-cap Y even when GPS noise puts an individual
//  sample on a sidewalk, a park edge, or the bare terrain — the ribbon stops
//  diving onto the underlying terrain in between road segments.
function drapeOnePoint( x, z, snapRadius, halfW, halfH, raycaster, rayOrigin, downDir ) {
    const r = snapRadius;
    const d = r * 0.70710678;     //  r/√2 — diagonals
    const offsets = [
        [ 0, 0 ],
        [ r, 0 ], [ -r, 0 ], [ 0, r ], [ 0, -r ],
        [ d, d ], [ -d, d ], [ d, -d ], [ -d, -d ],
    ];

    let bestRoadY = -Infinity;
    let foundRoad = false;
    let centerHit = null;

    for ( let i = 0; i < offsets.length; i++ ) {
        const [ dx, dz ] = offsets[ i ];
        const hit = topHitAt( x + dx, z + dz, halfW, halfH, raycaster, rayOrigin, downDir );
        if ( ! hit ) continue;
        if ( i === 0 ) centerHit = hit;
        if ( ROAD_CAP_TYPES.has( hit.type ) ) {
            if ( hit.y > bestRoadY ) bestRoadY = hit.y;
            foundRoad = true;
        }
    }

    if ( foundRoad ) return bestRoadY;
    if ( centerHit ) return centerHit.y;

    //  no mesh hit at all — fall back to terrain sample (point near edge of tile)
    if ( $.terrain ) return $.terrain.sampleLocal( x, z );
    return 0;
}


//
//  Split the (possibly nulled) point list into contiguous segments,
//  drape each via raycast (with road snapping), drop points outside the tile.
//


function drapeSegments( points, snapRadius ) {

    $.city.updateMatrixWorld( true );

    const raycaster = new THREE.Raycaster();
    raycaster.far = 1e7;
    const downDir = new THREE.Vector3( 0, -1, 0 );
    const rayOrigin = new THREE.Vector3();

    const halfW = $.worldTileSize.width  / 2;
    const halfH = $.worldTileSize.height / 2;

    const segments = [];
    let current = [];

    function flush() {
        if ( current.length >= 2 ) segments.push( current );
        current = [];
    }

    for ( const p of points ) {
        if ( ! p ) { flush(); continue; }

        const en = util.ll2en( $.center, [ p.lon, p.lat ] );
        const x = en[ 0 ];
        const z = -en[ 1 ];

        if ( x < -halfW || x > halfW || z < -halfH || z > halfH ) {
            flush();
            continue;
        }

        const y = drapeOnePoint( x, z, snapRadius, halfW, halfH, raycaster, rayOrigin, downDir );
        current.push( new THREE.Vector3( x, y, z ) );
    }
    flush();

    return segments;
}


//
//  Gaussian smoothing on Y values along a segment.  Leaves XZ untouched —
//  the route is already planar-smooth via Catmull-Rom downstream; only the
//  elevation profile needs to be tamed (cap-to-cap step transitions and any
//  residual jitter that road-snapping didn't catch).
//


function smoothSegmentY( segment, sigma ) {
    if ( sigma <= 0 || segment.length < 3 ) return segment;

    const radius = Math.max( 1, Math.ceil( sigma * 3 ) );
    const weights = new Array( 2 * radius + 1 );
    let sumW = 0;
    for ( let d = -radius; d <= radius; d++ ) {
        const w = Math.exp( - ( d * d ) / ( 2 * sigma * sigma ) );
        weights[ d + radius ] = w;
        sumW += w;
    }

    const smoothed = new Array( segment.length );
    for ( let i = 0; i < segment.length; i++ ) {
        let acc = 0;
        for ( let d = -radius; d <= radius; d++ ) {
            const j = Math.min( segment.length - 1, Math.max( 0, i + d ) );
            acc += segment[ j ].y * weights[ d + radius ];
        }
        const src = segment[ i ];
        smoothed[ i ] = new THREE.Vector3( src.x, acc / sumW, src.z );
    }
    return smoothed;
}


//
//  Build a smooth half-tube along a segment of draped 3D path points.
//  Returns { positions, indices } in arrays so multiple segments can be
//  packed into one BufferGeometry by the caller.
//


function buildHalfTubeSegment( pathPoints, radius, anchorOffset, radialSegments, sampleSpacing ) {

    if ( pathPoints.length < 2 ) return null;

    //  centripetal Catmull-Rom — best for irregular spacing, no overshoot at sharp turns
    const curve = new THREE.CatmullRomCurve3( pathPoints, false, "centripetal", 0.5 );
    const length = curve.getLength();
    if ( length <= 0 ) return null;

    const divisions = Math.max( 2, Math.ceil( length / sampleSpacing ) );
    const samples = [];
    for ( let i = 0; i <= divisions; i++ ) {
        const t = i / divisions;
        const point = curve.getPointAt( t );
        const tangent = curve.getTangentAt( t );
        samples.push({ point, tangent });
    }

    const up = new THREE.Vector3( 0, 1, 0 );
    const right = new THREE.Vector3();
    const tanXZ = new THREE.Vector3();
    const center = new THREE.Vector3();

    const positions = [];
    const indices = [];
    const segVerts = radialSegments + 1;    //  vertices per cross-section
    const totalPerSegment = ( divisions + 1 ) * segVerts;

    for ( let i = 0; i <= divisions; i++ ) {
        const { point, tangent } = samples[ i ];

        //  project tangent onto XZ so the ribbon stays world-aligned even on slopes
        tanXZ.set( tangent.x, 0, tangent.z );
        if ( tanXZ.lengthSq() < 1e-12 ) tanXZ.set( 1, 0, 0 );
        else tanXZ.normalize();

        //  "right" of the path direction (tangent × up)
        right.crossVectors( tanXZ, up ).normalize();

        //  anchor the cross-section base on the underlying surface.
        //  anchorOffset = 0 → flush; small negative → buried slightly for clean union.
        center.set( point.x, point.y + anchorOffset, point.z );

        for ( let k = 0; k <= radialSegments; k++ ) {
            //  θ from 0 (right side, at ground level) over π/2 (top) to π (left side)
            const theta = ( k / radialSegments ) * Math.PI;
            const cosT = Math.cos( theta );
            const sinT = Math.sin( theta );
            positions.push(
                center.x + right.x * cosT * radius + 0 * sinT * radius,
                center.y + right.y * cosT * radius + 1 * sinT * radius,
                center.z + right.z * cosT * radius + 0 * sinT * radius,
            );
        }
    }

    //  stitch consecutive cross-sections: for each pair (i, i+1), for each
    //  pair of radial verts (k, k+1), emit two triangles forming the quad.
    //  also emit a downward-facing bottom quad between the two base endpoints
    //  (k=0 right, k=N left) so the half-tube is closed underneath → watertight.
    for ( let i = 0; i < divisions; i++ ) {
        const a0 = i * segVerts;
        const a1 = ( i + 1 ) * segVerts;
        for ( let k = 0; k < radialSegments; k++ ) {
            const v00 = a0 + k;
            const v01 = a0 + k + 1;
            const v10 = a1 + k;
            const v11 = a1 + k + 1;
            //  outer-facing winding (CCW from outside the tube)
            indices.push( v00, v10, v11 );
            indices.push( v00, v11, v01 );
        }
        //  bottom face quad: right_i, left_i, left_{i+1}, right_{i+1}
        //  (k=0 is right side, k=radialSegments is left side at the diameter line)
        const R0 = a0 + 0;
        const L0 = a0 + radialSegments;
        const L1 = a1 + radialSegments;
        const R1 = a1 + 0;
        //  CCW when viewed from below → downward outward normal
        indices.push( R0, L0, L1 );
        indices.push( R0, L1, R1 );
    }

    //  end caps as half-disks fanning from the cross-section's center vertex.
    //  start cap normal must point backwards along path; end cap forwards.
    function addCap( crossIdx, forward ) {
        const base = crossIdx * segVerts;
        const { point } = samples[ crossIdx ];

        const centerIdx = positions.length / 3;
        positions.push( point.x, point.y + anchorOffset, point.z );

        for ( let k = 0; k < radialSegments; k++ ) {
            const v0 = base + k;
            const v1 = base + k + 1;
            //  winding chosen so the cap's outward normal points along the path
            //  direction (forward for end cap, backward for start cap).
            if ( forward ) indices.push( centerIdx, v1, v0 );
            else           indices.push( centerIdx, v0, v1 );
        }
    }

    addCap( 0, false );           //  start cap → faces backwards along path
    addCap( divisions, true );    //  end cap   → faces forwards along path

    return { positions, indices };
}


export function addJourneyOverlay() {

    if ( ! $.journey || ! $.journey.points || $.journey.points.length < 2 ) return;

    console.log( `🧭 placing journey overlay (${$.journey.points.length} pts, ${$.journey.sourceCount ?? 1} source${$.journey.sourceCount === 1 ? "" : "s"})` );
    console.time( "⏱ journey overlay" );

    const snapRadius      = mmToWorld( $.config.journey.roadSnapRadiusMm );
    const segments        = drapeSegments( $.journey.points, snapRadius );
    if ( segments.length === 0 ) {
        console.warn( "   journey overlay had no in-tile points — skipping" );
        console.timeEnd( "⏱ journey overlay" );
        return;
    }

    //  flatten the elevation profile so cap-to-cap step transitions don't
    //  show up as a wavy ribbon after Catmull-Rom interpolation.
    const ySmoothingSigma = $.config.journey.ySmoothingSigma;
    const smoothed = segments.map( seg => smoothSegmentY( seg, ySmoothingSigma ) );

    const radius          = mmToWorld( $.config.journey.widthMm ) / 2;
    const anchorOffset    = mmToWorld( $.config.journey.anchorOffsetMm );
    const sampleSpacing   = mmToWorld( $.config.journey.sampleSpacingMm );
    const radialSegments  = $.config.journey.radialSegments;

    //  Pack all segments into one BufferGeometry — fewer draw calls + one STL.
    const allPositions = [];
    const allIndices = [];
    let vertexBase = 0;
    let segmentsUsed = 0;

    for ( const seg of smoothed ) {
        const built = buildHalfTubeSegment( seg, radius, anchorOffset, radialSegments, sampleSpacing );
        if ( ! built ) continue;
        segmentsUsed += 1;
        allPositions.push( ...built.positions );
        for ( const idx of built.indices ) allIndices.push( idx + vertexBase );
        vertexBase = allPositions.length / 3;
    }

    if ( allPositions.length === 0 ) {
        console.warn( "   journey overlay produced no geometry — skipping" );
        console.timeEnd( "⏱ journey overlay" );
        return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute( "position", new THREE.Float32BufferAttribute( allPositions, 3 ) );
    geometry.setIndex( allIndices );
    //  smooth-shaded — leave indexed so computeVertexNormals averages across
    //  shared verts on the tube, giving the matte continuous look.
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const material = $.materials.journey ?? new THREE.MeshStandardMaterial({
        color: $.config.colors.journey ?? "#ff5a36",
        roughness: 0.4,
        metalness: 0.05,
    });

    const mesh = new THREE.Mesh( geometry, material );
    mesh.name = "journey";
    mesh.userData.type = "journey";
    mesh.userData.terrainPlaced = true;

    const group = new THREE.Group();
    group.name = "journey";
    group.add( mesh );
    $.city.add( group );

    console.log( `   ${segmentsUsed} segment${segmentsUsed === 1 ? "" : "s"}, ${( allPositions.length / 3 ).toLocaleString()} verts` );
    console.timeEnd( "⏱ journey overlay" );
}
