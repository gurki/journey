import { STATE as $ } from "./state.js";
import * as util from "../../arc/src/util.js";
import { fetchGeojson } from "./fetch.js";
import { CSG } from "./CSGMesh.ts";

import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";


async function fetchData() {
    // return await fetchGeojson( $.config.bounds );
    return ( await ( await fetch( "./results/hom.geojson" ) ).json() );

}

async function build() {

    console.time( "⏱ build" );
    
    const groundHeight = 10;
    const groundGeom = new THREE.BoxGeometry( $.dimensions.width, groundHeight, $.dimensions.height );
    const groundMat = new THREE.MeshToonMaterial( { color: "#161616" } );
    const ground = new THREE.Mesh( groundGeom, groundMat );
    ground.translateY( - groundHeight / 2 );
    $.city.add( ground );

    const geojson = await fetchData();
    const features = geojson.features;

    console.log( "👷‍♀️ building city ..." );
    
    features.forEach( ( feature, index ) => {

        if ( index % 100 === 0 ) {
            console.log( "   ", ( 100 * index / ( features.length - 1 ) ).toFixed( 1 ), "%" );
        }

        if ( feature.geometry.type === "Point" ) return;
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


    //  clip

    const cubeGeom = new THREE.BoxGeometry( $.dimensions.width, 1000, $.dimensions.height, 1, 1, 1 );
    // cubeGeom.translate( $.dimensions.width, 0, 0 );

    let cube = CSG.fromGeometry( cubeGeom );
    cube = cube.inverse();
    
    for ( const child of $.city.children ) {
        const csg = CSG.fromGeometry( child.geometry );
        const res = csg.clipTo( cube );
        const newGeom = CSG.toGeometry( res );
        child.geometry = newGeom;
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


function geometryFromLineString( polygon, width = 5, height = 2, steps = 20 ) {

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


function generateExtrudedGeomtry( geometry, height, width, steps ) {

    switch ( geometry.type ) {
        case "Polygon": return geometryFromPolygons( geometry.coordinates, height );
        case "MultiPolygon": return geometryFromMultiPolygons( geometry.coordinates, height );
        case "LineString": return geometryFromLineString( geometry.coordinates, width, height, steps );
    }
     
    console.error( `unknown geometry type ${geometry.type}` );

}


function generateNatural( item ) {

    const isWater = ( item.properties.natural === "water" );
    const isStone = ( item.properties.natural === "bare_rock" );
    const color = isWater ? "#0ff" : ( isStone ? "#cc7" : "#294" );

    const geom = generateExtrudedGeomtry( item.geometry, 2 );
    const mat = new THREE.MeshPhongMaterial( { color } );
    const mesh = new THREE.Mesh( geom, mat );
    $.city.add( mesh );

}


function generateLeisure( item ) {

    const geom = generateExtrudedGeomtry( item.geometry, 1 );
    const mat = new THREE.MeshPhongMaterial( { color: "#2c4" } );
    const mesh = new THREE.Mesh( geom, mat );
    $.city.add( mesh );

}


function generateBuilding( item ) {

    const levels = item.properties[ "building:levels" ] | 4;
    const height = levels * 5;
    const geom = generateExtrudedGeomtry( item.geometry, height );
    const mat = new THREE.MeshPhongMaterial( { color: "#ccc" } );
    const mesh = new THREE.Mesh( geom, mat );
    $.city.add( mesh );

}


function generateHighway( item ) {
    
    const props = item.properties;
    const type = props.highway;

    const isCurve = ( item.geometry.type === "LineString" );
    const isWalkable = [ "path", "steps", "track", "footway", "cycleway" ].includes( type );

    const width = props.width ? props.width : ( props.lanes ? props.lanes * 5 : 5 );
    const color = isCurve ? ( isWalkable ? "#aaa" : "#777" ) : "#555";
    const height = isCurve ? ( isWalkable ? 4 : 3 ) : 2;
    
    const geom = generateExtrudedGeomtry( item.geometry, height, width );
    const mat = new THREE.MeshPhongMaterial( { color } );
    const mesh = new THREE.Mesh( geom, mat );
    $.city.add( mesh );

}


function generateRailway( item ) {
        
    const width = 3;
    const color = "#666";
    const height = 2;
    
    const geom = generateExtrudedGeomtry( item.geometry, height, width );
    const mat = new THREE.MeshPhongMaterial( { color } );
    const mesh = new THREE.Mesh( geom, mat );
    $.city.add( mesh );

}


export { build };