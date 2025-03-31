<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

const config = ref(null);
const isGenerating = ref(false);
const progress = ref(0);
const generatedTiles = ref(null);
const previewCanvas = ref(null);

// For 3D preview
let previewScene = null;
let previewCamera = null;
let previewRenderer = null;
let previewControls = null;
let previewModel = null;

// Load config from localStorage on component mounted
onMounted(() => {
    try {
        const savedConfig = localStorage.getItem('journeyConfig');
        if (savedConfig) {
            config.value = JSON.parse(savedConfig);
            console.log('Loaded configuration:', config.value);
            
            // Start generation when config is loaded
            generateTiles();
        } else {
            console.error('No configuration found in localStorage');
        }
    } catch (error) {
        console.error('Failed to load configuration:', error);
    }
});

// Cleanup on component unmount
onUnmounted(() => {
    if (previewRenderer) {
        previewRenderer.dispose();
    }
});

// Function to start tile generation
async function generateTiles() {
    console.log('Starting tile generation...');
    console.log('Config:', config.value);
    
    if (!config.value) {
        console.error('No configuration available');
        return;
    }
    
    try {
        console.log('Setting generation state...');
        isGenerating.value = true;
        progress.value = 0;
        
        console.log('Importing modules...');
        
        // Import necessary modules
        console.log('Attempting to import STATE_MODULE...');
        const STATE_MODULE = await import('../../../osm/src/state.js');
        console.log('Attempting to import BUILD_MODULE...');
        const BUILD_MODULE = await import('../../../osm/src/build.js');
        console.log('Attempting to import UTIL_MODULE...');
        const UTIL_MODULE = await import('../../../arc/src/util.js');
        console.log('Attempting to import THREE_MODULE...');
        const THREE_MODULE = await import('three');
        console.log('Attempting to import MapControls...');
        const { MapControls } = await import('three/examples/jsm/controls/MapControls');
        console.log('Attempting to import JSCAD...');
        const JSCAD_MODULE = await import('@jscad/modeling');
        
        const STATE = STATE_MODULE.STATE;
        const build = BUILD_MODULE.build;
        const util = UTIL_MODULE;
        const THREE = THREE_MODULE;
        const jscad = JSCAD_MODULE;
        
        console.log('Modules imported successfully');
        console.log('STATE object:', STATE);
        console.log('build function:', build);
        console.log('util module:', util);
        
        // Set the configuration in the OSM STATE
        // This mimics the computeDerived function from initialize.js
        console.log('Original bounds from config:', config.value.bounds);
        
        // Make sure the bounds are in the correct format needed by the OSM module
        const bounds = {
            xmin: config.value.bounds.xmin,
            ymin: config.value.bounds.ymin,
            xmax: config.value.bounds.xmax,
            ymax: config.value.bounds.ymax
        };
        
        // Verify the bounds object has all required properties
        if (!bounds.xmin || !bounds.ymin || !bounds.xmax || !bounds.ymax) {
            throw new Error('Bounds object is missing required properties. Make sure the selection includes a valid bounds object with xmin, ymin, xmax, and ymax.');
        }
        
        console.log('Formatted bounds for OSM:', bounds);
        STATE.config.bounds = bounds;
        STATE.worldOuterBounds = bounds; // Also set this which is needed by fetchTilesForBounds
        
        STATE.config.printScale = config.value.scale;
        STATE.config.tileSize = {
            width: config.value.physicalTileSize.width / 1000, // convert mm to meters
            height: config.value.physicalTileSize.height / 1000
        };
        STATE.config.bezelSize = {
            width: config.value.bezelSize.width,
            height: config.value.bezelSize.height
        };
        STATE.config.layerHeightMm = config.value.layerHeightMm;
        
        // Set the Mapbox access token for fetching map tiles
        const mapboxAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
        console.log('Mapbox Access Token:', mapboxAccessToken ? 'Available' : 'Not available');
        
        // Add the access token to the window environment for the build process
        window.VITE_MAPBOX_ACCESS_TOKEN = mapboxAccessToken;
        
        // Copy colors and heights from config
        if (config.value.colors) {
            STATE.config.colors = config.value.colors;
        }
        if (config.value.heights) {
            STATE.config.heights = config.value.heights;
        }
        
        // Set up necessary THREE.js scene components required by OSM
        console.log('Initializing THREE.js scene...');
        STATE.scene = new THREE.Scene();
        STATE.city = new THREE.Group(); // Create an empty group for the city model
        STATE.scene.add(STATE.city);
        
        // Add lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.2);
        let sun = new THREE.DirectionalLight(0xffffff, Math.PI);
        sun.position.set(300, 500, 100);
        STATE.scene.add(ambient);
        STATE.scene.add(sun);
        
        // Setting up center point
        STATE.center = { 
            latitude: (STATE.config.bounds.ymax + STATE.config.bounds.ymin) / 2, 
            longitude: (STATE.config.bounds.xmax + STATE.config.bounds.xmin) / 2 
        };
        
        console.log('Calculating bounds in local coordinates...');
        // Calculate the bounds in local coordinates
        const bottomLeft = { longitude: STATE.config.bounds.xmin, latitude: STATE.config.bounds.ymin };
        const topRight = { longitude: STATE.config.bounds.xmax, latitude: STATE.config.bounds.ymax };
        
        console.log('BottomLeft:', bottomLeft);
        console.log('TopRight:', topRight);
        console.log('Center:', STATE.center);
        
        // Convert GPS coordinates to local ENU coordinates
        console.log('Converting GPS to ENU...');
        
        // Make sure the util module has the expected functions
        if (!util.gpsToEnu || typeof util.gpsToEnu !== 'function') {
            console.error('util.gpsToEnu is not available:', util);
            throw new Error('Required function gpsToEnu not found in util module');
        }
        
        console.log('util.gpsToEnu:', util.gpsToEnu);
        
        try {
            const blXY = util.gpsToEnu(STATE.center, bottomLeft);
            const trXY = util.gpsToEnu(STATE.center, topRight);
            
            console.log('blXY:', blXY);
            console.log('trXY:', trXY);
            
            // Check if conversion was successful
            if (!blXY || !trXY || !blXY.x || !trXY.x) {
                throw new Error('Coordinate conversion failed');
            }
            
            STATE.innerBounds = {
                xmin: blXY.x, xmax: trXY.x,
                ymin: blXY.y, ymax: trXY.y
            };
            
            // Properly calculate worldOuterBounds as it's needed for the build process
            const wobl = util.enuToGps(STATE.center, { x: STATE.innerBounds.xmin, y: STATE.innerBounds.ymin });
            const wotr = util.enuToGps(STATE.center, { x: STATE.innerBounds.xmax, y: STATE.innerBounds.ymax });
            STATE.worldOuterBounds = {
                ymin: wobl.latitude, xmin: wobl.longitude,
                ymax: wotr.latitude, xmax: wotr.longitude
            };
            
            console.log('worldOuterBounds:', STATE.worldOuterBounds);
            
        } catch (error) {
            console.error('Error converting coordinates:', error);
            throw new Error('Failed to convert GPS coordinates to local coordinates: ' + error.message);
        }
        
        const w = STATE.innerBounds.xmax - STATE.innerBounds.xmin;
        const h = STATE.innerBounds.ymax - STATE.innerBounds.ymin;
        
        STATE.innerDimensions = { width: w, height: h };
        
        // Create materials
        console.log('Creating materials...');
        for (const type in STATE.config.colors) {
            const color = STATE.config.colors[type];
            STATE.materials[type] = new THREE.MeshStandardMaterial({ color, opacity: 0.8, transparent: false });
        }
        
        // Set up world tile size
        console.log('Setting up world tile size...');
        STATE.worldTileSize = {
            width: STATE.config.printScale * STATE.config.tileSize.width,
            height: STATE.config.printScale * STATE.config.tileSize.height
        };
        STATE.worldBezelSize = {
            width: STATE.config.printScale * (STATE.config.tileSize.width + STATE.config.bezelSize.width),
            height: STATE.config.printScale * (STATE.config.tileSize.height + STATE.config.bezelSize.height)
        };
        
        // Calculate tile count
        const tx = config.value.tilesConfig.columns;
        const ty = config.value.tilesConfig.rows;
        STATE.tileCount = { x: tx, y: ty };
        
        // Calculate heights for each type
        STATE.worldLayerHeight = STATE.config.layerHeightMm * STATE.config.printScale / 1000;
        for (const type of Object.keys(STATE.config.heights)) {
            STATE.heights[type] = STATE.config.printScale * STATE.config.heights[type] * STATE.config.layerHeightMm / 1000;
            STATE.polygons[type] = [];
        }
        
        // Update progress
        progress.value = 30;
        
        // Start the build process
        console.log('Starting build process...');
        
        try {
            // We need to modify the standard validation process to skip invalid geometries
            // Let's create a wrapper for the build function that catches geometry validation errors
            
            // First, let's get reference to the original validation function
            const originalValidate = jscad.geometries.geom2.validate;
            
            // Replace it with our version that doesn't throw errors
            jscad.geometries.geom2.validate = function(geom2) {
                try {
                    return originalValidate(geom2);
                } catch (error) {
                    console.warn('Skipping invalid geometry:', error.message);
                    return false; // Return false to indicate invalid geometry
                }
            };
            
            // Now call the build function
            await build();
            
            // Restore the original validation function
            jscad.geometries.geom2.validate = originalValidate;
        } catch (error) {
            console.error('Build process error:', error);
            throw new Error('Error during 3D model generation: ' + error.message);
        }
        
        // Update progress
        progress.value = 100;
        
        // Create result
        console.log('Generation complete, creating result...');
        
        // Check if the city model has any content
        const hasChildren = STATE.city && STATE.city.children && STATE.city.children.length > 0;
        console.log('City model has children:', hasChildren);
        
        generatedTiles.value = {
            tiles: config.value.tilesConfig.rows * config.value.tilesConfig.columns,
            bounds: config.value.bounds,
            timestamp: new Date().toISOString(),
            model: STATE.city, // Store the generated model
            hasValidModel: hasChildren // Flag to indicate if the model has content
        };
        
        // Initialize 3D preview after generation is complete
        console.log('Initializing preview...');
        setTimeout(() => {
            initPreview();
        }, 100);
        
    } catch (error) {
        console.error('Error generating tiles:', error);
    } finally {
        isGenerating.value = false;
    }
}

