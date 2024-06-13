import { build } from "./src/build.js";
import { initialize } from "./src/initialize.js";
import { OperationGroup, ADDITION } from "three-bvh-csg";


initialize();
await build();