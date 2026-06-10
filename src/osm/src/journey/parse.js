//
//  Arc journey JSON → cleaned GPS path.
//
//  Pipeline:
//    1. flatten timelineItems[*].samples[*] into one list
//    2. keep only "recording" samples with usable accuracy
//    3. sort chronologically (samples within an item are already sorted, but
//       items can overlap across day boundaries, so sort globally)
//    4. dedupe near-coincident points (visits collapse to one)
//    5. Douglas-Peucker simplify to keep ribbon vertex count reasonable
//


const DEFAULTS = {
    maxAccuracyMeters: 50,    //  drop samples whose horizontalAccuracy exceeds this
    minSpacingMeters:  3,     //  drop adjacent samples closer than this
    simplifyMeters:    4,     //  Douglas-Peucker tolerance
    timeGapBreakSeconds: 600, //  insert a break in the path when consecutive samples
                              //  are this many seconds apart (e.g. across days, gaps)
};


export function parseArcJourney( raw, options = {} ) {
    const opts = { ...DEFAULTS, ...options };

    const items = Array.isArray( raw?.timelineItems ) ? raw.timelineItems : [];

    const points = [];
    for ( const item of items ) {
        const samples = Array.isArray( item.samples ) ? item.samples : [];
        for ( const s of samples ) {
            if ( s.recordingState && s.recordingState !== "recording" ) continue;
            const loc = s.location;
            if ( ! loc ) continue;
            if ( typeof loc.latitude !== "number" || typeof loc.longitude !== "number" ) continue;
            if ( typeof loc.horizontalAccuracy === "number" && loc.horizontalAccuracy > opts.maxAccuracyMeters ) continue;

            points.push({
                lon: loc.longitude,
                lat: loc.latitude,
                alt: typeof loc.altitude === "number" ? loc.altitude : null,
                t:   loc.timestamp ?? s.date ?? null,
                speed: typeof loc.speed === "number" ? loc.speed : null,
                moving: s.movingState ?? null,
            });
        }
    }

    if ( points.length < 2 ) {
        return { points: [], bbox: null, raw: points.length };
    }

    //  global chronological sort — items may interleave at day boundaries
    points.sort( ( a, b ) => {
        if ( a.t && b.t ) return a.t < b.t ? -1 : a.t > b.t ? 1 : 0;
        return 0;
    });

    //  dedupe by minimum spacing (in meters)
    const deduped = [];
    for ( const p of points ) {
        const prev = deduped[ deduped.length - 1 ];
        if ( ! prev || haversineMeters( prev, p ) >= opts.minSpacingMeters ) {
            deduped.push( p );
        }
    }

    //  Douglas-Peucker on lon/lat using a meter-tolerance threshold
    const simplified = simplifyDP( deduped, opts.simplifyMeters );

    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
    for ( const p of simplified ) {
        if ( p.lon < xmin ) xmin = p.lon;
        if ( p.lon > xmax ) xmax = p.lon;
        if ( p.lat < ymin ) ymin = p.lat;
        if ( p.lat > ymax ) ymax = p.lat;
    }

    return {
        points: simplified,
        bbox: { xmin, ymin, xmax, ymax },
        raw: points.length,
    };
}


//
//  Combine multiple parsed journeys into one path.
//
//  Points are sorted chronologically across files and a `null` break is
//  inserted whenever consecutive samples are further apart in time than
//  `timeGapBreakSeconds`.  Downstream code splits the ribbon at nulls,
//  so days / sessions stay visually distinct rather than bridging through
//  empty space.
//


export function mergeJourneys( journeys, options = {} ) {
    const opts = { ...DEFAULTS, ...options };
    const all = [];

    for ( const j of journeys ) {
        if ( ! j || ! Array.isArray( j.points ) ) continue;
        for ( const p of j.points ) all.push( p );
    }

    if ( all.length === 0 ) {
        return { points: [], bbox: null, raw: 0, sourceCount: journeys.length };
    }

    all.sort( ( a, b ) => {
        if ( a.t && b.t ) return a.t < b.t ? -1 : a.t > b.t ? 1 : 0;
        return 0;
    });

    const out = [];
    let lastT = null;
    for ( const p of all ) {
        if ( lastT !== null && p.t ) {
            const dt = ( new Date( p.t ).getTime() - lastT ) / 1000;
            if ( dt > opts.timeGapBreakSeconds ) out.push( null );
        }
        out.push( p );
        lastT = p.t ? new Date( p.t ).getTime() : lastT;
    }

    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
    let total = 0;
    for ( const p of out ) {
        if ( ! p ) continue;
        total += 1;
        if ( p.lon < xmin ) xmin = p.lon;
        if ( p.lon > xmax ) xmax = p.lon;
        if ( p.lat < ymin ) ymin = p.lat;
        if ( p.lat > ymax ) ymax = p.lat;
    }

    return {
        points: out,
        bbox: { xmin, ymin, xmax, ymax },
        raw: journeys.reduce( ( a, j ) => a + ( j?.raw ?? 0 ), 0 ),
        sourceCount: journeys.length,
    };
}


//  Equirectangular distance — fine at city scales, much cheaper than haversine.
function haversineMeters( a, b ) {
    const R = 6371000;
    const toRad = Math.PI / 180;
    const dLat = ( b.lat - a.lat ) * toRad;
    const dLon = ( b.lon - a.lon ) * toRad;
    const mLat = ( a.lat + b.lat ) * 0.5 * toRad;
    const x = dLon * Math.cos( mLat );
    return Math.hypot( x, dLat ) * R;
}


//  Douglas-Peucker on a polyline of {lon, lat} points; tolerance in meters.
//  Distance is the perpendicular distance from each point to the start-end
//  chord, computed in meters via equirectangular projection.
function simplifyDP( pts, toleranceMeters ) {
    if ( pts.length < 3 ) return pts.slice();

    const keep = new Uint8Array( pts.length );
    keep[ 0 ] = 1;
    keep[ pts.length - 1 ] = 1;

    const stack = [ [ 0, pts.length - 1 ] ];
    while ( stack.length > 0 ) {
        const [ i0, i1 ] = stack.pop();
        let maxDist = 0;
        let maxIdx = -1;
        for ( let i = i0 + 1; i < i1; i++ ) {
            const d = perpDistanceMeters( pts[ i ], pts[ i0 ], pts[ i1 ] );
            if ( d > maxDist ) { maxDist = d; maxIdx = i; }
        }
        if ( maxDist > toleranceMeters && maxIdx > 0 ) {
            keep[ maxIdx ] = 1;
            stack.push( [ i0, maxIdx ] );
            stack.push( [ maxIdx, i1 ] );
        }
    }

    const out = [];
    for ( let i = 0; i < pts.length; i++ ) if ( keep[ i ] ) out.push( pts[ i ] );
    return out;
}


function perpDistanceMeters( p, a, b ) {
    //  project into local meters relative to a, equirectangular
    const toRad = Math.PI / 180;
    const cosLat = Math.cos( a.lat * toRad );
    const ax = 0, ay = 0;
    const bx = ( b.lon - a.lon ) * cosLat;
    const by = ( b.lat - a.lat );
    const px = ( p.lon - a.lon ) * cosLat;
    const py = ( p.lat - a.lat );

    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if ( lenSq === 0 ) {
        return Math.hypot( px, py ) * ( Math.PI / 180 ) * 6371000;
    }
    const t = ( ( px - ax ) * dx + ( py - ay ) * dy ) / lenSq;
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return Math.hypot( px - cx, py - cy ) * ( Math.PI / 180 ) * 6371000;
}
