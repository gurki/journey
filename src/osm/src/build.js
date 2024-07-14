import { STATE as $ } from "./state.js";
import * as util from "../../arc/src/util.js";
import { fetchGeojson } from "./fetch.js";
import { fetchTilesForBounds } from "../../mvt/index.js"
import { Brush, Evaluator, ADDITION, INTERSECTION } from 'three-bvh-csg';
import { extrudeGeoJSON } from "geometry-extrude";
import Stroke from "extrude-polyline";
import { expandPaths, extrudePolylines } from "poly-extrude";
import { CSG } from "three-csg-ts";

import * as THREE from "three"
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils";
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
    // const data = await fetchTilesForBounds( $.worldOuterBounds, zoom, URL_TEMPLATE, ACCESS_TOKEN );
    // $.data = data.flat();

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


function clipAll( brushes, clipBrush ) {
    console.log( `✂ clipping (num: ${brushes.length}) ...` );
    return brushes.map( brush => brush.intersect( clipBrush ) );
}


function mergeDisjunct( geoms ) {
    
    console.log( `start: ${geoms.length}` );
    
    const disjuncts = geoms;
    let succ = true;
    
    while ( succ ) {
        
        succ = false;
        
        for ( const curr of disjuncts ) {      
            
            const disjunctId = disjuncts.findIndex( geom => ! curr.boundingSphere.intersectsSphere( geom.boundingSphere ) );
            
            if ( disjunctId < 0 ) {
                continue;
            }
            
            const [ disjunctA ] = disjuncts.splice( disjunctId, 1 );
            const [ disjunctB ] = disjuncts.splice( disjuncts.indexOf( curr ), 1 );
            const merge = mergeGeometries( [ disjunctA, disjunctB ] );
            merge.computeBoundingSphere();
            disjuncts.push( merge );            
            succ = true;
            break;
            
        }
        
    }

    console.log( `end: ${disjuncts.length}` );
    return disjuncts;

}


function clipAndMerge( geoms, clipBrush ) {

    console.time( "⏱ simplify" );
    // const simple = geoms.map( geom => mergeVertices( geom, 0.1 ) ).slice( 2000, 1000 );
    const simple = geoms.map( geom => mergeVertices( geom, 0.1 ) );
    simple.forEach( geom => geom.computeBoundingSphere() );

    const disjuncts = simple;
    // const disjuncts = mergeDisjunct( simple );
    
    const brushes = disjuncts.map( geom => CSG.fromGeometry( geom ) );
    console.timeEnd( "⏱ simplify" );
    
    console.time( "⏱ clip" );
    const clipped = clipAll( brushes, clipBrush );
    console.timeEnd( "⏱ clip" );

    console.time( "⏱ merge" );
    const merged = mergeAll( brushes );
    console.timeEnd( "⏱ merge" );

    const cleanup = mergeVertices( merged.toGeometry( new THREE.Matrix4() ), 0.1 ).toNonIndexed();
    return new THREE.Mesh( cleanup );

}


