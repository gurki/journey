import tilebelt from "@mapbox/tilebelt";
import { parse } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';


const URL_TEMPLATE = "https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw";


////////////////////////////////////////////////////////////////////////////////
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


////////////////////////////////////////////////////////////////////////////////
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


////////////////////////////////////////////////////////////////////////////////
export async function fetchTilesForBounds( bbox, zoom, urlTemplate, accessToken ) {
    
    const indices = tileIndicesForBounds( bbox, zoom );
    let count = indices.length;
    
    if ( count === 0 ) {
        console.error( `❌ no tiles for bounds ${JSON.stringify( bbox )}` );
    }

    console.log( `⌛ fetching ${count} tiles …` );
    
    const tiles = await Promise.all( indices.map( async ( index, id ) => {
        console.log( `📥 fetching tile ${JSON.stringify(Object.values(index))} (${id+1}/${count})…` );
        return fetchTile( urlTemplate, index, accessToken );
    }));

    return tiles.filter( tile => tile !== undefined );

}


////////////////////////////////////////////////////////////////////////////////
export async function rgbTileToHeightmap( tile ) {

    const image = await parse( tile.buffer, ImageLoader, { image: { type: "data" } } )
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


////////////////////////////////////////////////////////////////////////////////
//  [1] https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-dem-v1
export async function fetchHeightmapsForBounds( bbox, zoom, token ) {
    const tiles = await fetchTilesForBounds( bbox, zoom, URL_TEMPLATE, token );
    const heightmaps = await Promise.all( tiles.map( ( tile ) => rgbTileToHeightmap( tile ) ));
    return heightmaps;
}