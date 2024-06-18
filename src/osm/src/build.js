import { STATE as $ } from "./state.js";
import * as util from "../../arc/src/util.js";
import { fetchGeojson } from "./fetch.js";
import { fetchTilesForBounds } from "../../mvt/index.js"
import { INTERSECTION, Brush, Evaluator, Operation, ADDITION, OperationGroup } from 'three-bvh-csg';

import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";


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

    const response = await fetch( "./results/hom-mvt-15.geojson" );
    const tiles = await response.json();
    $.data = tiles.flat();

}


async function build() {

    console.time( "⏱ build" );
    
    const groundHeight = $.heights.ground;
    const groundGeom = new THREE.BoxGeometry( $.worldTileSize.width, groundHeight, $.worldTileSize.height );
    const ground = new THREE.Mesh( groundGeom, $.materials.ground );
    ground.translateY( - groundHeight / 2 );
    $.city.add( ground );

    await fetchData();
    const features = $.data;

    console.log( "👷‍♀️ building city ..." );
    
    //  extrude geometry

    // let layerNames = new Set();
    // let types = {};
    // let classes = {};

    features.forEach( ( feature, index ) => {

        if ( index % 100 === 0 ) {
            console.log( "   ", ( 100 * index / ( features.length - 1 ) ).toFixed( 1 ), "%" );
        }

        if ( feature.geometry.type === "Point" ) {
            return;
        }
        
        const props = feature.properties;       
        const name = props.layerName;
        // layerNames.add( name );
        // if ( ! ( name in types ) ) types[ name ] = new Set();
        // if ( ! ( name in classes ) ) classes[ name ] = new Set();
        // types[ name ].add( props.type );
        // classes[ name ].add( props.class );

        switch ( name ) {
            case "building": generateBuilding( feature ); break;
            case "water": generateWater( feature ); break;
            case "road": generateRoad( feature ); break;
            case "landuse":
            case "structure":   //  hedge
            case "landuse_overlay": geenerateLanduse( feature ); break;
        }

    });

    // console.log( layerNames );
    // console.log( types );
    // console.log( classes );


    //  merge objects

    const evaluator = new Evaluator();

    for ( const type of Object.keys( $.geometries ) ) {
        const geom = mergeGeometries( $.geometries[ type ] );
        const mat = $.materials[ type ];    
        $.city.add( new THREE.Mesh( geom, mat ) );
    }

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


function shapeFromPolygon( polygon ) {

    let shape = new THREE.Shape();

    polygon.forEach( ( coords, index ) => {

        const pos = util.gpsArrToEnu( $.center, coords );
		
        if ( index == 0 ) {
			shape.moveTo( pos[0], pos[1] );
		} else {
			shape.lineTo( pos[0], pos[1] );
		}

    });

	return shape;
    
}


function geometryFromLineString( polygon, width = 5, height = 2 ) {

    const points = polygon.map( coord => {
        const arr = util.gpsArrToEnu( $.center, coord );
        return new THREE.Vector3( arr[0], arr[1], 0 );
    });

    const curve = new THREE.CatmullRomCurve3( points );
    const shape = new THREE.Shape();
    shape.moveTo( 0, - width / 2 );
    shape.lineTo( height, - width / 2 );
    shape.lineTo( height, width / 2 );
    shape.lineTo( 0, width / 2 );
    shape.lineTo( 0, - width / 2 );

    const steps = polygon.length * 2;
    
    let geom = new THREE.ExtrudeGeometry( shape, {     
        steps,
        bevelEnabled: false,
        extrudePath: curve
    });

    geom.rotateX( -Math.PI / 2 );
    geom.translate( 0, height, 0 );
    geom.computeVertexNormals();
    return geom;
    
}


function compositeFromPolygons( polygons ) {
    
    let comp; 

    polygons.forEach( ( polygon, index ) => {

		if ( index == 0 ) {
			comp = shapeFromPolygon( polygon );
		} else {
			comp.holes.push( shapeFromPolygon( polygon ) );
		}

	});

    return comp;

}


function geometryFromMultiPolygons( multiPolygons, height ) {

    const geometries = multiPolygons.map( polygons =>
        geometryFromPolygons( polygons, height )    
    );

    return mergeGeometries( geometries );

}


function geometryFromMultiLineString( multiLines, height ) {

    const geometries = multiLines.map( lines =>
        geometryFromLineString( lines, height )    
    );

    return mergeGeometries( geometries );

}


function geometryFromPolygons( polygons, height ) {

    const shape = compositeFromPolygons( polygons );
    
    const options = {
        steps: 1,
        depth: height,
        bevelEnabled: false
    };
    
    const geom = new THREE.ExtrudeGeometry( shape, options );
    geom.rotateX( -Math.PI / 2 );
    geom.computeVertexNormals();
    return geom;

}


function generateExtrudedGeometry( geometry, height, width ) {

    switch ( geometry.type ) {
        case "Polygon": return geometryFromPolygons( geometry.coordinates, height );
        case "MultiPolygon": return geometryFromMultiPolygons( geometry.coordinates, height );
        case "LineString": return geometryFromLineString( geometry.coordinates, width, height );
        case "MultiLineString": return geometryFromMultiLineString( geometry.coordinates, width, height );
    }
     
    console.error( `unknown geometry type ${geometry.type}` );

}


function generateWater( item ) {

    const type = "water";
    const height = $.heights[ type ];
    const geom = generateExtrudedGeometry( item.geometry, height );
    const mesh = new THREE.Mesh( geom, $.materials[ type ] );
    $.city.add( mesh );

}


function geenerateLanduse( item ) {
    
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

    const height = $.heights[ type ];
    const geom = generateExtrudedGeometry( item.geometry, height );
    const mesh = new THREE.Mesh( geom, $.materials[ type ] );
    $.city.add( mesh );

}


function generateBuilding( item ) {

    //  skip combined footprints of multipart building 
    //  [1] https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8#building-extrude-text
    if ( item.properties.extrude === "false" ) return;

    const type = "buildings";
    const height = item.properties.height | $.config.defaults.levels;
    const geom = generateExtrudedGeometry( item.geometry, height );
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
    if ( [ "pedestrian" ].includes( props.class ) ) type = "pedestrian";
    if ( [ "track", "path" ].includes( props.class ) ) type = "path"; 
    if ( ! type ) return;

    if ( props.structure !== "none" ) {
        return;
    }

    let width;
    if ( props.lane_count ) width = props.lane_count * $.config.widths.propLane;
    else width = $.config.widths.base;

    const height = $.heights[ type ];
    const geom = generateExtrudedGeometry( item.geometry, height, width );
    if ( ! ( type in $.geometries ) ) $.geometries[ type ] = [];
    $.geometries[ type ].push( geom );

}


export { build };