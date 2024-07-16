import * as tilebelt from "@mapbox/tilebelt"
import { load } from '@loaders.gl/core';
import { MVTLoader } from '@loaders.gl/mvt';
import fs from "fs";

export function tileIndicesForBounds( bbox, zoom ) {
    
    const p1 = tilebelt.pointToTile( bbox.xmin, bbox.ymax, zoom );  //  west north
    const p2 = tilebelt.pointToTile( bbox.xmax, bbox.ymin, zoom );  //  east south
    
    let tiles = [];

    for ( let x = p1[0]; x <= p2[0]; x++ ) {
        for ( let y = p1[1]; y <= p2[1]; y++ ) {
            tiles.push( { x, y, z: zoom } );        
        }
    }

    return tiles;

}


export async function fetchTile( urlTemplate, index, accessToken ) {
  
    const url = urlTemplate
        .replace( '{x}', index.x )
        .replace( '{y}', index.y )
        .replace( '{z}', index.z )
        + `?access_token=${accessToken}`;

    const options = {
        mvt: {
            coordinates: 'wgs84',
            tileIndex: index
        }
    };

    const tile = await load( url, MVTLoader, options );
    tile.index = index;
    return tile;

}


export async function fetchTilesForBounds( bbox, zoom, urlTemplate, accessToken ) {
    
    const indices = tileIndicesForBounds( bbox, zoom );
    const tiles = [];
    let count = 0;
    
    if ( indices.length === 0 ) {
        console.error( `❌ no tiles for bounds ${JSON.stringify( bbox )}` );
    }

    console.log( `⌛ fetching ${count} tiles …` );
    
    for ( const index of indices ) {
        
        count += 1;
        console.log( `📥 fetching tile ${JSON.stringify(Object.values(index))} (${count}/${indices.length}) …` );
        
        const tile = await fetchTile( urlTemplate, index, accessToken );
        tiles.push( tile );

    }

    return tiles;

}


// const ACCESS_TOKEN = 'pk.eyJ1IjoidGd1cmRhbiIsImEiOiJjbHhqODE5MnIxaHpxMmlzM2VjbWthMGdxIn0.1Pix25iPyLlNetjOtghK1w';
// const URL_TEMPLATE = 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf';
// const bbox = { ymin: 47.47749, xmin: 19.0287947, ymax: 47.52146, xmax: 19.0854007 };
// // const bbox = { xmin: 19.0722, ymin: 47.5089, xmax: 19.0867, ymax: 47.5190 };
// const zoom = 14;

// const tiles = await fetchTilesForBounds( bbox, zoom, URL_TEMPLATE, ACCESS_TOKEN );
// fs.writeFileSync( `all-mvt-${zoom}.geojson`, JSON.stringify( tiles, null, 2 ) );