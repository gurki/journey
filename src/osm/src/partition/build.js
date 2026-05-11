//
//  Partition-based pipeline.
//
//  Builds 5 disjoint print volumes in priority order:
//      buildings > streets > water > green > bare terrain.
//
//  The crucial difference from the legacy pipeline is that color regions
//  do not overlap in XY — they are computed as a 2D partition before any
//  extrusion or terrain draping. With no co-located top surfaces, the
//  z-fighting and MMU-ambiguity problems disappear by construction.
//

import { STATE as $ } from "../state.js";
import { fetchTilesForBounds } from "../../../mvt/index.js";
import * as PATH2 from "../cad/path2.js";
import * as util from "../../../arc/src/util.js";
import * as jscad from "@jscad/modeling";
import polygonClipping from "polygon-clipping";
import { tickLoading, updateLoading } from "../loading.js";
import { buildCapMesh, buildPrismMeshes } from "./mesh.js";

import * as THREE from "three";


//  Detail-config aware classification — mirrors build.js but folded down to 4 buckets.
const STREET_CLASSES = [
    "motorway", "motorway_link",
    "trunk", "trunk_link",
    "primary", "primary_link",
    "secondary", "secondary_link",
    "tertiary", "tertiary_link",
    "street", "street_limited"
];
const RAIL_CLASSES = [ "major_rail", "minor_rail", "service_rail" ];
const PATH_CLASSES = [ "pedestrian", "service", "track", "path" ];

const PARK_CLASSES = [ "park", "grass", "agriculture", "pitch", "cemetery" ];
const GREENERY_CLASSES = [ "scrub", "hedge", "wood", "national_park" ];
const STONE_CLASSES = [ "rock", "sand" ];
const PEDESTRIAN_POLY_CLASSES = [ "land" ];

const CLASS_WIDTHS = {
    motorway: 14, motorway_link: 9,
    trunk: 10,    trunk_link: 7,
    primary: 8,   primary_link: 6,
    secondary: 5.5, secondary_link: 4.5,
    tertiary: 4,    tertiary_link: 3.5,
    street: 2.8,    street_limited: 2.4,
    pedestrian: 3,  service: 2.5, track: 2, path: 1.2,
    major_rail: 2.2, minor_rail: 1.6, service_rail: 1.2,
};

const TYPE_WIDTHS = {
    steps: 1.5, corridor: 2.5, sidewalk: 1.2, crossing: 1.4,
    cycleway: 1.3, footway: 1, path: 1.1, bridleway: 1.6,
};


//  Mapbox sometimes ships building features with missing or zero height.
//  Assume two floors (ground + 1st) at ~3m each = 6m, so they print at
//  realistic small-house proportions instead of vanishing or being skipped.
const FALLBACK_FLOOR_HEIGHT_M = 3;
const FALLBACK_FLOOR_COUNT = 2;
const FALLBACK_BUILDING_HEIGHT_M = FALLBACK_FLOOR_HEIGHT_M * FALLBACK_FLOOR_COUNT;


function mmToWorld( mm ) {
    return mm * $.config.printScale / 1000;
}


function getDetailConfig() {
    return $.config.mapbox.detailOptions[ $.config.mapbox.detail ];
}


function getRoadWidth( props ) {
    const minWidth = 0.6 * $.config.printScale / 1000;
    if ( props.lane_count ) return props.lane_count * $.config.widths.propLane;
    if ( props.type in TYPE_WIDTHS ) return Math.max( TYPE_WIDTHS[ props.type ], minWidth );
    if ( props.class in CLASS_WIDTHS ) return Math.max( CLASS_WIDTHS[ props.class ], minWidth );
    return $.config.widths.base;
}


//
//  GeoJSON → polygon-clipping conversion helpers.
//
//  polygon-clipping format mirrors GeoJSON: a MultiPolygon is
//    [ polygon, polygon, ... ] where polygon = [ outerRing, ...holes ]
//    and ring = [ [x,y], [x,y], ... ].  We just need to project coords.
//


function projectRing( gpsRing ) {
    const out = new Array( gpsRing.length );
    for ( let i = 0; i < gpsRing.length; i++ ) {
        out[ i ] = util.ll2en( $.center, gpsRing[ i ] );
    }
    return out;
}


function projectPolygon( gpsPolygon ) {
    return gpsPolygon.map( projectRing );
}