function mergeAll( brushes, depth = 0 ) {
    
    console.log( `merging (lvl: ${depth}, num: ${brushes.length}) ...` );

    const isEven = ( brushes.length % 2 ) === 0;
    const count = Math.floor( brushes.length / 2 );
    const left = brushes.slice( 0, count );
    const right = brushes.slice( count, isEven ? brushes.length : brushes.length - 1 );

    let adds = isEven ? [] : [ brushes[ brushes.length - 1 ] ];
    
    for ( let i = 0; i < count; i++ ) {
        const add = left[ i ].union( right[ i ] );
        adds.push( add );
    }

    if ( adds.length === 1 ) {
        return adds[ 0 ];
    }

    return mergeAll( adds, depth + 1 );

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
        
        if ( multipolygon.length === 0 ) {
            continue;
        }

        const geoms = multipolygon.map( polygon => {
            // return extrudeMultipolygon( [ polygon ], $.heights[ type ] );
            return extrudeMultipolygon( [ polygon ], $.heights[ type ] );
        });

        $.geometries[ type ] = geoms;

    }

    // for ( const key in $.geometries ) {
    //     const geom = mergeGeometries( $.geometries[ key ] );
    //     const mesh = new THREE.Mesh( geom, $.materials[ key ] );
    //     $.city.add( mesh );
    // }
    
    //  merge objects

    const clipGeom = new THREE.BoxGeometry( $.worldTileSize.width, 1000, $.worldTileSize.height, 1, 1, 1 );
    const clipBrush = CSG.fromGeometry( clipGeom );
    
    function getRandomColor() {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        return (r << 16) | (g << 8) | b;
    }


    for ( const key in $.geometries ) {

        console.log( key );
        const geoms = $.geometries[ key ];
        const filtered = geoms.filter( geom => {
            // const pos0 = new THREE.Vector3().fromBufferAttribute( geom.attributes.position, 0 );
            // if ( pos0.x > -520 || pos0.x < -560 ) return false;
            // if ( pos0.z < 425 ) return false;
            // if ( pos0.z > 440 ) return false;
            // if ( pos0.x > -200 || pos0.x < -300 ) return false;
            // if ( pos0.z < 200 ) return false;
            // if ( pos0.z > 400 ) return false;
            return true;
        })

        let count = 0;
        const mesh = clipAndMerge( filtered, clipBrush );

        // const pos = mesh.geometry.attributes.position.array;
        // mesh.geometry.attributes.position.set( pos.map( n => Math.round( n * 1 ) / 1 ) );
        // const norm = mesh.geometry.attributes.normal.array;
        // mesh.geometry.attributes.normal.set( norm.map( n => Math.round( n * 100 ) / 100 ) );
        // mesh.geometry.needsUpdate = true;
        // console.log( pos );
        // mesh.geometry = mergeVertices( mesh.geometry, 1 );

        for ( const geom of filtered ) {
            
            // geom.translate( count * 20, 0, count * 20 );
            count++;
            // console.log( geom );
            // const mesh = new THREE.Mesh( geom );
            // mesh.material = new THREE.MeshStandardMaterial( { color: getRandomColor(), opacity: 0.8, transparent: true } );
            mesh.material = $.materials[ key ];
            $.city.add( mesh );
            // $.lols = mesh;

        }

        // const wireframe = new THREE.WireframeGeometry( mesh.geometry );
        // const line = new THREE.LineSegments( wireframe );
        // line.material.depthTest = false;
        // line.material.opacity = 0.5;
        // line.material.transparent = true;
        // $.scene.add( line );


    };
    
    console.timeEnd( "⏱ build" );

}


function extrudeLine( line, width, height ) {
    return extrudeMultiLine( [ line ], width, height );
}


function extrudeMultiLine( multilines, width, height ) 
{
    const { position, normal, uv, indices } = extrudePolylines( multilines, { depth: height, lineWidth: width } );
    let geom = new THREE.BufferGeometry();
    
    geom.setAttribute( "position", new THREE.BufferAttribute( position, 3 ) );
    
    if ( normal ) {
        geom.setAttribute( "normal", new THREE.BufferAttribute( normal, 3 ) );
    }

    if ( uv ) {
        geom.setAttribute( "uv", new THREE.BufferAttribute( uv, 2 ) );
    }
    
    geom.setIndex( new THREE.BufferAttribute( indices, 1 ) );
    geom = geom.toNonIndexed();
    geom.rotateX( -Math.PI / 2 );
    geom.computeVertexNormals();
    return geom;
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

    shape.moveTo( coords[ 0 ][ 0 ], coords[ 0 ][ 1 ] );
    
    for ( const point of coords.slice( 1 ) ) {
        shape.lineTo( point[ 0 ], point[ 1 ] );
    }
    
    if ( coords.length > 2 ) {
        shape.closePath();
    }

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
    
    // path.closePath();
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
    return multiline.map( line => toLocalLine( line, origin ) );
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
        // default: console.warning( "not implemented yet", geometry.type );
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


// function appendGeometry( geometry, type ) {
//     $.polygons[ type ] = geometryUnion( geometry, $.polygons[ type ] );
// }


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
    if ( ! type ) {
        return;
    }
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
    
    const height = $.heights[ type ];
    let geojson;
    let geom;
    
    if ( item.geometry.type === "LineString" ) {
        geojson = toLocalLine( item.geometry.coordinates, $.center );
        geom = extrudeLine( geojson, width, height );
    } else if ( item.geometry.type === "MultiLineString" ) {
        geojson = toLocalMultiLine( item.geometry.coordinates, $.center );
        geom = extrudeMultiLine( geojson, width, height );
    } else {
        geojson = toLocalGeometry( item.geometry, $.center );
        geom = extrudeMultipolygon( geojson, height )
        // return;
        // console.error( "invalid road type", item.geometry.type );
    }
    
    if ( geom.attributes.position.array.some( isNaN ) ) {
        return;
    }

    if ( ! $.geometries[ type ] ) $.geometries[ type ] = [];
    $.geometries[ type ].push( geom );

    // if ( ! $.polygons[ type ] ) $.polygons[ type ] = multipolygon;
    // else $.polygons[ type ].push( ...multipolygon );
    // appendGeometry( multipolygon, "road" );
    
}


export { build };