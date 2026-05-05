import { STATE as $ } from "./state.js";
import { fetchTilesForBounds } from "../../mvt/index.js";
import * as PATH2 from "./cad/path2.js";
import * as GEOM2 from "./cad/geom2.js";
import * as GEOM3 from "./cad/geom3.js";
import * as jscad from "@jscad/modeling";
import { tickLoading, updateLoading } from "./loading.js";

import * as THREE from "three";

const CLIP = true;
const MERGE = false;
const FORCE_MIN_WIDTH = true;
const PRUNE_SMALL_ELEMENTS = true;
const VALIDATE = false;

const TYPES = [
    "buildings",
    "water",
    "parks",
    "greenery",
    "stone",
    "pedestrian",
    "street",
    "railway",
    "path"
];

const OVERLAY_TYPES = [ "parks", "greenery", "stone", "pedestrian" ];
const TRANSPORT_TYPES = [ "street", "railway", "path" ];

let path2map = {};
let geom2map = {};
let geom3map = {};
let buildStats = {};

TYPES.forEach( type => {
    path2map[ type ] = [];
    geom2map[ type ] = [];
    geom3map[ type ] = [];
    buildStats[ type ] = { features: 0, skipped: 0, paths: 0, geom2: 0, geom3: 0, meshes: 0 };
});


async function fetchData() {

    const ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const URL_TEMPLATE = 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf';
    const zoom = $.config.mapbox.vectorTileZoom;
    console.log( `🗺️ fetching Mapbox Streets vector tiles at z${zoom}` );
    updateLoading( "Fetching map data", `Mapbox Streets vector tiles z${zoom}`, 36 );
    const data = await fetchTilesForBounds( $.worldOuterBounds, zoom, URL_TEMPLATE, ACCESS_TOKEN );
    $.data = data.flat();

    // console.log( `⌛ fetching data …` );
    // const response = await fetch( "./results/hom-mvt-15.geojson" );
    // const tiles = await response.json();
    // $.data = tiles.flat();

}


function addGround() {

    if ( $.terrain ) {
        return;
    }

    console.log( $.worldTileSize );
    console.log( $.worldBezelSize );
    const groundHeight = $.heights.ground;
    const groundGeom = new THREE.BoxGeometry( $.worldBezelSize.width, groundHeight, $.worldBezelSize.height );
    const ground = new THREE.Mesh( groundGeom, $.materials.ground );
    ground.name = "base";
    ground.translateY( - groundHeight / 2 );
    $.city.add( ground );

}


function isTypeEnabled( type ) {
    const detail = $.config.mapbox.detailOptions[ $.config.mapbox.detail ];
    return ! detail.types || detail.types.includes( type );
}


function track( type, key, count = 1 ) {
    buildStats[ type ][ key ] += count;
}


function logTypeStats( label, key ) {
    const rows = TYPES
        .map( type => [ type, buildStats[ type ][ key ] ] )
        .filter( ( [ , count ] ) => count > 0 )
        .map( ( [ type, count ] ) => `${type}:${count}` );

    console.log( `${label} ${rows.length > 0 ? rows.join( "  " ) : "none"}` );
}


function getDetailConfig() {
    return $.config.mapbox.detailOptions[ $.config.mapbox.detail ];
}


function mmToWorld( mm ) {
    return mm * $.config.printScale / 1000;
}


function getPathLength( path2 ) {
    let length = 0;
    const points = path2.points;

    for ( let i = 1; i < points.length; i++ ) {
        length += Math.hypot(
            points[ i ][ 0 ] - points[ i - 1 ][ 0 ],
            points[ i ][ 1 ] - points[ i - 1 ][ 1 ]
        );
    }

    return length;
}


