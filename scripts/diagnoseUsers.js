"use strict";

const db = require("../netlify/functions/_db");

async function main() {
  const sql = await db.getSql();
  await db.ensureSchema(sql);
  const accountId = await db.ensureDefaultAccount(sql);
  const users = await db.listUsers(sql, accountId);
  console.log("Users (id, displayName, officeId):");
  for (const u of users) {
    console.log(`${u.id} | ${u.displayName} | ${u.officeId || "<null>"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
