import { STATE as $ } from "./state.js";
import { exportSTL } from "./export.js";

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
        
    $.pane.addButton({ title: 'Export STL' }).on( 'click', exportSTL );

}