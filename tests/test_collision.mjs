import assert from "node:assert/strict";
import { doorPlaneCollision, CELL } from "../src/collision.js";

const base = { center: { x: 10, z: 20 }, horiz: false, open: false };
assert.equal(doorPlaneCollision(base, 10, 20, 0.34), true, "closed X-normal door blocks plane");
assert.equal(doorPlaneCollision(base, 10, 22.1, 0.34), true, "door spans its 4m opening");
assert.equal(doorPlaneCollision(base, 10, 22.5, 0.34), false, "door does not block beyond opening");
assert.equal(doorPlaneCollision(base, 12, 20, 0.34), false, "door does not create a full-cell invisible wall");
assert.equal(doorPlaneCollision({ ...base, open: true }, 10, 20, 0.34), false, "open door is passable");
const cross = { center: { x: 20, z: 10 }, horiz: true, open: false };
assert.equal(doorPlaneCollision(cross, 20, 10, 0.34), true, "closed Z-normal door blocks plane");
assert.equal(doorPlaneCollision(cross, 22.1, 10, 0.34), true, "horizontal door spans opening");
assert.equal(CELL, 4, "collision geometry uses 4m cells");
console.log("COLLISION TESTS: PASS");
