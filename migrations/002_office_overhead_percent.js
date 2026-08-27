"use strict";

module.exports = {
  id: "002_office_overhead_percent",
  async up(sql) {
    await sql`
      ALTER TABLE office_locations
      ADD COLUMN IF NOT EXISTS overhead_percent NUMERIC(6,2) NULL
    `;
  },
};
