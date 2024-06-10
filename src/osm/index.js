import { build } from "./src/build.js";
import { initialize, animate } from "./src/initialize.js";
import { initTweakpane } from "./src/pane.js";


initialize();
initTweakpane();
animate();
await build();