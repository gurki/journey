import * as geojson from "./geojson.js";
import * as jscad from "@jscad/modeling";


export function fromGeoJSON( feature, gpsOrigin, options = {} ) {

    const type = feature.geometry.type;
    const layer = feature.properties.layerName;
    const coords = feature.geometry.coordinates;

    switch ( type ) {
        case "LineString": return [ fromLineString( coords, gpsOrigin, options ) ];
        case "MultiLineString": return fromMultiLineString( coords, gpsOrigin, options );
        default: console.warn( `geom2: unsupported geometry ${type} for feature ${layer}` );
    } 

}


export function fromMultiLineString( gpsLineString, gpsOrigin, options = {} ) {
    return gpsLineString.map( region => fromLineString( region, gpsOrigin, options ) );
}


export function fromLineString( gpsLineString, gpsOrigin, options = {} ) {
    const points = geojson.toLocalLineString( gpsLineString, gpsOrigin );
    const simplified = simplifyPoints( points, options.simplifyTolerance ?? 0 );
    return jscad.geometries.path2.fromPoints( {}, simplified.length >= 2 ? simplified : points );
}


function getSquaredDistanceToSegment( point, start, end ) {
    const dx = end[ 0 ] - start[ 0 ];
    const dy = end[ 1 ] - start[ 1 ];

    if ( dx === 0 && dy === 0 ) {
        return getSquaredDistance( point, start );
    }

    const t = Math.max(
        0,
        Math.min( 1, ( ( point[ 0 ] - start[ 0 ] ) * dx + ( point[ 1 ] - start[ 1 ] ) * dy ) / ( dx * dx + dy * dy ) )
    );
    const projection = [ start[ 0 ] + t * dx, start[ 1 ] + t * dy ];
    return getSquaredDistance( point, projection );
}


function getSquaredDistance( a, b ) {
    const dx = a[ 0 ] - b[ 0 ];
    const dy = a[ 1 ] - b[ 1 ];
    return dx * dx + dy * dy;
}


function simplifyPoints( points, tolerance ) {
    if ( points.length <= 2 || tolerance <= 0 ) return points;

    const keep = new Array( points.length ).fill( false );
    const toleranceSquared = tolerance * tolerance;
    keep[ 0 ] = true;
    keep[ points.length - 1 ] = true;

    simplifySection( points, 0, points.length - 1, toleranceSquared, keep );
    return points.filter( ( _, index ) => keep[ index ] );
}


function simplifySection( points, startIndex, endIndex, toleranceSquared, keep ) {
    let maxDistance = 0;
    let maxIndex = startIndex;

    for ( let i = startIndex + 1; i < endIndex; i++ ) {
        const distance = getSquaredDistanceToSegment( points[ i ], points[ startIndex ], points[ endIndex ] );
        if ( distance > maxDistance ) {
            maxDistance = distance;
            maxIndex = i;
        }
    }

    if ( maxDistance <= toleranceSquared ) return;

    keep[ maxIndex ] = true;
    simplifySection( points, startIndex, maxIndex, toleranceSquared, keep );
    simplifySection( points, maxIndex, endIndex, toleranceSquared, keep );
}
