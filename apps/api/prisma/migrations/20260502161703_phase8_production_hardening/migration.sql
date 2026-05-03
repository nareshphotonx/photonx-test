-- AlterTable
ALTER TABLE `AuditLog`
    ADD COLUMN `requestId` VARCHAR(191) NULL,
    ADD COLUMN `ipAddress` VARCHAR(191) NULL,
    ADD COLUMN `userAgent` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ComplianceRequest` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `targetUserId` VARCHAR(191) NOT NULL,
    `type` ENUM('DATA_EXPORT', 'DATA_ERASURE') NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `reason` TEXT NULL,
    `requestMeta` JSON NULL,
    `resultMeta` JSON NULL,
    `encryptedPayload` LONGTEXT NULL,
    `failureReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `processedAt` DATETIME(3) NULL,

    INDEX `ComplianceRequest_tenantId_requestedById_createdAt_idx`(`tenantId`, `requestedById`, `createdAt`),
    INDEX `ComplianceRequest_tenantId_status_createdAt_idx`(`tenantId`, `status`, `createdAt`),
    INDEX `ComplianceRequest_tenantId_type_createdAt_idx`(`tenantId`, `type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_createdAt_idx` ON `AuditLog`(`tenantId`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_action_createdAt_idx` ON `AuditLog`(`tenantId`, `action`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_actorId_createdAt_idx` ON `AuditLog`(`tenantId`, `actorId`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_entityType_entityId_createdAt_idx` ON `AuditLog`(`tenantId`, `entityType`, `entityId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `ComplianceRequest` ADD CONSTRAINT `ComplianceRequest_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceRequest` ADD CONSTRAINT `ComplianceRequest_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplianceRequest` ADD CONSTRAINT `ComplianceRequest_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
