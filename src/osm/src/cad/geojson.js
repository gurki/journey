import * as util from "../../../arc/src/util.js";


export function enuToOgl( enu ) {
    return [ enu[0], enu[2], -enu[1] ];
}


export function toLocalPolygon( polygon, gpsOrigin ) {
    return polygon.map( region => toLocalLineString( region, gpsOrigin ) );
}


export function toLocalLineString( lineString, gpsOrigin ) {
    return lineString.map( coord => util.gpsArrToEnu( gpsOrigin, coord ) );
}