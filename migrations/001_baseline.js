"use strict";

const { ensureSchema } = require("../netlify/functions/_db");

module.exports = {
  id: "001_baseline",
  async up(sql) {
    await ensureSchema(sql);
  },
};
