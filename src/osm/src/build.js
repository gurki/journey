import { STATE as $ } from "./state.js";
import { fetchTilesForBounds } from "../../mvt/index.js";
import * as PATH2 from "./cad/path2.js";
import * as GEOM2 from "./cad/geom2.js";
import * as GEOM3 from "./cad/geom3.js";
import * as jscad from "@jscad/modeling";

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

let path2map = {};
let geom2map = {};
let geom3map = {};

TYPES.forEach( type => {
    path2map[ type ] = [];
    geom2map[ type ] = [];
    geom3map[ type ] = [];
});


async function fetchData() {

    // const ACCESS_TOKEN = 'pk.eyJ1IjoidGd1cmRhbiIsImEiOiJjbHhqODE5MnIxaHpxMmlzM2VjbWthMGdxIn0.1Pix25iPyLlNetjOtghK1w';
    // const URL_TEMPLATE = 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf';
    // const zoom = 15;
    // const data = await fetchTilesForBounds( $.worldOuterBounds, zoom, URL_TEMPLATE, ACCESS_TOKEN );
    // $.data = data.flat();
    
    console.log( `⌛ fetching data …` );
    const response = await fetch( "./results/hom-mvt-15.geojson" );
    const tiles = await response.json();
    $.data = tiles.flat();

}


function addGround() {
    
    const groundHeight = $.heights.ground;
    const groundGeom = new THREE.BoxGeometry( $.worldTileSize.width, groundHeight, $.worldTileSize.height );
    const ground = new THREE.Mesh( groundGeom, $.materials.ground );
    ground.translateY( - groundHeight / 2 );
    $.city.add( ground );

}


async function build() {

    console.time( "⏱ build" );

    
    //  fetch data

    await fetchData();
    const features = $.data;
    

    //  build city, start with ground plane

    console.log( "👷‍♀️ building city ..." );
    addGround();
    
    
    //  build cad objects
    
    console.log( "🚧 converting geojson to cad objects ..." );
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


    //  path2 ->[expand]-> geom2

    console.log( "🛣️ expanding path2 to geom2 ..." );
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
            jscad.expansions.expand( { delta: path2.width, corners: "round", segments: 16 }, path2 ), 
            { type, height: path2.height } 
        ));

        geom2map[ type ].push( ...geom2s );

    }

    console.timeEnd( "⏱ path2 -> geom2" );


    //  geom2 ->[extrude]-> geom3

    console.log( "📐 extruding geom2 to geom3 ..." );
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

        const geom3s = pruned.map( geom2 => GEOM3.extrude( geom2, geom2.height ) );
        geom3map[ type ].push( ...geom3s );
        
    }
    
    console.timeEnd( "⏱ geom2 -> geom3" );
    

    //  geom3 ->[merge?,convert]-> bufferGeometry
    
    console.log( "🕸️ convert geom3 to mesh ..." );
    console.time( "⏱ geom3 -> mesh" );

    for ( const type of TYPES ) {
    
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
            $.city.add( mesh );
        }

    }

    console.timeEnd( "⏱ geom3 -> mesh" );
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

    const geom2 = GEOM2.fromGeoJSON( feature, $.center );
    geom2.type = type;
    geom2.height = $.heights[ type ];
    geom2map[ type ].push( geom2 );

}


function appendBuilding( feature ) {

    //  skip combined footprints of multipart building 
    //  [1] https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8#building-extrude-text
    if ( feature.properties.extrude === "false" ) return;

    const type = "buildings";
    
    const minHeight = 5;
    let height = feature.properties.height; // ? feature.properties.height : $.heights.buildings;
    if ( height <= minHeight ) height = $.heights.buildings;

    const geom2 = GEOM2.fromGeoJSON( feature, $.center );
    geom2.type = type;
    geom2.height = height;
    geom2map[ type ].push( geom2 );

}


function appendWater( feature ) {

    const type = "water";
    const height = $.heights[ type ];
    
    const geom2 = GEOM2.fromGeoJSON( feature, $.center );
    geom2.type = type;
    geom2.height = height;
    geom2map[ type ].push( geom2 );

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

    if ( [ "service:drive_through", "service:driveway", "service:parking_aisle", "service:parking" ].includes( props.type ) ) {
        return;
    }

    if ( [ "unclassified", "disused", "abandoned" ].includes( props.type ) ) {
    // if ( [ "crossing", "unclassified", "steps", "subway", "disused", "abandoned", "corridor" ].includes( props.type ) ) {
        return;
    }
    console.log( props.type );

    if ( props.structure !== "none" ) {
        //  bridge, tunnel
        return;
    }

    const CLASS_WIDTHS = {
        motorway: 25,
        motorway_link: 15,
        trunk: 15,
        trunk_link: 10,
        primary: 15,
        primary_link: 12,
        secondary: 10,
        secondary_link: 8,
        tertiary: 8,
        tertiary_link: 6,
        street: 9,
        street_limited: 7,
        pedestrian: 4,
        construction: 5,
        track: 3,
        service: 4,
        ferry: 20,
        path: 1.8,
        major_rail: 4,
        minor_rail: 3,
        service_rail: 2.5,
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
        sidewalk: 1.8,
        crossing: 2,
        piste: 4,
        mountain_bike: 1.5,
        hiking: 1,
        trail: 1.2,
        cycleway: 2,
        footway: 1.5,
        path: 1.8,
        bridleway: 2.5,
    };
    
    const height = $.heights[ type ];

    if ( [ "Polygon", "MultiPolygon" ].includes( feature.geometry.type ) ) {
        const geom2 = GEOM2.fromGeoJSON( feature, $.center );
        geom2.type = type;
        geom2.height = height;
        geom2map[ type ].push( geom2 );
        return;
    }    

    const minWidth = FORCE_MIN_WIDTH ? 0.6 * $.config.printScale / 1000 : 0;

    let width = $.config.widths.base;
    if ( props.lane_count ) width = props.lane_count * $.config.widths.propLane;
    else if ( props.type in TYPE_WIDTHS ) width = Math.max( TYPE_WIDTHS[ props.type ], minWidth );
    else if ( props.class in CLASS_WIDTHS ) width = Math.max( CLASS_WIDTHS[ props.class ], minWidth );

    const path2s = PATH2.fromGeoJSON( feature, $.center );

    path2s.forEach( path2 => {
        path2.type = type;
        path2.height = height;
        path2.width = width / 2;
        path2map[ type ].push( path2 );
    });

}


export { build };