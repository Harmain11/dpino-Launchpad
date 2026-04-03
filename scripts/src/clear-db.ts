import { db } from "@workspace/db";
import { stakingPositionsTable } from "@workspace/db/schema";
import { projectsTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Clearing database...");
  const pos = await db.delete(stakingPositionsTable).returning({ id: stakingPositionsTable.id });
  const prj = await db.delete(projectsTable).returning({ id: projectsTable.id });
  await db.execute(sql`ALTER SEQUENCE projects_id_seq RESTART WITH 1`);
  await db.execute(sql`ALTER SEQUENCE staking_positions_id_seq RESTART WITH 1`);
  console.log(`✓ Deleted ${pos.length} staking positions`);
  console.log(`✓ Deleted ${prj.length} projects`);
  console.log("Database is clean and ready for real data.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error clearing database:", e);
  process.exit(1);
});
