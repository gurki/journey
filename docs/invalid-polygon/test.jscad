/**
 * 2D Primitives Demonstration
 * @category Creating Shapes
 * @skillLevel 1
 * @description Demonstrating the basics of a variety of 2D primitives
 * @tags circle, square, line, ellipse, polygon, shape, 2d
 * @authors Simon Clark
 * @licence MIT License
 */

const jscad = require('@jscad/modeling');
const colorize = jscad.colors.colorize;


const main = () => {

    const toLocal = sides => sides.map( side => side.map( p => [ p[0] + 520, p[1] - 160 ] ));
  
    let sidesA = toLocal([
        [ [ -533.5120000000001, 179.165 ], [ -533.5120000000001, 194.895 ] ],
        [ [ -533.5120000000001, 194.895 ], [ -540.369, 189.45000000000002 ] ],
        [ [ -540.369, 189.45000000000002 ], [ -571.224, 166.25900000000001 ] ],
        [ [ -571.224, 166.25900000000001 ], [ -560.1320000000001, 151.74 ] ],
        [ [ -560.1320000000001, 151.74 ], [ -546.822, 161.823 ] ],
        [ [ -546.822, 161.823 ], [ -533.5120000000001, 172.107 ] ],
        [ [ -533.5120000000001, 172.107 ], [ -533.5120000000001, 179.165 ] ]
    ]);
    
    let sidesB = toLocal([
        [ [ -533.513, 179.165 ], [ -537.344, 184.005 ] ],
        [ [ -537.344, 184.005 ], [ -557.107, 168.881 ] ],
        [ [ -557.107, 168.881 ], [ -553.477, 164.041 ] ],
        [ [ -553.477, 164.041 ], [ -533.513, 179.165 ] ]
    ]);
  
  const toPath2 = ( geom2 ) => jscad.geometries.path2.fromPoints( { closed: true }, jscad.geometries.geom2.toPoints( geom2 ) );
  
  const geom2A = jscad.geometries.geom2.create( sidesA );
  const geom2B = jscad.geometries.geom2.create( sidesB );
  const subGeom2 = jscad.booleans.subtract( geom2A, geom2B );
  
  console.log( geom2A, geom2B );
  
  const path2A = toPath2( geom2A );
  const path2B = toPath2( geom2B );
      
  console.log( path2A, path2B );
      
  const subPath2 = jscad.booleans.subtract( path2A, path2B );
  
  //jscad.geometries.geom2.validate( subGeom2 );
  const geom3 = jscad.extrusions.extrudeLinear( { height: 20 }, subGeom2 );
  //jscad.geometries.geom3.validate( geom3 );
  
  return [ 
    //colorize( [1,0,0], path2A ), 
    //colorize( [0,1,0], path2B ), 
    colorize( [0,0,1], subPath2 ),
    geom3
  ];

}


module.exports = { main }
