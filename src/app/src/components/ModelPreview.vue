<script setup>
import { ref, onMounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const props = defineProps({
    config: {
        type: Object,
        default: null
    }
});

const previewContainer = ref(null);
let scene, camera, renderer, controls;
let previewModel = null;

// Initialize Three.js scene
function initThreeScene() {
    if (!previewContainer.value) return;
    
    // Initialize scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    
    // Add ambient and directional light
    const ambient = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambient);
    
    const sun = new THREE.DirectionalLight(0xffffff, Math.PI);
    sun.position.set(300, 500, 100);
    scene.add(sun);
    
    // Set up camera
    const containerRect = previewContainer.value.getBoundingClientRect();
    camera = new THREE.PerspectiveCamera(
        45, 
        containerRect.width / containerRect.height, 
        1, 
        10000
    );
    camera.position.set(0, 160, 190);
    
    // Set up renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRect.width, containerRect.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    previewContainer.value.appendChild(renderer.domElement);
    
    // Add camera controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 10);
    controls.update();
    
    // Add window resize handler
    window.addEventListener('resize', resizeRenderer);
    
    // Start animation loop
    animate();
}

// Resize handler
function resizeRenderer() {
    if (!previewContainer.value || !camera || !renderer) return;
    
    const containerRect = previewContainer.value.getBoundingClientRect();
    camera.aspect = containerRect.width / containerRect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(containerRect.width, containerRect.height);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Create a simple preview model based on config
function createPreviewModel() {
    if (!props.config || !scene) return;
    
    // Remove previous model if exists
    if (previewModel) {
        scene.remove(previewModel);
    }
    
    previewModel = new THREE.Group();
    
    // Create ground plane
    const groundHeight = 3; // Use config value from real model
    const { width, height } = props.config.tileSize;
    const bezelSize = props.config.bezelSize;
    
    const groundWidth = props.config.printScale * (width + bezelSize.width);
    const groundDepth = props.config.printScale * (height + bezelSize.height);
    
    const groundGeom = new THREE.BoxGeometry(groundWidth, groundHeight, groundDepth);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#161616' });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.translateY(-groundHeight / 2);
    previewModel.add(ground);
    
    // Add simple building blocks as placeholders
    const buildingMat = new THREE.MeshStandardMaterial({ color: '#ccc' });
    const waterMat = new THREE.MeshStandardMaterial({ color: '#0ff' });
    const streetMat = new THREE.MeshStandardMaterial({ color: '#777' });
    
    // Add random buildings and streets for visualization
    for (let i = 0; i < 20; i++) {
        const size = 10 + Math.random() * 20;
        const height = 10 + Math.random() * 30;
        const x = (Math.random() - 0.5) * (groundWidth * 0.8);
        const z = (Math.random() - 0.5) * (groundDepth * 0.8);
        
        const buildingGeom = new THREE.BoxGeometry(size, height, size);
        const building = new THREE.Mesh(buildingGeom, buildingMat);
        building.position.set(x, height / 2, z);
        previewModel.add(building);
    }
    
    // Add a water feature
    const waterGeom = new THREE.BoxGeometry(groundWidth * 0.3, 4, groundDepth * 0.2);
    const water = new THREE.Mesh(waterGeom, waterMat);
    water.position.set(groundWidth * 0.25, 2, 0);
    previewModel.add(water);
    
    // Add streets (simplified as boxes)
    const streetWidth = 5;
    const streetHeight = 4;
    
    // Horizontal street
    const hStreetGeom = new THREE.BoxGeometry(groundWidth * 0.9, streetHeight, streetWidth);
    const hStreet = new THREE.Mesh(hStreetGeom, streetMat);
    hStreet.position.set(0, streetHeight / 2, -groundDepth * 0.1);
    previewModel.add(hStreet);
    
    // Vertical street
    const vStreetGeom = new THREE.BoxGeometry(streetWidth, streetHeight, groundDepth * 0.9);
    const vStreet = new THREE.Mesh(vStreetGeom, streetMat);
    vStreet.position.set(-groundWidth * 0.2, streetHeight / 2, 0);
    previewModel.add(vStreet);
    
    // Add to scene and adjust camera
    scene.add(previewModel);
    
    // Scale model based on print scale
    const s = 1000 / props.config.printScale;
    previewModel.scale.set(s, s, s);
    
    // Adjust camera to focus on model
    camera.position.set(0, 160 * s, 190 * s);
    controls.target.set(0, 0, 0);
    controls.update();
}

// Initialize on mounted
onMounted(() => {
    initThreeScene();
});

// Update model when config changes
watch(() => props.config, (newConfig) => {
    if (newConfig) {
        createPreviewModel();
    }
}, { deep: true });
</script>

<template>
    <div class="preview-container" ref="previewContainer">
        <div class="placeholder" v-if="!config">
            <p>Select an area on the map and generate a model to see preview</p>
        </div>
    </div>
</template>

<style scoped>
.preview-container {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 300px;
    background-color: #111111;
}

.placeholder {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 16px;
    text-align: center;
    padding: 20px;
    pointer-events: none;
}
</style>