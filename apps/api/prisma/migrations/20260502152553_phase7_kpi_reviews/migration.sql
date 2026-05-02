-- AlterTable
ALTER TABLE `Project` ADD COLUMN `billableAmount` DECIMAL(12, 2) NULL,
    ADD COLUMN `billableCurrency` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `TaskStatusTransition` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `fromStatusId` VARCHAR(191) NULL,
    `toStatusId` VARCHAR(191) NOT NULL,
    `enteredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `changedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskStatusTransition_tenantId_taskId_enteredAt_idx`(`tenantId`, `taskId`, `enteredAt`),
    INDEX `TaskStatusTransition_tenantId_projectId_enteredAt_idx`(`tenantId`, `projectId`, `enteredAt`),
    INDEX `TaskStatusTransition_tenantId_toStatusId_enteredAt_idx`(`tenantId`, `toStatusId`, `enteredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewCycle` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReviewCycle_tenantId_status_year_month_idx`(`tenantId`, `status`, `year`, `month`),
    UNIQUE INDEX `ReviewCycle_tenantId_year_month_key`(`tenantId`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewEntry` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `cycleId` VARCHAR(191) NOT NULL,
    `reviewedUserId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `overallRating` INTEGER NOT NULL,
    `strengths` TEXT NULL,
    `improvements` TEXT NULL,
    `summary` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED') NOT NULL DEFAULT 'DRAFT',
    `submittedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReviewEntry_tenantId_cycleId_status_idx`(`tenantId`, `cycleId`, `status`),
    INDEX `ReviewEntry_tenantId_reviewedUserId_status_idx`(`tenantId`, `reviewedUserId`, `status`),
    INDEX `ReviewEntry_tenantId_reviewerId_status_idx`(`tenantId`, `reviewerId`, `status`),
    UNIQUE INDEX `ReviewEntry_tenantId_cycleId_reviewedUserId_reviewerId_key`(`tenantId`, `cycleId`, `reviewedUserId`, `reviewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Task_tenantId_assigneeId_createdAt_idx` ON `Task`(`tenantId`, `assigneeId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `TaskStatusTransition` ADD CONSTRAINT `TaskStatusTransition_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskStatusTransition` ADD CONSTRAINT `TaskStatusTransition_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskStatusTransition` ADD CONSTRAINT `TaskStatusTransition_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskStatusTransition` ADD CONSTRAINT `TaskStatusTransition_toStatusId_fkey` FOREIGN KEY (`toStatusId`) REFERENCES `TaskStatus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewCycle` ADD CONSTRAINT `ReviewCycle_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewCycle` ADD CONSTRAINT `ReviewCycle_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewEntry` ADD CONSTRAINT `ReviewEntry_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewEntry` ADD CONSTRAINT `ReviewEntry_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `ReviewCycle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewEntry` ADD CONSTRAINT `ReviewEntry_reviewedUserId_fkey` FOREIGN KEY (`reviewedUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewEntry` ADD CONSTRAINT `ReviewEntry_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewEntry` ADD CONSTRAINT `ReviewEntry_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

