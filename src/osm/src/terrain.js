import { fetchHeightmapsForBounds } from "./src/heightmap.js";
import * as util from "../arc/src/util.js";
import tilebelt from "@mapbox/tilebelt";
import * as THREE from "three";


function getBbox( bltr ) {
    return {
        xmin: bltr[ 0 ],
        ymin: bltr[ 1 ],
        xmax: bltr[ 2 ],
        ymax: bltr[ 3 ],
    };
}


function getDimensions( bbox ) {
    const ref = { latitude: bbox[1], longitude: bbox[0] };
    const br = { latitude: bbox[3], longitude: bbox[2] };
    const bboxm = util.gpsToEnu( ref, br );
    return { width: bboxm.x, height: bboxm.y };
}


const bbox = tilebelt.tileToBBOX( [ 906, 404, 10 ] );
console.log( bbox );

// const bounds = $.worldOuterBounds;
const bounds = getBbox( bbox );
const heightmaps = await fetchHeightmapsForBounds( bounds, 10, import.meta.env.VITE_MAPBOX_ACCESS_TOKEN );
const heightmap = heightmaps[ 0 ];
const heights = heightmap.data;

const dims = getDimensions( heightmap.bbox );


const plane = new THREE.PlaneGeometry( dims.width, dims.height, 255, 255 );
plane.rotateX( - Math.PI / 2 );
const verts = plane.attributes.position;

for ( let i = 0; i < heights.length; i++ ) {
    verts.setY( i, heights[ i ] );
}

plane.computeVertexNormals();
$.city.add( new THREE.Mesh( plane, new THREE.MeshStandardMaterial( { color: 0xbbbbbb } ) ));
