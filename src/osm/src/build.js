import { STATE as $ } from "./state.js";
import * as util from "../../arc/src/util.js";
import { fetchGeojson } from "./fetch.js";
import { fetchTilesForBounds } from "../../mvt/index.js"
import { INTERSECTION, Brush, Evaluator, Operation, ADDITION, OperationGroup } from 'three-bvh-csg';
import { extrudeGeoJSON } from "geometry-extrude";
import Stroke from "extrude-polyline";
import { expandPaths } from "poly-extrude";

import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import polybool from "@velipso/polybool";
import * as martinez from "martinez-polygon-clipping";


// async function fetchData() {
//     const data = await fetchGeojson( $.worldOuterBounds );
//     // const response = await fetch( "./results/hom-osm.geojson" )
//     // const data = await ( response ).json();
//     $.data = data;
// }

async function fetchData() {

    // const ACCESS_TOKEN = 'pk.eyJ1IjoidGd1cmRhbiIsImEiOiJjbHhqODE5MnIxaHpxMmlzM2VjbWthMGdxIn0.1Pix25iPyLlNetjOtghK1w';
    // const URL_TEMPLATE = 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf';
    // const zoom = 15;
    // const data = await fetchTilesForBounds( $.worldOuterBounds, 15, URL_TEMPLATE, ACCESS_TOKEN );
    // $.data = data;

    const response = await fetch( "./results/all-mvt-15.geojson" );
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
    
    await fetchData();
    const features = $.data;
    
    console.log( "👷‍♀️ building city ..." );
    addGround();

    //  extrude geometry

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
            // case "building": generateBuilding( feature ); break;
            // case "water": appendWorldGeometry( feature, "water" ); break;
            case "road": generateRoad( feature ); break;
            // case "landuse":
            // case "structure":   //  hedge
            // case "landuse_overlay": generateLanduse( feature ); break;
        }

    });

    for ( const type in $.polygons ) {

        const multipolygon = $.polygons[ type ];
        const geom = extrudeMultipolygon( multipolygon, $.heights[ type ] );
        const mat = $.materials[ type ];
        const mesh = new THREE.Mesh( geom, mat );
        // const mesh = new THREE.Line( geom );
        $.city.add( mesh );

    }

    const buildingGeom = mergeGeometries( $.geometries.buildings );
    const buildingMesh = new THREE.Mesh( buildingGeom, $.materials.buildings );
    $.city.add( buildingMesh );
    
    //  merge objects

    const evaluator = new Evaluator();

    // for ( const type of Object.keys( $.geometries ) ) {
    //     const geom = mergeGeometries( $.geometries[ type ] );
    //     const mat = $.materials[ type ];    
    //     $.city.add( new THREE.Mesh( geom, mat ) );
    // }

    // // evaluator.consolidateMaterials = true;
    // // evaluator.useGroups = true;
    
    // const pedestrian = new Brush( mergeGeometries( $.geometries.pedestrian ), $.materials.pedestrian );
    // const path = new Brush( mergeGeometries( $.geometries.path ), $.materials.path );
    // const street = new Brush( mergeGeometries( $.geometries.street ), $.materials.street );
    // const buildings = new Brush( mergeGeometries( $.geometries.buildings ), $.materials.buildings );

    // // $.city.add( new THREE.Mesh( pedestrian, $.materials.pedestrian ) );
    // // $.city.add( new THREE.Mesh( path, $.materials.path ) );
    // // $.city.add( new THREE.Mesh( street, $.materials.street ) );
    
    // // let pedestrian = new Brush( mergeGeometries( $.geometries.pedestrian ), $.materials.pedestrian );
    // // group = evaluator.evaluate( group, new Brush( path, $.materials.path ), ADDITION );
    // // group = evaluator.evaluate( group, new Brush( street, $.materials.street ), ADDITION );
    
    // let res;
    // res = evaluator.evaluate( pedestrian, path, ADDITION );
    // res = evaluator.evaluate( res, street, ADDITION );
    // res = evaluator.evaluate( res, buildings, ADDITION );
    // $.city.add( res );
    

    //  clip

    console.log( "✂ clipping ..." );

    const cubeGeom = new THREE.BoxGeometry( $.worldTileSize.width, 1000, $.worldTileSize.height, 1, 1, 1 );
    const cubeBrush = new Brush( cubeGeom );

    for ( const child of $.city.children ) {
        const childBrush = new Brush( child.geometry );
        const result = evaluator.evaluate( childBrush, cubeBrush, INTERSECTION );    
        child.geometry = result.geometry;
    }

    console.timeEnd( "⏱ build" );

}


