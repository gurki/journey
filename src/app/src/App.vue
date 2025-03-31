<script setup>
import { ref, watch } from 'vue';
import MapSelector from './components/MapSelector.vue';

// Add your Mapbox access token here (will come from environment variable in production)
const mapboxAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

// Store the current selection
const mapSelection = ref(null);

// Handle selection changes
function handleSelectionUpdate(selection) {
  mapSelection.value = selection;
}

// Generate config for 3D model generation
const generationConfig = ref(null);

function generateModel() {
  if (!mapSelection.value || !mapSelection.value.bounds) {
    alert('Please select an area on the map first');
    return;
  }
  
  // Create config object based on selection
  generationConfig.value = {
    bounds: mapSelection.value.bounds,
    center: mapSelection.value.center,
    scale: mapSelection.value.scale,
    tilesConfig: mapSelection.value.tilesConfig,
    physicalTileSize: mapSelection.value.tilesConfig.physicalSize,
    // Add additional properties from existing app
    bezelSize: { width: 0.009, height: 0.009 },
    layerHeightMm: 0.2,
    // Material colors
    colors: {
      buildings: "#ccc",  //  houses and more
      greenery: "#294",   //  trees, bushes, shrubbery
      ground: "#161616",  //  baseplate
      parks: "#2c4",      //  parks, gardens
      path: "#aaa",       //  often has "width"
      pedestrian: "#555", //  highway, but polygon
      railway: "#666",    //  rails
      stone: "#cc7",      //  stones, rocks, boulders
      street: "#777",     //  often has "lanes" 
      unknown: "#f00",
      water: "#0ff",      //  lakes, rivers, oceans
    },
    // Heights (in print layers)
    heights: {  
      buildings: 15,  //  meters
      greenery: 4,
      ground: 3,
      parks: 2,
      path: 6,
      pedestrian: 6,
      railway: 4,     
      stone: 6,
      street: 4,
      water: 4,
      unknown: 12,
    }
  };
}

// Format JSON for display
function formatJSON(obj) {
  return JSON.stringify(obj, null, 2);
}

// Copy configuration to clipboard
function copyConfig() {
  if (!generationConfig.value) return;
  
  navigator.clipboard.writeText(formatJSON(generationConfig.value))
    .then(() => {
      alert('Configuration copied to clipboard!');
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
    });
}
</script>

<template>
  <div class="app-container">
    <header>
      <h1>Journey Tile Selector</h1>
    </header>
    
    <main>
      <MapSelector 
        :access-token="mapboxAccessToken"
        @update:selection="handleSelectionUpdate"
      />
    </main>
    
    <footer>
      <div class="footer-content">
        <div class="selection-info">
          <div v-if="mapSelection && mapSelection.bounds">
            <button @click="generateModel" class="generate-button">Generate 3D Model</button>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #121212;
  color: #e0e0e0;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}

#app {
  height: 100%;
  width: 100%;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
}

header {
  background-color: #1e1e1e;
  color: white;
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid #333;
}

main {
  flex: 1;
  min-height: 400px;
  width: 100%;
  overflow: hidden;
}

footer {
  padding: 16px;
  background-color: #1e1e1e;
  border-top: 1px solid #333;
  overflow: auto;
  max-height: 500px;
}

.footer-content {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.selection-info {
  flex: 1;
  min-width: 300px;
}

.config-display {
  margin-top: 24px;
}

.preview-container {
  flex: 1;
  min-width: 300px;
  height: 300px;
}

pre {
  background-color: #2d2d2d;
  color: #e0e0e0;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin-top: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.generate-button, .copy-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-right: 8px;
}

.generate-button {
  background-color: #4caf50;
  color: white;
}

.generate-button:hover {
  background-color: #388e3c;
}

.copy-button {
  background-color: #2196f3;
  color: white;
}

.copy-button:hover {
  background-color: #1976d2;
}

h3 {
  margin-bottom: 12px;
  color: #e0e0e0;
}
</style>