function projectMultiPolygon( gpsCoords ) {
    return gpsCoords.map( projectPolygon );
}


function asMultiPolygon( feature ) {
    const t = feature.geometry.type;
    const c = feature.geometry.coordinates;
    if ( t === "Polygon" )      return [ projectPolygon( c ) ];
    if ( t === "MultiPolygon" ) return projectMultiPolygon( c );
    return null;
}


//
//  Road centerline expansion — reuse jscad's path2.expand to get a
//  buffered outline, then drop into polygon-clipping land for the rest.
//


function expandCenterlineToPolygon( feature, width ) {

    const detail = getDetailConfig();
    const path2s = PATH2.fromGeoJSON(
        feature,
        $.center,
        { simplifyTolerance: mmToWorld( detail.roadSimplifyMm ) }
    );

    const polygons = [];
    const halfWidth = width / 2;

    for ( const path2 of path2s ) {
        if ( path2.points.length < 2 ) continue;

        try {
            const expanded = jscad.expansions.expand(
                { delta: halfWidth, corners: "round", segments: $.config.terrain.roadExpansionSegments },
                path2
            );
            const ring = jscad.geometries.geom2.toPoints( expanded );
            if ( ring.length >= 3 ) polygons.push( [ ring ] );
        } catch ( err ) {
            //  jscad occasionally throws on degenerate / self-intersecting paths.
        }
    }

    return polygons;
}


//
//  Pass 1: collect per-color MultiPolygons.
//


function classifyAndCollect( features ) {

    const buckets = {
        buildings: [],
        streets:   [],
        water:     [],
        green:     [],
    };

    let skipped = 0;

    for ( const feature of features ) {

        const t = feature.geometry.type;
        if ( t === "Point" || t === "MultiPoint" ) { skipped++; continue; }

        const props = feature.properties;
        const layer = props.layerName;

        if ( layer === "building" ) {
            if ( props.extrude === "false" ) continue;
            const height = ( props.height > 0 ) ? props.height : FALLBACK_BUILDING_HEIGHT_M;
            const mp = asMultiPolygon( feature );
            if ( mp ) {
                for ( const poly of mp ) {
                    //  carry the per-feature height through; multi-part buildings share one height
                    poly.__height = height;
                    buckets.buildings.push( poly );
                }
            }
            continue;
        }

        if ( layer === "water" ) {
            const mp = asMultiPolygon( feature );
            if ( mp ) for ( const poly of mp ) buckets.water.push( poly );
            continue;
        }

        if ( layer === "road" ) {
            //  bridges & tunnels — skip, they aren't usable for a 2D partition
            if ( props.structure && props.structure !== "none" ) continue;
            if ( [ "service:drive_through", "service:driveway", "service:parking_aisle", "service:parking" ].includes( props.type ) ) continue;
            if ( [ "unclassified", "disused", "abandoned" ].includes( props.type ) ) continue;

            const isStreet = STREET_CLASSES.includes( props.class );
            const isRail   = RAIL_CLASSES.includes( props.class );
            const isPath   = PATH_CLASSES.includes( props.class );
            if ( ! isStreet && ! isRail && ! isPath ) continue;

            const detail = getDetailConfig();
            if ( isStreet && ! detail.roadClasses.includes( props.class ) ) continue;
            if ( isRail   && ! detail.railClasses.includes( props.class ) ) continue;
            if ( isPath   && ! detail.includePaths ) continue;

            if ( t === "Polygon" || t === "MultiPolygon" ) {
                const mp = asMultiPolygon( feature );
                if ( mp ) for ( const poly of mp ) buckets.streets.push( poly );
                continue;
            }

            if ( t === "LineString" || t === "MultiLineString" ) {
                const polys = expandCenterlineToPolygon( feature, getRoadWidth( props ) );
                for ( const poly of polys ) buckets.streets.push( poly );
                continue;
            }

            continue;
        }

        if ( [ "landuse", "structure", "landuse_overlay" ].includes( layer ) ) {
            if ( [ "LineString", "MultiLineString" ].includes( t ) ) continue;

            const cls = props.class;
            let bucket = null;
            if ( PARK_CLASSES.includes( cls ) )            bucket = "green";
            else if ( GREENERY_CLASSES.includes( cls ) )   bucket = "green";
            else if ( STONE_CLASSES.includes( cls ) )      bucket = "green";   //  fold stone into greenery for 4-color print
            else if ( PEDESTRIAN_POLY_CLASSES.includes( cls ) ) bucket = "streets"; //  pedestrian plazas read as paving

            if ( ! bucket ) continue;

            const mp = asMultiPolygon( feature );
            if ( mp ) for ( const poly of mp ) buckets[ bucket ].push( poly );
            continue;
        }

        skipped++;

    }

    return { buckets, skipped };
}


