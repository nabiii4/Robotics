CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`data_json` text DEFAULT '{}' NOT NULL,
	`private_to` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_created` ON `activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `ai_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `brain_presence` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`port_label` text,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `build_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`build_id` text NOT NULL,
	`version` integer NOT NULL,
	`spec_json` text NOT NULL,
	`diff_json` text,
	`change_summary_json` text,
	`normalize_report_json` text,
	`source` text NOT NULL,
	`author_id` text NOT NULL,
	`message_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `versions_build` ON `build_versions` (`build_id`);--> statement-breakpoint
CREATE TABLE `builds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tagline` text,
	`drawing_prefix` text NOT NULL,
	`program` text DEFAULT 'V5RC' NOT NULL,
	`season_profile_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`visibility` text DEFAULT 'team' NOT NULL,
	`owner_id` text NOT NULL,
	`is_team_active` integer DEFAULT false NOT NULL,
	`current_version_id` text,
	`auton_start_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `builds_owner` ON `builds` (`owner_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`envelope_json` text,
	`applied_json` text,
	`pending_done_json` text DEFAULT '{}' NOT NULL,
	`target` text,
	`model` text,
	`tokens_in` integer,
	`tokens_out` integer,
	`latency_ms` integer,
	`feedback` integer,
	`flagged` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `msgs_thread` ON `chat_messages` (`thread_id`);--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`build_id` text,
	`title` text NOT NULL,
	`summary` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `threads_user` ON `chat_threads` (`user_id`);--> statement-breakpoint
CREATE TABLE `code_files` (
	`id` text PRIMARY KEY NOT NULL,
	`build_id` text NOT NULL,
	`path` text NOT NULL,
	`content` text NOT NULL,
	`generated` integer DEFAULT false NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `code_build` ON `code_files` (`build_id`);--> statement-breakpoint
CREATE TABLE `code_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`content` text NOT NULL,
	`author_id` text,
	`message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `codev_file` ON `code_versions` (`file_id`);--> statement-breakpoint
CREATE TABLE `competitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`location` text,
	`program` text DEFAULT 'V5RC' NOT NULL,
	`url` text,
	`notes` text,
	`is_target` integer DEFAULT false NOT NULL,
	`packing_json` text DEFAULT '[]' NOT NULL,
	`match_notes` text,
	`results_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `compile_results` (
	`id` text PRIMARY KEY NOT NULL,
	`build_id` text NOT NULL,
	`user_id` text NOT NULL,
	`ok` integer NOT NULL,
	`engine` text NOT NULL,
	`diagnostics_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `compile_build` ON `compile_results` (`build_id`);--> statement-breakpoint
CREATE TABLE `custom_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`build_id` text NOT NULL,
	`name` text NOT NULL,
	`template` text NOT NULL,
	`params_json` text NOT NULL,
	`material` text DEFAULT 'PLA' NOT NULL,
	`color` text DEFAULT 'black' NOT NULL,
	`default_qty` integer DEFAULT 1 NOT NULL,
	`purpose` text,
	`legality` text DEFAULT 'practice' NOT NULL,
	`upload_id` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `parts_build` ON `custom_parts` (`build_id`);--> statement-breakpoint
CREATE TABLE `inventory_history` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text,
	`actor_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `invh_item` ON `inventory_history` (`item_id`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text,
	`category` text NOT NULL,
	`subcategory` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`qty_on_hand` integer DEFAULT 0 NOT NULL,
	`min_qty` integer DEFAULT 0 NOT NULL,
	`location` text,
	`supplier` text,
	`url` text,
	`catalog_part_id` text,
	`notes` text,
	`was_low` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inv_category` ON `inventory_items` (`category`);--> statement-breakpoint
CREATE TABLE `inventory_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`build_id` text NOT NULL,
	`qty` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `knowledge_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_id` text NOT NULL,
	`idx` integer NOT NULL,
	`text` text NOT NULL,
	`page` integer,
	`rule_ids_json` text DEFAULT '[]' NOT NULL,
	`embedding` blob
);
--> statement-breakpoint
CREATE INDEX `kc_upload` ON `knowledge_chunks` (`upload_id`);--> statement-breakpoint
CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`text` text NOT NULL,
	`importance` integer DEFAULT 3 NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`embedding` blob,
	`source_message_id` text,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mem_user` ON `memories` (`user_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link` text,
	`read_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notif_user` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text,
	`name` text NOT NULL,
	`sku` text,
	`qty` integer NOT NULL,
	`status` text NOT NULL,
	`requested_by` text NOT NULL,
	`updated_by` text,
	`eta` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `print_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`custom_part_id` text,
	`upload_id` text,
	`name` text NOT NULL,
	`short_label` text NOT NULL,
	`material` text NOT NULL,
	`color` text NOT NULL,
	`layer_height_mm` real DEFAULT 0.2 NOT NULL,
	`infill_pct` integer DEFAULT 20 NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`printer_id` text,
	`status` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`est_seconds` integer NOT NULL,
	`est_grams` real DEFAULT 0 NOT NULL,
	`started_at` integer,
	`paused_at` integer,
	`paused_ms` integer DEFAULT 0 NOT NULL,
	`finished_at` integer,
	`picked_up` integer DEFAULT false NOT NULL,
	`requested_by` text NOT NULL,
	`notes` text,
	`fail_reason` text,
	`history_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_status` ON `print_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_created` ON `print_jobs` (`created_at`);--> statement-breakpoint
CREATE TABLE `printers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`adapter` text DEFAULT 'simulated' NOT NULL,
	`base_url` text,
	`api_key_enc` text,
	`materials_json` text NOT NULL,
	`bed_mm_json` text NOT NULL,
	`throughput_g_per_min` real DEFAULT 0.35 NOT NULL,
	`online` integer DEFAULT true NOT NULL,
	`last_seen_at` integer,
	`sim_frozen` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `season_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`program` text NOT NULL,
	`years` text NOT NULL,
	`rules_json` text NOT NULL,
	`active` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`keep_signed_in` integer DEFAULT false NOT NULL,
	`user_agent` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings_kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subsystem_status` (
	`build_id` text NOT NULL,
	`subsystem_id` text NOT NULL,
	`status` text NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`build_id`, `subsystem_id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`build_id` text,
	`competition_id` text,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`assignee_id` text,
	`due_date` text,
	`weight` integer DEFAULT 1 NOT NULL,
	`completed_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_comp` ON `tasks` (`competition_id`);--> statement-breakpoint
CREATE TABLE `team` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`school` text NOT NULL,
	`team_number` text,
	`join_code_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`kind` text NOT NULL,
	`storage_key` text NOT NULL,
	`category` text,
	`title` text,
	`use_for_ai` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_text` text,
	`avatar_color` text NOT NULL,
	`role` text NOT NULL,
	`team_role` text DEFAULT 'Builder' NOT NULL,
	`grade` text,
	`bio` text,
	`password_hash` text NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`prefs_json` text DEFAULT '{}' NOT NULL,
	`skills_json` text DEFAULT '[]' NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`last_active_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);