function extrudeLine( line, width ) {

    // console.log( line, width );

    // const { position } = expandPaths( [ line ], { cornerRadius: 0.5, lineWidth: width } );
    // return [ position ];

    const stroke = new Stroke({ 
        thickness: width,
        cap: 'square',
        join: 'bevel',
        miterLimit: 10
    });
    
    const { positions, cells } = stroke.build( line );

    let multipolygon = [];

    for ( const cell of cells ) {
        
        const [ id1, id2, id3 ] = cell;
        const region = [ positions[ id1 ], positions[ id2 ], positions[ id3 ] ];
        // const polygon = [ region ];
        
        multipolygon.push( [ region ] );
        // if ( ! multipolygon ) {
            // multipolygon = polygon;
            // continue;
        // }

        // multipolygon = martinez.union( polygon, multipolygon );

    }

    return multipolygon;

}


function extrudeMultiLine( multilines, width ) {
    return multilines.map( line => extrudeLine( line, width ) );
}


function extrudeMultipolygon( multipoly, height ) {  
    
    if ( ! multipoly || multipoly.length === 0 ) {
        return new THREE.BufferGeometry();
    }

    let geoms = [];

    for ( const polygon of multipoly ) {
        const shape = buildPolygonShape( polygon );
        const geom = extrudeShape( shape, height );
        geoms.push( geom );
    }

    const merged = mergeGeometries( geoms );
    merged.rotateX( -Math.PI / 2 );
    merged.computeVertexNormals();

    return merged;

}


/**
 * build closed THREE.Shape from list of points
 * @param {*} coords list of points (Number[][])
 * @returns coordinates as closed shape
 */
function buildShape( coords ) {

    let shape = new THREE.Shape();

    if ( coords.length === 0 ) {
        return shape;
    }

    if ( coords[ 0 ][ 0 ] === NaN ) {
        return shape;
    }

    console.log( coords );

    shape.moveTo( coords[ 0 ][ 0 ], coords[ 0 ][ 1 ] );
    
    for ( const point of coords.slice( 1 ) ) {
        shape.lineTo( point[ 0 ], point[ 1 ] );
    }
    
    shape.closePath();
    return shape;
    
}


/**
 * build closed THREE.Path from list of points
 * @param {*} coords list of points (Number[][])
 * @returns coordinates as closed path
 */
function buildPath( coords ) {

    let path = new THREE.Path();
    path.moveTo( coords[ 0 ][ 0 ], coords[ 0 ][ 1 ] );

    for ( const point of coords.slice( 1 ) ) {
        path.lineTo( point[ 0 ], point[ 1 ] );
    }
    
    path.closePath();
    return path;
    
}

/**
 * Build THREE.Shape from polygon, including holes
 * @param {*} polygon list of regions (Region[] := Point[][] := Number[][][])
 * @returns a shape where the first region is the outer ring, and all other regions are inner rings or holes
 */
function buildPolygonShape( polygon ) {
    
    const shape = buildShape( polygon[ 0 ] );

    for ( const region of polygon.slice( 1 ) ) {
        const path = buildPath( region );
        shape.holes.push( path );            
    }

    return shape;

}


/**
 * Build 3D geometry from 2D shape
 * @param {*} shape THREE.Shape
 * @param {*} height [m]
 * @returns 
 */
function extrudeShape( shape, height ) {

    const options = {
        steps: 1,
        depth: height,
        bevelEnabled: false
    };
    
    return new THREE.ExtrudeGeometry( shape, options );

}


/**
 * Convert each GPS point to local coordinates
 * @param {*} line list of points (Point[])
 * @param {*} origin 
 * @returns LineString
 */
function toLocalLine( line, origin ) {
    return line.map( coord => 
        util.gpsArrToEnu( origin, coord ).slice( 0, 2 )
    );
}


/**
 * Convert each GPS line to local coordinates
 * @param {*} multiline list of lines (Point[][])
 * @param {*} origin 
 * @returns MultiLineString
 */
function toLocalMultiLine( multiline, origin ) {
    return multiline.flatMap( line => toLocalLine( line, origin ) );
}


/**
 * Convert each GPS region to local coordinates
 * @param {*} polygon list of Regions (Point[][])
 * @param {*} origin 
 * @returns Polygon
 */
function toLocalPolygon( polygon, origin ) {
    return polygon.map( region => 
        region.map( coord => 
            util.gpsArrToEnu( origin, coord ).slice( 0, 2 )
        )
    );
}


/**
 * Convert each GPS Polygon to local coordinates
 * @param {*} multipolygon list of Polygons (Point[][][])
 * @param {*} origin 
 * @returns MultiPolygon
 */
