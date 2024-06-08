# Notes

## TimelineItem
- default
    - ids
        - `itemId`
        - `previousItemId`
        - `nextItemId`
    - timestamps
        - `startDate`
        - `endDate`
        - `lastSaved`
    - info
        - `isVisit`
        - `altitude`
        - `samples`
- stairs
    - `stepCount`
    - `floorsAscended`
    - `floorsDescended`
- activity
    - `activityTypeConfidenceScore`
    - `manualActivityType`
    - `uncertainActivityType`
- visit
    - `isVisit: true`  
    - `center`
    - `radius` 
- place
    - `place`
    - `placeId`
    - `manualPlace` 

## LocationSample
```
{
    "xyAcceleration" : 0.00490495511928086,
    "movingState" : "stationary",
    "lastSaved" : "2024-05-29T00:04:59Z",
    "secondsFromGMT" : 7200,
    "sampleId" : "516CFDAD-4052-44B2-BAED-4F401BBDCD2B",
    "location" : {
        "verticalAccuracy" : 4.713735390692462,
        "timestamp" : "2024-05-28T21:14:02Z",
        "latitude" : 47.505403865606475,
        "longitude" : 19.06738399971349,
        "altitude" : 135.71973117958805,
        "course" : 132.9038067465932,
        "speed" : 0,
        "horizontalAccuracy" : 9.138769148431637
    },
    "date" : "2024-05-28T21:14:02Z",
    "stepHz" : 0,
    "zAcceleration" : 0.012573473900708239,
    "recordingState" : "recording",
    "timelineItemId" : "DDC8C8D3-EC83-43E6-8CBC-A92AA47937B2",
    "courseVariance" : 1.1546319456101628e-14
}
```

- default
    - ids
        - `sampleId`
        - `timelineItemId`
    - timestamps
        - `date`
        - `lastSaved`
        - `secondsFromGMT`
    - info
        - `location`
        - `movingState`
        - `recordingState`
- stairs
    - `stepHz`
    - `xyAcceleration`
    - `zAcceleration`
- ?
    - `courseVariance`