import { sqliteTable, text, integer, real, blob, primaryKey, index } from 'drizzle-orm/sqlite-core';

const ts = (name: string) => integer(name, { mode: 'timestamp_ms' });
const bool = (name: string) => integer(name, { mode: 'boolean' });

export const team = sqliteTable('team', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  school: text('school').notNull(),
  teamNumber: text('team_number'),
  joinCodeHash: text('join_code_hash').notNull(),
  createdAt: ts('created_at').notNull(),
});

export type UserPrefs = {
  layout?: 'b' | 'a' | 'auto';
  quality?: 'low' | 'medium' | 'high';
  reduceMotion?: boolean;
  replyLength?: 'concise' | 'detailed';
  memoryEnabled?: boolean;
  mentorPanelOpen?: boolean;
  notif?: Record<string, boolean>;
};

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarText: text('avatar_text'),
  avatarColor: text('avatar_color').notNull(),
  role: text('role', { enum: ['admin', 'captain', 'member'] }).notNull(),
  teamRole: text('team_role').notNull().default('Builder'),
  grade: text('grade'),
  bio: text('bio'),
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: bool('must_change_password').notNull().default(false),
  prefs: text('prefs_json', { mode: 'json' }).$type<UserPrefs>().notNull().default({}),
  skills: text('skills_json', { mode: 'json' }).$type<string[]>().notNull().default([]),
  disabled: bool('disabled').notNull().default(false),
  createdAt: ts('created_at').notNull(),
  lastActiveAt: ts('last_active_at'),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: ts('created_at').notNull(),
  expiresAt: ts('expires_at').notNull(),
  keepSignedIn: bool('keep_signed_in').notNull().default(false),
  userAgent: text('user_agent'),
}, (t) => [index('sessions_user').on(t.userId)]);

export const seasonProfiles = sqliteTable('season_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  program: text('program').notNull(),
  years: text('years').notNull(),
  rules: text('rules_json', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  active: bool('active').notNull().default(false),
});

export const builds = sqliteTable('builds', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tagline: text('tagline'),
  drawingPrefix: text('drawing_prefix').notNull(),
  program: text('program').notNull().default('V5RC'),
  seasonProfileId: text('season_profile_id').notNull(),
  status: text('status', { enum: ['planned', 'in_progress', 'testing', 'ready', 'archived'] }).notNull().default('in_progress'),
  visibility: text('visibility', { enum: ['team', 'private'] }).notNull().default('team'),
  ownerId: text('owner_id').notNull(),
  isTeamActive: bool('is_team_active').notNull().default(false),
  currentVersionId: text('current_version_id'),
  autonStart: text('auton_start_json', { mode: 'json' }).$type<{ x: number; y: number; heading: number }>(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
  deletedAt: ts('deleted_at'),
}, (t) => [index('builds_owner').on(t.ownerId)]);

