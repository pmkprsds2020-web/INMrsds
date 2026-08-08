import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  Unsubscribe,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { IndicatorType, IndicatorEntry, UnitId, UNIT_COLLECTION_MAP } from '@/types';

// Get the Firestore collection name for a unit
function getCollectionName(unitId: string): string {
  return UNIT_COLLECTION_MAP[unitId as UnitId] || unitId;
}

// Create a new indicator entry
export async function createEntry(unitId: string, entry: Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const colName = getCollectionName(unitId);
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, colName), {
    ...entry,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

// Update an indicator entry
export async function updateEntry(unitId: string, docId: string, data: Partial<IndicatorEntry>): Promise<void> {
  const colName = getCollectionName(unitId);
  const docRef = doc(db, colName, docId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

// Delete an indicator entry
export async function deleteEntry(unitId: string, docId: string): Promise<void> {
  const colName = getCollectionName(unitId);
  const docRef = doc(db, colName, docId);
  await deleteDoc(docRef);
}

// Get all entries for a specific indicator type from a unit
export async function getEntriesByIndicator(unitId: string, indicatorType: IndicatorType): Promise<IndicatorEntry[]> {
  const colName = getCollectionName(unitId);
  const q = query(
    collection(db, colName),
    where('indicatorType', '==', indicatorType)
  );
  const snapshot = await getDocs(q);
  const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as IndicatorEntry));
  entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return entries;
}

// Get all entries for a unit
export async function getAllEntriesForUnit(unitId: string): Promise<IndicatorEntry[]> {
  const colName = getCollectionName(unitId);
  const q = query(collection(db, colName));
  const snapshot = await getDocs(q);
  const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as IndicatorEntry));
  entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return entries;
}

// Get entries for an indicator type across ALL units
export async function getEntriesForIndicatorAllUnits(indicatorType: IndicatorType): Promise<IndicatorEntry[]> {
  const allEntries: IndicatorEntry[] = [];
  const unitIds = Object.keys(UNIT_COLLECTION_MAP) as UnitId[];

  const promises = unitIds.map(async (unitId) => {
    try {
      const entries = await getEntriesByIndicator(unitId, indicatorType);
      return entries;
    } catch {
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach(entries => allEntries.push(...entries));

  // Sort by date descending
  allEntries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return allEntries;
}

// Get entries for an indicator type with date filter
export async function getFilteredEntries(
  indicatorType: IndicatorType,
  unitId: string | null,
  startDate?: string,
  endDate?: string
): Promise<IndicatorEntry[]> {
  let entries: IndicatorEntry[];

  if (unitId && unitId !== 'all') {
    entries = await getEntriesByIndicator(unitId, indicatorType);
  } else {
    entries = await getEntriesForIndicatorAllUnits(indicatorType);
  }

  if (startDate) {
    entries = entries.filter(e => (e.date || '') >= startDate);
  }
  if (endDate) {
    entries = entries.filter(e => (e.date || '') <= endDate);
  }

  return entries;
}

// Real-time listener for entries
export function subscribeToEntries(
  unitId: string,
  indicatorType: IndicatorType,
  callback: (entries: IndicatorEntry[]) => void
): Unsubscribe {
  const colName = getCollectionName(unitId);
  const q = query(
    collection(db, colName),
    where('indicatorType', '==', indicatorType)
  );

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as IndicatorEntry));
    entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    callback(entries);
  });
}

// Batch import entries using Firestore batch writes for performance
export async function batchImportEntries(unitId: string, entries: Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<number> {
  const colName = getCollectionName(unitId);
  const colRef = collection(db, colName);
  const now = new Date().toISOString();
  let added = 0;

  // Firestore batches support max 500 operations per batch
  const BATCH_SIZE = 450; // leave room for safety margin
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const entry of chunk) {
      const docRef = doc(colRef); // auto-generate ID
      batch.set(docRef, {
        ...entry,
        createdAt: now,
        updatedAt: now,
      });
      added++;
    }
    try {
      await batch.commit();
    } catch (err) {
      console.error('Failed to commit batch:', err);
      // Fall back to individual writes for this chunk
      for (const entry of chunk) {
        try {
          await createEntry(unitId, entry);
        } catch (innerErr) {
          console.error('Failed to import entry individually:', innerErr);
          added--; // undo the count since this entry failed
        }
      }
    }
  }
  return added;
}

