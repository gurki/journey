import { STATE as $ } from "./state.js";
import * as util from "../../arc/src/util.js";
import { fetchGeojson } from "./fetch.js";
import { INTERSECTION, Brush, Evaluator, Operation, ADDITION, OperationGroup } from 'three-bvh-csg';

import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";


async function fetchData() {
    const data = await fetchGeojson( $.worldOuterBounds );
    // const response = await fetch( "./results/hom.geojson" )
    // const data = await ( response ).json();
    $.data = data;
}


async function build() {

    console.time( "⏱ build" );
    
    const groundHeight = $.heights.ground;
    const groundGeom = new THREE.BoxGeometry( $.worldTileSize.width, groundHeight, $.worldTileSize.height );
    const ground = new THREE.Mesh( groundGeom, $.materials.ground );
    ground.translateY( - groundHeight / 2 );
    $.city.add( ground );

    await fetchData();
    const data = $.data;
    const features = data.features;

    console.log( "👷‍♀️ building city ..." );
    
    //  extrude geometry

    features.forEach( ( feature, index ) => {

        if ( index % 100 === 0 ) {
            console.log( "   ", ( 100 * index / ( features.length - 1 ) ).toFixed( 1 ), "%" );
        }

        if ( feature.geometry.type === "Point" ) {
            return;
        }

        const props = feature.properties;       

        if ( props.building ) {
            generateBuilding( feature );
        } else if ( props.highway ) {
            generateHighway( feature );
        } else if ( props.railway ) {
            generateRailway( feature );
        } else if ( props.natural ) {
            generateNatural( feature );
        } else if ( props.leisure ) {
            generateLeisure( feature );
        }

    });


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

    const steps = polygon.length;
    
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


function generateExtrudedGeomtry( geometry, height, width ) {

    switch ( geometry.type ) {
        case "Polygon": return geometryFromPolygons( geometry.coordinates, height );
        case "MultiPolygon": return geometryFromMultiPolygons( geometry.coordinates, height );
        case "LineString": return geometryFromLineString( geometry.coordinates, width, height );
    }
     
    console.error( `unknown geometry type ${geometry.type}` );

}


function generateNatural( item ) {

    let type; 

    switch ( item.properties.natural ) {
        case "water": type = "water"; break;
        case "bare_rock": type = "stone"; break;
        default: type = "greenery";
    }

    const height = $.heights[ type ];
    const geom = generateExtrudedGeomtry( item.geometry, height );
    const mesh = new THREE.Mesh( geom, $.materials[ type ] );
    $.city.add( mesh );

}


function generateLeisure( item ) {

    const height = $.heights.parks;
    const geom = generateExtrudedGeomtry( item.geometry, height );
    const mesh = new THREE.Mesh( geom, $.materials.parks );
    $.city.add( mesh );

}


function generateBuilding( item ) {

    const levels = item.properties[ "building:levels" ] | $.config.defaults.levels;
    const height = levels * $.heights.buildings;

    const type = "buildings";
    const geom = generateExtrudedGeomtry( item.geometry, height );
    if ( ! ( type in $.geometries ) ) $.geometries[ type ] = [];
    $.geometries[ type ].push( geom );

}


function generateHighway( item ) {
    
    const props = item.properties;
    const subtype = props.highway;
    const isWalkable = [ "path", "steps", "track", "footway", "cycleway" ].includes( subtype );
    const isCurve = ( item.geometry.type === "LineString" );
    
    let type;
    if ( ! isCurve ) type = "pedestrian";
    else if ( isWalkable ) type = "path";
    else type = "street";

    let width;
    if ( props.width ) width = props.width * $.config.widths.propWidth;
    else if ( props.lanes ) width = props.lanes * $.config.widths.propLane;
    else width = $.config.widths.base;

    const height = $.heights[ type ];
    const geom = generateExtrudedGeomtry( item.geometry, height, width );
    if ( ! ( type in $.geometries ) ) $.geometries[ type ] = [];
    $.geometries[ type ].push( geom );

}


function generateRailway( item ) {
        
    const width = $.config.widths.railway;
    const height = $.heights.railway;
    
    const geom = generateExtrudedGeomtry( item.geometry, height, width );
    const mesh = new THREE.Mesh( geom, $.materials.railway );
    $.city.add( mesh );

}


export { build };