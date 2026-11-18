#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_REAL = fs.realpathSync(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(path.dirname(SCRIPT_REAL));
const REPO_ROOT = path.resolve(SKILL_DIR, '..', '..', '..');
const TASK_IMPORT_PATH = path.join(REPO_ROOT, 'shared', 'taskImport.js');
const { buildImportBatch, buildChatGPTInstructions } = await import(pathToFileURL(TASK_IMPORT_PATH).href);

const DEFAULT_URL = process.env.SYNCTODO_URL || 'http://127.0.0.1:4000';

function parseArgs(argv) {
  const opts = {
    url: DEFAULT_URL,
    lists: false,
    validate: false,
    stdin: false,
    prompt: false,
    help: false,
    file: null
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lists') opts.lists = true;
    else if (a === '--validate' || a === '--dry-run') opts.validate = true;
    else if (a === '--stdin') opts.stdin = true;
    else if (a === '--prompt') opts.prompt = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--url' && argv[i + 1]) opts.url = argv[++i].replace(/\/+$/, '');
    else if (!a.startsWith('-') && !opts.file) opts.file = a;
    else {
      console.error(`Unknown or unexpected argument: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

function readLocalFallbackState() {
  const storePath = path.join(REPO_ROOT, 'server', 'data', 'store.json');
  if (!fs.existsSync(storePath)) return { lists: [], todos: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return {
      lists: Array.isArray(parsed.lists) ? parsed.lists : [],
      todos: parsed.todos || {}
    };
  } catch {
    return { lists: [], todos: {} };
  }
}

async function fetchLiveLists(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/lists`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.lists)) return { lists: data.lists, source: 'server' };
    }
  } catch {}
  const fallback = readLocalFallbackState();
  return { lists: fallback.lists, source: 'local-store' };
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

const opts = parseArgs(process.argv.slice(2));

if (opts.help || (!opts.lists && !opts.prompt && !opts.stdin && !opts.file)) {
  console.log(`Usage:
  node add_tasks.mjs --lists [--url http://127.0.0.1:4000]
  node add_tasks.mjs --prompt [--url http://127.0.0.1:4000]
  node add_tasks.mjs [--validate] <tasks.json> [--url http://127.0.0.1:4000]
  cat tasks.json | node add_tasks.mjs [--validate] --stdin`);
  process.exit(opts.help ? 0 : 1);
}

if (opts.lists) {
  const { lists, source } = await fetchLiveLists(opts.url);
  console.log(JSON.stringify({ source, lists }, null, 2));
  process.exit(0);
}

if (opts.prompt) {
  const { lists } = await fetchLiveLists(opts.url);
  console.log(buildChatGPTInstructions(lists));
  process.exit(0);
}

let rawText = '';
if (opts.stdin) {
  rawText = await readStdin();
} else if (opts.file) {
  const resolved = path.resolve(process.cwd(), opts.file);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }
  rawText = fs.readFileSync(resolved, 'utf8');
}

// Validate locally before sending anywhere
const { lists: knownLists } = await fetchLiveLists(opts.url);
const fallback = readLocalFallbackState();
let preview;
try {
  preview = buildImportBatch({
    rawInput: rawText,
    existingTodos: fallback.todos,
    existingLists: knownLists
  });
} catch (err) {
  console.error(`Validation failed: ${err.message}`);
  process.exit(1);
}

if (opts.validate) {
  console.log(JSON.stringify({
    valid: true,
    taskCount: preview.summary.taskCount,
    createdLists: preview.createdLists.map(l => l.name),
    targetListCounts: preview.summary.targetListCounts
  }, null, 2));
  process.exit(0);
}

try {
  const body = JSON.stringify(
    rawText.trim().startsWith('[') || rawText.trim().startsWith('{')
      ? JSON.parse(rawText.replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1').trim())
      : { tasks: preview.importedTodos }
  );
  const res = await fetch(`${opts.url}/api/tasks/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  const result = await res.json();
  if (!res.ok || !result.success) {
    console.error(`Server rejected import (${res.status}): ${result.error || JSON.stringify(result)}`);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(`Could not connect to SyncToDo server at ${opts.url}: ${err.message}`);
  console.error('Tip: make sure synctodo-server is running, or use Settings -> Paste JSON / Import JSON File in the app.');
  process.exit(1);
}