// Get all entries for Kepatuhan Unit analysis
export async function getAllEntriesForCompliance(): Promise<IndicatorEntry[]> {
  const allEntries: IndicatorEntry[] = [];
  const unitIds = Object.keys(UNIT_COLLECTION_MAP) as UnitId[];

  const promises = unitIds.map(async (unitId) => {
    try {
      const entries = await getAllEntriesForUnit(unitId);
      return entries;
    } catch {
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach(entries => allEntries.push(...entries));

  return allEntries;
}

// ────────────────────────────────────────────────────────────────
// Real-time subscription for ALL indicators across units
// ────────────────────────────────────────────────────────────────

export interface RealtimeEntriesUpdate {
  indicatorType: IndicatorType;
  entries: IndicatorEntry[];
}

/**
 * Subscribe to real-time updates for ALL indicators across ALL units.
 * Returns individual updates per indicator type so the UI can update incrementally.
 */
export function subscribeToAllIndicators(
  unitId: string | null,
  callback: (update: RealtimeEntriesUpdate) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const unitIds = unitId && unitId !== 'all'
    ? [unitId as UnitId]
    : Object.keys(UNIT_COLLECTION_MAP) as UnitId[];

  // Subscribe per unit (all indicators) — no limit to ensure all data is received
  const unsubscribes: Unsubscribe[] = [];

  for (const uid of unitIds) {
    const colName = getCollectionName(uid);
    const q = query(
      collection(db, colName)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        // Group entries by indicatorType and emit each group
        const grouped: Partial<Record<IndicatorType, IndicatorEntry[]>> = {};
        for (const d of snapshot.docs) {
          const entry = { id: d.id, ...d.data() } as IndicatorEntry;
          const type = entry.indicatorType as IndicatorType;
          if (!grouped[type]) grouped[type] = [];
          grouped[type]!.push(entry);
        }

        // Emit each indicator group separately (sorted client-side)
        for (const [type, entries] of Object.entries(grouped)) {
          entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          callback({ indicatorType: type as IndicatorType, entries: entries! });
        }
      },
      (error) => {
        console.error(`Real-time subscription error for ${colName}:`, error);
        onError?.(error);
      }
    );

    unsubscribes.push(unsub);
  }

  // Return a combined unsubscribe function
  return () => {
    unsubscribes.forEach(unsub => unsub());
  };
}

// ────────────────────────────────────────────────────────────────
// Audit Trail Firestore persistence
// ────────────────────────────────────────────────────────────────

const AUDIT_COLLECTION = 'audit_logs';

export interface AuditLogDocument {
  id?: string;
  type: 'block' | 'login' | 'input' | 'mapping';
  msg: string;
  badge: string;
  ts: string;
  userId?: string;
  unitId?: string;
  createdAt: string;
}

/** Add an audit log entry to Firestore */
export async function addAuditLog(entry: Omit<AuditLogDocument, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, AUDIT_COLLECTION), {
    ...entry,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

/** Get recent audit logs from Firestore */
export async function getRecentAuditLogs(limitCount: number = 100): Promise<AuditLogDocument[]> {
  const q = query(
    collection(db, AUDIT_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogDocument));
}

/** Subscribe to real-time audit logs */
export function subscribeToAuditLogs(
  callback: (logs: AuditLogDocument[]) => void,
  limitCount: number = 100
): Unsubscribe {
  const q = query(
    collection(db, AUDIT_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogDocument));
    callback(logs);
  });
}

/** Clear all audit logs from Firestore */
export async function clearAuditLogs(): Promise<void> {
  let hasMore = true;
  while (hasMore) {
    const q = query(collection(db, AUDIT_COLLECTION), limit(500));
    const snapshot = await getDocs(q);
    if (snapshot.empty) { hasMore = false; break; }
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}