async function build() {

    console.time( "⏱ build" );
    console.log( `🧭 detail preset "${$.config.mapbox.detail}"` );


    //  fetch data

    await fetchData();
    const features = $.data;
    console.log( `🧾 loaded ${features.length.toLocaleString()} vector features` );


    //  build city, start with ground plane

    console.log( "👷‍♀️ building city ..." );
    addGround();


    //  build cad objects

    console.log( "🚧 converting geojson to cad objects ..." );
    await tickLoading( "Building city geometry", "Classifying vector features into printable layers...", 44 );
    console.time( "⏱ geojson -> cad" );

    const clip2 = jscad.primitives.rectangle( { size: [ $.worldTileSize.width, $.worldTileSize.height ] } );

    features.forEach( ( feature, index ) => {

        if ( index % 1000 === 0 ) {
            console.log( "   ", ( 100 * index / ( features.length - 1 ) ).toFixed( 1 ), "%" );
        }

        if ( feature.geometry.type === "Point" ) {
            return;
        }

        const props = feature.properties;
        const name = props.layerName;

        switch ( name ) {
            case "building": appendBuilding( feature, clip2 ); break;
            case "water": appendWater( feature, clip2 ); break;
            case "road": appendRoad( feature, clip2 ); break;
            case "landuse":
            case "structure":   //  hedge
            case "landuse_overlay": appendLanduse( feature, clip2 ); break;
            default: return;
        }

        // console.log( feature.properties.layerName, feature.properties.class, feature.geometry.type );

    });

    console.timeEnd( "⏱ geojson -> cad" );
    logTypeStats( "🧮 accepted features:", "features" );
    logTypeStats( "🚫 skipped filtered features:", "skipped" );
    logTypeStats( "✏️ line paths:", "paths" );
    logTypeStats( "🔷 polygon footprints:", "geom2" );


    //  path2 ->[expand]-> geom2

    console.log( "🛣️ expanding path2 to geom2 ..." );
    await tickLoading( "Building roads", "Expanding centerlines into printable surfaces...", 55 );
    console.time( "⏱ path2 -> geom2" );

    for ( const type of TYPES ) {

        const path2s = path2map[ type ];

        if ( path2s.length === 0 ) {
            continue;
        }

        path2s.forEach( path2 => jscad.geometries.path2.validate( path2 ) );

        //  debug path2s
        // path2s.forEach( path2 => {
        //     const points = path2.points.map( p => new THREE.Vector2( p[0], p[1] ) );
        //     const geom = new THREE.BufferGeometry().setFromPoints( points );
        //     geom.rotateX( -Math.PI / 2 );
        //     geom.translate( 0, 1, 0 );
        //     const mesh = new THREE.Line(
        //         geom,
        //         new THREE.LineBasicMaterial( { color: 0xff0000 } )
        //     );
        //     $.city.add( mesh );
        // });

        const geom2s = path2s.map( path2 => Object.assign( {},
            jscad.expansions.expand(
                { delta: path2.width, corners: "round", segments: $.config.terrain.roadExpansionSegments },
                path2
            ),
            { type, height: path2.height }
        ));

        geom2map[ type ].push( ...geom2s );
        track( type, "geom2", geom2s.length );

    }

    console.timeEnd( "⏱ path2 -> geom2" );
    logTypeStats( "🧱 expanded surfaces:", "geom2" );


    //  geom2 ->[extrude]-> geom3

    console.log( "📐 extruding geom2 to geom3 ..." );
    await tickLoading( "Extruding layers", "Turning map surfaces into solids...", 64 );
    console.time( "⏱ geom2 -> geom3" );

    for ( const type of TYPES ) {

        const geom2s = geom2map[ type ];

        if ( geom2s.length === 0 ) {
            continue;
        }

        geom2s.forEach( geom2 => jscad.geometries.geom2.validate( geom2 ) );

        //  debug geom2s
        // geom2s.forEach( geom2 => {
        //     const points = jscad.geometries.geom2.toPoints( geom2 ).map( p => new THREE.Vector2( p[0], p[1] ) );
        //     const geom = new THREE.BufferGeometry().setFromPoints( [ ...points, points[0] ] );
        //     geom.rotateX( -Math.PI / 2 );
        //     geom.translate( 0, 1, 0 );
        //     const mesh = new THREE.Line(
        //         geom,
        //         new THREE.LineBasicMaterial( { color: 0xff0000 } )
        //     );
        //     $.city.add( mesh );
        // });

        const allClipped = CLIP ? geom2s.map( geom2 => Object.assign( {},
            jscad.booleans.intersect( geom2, clip2 ),
            { type, height: geom2.height }
        )) : geom2s;

        const clipped = allClipped.filter( geom2 => geom2.sides.length > 2 );

        if ( clipped.length === 0 ) {
            continue;
        }

        const pruned = clipped.filter( geom2 => {
            if ( ! PRUNE_SMALL_ELEMENTS ) return true;
            const radius = jscad.measurements.measureBoundingSphere( geom2 )[ 1 ];
            const minDimMm = 1000 * radius / $.config.printScale;
            return minDimMm > 1 * $.config.layerHeightMm;
        });

        if ( PRUNE_SMALL_ELEMENTS ) {
            console.log( `pruned ${clipped.length - pruned.length} ${type}` );
        }

        const validated = pruned.filter( geom2 => {
            try {
                jscad.geometries.geom2.validate( geom2 );
                return true;
            } catch ( err ) {
                return false;
            }
        });

        console.log( `invalidated ${pruned.length - validated.length} ${type}` );

        const geom3s = validated.map( geom2 => GEOM3.extrude( geom2, geom2.height ) );
        geom3map[ type ].push( ...geom3s );
        track( type, "geom3", geom3s.length );

    }

    console.timeEnd( "⏱ geom2 -> geom3" );
    logTypeStats( "📦 printable solids:", "geom3" );


    //  geom3 ->[merge?,convert]-> bufferGeometry

    console.log( "🕸️ convert geom3 to mesh ..." );
    await tickLoading( "Preparing preview mesh", "Converting printable solids into Three.js meshes...", 74 );
    console.time( "⏱ geom3 -> mesh" );

    for ( const type of TYPES ) {

        const group = new THREE.Group();
        group.name = type;

        let geom3s = geom3map[ type ];

        if ( geom3s.length === 0 ) {
            continue;
        }

        if ( VALIDATE ) {
            geom3s.forEach( geom3 => {
                try {
                    jscad.geometries.geom3.validate( geom3 )
                } catch ( err ) {
                    // console.warn( type, err, geom3 );
                    // goods.push( geom3 );
                }
            });
        }

        const shouldMerge = ( type !== "buildings" ) && MERGE;
        const maybeMerged = shouldMerge ? [ GEOM3.mergeAll( geom3s ) ] : geom3s;

        for ( const geom3 of maybeMerged ) {
            const bgeom = GEOM3.toBufferGeometry( geom3 );
            const mesh = new THREE.Mesh( bgeom, $.materials[ type ] );
            mesh.userData.type = type;
            mesh.userData.placement = $.config.terrain.placement[ type ];
            group.add( mesh );
            track( type, "meshes" );
        }

        $.city.add( group );

    }

    console.timeEnd( "⏱ geom3 -> mesh" );
    logTypeStats( "🕸️ scene meshes:", "meshes" );
    console.timeEnd( "⏱ build" );

}


