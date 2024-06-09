# Devlog

## 24w23-7
- working heroes journey demo
- start overpass api queries
- gain basic understanding of OQL
- long way of figuring out relevant tags
- learned that the overpass fetch result is json, and can further be processed to geojson with geometry
- constructing the first geometries is super fun
- start from shape, extrude, profit
- implement for different geometry types (i.e. polygon multipolygon, linestring)
- spent a long while to debug extrusion and understand how it works
- turns out it assumes z-extrusion, so construct everything in xy, extrude in z, then rotate
- realized that the final result needs to be clipped for size
- found csg libraries out there


## 24w23-6
first print, new idea, arc and brainstorming

<img src="docs/touch-mapper-print.png" height=320>

- printed touchmapper sample, it's awesome
- idea: put it in front of a led matrix and draw route on there!
- could even put a screen next to it to display high-res content
- reverse engineering arc json format
- use hashes and set diffs to identify and group timeline item entries
- identify 50m gps accuracy as reasonable cutoff [arc/results/accuracy.txt]()
- start heroes journey viz with p5js
- brainstormed options with friends
    - tactile variant looks and feels great
    - backlight with static drawn / paper printed path instead of led matrix
    - printed path on top
    - no water color if other colors are used
    - little flags, can connect strings with polaroid pics


## 24w23-5
blender, touch mapper and overpass

<img src="docs/touch-mapper.png" height=320>

- blender gmaps 3d tiles with blosm
- pretty rough, and hard to make printable
- osm tiles cleaner, but still non-trivial to make printable
- discovered [touch-mapper.org]()
- through that discovered osm overpass api
- did some first designs and basic test
- looked into arc mini data and exported recent samples
- excited for the next day