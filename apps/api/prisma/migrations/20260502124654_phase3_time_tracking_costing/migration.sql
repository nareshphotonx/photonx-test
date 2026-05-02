-- AlterTable
ALTER TABLE `Project` ADD COLUMN `budgetAmount` DECIMAL(12, 2) NULL,
    ADD COLUMN `budgetCurrency` VARCHAR(191) NULL,
    ADD COLUMN `overheadPercent` DECIMAL(6, 2) NULL;

-- CreateTable
CREATE TABLE `TimeEntry` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NULL,
    `parentEntryId` VARCHAR(191) NULL,
    `entryDate` DATETIME(3) NOT NULL,
    `hours` DECIMAL(8, 2) NOT NULL,
    `type` ENUM('WORK', 'ADJUSTMENT') NOT NULL DEFAULT 'WORK',
    `source` ENUM('MANUAL', 'WHATSAPP', 'GITHUB_PROMPT', 'MANAGER_BULK') NOT NULL,
    `note` TEXT NULL,
    `externalRef` VARCHAR(191) NULL,
    `rateSnapshot` JSON NOT NULL,
    `costSnapshot` JSON NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TimeEntry_tenantId_userId_entryDate_idx`(`tenantId`, `userId`, `entryDate`),
    INDEX `TimeEntry_tenantId_projectId_entryDate_idx`(`tenantId`, `projectId`, `entryDate`),
    INDEX `TimeEntry_tenantId_taskId_entryDate_idx`(`tenantId`, `taskId`, `entryDate`),
    INDEX `TimeEntry_tenantId_source_entryDate_idx`(`tenantId`, `source`, `entryDate`),
    INDEX `TimeEntry_tenantId_parentEntryId_idx`(`tenantId`, `parentEntryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimeEntryUnlock` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `timeEntryId` VARCHAR(191) NOT NULL,
    `unlockedBy` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TimeEntryUnlock_tenantId_timeEntryId_idx`(`tenantId`, `timeEntryId`),
    INDEX `TimeEntryUnlock_tenantId_unlockedBy_createdAt_idx`(`tenantId`, `unlockedBy`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateCard` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `hourlyRate` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RateCard_tenantId_userId_effectiveFrom_idx`(`tenantId`, `userId`, `effectiveFrom`),
    INDEX `RateCard_tenantId_userId_isActive_idx`(`tenantId`, `userId`, `isActive`),
    UNIQUE INDEX `RateCard_tenantId_userId_effectiveFrom_key`(`tenantId`, `userId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetAlert` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `threshold` ENUM('P80', 'P100', 'P120') NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'ACKNOWLEDGED') NOT NULL DEFAULT 'PENDING',
    `triggeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `burnAmountSnapshot` DECIMAL(12, 2) NOT NULL,
    `budgetAmountSnapshot` DECIMAL(12, 2) NOT NULL,
    `notificationEventId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BudgetAlert_tenantId_projectId_status_idx`(`tenantId`, `projectId`, `status`),
    UNIQUE INDEX `BudgetAlert_tenantId_projectId_threshold_key`(`tenantId`, `projectId`, `threshold`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TimeEntry` ADD CONSTRAINT `TimeEntry_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeEntry` ADD CONSTRAINT `TimeEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeEntry` ADD CONSTRAINT `TimeEntry_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeEntry` ADD CONSTRAINT `TimeEntry_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeEntry` ADD CONSTRAINT `TimeEntry_parentEntryId_fkey` FOREIGN KEY (`parentEntryId`) REFERENCES `TimeEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeEntryUnlock` ADD CONSTRAINT `TimeEntryUnlock_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeEntryUnlock` ADD CONSTRAINT `TimeEntryUnlock_timeEntryId_fkey` FOREIGN KEY (`timeEntryId`) REFERENCES `TimeEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeEntryUnlock` ADD CONSTRAINT `TimeEntryUnlock_unlockedBy_fkey` FOREIGN KEY (`unlockedBy`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RateCard` ADD CONSTRAINT `RateCard_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RateCard` ADD CONSTRAINT `RateCard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetAlert` ADD CONSTRAINT `BudgetAlert_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetAlert` ADD CONSTRAINT `BudgetAlert_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