function appendLanduse( feature ) {

    if ( [ "LineString", "MultiLineString" ].includes( feature.geometry.type ) ) {
        return;
    }

    const EXCLUDE_CLASSES = [
        "cliff",
        "fence", "gate",
        "commercial_area", "industrial",
        "parking", "hospital", "school"
    ];

    const PARK_CLASSES = [
        "park", "grass",
        "agriculture",
        "pitch", "cemetery"
    ];

    const GREENERY_CLASSES = [
        "scrub", "hedge",
        "wood",
        "national_park",
    ];

    const props = feature.properties;
    let type = undefined;

    if ( PARK_CLASSES.includes( props.class ) ) type = "parks";
    if ( GREENERY_CLASSES.includes( props.class ) ) type = "greenery";
    if ( [ "rock", "sand" ].includes( props.class ) ) type = "stone";
    if ( [ "land" ].includes( props.class ) ) type = "pedestrian";
    if ( EXCLUDE_CLASSES.includes( props.class ) ) return;

    if ( ! type ) {
        // console.log( props.class, "-", props.type );
        // type = "unknown";
        return;
    }

    if ( ! isTypeEnabled( type ) ) {
        track( type, "skipped" );
        return;
    }

    const geom2 = GEOM2.fromGeoJSON( feature, $.center );
    geom2.type = type;
    geom2.height = getLayerHeight( type );
    geom2map[ type ].push( geom2 );
    track( type, "features" );
    track( type, "geom2" );

}


function appendBuilding( feature ) {

    //  skip combined footprints of multipart building
    //  [1] https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8#building-extrude-text
    if ( feature.properties.extrude === "false" ) return;

    const type = "buildings";
    if ( ! isTypeEnabled( type ) ) {
        track( type, "skipped" );
        return;
    }

    // const minHeight = 5;
    let height = feature.properties.height; // ? feature.properties.height : $.heights.buildings;
    // if ( height <= minHeight ) height = $.heights.buildings;

    const geom2 = GEOM2.fromGeoJSON( feature, $.center );
    geom2.type = type;
    geom2.height = height;
    geom2map[ type ].push( geom2 );
    track( type, "features" );
    track( type, "geom2" );

}


function appendWater( feature ) {

    const type = "water";
    if ( ! isTypeEnabled( type ) ) {
        track( type, "skipped" );
        return;
    }
    const height = $.heights[ type ];

    const geom2 = GEOM2.fromGeoJSON( feature, $.center );
    geom2.type = type;
    geom2.height = height;
    geom2map[ type ].push( geom2 );
    track( type, "features" );
    track( type, "geom2" );

}


function getLayerHeight( type ) {
    if ( OVERLAY_TYPES.includes( type ) ) {
        return $.worldLayerHeight * $.config.terrain.overlayThicknessLayers;
    }

    if ( TRANSPORT_TYPES.includes( type ) ) {
        return $.worldLayerHeight * $.config.terrain.transportThicknessLayers;
    }

    return $.heights[ type ];
}


