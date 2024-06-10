import { STATE as $ } from "./src/state.js";
import { build } from "./src/build.js";
import { initialize, animate } from "./src/initialize.js";
import { STLExporter } from 'three/addons/exporters/STLExporter.js';


initialize();
animate();
await build();


const exporter = new STLExporter();
const result = exporter.parse( $.city, { binary: true } );
const blob = new Blob([result], { type: 'application/octet-stream' });
const link = document.createElement('a');
link.href = window.URL.createObjectURL(blob);
link.download = 'model.stl';
document.body.appendChild(link);
link.click();
document.body.removeChild(link);