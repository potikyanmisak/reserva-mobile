import fs from "fs";
import cron from "node-cron";
import { Resend } from "resend";

const BACKUP_EMAIL_TO = process.env.BACKUP_EMAIL_TO || "";
const BACKUP_EMAIL_FROM = "Reserva Backups <noreply@reservaapp.app>";

let resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resend) resend = new Resend(key);
  return resend;
}

// Tracks the last backup date inside the database itself, so repeated
// server wake-ups on the same day don't send duplicate emails.
function ensureBackupLogTable(db: any): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      backed_up_on TEXT UNIQUE
    );
  `);
}

function alreadyBackedUpToday(db: any): boolean {
  ensureBackupLogTable(db);
  const today = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare("SELECT 1 FROM backup_log WHERE backed_up_on = ?")
    .get(today);
  return !!row;
}

function markBackedUpToday(db: any): void {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare("INSERT OR IGNORE INTO backup_log (backed_up_on) VALUES (?)").run(
    today,
  );
}

export async function runBackup(
  db: any,
  dbPath: string,
  force = false,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!BACKUP_EMAIL_TO) {
      console.warn("[backup] BACKUP_EMAIL_TO not set, skipping.");
      return { ok: false, message: "BACKUP_EMAIL_TO not set" };
    }
    if (!force && alreadyBackedUpToday(db)) {
      return { ok: false, message: "Already backed up today" };
    }
    const client = getResend();
    if (!client) {
      console.warn("[backup] RESEND_API_KEY not set, skipping.");
      return { ok: false, message: "RESEND_API_KEY not set" };
    }
    if (!fs.existsSync(dbPath)) {
      return { ok: false, message: `DB file not found at ${dbPath}` };
    }

    // Flush WAL into the main .db file so the emailed copy reflects the
    // latest committed data (better-sqlite3 runs in WAL mode).
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
    } catch (e) {
      console.warn("[backup] WAL checkpoint failed (continuing anyway):", e);
    }

    const fileBuffer = fs.readFileSync(dbPath);
    const today = new Date().toISOString().slice(0, 10);

    await client.emails.send({
      from: BACKUP_EMAIL_FROM,
      to: BACKUP_EMAIL_TO,
      subject: `Reserva DB Backup - ${today}`,
      html: `<p>Attached is the Reserva database backup for ${today}. Keep it somewhere safe.</p>`,
      attachments: [
        {
          filename: `reserva-${today}.db`,
          content: fileBuffer.toString("base64"),
        },
      ],
    });

    markBackedUpToday(db);
    console.log(`[backup] Emailed backup to ${BACKUP_EMAIL_TO} for ${today}`);
    return { ok: true, message: `Backup emailed for ${today}` };
  } catch (err) {
    console.error("[backup] Failed:", err);
    return { ok: false, message: String(err) };
  }
}

export function startBackupSchedule(db: any, dbPath: string): void {
  // Daily attempt at 3 AM server time. On the free plan this only fires if
  // the service happens to be awake at that moment.
  cron.schedule("0 3 * * *", () => {
    runBackup(db, dbPath).catch((e) =>
      console.error("[backup] cron error:", e),
    );
  });

  // Also check shortly after every startup/wake-up. Since alreadyBackedUpToday()
  // guards against duplicates, this is what actually catches the common case
  // where the free-tier service was asleep at 3 AM and only wakes later.
  setTimeout(() => {
    runBackup(db, dbPath).catch((e) =>
      console.error("[backup] startup check error:", e),
    );
  }, 10000);

  console.log("[backup] Backup schedule started (daily cron + startup check)");
}
