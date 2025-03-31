# Journey Map Selector

This is a Vue.js application for selecting map regions to be 3D printed. The app allows users to:

1. Navigate a map using Mapbox GL JS
2. Select an area with a specified print size and scale
3. Generate configuration for the 3D model generator
4. Preview what the 3D model might look like

## Setup

1. Clone the repository
2. Navigate to the app directory: `cd src/app`
3. Install dependencies: `bun install`
4. Create a `.env.local` file with your Mapbox access token:
   ```
   VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
   ```
5. Start the development server: `bun run dev`

## Usage

1. Navigate the map to find the area you want to 3D print
2. Adjust the print scale and dimensions in the control panel
3. Click and drag on the map to select an area (the selection will maintain the aspect ratio of your specified print dimensions)
4. Click "Generate 3D Model" to create the configuration
5. Copy the configuration for use in the main Journey 3D generator

## Configuration Output

The generated configuration includes:
- Geographic bounds of the selected area
- Print scale
- Tile size in meters
- Bezel size
- Layer height
- Material colors
- Element heights

## Integration with Journey

To use this configuration in the main Journey application:
1. Copy the generated configuration
2. Replace the relevant section in the `STATE.config` object in the `src/osm/src/state.js` file
3. Run the Journey application to generate your 3D model with the selected area

## Development

- Built with Vue 3 and Vite
- Uses Mapbox GL JS for map rendering
- Uses Three.js for 3D preview