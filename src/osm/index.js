const bbox = "30.626917110746,-96.348809105664,30.634468750236,-96.339893442898";

const overpassQuery = `
    [out:json]
    [timeout:90]
    ;
    (
        way( ${bbox} );
    );
`;
console.log( new URLSearchParams({ data: overpassQuery }) )

const result = await fetch(
    "https://overpass-api.de/api/interpreter",
    {
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ data: overpassQuery })
    },
  ).then( ( data )=> {
    console.log( data );
    return data.json();
});
 

console.log(JSON.stringify(result , null, 2))