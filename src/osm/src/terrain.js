import { fetchHeightmapsForBounds } from "./heightmap.js";
import { STATE as $ } from "./state.js";
import * as util from "../../arc/src/util.js";
import * as THREE from "three";


function bboxToBounds( bbox ) {
    return {
        xmin: bbox[ 0 ],
        ymin: bbox[ 1 ],
        xmax: bbox[ 2 ],
        ymax: bbox[ 3 ],
    };
}


function localToGps( x, z ) {
    return util.enuToGps( $.center, { x, y: -z, z: 0 } );
}


function gpsToLocal( longitude, latitude ) {
    const en = util.ll2en( $.center, [ longitude, latitude ] );
    return { x: en[ 0 ], z: -en[ 1 ] };
}


function getHeightAtPixel( heightmap, px, py ) {
    const x = Math.max( 0, Math.min( heightmap.width - 1, px ) );
    const y = Math.max( 0, Math.min( heightmap.height - 1, py ) );
    return heightmap.data[ y * heightmap.width + x ];
}


function sampleHeightmap( heightmap, longitude, latitude ) {
    const bounds = bboxToBounds( heightmap.bbox );

    if (
        longitude < bounds.xmin || longitude > bounds.xmax ||
        latitude < bounds.ymin || latitude > bounds.ymax
    ) {
        return undefined;
    }

    const u = ( longitude - bounds.xmin ) / ( bounds.xmax - bounds.xmin );
    const v = ( bounds.ymax - latitude ) / ( bounds.ymax - bounds.ymin );
    const x = u * ( heightmap.width - 1 );
    const y = v * ( heightmap.height - 1 );
    const x0 = Math.floor( x );
    const y0 = Math.floor( y );
    const x1 = Math.min( x0 + 1, heightmap.width - 1 );
    const y1 = Math.min( y0 + 1, heightmap.height - 1 );
    const tx = x - x0;
    const ty = y - y0;

    const h00 = getHeightAtPixel( heightmap, x0, y0 );
    const h10 = getHeightAtPixel( heightmap, x1, y0 );
    const h01 = getHeightAtPixel( heightmap, x0, y1 );
    const h11 = getHeightAtPixel( heightmap, x1, y1 );
    const top = h00 * ( 1 - tx ) + h10 * tx;
    const bottom = h01 * ( 1 - tx ) + h11 * tx;

    return top * ( 1 - ty ) + bottom * ty;
}


function createTerrainSampler( heightmaps ) {
    let min = Infinity;
    let max = -Infinity;

    for ( const heightmap of heightmaps ) {
        for ( const height of heightmap.data ) {
            min = Math.min( min, height );
            max = Math.max( max, height );
        }
    }

    function sampleRaw( longitude, latitude ) {
        const samples = [];

        for ( const heightmap of heightmaps ) {
            const height = sampleHeightmap( heightmap, longitude, latitude );
            if ( height !== undefined ) samples.push( height );
        }

        if ( samples.length === 0 ) return min;

        samples.sort( ( a, b ) => a - b );
        return samples[ Math.floor( samples.length / 2 ) ];
    }

    function sampleGps( longitude, latitude ) {
        return ( sampleRaw( longitude, latitude ) - min ) * $.config.terrain.exaggeration;
    }

    function sampleLocal( x, z ) {
        const radius = $.config.terrain.smoothingRadius;
        if ( radius <= 0 ) {
            const gps = localToGps( x, z );
            return sampleGps( gps.longitude, gps.latitude );
        }

        const offsets = [
            [ 0, 0, 4 ],
            [ -radius, 0, 2 ],
            [ radius, 0, 2 ],
            [ 0, -radius, 2 ],
            [ 0, radius, 2 ],
            [ -radius, -radius, 1 ],
            [ radius, -radius, 1 ],
            [ -radius, radius, 1 ],
            [ radius, radius, 1 ],
        ];
        let height = 0;
        let weight = 0;

        for ( const [ dx, dz, w ] of offsets ) {
            const gps = localToGps( x + dx, z + dz );
            height += sampleGps( gps.longitude, gps.latitude ) * w;
            weight += w;
        }

        return height / weight;
    }

    function sampleLocalRaw( x, z ) {
        const gps = localToGps( x, z );
        return sampleGps( gps.longitude, gps.latitude );
    }

    return { heightmaps, min, max, sampleGps, sampleLocal, sampleLocalRaw };
}


