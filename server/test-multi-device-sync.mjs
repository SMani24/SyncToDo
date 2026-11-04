// Automated Test: Multi-Device Concurrent Mutations & CRDT Convergence
// Simulates 3 concurrent devices (Laptop, Tablet, Phone) making concurrent edits,
// syncing across offline partitions, and verifying deterministic convergence.

import assert from 'node:assert';

class MockCRDTStore {
  constructor(deviceId, deviceName) {
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.todos = {};
    this.lists = [];
    this.mutations = [];
  }

  addTodo(id, title, listId = 'inbox', priority = 'normal') {
    const now = Date.now();
    const todo = {
      id,
      title,
      listId,
      priority,
      completed: false,
      createdAt: now,
      updatedAt: now
    };
    this.todos[id] = todo;
    const mut = {
      id: `mut-${now}-${Math.random().toString(36).slice(2, 6)}`,
      entityType: 'todo',
      entityId: id,
      type: 'CREATE',
      timestamp: now,
      deviceId: this.deviceId,
      data: todo
    };
    this.mutations.push(mut);
    return todo;
  }

  updateTodo(id, updates) {
    const current = this.todos[id];
    if (!current) return;
    const now = Date.now();
    const updated = { ...current, ...updates, updatedAt: now };
    this.todos[id] = updated;
    const mut = {
      id: `mut-${now}-${Math.random().toString(36).slice(2, 6)}`,
      entityType: 'todo',
      entityId: id,
      type: 'UPDATE',
      timestamp: now,
      deviceId: this.deviceId,
      data: updated
    };
    this.mutations.push(mut);
    return updated;
  }

  deleteTodo(id) {
    const current = this.todos[id];
    if (!current) return;
    const now = Date.now();
    const deleted = { ...current, deletedAt: now, updatedAt: now };
    this.todos[id] = deleted;
    const mut = {
      id: `mut-${now}-${Math.random().toString(36).slice(2, 6)}`,
      entityType: 'todo',
      entityId: id,
      type: 'DELETE',
      timestamp: now,
      deviceId: this.deviceId,
      data: deleted
    };
    this.mutations.push(mut);
    return deleted;
  }

  addList(id, name, icon = '📁') {
    const now = Date.now();
    const list = { id, name, icon, createdAt: now, updatedAt: now };
    this.lists.push(list);
    const mut = {
      id: `mut-${now}-${Math.random().toString(36).slice(2, 6)}`,
      entityType: 'list',
      entityId: id,
      type: 'LIST_UPSERT',
      timestamp: now,
      deviceId: this.deviceId,
      data: list
    };
    this.mutations.push(mut);
    return list;
  }

  updateList(id, updates) {
    const idx = this.lists.findIndex(l => l.id === id);
    if (idx === -1) return;
    const now = Date.now();
    const updated = { ...this.lists[idx], ...updates, updatedAt: now };
    this.lists[idx] = updated;
    const mut = {
      id: `mut-${now}-${Math.random().toString(36).slice(2, 6)}`,
      entityType: 'list',
      entityId: id,
      type: 'LIST_UPSERT',
      timestamp: now,
      deviceId: this.deviceId,
      data: updated
    };
    this.mutations.push(mut);
    return updated;
  }

  // CRDT LWW Merge Engine (Identical to SyncEngine & LocalPeerServer)
  mergeIncoming(incoming) {
    // 1. Merge Lists
    if (Array.isArray(incoming.lists)) {
      incoming.lists.forEach(inList => {
        if (!inList || !inList.id) return;
        const existingIdx = this.lists.findIndex(l => l.id === inList.id);
        if (existingIdx === -1) {
          this.lists.push({ ...inList });
        } else {
          const current = this.lists[existingIdx];
          if ((inList.updatedAt || 0) >= (current.updatedAt || 0)) {
            this.lists[existingIdx] = { ...current, ...inList };
          }
        }
      });
    }

    // 2. Merge Todos
    const incomingTodos = Array.isArray(incoming.todos) ? incoming.todos : Object.values(incoming.todos || {});
    incomingTodos.forEach(inTodo => {
      if (!inTodo || !inTodo.id) return;
      const current = this.todos[inTodo.id];
      if (!current) {
        this.todos[inTodo.id] = { ...inTodo };
      } else if ((inTodo.updatedAt || 0) >= (current.updatedAt || 0)) {
        this.todos[inTodo.id] = { ...current, ...inTodo };
      }
    });

    // 3. Merge Mutation Log
    if (Array.isArray(incoming.mutations)) {
      incoming.mutations.forEach(m => {
        if (!this.mutations.find(x => x.id === m.id)) {
          this.mutations.push(m);
        }
      });
    }
  }

