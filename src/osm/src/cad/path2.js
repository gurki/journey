import * as geojson from "./geojson.js";
import * as jscad from "@jscad/modeling";


export function fromGeoJSON( feature, gpsOrigin ) {

    const type = feature.geometry.type;
    const layer = feature.properties.layerName;
    const coords = feature.geometry.coordinates;

    switch ( type ) {
        case "LineString": return [ fromLineString( coords, gpsOrigin ) ];
        case "MultiLineString": return fromMultiLineString( coords, gpsOrigin );
        default: console.warn( `geom2: unsupported geometry ${type} for feature ${layer}` );
    } 

}


export function fromMultiLineString( gpsLineString, gpsOrigin ) {
    return gpsLineString.map( region => fromLineString( region, gpsOrigin ) );
}


export function fromLineString( gpsLineString, gpsOrigin ) {
    const points = geojson.toLocalLineString( gpsLineString, gpsOrigin );
    return jscad.geometries.path2.fromPoints( {}, points );
}