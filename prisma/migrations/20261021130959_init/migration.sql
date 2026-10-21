-- CreateTable
CREATE TABLE `AdminUser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` TEXT NOT NULL,
    `name` TEXT NOT NULL,
    `role` TEXT NOT NULL DEFAULT 'ADMIN',
    `sessionVersion` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUser_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `handle` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `bodyHtml` MEDIUMTEXT NOT NULL DEFAULT '',
    `vendor` TEXT NOT NULL DEFAULT 'Cozy Furnitures',
    `productType` TEXT NOT NULL DEFAULT '',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `hot` BOOLEAN NOT NULL DEFAULT false,
    `tags` TEXT NOT NULL DEFAULT '',
    `options` TEXT NOT NULL DEFAULT '[]',
    `rating` DOUBLE NOT NULL DEFAULT 4.9,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isNew` BOOLEAN NOT NULL DEFAULT false,
    `limitedEdition` BOOLEAN NOT NULL DEFAULT false,
    `layout` VARCHAR(191) NOT NULL DEFAULT 'default',
    `deliveryTime` TEXT NOT NULL DEFAULT '',
    `discountGroup` INTEGER NULL,
    `cardImageRatio` DOUBLE NULL,
    `trackStock` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Product_handle_key`(`handle`),
    INDEX `Product_status_hot_idx`(`status`, `hot`),
    INDEX `Product_title_idx`(`title`),
    INDEX `Product_layout_idx`(`layout`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Variant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `title` TEXT NOT NULL DEFAULT 'Default Title',
    `sku` TEXT NULL,
    `price` INTEGER NOT NULL,
    `compareAtPrice` INTEGER NULL,
    `option1` TEXT NULL,
    `option2` TEXT NULL,
    `option3` TEXT NULL,
    `inventory` INTEGER NOT NULL DEFAULT 50,
    `position` INTEGER NOT NULL DEFAULT 0,
    `weightGrams` INTEGER NOT NULL DEFAULT 0,
    `status` TEXT NOT NULL DEFAULT 'READY_TO_SHIP',
    `stock` INTEGER NULL,

    INDEX `Variant_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductImage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `src` TEXT NOT NULL,
    `alt` TEXT NOT NULL DEFAULT '',
    `position` INTEGER NOT NULL DEFAULT 0,
    `optionValueId` INTEGER NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,

    INDEX `ProductImage_productId_idx`(`productId`),
    INDEX `ProductImage_optionValueId_idx`(`optionValueId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `name` TEXT NOT NULL,
    `position` INTEGER NOT NULL,

    INDEX `ProductOption_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductOptionValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `optionId` INTEGER NOT NULL,
    `value` TEXT NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `swatchColor` TEXT NULL,
    `swatchImage` TEXT NULL,

    INDEX `ProductOptionValue_optionId_idx`(`optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Collection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `handle` VARCHAR(191) NOT NULL,
    `title` TEXT NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `image` TEXT NULL,
    `parentId` INTEGER NULL,
    `metafield` TEXT NOT NULL DEFAULT '{}',

    UNIQUE INDEX `Collection_handle_key`(`handle`),
    INDEX `Collection_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollectionIndexCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `position` INTEGER NOT NULL DEFAULT 0,
    `collectionId` INTEGER NULL,
    `systemHandle` VARCHAR(191) NULL,
    `systemTitle` TEXT NULL,
    `systemImage` TEXT NULL,
    `placeholder` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `CollectionIndexCard_collectionId_key`(`collectionId`),
    UNIQUE INDEX `CollectionIndexCard_systemHandle_key`(`systemHandle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` TEXT NOT NULL,
    `href` TEXT NOT NULL,
    `location` VARCHAR(191) NOT NULL DEFAULT 'MAIN',
    `parentId` INTEGER NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `badge` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `newColumn` BOOLEAN NOT NULL DEFAULT true,

    INDEX `MenuItem_location_parentId_idx`(`location`, `parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Banner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` TEXT NOT NULL DEFAULT '',
    `href` TEXT NULL,
    `image` TEXT NOT NULL,
    `mobileImage` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Page` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `handle` VARCHAR(191) NOT NULL,
    `title` TEXT NOT NULL,
    `bodyHtml` MEDIUMTEXT NOT NULL DEFAULT '',
    `published` BOOLEAN NOT NULL DEFAULT true,
    `isBlogPost` BOOLEAN NOT NULL DEFAULT false,
    `seoTitle` TEXT NULL,
    `seoDescription` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'TEXT',
    `publishedAt` DATETIME(3) NULL,
    `author` TEXT NOT NULL DEFAULT '',
    `featuredImage` TEXT NULL,
    `featuredImageWidth` INTEGER NULL,
    `featuredImageHeight` INTEGER NULL,
    `tags` TEXT NOT NULL DEFAULT '',

    UNIQUE INDEX `Page_handle_key`(`handle`),
    INDEX `Page_kind_published_idx`(`kind`, `published`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `author` TEXT NOT NULL,
    `rating` INTEGER NOT NULL,
    `title` TEXT NOT NULL DEFAULT '',
    `body` TEXT NOT NULL,
    `approved` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactSubmission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` TEXT NOT NULL,
    `email` TEXT NOT NULL DEFAULT '',
    `phone` TEXT NOT NULL DEFAULT '',
    `subject` TEXT NOT NULL DEFAULT '',
    `message` TEXT NOT NULL,
    `status` TEXT NOT NULL DEFAULT 'NEW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL DEFAULT '',

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Upload` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `originalName` TEXT NOT NULL DEFAULT '',
    `mime` TEXT NOT NULL DEFAULT 'image/webp',
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `bytes` INTEGER NOT NULL,
    `purpose` TEXT NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Upload_key_key`(`key`),
    UNIQUE INDEX `Upload_url_key`(`url`),
    INDEX `Upload_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsAppInquiry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `kind` TEXT NOT NULL,
    `productId` INTEGER NULL,
    `productTitle` TEXT NOT NULL DEFAULT '',
    `variantId` INTEGER NULL,
    `variantSummary` TEXT NOT NULL DEFAULT '',
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` INTEGER NULL,
    `pagePath` TEXT NOT NULL DEFAULT '',

    INDEX `WhatsAppInquiry_createdAt_idx`(`createdAt`),
    INDEX `WhatsAppInquiry_productId_createdAt_idx`(`productId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MigrationStep` (
    `id` VARCHAR(191) NOT NULL,
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `summary` TEXT NOT NULL DEFAULT '',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductLayout` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `previousVersion` MEDIUMTEXT NULL,
    `originalVersion` MEDIUMTEXT NULL,

    UNIQUE INDEX `ProductLayout_key_key`(`key`),
    UNIQUE INDEX `ProductLayout_nameKey_key`(`nameKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductLayoutPreview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `layoutId` INTEGER NOT NULL,
    `sections` MEDIUMTEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductLayoutPreview_token_key`(`token`),
    INDEX `ProductLayoutPreview_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductLayoutSection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `layoutId` INTEGER NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `kind` TEXT NOT NULL,
    `hidden` BOOLEAN NOT NULL DEFAULT false,
    `bodyHtml` MEDIUMTEXT NOT NULL DEFAULT '',
    `data` MEDIUMTEXT NOT NULL DEFAULT '{}',
    `refs` MEDIUMTEXT NOT NULL DEFAULT '',
    `collectionId` INTEGER NULL,

    INDEX `ProductLayoutSection_layoutId_position_idx`(`layoutId`, `position`),
    INDEX `ProductLayoutSection_collectionId_idx`(`collectionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ProductCollections` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_ProductCollections_AB_unique`(`A`, `B`),
    INDEX `_ProductCollections_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Variant` ADD CONSTRAINT `Variant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_optionValueId_fkey` FOREIGN KEY (`optionValueId`) REFERENCES `ProductOptionValue`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductOption` ADD CONSTRAINT `ProductOption_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductOptionValue` ADD CONSTRAINT `ProductOptionValue_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `ProductOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Collection` ADD CONSTRAINT `Collection_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Collection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollectionIndexCard` ADD CONSTRAINT `CollectionIndexCard_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `Collection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MenuItem` ADD CONSTRAINT `MenuItem_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `MenuItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsAppInquiry` ADD CONSTRAINT `WhatsAppInquiry_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductLayoutPreview` ADD CONSTRAINT `ProductLayoutPreview_layoutId_fkey` FOREIGN KEY (`layoutId`) REFERENCES `ProductLayout`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductLayoutSection` ADD CONSTRAINT `ProductLayoutSection_layoutId_fkey` FOREIGN KEY (`layoutId`) REFERENCES `ProductLayout`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductLayoutSection` ADD CONSTRAINT `ProductLayoutSection_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `Collection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductCollections` ADD CONSTRAINT `_ProductCollections_A_fkey` FOREIGN KEY (`A`) REFERENCES `Collection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductCollections` ADD CONSTRAINT `_ProductCollections_B_fkey` FOREIGN KEY (`B`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
