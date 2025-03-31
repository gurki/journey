<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const props = defineProps({
    accessToken: {
        type: String,
        required: true
    }
});

const emit = defineEmits(['update:selection']);

// Map refs
const mapContainer = ref(null);
const map = ref(null);
const originMarker = ref(null);

// Selection state
const origin = ref(null);
const selection = ref({
    bounds: null,
    center: null,
    tilesConfig: {
        rows: 1,
        columns: 1
    }
});

// Tile configuration
const tilesConfig = ref({
    rows: 1,
    columns: 1,
    // Physical tile size in mm
    physicalSize: {
        width: 150, // mm
        height: 150  // mm
    }
});

// Custom scale value that can be set manually
const customScale = ref(10000); // Default 1:10000 scale

// Dynamic dimension calculation based on zoom
const currentZoom = ref(13); // default zoom level
const metersPerPixelAtOrigin = computed(() => {
    // Approximate meters per pixel calculation
    // 156543.03392 * Math.cos(latitudeInRadians) / (2 ^ zoomLevel)
    if (!origin.value) return 1;
    
    // At zoom level 0, one pixel = 156543.03392 meters at the equator
    const equatorMetersPerPixel = 156543.03392;
    // Adjust for latitude (maps get distorted toward the poles)
    const latAdjustment = Math.cos(origin.value.lat * Math.PI / 180);
    // Adjust for zoom level
    return equatorMetersPerPixel * latAdjustment / Math.pow(2, currentZoom.value);
});

// Calculated dimension in meters based on physical size and constrained scale
const tileSizeInMeters = computed(() => {
    if (!map.value || !origin.value) return { width: 0, height: 0 };
    
    // Physical size in mm
    const { width: physicalWidthMm, height: physicalHeightMm } = tilesConfig.value.physicalSize;
    
    // Convert mm to meters
    const physicalWidthMeters = physicalWidthMm / 1000;
    const physicalHeightMeters = physicalHeightMm / 1000;
    
    // Scale to real-world dimensions
    // If scale is 1:10000, then 1mm on print = 10 meters in real world
    const scale = mapScale.value;
    
    // Calculate dimensions
    const width = physicalWidthMeters * scale;
    const height = physicalHeightMeters * scale;
    
    return { width, height };
});

// Total grid size in meters
const totalGridSize = computed(() => {
    return {
        width: tileSizeInMeters.value.width * tilesConfig.value.columns,
        height: tileSizeInMeters.value.height * tilesConfig.value.rows
    };
});

// Total physical size in millimeters
const totalPhysicalSize = computed(() => {
    return {
        width: tilesConfig.value.physicalSize.width * tilesConfig.value.columns,
        height: tilesConfig.value.physicalSize.height * tilesConfig.value.rows
    };
});

// Calculate recommended map scale based on current zoom level
const recommendedScale = computed(() => {
    if (!map.value || !origin.value) return 10000; // Default 1:10000 scale
    
    // Get current zoom level
    const zoom = map.value.getZoom();
    
    // Base scale calculation using zoom level
    // At zoom 0, entire world fits in 512px, scale around 1:250,000,000
    // Each zoom level doubles the scale
    const baseScale = 250000000 / Math.pow(2, zoom);
    
    // Adjust for latitude (maps get distorted toward the poles)
    const latAdjust = Math.cos(origin.value.lat * Math.PI / 180);
    let scale = baseScale * latAdjust;
    
    // Add adjustment based on physical tile size to make scale feel more natural
    // For standard 150mm square tiles, we want scale to be comfortable
    const standardTileSize = 150; // mm
    const avgTileSize = (tilesConfig.value.physicalSize.width + tilesConfig.value.physicalSize.height) / 2;
    const sizeAdjust = standardTileSize / avgTileSize;
    
    scale = scale * sizeAdjust;
    
    // Round to a nice number (to nearest 500 for lower scales, 5000 for higher scales)
    if (scale < 10000) {
        return Math.round(scale / 500) * 500;
    } else {
        return Math.round(scale / 5000) * 5000;
    }
});

// Actual scale to use - either custom or recommended
const mapScale = computed(() => {
    return customScale.value;
});

// Handle map click to set origin
function handleMapClick(e) {
    // Set the origin point
    origin.value = {
        lng: e.lngLat.lng,
        lat: e.lngLat.lat
    };
    
    // Update or create the marker
    if (!originMarker.value) {
        // Create a marker element
        const el = document.createElement('div');
        el.className = 'origin-marker';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#4caf50';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        el.style.cursor = 'move';
        
        // Create the marker with draggable option
        originMarker.value = new mapboxgl.Marker({
            element: el,
            draggable: true
        })
            .setLngLat([origin.value.lng, origin.value.lat])
            .addTo(map.value);
            
        // Add drag listeners for real-time updates
        originMarker.value.on('drag', handleMarkerDrag);
        originMarker.value.on('dragend', handleMarkerDragEnd);
    } else {
        // Update existing marker
        originMarker.value.setLngLat([origin.value.lng, origin.value.lat]);
    }
    
    // Simply update the selection and draw the grid at current zoom level
    updateSelectionBounds();
}

