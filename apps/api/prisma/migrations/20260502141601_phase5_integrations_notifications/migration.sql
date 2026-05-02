-- AlterTable
ALTER TABLE `AttendanceRegularizationRequest` ADD COLUMN `requestCode` INTEGER NULL;

-- AlterTable
ALTER TABLE `Expense` ADD COLUMN `requestCode` INTEGER NULL;

-- AlterTable
ALTER TABLE `LeaveRequest` ADD COLUMN `requestCode` INTEGER NULL;

-- AlterTable
ALTER TABLE `NotificationEvent` ADD COLUMN `body` VARCHAR(191) NULL,
    ADD COLUMN `eventKey` VARCHAR(191) NULL,
    ADD COLUMN `isRead` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `priority` ENUM('LOW', 'NORMAL', 'HIGH') NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN `readAt` DATETIME(3) NULL,
    ADD COLUMN `source` ENUM('SYSTEM', 'WHATSAPP', 'GITHUB', 'SLACK', 'EMAIL') NOT NULL DEFAULT 'SYSTEM',
    ADD COLUMN `title` VARCHAR(191) NULL,
    MODIFY `channel` ENUM('WHATSAPP', 'EMAIL', 'SLACK', 'IN_APP') NOT NULL;

UPDATE `NotificationEvent` SET `eventKey` = CONCAT('legacy-', `id`) WHERE `eventKey` IS NULL;

ALTER TABLE `NotificationEvent` MODIFY `eventKey` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `WfhRequest` ADD COLUMN `requestCode` INTEGER NULL;

