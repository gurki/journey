import Stroke from "extrude-polyline";
import polybool from "@velipso/polybool";


const sketch = (p) => {
  
  
p.setup = () => {
  p.createCanvas(480, 480);
  p.frameRate( 0 );
  p.draw();
};
  
  
function getClockwiseOrder(A, B, C) {
    // Function to calculate the determinant
    function determinant(x1, y1, x2, y2, x3, y3) {
        return (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
    }

    // Destructure points to get coordinates
    const [x1, y1] = A;
    const [x2, y2] = B;
    const [x3, y3] = C;

    // Calculate determinant
    const D = determinant(x1, y1, x2, y2, x3, y3);

    // Determine order based on determinant
    if (D > 0) {
        // Counterclockwise, current order is correct
        return [A, B, C];
    } else if (D < 0) {
        // Clockwise, so reverse the order
        return [A, C, B];
    } else {
        // Collinear case
        return "The points are collinear";
    }
}
  
  
function extrudePolyline( polyline ) {
  
  const stroke = new Stroke({ 
    thickness: 20, 
    cap: 'butt',
    join: 'bevel'
  });

  const { positions, cells } = stroke.build( polyline )
  
  const polygon = {
    positions,
    regions: cells.map( cell => getClockwiseOrder(
      positions[ cell[0] ],
      positions[ cell[1] ],
      positions[ cell[2] ]
    )), 
    inverted: false
  };
  
  return polygon;
  
}
  
  
function drawPolygon( polygon, fill, points ) {
  
  p.noStroke();
  p.fill( fill );
  
  p.beginShape();
  for ( const [ p0, p1, p2 ] of polygon.regions ) {
    p.vertex( p0[0], p0[1] );
    p.vertex( p1[0], p1[1] );
    p.vertex( p2[0], p2[1] );
  }
  p.endShape();
  
  if ( ! polygon.points ) return;
  
  p.fill( points );
  
  for ( const point of polygon.positions ) {
    p.ellipse( point[0], point[1], 10, 10 );
  }

}
  
  
function drawSegments( obj, fill ) {
  
  p.stroke( fill );
  
  p.beginShape( p.LINES );
  for ( const seg of obj.segments ) {
    p.vertex( seg.start[0], seg.start[1] );
    p.vertex( seg.end[0], seg.end[1] );
  }
  p.endShape();


}

  
p.draw = () => {
  
  p.background("#222");

  var polylineA = [ [100, 300], [250, 200], [400, 350] ];
  var polylineB = [ [50, 100], [200, 300], [350, 150] ];

  // const polygonA = extrudePolyline( polylineA );
  // const polygonB = extrudePolyline( polylineB );
  
  const polygonA = {
      regions: [
      [[50,50], [150,150], [190,50]],
      [[130,50], [290,150], [290,50]]
    ],
    inverted: false
  };
  
  const polygonB = {
    regions: [
      [[110,20], [110,110], [20,20]],
      [[130,170], [130,20], [260,20], [260,170]]
    ],
    inverted: false
  };
  
  drawPolygon( polygonA, "lime", "green" );
  drawPolygon( polygonB, "yellow", "olive" );
  
  // const segsA = polybool.segments( polygonA );
  // const segsB = polybool.segments( polygonB );
  
  const polyAB = polybool.union( polygonA, polygonB );
  // const union = polybool.selectUnion( comb );
  
  // const polyAB = polybool.polygon( union );
  
  drawPolygon( polyAB, "red", "maroon" );
  // drawSegments( segsA, "green" );
  // drawSegments( segsB, "olive" );
//   drawSegments( union, "orange" );
  console.log( polyAB );
//   console.log( union );
  
};
  
  
};

// Create a new p5 instance
new p5(sketch);