import tilebelt from "@mapbox/tilebelt";

import "@loaders.gl/polyfills";
import { parse, encode } from '@loaders.gl/core';
import { ImageLoader, ImageWriter } from '@loaders.gl/images';

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
    const tile = { index, buffer };
    return tile;


}


export async function fetchRasterTilesForBounds( bbox, zoom, accessToken ) {
    
    // const URL_TEMPLATE = "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw";
    const URL_TEMPLATE = "https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw";

    const indices = tileIndicesForBounds( bbox, zoom );
    let count = indices.length;
    
    if ( count === 0 ) {
        console.error( `❌ no tiles for bounds ${JSON.stringify( bbox )}` );
    }

    console.log( `⌛ fetching ${count} tiles …` );
    
    const tiles = await Promise.all( indices.map( async ( index ) => {
        console.log( `📥 fetching tile ${JSON.stringify(Object.values(index))} …` );
        return fetchTile( URL_TEMPLATE, index, accessToken );
    }));

    return tiles.filter( tile => tile !== undefined );

}


export async function rgbTileToHeightmap( tile ) {

    const image = await parse( tile.buffer, ImageLoader, { image: { type: "data" } } );
    const count = image.width * image.height;
    const index = tile.index;
    const bbox = tilebelt.tileToBBOX( [ index.x, index.y, index.z ] );

    let heightmap = {
        width: image.width,
        height: image.height,
        bbox,
        index,
    }

    let heights = new Float32Array( count );
    const rgbToHeight = ( R, G, B ) => -10000 + ( ( R * 256 * 256 + G * 256 + B ) * 0.1 );

    for ( let i = 0; i < count; i++ ) {
        heights[ i ] = rgbToHeight( image.data[ i * 4 ], image.data[ i * 4 + 1 ], image.data[ i * 4 + 2 ] );
    }

    heightmap.data = heights;
    return heightmap;

}


export async function fetchHeightmapsForBounds( bbox, zoom, accessToken ) {

    //  [1] https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-dem-v1

    const tiles = await fetchRasterTilesForBounds( bbox, zoom, accessToken );
    const heightmaps = await Promise.all( tiles.map( ( tile ) => rgbTileToHeightmap( tile ) ));
    return heightmaps;

    // const buffer = Buffer.from( tile.buffer );
    // fs.writeFileSync( `data/hom-dem-${tile.index.z}-${tile.index.x}-${tile.index.y}.png`, buffer );

}


const bbox = { ymin: 47.47749, xmin: 19.0287947, ymax: 47.52146, xmax: 19.0854007 };
// const bbox = { ymin: 47.5089, xmin: 19.0722, ymax: 47.5190, xmax: 19.0867 };
// const bbox = { xmin: 11.747047, ymin: 47.633330, xmax: 11.886271, ymax: 47.724868 }; //  alps
const zoom = 11;
const token = process.env.VITE_MAPBOX_ACCESS_TOKEN;

const heightmaps = await fetchHeightmapsForBounds( bbox, zoom, token );

// const tiles = await fetchRasterTilesForBounds( bbox, zoom, token );

// tiles.forEach( tile => {
//     const buffer = Buffer.from( tile.buffer );
//     fs.writeFileSync( `data/hom-dem-${tile.index.z}-${tile.index.x}-${tile.index.y}.png`, buffer );
// });

for ( const heightmap of heightmaps.slice( 1, 2 ) ) {
    
    const heights = heightmap.data;
    const min = Math.min( ...heights );
    const max = Math.max( ...heights );

    console.log( heights );

    const data = heights.map( h => {
        const t = Math.round( 255 * ( h - min ) / ( max - min ) );
        return t;
    });

    let rgba = new Uint8Array( heights.length * 4 );

    data.forEach( ( v, index ) => {
        rgba[ index * 4 + 0 ] = v; 
        rgba[ index * 4 + 1 ] = v; 
        rgba[ index * 4 + 2 ] = v; 
        rgba[ index * 4 + 3 ] = 255; 
    });

    const image = {
        data: rgba,
        shape: [ 256, 256, 4 ],
        width: 256,
        height: 256,
        components: 4,
        layers: [ 1 ]
    };

    const buffer = await encode( image, ImageWriter, { image: {mimeType: 'image/png' } } );
    fs.writeFileSync( `data/hom-heights-${heightmap.index.z}-${heightmap.index.x}-${heightmap.index.y}-raw.png`, buffer );

}