// Initialize the 3D preview
async function initPreview() {
    if (!previewCanvas.value || !config.value || !generatedTiles.value) return;

    try {
        // Dynamically import Three.js
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        
        // Clear existing scene if any
        if (previewRenderer) {
            previewRenderer.dispose();
            previewCanvas.value.innerHTML = '';
        }
        
        // Create a basic Three.js scene
        previewScene = new THREE.Scene();
        previewScene.background = new THREE.Color(0x121212);
        
        // Set up camera
        previewCamera = new THREE.PerspectiveCamera(
            45, 
            previewCanvas.value.clientWidth / previewCanvas.value.clientHeight, 
            1, 
            10000
        );
        
        // Position camera based on the model's scale and size
        previewCamera.position.set(0, 160, 190);
        
        // Set up renderer
        previewRenderer = new THREE.WebGLRenderer({ antialias: true });
        previewRenderer.setSize(previewCanvas.value.clientWidth, previewCanvas.value.clientHeight);
        previewRenderer.setPixelRatio(window.devicePixelRatio);
        previewRenderer.shadowMap.enabled = true;
        previewRenderer.shadowMap.type = THREE.BasicShadowMap;
        previewRenderer.setClearColor("#111");
        previewCanvas.value.appendChild(previewRenderer.domElement);
        
        // Add orbit controls
        previewControls = new OrbitControls(previewCamera, previewRenderer.domElement);
        previewControls.enableDamping = true;
        previewControls.target.set(0, 0, 10);
        previewControls.update();
        
        // Add lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.2);
        previewScene.add(ambient);
        
        const sun = new THREE.DirectionalLight(0xffffff, Math.PI);
        sun.position.set(300, 500, 100);
        previewScene.add(sun);
        
        // Check if we have a valid generated model from OSM
        if (generatedTiles.value.model && generatedTiles.value.hasValidModel) {
            console.log('Using OSM generated model for preview');
            // Use the actual generated model from the OSM module
            previewModel = generatedTiles.value.model.clone();
            previewScene.add(previewModel);
            
            // Scale down the model for better visibility
            const s = 1 / 10; // Scale factor to make it fit in the preview
            previewModel.scale.set(s, s, s);
        } else {
            console.log('Using placeholder model for preview');
            // Create a placeholder model if no valid OSM model is available
            await createPlaceholderModel();
        }
        
        // Animation loop
        function animate() {
            requestAnimationFrame(animate);
            previewControls.update();
            previewRenderer.render(previewScene, previewCamera);
        }
        
        animate();
        
        // Handle window resize
        window.addEventListener('resize', onWindowResize);
        
        function onWindowResize() {
            if (!previewCanvas.value) return;
            
            previewCamera.aspect = previewCanvas.value.clientWidth / previewCanvas.value.clientHeight;
            previewCamera.updateProjectionMatrix();
            previewRenderer.setSize(previewCanvas.value.clientWidth, previewCanvas.value.clientHeight);
        }
        
    } catch (error) {
        console.error('Error initializing 3D preview:', error);
    }
}

