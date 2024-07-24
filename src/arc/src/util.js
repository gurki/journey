import * as geolib from "geolib"


export function gpsToEnu( refPoint, targetPoint ) {

    let east = geolib.getDistance(
        { latitude: refPoint.latitude, longitude: refPoint.longitude },
        { latitude: refPoint.latitude, longitude: targetPoint.longitude },
        0.001
    );
    
    if ( targetPoint.longitude < refPoint.longitude ) {
        east = -east;
    } 

    let north = geolib.getDistance(
        { latitude: refPoint.latitude, longitude: refPoint.longitude },
        { latitude: targetPoint.latitude, longitude: refPoint.longitude },
        0.001
    );

    if ( targetPoint.latitude < refPoint.latitude ) {
        north = -north;
    }

    const up = ( targetPoint.altitude - refPoint.altitude ) | 0;
    const res = {
        x: east,
        y: north,
        z: up,
    };
    
    return res;
}


export function gpsArrToEnu( refPoint, targetPoint ) {

    const lon = targetPoint[0];
    const lat = targetPoint[1];
    const alt = targetPoint[2];

    let east = geolib.getDistance(
        { latitude: refPoint.latitude, longitude: refPoint.longitude },
        { latitude: refPoint.latitude, longitude: lon },
        0.001
    );
    
    if ( lon < refPoint.longitude ) {
        east = -east;
    } 

    let north = geolib.getDistance(
        { latitude: refPoint.latitude, longitude: refPoint.longitude },
        { latitude: lat, longitude: refPoint.longitude },
        0.001
    );

    if ( lat < refPoint.latitude ) {
        north = -north;
    }

    const altitude = ( alt - refPoint.altitude ) | alt | 0;
    return [ east, north, altitude ];
    
}


export function enuToGps( refPoint, enu ) {

    const northPoint = geolib.computeDestinationPoint(
        { latitude: refPoint.latitude, longitude: refPoint.longitude },
        Math.abs( enu.y ),
        enu.y >= 0 ? 0 : 180
    );

    const eastPoint = geolib.computeDestinationPoint(
        { latitude: refPoint.latitude, longitude: refPoint.longitude },
        Math.abs( enu.x ),
        enu.x >= 0 ? 90 : 270
    );

    const targetAltitude = refPoint.altitude + enu.z;
    const targetLatitude = northPoint.latitude;
    const targetLongitude = eastPoint.longitude;

    return {
        latitude: targetLatitude,
        longitude: targetLongitude,
        altitude: targetAltitude
    };
}
