import { getDB, closeDB } from "./adapters/index";
import { logger } from "../utils/logger";

async function main() {
  const db = await getDB();
  try {
    await db.migrate();
    logger.info("Migration complete");
  } finally {
    await closeDB();
  }
}

main().catch((err) => {
  logger.error("Migration failed", { err });
  process.exit(1);
});
