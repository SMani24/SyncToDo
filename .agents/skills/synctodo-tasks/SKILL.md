---
name: synctodo-tasks
description: >-
  Create, organize, and import batches of structured tasks into SyncToDo using
  its JSON task format. Use when the user asks you (in Codex/GPT, ChatGPT, or
  Antigravity) to add tasks, break down goals/assignments/projects into a to-do
  list, schedule work for today/tomorrow, or generate a SyncToDo import JSON file.
metadata:
  short-description: Format and import task batches into SyncToDo
---

# SyncToDo Tasks

Turn goals, notes, study plans, or task requests into clean SyncToDo tasks and either import them directly via the local SyncToDo server or output ready-to-import JSON.

## Workflow

### 1. Discover Existing Lists First (When Local Access Is Available)
Before assigning `"list"` values, inspect the user's real SyncToDo lists so tasks match existing folders instead of creating duplicates:

```bash
node scripts/add_tasks.mjs --lists
```

*(Run relative to this skill folder, or pass its full path.)*

If you cannot run local commands (e.g., Cloud ChatGPT), see [references/chatgpt_instructions.md](./references/chatgpt_instructions.md) or ask the user / use standard names like `"Inbox"`. Never use `"My Day"` as a folder name; use `"inMyDay": true` instead (though SyncToDo's importer safely aliases `"My Day"` -> `"Inbox"` + `inMyDay: true` if encountered).

### 2. Construct the JSON Payload

Use this structure (see [examples/tasks_example.json](./examples/tasks_example.json)):

```json
{
  "defaultList": "Inbox",
  "createMissingLists": true,
  "tasks": [
    {
      "title": "Short actionable title",
      "list": "Inbox",
      "priority": "low | medium | high",
      "dueDate": "YYYY-MM-DD | today | tomorrow | null",
      "dueTime": "HH:MM | null",
      "inMyDay": false,
      "pinned": false,
      "recurrence": "none | daily | weekdays | weekly | monthly | custom",
      "notes": "Context, links, chapters, or constraints",
      "steps": ["Subtask 1", "Subtask 2"]
    }
  ]
}
```

#### Formatting Guidelines
- **Preserve language & ordering**: Keep Persian or English matching the user's request, and place tasks in logical execution order (`tasks[0]` appears first at the top).
- **Scannable titles**: Put short, clear task titles in `"title"` (e.g., `"RL Book - Read 2.2"`). Move background details, formulas, or URLs into `"notes"`, and actionable sub-items into `"steps"`.
- **Minimal required fields**: Only `"title"` is required per task; omit optional fields you don't need.
- **Today's focus (`inMyDay`)**: Leave `inMyDay` as `false` unless the user asks for tasks in **My Day** / Today's Tasks (note: `"dueDate": "today"` also surfaces tasks in My Day automatically).

### 3. Validate & Deliver

- **Environment A — Local shell & SyncToDo server running (Antigravity, Codex Desktop/CLI):**
  1. Write the JSON payload to a temporary or requested `.json` file (or pipe JSON via `--stdin`).
  2. Dry-run validate if needed: `node scripts/add_tasks.mjs --validate <file.json>`
  3. Import directly into live SyncToDo (broadcasts immediately to Laptop & Phone):
     ```bash
     node scripts/add_tasks.mjs <file.json>
     ```
     Or from stdin:
     ```bash
     cat <<'EOF' | node scripts/add_tasks.mjs --stdin
     { "tasks": [ ... ] }
     EOF
     ```
  4. Report the exact imported count and target lists from the script output.

- **Environment B — No local server / Sandboxed / ChatGPT Web or Mobile:**
  - Validate JSON syntax, then output either a downloadable `.json` file or a single clean ```` ```json ```` code block so the user can open **SyncToDo → Settings → Paste JSON** (or **Import JSON File**).
