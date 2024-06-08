import './style.css'

import p5 from 'p5';


const sketch = ( p ) => {
    
    p.setup = () => {
        p.createCanvas( p.windowWidth * 0.9, p.windowHeight * 0.9 );
    };

    p.draw = () => {
        p.background( "#333" );
        p.ellipse( p.width / 2, p.height / 2, 50, 50 );
    };

};


new p5( sketch );