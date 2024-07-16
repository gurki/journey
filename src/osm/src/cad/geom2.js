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


export function fromPolygon( gpsPolygon, gpsOrigin ) {

    const polygon = geojson.toLocalPolygon( gpsPolygon, gpsOrigin );
    const geom2s = polygon.map( ( region, id ) => {
        //  jscad expects CW polygons, while geojson orders CCW outer rings, and CW inner rings
        const ordered = ( id === 0 ) ? region.reverse() : region;
        return jscad.geometries.geom2.fromPoints( ordered );
    });

    return jscad.booleans.subtract( ...geom2s );

}