import p5 from 'p5';
import * as geolib from "geolib"
import * as util from "./util.js"

const filename = "2024-05-28.json";
const data = await import( "../../../data/arc/2024-05-28.json" );


let positions;
let bounds;
let time = new Date();

const margin = 20;    
let bx, by;
let xscale, yscale, scale;
let xoff, yoff;
let tmin, tmax;

const sketch = ( p ) => {
    
    p.preload = () => {
        
        const allLocs = [];
        
        for ( const item of data.timelineItems ) {
            for ( const sample of item.samples ) {
                if ( ! sample.location ) continue;
                if ( sample.location.horizontalAccuracy > 50 ) continue;
                if ( sample.location.verticalAccuracy > 50 ) continue;
                if ( sample.movingState === "stationary" ) continue;
                if ( sample.recordingState !== "recording" ) continue;
                allLocs.push( sample.location );
            }
        }

        tmin = new Date( allLocs[ 0 ].timestamp );
        tmax = new Date( allLocs[ allLocs.length - 1 ].timestamp );
        time.setTime( tmin.getTime() );

        const center = geolib.getCenterOfBounds( allLocs );
        positions = allLocs.map( point => util.gpsToEnu( center, point ) );
        bounds = positions.reduce( 
            ( curr, pos ) => {
                return {
                    xmin: Math.min( curr.xmin, pos.x ),
                    xmax: Math.max( curr.xmax, pos.x ),
                    ymin: Math.min( curr.ymin, pos.y ),
                    ymax: Math.max( curr.ymax, pos.y ),
                }
            }, 
            { 
                xmin: Infinity, 
                xmax: -Infinity,
                ymin: Infinity, 
                ymax: -Infinity 
            }
        );
    
        bx = ( bounds.xmax - bounds.xmin );
        by = ( bounds.ymax - bounds.ymin );
        xscale = ( p.windowWidth - 2 * margin ) / bx;
        yscale = ( p.windowHeight - 2 * margin ) / by;
        scale = Math.min( xscale, yscale );
        xoff = bx / 2;
        yoff = by / 2;

    }

    p.setup = () => {
        const w = bx > by ? p.windowWidth : p.windowHeight * ( bx / by ) + 2 * margin;
        const h = bx > by ? p.windowWidth * ( by / bx ) + 2 * margin : p.windowHeight;
        p.createCanvas( w, h );
    };

    p.mousePressed = () => {
        p.saveCanvas( `${filename.replace( ".json", '' )}.png` ); 
    }

    p.draw = () => {

        time.setMinutes( time.getMinutes() + 1 );
        
        if ( time > tmax ) {
            time.setTime( tmin.getTime() );
        };

        p.background( "#333" );

        p.noStroke();
        p.fill( "#ddd" );
        p.textSize( 18 );
        p.textAlign( p.CENTER );
        p.text( filename, p.width / 2, 40 );
        p.text( time.toISOString().substring( 0, 16 ), p.width / 2, 60 );

        p.beginShape( p.LINES );

        for ( let i = 0; i < positions.length - 1; i++ ) {     

            const pos1 = positions[ i ];
            
            const curr = new Date( pos1.timestamp );
            let lower = new Date( time.getTime() );
            lower.setMinutes( lower.getMinutes() - 240 );
            if ( curr < lower ) continue;
            if ( curr > time ) break;

            const pos2 = positions[ i + 1 ];
            const t1 = i / ( positions.length - 1 );
            const t2 = ( i + 1 ) / ( positions.length - 1 );
            const x1 = ( pos1.x + xoff ) * scale + margin;
            const x2 = ( pos2.x + xoff ) * scale + margin;
            const y1 = ( -pos1.y + yoff ) * scale + margin;
            const y2 = ( -pos2.y + yoff ) * scale + margin;

            const age = 1 - ( time - curr ) / ( 240 * 60 * 1000 );
            
            p.stroke( t1 * 255, 255 - t1 * 255, 0, 255 * age );
            p.vertex( x1, y1 );
            p.stroke( t2 * 255, 255 - t2 * 255, 0, 255 * age );
            p.vertex( x2, y2 );

        }
                
        p.endShape();

    };

};


new p5( sketch );