import * as geolib from "geolib"


export function gpsToEnu( refPoint, targetPoint ) {

    let east = geolib.getDistance(
        { latitude: refPoint.latitude, longitude: refPoint.longitude },
        { latitude: refPoint.latitude, longitude: targetPoint.longitude }
    );
    
    if ( targetPoint.longitude < refPoint.longitude ) {
        east = -east;
    } 

    let north = geolib.getDistance(
        { latitude: refPoint.latitude, longitude: refPoint.longitude },
        { latitude: targetPoint.latitude, longitude: refPoint.longitude }
    );

    if ( targetPoint.latitude < refPoint.latitude ) {
        north = -north;
    }

    const up = targetPoint.altitude - refPoint.altitude;
    const res = targetPoint;
    res.x = east;
    res.y = north;
    res.z = up;
    return res;
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
