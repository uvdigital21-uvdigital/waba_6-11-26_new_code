# PROJECT ISSUE REGISTER & AUDIT TRACKER
**Project Name:** Official WABA (https://officialwaba.com)  
**Document Classification:** Permanent Production Issue Tracker  
**Auditor:** Principal Software Architect, Production Reliability Auditor  
**Date of Audit:** November 2026  
**Status:** READ-ONLY AUDIT COMPLETE (Code Unchanged)  

---

## Priority Classifications
- **P0 — Critical Production Problem:** Blocks core business functionality, causes visible downtime, severe delays, data invisibility, or high crash risk.
- **P1 — High Priority:** Significant performance degradation, missing indexes on large tables, or architectural bottlenecks impacting user experience.
- **P2 — Medium Priority:** Sub-optimal resource usage, redundant network requests, polling inefficiencies, or maintainability hazards.
- **P3 — Low Priority:** Code cleanup, dead code removal, minor UI polishing, or cosmetic logging improvements.

---

# SECTION 1: CURRENT LOADING ISSUES

---

### ISSUE-001
- **TITLE:** Chat Inbox Messages Intermittently Disappear and Display False Empty State
- **PRIORITY:** P0
- **STATUS:** RESOLVED & VERIFIED (2026-11-06)
- **AFFECTED PAGE OR MODULE:** Live Chat Inbox
- **LIVE URL:** https://officialwaba.com/chat
- **EXACT FILE PATH:** `frontend/src/pages/Chat.jsx`, `src/controllers/chatController.js`
- **FUNCTION OR COMPONENT:** Component: `Chat.jsx` (`handleSelectChat`, `loadMessages`, rendering block), Controller: `chatController.js:getConversations`, `getMessages`, `deleteConversation`
- **LINE NUMBER:** `Chat.jsx`: lines 66–70, 230–235, 424–430, 485–500, 831–840, 881–925, 1661–1705; `chatController.js`: lines 120–198, 803–855
- **RESOLUTION DETAILS:**
  1. **Frontend Explicit Loading & Error States:** Introduced `loadingMessages` and `messagesError` states. Rendered a dedicated spinner while messages fetch and an error banner with a "Retry" button on network/API failure. The "No messages yet" empty state only renders when `!loadingMessages && !messagesError && displayedMessages.length === 0`.
  2. **Frontend Request Sequencing & Race Condition Guards:** Added monotonic request sequence ID (`messageRequestIdRef`) and `AbortController` (`activeMessageAbortControllerRef`). Any in-flight foreground request is cleanly aborted upon switching chats. Stale responses are discarded before touching React state.
  3. **Protected 4-Second Polling & Mount Duplication:** Background 4-second polling timer verifies `!isForegroundMessageLoadingRef.current` and does not toggle foreground loading indicators or clear active data. Added `searchMountedRef` to suppress the duplicate initial conversation fetch triggered by `searchQuery`'s debounced effect on mount.
  4. **Backend SQL Filter & Pagination Consistency:** Applied `hasReplied` condition and `officialSuffix` phone exclusion directly in SQL `WHERE` clauses before pagination. Removed post-filtering in JavaScript, ensuring `COUNT(*)` matches rows returned, eliminating blank and underfilled pages.
  5. **Account Isolation & Recoverable Error:** When an invalid or unassigned `account_id` is passed, returns HTTP 404 with code `'ACCOUNT_NOT_FOUND'` instead of silently switching accounts.
  6. **Multi-Tenant Protection in `deleteConversation()`:** Strictly enforced `organization_id` scoping on conversation lookups and cascading message/tag deletions, preventing cross-tenant data deletion by phone number.
- **CURRENT BEHAVIOR:** When clicking a conversation or loading the chat inbox, message bubbles frequently vanish and the window displays *"No messages yet. Send a message to start conversing!"* even though the database contains the conversation history. In addition, existing conversations sometimes disappear from the left sidebar.
- **EXPECTED BEHAVIOR:** Opening a chat should immediately show a loading skeleton or preserve previous history while fetching new messages, never showing the empty state while an API fetch is in progress. The conversation list must consistently display all conversations belonging to the organization.
- **ROOT CAUSE:**
  1. **Frontend False Empty State:** `Chat.jsx` lines 1596–1602 check `if (displayedMessages.length === 0)` directly without verifying if `loadMessages` is in-flight. Because `loadMessages` takes 1–3 seconds (due to server-side template snapshot enrichment and database queries), the message array is empty during the transition, immediately rendering the *"No messages yet"* placeholder.
  2. **Account ID Filter Dropping Legacy/Unset Chats:** `chatController.js` line 150 enforces `whereClauses.push('c.whatsapp_account_id = ?')` when an active account is selected. Conversations that have `whatsapp_account_id IS NULL` (or were created before account binding) are completely excluded from the query results.
  3. **Aggressive Polling Race Condition:** `Chat.jsx` lines 424–429 run a 4-second `setInterval` polling `loadConversations(true)` and `loadMessages(..., true)`. If the user selects a new conversation while a previous poll is returning, the asynchronous state resolution overwrites the active message view.
- **EVIDENCE:**
  ```javascript
  // Chat.jsx line 1596
  if (displayedMessages.length === 0) {
      return (
          <div style={{ textAlign: 'center', marginTop: '40px', color: '#54656f' }}>
              <p>{inChatSearchText ? 'No messages matched your search.' : 'No messages yet. Send a message to start conversing!'}</p>
          </div>
      );
  }
  ```
  ```javascript
  // chatController.js line 149
  if (activeAccountId) {
      whereClauses.push('c.whatsapp_account_id = ?');
      queryParams.push(activeAccountId);
  }
  ```
- **IMPACT:** Support staff believe customer chat history has been lost, causing confusion, duplicate replies, and delayed customer response times.
- **ROOT CAUSE CATEGORY:** Multiple Combined Causes (Frontend UI State + Backend SQL Filter + Polling Race Condition)
- **RECOMMENDED FIX:**
  1. Add an explicit `isLoadingMessages` state in `Chat.jsx`. When true, display a spinner/skeleton loader and never render the empty state.
  2. Update `chatController.js` to allow conversations where `(c.whatsapp_account_id = ? OR c.whatsapp_account_id IS NULL)` for tenant-scoped users so legacy threads remain visible.
  3. Cancel or abort in-flight requests when switching selected conversation using an `AbortController`.
- **FILES THAT WOULD BE MODIFIED:**
  - `frontend/src/pages/Chat.jsx`
  - `src/controllers/chatController.js`
- **DATABASE IMPACT:** None (Query-only update)
- **RISK OF FIX:** Low
- **TESTING REQUIRED:** Switch rapidly between 5 different active chats; verify that messages never flicker into the empty state; test with conversations possessing `NULL` whatsapp_account_id.
- **ROLLBACK PLAN:** Revert changes in `Chat.jsx` and `chatController.js`.
- **DEPENDENCIES:** None

---

### ISSUE-002
- **TITLE:** Quick Broadcast Template Picker Indefinitely Hangs on "Loading templates..."
- **PRIORITY:** P0
- **STATUS:** CONFIRMED
- **AFFECTED PAGE OR MODULE:** Quick Broadcast
- **LIVE URL:** https://officialwaba.com/send-wa/quick
- **EXACT FILE PATH:** `src/services/templateService.js`, `frontend/src/pages/SendQuick.jsx`
- **FUNCTION OR COMPONENT:** `templateService.js:fetchMetaTemplates`, `SendQuick.jsx:fetchMetaTemplates`
- **LINE NUMBER:** `templateService.js`: lines 100–108, 170–198; `SendQuick.jsx`: lines 385–415, 423–435
- **CURRENT BEHAVIOR:** Upon opening Quick Broadcast or changing the sender number, the template selection dropdown displays *"Loading templates..."* for 10–30+ seconds or permanently fails to populate.
- **EXPECTED BEHAVIOR:** Templates should load within 200–500ms from cache or local DB, with a safe 5-second timeout on any external Meta API calls.
- **ROOT CAUSE:**
  1. **Unbounded External Meta API Call:** `templateService.js` line 103 executes `axios.get(endpoint, { headers: ... })` to Meta Graph API **without any timeout parameter**. Axios defaults to timeout `0` (infinite). If Meta Graph API has high latency or server outbound egress throttles, the HTTP request hangs indefinitely, holding the client connection open.
  2. **Synchronous File System Scans:** Lines 170–198 synchronously scan 6 physical disk directories using `fs.readdirSync()` on every cache miss, executing nested loops for every template.
  3. **Cascading Duplicate Requests in Frontend:** In `SendQuick.jsx` lines 394 & 401, `fetchMetaTemplates` calls `/meta-templates`, then immediately calls `/numbers`. Line 405 detects `nums.length > 0 && !accId` and mutates `activeAccountId`, triggering `handleSenderNumberChange` which immediately fires a second `/meta-templates` call.
- **EVIDENCE:**
  ```javascript
  // templateService.js line 103: No timeout defined
  const response = await axios.get(endpoint, {
      headers: {
          Authorization: `Bearer ${targetToken}`,
          'Content-Type': 'application/json'
      }
  });
  ```
- **IMPACT:** Operators are completely blocked from dispatching quick marketing broadcasts or transactional alerts.
- **ROOT CAUSE CATEGORY:** Multiple Combined Causes (Meta API Timeout + Backend Filesystem Overhead + Frontend Duplicate Calls)
- **RECOMMENDED FIX:**
  1. Configure Axios with an explicit `timeout: 6000` (6 seconds) and catch block falling back immediately to the local `templates` / `whatsapp_templates` tables.
  2. Remove synchronous `fs.readdirSync` from the request path; pre-index uploaded template media in MySQL.
  3. Consolidate the initial fetch in `SendQuick.jsx` so `numbers` and `meta-templates` load in a single coordinated hook without cascading triggers.
- **FILES THAT WOULD BE MODIFIED:**
  - `src/services/templateService.js`
  - `frontend/src/pages/SendQuick.jsx`
- **DATABASE IMPACT:** None
- **RISK OF FIX:** Low
- **TESTING REQUIRED:** Simulate Meta Graph API latency; verify template dropdown populates from local DB fallback within 3 seconds; verify only 1 network request to `/meta-templates` on page load.
- **ROLLBACK PLAN:** Revert `templateService.js` and `SendQuick.jsx`.
- **DEPENDENCIES:** None

---

### ISSUE-003
- **TITLE:** Sending History Report Extremely Slow or Timing Out ("Loading sending history...")
- **PRIORITY:** P0
- **STATUS:** CONFIRMED
- **AFFECTED PAGE OR MODULE:** Sending History Report
- **LIVE URL:** https://officialwaba.com/reports/sending-history
- **EXACT FILE PATH:** `src/controllers/reportController.js`, `frontend/src/pages/SendingHistory.jsx`
- **FUNCTION OR COMPONENT:** Controller: `reportController.js:getSendingHistory`, Component: `SendingHistory.jsx`
- **LINE NUMBER:** `reportController.js`: lines 85–91, 171–188; `SendingHistory.jsx`: lines 33, 81
- **CURRENT BEHAVIOR:** Loading the page displays a prolonged spinner. Over time, as campaigns accumulate, the page frequently throws gateway timeouts (504) or takes 15+ seconds to render.
- **EXPECTED BEHAVIOR:** Sending history should load within 500ms using paginated database queries and indexed counter aggregates.
- **ROOT CAUSE:**
  1. **N*6 Correlated Subqueries:** `reportController.js` lines 85–91 execute 6 correlated subqueries for every single campaign row (up to 200 campaigns = 1,200 subqueries) calculating counts on `campaign_recipients`.
  2. **Unindexed Table Scan:** `campaign_recipients` has no index on `message_id`, and `campaigns` has no composite index on `(organization_id, id)`.
  3. **Heavy Follow-Up Log Subquery:** Lines 184–188 execute `NOT EXISTS (SELECT 1 FROM followup_logs fl WHERE ... BINARY fl.message_id = BINARY COALESCE(m.wa_message_id, m.wamid))` across all direct messages.
  4. **Irrelevant Meta API Call on Mount:** `SendingHistory.jsx` line 33 calls `fetchMetaTemplates()` on mount. Sending history has no need to fetch live templates from Meta to display history logs.
  5. **Lack of Server Pagination:** Returns up to 400+ mixed objects into memory; frontend handles slicing. Polled every 15 seconds by a client interval.
- **EVIDENCE:**
  ```sql
  -- reportController.js lines 85-90
  (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id=c.id) AS recipients_count_calc,
  (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id=c.id AND (LOWER(cr.status)='read' OR cr.read_at IS NOT NULL)) AS read_count_calc,
  (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id=c.id AND (LOWER(cr.status) IN ('delivered', 'read') OR cr.delivered_at IS NOT NULL)) AS delivered_count_calc,
  (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id=c.id AND LOWER(cr.status) IN ('sent', 'delivered', 'read')) AS sent_count_calc,
  (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id=c.id AND LOWER(cr.status)='failed') AS failed_count_calc,
  (SELECT MIN(cr.phone) FROM campaign_recipients cr WHERE cr.campaign_id=c.id) AS recipient_phone_sample
  ```
- **IMPACT:** Admins and clients cannot audit campaign delivery, check delivery failures, or export delivery receipts.
- **ROOT CAUSE CATEGORY:** Database / SQL Query Inefficiency + Redundant Frontend Meta Calls
- **RECOMMENDED FIX:**
  1. Remove `fetchMetaTemplates()` from `SendingHistory.jsx` mount effect.
  2. Replace correlated subqueries with stored aggregate columns on `campaigns` (`sent_count`, `failed_count`, `read_count`, `delivered_count`), which are already updated in real-time by webhook events.
  3. Implement true SQL `LIMIT ? OFFSET ?` pagination on `/reports/sending-history`.
- **FILES THAT WOULD BE MODIFIED:**
  - `src/controllers/reportController.js`
  - `frontend/src/pages/SendingHistory.jsx`
- **DATABASE IMPACT:** Query-only optimization.
- **RISK OF FIX:** Medium (requires ensuring response JSON structure matches table column expectations).
- **TESTING REQUIRED:** Load Sending History with 500+ campaigns; verify query completes in under 200ms; verify pagination controls.
- **ROLLBACK PLAN:** Revert `reportController.js` and `SendingHistory.jsx`.
- **DEPENDENCIES:** None

---

### ISSUE-004
- **TITLE:** Dashboard Page Significant Initial Load Delay and Heavy Aggregations
- **PRIORITY:** P1
- **STATUS:** CONFIRMED
- **AFFECTED PAGE OR MODULE:** Main Dashboard
- **LIVE URL:** https://officialwaba.com/dashboard
- **EXACT FILE PATH:** `src/controllers/dashboardController.js`, `frontend/src/pages/Dashboard.jsx`
- **FUNCTION OR COMPONENT:** Controller: `getDashboardStats`, `getMessageStats`; Component: `Dashboard.jsx`
- **LINE NUMBER:** `dashboardController.js`: lines 60–86, 264–278; `Dashboard.jsx`: lines 199, 275, 298
- **CURRENT BEHAVIOR:** Loading `/dashboard` takes 4–8+ seconds. Initial KPI widgets show skeleton or blank cards before data pops in.
- **EXPECTED BEHAVIOR:** Dashboard KPIs and charts should load in under 1 second.
- **ROOT CAUSE:**
  1. **Non-Optimized Subquery Aggregation:** `dashboardController.js` lines 68 & 82 execute `WHERE (organization_id = ? OR conversation_id IN (SELECT id FROM conversations WHERE organization_id = ?))`. An `OR` condition with an `IN (SELECT ...)` subquery completely invalidates index usage on MySQL, causing a full table scan of the `messages` table.
  2. **Non-Sargable Date Function:** `getMessageStats` line 274 uses `DATE(timestamp) BETWEEN ? AND ?`. Applying the `DATE()` function directly to the column prevents MySQL from using index range scans on `timestamp`.
  3. **Multiple Concurrent Uncached HTTP Calls:** `Dashboard.jsx` fires `/api/dashboard`, `/api/dashboard/message-stats`, `/api/credits/balance`, and `/api/meta/billing-insights` simultaneously. Because each authenticated call runs 3 authentication queries in `auth.js`, the single page load triggers over 15 database operations at once.
- **EVIDENCE:**
  ```sql
  -- dashboardController.js line 68: Destroys index efficiency
  WHERE (direction = 'outgoing' OR sender = 'user')
    AND (organization_id = ? OR conversation_id IN (SELECT id FROM conversations WHERE organization_id = ?))
  ```
- **IMPACT:** Poor user experience immediately upon logging in, server load spikes on VPS during peak business hours.
- **ROOT CAUSE CATEGORY:** Database / SQL Indexing & Query Architecture
- **RECOMMENDED FIX:**
  1. Denormalize `organization_id` on all `messages` so the query simplifies to `WHERE organization_id = ? AND direction = 'outgoing'`.
  2. Change `DATE(timestamp) BETWEEN ? AND ?` to standard index-friendly range syntax: `WHERE timestamp >= ? AND timestamp < DATE_ADD(?, INTERVAL 1 DAY)`.
  3. Add composite index `INDEX idx_messages_org_timestamp (organization_id, timestamp)`.
- **FILES THAT WOULD BE MODIFIED:**
  - `src/controllers/dashboardController.js`
- **DATABASE IMPACT:** Schema change (Add composite index on `messages`).
- **RISK OF FIX:** Low
- **TESTING REQUIRED:** Run `EXPLAIN` on both dashboard queries; verify index is utilized and rows scanned drops by >95%; verify dashboard loads under 800ms.
- **ROLLBACK PLAN:** Revert controller query and drop index.
- **DEPENDENCIES:** None

---

### ISSUE-005
- **TITLE:** Scheduled Log Unbounded Query and Missing Index on `scheduled_at`
- **PRIORITY:** P1
- **STATUS:** CONFIRMED
- **AFFECTED PAGE OR MODULE:** Scheduled Broadcasts Log
- **LIVE URL:** https://officialwaba.com/reports/scheduled-log
- **EXACT FILE PATH:** `src/controllers/campaignController.js`, `frontend/src/pages/ScheduledLog.jsx`
- **FUNCTION OR COMPONENT:** `campaignController.js:getScheduledCampaigns`, `ScheduledLog.jsx`
- **LINE NUMBER:** `campaignController.js`: lines 312–325; `ScheduledLog.jsx`: line 25
- **CURRENT BEHAVIOR:** Scheduled log page exhibits increasing latency as the database grows, occasionally freezing during high-traffic intervals.
- **EXPECTED BEHAVIOR:** Scheduled log queries should utilize indexed scans and return paginated slices.
- **ROOT CAUSE:**
  1. **Missing Index on `campaigns.scheduled_at`:** The `campaigns` table only has indexes on `id`, `status`, `created_at`, `organization_id`, and `user_id`. Querying `WHERE scheduled_at IS NOT NULL ORDER BY scheduled_at DESC` forces a full table scan and a temporary disk filesort.
  2. **Unbounded Result Set:** The query does not contain a `LIMIT` clause when `all=true` is requested by `ScheduledLog.jsx`.
- **EVIDENCE:**
  ```javascript
  // campaigns indexes checked in MySQL:
  // idx_status (status), idx_created_at (created_at), organization_id (organization_id)
  // scheduled_at has NO INDEX.
  ```
- **IMPACT:** Delays viewing and managing queued broadcasts; slow responses to worker scheduler queries.
- **ROOT CAUSE CATEGORY:** Database Indexing
- **RECOMMENDED FIX:**
  1. Add index: `ALTER TABLE campaigns ADD INDEX idx_campaigns_scheduled (scheduled_at, organization_id)`.
  2. Add `LIMIT 100` and pagination support to `getScheduledCampaigns`.
- **FILES THAT WOULD BE MODIFIED:**
  - `src/controllers/campaignController.js`
- **DATABASE IMPACT:** Schema change (Add index).
- **RISK OF FIX:** Low
- **TESTING REQUIRED:** Execute query with `EXPLAIN` before and after index creation; confirm index scan instead of filesort.
- **ROLLBACK PLAN:** Drop index.
- **DEPENDENCIES:** None

---

# SECTION 2: OTHER DISCOVERED ISSUES

---

### ISSUE-006
- **TITLE:** Webhook Delivery and Read Receipts Cause Full Table Scans on `campaign_recipients`
- **PRIORITY:** P0
- **STATUS:** CONFIRMED
- **AFFECTED PAGE OR MODULE:** Meta Ingestion Webhook
- **LIVE URL:** https://officialwaba.com/webhook
- **EXACT FILE PATH:** `src/controllers/webhookController.js`
- **FUNCTION OR COMPONENT:** `webhookController.js:receiveWebhook`
- **LINE NUMBER:** lines 439–441, 574, 598
- **CURRENT BEHAVIOR:** During a broadcast of 5,000–50,000 messages, Meta dispatches incoming delivery and read receipts at 50–100 requests per second. The server CPU spikes to 100% and database connections max out.
- **EXPECTED BEHAVIOR:** Webhook receipts should update recipient status in sub-millisecond indexed operations.
- **ROOT CAUSE:** The `campaign_recipients` table contains column `message_id` (VARCHAR(255)), but **NO index exists on `message_id`**. Every single incoming webhook delivery receipt executes:
  ```sql
  UPDATE campaign_recipients SET status = 'delivered' WHERE (message_id = ? OR message_id = ? OR message_id = ?)
  ```
  Since `message_id` is unindexed, every delivery receipt performs a **full table scan of all recipient rows in the database**.
- **EVIDENCE:**
  Schema verification in `new_waba_db-6-11-26`:
  ```
  Field: 'message_id', Type: 'varchar(255)', Key: '' (NO INDEX)
  ```
- **IMPACT:** High likelihood of server crash, connection pool exhaustion (`ECONNREFUSED` / `ER_CON_COUNT_ERROR`), and dropped webhooks during large broadcast campaigns.
- **ROOT CAUSE CATEGORY:** Database Indexing
- **RECOMMENDED FIX:**
  Add index immediately:
  `ALTER TABLE campaign_recipients ADD INDEX idx_cr_message_id (message_id(64))`
- **FILES THAT WOULD BE MODIFIED:**
  - None in application code (database schema update).
- **DATABASE IMPACT:** Schema change (Index creation).
- **RISK OF FIX:** Low
- **TESTING REQUIRED:** Confirm `SHOW INDEX FROM campaign_recipients` shows `idx_cr_message_id`; run `EXPLAIN UPDATE campaign_recipients WHERE message_id = 'wamid...'` and confirm index lookup.
- **ROLLBACK PLAN:** `ALTER TABLE campaign_recipients DROP INDEX idx_cr_message_id`.
- **DEPENDENCIES:** None

---

### ISSUE-007
- **TITLE:** Critical Database Write Lock Contention on Every HTTP Request via `auth.js`
- **PRIORITY:** P1
- **STATUS:** CONFIRMED
- **AFFECTED PAGE OR MODULE:** All Authenticated Endpoints / Middleware
- **LIVE URL:** All protected routes on https://officialwaba.com
- **EXACT FILE PATH:** `src/middleware/auth.js`
- **FUNCTION OR COMPONENT:** `auth.js:requireAuth`
- **LINE NUMBER:** lines 172–181
- **CURRENT BEHAVIOR:** Every single authenticated HTTP request performs 2 `SELECT` queries and 1 `UPDATE` query:
  `UPDATE user_sessions SET last_seen_at = NOW() WHERE id = ?`.
- **EXPECTED BEHAVIOR:** Session touch timestamps should be throttled in memory (e.g. updated at most once every 5 minutes per session) so read queries and lightweight API calls do not cause write locks on MySQL.
- **ROOT CAUSE:** When a browser opens a page that fires 4–5 concurrent requests (e.g. Dashboard), all 5 threads attempt to execute `UPDATE user_sessions` for the identical `session_id` simultaneously, creating row-level lock contention on InnoDB and tripling connection pool consumption.
- **EVIDENCE:**
  ```javascript
  // auth.js lines 180
  await pool.query(`UPDATE user_sessions SET last_seen_at = NOW() WHERE id = ?`, [payload.session_id]);
  ```
- **IMPACT:** Unnecessary database I/O, slow response times across all endpoints, connection pool starvation.
- **ROOT CAUSE CATEGORY:** Backend Architecture / Middleware Design
- **RECOMMENDED FIX:**
  Implement an in-memory TTL map: only execute `UPDATE user_sessions SET last_seen_at = NOW()` if `last_seen_at` has not been updated within the last 5 minutes (300,000ms).
- **FILES THAT WOULD BE MODIFIED:**
  - `src/middleware/auth.js`
- **DATABASE IMPACT:** None (Reduces database write volume by >95%).
- **RISK OF FIX:** Low
- **TESTING REQUIRED:** Make 10 concurrent requests with the same token; confirm only 1 SQL `UPDATE user_sessions` is logged.
- **ROLLBACK PLAN:** Revert `auth.js`.
- **DEPENDENCIES:** None

---

### ISSUE-008
- **TITLE:** Missing Critical Performance Indexes Across Core Tables
- **PRIORITY:** P1
- **STATUS:** CONFIRMED
- **AFFECTED PAGE OR MODULE:** Database Layer
- **LIVE URL:** https://officialwaba.com
- **EXACT FILE PATH:** MySQL Database Schema
- **FUNCTION OR COMPONENT:** `messages`, `conversations` tables
- **LINE NUMBER:** N/A (Schema)
- **CURRENT BEHAVIOR:** Chat message pagination, conversation sorting, and message searches execute disk filesorts.
- **EXPECTED BEHAVIOR:** Common sorting keys (`timestamp`, `last_message_time`) and lookups (`wa_message_id`, `contact_phone`) should have dedicated indexes.
- **ROOT CAUSE:**
  Database index audit revealed:
  1. `messages.timestamp` has NO index. (Used in `ORDER BY timestamp ASC` on every chat load).
  2. `messages.wa_message_id` has NO index. (Used in webhook updates and duplicate message guards).
  3. `conversations.last_message_time` has NO index. (Used in `ORDER BY last_message_time DESC` on every conversation list fetch).
  4. `conversations.contact_phone` has NO index. (Used when matching incoming messages by phone).
- **EVIDENCE:**
  Output of `SHOW INDEX FROM messages` and `SHOW INDEX FROM conversations` confirms absence of these indexes.
- **IMPACT:** Latency directly proportional to message volume; page loads become noticeably slower as the company sends more messages.
- **ROOT CAUSE CATEGORY:** Database Indexing
- **RECOMMENDED FIX:**
  Execute migration:
  ```sql
  ALTER TABLE messages ADD INDEX idx_messages_timestamp (timestamp);
  ALTER TABLE messages ADD INDEX idx_messages_wa_id (wa_message_id(64));
  ALTER TABLE conversations ADD INDEX idx_conv_last_time (last_message_time);
  ALTER TABLE conversations ADD INDEX idx_conv_phone (contact_phone(20));
  ```
- **FILES THAT WOULD BE MODIFIED:**
  - Database schema (`src/db/migrations/020_performance_indexes.sql`)
- **DATABASE IMPACT:** Schema change (Indexes only).
- **RISK OF FIX:** Low
- **TESTING REQUIRED:** Verify index creation with `SHOW INDEX`; test queries with `EXPLAIN`.
- **ROLLBACK PLAN:** `DROP INDEX` for created indexes.
- **DEPENDENCIES:** None

---

### ISSUE-009
- **TITLE:** Redundant 4-Second Polling Loop in `Chat.jsx` Causing Server Load
- **PRIORITY:** P2
- **STATUS:** CONFIRMED
- **AFFECTED PAGE OR MODULE:** Live Chat Inbox
- **LIVE URL:** https://officialwaba.com/chat
- **EXACT FILE PATH:** `frontend/src/pages/Chat.jsx`
- **FUNCTION OR COMPONENT:** `useEffect` sync timer
- **LINE NUMBER:** lines 424–429
- **CURRENT BEHAVIOR:** A client-side `setInterval` continuously sends requests to `/api/chat/conversations` and `/api/chat/messages/:id` every 4,000 milliseconds for every open browser tab.
- **EXPECTED BEHAVIOR:** Since the application is connected to Socket.IO and receives real-time events (`new_message`, `conversation_updated`, `message_status_updated`), continuous 4-second polling is redundant and should only act as a slow fallback (e.g. 30–60s) or only poll when Socket.IO disconnects.
- **ROOT CAUSE:** Polling interval was added as an aggressive band-aid for missing WebSocket events without optimizing WebSocket synchronization.
- **EVIDENCE:**
  ```javascript
  // Chat.jsx line 424
  const syncTimer = setInterval(() => {
      if (!conversationInFlightRef.current) loadConversations(true)
      if (selectedChatRef.current?.id) {
          loadMessages(selectedChatRef.current.id, true)
      }
  }, 4000)
  ```
- **IMPACT:** If 10 support agents keep the chat window open, they generate 300 HTTP requests per minute even with zero chat activity.
- **ROOT CAUSE CATEGORY:** Frontend State Management & Polling Design
- **RECOMMENDED FIX:**
  Increase poll interval to 30 seconds when Socket.IO `socket.connected === true`. If socket disconnects, fall back to 10 seconds.
- **FILES THAT WOULD BE MODIFIED:**
  - `frontend/src/pages/Chat.jsx`
- **DATABASE IMPACT:** None
- **RISK OF FIX:** Low
- **TESTING REQUIRED:** Open chat tab, verify real-time messages still appear instantaneously via WebSocket without needing poll; verify network tab request frequency drops significantly.
- **ROLLBACK PLAN:** Revert timer interval in `Chat.jsx`.
- **DEPENDENCIES:** ISSUE-001

---

### ISSUE-010
- **TITLE:** External Meta Graph API Calls Lack Configured HTTP Timeouts
- **PRIORITY:** P2
- **STATUS:** CONFIRMED
- **AFFECTED PAGE OR MODULE:** WhatsApp & Template Services
- **LIVE URL:** https://officialwaba.com
- **EXACT FILE PATH:** `src/services/templateService.js`, `src/services/whatsappService.js`, `src/services/metaWhatsAppService.js`
- **FUNCTION OR COMPONENT:** `fetchMetaTemplates`, `sendTemplateMessage`
- **LINE NUMBER:** `templateService.js`: line 103; `whatsappService.js`: line 22
- **CURRENT BEHAVIOR:** Calls to `https://graph.facebook.com/...` rely on Axios default configurations which have no timeout (`timeout: 0`).
- **EXPECTED BEHAVIOR:** All outbound external HTTP requests must specify reasonable timeouts (e.g. 5,000ms–10,000ms) with proper catch blocks to prevent worker lockups.
- **ROOT CAUSE:** Missing timeout property in Axios instance and request options.
- **EVIDENCE:**
  `axios.get(endpoint, { headers: ... })` called without `timeout` key.
- **IMPACT:** If Meta servers experience degraded connectivity or DNS latency, Node.js event loop handles become clogged, leading to gateway timeouts on CyberPanel/LiteSpeed.
- **ROOT CAUSE CATEGORY:** Backend Service Configuration
- **RECOMMENDED FIX:**
  Add `{ timeout: 8000 }` to all external Axios calls.
- **FILES THAT WOULD BE MODIFIED:**
  - `src/services/templateService.js`
  - `src/services/whatsappService.js`
- **DATABASE IMPACT:** None
- **RISK OF FIX:** Low
- **TESTING REQUIRED:** Test request with mocked delayed response; confirm error is thrown after 8 seconds rather than hanging.
- **ROLLBACK PLAN:** Revert service files.
- **DEPENDENCIES:** None

---

### ISSUE-011
- **TITLE:** Cluttered Dead Code at Top of Critical Middleware `auth.js`
- **PRIORITY:** P3
- **STATUS:** CONFIRMED
- **AFFECTED PAGE OR MODULE:** Auth Middleware
- **LIVE URL:** All routes
- **EXACT FILE PATH:** `src/middleware/auth.js`
- **FUNCTION OR COMPONENT:** Top of module
- **LINE NUMBER:** lines 1–122
- **CURRENT BEHAVIOR:** The first 122 lines of `src/middleware/auth.js` are commented-out legacy code (`// import jwt...`, `// export async function requireAuth...`). The actual active exports start on line 123.
- **EXPECTED BEHAVIOR:** Clean, maintainable codebase without duplicate commented-out implementations of the core authentication middleware.
- **ROOT CAUSE:** Developer pasted an updated implementation below the old one and commented out the previous 122 lines instead of removing them.
- **EVIDENCE:**
  Inspecting `src/middleware/auth.js` lines 1–123 reveals commented-out block followed by second `import jwt from 'jsonwebtoken'`.
- **IMPACT:** Readability hazard; high risk of a future developer accidentally editing or re-enabling the deprecated block.
- **ROOT CAUSE CATEGORY:** Code Cleanliness / Maintainability
- **RECOMMENDED FIX:**
  Safely remove lines 1–122 from `src/middleware/auth.js`.
- **FILES THAT WOULD BE MODIFIED:**
  - `src/middleware/auth.js`
- **DATABASE IMPACT:** None
- **RISK OF FIX:** Zero
- **TESTING REQUIRED:** Verify login and authenticated endpoints function identically after removing commented lines.
- **ROLLBACK PLAN:** Restore lines from backup.
- **DEPENDENCIES:** None

---

### ISSUE-012
- **TITLE:** Template In-Memory Cache Key Includes `userId`, Fragmenting Cache
- **PRIORITY:** P2
- **STATUS:** CONFIRMED
- **AFFECTED PAGE OR MODULE:** Template Service
- **LIVE URL:** https://officialwaba.com/send-wa/quick
- **EXACT FILE PATH:** `src/services/templateService.js`
- **FUNCTION OR COMPONENT:** `fetchMetaTemplates`
- **LINE NUMBER:** line 29
- **CURRENT BEHAVIOR:** Cache key is formatted as:
  `const cacheKey = `${accountId || 'def'}_${organizationId || 'org'}_${isSuperAdmin ? 'sa' : 'user'}_${userId || '0'}`;`
- **EXPECTED BEHAVIOR:** Meta templates belong to the WhatsApp Business Account (`waba_id`) and organization, not the individual user. The cache key should be scoped to `wabaId` or `(accountId, organizationId)`.
- **ROOT CAUSE:** Including `userId` in the cache key defeats cache sharing among staff members in the same organization. When User A loads templates, User B in the same organization still suffers a cache miss and triggers another Meta API call.
- **EVIDENCE:**
  `src/services/templateService.js` line 29.
- **IMPACT:** Multiplies external Meta API calls by the number of active users in an organization.
- **ROOT CAUSE CATEGORY:** Backend Caching Architecture
- **RECOMMENDED FIX:**
  Change cache key definition to:
  `const cacheKey = `${activeWabaId || accountId || 'def'}_${organizationId || 'org'}`;`
- **FILES THAT WOULD BE MODIFIED:**
  - `src/services/templateService.js`
- **DATABASE IMPACT:** None
- **RISK OF FIX:** Low
- **TESTING REQUIRED:** Log in with User 1, load templates; log in with User 2 from same organization, verify templates load instantly from cache without Meta API hit.
- **ROLLBACK PLAN:** Revert line 29.
- **DEPENDENCIES:** None

