import { supabase } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { IndicatorType, IndicatorEntry, UnitId, UNIT_COLLECTION_MAP } from '@/types';

const TABLE = 'indicator_entries';
const AUDIT_TABLE = 'audit_logs';

/** A no-arg unsubscribe function — mirrors Firestore's `Unsubscribe` type. */
type Unsubscribe = () => void;

// ────────────────────────────────────────────────────────────────
// Row <-> IndicatorEntry mapping
//
// Firestore stored one collection per unit with indicator-specific fields
// flat on the document. Postgres uses a single `indicator_entries` table
// with the indicator-specific fields folded into a `data` jsonb column, so
// we flatten/unflatten on the way in and out to keep the exact same
// IndicatorEntry shape the rest of the app already expects.
// ────────────────────────────────────────────────────────────────

interface EntryRow {
  id: string;
  indicator_type: IndicatorType;
  unit_id: string;
  entry_date: string;
  data: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEntry(row: EntryRow): IndicatorEntry {
  return {
    id: row.id,
    indicatorType: row.indicator_type,
    unitId: row.unit_id,
    date: row.entry_date,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...row.data,
  } as IndicatorEntry;
}

function entryToRowFields(entry: Record<string, unknown>) {
  const {
    indicatorType,
    unitId,
    date,
    createdBy,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    id: _id,
    ...rest
  } = entry as Record<string, unknown>;

  return {
    indicator_type: indicatorType,
    unit_id: unitId,
    entry_date: date,
    created_by: createdBy || null,
    data: rest,
  };
}

// ────────────────────────────────────────────────────────────────
// CRUD
// ────────────────────────────────────────────────────────────────

export async function createEntry(
  unitId: string,
  entry: Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const fields = entryToRowFields({ ...entry, unitId });

  // Debug: verify session exists before insert
  const { data: { session } } = await supabase.auth.getSession();
  console.log('[createEntry] Current user:', session?.user?.id);
  console.log('[createEntry] Insert payload fields:', { ...fields, data: '(omitted for brevity)' });
  console.log('[createEntry] created_by value:', fields.created_by);

  const { data, error } = await supabase
    .from(TABLE)
    .insert(fields)
    .select('id')
    .single();
  if (error) {
    console.error('[createEntry] Insert error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }
  return data.id as string;
}

export async function updateEntry(
  unitId: string,
  docId: string,
  data: Partial<IndicatorEntry>
): Promise<void> {
  // Split any known top-level columns out of the jsonb merge.
  const { date, createdBy, ...rest } = data as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (date !== undefined) patch.entry_date = date;
  if (createdBy !== undefined) patch.created_by = createdBy;

  if (Object.keys(rest).length > 0) {
    // Merge into existing jsonb rather than overwrite it entirely.
    const { data: existing, error: fetchErr } = await supabase
      .from(TABLE)
      .select('data')
      .eq('id', docId)
      .single();
    if (fetchErr) throw fetchErr;
    patch.data = { ...(existing?.data ?? {}), ...rest };
  }

  const { error } = await supabase.from(TABLE).update(patch).eq('id', docId).eq('unit_id', unitId);
  if (error) throw error;
}

export async function deleteEntry(unitId: string, docId: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', docId).eq('unit_id', unitId);
  if (error) throw error;
}

export async function getEntriesByIndicator(unitId: string, indicatorType: IndicatorType): Promise<IndicatorEntry[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('unit_id', unitId)
    .eq('indicator_type', indicatorType)
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return (data as EntryRow[]).map(rowToEntry);
}

export async function getAllEntriesForUnit(unitId: string): Promise<IndicatorEntry[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('unit_id', unitId)
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return (data as EntryRow[]).map(rowToEntry);
}

export async function getEntriesForIndicatorAllUnits(indicatorType: IndicatorType): Promise<IndicatorEntry[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('indicator_type', indicatorType)
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return (data as EntryRow[]).map(rowToEntry);
}

export async function getFilteredEntries(
  indicatorType: IndicatorType,
  unitId: string | null,
  startDate?: string,
  endDate?: string
): Promise<IndicatorEntry[]> {
  let query = supabase.from(TABLE).select('*').eq('indicator_type', indicatorType);

  if (unitId && unitId !== 'all') {
    query = query.eq('unit_id', unitId);
  }
  if (startDate) query = query.gte('entry_date', startDate);
  if (endDate) query = query.lte('entry_date', endDate);

  const { data, error } = await query.order('entry_date', { ascending: false });
  if (error) throw error;
  return (data as EntryRow[]).map(rowToEntry);
}

/** Real-time listener for entries of one indicator type in one unit. */
export function subscribeToEntries(
  unitId: string,
  indicatorType: IndicatorType,
  callback: (entries: IndicatorEntry[]) => void
): Unsubscribe {
  const refresh = async () => {
    try {
      callback(await getEntriesByIndicator(unitId, indicatorType));
    } catch (err) {
      console.error('subscribeToEntries refresh failed:', err);
    }
  };
  refresh();

  const channel = supabase
    .channel(`entries:${unitId}:${indicatorType}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `unit_id=eq.${unitId}` },
      () => refresh()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function batchImportEntries(
  unitId: string,
  entries: Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<number> {
  const rows = entries.map((entry) => entryToRowFields({ ...entry, unitId }));
  const CHUNK_SIZE = 500;
  let added = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { data: inserted, error } = await supabase.from(TABLE).insert(chunk).select('id');
    if (error) {
      console.error('Failed to insert batch:', error);
      // Fall back to individual inserts for this chunk.
      for (const row of chunk) {
        const { error: rowErr } = await supabase.from(TABLE).insert(row);
        if (!rowErr) added++;
        else console.error('Failed to import entry individually:', rowErr);
      }
    } else {
      added += inserted?.length ?? chunk.length;
    }
  }
  return added;
}

export async function getAllEntriesForCompliance(): Promise<IndicatorEntry[]> {
  const unitIds = Object.keys(UNIT_COLLECTION_MAP) as UnitId[];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .in('unit_id', unitIds);
  if (error) throw error;
  return (data as EntryRow[]).map(rowToEntry);
}

// ────────────────────────────────────────────────────────────────
// Real-time subscription for ALL indicators across units
// ────────────────────────────────────────────────────────────────

export interface RealtimeEntriesUpdate {
  indicatorType: IndicatorType;
  entries: IndicatorEntry[];
}

/**
 * Subscribe to real-time updates for ALL indicators, optionally scoped to
 * one unit. Emits one update per indicator type whenever any row in scope
 * changes (matches the old Firestore behavior of grouping by indicatorType).
 */
export function subscribeToAllIndicators(
  unitId: string | null,
  callback: (update: RealtimeEntriesUpdate) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const unitIds = unitId && unitId !== 'all' ? [unitId] : (Object.keys(UNIT_COLLECTION_MAP) as UnitId[]);

  const refreshAll = async () => {
    try {
      const { data, error } = await supabase.from(TABLE).select('*').in('unit_id', unitIds);
      if (error) throw error;

      const grouped: Partial<Record<IndicatorType, IndicatorEntry[]>> = {};
      for (const row of data as EntryRow[]) {
        const entry = rowToEntry(row);
        const type = entry.indicatorType;
        if (!grouped[type]) grouped[type] = [];
        grouped[type]!.push(entry);
      }
      for (const [type, entries] of Object.entries(grouped)) {
        entries!.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        callback({ indicatorType: type as IndicatorType, entries: entries! });
      }
    } catch (err) {
      onError?.(err as Error);
    }
  };

  refreshAll();

  const channel = supabase
    .channel(`all-indicators:${unitId ?? 'all'}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload: RealtimePostgresChangesPayload<EntryRow>) => {
        const row = (payload.new ?? payload.old) as EntryRow | undefined;
        if (row && !unitIds.includes(row.unit_id)) return; // out of scope
        refreshAll();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ────────────────────────────────────────────────────────────────
// Audit trail
// ────────────────────────────────────────────────────────────────

export interface AuditLogDocument {
  id?: string;
  type: 'block' | 'login' | 'input' | 'mapping' | 'ikp';
  msg: string;
  badge: string;
  ts: string;
  userId?: string;
  unitId?: string;
  createdAt: string;
}

interface AuditRow {
  id: string;
  type: AuditLogDocument['type'];
  msg: string;
  badge: string;
  ts: string;
  user_id: string | null;
  unit_id: string | null;
  created_at: string;
}

function rowToAudit(row: AuditRow): AuditLogDocument {
  return {
    id: row.id,
    type: row.type,
    msg: row.msg,
    badge: row.badge,
    ts: row.ts,
    userId: row.user_id ?? undefined,
    unitId: row.unit_id ?? undefined,
    createdAt: row.created_at,
  };
}

export async function addAuditLog(entry: Omit<AuditLogDocument, 'id' | 'createdAt'>): Promise<string> {
  const { data, error } = await supabase
    .from(AUDIT_TABLE)
    .insert({
      type: entry.type,
      msg: entry.msg,
      badge: entry.badge,
      ts: entry.ts,
      user_id: entry.userId || null,
      unit_id: entry.unitId || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getRecentAuditLogs(limitCount: number = 100): Promise<AuditLogDocument[]> {
  const { data, error } = await supabase
    .from(AUDIT_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limitCount);
  if (error) throw error;
  return (data as AuditRow[]).map(rowToAudit);
}

export function subscribeToAuditLogs(
  callback: (logs: AuditLogDocument[]) => void,
  limitCount: number = 100
): Unsubscribe {
  const refresh = async () => {
    try {
      callback(await getRecentAuditLogs(limitCount));
    } catch (err) {
      console.error('subscribeToAuditLogs refresh failed:', err);
    }
  };
  refresh();

  const channel = supabase
    .channel('audit-logs')
    .on('postgres_changes', { event: '*', schema: 'public', table: AUDIT_TABLE }, () => refresh())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function clearAuditLogs(): Promise<void> {
  // Deletes every row; RLS restricts this to admins (see the SQL policies).
  const { error } = await supabase.from(AUDIT_TABLE).delete().not('id', 'is', null);
  if (error) throw error;
}
