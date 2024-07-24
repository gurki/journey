import * as geojson from "./geojson.js";
import * as jscad from "@jscad/modeling";


export function fromGeoJSON( feature, gpsOrigin ) {

    const type = feature.geometry.type;
    const layer = feature.properties.layerName;
    const coords = feature.geometry.coordinates;

    switch ( type ) {
        case "Polygon": return fromPolygon( coords, gpsOrigin );
        case "MultiPolygon": return fromMultipolygon( coords, gpsOrigin );
        default: console.warn( `geom2: unsupported geometry ${type} for feature ${layer}` );
    } 

}


export function fromMultipolygon( gpsMultipolygon, gpsOrigin ) {
    const multipolygon = gpsMultipolygon.map( region => fromPolygon( region, gpsOrigin ) );
    return jscad.booleans.union( ...multipolygon );
}


export function shareVertices( pointsA, pointsB ) {
    return pointsB.some( p => pointsA.find( q => p[0] === q[0] && p[1] === q[1] ) );
}


export function fromPolygon( gpsPolygon, gpsOrigin ) {

    const polygon = geojson.toLocalPolygon( gpsPolygon, gpsOrigin );
    const outerRing = polygon[ 0 ];
    
    //  subtracting inner rings that share vertices with the outer ring causes the extrusion of the
    //  resulting geom2 to not honor the subtraction properly, and causes non-manifold edges
    for ( let i = 1; i < polygon.length; i++ ) {
        const ring = polygon[ i ];
        const duplicates = shareVertices( ring, outerRing );
        if ( ! duplicates ) continue;
        polygon[ i ] = ring.map( p => [ p[0] + 0.001, p[1] + 0.001 ] );
    }

    const geom2s = polygon.map( ( region, id ) => {
        //  jscad expects CW polygons, while geojson orders CCW outer rings, and CW inner rings
        const ordered = ( id === 0 ) ? region.reverse() : region;
        return jscad.geometries.geom2.fromPoints( ordered );
    });

    return jscad.booleans.subtract( ...geom2s );

}