export const buildVersions = sqliteTable('build_versions', {
  id: text('id').primaryKey(),
  buildId: text('build_id').notNull(),
  version: integer('version').notNull(),
  spec: text('spec_json', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  diff: text('diff_json', { mode: 'json' }).$type<string[]>(),
  changeSummary: text('change_summary_json', { mode: 'json' }).$type<string[]>(),
  normalizeReport: text('normalize_report_json', { mode: 'json' }).$type<unknown[]>(),
  source: text('source', { enum: ['ai', 'user', 'template', 'import', 'restore'] }).notNull(),
  authorId: text('author_id').notNull(),
  messageId: text('message_id'),
  createdAt: ts('created_at').notNull(),
}, (t) => [index('versions_build').on(t.buildId)]);

export const subsystemStatus = sqliteTable('subsystem_status', {
  buildId: text('build_id').notNull(),
  subsystemId: text('subsystem_id').notNull(),
  status: text('status', { enum: ['complete', 'in_progress', 'planned'] }).notNull(),
  updatedBy: text('updated_by'),
  updatedAt: ts('updated_at').notNull(),
}, (t) => [primaryKey({ columns: [t.buildId, t.subsystemId] })]);

export const customParts = sqliteTable('custom_parts', {
  id: text('id').primaryKey(),
  buildId: text('build_id').notNull(),
  name: text('name').notNull(),
  template: text('template').notNull(),
  params: text('params_json', { mode: 'json' }).$type<Record<string, number | string | boolean>>().notNull(),
  material: text('material').notNull().default('PLA'),
  color: text('color').notNull().default('black'),
  defaultQty: integer('default_qty').notNull().default(1),
  purpose: text('purpose'),
  legality: text('legality', { enum: ['practice', 'decoration', 'license_plate', 'vexu_vai_only'] }).notNull().default('practice'),
  uploadId: text('upload_id'),
  createdBy: text('created_by').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
}, (t) => [index('parts_build').on(t.buildId)]);

export const printers = sqliteTable('printers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  model: text('model').notNull(),
  adapter: text('adapter', { enum: ['simulated', 'octoprint', 'moonraker'] }).notNull().default('simulated'),
  baseUrl: text('base_url'),
  apiKeyEnc: text('api_key_enc'),
  materials: text('materials_json', { mode: 'json' }).$type<string[]>().notNull(),
  bedMm: text('bed_mm_json', { mode: 'json' }).$type<[number, number, number]>().notNull(),
  throughputGPerMin: real('throughput_g_per_min').notNull().default(0.35),
  online: bool('online').notNull().default(true),
  lastSeenAt: ts('last_seen_at'),
  simFrozen: bool('sim_frozen').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type JobHistory = { at: number; status: string; by?: string; note?: string }[];

export const printJobs = sqliteTable('print_jobs', {
  id: text('id').primaryKey(),
  customPartId: text('custom_part_id'),
  uploadId: text('upload_id'),
  name: text('name').notNull(),
  shortLabel: text('short_label').notNull(),
  material: text('material').notNull(),
  color: text('color').notNull(),
  layerHeightMm: real('layer_height_mm').notNull().default(0.2),
  infillPct: integer('infill_pct').notNull().default(20),
  quantity: integer('quantity').notNull().default(1),
  printerId: text('printer_id'),
  status: text('status', { enum: ['queued', 'printing', 'paused', 'completed', 'failed', 'canceled'] }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  estSeconds: integer('est_seconds').notNull(),
  estGrams: real('est_grams').notNull().default(0),
  startedAt: ts('started_at'),
  pausedAt: ts('paused_at'),
  pausedMs: integer('paused_ms').notNull().default(0),
  finishedAt: ts('finished_at'),
  pickedUp: bool('picked_up').notNull().default(false),
  requestedBy: text('requested_by').notNull(),
  notes: text('notes'),
  failReason: text('fail_reason'),
  history: text('history_json', { mode: 'json' }).$type<JobHistory>().notNull().default([]),
  createdAt: ts('created_at').notNull(),
}, (t) => [index('jobs_status').on(t.status), index('jobs_created').on(t.createdAt)]);

export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  sha256: text('sha256').notNull(),
  kind: text('kind', { enum: ['stl', '3mf', 'gcode', 'image', 'pdf', 'text', 'other'] }).notNull(),
  storageKey: text('storage_key').notNull(),
  category: text('category'),
  title: text('title'),
  useForAi: bool('use_for_ai').notNull().default(false),
  createdAt: ts('created_at').notNull(),
});

export const inventoryItems = sqliteTable('inventory_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku'),
  category: text('category', { enum: ['screws_hardware', 'vex_structural', 'motors_electronics', 'printed_parts'] }).notNull(),
  subcategory: text('subcategory').notNull().default(''),
  unit: text('unit').notNull().default('pcs'),
  qtyOnHand: integer('qty_on_hand').notNull().default(0),
  minQty: integer('min_qty').notNull().default(0),
  location: text('location'),
  supplier: text('supplier'),
  url: text('url'),
  catalogPartId: text('catalog_part_id'),
  notes: text('notes'),
  wasLow: bool('was_low').notNull().default(false),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
}, (t) => [index('inv_category').on(t.category)]);

export const inventoryReservations = sqliteTable('inventory_reservations', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull(),
  buildId: text('build_id').notNull(),
  qty: integer('qty').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const inventoryHistory = sqliteTable('inventory_history', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull(),
  delta: integer('delta').notNull(),
  reason: text('reason'),
  actorId: text('actor_id').notNull(),
  createdAt: ts('created_at').notNull(),
}, (t) => [index('invh_item').on(t.itemId)]);

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  itemId: text('item_id'),
  name: text('name').notNull(),
  sku: text('sku'),
  qty: integer('qty').notNull(),
  status: text('status', { enum: ['requested', 'ordered', 'received', 'canceled'] }).notNull(),
  requestedBy: text('requested_by').notNull(),
  updatedBy: text('updated_by'),
  eta: text('eta'),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  buildId: text('build_id'),
  competitionId: text('competition_id'),
  title: text('title').notNull(),
  category: text('category', { enum: ['mechanical', 'electronics', 'code', 'testing', 'notebook'] }).notNull(),
  status: text('status', { enum: ['todo', 'doing', 'done'] }).notNull(),
  assigneeId: text('assignee_id'),
  dueDate: text('due_date'),
  weight: integer('weight').notNull().default(1),
  completedAt: ts('completed_at'),
  createdBy: text('created_by').notNull(),
  createdAt: ts('created_at').notNull(),
}, (t) => [index('tasks_comp').on(t.competitionId)]);