// Handle marker drag event for real-time updates
function handleMarkerDrag() {
    // Get the marker's current position
    const lngLat = originMarker.value.getLngLat();
    
    // Update the origin
    origin.value = {
        lng: lngLat.lng,
        lat: lngLat.lat
    };
    
    // Update selection bounds
    updateSelectionBounds();
}

// Handle marker drag end event
function handleMarkerDragEnd() {
    // Use the same handler as drag for consistency
    handleMarkerDrag();
}

// Update selection bounds based on origin, zoom, and tile settings
function updateSelectionBounds() {
    if (!map.value || !origin.value) return;
    
    // Get current map center and calculate bounds
    const bounds = calculateGridBounds();
    
    // Update selection data
    selection.value = {
        bounds,
        center: origin.value,
        tilesConfig: tilesConfig.value,
        scale: mapScale.value
    };
    
    // Draw the grid
    drawTileGrid();
    
    // Emit updated selection
    emit('update:selection', selection.value);
}

// Calculate the bounds of the entire grid based on origin and tile dimensions
function calculateGridBounds() {
    if (!map.value || !origin.value) return null;
    
    // Get the origin in pixel coordinates
    const originPx = map.value.project([origin.value.lng, origin.value.lat]);
    
    // Calculate the total grid dimensions in real world meters
    const totalWidthMeters = tileSizeInMeters.value.width * tilesConfig.value.columns;
    const totalHeightMeters = tileSizeInMeters.value.height * tilesConfig.value.rows;
    
    // Convert real world meters to pixels at current zoom level
    const metersToPixels = 1 / metersPerPixelAtOrigin.value;
    const gridWidthPx = totalWidthMeters * metersToPixels;
    const gridHeightPx = totalHeightMeters * metersToPixels;
    
    // Calculate the corners based on origin point (centered grid)
    const halfWidth = gridWidthPx / 2;
    const halfHeight = gridHeightPx / 2;
    
    // Get the bounds in lng/lat coordinates
    const nw = map.value.unproject([originPx.x - halfWidth, originPx.y - halfHeight]);
    const se = map.value.unproject([originPx.x + halfWidth, originPx.y + halfHeight]);
    
    return {
        xmin: nw.lng,
        ymin: se.lat, // bottom is south (min latitude)
        xmax: se.lng,
        ymax: nw.lat  // top is north (max latitude)
    };
}

// Function to clear the selection and grid
function clearSelection() {
    if (originMarker.value) {
        originMarker.value.remove();
        originMarker.value = null;
    }
    
    origin.value = null;
    selection.value.bounds = null;
    
    // Remove existing grid lines
    const existingOverlays = document.querySelectorAll('.tile-overlay');
    existingOverlays.forEach(overlay => overlay.remove());
    
    emit('update:selection', selection.value);
}

// Function to fit the entire grid into the current view
function fitGridToView() {
    if (!selection.value.bounds || !map.value) return;
    
    const bounds = selection.value.bounds;
    
    // Convert bounds to Mapbox's LngLatBounds format
    const mapboxBounds = new mapboxgl.LngLatBounds(
        [bounds.xmin, bounds.ymin],
        [bounds.xmax, bounds.ymax]
    );
    
    // Add padding around the bounds for better visualization
    map.value.fitBounds(mapboxBounds, {
        padding: 40,
        animate: true,
        duration: 500
    });
}

// Initialize the map
onMounted(() => {
    mapboxgl.accessToken = props.accessToken;
    
    map.value = new mapboxgl.Map({
        container: mapContainer.value,
        style: 'mapbox://styles/mapbox/dark-v11', // Dark theme for better visibility
        center: [19.057, 47.499], // Budapest by default
        zoom: 13
    });
    
    // Wait for map to load before adding event listeners
    map.value.on('load', () => {
        console.log("Map loaded, initializing event handlers");
        
        // Handle click event to set origin
        map.value.on('click', handleMapClick);
        
        // Track zoom changes
        map.value.on('zoom', () => {
            currentZoom.value = map.value.getZoom();
            if (origin.value) {
                updateSelectionBounds();
            }
        });
        
        // Sync recommended scale to custom scale initially
        watch(recommendedScale, (newScale) => {
            // Only update if user hasn't manually changed the scale
            if (!origin.value) {
                customScale.value = newScale;
            }
        });
        
        // Track map move events
        map.value.on('move', () => {
            if (origin.value) {
                drawTileGrid();
            }
        });
    });
    
    // Add navigation controls
    map.value.addControl(new mapboxgl.NavigationControl(), 'top-right');
});