function appendRoad( feature ) {

    const STREET_CLASSES = [
        "motorway", "motorway_link",
        "trunk", "trunk_link",
        "primary", "primary_link",
        "secondary", "secondary_link",
        "tertiary", "tertiary_link",
        "street", "street_limited"
    ];

    const RAIL_CLASSES = [
        "major_rail",
        "minor_rail",
        "service_rail"
    ];

    const props = feature.properties;
    let type = undefined;

    if ( STREET_CLASSES.includes( props.class ) ) type = "street";
    if ( RAIL_CLASSES.includes( props.class ) ) type = "railway";
    if ( [ "pedestrian", "service" ].includes( props.class ) ) type = "path";
    if ( [ "track", "path" ].includes( props.class ) ) type = "path";

    if ( ! type ) {
        //  aerialway
        return;
    }

    if ( ! isTypeEnabled( type ) ) {
        track( type, "skipped" );
        return;
    }

    if ( ! isRoadFeatureEnabled( type, props ) ) {
        track( type, "skipped" );
        return;
    }

    if ( [ "service:drive_through", "service:driveway", "service:parking_aisle", "service:parking" ].includes( props.type ) ) {
        track( type, "skipped" );
        return;
    }

    if ( [ "unclassified", "disused", "abandoned" ].includes( props.type ) ) {
    // if ( [ "crossing", "unclassified", "steps", "subway", "disused", "abandoned", "corridor" ].includes( props.type ) ) {
        track( type, "skipped" );
        return;
    }

    if ( props.structure !== "none" ) {
        //  bridge, tunnel
        track( type, "skipped" );
        return;
    }

    const CLASS_WIDTHS = {
        motorway: 14,
        motorway_link: 9,
        trunk: 10,
        trunk_link: 7,
        primary: 8,
        primary_link: 6,
        secondary: 5.5,
        secondary_link: 4.5,
        tertiary: 4,
        tertiary_link: 3.5,
        street: 2.8,
        street_limited: 2.4,
        pedestrian: 3,
        construction: 5,
        track: 2,
        service: 2.5,
        ferry: 20,
        path: 1.2,
        major_rail: 2.2,
        minor_rail: 1.6,
        service_rail: 1.2,
        aerialway: 2,
        golf: 1,
        junction: 5,
        roundabout: 10,
        mini_roundabout: 5,
        turning_circle: 12,
        turning_loop: 10,
        traffic_signals: 1,
        level_crossing: 1,
        intersection: 5,
    };

    const TYPE_WIDTHS = {
        steps: 1.5,
        corridor: 2.5,
        sidewalk: 1.2,
        crossing: 1.4,
        piste: 4,
        mountain_bike: 1,
        hiking: 0.8,
        trail: 0.9,
        cycleway: 1.3,
        footway: 1,
        path: 1.1,
        bridleway: 1.6,
    };

    const height = getLayerHeight( type );

    if ( [ "Polygon", "MultiPolygon" ].includes( feature.geometry.type ) ) {
        const geom2 = GEOM2.fromGeoJSON( feature, $.center );
        geom2.type = type;
        geom2.height = height;
        geom2map[ type ].push( geom2 );
        track( type, "features" );
        track( type, "geom2" );
        return;
    }

    const minWidth = FORCE_MIN_WIDTH ? 0.6 * $.config.printScale / 1000 : 0;

    let width = $.config.widths.base;
    if ( props.lane_count ) width = props.lane_count * $.config.widths.propLane;
    else if ( props.type in TYPE_WIDTHS ) width = Math.max( TYPE_WIDTHS[ props.type ], minWidth );
    else if ( props.class in CLASS_WIDTHS ) width = Math.max( CLASS_WIDTHS[ props.class ], minWidth );

    const detail = getDetailConfig();
    const path2s = PATH2.fromGeoJSON(
        feature,
        $.center,
        { simplifyTolerance: mmToWorld( detail.roadSimplifyMm ) }
    ).filter( path2 => getPathLength( path2 ) >= mmToWorld( detail.minRoadLengthMm ) );

    path2s.forEach( path2 => {
        path2.type = type;
        path2.height = height;
        path2.width = width / 2;
        path2map[ type ].push( path2 );
    });

    if ( path2s.length > 0 ) {
        track( type, "features" );
        track( type, "paths", path2s.length );
    } else {
        track( type, "skipped" );
    }

}


function isRoadFeatureEnabled( type, props ) {
    const detail = getDetailConfig();

    if ( type === "street" ) {
        return detail.roadClasses.includes( props.class );
    }

    if ( type === "railway" ) {
        return detail.railClasses.includes( props.class );
    }

    return detail.includePaths;
}


export { build };
