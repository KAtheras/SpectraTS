"use strict";

const assert = require("assert");
const { windowFor } = require("../virtualTable");

assert.deepStrictEqual(windowFor({ total: 1000, scrollTop: 0, viewportHeight: 540, rowHeight: 54, overscan: 8 }), {
  start: 0,
  end: 26,
  beforeHeight: 0,
  afterHeight: 52596,
});
const middle = windowFor({ total: 1000, scrollTop: 27000, viewportHeight: 540, rowHeight: 54, overscan: 8 });
assert.strictEqual(middle.start, 492);
assert.strictEqual(middle.end, 518);
assert.strictEqual(middle.beforeHeight + (middle.end - middle.start) * 54 + middle.afterHeight, 54000);

const finalViewport = windowFor({ total: 130, scrollTop: 99999, viewportHeight: 540, rowHeight: 54, overscan: 8 });
assert.strictEqual(finalViewport.start, 120);
assert.strictEqual(finalViewport.end, 130);

console.log("✔ virtual table windows bound rendered rows and preserve scroll height");