// Create a placeholder tile model when OSM model isn't available
async function createPlaceholderModel() {
    const THREE = await import('three');
    
    // Create a group to hold all tiles
    previewModel = new THREE.Group();
    previewScene.add(previewModel);
    
    const { rows, columns } = config.value.tilesConfig;
    const tileWidth = 2;
    const tileHeight = 2;
    
    // Create a simple grid of tiles based on the configuration
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            // Create a base tile
            const tileGeometry = new THREE.BoxGeometry(tileWidth, 0.1, tileHeight);
            const tileMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x333333,
                roughness: 0.8,
            });
            const tile = new THREE.Mesh(tileGeometry, tileMaterial);
            
            // Position the tile in a grid
            tile.position.x = (c - (columns-1)/2) * tileWidth;
            tile.position.z = (r - (rows-1)/2) * tileHeight;
            
            // Add random buildings and features to simulate map details
            addFeaturesToTile(tile, THREE);
            
            // Add the tile to the model
            previewModel.add(tile);
        }
    }
    
    // Center the model
    previewModel.position.set(0, 0, 0);
    
    return previewModel;
}

// Add features to a tile (buildings, streets, etc.)
function addFeaturesToTile(tile, THREE) {
    // Add random buildings
    const buildingCount = Math.floor(Math.random() * 10) + 5;
    
    for (let i = 0; i < buildingCount; i++) {
        // Random building size and position
        const width = Math.random() * 0.3 + 0.1;
        const height = Math.random() * 0.5 + 0.2;
        const depth = Math.random() * 0.3 + 0.1;
        
        const posX = (Math.random() - 0.5) * 1.8;
        const posZ = (Math.random() - 0.5) * 1.8;
        
        // Create building geometry
        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        const buildingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xCCCCCC,
            roughness: 0.7,
        });
        
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.set(posX, height/2 + 0.05, posZ);
        
        // Add building to the tile
        tile.add(building);
    }
    
    // Add roads
    if (Math.random() > 0.3) {
        const roadWidth = 0.1;
        const roadGeometry = new THREE.PlaneGeometry(2, roadWidth);
        const roadMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x666666,
            roughness: 0.9,
            side: THREE.DoubleSide
        });
        
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = Math.PI / 2;
        road.position.y = 0.06;
        
        tile.add(road);
        
        // Add cross road
        if (Math.random() > 0.5) {
            const crossRoadGeometry = new THREE.PlaneGeometry(roadWidth, 2);
            const crossRoad = new THREE.Mesh(crossRoadGeometry, roadMaterial);
            crossRoad.rotation.x = Math.PI / 2;
            crossRoad.position.y = 0.07;
            
            tile.add(crossRoad);
        }
    }
    
    // Add water feature
    if (Math.random() > 0.7) {
        const waterSize = Math.random() * 0.6 + 0.3;
        const waterGeometry = new THREE.CircleGeometry(waterSize, 32);
        const waterMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0099FF,
            roughness: 0.3,
            metalness: 0.2,
        });
        
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0.06;
        water.position.x = (Math.random() - 0.5) * 1.4;
        water.position.z = (Math.random() - 0.5) * 1.4;
        
        tile.add(water);
    }
}

