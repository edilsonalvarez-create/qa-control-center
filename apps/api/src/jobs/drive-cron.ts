import cron from "node-cron";
import type { AppConfig } from "../config.js";
import { logger } from "../lib/logger.js";
import { enqueueDriveSync } from "../services/drive-sync-service.js";

let started = false;

export function startDriveSyncScheduler(config: AppConfig) {
  if (started) return;
  started = true;
  if (config.DRIVE_SYNC_ENABLED === "false" || config.DRIVE_SYNC_ENABLED === "0") {
    logger.info("Drive daily sync scheduler disabled (DRIVE_SYNC_ENABLED=false)");
    return;
  }
  if (!cron.validate(config.DRIVE_SYNC_CRON)) {
    logger.error({ expr: config.DRIVE_SYNC_CRON }, "invalid DRIVE_SYNC_CRON expression");
    return;
  }
  cron.schedule(
    config.DRIVE_SYNC_CRON,
    () => {
      logger.info({ tz: config.DRIVE_SYNC_TZ }, "starting scheduled Drive sync");
      void enqueueDriveSync(config, "CRON").catch((err) => {
        logger.error({ err }, "scheduled Drive sync enqueue failed");
      });
    },
    { timezone: config.DRIVE_SYNC_TZ },
  );
  logger.info(
    { cron: config.DRIVE_SYNC_CRON, timezone: config.DRIVE_SYNC_TZ },
    "Drive sync scheduler registered",
  );
}
