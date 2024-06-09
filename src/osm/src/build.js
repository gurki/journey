import { STATE as $ } from "./state.js";
import * as util from "../../arc/src/util.js";

import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";


async function fetchData() {
    
    // const total = { ymin: 47.47749, xmin: 19.0287947, ymax: 47.52146, xmax: 19.0854007 };
    const hom = { ymin: 47.5089, xmin: 19.0722, ymax: 47.5190, xmax: 19.0867 };
    $.bounds = hom;
    $.center = { 
        latitude: ( $.bounds.ymax + $.bounds.ymin ) / 2, 
        longitude: ( $.bounds.xmax + $.bounds.xmin ) / 2 
    };
    // import { fetchGeojson } from "./src/util";
    // const geojson = await fetchGeojson( bounds );
    return ( await ( await fetch( "./results/hom.geojson" ) ).json() );

}


async function build() {

    const geojson = await fetchData();
    
    for ( const item of geojson.features ) {

        const props = item.properties;

        //  MultiPolygon := Array[ Polygon ]
        //  Polygon := Array[ Coords ]
        //  Coords := Array[ 2 ]

        if ( props.building ) {

        } else if ( props.highway ) {
            
        } else if ( props.railway ) {

        } else if ( props.natural ) {
            generateNatural( item );
        } else if ( props.leisure ) {
            
        }

    }

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
        steps: 2,
        depth: height,
        bevelEnabled: false
    };
    
    const geom = new THREE.ExtrudeGeometry( shape, options );
    geom.rotateX( -Math.PI / 2 );
    geom.computeVertexNormals();
    return geom;

}


function generateExtrudedGeomtry( geometry, height ) {

    switch ( geometry.type ) {
        case "Polygon": return geometryFromPolygons( geometry.coordinates, height );
        case "MultiPolygon": return geometryFromMultiPolygons( geometry.coordinates, height );
        case "LineString": return geometryFromLineString( geometry.coordinates, height );
    }
     
    console.error( `unknown geometry type ${geometry.type}` );

}


function generateNatural( item ) {

    if ( item.properties.natural !== "water" ) return;    

    const geom = generateExtrudedGeomtry( item.geometry, 2 );
    const mat = new THREE.MeshPhongMaterial( { color: "#00FFFF" } );
    const mesh = new THREE.Mesh( geom, mat );
    $.scene.add( mesh );

}


export { build };