// Watch for changes in tile configuration
watch(tilesConfig, () => {
    if (origin.value) {
        updateSelectionBounds();
    }
}, { deep: true });

// Function to draw the tile grid based on origin and dimensions
function drawTileGrid() {
    try {
        // Remove existing overlays
        const existingOverlays = document.querySelectorAll('.tile-overlay');
        existingOverlays.forEach(overlay => overlay.remove());
        
        if (!selection.value.bounds || !map.value || !origin.value) return;
        
        // Get the current visible map bounds to check if grid is visible
        const visibleBounds = map.value.getBounds();
        const bounds = selection.value.bounds;
        
        // Check if origin is in view - if not, no need to draw
        if (!visibleBounds.contains([origin.value.lng, origin.value.lat])) {
            console.log("Origin point is out of view, not drawing grid");
            return;
        }
        
        const { rows, columns } = tilesConfig.value;
        
        const latDiff = bounds.ymax - bounds.ymin;
        const lngDiff = bounds.xmax - bounds.xmin;
        
        const rowHeight = latDiff / rows;
        const colWidth = lngDiff / columns;
        
        const mapDiv = map.value.getContainer();
        
        // Log info for debugging
        console.log(`Drawing grid: ${rows}x${columns} tiles`);
        console.log(`Grid bounds: [${bounds.xmin}, ${bounds.ymin}] to [${bounds.xmax}, ${bounds.ymax}]`);
        console.log(`Visible bounds: [${visibleBounds.getWest()}, ${visibleBounds.getSouth()}] to [${visibleBounds.getEast()}, ${visibleBounds.getNorth()}]`);
        
        // Create tile overlays
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                // Calculate tile bounds
                const tileBounds = {
                    xmin: bounds.xmin + (c * colWidth),
                    xmax: bounds.xmin + ((c + 1) * colWidth),
                    ymin: bounds.ymin + (r * rowHeight),
                    ymax: bounds.ymin + ((r + 1) * rowHeight)
                };
                
                // Skip tiles completely outside the visible area
                if (tileBounds.xmax < visibleBounds.getWest() || 
                    tileBounds.xmin > visibleBounds.getEast() ||
                    tileBounds.ymax < visibleBounds.getSouth() ||
                    tileBounds.ymin > visibleBounds.getNorth()) {
                    continue;
                }
                
                // Convert to pixel coordinates
                const nw = map.value.project([tileBounds.xmin, tileBounds.ymax]);
                const se = map.value.project([tileBounds.xmax, tileBounds.ymin]);
                
                // Create the overlay element
                const overlay = document.createElement('div');
                overlay.className = 'tile-overlay';
                
                // Position and size
                overlay.style.position = 'absolute';
                overlay.style.left = `${nw.x}px`;
                overlay.style.top = `${nw.y}px`;
                overlay.style.width = `${se.x - nw.x}px`;
                overlay.style.height = `${se.y - nw.y}px`;
                
                // Styling
                overlay.style.border = '3px dashed #ff9500';
                overlay.style.backgroundColor = 'rgba(255, 149, 0, 0.2)';
                overlay.style.pointerEvents = 'none';
                overlay.style.zIndex = '100';
                
                // Add the label
                const label = document.createElement('div');
                label.className = 'tile-label';
                label.textContent = `${r+1},${c+1}`;
                label.style.position = 'absolute';
                label.style.top = '5px';
                label.style.left = '5px';
                label.style.background = 'rgba(0, 0, 0, 0.7)';
                label.style.color = 'white';
                label.style.padding = '4px 8px';
                label.style.borderRadius = '3px';
                label.style.fontSize = '12px';
                label.style.fontWeight = 'bold';
                
                overlay.appendChild(label);
                mapDiv.appendChild(overlay);
            }
        }
    } catch (error) {
        console.error("Error drawing tile grid:", error);
    }
}
</script>

