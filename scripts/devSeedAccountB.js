"use strict";

const crypto = require("crypto");
const path = require("path");
const db = require("../netlify/functions/_db");

async function main() {
  const sql = await db.getSql();
  await db.ensureSchema(sql);

  // 1) Account
  const existingAccount = await sql`
    SELECT id
    FROM accounts
    WHERE name = 'Account B (dev)'
    LIMIT 1
  `;
  if (existingAccount[0]?.id) {
    console.log("Account B already exists");
    console.log(`accountId: ${existingAccount[0].id}`);
    return;
  }

  // 2) Username collision check (global)
  const existingUser = await sql`
    SELECT id, account_id
    FROM users
    WHERE LOWER(username) = LOWER('acctb.admin')
    LIMIT 1
  `;
  if (existingUser[0]?.id) {
    console.log("acctb.admin already exists");
    console.log(`userId: ${existingUser[0].id}, accountId: ${existingUser[0].account_id}`);
    return;
  }

  const accountId = crypto.randomUUID();
  await sql`
    INSERT INTO accounts (id, name)
    VALUES (${accountId}::uuid, 'Account B (dev)')
  `;

  // 3) Admin user for Account B
  const user = await db.createUserRecord(sql, {
    username: "acctb.admin",
    displayName: "Account B Admin",
    password: "P@ssw0rd!",
    level: 6,
    accountId,
  });

  // 4) Seed client + project if missing
  const clientName = "B Client 1";
  const projectName = "B Project 1";

  const clientRows = await sql`
    SELECT id
    FROM clients
    WHERE account_id = ${accountId}::uuid
      AND LOWER(name) = LOWER(${clientName})
    LIMIT 1
  `;
  const clientId =
    clientRows[0]?.id ||
    (
      await sql`
        INSERT INTO clients (account_id, name)
        VALUES (${accountId}::uuid, ${clientName})
        RETURNING id
      `
    )[0].id;

  const projectRows = await sql`
    SELECT id
    FROM projects
    WHERE account_id = ${accountId}::uuid
      AND client_id = ${clientId}
      AND LOWER(name) = LOWER(${projectName})
    LIMIT 1
  `;
  if (!projectRows[0]) {
    await sql`
      INSERT INTO projects (client_id, account_id, name, created_by)
      VALUES (${clientId}, ${accountId}::uuid, ${projectName}, ${user.id})
    `;
  }

  console.log("Account B (dev) created successfully.");
  console.log(`accountId: ${accountId}`);
  console.log(`admin username: ${user.username}`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
