CREATE TABLE `upload_chunks` (
	`upload_id` text NOT NULL,
	`idx` integer NOT NULL,
	`data` blob NOT NULL,
	PRIMARY KEY(`upload_id`, `idx`)
);
