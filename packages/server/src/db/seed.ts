import { getDB, closeDB } from "./adapters/index";
import { logger } from "../utils/logger";

async function main() {
  const db = await getDB();
  try {
    await db.seed();
    logger.info("Seeding complete");
  } finally {
    await closeDB();
  }
}

main().catch((err) => {
  logger.error("Seeding failed", { err });
  process.exit(1);
});
