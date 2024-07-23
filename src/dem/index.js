import * as tilebelt from "@mapbox/tilebelt";

import "@loaders.gl/polyfills";
import { parse } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';

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

    const response = await fetch( url );

    if ( response.status != 200 ) {
        console.warn( `couldn't fetch ${url}`, response.status );
        return;
    }

    const buffer = await response.arrayBuffer();
    const bbox = tilebelt.tileToBBOX( [ index.x, index.y, index.z ] );
    const tile = { index, buffer, bbox };
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
        if ( tile ) tiles.push( tile );

    }

    return tiles;

}


//  [1] https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-dem-v1

const ACCESS_TOKEN = 'pk.eyJ1IjoidGd1cmRhbiIsImEiOiJjbHhqODE5MnIxaHpxMmlzM2VjbWthMGdxIn0.1Pix25iPyLlNetjOtghK1w';
// const URL_TEMPLATE = 'https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.png';
const URL_TEMPLATE = 'https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.png';
// const bbox = { ymin: 47.47749, xmin: 19.0287947, ymax: 47.52146, xmax: 19.0854007 };
const bbox = { ymin: 47.5089, xmin: 19.0722, ymax: 47.5190, xmax: 19.0867 };
const zoom = 14;

// const tiles = await fetchTilesForBounds( bbox, zoom, URL_TEMPLATE, ACCESS_TOKEN );
const tiles = [];

async function rgbTileToHeightmap( tile ) {

    const image = await parse( tile.buffer, ImageLoader )
    const count = image.width * image.height;

    let heightmap = {
        width: image.width,
        height: image.height,
        bbox: tile.bbox,
        index: tile.index,
    }

    let heights = new Uint8Array( count );
    const rgbToHeight = ( R, G, B ) => -10000 + ( ( R * 256 * 256 + G * 256 + B ) * 0.1 );

    for ( let i = 0; i < count; i++ ) {
        heights[ i ] = rgbToHeight( image.data[ i * 4 ], image.data[ i * 4 + 1 ], image.data[ i * 4 + 2 ] );
    }

    heightmap.data = heights;
    return heightmap;

}


tiles.forEach( async ( tile ) => { 
    const heightmap = await rgbTileToHeightmap( tile );
    // console.log( heightmap );
    const buffer = Buffer.from( tile.buffer );
    fs.writeFileSync( `hom-dem-${tile.index.z}-${tile.index.x}-${tile.index.y}.png`, buffer );
});


console.log( process.env.MAPBOX_ACCESS_TOKEN );