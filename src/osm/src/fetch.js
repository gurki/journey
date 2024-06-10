import osmtogeojson from "osmtogeojson";


export async function fetchJson( bounds ) {

    console.time( "⏱ fetchJson" );

    const overpassQuery = `
        [bbox:${bounds.ymin},${bounds.xmin},${bounds.ymax},${bounds.xmax}]
        [out:json];
        (
            nwr["building"];  
            nwr["highway"]["highway"!~"bus_stop|crossing|elevator|give_way|milestone|proposed|speed_camera|speed_display|stop|street_lamp|traffic_mirror|traffic_signals"];
            nwr["railway"~"^light_rail$|^rail$|^tram$|^narrow_gauge$|^funicular$|^disused$"];   	
            nwr["natural"="water"];
            nwr["natural"~"^bare_rock$|^scrub$|^shrub$|^shrubbery$|^tree_group$|^wood$"];
            nwr["leisure"~"^park$|^garden$"];
        );
        out body;
        >;
        out skel qt;
    `;

    const json = await fetch(
        "https://overpass-api.de/api/interpreter",
        {
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ data: overpassQuery })
        },
    ).then( ( data )=> {
        return data.json();
    });

    console.timeEnd( "⏱ fetchJson" );
    return json;

}


export async function fetchGeojson( bounds ) {

    console.log( "🌍 fetching from overpass ..." );
    const json = await fetchJson( bounds );
    
    console.time( "⏱ convertJson" );
    console.log( "⏳ converting to geojson ..." );
    const geojson = osmtogeojson( json );
    console.timeEnd( "⏱ convertJson" );

    return geojson;

}


// const bounds = { ymin: 47.5089, xmin: 19.0722, ymax: 47.5190, xmax: 19.0867 };
// console.log( JSON.stringify( await fetchGeojson( bounds ), null, 2 ) );


export function inspectTags( result ) {

    const query = new Set([
        "railway",
        "building",
        "highway",
        "leisure",
        "waterway",
        "water",
        "natural",
        "landuse"
    ]);

    let stats = {};
    for ( const key of query ) stats[ key ] = new Set();

    let tags = new Set();

    for ( const item of result[ "elements" ] ) {
        if ( ! item ) continue;
        if ( ! ( "tags" in item ) ) continue;
        for ( const tag in item.tags ) {
            tags.add( tag );
            if ( ! query.has( tag ) ) continue;
            stats[ tag ].add( item.tags[ tag ] );
        }
    }

    for ( const key in stats ) {
        stats[ key ] = [ ...stats[ key ] ].sort();
    }

    // console.log( JSON.stringify( [ ...tags ].sort(), null, 2 ) );
    console.log( JSON.stringify( stats, null, 2 ) );

}