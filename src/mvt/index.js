// Import required libraries
import { VectorTile } from "@mapbox/vector-tile";
import * as tilebelt from "@mapbox/tilebelt"
import Pbf from "pbf";
import vt2geojson from "@mapbox/vt2geojson";
import fs from "fs"
import {load} from '@loaders.gl/core';
import {GLBLoader} from '@loaders.gl/gltf';
import {GLTFWriter} from '@loaders.gl/gltf';
import {encodeSync} from '@loaders.gl/core';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {MVTLoader} from '@loaders.gl/mvt';


// Function to fetch and parse vector tiles
async function fetchAndParseTile(urlTemplate, tile, accessToken) {
  
    const url = urlTemplate
        .replace('{z}', tile[2])
        .replace('{x}', tile[0])
        .replace('{y}', tile[1]) + `?access_token=${accessToken}`;

    return await load( url, MVTLoader,  {
        mvt: {
        coordinates: 'wgs84',
        tileIndex: {
            x: tile[0],
            y: tile[1],
            z: tile[2]
        }
        }
    });

    
  
    // const response = await fetch(url);
    // const arrayBuffer = await response.arrayBuffer();
    // const pbf = new Pbf(new Uint8Array(arrayBuffer));
    // const vectorTile = new VectorTile(pbf);
    // return vectorTile;
}



// Example usage
async function fetchTilesForBoundingBox(bbox, zoom, urlTemplate, accessToken) {
    
    // const tiles = bboxToTileIndices( bbox, zoom );
    const p1 = tilebelt.pointToTile( bbox[1], bbox[0], zoom );
    const p2 = tilebelt.pointToTile( bbox[3], bbox[2], zoom );
    
    let tiles = [];

    for ( let x = p1[0]; x <= p2[0]; x++ ) {
        for ( let y = p1[1]; y <= p2[1]; y++ ) {
            tiles.push( [ x, y, zoom ] );        
        }
    }

    const vectorTiles = [];

    for (const tile of tiles) {
        console.log( `fetching ${tile} ...` );
        const vectorTile = await fetchAndParseTile(urlTemplate, tile, accessToken);
        vectorTile.index = tile;
        vectorTiles.push(vectorTile);
    }

    return vectorTiles;

}

// Define the bounding box and zoom level
const bbox = [ 47.5190, 19.0722, 47.5089, 19.0867 ];
const zoom = 17;
const accessToken = 'pk.eyJ1IjoidGd1cmRhbiIsImEiOiJjbHhqODE5MnIxaHpxMmlzM2VjbWthMGdxIn0.1Pix25iPyLlNetjOtghK1w';
const urlTemplate = 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.mvt';
// const urlTemplate = 'https://api.mapbox.com/v4/mapbox.mapbox-bathymetry-v2,mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2,mapbox.mapbox-models-v1/14/8295/5634.vector.pbf?sku=101lREwqwf5Rh&access_token=pk.eyJ1IjoiZXhhbXBsZXMiLCJhIjoiY2p0MG01MXRqMW45cjQzb2R6b2ptc3J4MSJ9.zA2W0IkI0c6KaAhJfk9bWg';

// Fetch and parse the vector tiles
fetchTilesForBoundingBox(bbox, zoom, urlTemplate, accessToken)
    .then( vectorTiles => {
        const buildings = [];
        for ( const tile of vectorTiles ) {
            for ( const item of tile ) {
                if ( item.properties.layerName !== "building" ) continue;
                buildings.push( item );
            }
        }
        console.log( buildings.length );
    // console.log( tile.layers.road );
    // console.log( tile.layers.road.feature( 0 ).toGeoJSON( 4822, 6162, 14 ) );
    // console.log( tile.layers.road.feature( 0 ).properties );
    // console.log( tile.layers.road.feature( 0 ).loadGeometry() );
    //   for ( const item in  ) {
        // console.log( item );
    // }
    // Process the vector tiles as needed
  })
  .catch(error => {
    console.error('Error fetching or parsing vector tiles:', error);
  });



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