-- CreateTable
CREATE TABLE `NotificationDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `channel` ENUM('WHATSAPP', 'EMAIL', 'SLACK', 'IN_APP') NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `dedupeKey` VARCHAR(191) NOT NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `providerMessageId` VARCHAR(191) NULL,
    `providerResponse` JSON NULL,
    `errorMessage` VARCHAR(191) NULL,
    `lastAttemptAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NotificationDelivery_tenantId_status_createdAt_idx`(`tenantId`, `status`, `createdAt`),
    INDEX `NotificationDelivery_tenantId_eventId_channel_idx`(`tenantId`, `eventId`, `channel`),
    INDEX `NotificationDelivery_tenantId_userId_channel_status_idx`(`tenantId`, `userId`, `channel`, `status`),
    UNIQUE INDEX `NotificationDelivery_tenantId_dedupeKey_key`(`tenantId`, `dedupeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntegrationSetting` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `type` ENUM('WHATSAPP', 'GITHUB', 'SLACK', 'EMAIL') NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `config` JSON NULL,
    `encryptedSecrets` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IntegrationSetting_tenantId_enabled_idx`(`tenantId`, `enabled`),
    UNIQUE INDEX `IntegrationSetting_tenantId_type_key`(`tenantId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsAppSession` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `waUserPhone` VARCHAR(191) NOT NULL,
    `waConversationId` VARCHAR(191) NULL,
    `lastInboundAt` DATETIME(3) NOT NULL,
    `lastOutboundAt` DATETIME(3) NULL,
    `isWithin24hWindow` BOOLEAN NOT NULL DEFAULT true,
    `state` ENUM('IDLE', 'ACTIVE', 'AWAITING_CONFIRMATION') NOT NULL DEFAULT 'IDLE',
    `stateData` JSON NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WhatsAppSession_tenantId_waUserPhone_updatedAt_idx`(`tenantId`, `waUserPhone`, `updatedAt`),
    INDEX `WhatsAppSession_tenantId_expiresAt_idx`(`tenantId`, `expiresAt`),
    UNIQUE INDEX `WhatsAppSession_tenantId_userId_key`(`tenantId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsAppMessage` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `waUserPhone` VARCHAR(191) NOT NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    `messageType` ENUM('TEXT', 'TEMPLATE', 'INTERACTIVE', 'COMMAND') NOT NULL,
    `textBody` VARCHAR(191) NULL,
    `commandName` VARCHAR(191) NULL,
    `rawPayload` JSON NOT NULL,
    `parsedCommand` JSON NULL,
    `status` ENUM('RECEIVED', 'PROCESSED', 'QUEUED', 'SENT', 'FAILED') NOT NULL DEFAULT 'RECEIVED',
    `providerMessageId` VARCHAR(191) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WhatsAppMessage_tenantId_waUserPhone_createdAt_idx`(`tenantId`, `waUserPhone`, `createdAt`),
    INDEX `WhatsAppMessage_tenantId_userId_createdAt_idx`(`tenantId`, `userId`, `createdAt`),
    INDEX `WhatsAppMessage_tenantId_direction_status_idx`(`tenantId`, `direction`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GitHubWebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `integrationSettingId` VARCHAR(191) NULL,
    `deliveryId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `signatureHeader` VARCHAR(191) NULL,
    `payloadHash` VARCHAR(191) NOT NULL,
    `headers` JSON NULL,
    `rawPayload` JSON NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('RECEIVED', 'PROCESSED', 'DUPLICATE', 'FAILED') NOT NULL DEFAULT 'RECEIVED',
    `errorMessage` VARCHAR(191) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GitHubWebhookEvent_tenantId_eventType_receivedAt_idx`(`tenantId`, `eventType`, `receivedAt`),
    INDEX `GitHubWebhookEvent_tenantId_status_receivedAt_idx`(`tenantId`, `status`, `receivedAt`),
    UNIQUE INDEX `GitHubWebhookEvent_tenantId_deliveryId_key`(`tenantId`, `deliveryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GitHubIdentityMap` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` ENUM('USERNAME', 'EMAIL') NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GitHubIdentityMap_tenantId_userId_isActive_idx`(`tenantId`, `userId`, `isActive`),
    UNIQUE INDEX `GitHubIdentityMap_tenantId_kind_value_key`(`tenantId`, `kind`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GitHubCommitMapping` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sourceEventId` VARCHAR(191) NULL,
    `commitSha` VARCHAR(191) NOT NULL,
    `repository` VARCHAR(191) NULL,
    `branchName` VARCHAR(191) NULL,
    `commitMessage` VARCHAR(191) NULL,
    `authorLogin` VARCHAR(191) NULL,
    `authorEmail` VARCHAR(191) NULL,
    `commitUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GitHubCommitMapping_tenantId_taskId_createdAt_idx`(`tenantId`, `taskId`, `createdAt`),
    INDEX `GitHubCommitMapping_tenantId_userId_createdAt_idx`(`tenantId`, `userId`, `createdAt`),
    UNIQUE INDEX `GitHubCommitMapping_tenantId_commitSha_taskId_key`(`tenantId`, `commitSha`, `taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GitHubUnmatchedCommit` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `sourceEventId` VARCHAR(191) NULL,
    `commitSha` VARCHAR(191) NOT NULL,
    `repository` VARCHAR(191) NULL,
    `branchName` VARCHAR(191) NULL,
    `commitMessage` VARCHAR(191) NULL,
    `authorLogin` VARCHAR(191) NULL,
    `authorEmail` VARCHAR(191) NULL,
    `candidateText` VARCHAR(191) NULL,
    `authorUserId` VARCHAR(191) NULL,
    `mappedTaskId` VARCHAR(191) NULL,
    `mappedById` VARCHAR(191) NULL,
    `mappedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GitHubUnmatchedCommit_tenantId_mappedAt_createdAt_idx`(`tenantId`, `mappedAt`, `createdAt`),
    INDEX `GitHubUnmatchedCommit_tenantId_authorLogin_authorEmail_idx`(`tenantId`, `authorLogin`, `authorEmail`),
    INDEX `GitHubUnmatchedCommit_tenantId_authorUserId_createdAt_idx`(`tenantId`, `authorUserId`, `createdAt`),
    UNIQUE INDEX `GitHubUnmatchedCommit_tenantId_commitSha_key`(`tenantId`, `commitSha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `AttendanceRegularizationRequest_tenantId_requestCode_key` ON `AttendanceRegularizationRequest`(`tenantId`, `requestCode`);

-- CreateIndex
CREATE UNIQUE INDEX `Expense_tenantId_requestCode_key` ON `Expense`(`tenantId`, `requestCode`);

-- CreateIndex
CREATE UNIQUE INDEX `LeaveRequest_tenantId_requestCode_key` ON `LeaveRequest`(`tenantId`, `requestCode`);

-- CreateIndex
CREATE INDEX `NotificationEvent_tenantId_userId_isRead_createdAt_idx` ON `NotificationEvent`(`tenantId`, `userId`, `isRead`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `NotificationEvent_tenantId_eventKey_key` ON `NotificationEvent`(`tenantId`, `eventKey`);

-- CreateIndex
CREATE UNIQUE INDEX `WfhRequest_tenantId_requestCode_key` ON `WfhRequest`(`tenantId`, `requestCode`);

-- AddForeignKey
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `NotificationEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IntegrationSetting` ADD CONSTRAINT `IntegrationSetting_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsAppSession` ADD CONSTRAINT `WhatsAppSession_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsAppSession` ADD CONSTRAINT `WhatsAppSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsAppMessage` ADD CONSTRAINT `WhatsAppMessage_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsAppMessage` ADD CONSTRAINT `WhatsAppMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsAppMessage` ADD CONSTRAINT `WhatsAppMessage_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `WhatsAppSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubWebhookEvent` ADD CONSTRAINT `GitHubWebhookEvent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubWebhookEvent` ADD CONSTRAINT `GitHubWebhookEvent_integrationSettingId_fkey` FOREIGN KEY (`integrationSettingId`) REFERENCES `IntegrationSetting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubIdentityMap` ADD CONSTRAINT `GitHubIdentityMap_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubIdentityMap` ADD CONSTRAINT `GitHubIdentityMap_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubCommitMapping` ADD CONSTRAINT `GitHubCommitMapping_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubCommitMapping` ADD CONSTRAINT `GitHubCommitMapping_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubCommitMapping` ADD CONSTRAINT `GitHubCommitMapping_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubCommitMapping` ADD CONSTRAINT `GitHubCommitMapping_sourceEventId_fkey` FOREIGN KEY (`sourceEventId`) REFERENCES `GitHubWebhookEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubUnmatchedCommit` ADD CONSTRAINT `GitHubUnmatchedCommit_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubUnmatchedCommit` ADD CONSTRAINT `GitHubUnmatchedCommit_sourceEventId_fkey` FOREIGN KEY (`sourceEventId`) REFERENCES `GitHubWebhookEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubUnmatchedCommit` ADD CONSTRAINT `GitHubUnmatchedCommit_mappedTaskId_fkey` FOREIGN KEY (`mappedTaskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubUnmatchedCommit` ADD CONSTRAINT `GitHubUnmatchedCommit_mappedById_fkey` FOREIGN KEY (`mappedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitHubUnmatchedCommit` ADD CONSTRAINT `GitHubUnmatchedCommit_authorUserId_fkey` FOREIGN KEY (`authorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