export const competitions = sqliteTable('competitions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  location: text('location'),
  program: text('program').notNull().default('V5RC'),
  url: text('url'),
  notes: text('notes'),
  isTarget: bool('is_target').notNull().default(false),
  packing: text('packing_json', { mode: 'json' }).$type<{ text: string; done: boolean }[]>().notNull().default([]),
  matchNotes: text('match_notes'),
  results: text('results_json', { mode: 'json' }).$type<{ rank?: string; awards?: string; notes?: string }>(),
  createdAt: ts('created_at').notNull(),
});

export const activity = sqliteTable('activity', {
  id: text('id').primaryKey(),
  actorId: text('actor_id'),
  type: text('type').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  data: text('data_json', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  privateTo: text('private_to'),
  createdAt: ts('created_at').notNull(),
}, (t) => [index('activity_created').on(t.createdAt)]);

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'),
  readAt: ts('read_at'),
  createdAt: ts('created_at').notNull(),
}, (t) => [index('notif_user').on(t.userId)]);

export const codeFiles = sqliteTable('code_files', {
  id: text('id').primaryKey(),
  buildId: text('build_id').notNull(),
  path: text('path').notNull(),
  content: text('content').notNull(),
  generated: bool('generated').notNull().default(false),
  updatedBy: text('updated_by'),
  updatedAt: ts('updated_at').notNull(),
}, (t) => [index('code_build').on(t.buildId)]);

export const codeVersions = sqliteTable('code_versions', {
  id: text('id').primaryKey(),
  fileId: text('file_id').notNull(),
  content: text('content').notNull(),
  authorId: text('author_id'),
  message: text('message'),
  createdAt: ts('created_at').notNull(),
}, (t) => [index('codev_file').on(t.fileId)]);

export type Diagnostic = { file: string; line: number; col: number; severity: 'error' | 'warning' | 'note'; message: string };

export const compileResults = sqliteTable('compile_results', {
  id: text('id').primaryKey(),
  buildId: text('build_id').notNull(),
  userId: text('user_id').notNull(),
  ok: bool('ok').notNull(),
  engine: text('engine').notNull(),
  diagnostics: text('diagnostics_json', { mode: 'json' }).$type<Diagnostic[]>().notNull(),
  createdAt: ts('created_at').notNull(),
}, (t) => [index('compile_build').on(t.buildId)]);

export const brainPresence = sqliteTable('brain_presence', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  portLabel: text('port_label'),
  lastSeenAt: ts('last_seen_at').notNull(),
});

export const chatThreads = sqliteTable('chat_threads', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  buildId: text('build_id'),
  title: text('title').notNull(),
  summary: text('summary'),
  archived: bool('archived').notNull().default(false),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
}, (t) => [index('threads_user').on(t.userId)]);

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull(),
  role: text('role', { enum: ['user', 'assistant', 'note'] }).notNull(),
  content: text('content').notNull(),
  envelope: text('envelope_json', { mode: 'json' }).$type<Record<string, unknown>>(),
  applied: text('applied_json', { mode: 'json' }).$type<Record<string, unknown>>(),
  pendingDone: text('pending_done_json', { mode: 'json' }).$type<Record<string, boolean>>().notNull().default({}),
  target: text('target'),
  model: text('model'),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  latencyMs: integer('latency_ms'),
  feedback: integer('feedback'),
  flagged: bool('flagged').notNull().default(false),
  createdAt: ts('created_at').notNull(),
}, (t) => [index('msgs_thread').on(t.threadId)]);

export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  category: text('category', { enum: ['preference', 'skill', 'goal', 'project', 'role', 'struggle'] }).notNull(),
  text: text('text').notNull(),
  importance: integer('importance').notNull().default(3),
  pinned: bool('pinned').notNull().default(false),
  embedding: blob('embedding', { mode: 'buffer' }),
  sourceMessageId: text('source_message_id'),
  lastUsedAt: ts('last_used_at'),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
}, (t) => [index('mem_user').on(t.userId)]);

export const knowledgeChunks = sqliteTable('knowledge_chunks', {
  id: text('id').primaryKey(),
  uploadId: text('upload_id').notNull(),
  idx: integer('idx').notNull(),
  text: text('text').notNull(),
  page: integer('page'),
  ruleIds: text('rule_ids_json', { mode: 'json' }).$type<string[]>().notNull().default([]),
  embedding: blob('embedding', { mode: 'buffer' }),
}, (t) => [index('kc_upload').on(t.uploadId)]);

export const aiUsage = sqliteTable('ai_usage', {
  userId: text('user_id').notNull(),
  day: text('day').notNull(),
  requests: integer('requests').notNull().default(0),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.day] })]);

export const aiFlags = sqliteTable('ai_flags', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull(),
  userId: text('user_id').notNull(),
  reason: text('reason'),
  status: text('status').notNull().default('open'),
  createdAt: ts('created_at').notNull(),
});

export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull(),
});

export const settingsKv = sqliteTable('settings_kv', {
  key: text('key').primaryKey(),
  value: text('value_json', { mode: 'json' }).$type<unknown>().notNull(),
});
