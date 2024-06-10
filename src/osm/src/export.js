import { STATE as $ } from "./state.js";
import { STLExporter } from 'three/addons/exporters/STLExporter.js';


export function exportSTL() {
    
    $.city.rotation.set( Math.PI / 2, 0, 0 );
    $.city.updateMatrixWorld();

    const exporter = new STLExporter();
    const result = exporter.parse( $.city, { binary: true } );
    const blob = new Blob([result], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'model.stl';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    $.city.rotation.set( 0, 0, 0 );
    $.city.updateMatrixWorld();

}