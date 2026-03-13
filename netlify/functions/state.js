"use strict";

const { ensureSchema, errorResponse, getSql, json, loadState } = require("./_db");

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") {
    return errorResponse(405, "Method not allowed.");
  }

  try {
    const sql = await getSql();
    await ensureSchema(sql);
    const state = await loadState(sql);
    return json(200, state);
  } catch (error) {
    return errorResponse(500, error.message || "Unable to load database state.");
  }
};