  exportPayload() {
    return {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      todos: Object.values(this.todos),
      lists: this.lists,
      mutations: this.mutations,
      timestamp: Date.now()
    };
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTest() {
  console.log('🧪 Starting Multi-Device Concurrent Mutation Sync Test...\n');

  const laptop = new MockCRDTStore('laptop-01', 'My Laptop');
  const tablet = new MockCRDTStore('tablet-02', 'Samsung Galaxy Tab');
  const phone = new MockCRDTStore('phone-03', 'Android Phone');

  // Step 1: Initial Sync baseline
  console.log('1️⃣ Baseline Setup: Laptop creates baseline lists and tasks');
  laptop.addList('work', 'Work Projects', '💼');
  laptop.addList('home', 'Personal Errands', '🏠');
  laptop.addTodo('todo-1', 'Setup Android P2P sync', 'work', 'high');
  laptop.addTodo('todo-2', 'Buy groceries', 'home', 'normal');

  // Baseline sync to tablet and phone
  tablet.mergeIncoming(laptop.exportPayload());
  phone.mergeIncoming(laptop.exportPayload());

  assert.strictEqual(Object.keys(tablet.todos).length, 2);
  assert.strictEqual(Object.keys(phone.todos).length, 2);
  console.log('   ✅ Baseline synchronized across all 3 devices.');

  // Step 2: Concurrent mutations during network partition (offline)
  console.log('\n2️⃣ Concurrent Offline Edits on 3 Separate Devices:');

  // Laptop edits todo-1 title and adds todo-3
  await sleep(10);
  laptop.updateTodo('todo-1', { title: 'Setup Android P2P sync (Completed on Laptop)' });
  laptop.addTodo('todo-3', 'Review pull request', 'work', 'normal');
  console.log('   • Laptop updated todo-1 title and created todo-3');

  // Tablet concurrently updates todo-1 (marks completed, adds notes) and creates todo-4
  await sleep(10);
  tablet.updateTodo('todo-1', { completed: true, notes: 'Verified on Galaxy Tab stylus' });
  tablet.addTodo('todo-4', 'Call optometrist', 'home', 'high');
  console.log('   • Tablet concurrently marked todo-1 completed and created todo-4');

  // Phone concurrently adds todo-5, deletes todo-2, and renames list "home"
  await sleep(10);
  phone.addTodo('todo-5', 'Pay utility bills', 'home', 'high');
  phone.deleteTodo('todo-2');
  phone.updateList('home', { name: 'Home & Family' });
  console.log('   • Phone concurrently created todo-5, deleted todo-2, and renamed list "home"');

  // Step 3: P2P Multi-hop synchronization in arbitrary order
  console.log('\n3️⃣ Simulating P2P Sync Mesh (Arbitrary multi-way sync):');

  // Phase A: Tablet syncs with Phone (directly on Wi-Fi without laptop)
  console.log('   • Step 3A: Tablet <--> Phone sync directly via P2P HTTP');
  tablet.mergeIncoming(phone.exportPayload());
  phone.mergeIncoming(tablet.exportPayload());

  // Phase B: Phone syncs with Laptop
  console.log('   • Step 3B: Phone <--> Laptop sync');
  laptop.mergeIncoming(phone.exportPayload());
  phone.mergeIncoming(laptop.exportPayload());

  // Phase C: Laptop syncs with Tablet
  console.log('   • Step 3C: Laptop <--> Tablet sync');
  tablet.mergeIncoming(laptop.exportPayload());
  laptop.mergeIncoming(tablet.exportPayload());

  // Step 4: Verification of deterministic convergence across all 3 devices
  console.log('\n4️⃣ Verifying State Convergence:');

  const devices = [
    { name: 'Laptop', store: laptop },
    { name: 'Tablet', store: tablet },
    { name: 'Phone',  store: phone }
  ];

  for (const d of devices) {
    const activeTasks = Object.values(d.store.todos).filter(t => !t.deletedAt);
    const deletedTasks = Object.values(d.store.todos).filter(t => t.deletedAt);
    const homeList = d.store.lists.find(l => l.id === 'home');
    const t1 = d.store.todos['todo-1'];

    console.log(`   [${d.name}] Total Todos: ${Object.keys(d.store.todos).length} (${activeTasks.length} active, ${deletedTasks.length} deleted) | Lists: ${d.store.lists.length}`);

    // Verify todo-1: Tablet's later edit (completed: true) must prevail
    assert.strictEqual(t1.completed, true, `${d.name}: todo-1 completed must be true`);

    // Verify todo-2: Phone's deletion must prevail across all devices
    assert.ok(d.store.todos['todo-2'].deletedAt, `${d.name}: todo-2 must be deleted`);

    // Verify list "home": Phone's rename to "Home & Family" must prevail
    assert.strictEqual(homeList.name, 'Home & Family', `${d.name}: list "home" must be renamed to "Home & Family"`);

    // Verify all 5 tasks exist in store
    assert.ok(d.store.todos['todo-1'], 'todo-1 exists');
    assert.ok(d.store.todos['todo-2'], 'todo-2 exists (tombstone)');
    assert.ok(d.store.todos['todo-3'], 'todo-3 exists');
    assert.ok(d.store.todos['todo-4'], 'todo-4 exists');
    assert.ok(d.store.todos['todo-5'], 'todo-5 exists');
  }

  // Exact deep equality verification
  assert.deepStrictEqual(laptop.todos, tablet.todos, 'Laptop and Tablet todos must be deep equal');
  assert.deepStrictEqual(tablet.todos, phone.todos, 'Tablet and Phone todos must be deep equal');

  // Verify list equality
  const sortById = (a, b) => a.id.localeCompare(b.id);
  assert.deepStrictEqual(
    [...laptop.lists].sort(sortById),
    [...tablet.lists].sort(sortById),
    'Laptop and Tablet lists must be identical'
  );
  assert.deepStrictEqual(
    [...tablet.lists].sort(sortById),
    [...phone.lists].sort(sortById),
    'Tablet and Phone lists must be identical'
  );

  console.log('\n🎉 ALL CONCURRENT MUTATION SYNC TESTS PASSED DETERMINISTICALLY!');
}

runTest().catch(err => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
