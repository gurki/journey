import { STATE as $ } from "./state.js";
import { exportSTL, exportGLTF } from "./export.js";

import { Pane } from "tweakpane";
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';


export function initTweakpane() {
    
    $.pane = new Pane();
    $.pane.registerPlugin( EssentialsPlugin );
    
    $.fpsGraph = $.pane.addBlade({
        view: "fpsgraph",
        label: "fps",
        rows: 1,
        max: 120
    });
        
    const pipelineFolder = $.pane.addFolder({ title: "Pipeline", expanded: true });
    const pipelineState = { pipeline: $.config.pipeline };
    pipelineFolder.addBinding( pipelineState, "pipeline", {
        options: { legacy: "legacy", partition: "partition" }
    }).on( "change", ev => {
        const params = new URLSearchParams( window.location.search );
        params.set( "pipeline", ev.value );
        window.location.search = params.toString();
    });

    $.pane.addButton({ title: 'Export STL' }).on( 'click', exportSTL );
    $.pane.addButton({ title: 'Export GLTF' }).on( 'click', exportGLTF );

}