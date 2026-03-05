/**
 * EduGuardian 2.0 - Offline Sync Engine
 * Uses IndexedDB for storing events offline and syncing when connection returns.
 */

const DB_NAME = 'eduguardian_offline';
const DB_VERSION = 2;
const STORE_NAME = 'pending_events';

class OfflineSyncEngine {
    constructor() {
        this.db = null;
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;

        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncPendingEvents();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });

        // Background sync loop: push every 5s if online
        setInterval(() => this.syncPendingEvents(), 5000);
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('synced', 'synced', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    async storeEvent(event) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.add({
                ...event,
                timestamp: new Date().toISOString(),
                synced: 0, // 0 = unsynced, 1 = synced
            });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async getPendingEvents() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('synced');
            const request = index.getAll(0); // Get all unsynced (0)
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async markAsSynced(ids) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            ids.forEach((id) => {
                const req = store.get(id);
                req.onsuccess = () => {
                    const record = req.result;
                    if (record) {
                        record.synced = 1; // Mark as synced
                        store.put(record);
                    }
                };
            });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async syncPendingEvents() {
        if (this.syncInProgress || !this.isOnline) return { synced: 0 };

        this.syncInProgress = true;
        try {
            const pending = await this.getPendingEvents();
            if (pending.length === 0) return { synced: 0 };

            const token = localStorage.getItem('eduguardian_token');
            const response = await fetch('http://localhost:8080/api/proctor/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(pending),
            });

            if (response.ok) {
                const ids = pending.map((e) => e.id);
                await this.markAsSynced(ids);
                console.log(`[OfflineSync] Synced ${ids.length} events`);
                return { synced: ids.length };
            }
        } catch (err) {
            console.error('[OfflineSync] Sync failed:', err);
        } finally {
            this.syncInProgress = false;
        }
        return { synced: 0 };
    }

    async getPendingCount() {
        const pending = await this.getPendingEvents();
        return pending.length;
    }

    async clearSynced() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('synced');
            const request = index.openCursor(1); // Delete all synced (1)
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }
}

export const offlineSync = new OfflineSyncEngine();
