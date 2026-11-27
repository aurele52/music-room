export function queueSyncMigrations(
  columns: string[]
): string[] {
  const migrations: string[] = []

  if (!columns.includes('sync_state')) {
    migrations.push(
      `ALTER TABLE pending_operations
       ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'pending'`
    )
  }

  if (!columns.includes('sync_status')) {
    migrations.push(
      `ALTER TABLE pending_operations
       ADD COLUMN sync_status INTEGER`
    )
  }

  if (!columns.includes('sync_message')) {
    migrations.push(
      `ALTER TABLE pending_operations
       ADD COLUMN sync_message TEXT`
    )
  }

  return migrations
}
