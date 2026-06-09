-- Migration: add shareToken to Album (compartilhamento público)
ALTER TABLE `Album` ADD COLUMN `shareToken` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Album_shareToken_key` ON `Album`(`shareToken`);