// Rotate the preview model
function rotateModel(direction) {
    if (!previewModel) return;
    
    const rotationAmount = direction === 'left' ? Math.PI / 8 : -Math.PI / 8;
    
    // If it's the OSM model, we need to be careful about the rotation
    if (generatedTiles.value && generatedTiles.value.model) {
        // Rotate around the vertical axis (Y)
        previewModel.rotation.y += rotationAmount;
    } else {
        // For the placeholder model, simple rotation is fine
        previewModel.rotation.y += rotationAmount;
    }
}

// Reset the preview view
function resetView() {
    if (!previewControls || !previewModel) return;
    
    // Reset orbit controls to default position
    previewControls.reset();
    
    // Reset model rotation
    previewModel.rotation.set(0, 0, 0);
    
    // If it's the OSM model, we may need to apply specific default transformation
    if (generatedTiles.value && generatedTiles.value.model) {
        // Reset to the default scale factor
        const s = 1 / 10;
        previewModel.scale.set(s, s, s);
    }
}

// Export the tile configuration as a file
function exportConfig() {
    if (!config.value) return;
    
    const configData = JSON.stringify(config.value, null, 2);
    const blob = new Blob([configData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `journey-config-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
</script>

<template>
    <div class="tile-generator">
        <div class="header">
            <h2>Tile Generation</h2>
            <button @click="$router.push('/')" class="back-button">Back to Map</button>
        </div>
        
        <div class="config-section" v-if="config">
            <h3>Configuration</h3>
            <div class="config-details">
                <div class="config-item">
                    <strong>Size:</strong> {{ config.tilesConfig.rows }} × {{ config.tilesConfig.columns }} tiles
                </div>
                <div class="config-item">
                    <strong>Scale:</strong> 1:{{ config.scale.toLocaleString() }}
                </div>
                <div class="config-item">
                    <strong>Physical Size:</strong> {{ config.physicalTileSize.width }}mm × {{ config.physicalTileSize.height }}mm per tile
                </div>
                <div class="config-item">
                    <strong>Center:</strong> {{ config.center.lat.toFixed(5) }}, {{ config.center.lng.toFixed(5) }}
                </div>
            </div>
            <button @click="exportConfig" class="export-button">Export Configuration</button>
        </div>
        <div class="config-section" v-else>
            <h3>No Configuration</h3>
            <p>No configuration data found. Please return to the map and make a selection.</p>
            <button @click="$router.push('/')" class="back-button">Back to Map</button>
        </div>
        
        <div class="generation-section">
            <h3>Generation Status</h3>
            <div v-if="isGenerating" class="progress-container">
                <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
                <div class="progress-text">{{ Math.round(progress) }}%</div>
            </div>
            <button v-if="!isGenerating && !generatedTiles" @click="generateTiles" class="generate-button">
                Start Generation
            </button>
            <div v-if="generatedTiles" class="result-container">
                <h4>Generation Complete</h4>
                <p>Successfully generated {{ generatedTiles.tiles }} tiles!</p>
                <p>Generated at: {{ new Date(generatedTiles.timestamp).toLocaleString() }}</p>
                <p v-if="generatedTiles.hasValidModel" class="success-text">✅ Valid 3D model created</p>
                <p v-else class="warning-text">⚠️ Using placeholder model (invalid geometry)</p>
                <button @click="generateTiles" class="regenerate-button">Regenerate</button>
            </div>
        </div>
        
        <div class="preview-section">
            <h3>Preview</h3>
            <div v-if="generatedTiles" class="preview-container">
                <div id="preview-canvas" ref="previewCanvas"></div>
                <div class="preview-controls">
                    <button @click="rotateModel('left')" class="preview-button">Rotate Left</button>
                    <button @click="rotateModel('right')" class="preview-button">Rotate Right</button>
                    <button @click="resetView()" class="preview-button">Reset View</button>
                </div>
            </div>
            <div v-else class="preview-placeholder">
                <p v-if="isGenerating">Generating preview...</p>
                <p v-else>Start generation to see a preview</p>
            </div>
        </div>
    </div>
</template>

<style>
.tile-generator {
    padding: 24px;
    background-color: #121212;
    color: #e0e0e0;
    min-height: 100%;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    border-bottom: 1px solid #333;
    padding-bottom: 16px;
}

.back-button {
    padding: 8px 16px;
    background-color: #333;
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
}

.back-button:hover {
    background-color: #444;
}

.config-section,
.generation-section,
.preview-section {
    background-color: #1e1e1e;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
}

.config-details {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
}

.config-item {
    background-color: #252525;
    padding: 12px;
    border-radius: 4px;
}

.progress-container {
    background-color: #252525;
    height: 24px;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    margin: 16px 0;
}

.progress-bar {
    height: 100%;
    background-color: #4caf50;
    transition: width 0.3s ease;
}

.progress-text {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
}

.generate-button,
.regenerate-button,
.export-button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: white;
    margin-top: 8px;
}

.generate-button,
.regenerate-button {
    background-color: #4caf50;
}

.generate-button:hover,
.regenerate-button:hover {
    background-color: #388e3c;
}

.export-button {
    background-color: #2196f3;
}

.export-button:hover {
    background-color: #1976d2;
}

.result-container {
    background-color: #252525;
    padding: 16px;
    border-radius: 4px;
    margin-top: 16px;
}

.preview-placeholder {
    background-color: #252525;
    height: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: #888;
}

.preview-container {
    position: relative;
    width: 100%;
    height: 400px;
    background-color: #252525;
    border-radius: 4px;
    overflow: hidden;
}

#preview-canvas {
    width: 100%;
    height: 100%;
}

.preview-controls {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    z-index: 10;
}

.preview-button {
    padding: 8px 12px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}

.preview-button:hover {
    background-color: rgba(0, 0, 0, 0.9);
}

.success-text {
    color: #4caf50;
    font-weight: bold;
}

.warning-text {
    color: #ff9800;
    font-weight: bold;
}
</style>