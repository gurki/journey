import { fetchHeightmapsForBounds } from "./heightmap.js";
import * as util from "../../arc/src/util.js";
import tilebelt from "@mapbox/tilebelt";
import * as THREE from "three";
import { STATE as $ } from "./state.js";


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


const tile = tilebelt.pointToTile( 47.497788, 19.063219, 2 );
const bbox = tilebelt.tileToBBOX( tile );
console.log( tile, bbox );

// const bounds = $.worldOuterBounds;
const ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const bounds = getBbox( bbox );
const heightmaps = await fetchHeightmapsForBounds( bounds, 2, ACCESS_TOKEN );
const heightmap = heightmaps[ 1 ];
const heights = heightmap.data;

const dims = getDimensions( heightmap.bbox );

console.log( heightmap );

const plane = new THREE.PlaneGeometry( 10000, 10000, 255, 255 );
plane.rotateX( - Math.PI / 2 );
const verts = plane.attributes.position;

for ( let i = 0; i < heights.length; i++ ) {
    verts.setY( i, 128 * Math.log( 512 + heights[ i ] ) );
}

plane.computeVertexNormals();
$.city.add( new THREE.Mesh( plane, new THREE.MeshStandardMaterial( { color: 0xbbbbbb } ) ));