function toLocalMultiPolygon( multipolygon, origin ) {
    return multipolygon.map( polygon => toLocalPolygon( polygon, origin ) );
}


/**
 * Convert GPS geometry to local coordinates, according to its type
 * @param {*} geometry GeoJSON
 * @param {*} origin 
 * @returns MultiPolygon
 */
function toLocalGeometry( geometry, origin ) {
    switch ( geometry.type ) {
        case "Polygon": return [ toLocalPolygon( geometry.coordinates, origin ) ];
        case "MultiPolygon": return toLocalMultiPolygon( geometry.coordinates, origin );
        default: console.error( "not implemented yet", geometry.type );
    }
}


/**
 * Compute union of GPS geometry with local subject
 * @param {*} geometry GeoJSON
 * @param {*} subject Polygon or MultiPolygon
 * @param {*} origin
 * @returns MultiPolygon
 */
function worldGeometryUnion( geometry, subject, origin ) 
{   
    const local = toLocalGeometry( geometry, origin );

    if ( ! local || local.length === 0 ) {
        return subject;
    }

    if ( ! subject || subject.length === 0 ) {
        return local;
    }
    
    return [ ...local, ...subject ];

    // const union = martinez.union( local, subject );
    // console.log( local, subject, union );
    // return union;
}


/**
 * Compute union of local geometry with local subject
 * @param {*} geometry Polygon or MultiPolygon
 * @param {*} subject Polygon or MultiPolygon
 * @param {*} origin
 * @returns MultiPolygon
 */
function geometryUnion( geometry, subject ) 
{   
    if ( ! subject || subject.length === 0 ) {
        return geometry;
    }

    return martinez.union( subject, geometry );
}


function appendWorldGeometry( item, type ) {
    $.polygons[ type ] = worldGeometryUnion( item.geometry, $.polygons[ type ], $.center );
}


function appendGeometry( geometry, type ) {
    $.polygons[ type ] = geometryUnion( geometry, $.polygons[ type ] );
}


function generateLanduse( item ) {
    
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

    const props = item.properties;
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

    appendWorldGeometry( item, type );

}


function generateBuilding( item ) {

    //  skip combined footprints of multipart building 
    //  [1] https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8#building-extrude-text
    if ( item.properties.extrude === "false" ) return;

    const type = "buildings";
    const height = item.properties.height | $.config.defaults.levels;

    // const geom = generateExtrudedGeometry( item.geometry, height );
    
    const multipoly = toLocalGeometry( item.geometry, $.center );
    const geom = extrudeMultipolygon( multipoly, height );

    if ( ! ( type in $.geometries ) ) $.geometries[ type ] = [];
    $.geometries[ type ].push( geom );

}


function generateRoad( item ) {
    
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

    const props = item.properties;
    let type = undefined;

    if ( STREET_CLASSES.includes( props.class ) ) type = "street";
    if ( RAIL_CLASSES.includes( props.class ) ) type = "railway";
    if ( [ "pedestrian" ].includes( props.class ) ) type = "path";
    if ( [ "track", "path" ].includes( props.class ) ) type = "path"; 
    if ( ! type ) return;
    // if ( [ "pedestrian", "street" ].includes( type ) ) return;

    if ( props.structure !== "none" ) {
        return;
    }

    const ROAD_WIDTHS = {
        "motorway": 24,
        "trunk": 22,
        "primary": 20,
        "secondary": 16,
        "tertiary": 12,
        "residential": 8,
        "service": 6,
        "unclassified": 8,
        "living_street": 6,
        "pedestrian": 4,
        "track": 4,
        "road": 8
    };      

    let width = $.config.widths.base;
    if ( props.lane_count ) width = props.lane_count * $.config.widths.propLane;
    else if ( props.type in ROAD_WIDTHS ) width = ROAD_WIDTHS[ props.type ];

    let multipolygon;
    
    if ( item.geometry.type === "LineString" ) {
        const line = toLocalLine( item.geometry.coordinates, $.center );
        multipolygon = extrudeLine( line, width );
    } else if ( item.geometry.type === "MultiLineString" ) {
        const multiline = toLocalMultiLine( item.geometry.coordinates, $.center );
        multipolygon = extrudeMultiLine( multiline, width );
    } else {
        return;
        // console.error( "invalid road type", item.geometry.type );
    }

    if ( ! multipolygon ) return;

    console.log( multipolygon );

    if ( ! $.polygons.road ) $.polygons.road = multipolygon;
    else $.polygons.road.push( ...multipolygon );
    // appendGeometry( multipolygon, "road" );
    
}


export { build };