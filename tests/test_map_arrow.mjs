import assert from "node:assert/strict";
import { mapArrowAngle } from "../src/hud.js";

const eps = 1e-9;
assert.ok(Math.abs(mapArrowAngle({ x: 0, z: -1 }) - 0) < eps, "north points up");
assert.ok(Math.abs(mapArrowAngle({ x: 1, z: 0 }) - Math.PI / 2) < eps, "east rotates right");
assert.ok(Math.abs(mapArrowAngle({ x: 0, z: 1 }) - Math.PI) < eps, "south points down");
assert.ok(Math.abs(mapArrowAngle({ x: -1, z: 0 }) + Math.PI / 2) < eps, "west rotates left");
console.log("MAP ARROW TESTS: PASS");