<template>
    <div class="map-selector-container">
        <div class="map-container" ref="mapContainer"></div>
        
        <div class="controls-panel">
            <h3>Tile Configuration</h3>
            <div class="control-group">
                <label for="tile-rows">Rows:</label>
                <input 
                    id="tile-rows" 
                    type="number" 
                    v-model="tilesConfig.rows" 
                    step="1"
                    min="1"
                    max="10"
                />
            </div>
            
            <div class="control-group">
                <label for="tile-columns">Columns:</label>
                <input 
                    id="tile-columns" 
                    type="number" 
                    v-model="tilesConfig.columns" 
                    step="1"
                    min="1"
                    max="10"
                />
            </div>
            
            <h3>Physical Tile Size</h3>
            <div class="control-group">
                <label for="tile-width">Width (mm):</label>
                <input 
                    id="tile-width" 
                    type="number" 
                    v-model="tilesConfig.physicalSize.width" 
                    step="10"
                    min="50"
                    max="300"
                />
            </div>
            
            <div class="control-group">
                <label for="tile-height">Height (mm):</label>
                <input 
                    id="tile-height" 
                    type="number" 
                    v-model="tilesConfig.physicalSize.height" 
                    step="10"
                    min="50"
                    max="300"
                />
            </div>
            
            <div class="info-panel" v-if="origin">
                <h3>Map Information</h3>
                <div class="control-group">
                    <label for="map-scale">Map Scale (1:X):</label>
                    <input 
                        id="map-scale" 
                        type="number" 
                        v-model="customScale" 
                        step="500"
                        min="1000"
                        max="100000"
                        @change="updateSelectionBounds"
                    />
                    <div class="scale-recommendation">
                        Suggested: 1:{{ Math.round(recommendedScale).toLocaleString() }}
                    </div>
                </div>
                <p>Grid size: {{ Math.round(totalGridSize.width) }} × {{ Math.round(totalGridSize.height) }} meters</p>
                <p>Tiles: {{ tilesConfig.rows }} × {{ tilesConfig.columns }} = {{ tilesConfig.rows * tilesConfig.columns }} total</p>
                <p>Per tile: {{ Math.round(tileSizeInMeters.width) }} × {{ Math.round(tileSizeInMeters.height) }} meters</p>
                <p>Physical size: {{ tilesConfig.physicalSize.width }}mm × {{ tilesConfig.physicalSize.height }}mm per tile</p>
                <p>Total physical size: {{ totalPhysicalSize.width }}mm × {{ totalPhysicalSize.height }}mm</p>
                <div class="button-group">
                    <button @click="fitGridToView" class="fit-button">Fit Grid to View</button>
                    <button @click="clearSelection" class="clear-button">Clear Selection</button>
                </div>
            </div>
            
            <div class="instructions" v-if="!origin">
                <h3>Instructions</h3>
                <p>Click on the map to set the center point of your model.</p>
                <p>You can drag the green marker to reposition the selection.</p>
                <p>Use the scale input to set your desired map scale.</p>
                <p>Set the number of rows and columns to split your model.</p>
                <p>Adjust the physical size of each tile in millimeters.</p>
            </div>
        </div>
    </div>
</template>

<style>
.map-selector-container {
    display: flex;
    height: 100%;
}

.map-container {
    flex: 1;
    height: 100%;
    position: relative;
}

.controls-panel {
    width: 300px;
    padding: 16px;
    background-color: #222;
    border-left: 1px solid #333;
    color: #e0e0e0;
    overflow-y: auto;
    max-height: 100%;
}

.control-group {
    margin-bottom: 16px;
}

label {
    display: block;
    margin-bottom: 4px;
    font-weight: bold;
    color: #e0e0e0;
}

input {
    width: 100%;
    padding: 8px;
    border: 1px solid #444;
    border-radius: 4px;
    background-color: #333;
    color: #e0e0e0;
    font-size: 14px;
}

.info-panel, .instructions {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #444;
    font-size: 14px;
    line-height: 1.6;
}

.scale-recommendation {
    font-size: 12px;
    color: #aaa;
    margin-top: 4px;
    font-style: italic;
}

.instructions p {
    margin-bottom: 10px;
    opacity: 0.8;
}

h3 {
    margin-bottom: 12px;
    color: #e0e0e0;
}

.button-group {
    display: flex;
    gap: 10px;
    margin-top: 12px;
}

.fit-button, .clear-button {
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: white;
}

.fit-button {
    background-color: #2196f3;
}

.fit-button:hover {
    background-color: #1976d2;
}

.clear-button {
    background-color: #ff5252;
}

.clear-button:hover {
    background-color: #ff3838;
}

/* Map elements */
:global(.mapboxgl-ctrl-top-right) {
    top: 10px;
    right: 320px; /* Account for sidebar */
}

/* Custom marker */
.origin-marker {
    cursor: move;
}

/* Tile overlay styles */
.tile-overlay {
    position: absolute;
    border: 3px dashed #ff9500;
    background-color: rgba(255, 149, 0, 0.2);
    pointer-events: none;
    z-index: 100;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.tile-label {
    position: absolute;
    top: 5px;
    left: 5px;
    padding: 3px 6px;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    border-radius: 3px;
    font-size: 12px;
    font-weight: bold;
    z-index: 101;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}
</style>