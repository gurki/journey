import { VectorTile } from 'open-vector-tile'
import * as tilebelt from "@mapbox/tilebelt"

import { load, parse } from '@loaders.gl/core';
import { GLBLoader } from '@loaders.gl/gltf';
import { MVTLoader } from '@loaders.gl/mvt';
import { GPXLoader } from '@loaders.gl/kml';

import fs from "fs"


function tileIndicesForBounds( bbox, zoom ) {
    
    const p1 = tilebelt.pointToTile( bbox.xmin, bbox.ymin, zoom );
    const p2 = tilebelt.pointToTile( bbox.xmax, bbox.ymax, zoom );
    
    let tiles = [];

    for ( let x = p1[0]; x <= p2[0]; x++ ) {
        for ( let y = p1[1]; y <= p2[1]; y++ ) {
            tiles.push( { x, y, z: zoom } );        
        }
    }

    return tiles;

}


async function fetchTile( urlTemplate, tile, accessToken ) {
  
    const url = urlTemplate
        .replace( '{x}', tile.x )
        .replace( '{y}', tile.y )
        .replace( '{z}', tile.z )
        + `?access_token=${accessToken}`;

    const options = {
        mvt: {
            coordinates: 'wgs84',
            tileIndex: tile
        }
    };

    return await load( url, MVTLoader, options );

}


async function fetchTilesForBounds( bbox, zoom, urlTemplate, accessToken ) {
    
    const indices = tileIndicesForBounds( bbox, zoom );
    const tiles = [];
    let count = 0;

    for ( const index of indices ) {

        count += 1;
        console.log( `📥 fetching ${index} (${count}/${indices.length})...` );
        
        const tile = await fetchAndParseTile( urlTemplate, index, accessToken );
        tile.index = tile;
        tiles.push( tile );

    }

    return tiles;

}


const bbox = { xmin: 19.0722, ymin: 47.5190, xmax: 19.0867, ymax: 47.5089 };
const zoom = 14;
const accessToken = 'pk.eyJ1IjoidGd1cmRhbiIsImEiOiJjbHhqODE5MnIxaHpxMmlzM2VjbWthMGdxIn0.1Pix25iPyLlNetjOtghK1w';
const urlTemplate = 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.mvt';

// const urlTemplate = 'https://api.mapbox.com/v4/mapbox.mapbox-bathymetry-v2,mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2,mapbox.mapbox-models-v1/14/8295/5634.vector.pbf?sku=101lREwqwf5Rh&access_token=pk.eyJ1IjoiZXhhbXBsZXMiLCJhIjoiY2p0MG01MXRqMW45cjQzb2R6b2ptc3J4MSJ9.zA2W0IkI0c6KaAhJfk9bWg';

// // Fetch and parse the vector tiles
// fetchTilesForBounds(bbox, zoom, urlTemplate, accessToken)
//     .then( vectorTiles => {
//         const buildings = [];
//         for ( const tile of vectorTiles ) {
//             for ( const item of tile ) {
//                 if ( item.properties.layerName !== "building" ) continue;
//                 buildings.push( item );
//             }
//         }
//         console.log( buildings.length );
//     // console.log( tile.layers.road );
//     // console.log( tile.layers.road.feature( 0 ).toGeoJSON( 4822, 6162, 14 ) );
//     // console.log( tile.layers.road.feature( 0 ).properties );
//     // console.log( tile.layers.road.feature( 0 ).loadGeometry() );
//     //   for ( const item in  ) {
//         // console.log( item );
//     // }
//     // Process the vector tiles as needed
//   })
//   .catch(error => {
//     console.error('Error fetching or parsing vector tiles:', error);
//   });



//   const res = await fetch("https://b.tiles.mapbox.com/3dtiles/v1/mapbox.mapbox-3dbuildings-v1/14/8295/5634.glb?access_token=pk.eyJ1IjoidGd1cmRhbiIsImEiOiJjbHhqODE5MnIxaHpxMmlzM2VjbWthMGdxIn0.1Pix25iPyLlNetjOtghK1w", {
//     "referrer": "https://docs.mapbox.com/",
//     "referrerPolicy": "strict-origin-when-cross-origin",
//     "body": null,
//     "method": "GET",
//     "mode": "cors",
//     "credentials": "omit"
//   });

// const gltf = await load( "https://b.tiles.mapbox.com/3dtiles/v1/mapbox.mapbox-3dbuildings-v1/14/8295/5634.glb?access_token=pk.eyJ1IjoidGd1cmRhbiIsImEiOiJjbHhqODE5MnIxaHpxMmlzM2VjbWthMGdxIn0.1Pix25iPyLlNetjOtghK1w", GLBLoader);
// console.log( gltf ); 
// const exporter = new GLTFExporter();

// exporter.parse(
// 	gltf,
// 	function ( data ) {
//         fs.writeFileSync( "out.glb", data );
// 	},
// 	function ( error ) {

// 		console.log( error );

// 	},
// 	{ binary: true }
// );

// console.log( gltf );
// const arrayBuffer = encodeSync(gltf, GLTFWriter);
// console.log( arrayBuffer );

// https://api.mapbox.com/v4/mapbox.mapbox-bathymetry-v2,mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2,mapbox.mapbox-models-v1/14/8298/5639.vector.pbf?sku=101lREwqwf5Rh&access_token=pk.eyJ1IjoiZXhhbXBsZXMiLCJhIjoiY2p0MG01MXRqMW45cjQzb2R6b2ptc3J4MSJ9.zA2W0IkI0c6KaAhJfk9bWg
// const response = await fetch("https://api.mapbox.com/v4/mapbox.mapbox-models-v1/14/8298/5639.vector.pbf?access_token=pk.eyJ1IjoidGd1cmRhbiIsImEiOiJjbHhqODE5MnIxaHpxMmlzM2VjbWthMGdxIn0.1Pix25iPyLlNetjOtghK1w" );
// console.log( response );

// const arrayBuffer = new Uint8Array( await response.arrayBuffer() );
const pbf = fs.readFileSync( "data/5637.vector.pbf" );
// const pbf = new Pbf(new Uint8Array(arrayBuffer));
const vectorTile = new VectorTile( pbf );

const layer = vectorTile.layers.structure;
// console.log( layer );
for ( let i = 0; i < layer.length; i++ ) {
    const feature = layer.feature( i );
    // console.log( feature );
}


const glb = fs.readFileSync( "data/5637.glb" );
const gltf = await load( glb, GLBLoader );
// console.log( gltf );


const gpx = fs.readFileSync( "data/2024-05-28.gpx" );
const path = await parse( gpx, GPXLoader );

for ( const feature of path.features ) {
    // if ( feature.geometry.type === "Point" ) continue;
    console.log( feature.properties.time );
}
