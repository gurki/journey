import fs from "bun:fs";
import path from "bun:path";


function unique(list1, list2) {
    const set1 = new Set(list1);
    const set2 = new Set(list2);

    const uniqueA = [...set1].filter(item => !set2.has(item));
    const uniqueB = [...set2].filter(item => !set1.has(item));
    const common = [...set2].filter(item => set1.has(item));

    return {
        common,
        uniqueA,
        uniqueB
    };
}

const directory = "../../data/arc/";

let keyMap = {};

for ( const filename of fs.readdirSync( directory ) ) {
        
    const filepath = path.join( directory, filename );
    console.log( `reading ${filepath} ...` );

    const data = JSON.parse( fs.readFileSync( filepath ));
    const timeline = data[ "timelineItems" ];

    for ( const item of timeline ) {
        const samples = item[ "samples" ];
        for ( const sample of samples ) {
            const keys = Object.keys( sample ).sort();
            const hash = Bun.hash( keys ).toString( 16 );
            keyMap[ hash ] = keys;    
        }
    }

}


console.log( keyMap );

const keys = Object.values( keyMap );
console.log( unique( keys[0], keys[1] ) );
console.log();

console.log( unique( keys[1], keys[2] ) );
console.log();

console.log( unique( keys[2], keys[0] ) );
console.log();