//
//  Robust union of many GeoJSON-shaped polygons via polygon-clipping.
//
//  We pass each polygon as its own argument so the library treats the
//  inputs uniformly.  Splitting into chunks keeps argument arrays sane
//  for very large input counts (10k+ road segments after expansion).
//


function unionMany( polygons ) {
    if ( polygons.length === 0 ) return [];
    if ( polygons.length === 1 ) return [ polygons[ 0 ] ];

    const CHUNK = 256;
    let acc = polygonClipping.union( polygons[ 0 ] );

    for ( let i = 1; i < polygons.length; i += CHUNK ) {
        const slice = polygons.slice( i, i + CHUNK );
        try {
            acc = polygonClipping.union( acc, ...slice );
        } catch ( err ) {
            //  fall back to per-poly merges; one bad ring shouldn't take down the lot
            for ( const p of slice ) {
                try { acc = polygonClipping.union( acc, p ); } catch {}
            }
        }
    }

    return acc;
}


function safeDifference( a, ...bs ) {
    if ( ! a || a.length === 0 ) return [];
    const filtered = bs.filter( b => b && b.length > 0 );
    if ( filtered.length === 0 ) return a;
    try {
        return polygonClipping.difference( a, ...filtered );
    } catch ( err ) {
        let acc = a;
        for ( const b of filtered ) {
            try { acc = polygonClipping.difference( acc, b ); } catch {}
        }
        return acc;
    }
}


function safeIntersection( a, b ) {
    if ( ! a || a.length === 0 ) return [];
    if ( ! b || b.length === 0 ) return [];
    try {
        return polygonClipping.intersection( a, b );
    } catch ( err ) {
        return [];
    }
}


function tileMultiPolygon() {
    const w = $.worldTileSize.width  / 2;
    const h = $.worldTileSize.height / 2;
    const inset = mmToWorld( $.config.partition.tileInsetMm );
    const x0 = -w + inset, x1 = w - inset;
    const z0 = -h + inset, z1 = h - inset;
    //  CCW outer ring in (x,y) — note we use Y=y for now, mapped to Z in mesh stage
    return [ [ [ [ x0, z0 ], [ x1, z0 ], [ x1, z1 ], [ x0, z1 ], [ x0, z0 ] ] ] ];
}


//
//  Main entry.
//