function createTerrainMesh( terrain ) {
    const segments = $.config.terrain.segments;
    const cols = segments + 1;
    const rows = segments + 1;
    const width = $.worldBezelSize.width;
    const depth = $.worldBezelSize.height;
    const bottomY = -$.heights.ground;
    const topOffset = 0;
    const bottomOffset = rows * cols;
    const vertices = [];
    const indices = [];

    for ( let row = 0; row < rows; row++ ) {
        const v = row / segments;
        const z = -depth / 2 + v * depth;

        for ( let col = 0; col < cols; col++ ) {
            const u = col / segments;
            const x = -width / 2 + u * width;
            vertices.push( x, terrain.sampleLocalRaw( x, z ), z );
        }
    }

    for ( let row = 0; row < rows; row++ ) {
        const v = row / segments;
        const z = -depth / 2 + v * depth;

        for ( let col = 0; col < cols; col++ ) {
            const u = col / segments;
            const x = -width / 2 + u * width;
            vertices.push( x, bottomY, z );
        }
    }

    const vertexAt = ( offset, row, col ) => offset + row * cols + col;

    for ( let row = 0; row < segments; row++ ) {
        for ( let col = 0; col < segments; col++ ) {
            const a = vertexAt( topOffset, row, col );
            const b = vertexAt( topOffset, row, col + 1 );
            const c = vertexAt( topOffset, row + 1, col );
            const d = vertexAt( topOffset, row + 1, col + 1 );
            indices.push( a, c, b, b, c, d );
        }
    }

    for ( let row = 0; row < segments; row++ ) {
        for ( let col = 0; col < segments; col++ ) {
            const a = vertexAt( bottomOffset, row, col );
            const b = vertexAt( bottomOffset, row, col + 1 );
            const c = vertexAt( bottomOffset, row + 1, col );
            const d = vertexAt( bottomOffset, row + 1, col + 1 );
            indices.push( a, b, c, b, d, c );
        }
    }

    for ( let col = 0; col < segments; col++ ) {
        const topA = vertexAt( topOffset, 0, col );
        const topB = vertexAt( topOffset, 0, col + 1 );
        const bottomA = vertexAt( bottomOffset, 0, col );
        const bottomB = vertexAt( bottomOffset, 0, col + 1 );
        indices.push( topA, topB, bottomA, topB, bottomB, bottomA );
    }

    for ( let col = 0; col < segments; col++ ) {
        const topA = vertexAt( topOffset, segments, col );
        const topB = vertexAt( topOffset, segments, col + 1 );
        const bottomA = vertexAt( bottomOffset, segments, col );
        const bottomB = vertexAt( bottomOffset, segments, col + 1 );
        indices.push( topA, bottomA, topB, topB, bottomA, bottomB );
    }

    for ( let row = 0; row < segments; row++ ) {
        const topA = vertexAt( topOffset, row, 0 );
        const topB = vertexAt( topOffset, row + 1, 0 );
        const bottomA = vertexAt( bottomOffset, row, 0 );
        const bottomB = vertexAt( bottomOffset, row + 1, 0 );
        indices.push( topA, bottomA, topB, topB, bottomA, bottomB );
    }

    for ( let row = 0; row < segments; row++ ) {
        const topA = vertexAt( topOffset, row, segments );
        const topB = vertexAt( topOffset, row + 1, segments );
        const bottomA = vertexAt( bottomOffset, row, segments );
        const bottomB = vertexAt( bottomOffset, row + 1, segments );
        indices.push( topA, topB, bottomA, topB, bottomB, bottomA );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute( "position", new THREE.Float32BufferAttribute( vertices, 3 ) );
    geometry.setIndex( indices );
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const material = new THREE.MeshStandardMaterial({
        color: $.config.colors.ground,
        roughness: 0.9,
        metalness: 0,
    });
    const mesh = new THREE.Mesh( geometry, material );
    mesh.name = "terrain";
    return mesh;
}


function countBoundaryEdges( geometry ) {
    const indices = geometry.index.array;
    const edges = new Map();

    for ( let i = 0; i < indices.length; i += 3 ) {
        const tri = [ indices[ i ], indices[ i + 1 ], indices[ i + 2 ] ];

        for ( let edgeIndex = 0; edgeIndex < 3; edgeIndex++ ) {
            const a = tri[ edgeIndex ];
            const b = tri[ ( edgeIndex + 1 ) % 3 ];
            const key = a < b ? `${a}:${b}` : `${b}:${a}`;
            edges.set( key, ( edges.get( key ) ?? 0 ) + 1 );
        }
    }

    let boundaryEdges = 0;
    for ( const count of edges.values() ) {
        if ( count !== 2 ) boundaryEdges++;
    }

    return boundaryEdges;
}


export async function buildTerrain() {
    if ( ! $.config.terrain.enabled ) {
        return undefined;
    }

    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const zoom = $.config.terrain.demZoom;
    console.log( `⛰️ fetching Mapbox Terrain DEM tiles at z${zoom}` );

    const heightmaps = await fetchHeightmapsForBounds( $.worldOuterBounds, zoom, token );
    const terrain = createTerrainSampler( heightmaps );
    terrain.mesh = createTerrainMesh( terrain );
    const boundaryEdges = countBoundaryEdges( terrain.mesh.geometry );
    if ( boundaryEdges > 0 ) {
        console.warn( `terrain mesh has ${boundaryEdges} non-manifold boundary edges` );
    }

    $.terrain = terrain;
    $.city.add( terrain.mesh );

    console.log(
        `⛰️ terrain relief ${( terrain.max - terrain.min ).toFixed( 1 )} m before exaggeration`
    );

    return terrain;
}


export function drapeCityOnTerrain() {
    if ( ! $.terrain ) return;

    $.city.updateMatrixWorld( true );

    $.city.traverse( child => {
        if ( ! child.isMesh || [ "terrain", "base" ].includes( child.name ) || ! child.geometry ) return;

        if ( $.config.terrain.drapeMode === "vertex" ) {
            drapeMeshVertices( child );
            return;
        }

        drapeMeshRigidly( child );
    });
}


function getMeshSamplePoints( geometry ) {
    geometry.computeBoundingBox();

    const box = geometry.boundingBox;
    const centerX = ( box.min.x + box.max.x ) / 2;
    const centerZ = ( box.min.z + box.max.z ) / 2;

    return [
        [ centerX, centerZ ],
        [ box.min.x, box.min.z ],
        [ box.min.x, box.max.z ],
        [ box.max.x, box.min.z ],
        [ box.max.x, box.max.z ],
    ];
}


function getRigidTerrainOffset( geometry ) {
    const samples = getMeshSamplePoints( geometry )
        .map( ( [ x, z ] ) => $.terrain.sampleLocal( x, z ) )
        .sort( ( a, b ) => a - b );

    return samples[ Math.floor( samples.length / 2 ) ];
}


function drapeMeshRigidly( mesh ) {
    mesh.position.y += getRigidTerrainOffset( mesh.geometry );
    mesh.updateMatrixWorld( true );
}


function drapeMeshVertices( mesh ) {
    const positions = mesh.geometry.attributes.position;
    if ( ! positions ) return;

    for ( let i = 0; i < positions.count; i++ ) {
        const x = positions.getX( i );
        const y = positions.getY( i );
        const z = positions.getZ( i );
        positions.setY( i, y + $.terrain.sampleLocal( x, z ) );
    }

    positions.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
}


export function drapeCityVerticesOnTerrain() {
    if ( ! $.terrain ) return;

    $.city.updateMatrixWorld( true );

    $.city.traverse( child => {
        if ( ! child.isMesh || [ "terrain", "base" ].includes( child.name ) || ! child.geometry ) return;

        drapeMeshVertices( child );
    });
}


export { gpsToLocal };
