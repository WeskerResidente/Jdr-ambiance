CREATE DATABASE IF NOT EXISTS `jdr_ambiances`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `jdr_ambiances`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) PRIMARY KEY,
  `email` VARCHAR(190) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL UNIQUE,
  `created_at` DATETIME NOT NULL,
  `expires_at` DATETIME NOT NULL,
  INDEX `idx_sessions_user_id` (`user_id`),
  INDEX `idx_sessions_expires_at` (`expires_at`),
  CONSTRAINT `fk_sessions_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_sync` (
  `user_id` CHAR(36) PRIMARY KEY,
  `data` LONGTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL,
  CONSTRAINT `fk_user_sync_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_sounds` (
  `user_id` CHAR(36) NOT NULL,
  `item_id` VARCHAR(190) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`, `item_id`),
  INDEX `idx_user_sounds_user_id` (`user_id`),
  CONSTRAINT `fk_user_sounds_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_sound_folders` (
  `user_id` CHAR(36) NOT NULL,
  `item_id` VARCHAR(190) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`, `item_id`),
  INDEX `idx_user_sound_folders_user_id` (`user_id`),
  CONSTRAINT `fk_user_sound_folders_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_custom_sounds` (
  `user_id` CHAR(36) NOT NULL,
  `item_id` VARCHAR(190) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`, `item_id`),
  INDEX `idx_user_custom_sounds_user_id` (`user_id`),
  CONSTRAINT `fk_user_custom_sounds_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_campaign_images` (
  `user_id` CHAR(36) NOT NULL,
  `item_id` VARCHAR(190) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`, `item_id`),
  INDEX `idx_user_campaign_images_user_id` (`user_id`),
  CONSTRAINT `fk_user_campaign_images_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_external_links` (
  `user_id` CHAR(36) NOT NULL,
  `item_id` VARCHAR(190) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`, `item_id`),
  INDEX `idx_user_external_links_user_id` (`user_id`),
  CONSTRAINT `fk_user_external_links_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_scenes` (
  `user_id` CHAR(36) NOT NULL,
  `item_id` VARCHAR(190) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`, `item_id`),
  INDEX `idx_user_scenes_user_id` (`user_id`),
  CONSTRAINT `fk_user_scenes_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_favorite_categories` (
  `user_id` CHAR(36) NOT NULL,
  `item_id` VARCHAR(190) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`, `item_id`),
  INDEX `idx_user_favorite_categories_user_id` (`user_id`),
  CONSTRAINT `fk_user_favorite_categories_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