export async function buildPartition() {

    console.time( "⏱ partition pipeline" );
    console.log( `🧭 partition pipeline, detail "${$.config.mapbox.detail}"` );

    //  1. fetch (same as legacy)
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const zoom = $.config.mapbox.vectorTileZoom;
    updateLoading( "Fetching map data", `Mapbox Streets vector tiles z${zoom}`, 36 );
    const tiles = await fetchTilesForBounds(
        $.worldOuterBounds, zoom,
        "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf",
        token
    );
    const features = tiles.flat();
    $.data = features;
    console.log( `🧾 loaded ${features.length.toLocaleString()} vector features` );


    //  2. classify + collect raw polygons per color
    await tickLoading( "Building partition", "Classifying features into 4 print colors...", 44 );
    console.time( "⏱ classify" );
    const { buckets, skipped } = classifyAndCollect( features );
    console.timeEnd( "⏱ classify" );

    const buildingHeights = buckets.buildings.map( p => p.__height );
    for ( const p of buckets.buildings ) delete p.__height;

    console.log(
        `   buildings:${buckets.buildings.length}  streets:${buckets.streets.length}  ` +
        `water:${buckets.water.length}  green:${buckets.green.length}  skipped:${skipped}`
    );


    //  3. union each bucket into a single MultiPolygon
    await tickLoading( "Building partition", "Unioning per-color polygons...", 55 );
    console.time( "⏱ unions" );
    const tile = tileMultiPolygon();

    //  buildings stay individual so we can carry per-building heights through.
    //  for partition math we still need their union footprint.
    const buildingsFootprint = unionMany( buckets.buildings );
    const streetsRaw         = unionMany( buckets.streets );
    const waterRaw           = unionMany( buckets.water );
    const greenRaw           = unionMany( buckets.green );
    console.timeEnd( "⏱ unions" );


    //  4. priority-ordered subtractions = the disjoint partition
    await tickLoading( "Building partition", "Computing disjoint color regions...", 66 );
    console.time( "⏱ partition" );
    const streets   = safeIntersection( safeDifference( streetsRaw, buildingsFootprint ), tile );
    const water     = safeIntersection( safeDifference( waterRaw,   buildingsFootprint, streetsRaw ), tile );
    const green     = safeIntersection(
        safeDifference( greenRaw, buildingsFootprint, streetsRaw, waterRaw ),
        tile
    );

    //  clip each building footprint to the tile, preserving per-feature height.
    //  one input building may split into 0, 1, or several output polygons.
    const clippedBuildings = [];
    const clippedHeights = [];
    for ( let i = 0; i < buckets.buildings.length; i++ ) {
        const clipped = safeIntersection( [ buckets.buildings[ i ] ], tile );
        for ( const poly of clipped ) {
            clippedBuildings.push( poly );
            clippedHeights.push( buildingHeights[ i ] );
        }
    }
    console.timeEnd( "⏱ partition" );

    const regionRings = mp => mp.reduce( ( a, p ) => a + p.length, 0 );
    console.log(
        `   regions  buildings:${clippedBuildings.length}  ` +
        `streets:${streets.length}p/${regionRings( streets )}r  ` +
        `water:${water.length}p/${regionRings( water )}r  ` +
        `green:${green.length}p/${regionRings( green )}r`
    );


    //  5. terrain core (slab) — reuse the existing terrain mesh if it was built,
    //     otherwise build a flat bezel-sized base plate.
    await tickLoading( "Building partition", "Composing terrain base & caps...", 75 );
    if ( ! $.terrain ) {
        const groundHeight = $.heights.ground;
        const groundGeom = new THREE.BoxGeometry(
            $.worldBezelSize.width, groundHeight, $.worldBezelSize.height
        );
        const ground = new THREE.Mesh( groundGeom, $.materials.ground );
        ground.name = "base";
        ground.translateY( - groundHeight / 2 );
        $.city.add( ground );
    }


    //  6. build the 4 cap meshes and the building prisms.
    //     all geometry is produced pre-draped so drapeCityOnTerrain is a no-op.
    console.time( "⏱ meshes" );

    const offsets = $.config.partition.capOffsetsMm;
    const maxEdge   = mmToWorld( $.config.partition.maxEdgeMm );

    const capSpecs = [
        { name: "water",  mp: water,   material: $.materials.water,  topOffset: mmToWorld( offsets.water   ) },
        { name: "green",  mp: green,   material: $.materials.parks,  topOffset: mmToWorld( offsets.green   ) },
        { name: "streets",mp: streets, material: $.materials.street, topOffset: mmToWorld( offsets.streets ) },
    ];

    for ( const spec of capSpecs ) {
        if ( spec.mp.length === 0 ) continue;

        const group = new THREE.Group();
        group.name = spec.name;

        const mesh = buildCapMesh( spec.mp, {
            terrain: $.terrain,
            topOffset: spec.topOffset,
            maxEdge,
            material: spec.material,
        });
        if ( mesh ) {
            mesh.userData.type = spec.name;
            mesh.userData.terrainPlaced = true;
            group.add( mesh );
        }
        $.city.add( group );
    }

    if ( clippedBuildings.length > 0 ) {
        const group = new THREE.Group();
        group.name = "buildings";
        const meshes = buildPrismMeshes( clippedBuildings, clippedHeights, {
            terrain: $.terrain,
            material: $.materials.buildings,
            sinkBelowTerrain: mmToWorld( $.config.partition.buildingFootSinkMm ),
            //  printable base floor — both the terrain slab and the no-terrain box
            //  bottom out at -$.heights.ground, so clamping prism feet here keeps
            //  building walls from punching through the bottom of the print.
            slabBottomY: -$.heights.ground,
            maxEdge,
        });
        for ( const mesh of meshes ) {
            mesh.userData.type = "buildings";
            mesh.userData.terrainPlaced = true;
            group.add( mesh );
        }
        $.city.add( group );
    }

    console.timeEnd( "⏱ meshes" );
    console.timeEnd( "⏱ partition pipeline" );

}
