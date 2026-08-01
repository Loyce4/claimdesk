import "dotenv/config";
import { initDatabase, pool } from "../src/db/pool.js";

export async function setup() {
  await initDatabase();
}

export async function teardown() {
  await pool.end();
}