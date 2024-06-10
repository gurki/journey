# Devlog


## 24w24-1
_print settings and clipping_

<img src="docs/tweakpane-large.png" height=320>

- some more brainstorming on settings
- attempting clipping using custom csg
- lots of artifacts and non-manifold edges
- found three-bvh-csg, it's fabulous
- clipping works great
- refatoring a bit
- live on github


## 24w23-7
_overpass, threejs and first stl_

<img src="docs/osm-progress/screencapture-localhost-5173-2024-06-09-23_40_09.png" height=320> 

- working heroes journey demo
- add time window and fade

### overpass
- start overpass api queries
- gain basic understanding of OQL
- long way of figuring out relevant tags
- learned that the overpass fetch result is json
- can further be processed to geojson with geometry

### threejs
- constructing the first geometries is super fun
- start from shape, extrude, profit
- implement for different geometry types (i.e. polygon multipolygon, linestring)
- spent a long while to debug extrusion and understand how it works
- turns out it assumes z-extrusion, so construct everything in xy, extrude in z, then rotate
- realized that the final result needs to be clipped for size
- found csg libraries out there
- implement ALL the things!
- successfully do first STL export

### print settings
- looking into 3d print settings
- inspiration from touch mapper
- 3 (1-3) layers base
- 4 (1-7) layers streets & rails
- 3 (1-10) layers walkways
- 7 (1-17) layers buildings
- still water with wavey things
- flowing water flat


## 24w23-6
_first print, new idea, arc and brainstorming_

<img src="docs/touch-mapper-print.png" height=320>

- printed touchmapper sample, it's awesome
- idea: put it in front of a led matrix and draw route on there!
- could even put a screen next to it to display high-res content

### arc
- reverse engineering arc json format
- use hashes and set diffs to identify and group timeline item entries
- identify 50m gps accuracy as reasonable cutoff [arc/results/accuracy.txt]()
- start heroes journey viz with p5js

### brainstorm
- brainstormed options with friends
- tactile variant looks and feels great
- backlight with static drawn / paper printed path instead of led matrix
- printed path on top
- no water color if other colors are used
- little flags, can connect strings with polaroid pics


## 24w23-5
_blender, touch mapper and overpass_

<img src="docs/touch-mapper.png" height=320>

- blender gmaps 3d tiles with blosm
- pretty rough, and hard to make printable
- osm tiles cleaner, but still non-trivial to make printable
- discovered [touch-mapper.org]()
- through that discovered osm overpass api
- did some first designs and basic test
- looked into arc mini data and exported recent samples
- excited for the next day


## Precursor
- hongkong trip 2023-10
- [3d print from makerverse](https://makerworld.com/en/models/102151)
- [fog of world](https://fogofworld.app/en/)
- idea: print visited areas on top of 3d map as little memoire