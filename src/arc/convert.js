import fs from "bun:fs";
import path from "bun:path";
// import histogram from "ascii-histogram";

const directory = "../../data/arc/";
const samples = [];

// let haccs = {};
// let vaccs = {};

for ( const filename of fs.readdirSync( directory ) ) {
        
    const filepath = path.join( directory, filename );
    console.log( `reading ${filepath} ...` );

    const data = JSON.parse( fs.readFileSync( filepath ));

    for ( const item of data[ "timelineItems" ] ) {
        for ( const sample of item[ "samples" ] ) {

            const location = sample[ "location" ];
            if ( ! location ) continue;
            if ( location.longitude < 18 ) continue;
            location.isVisit = item.isVisit;
            samples.push( location );

            // const hacc = Math.round( location.horizontalAccuracy / 10 ) * 10;
            // const vacc = Math.round( location.verticalAccuracy / 10 ) * 10;
            // if ( ! ( hacc in haccs ) ) haccs[ hacc ] = 0;
            // if ( ! ( vacc in vaccs ) ) vaccs[ vacc ] = 0;
            // haccs[ hacc ] += 1;
            // vaccs[ vacc ] += 1;

        }
    }

}


// const accs = { ...haccs, ...vaccs };
// Object.keys( accs ).forEach( key => {
//     if ( accs[ key ] < 10 ) delete accs [key]; 
// });
// console.log( histogram( accs ) );

console.log( samples.length );