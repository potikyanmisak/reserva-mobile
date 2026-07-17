import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import { Resend } from "resend";
import { buildVerificationEmail } from "./emailTemplates";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "dist");
const alternateDistPath = path.join(process.cwd(), "dist");

console.log(
  `[Reserva] Startup Context: __dirname=${__dirname}, cwd=${process.cwd()}`,
);
console.log(
  `[Reserva] Checking distPath: ${distPath} (exists: ${fs.existsSync(distPath)})`,
);
if (!fs.existsSync(distPath) && fs.existsSync(alternateDistPath)) {
  console.log(`[Reserva] Using alternate distPath: ${alternateDistPath}`);
}

const finalDistPath = fs.existsSync(distPath)
  ? distPath
  : fs.existsSync(alternateDistPath)
    ? alternateDistPath
    : distPath;

console.log("[Reserva] >>> APP STARTING... <<<");

// JWT_SECRET is now required. The server refuses to start without it so that
// tokens can never be signed/verified using a predictable, publicly-known
// fallback secret.
if (!process.env.JWT_SECRET) {
  throw new Error(
    "[Reserva] FATAL: JWT_SECRET environment variable is not set. " +
      "Set JWT_SECRET in your environment/secrets before starting the server.",
  );
}
const JWT_SECRET: string = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";

let resend: Resend | null = null;
const getResend = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resend) resend = new Resend(key);
  return resend;
};

const sendEmail = async (to: string, subject: string, html: string) => {
  const client = getResend();
  if (!client) {
    console.warn("--- [Reserva] EMAIL SIMULATION MODE ---");
    console.warn(`To: ${to}`);
    console.warn(`Subject: ${subject}`);
    const textContent = html.replace(/<[^>]*>?/gm, " ").trim();
    console.warn("--- [Reserva] EMAIL CONTENT START ---");
    console.warn(textContent);
    console.warn("--- [Reserva] EMAIL CONTENT END ---");
    try {
      const emailLogPath =
        process.env.NODE_ENV === "production"
          ? "/tmp/email_log.txt"
          : "email_log.txt";
      fs.appendFileSync(
        emailLogPath,
        `[${new Date().toISOString()}] To: ${to} | Subject: ${subject} | Content: ${textContent}\n`,
      );
    } catch (e) {
      console.error("Failed to write to email_log.txt", e);
    }
    console.warn(
      "[Reserva] TIP: Set RESEND_API_KEY in Secrets to send real emails.",
    );
    return;
  }
  try {
    await client.emails.send({
      from: "Reserva <noreply@reservaapp.app>",
      to,
      subject,
      html,
    });
    console.log(`[Reserva] Email sent to: ${to}`);
  } catch (err) {
    console.error("[Reserva] Error sending email:", err);
  }
};

let db: any;

async function sendPushNotification(
  pushToken: string | null,
  title: string,
  body: string,
) {
  if (!pushToken) return;
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ to: pushToken, title, body, sound: "default" }),
    });
    const data = await res.json();
    console.log("[Reserva] Push result:", JSON.stringify(data));
  } catch (err) {
    console.error("[Reserva] Push send error:", err);
  }
}

async function startServer() {
  const app = express();
  console.log("[Reserva] Configuring middleware...");
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  app.use((req: any, res: any, next: any) => {
    if (req.method === "POST" && req.path === "/api/login")
      console.log(`[Reserva] Login attempt for: ${req.body?.email}`);
    if (req.method === "POST" && req.path === "/api/register")
      console.log(`[Reserva] Registration attempt for: ${req.body?.email}`);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  try {
    console.log("[Reserva] Initializing Database...");
    const dbPath =
      process.env.DB_PATH ||
      (process.env.NODE_ENV === "production"
        ? "/tmp/reserva.db"
        : "reserva.db");
    console.log(`[Reserva] Using database at: ${dbPath}`);
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    console.log("[Reserva] Database connection established.");

    console.log("[Reserva] Creating tables...");

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT,
        surname TEXT,
        role TEXT DEFAULT 'customer',
        photo_url TEXT,
        is_verified INTEGER DEFAULT 0,
        verification_code TEXT,
        code_expires_at DATETIME,
        reliability_score INTEGER DEFAULT 100
      );
    `);

    const userTableInfo = db.prepare("PRAGMA table_info(users)").all();
    if (!userTableInfo.some((col: any) => col.name === "reliability_score")) {
      db.exec(
        "ALTER TABLE users ADD COLUMN reliability_score INTEGER DEFAULT 100",
      );
    }
    if (!userTableInfo.some((col: any) => col.name === "push_token")) {
      db.exec("ALTER TABLE users ADD COLUMN push_token TEXT");
    }
    if (!userTableInfo.some((col: any) => col.name === "phone")) {
      db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER,
        name TEXT,
        description TEXT,
        cuisine_type TEXT,
        location TEXT,
        logo_url TEXT,
        background_url TEXT,
        rating REAL DEFAULT 0,
        dist_km REAL DEFAULT 0,
        is_recommended INTEGER DEFAULT 0,
        outdoor_seating INTEGER DEFAULT 0,
        open_time TEXT,
        close_time TEXT,
        deposit_amount REAL DEFAULT 0,
        cancellation_policy_hours INTEGER DEFAULT 24,
        phone_number TEXT,
        max_reservation_duration INTEGER DEFAULT 90,
        advance_booking_days INTEGER DEFAULT 30,
        min_booking_notice_hours REAL DEFAULT 1,
        allow_combining_tables INTEGER DEFAULT 0,
        allow_upsizing_tables INTEGER DEFAULT 1,
        notify_new_reservation INTEGER DEFAULT 1,
        notify_cancellations INTEGER DEFAULT 1,
        notify_waitlist INTEGER DEFAULT 1,
        lat REAL DEFAULT 0,
        lng REAL DEFAULT 0,
        status TEXT DEFAULT 'approved',
        experience_types TEXT DEFAULT '[]',
        amenities TEXT DEFAULT '[]',
        moods TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(owner_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS restaurant_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER,
        day_of_week INTEGER,
        open_time TEXT,
        close_time TEXT,
        is_closed INTEGER DEFAULT 0,
        FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        reservation_id INTEGER,
        message TEXT,
        send_at DATETIME,
        sent INTEGER DEFAULT 0,
        cancelled INTEGER DEFAULT 0,
        read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(reservation_id) REFERENCES reservations(id)
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER,
        name TEXT,
        resource_type TEXT DEFAULT 'table',
        capacity INTEGER,
        location TEXT DEFAULT 'indoor',
        shape TEXT DEFAULT 'square',
        features TEXT DEFAULT '[]',
        min_booking_minutes INTEGER DEFAULT 30,
        max_booking_minutes INTEGER,
        price_per_hour REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS addons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER,
        name TEXT,
        price REAL,
        category TEXT,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS reservation_addons (
        reservation_id INTEGER,
        addon_id INTEGER,
        quantity INTEGER DEFAULT 1,
        PRIMARY KEY(reservation_id, addon_id)
      );
    `);

    function scheduleNotifications(
      userId: number,
      reservationId: number,
      restaurantName: string,
      reservationDate: string,
      reservationTime: string,
    ) {
      const now = new Date();
      const reservationDateTime = new Date(
        `${reservationDate}T${reservationTime}`,
      );
      const gapMinutes =
        (reservationDateTime.getTime() - now.getTime()) / 60000;

      db.prepare(
        "UPDATE notifications SET cancelled = 1 WHERE reservation_id = ? AND sent = 0",
      ).run(reservationId);

      const timeStr = reservationDateTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dateStr = reservationDateTime.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      const toSchedule: { message: string; sendAt: Date }[] = [];

      toSchedule.push({
        message: `✅ Booking confirmed! Your table at ${restaurantName} is set for ${timeStr} on ${dateStr}.`,
        sendAt: new Date(now.getTime() + 3000),
      });

      if (gapMinutes > 26 * 60) {
        toSchedule.push({
          message: `🍽️ Reminder: You have a reservation at ${restaurantName} tomorrow at ${timeStr}.`,
          sendAt: new Date(reservationDateTime.getTime() - 24 * 60 * 60000),
        });
      }
      if (gapMinutes > 3.5 * 60) {
        toSchedule.push({
          message: `⏰ Your table at ${restaurantName} is in 3 hours (${timeStr}). Don't be late!`,
          sendAt: new Date(reservationDateTime.getTime() - 3 * 60 * 60000),
        });
      }
      if (gapMinutes > 75) {
        toSchedule.push({
          message: `🚗 Heads up! Your reservation at ${restaurantName} is in 1 hour at ${timeStr}.`,
          sendAt: new Date(reservationDateTime.getTime() - 60 * 60000),
        });
      }
      if (gapMinutes > 20) {
        toSchedule.push({
          message: `🏃 You're up! Your table at ${restaurantName} is in 15 minutes!`,
          sendAt: new Date(reservationDateTime.getTime() - 15 * 60000),
        });
      }

      const insertNotif = db.prepare(
        "INSERT INTO notifications (user_id, reservation_id, message, send_at) VALUES (?, ?, ?, ?)",
      );
      for (const notif of toSchedule) {
        insertNotif.run(
          userId,
          reservationId,
          notif.message,
          notif.sendAt.toISOString(),
        );
      }
      console.log(
        `[Reserva] Scheduled ${toSchedule.length} notifications for reservation ${reservationId}`,
      );
    }

    const restaurantTableInfo = db
      .prepare("PRAGMA table_info(restaurants)")
      .all();
    const addRestaurantCol = (col: string, def: string) => {
      if (!restaurantTableInfo.some((c: any) => c.name === col)) {
        db.exec(`ALTER TABLE restaurants ADD COLUMN ${col} ${def}`);
      }
    };
    addRestaurantCol("deposit_amount", "REAL DEFAULT 0");
    addRestaurantCol("cancellation_policy_hours", "INTEGER DEFAULT 24");
    addRestaurantCol("phone_number", "TEXT");
    addRestaurantCol("max_reservation_duration", "INTEGER DEFAULT 90");
    addRestaurantCol("advance_booking_days", "INTEGER DEFAULT 30");
    addRestaurantCol("min_booking_notice_hours", "REAL DEFAULT 1");
    addRestaurantCol("allow_combining_tables", "INTEGER DEFAULT 0");
    addRestaurantCol("allow_upsizing_tables", "INTEGER DEFAULT 1");
    addRestaurantCol("notify_new_reservation", "INTEGER DEFAULT 1");
    addRestaurantCol("notify_cancellations", "INTEGER DEFAULT 1");
    addRestaurantCol("notify_waitlist", "INTEGER DEFAULT 1");
    addRestaurantCol("min_price", "INTEGER DEFAULT 0");
    addRestaurantCol("max_price", "INTEGER DEFAULT 0");
    addRestaurantCol("lat", "REAL DEFAULT 0");
    addRestaurantCol("lng", "REAL DEFAULT 0");
    addRestaurantCol("status", "TEXT DEFAULT 'approved'");
    addRestaurantCol("experience_types", "TEXT DEFAULT '[]'");
    addRestaurantCol("amenities", "TEXT DEFAULT '[]'");
    addRestaurantCol("moods", "TEXT DEFAULT '[]'");
    addRestaurantCol("secondary_phone", "TEXT");
    addRestaurantCol("created_at", "DATETIME DEFAULT '1970-01-01 00:00:00'");
    addRestaurantCol("duration_mode", "TEXT DEFAULT 'manual'"); // 'manual' | 'auto'

    const notifTableInfo = db.prepare("PRAGMA table_info(notifications)").all();
    if (!notifTableInfo.some((col: any) => col.name === "read")) {
      db.exec("ALTER TABLE notifications ADD COLUMN read INTEGER DEFAULT 0");
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER,
        customer_id INTEGER,
        people_count INTEGER,
        date TEXT,
        time TEXT,
        end_time TEXT,
        status TEXT DEFAULT 'pending',
        is_waitlist INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(restaurant_id) REFERENCES restaurants(id),
        FOREIGN KEY(customer_id) REFERENCES users(id)
      );
    `);

    const reservationTableInfo = db
      .prepare("PRAGMA table_info(reservations)")
      .all();
    const addReservationCol = (col: string, def: string) => {
      if (!reservationTableInfo.some((c: any) => c.name === col)) {
        db.exec(`ALTER TABLE reservations ADD COLUMN ${col} ${def}`);
      }
    };
    addReservationCol("end_time", "TEXT");
    addReservationCol("is_waitlist", "INTEGER DEFAULT 0");
    addReservationCol("table_id", "INTEGER");
    addReservationCol("seating_preference", "TEXT");
    addReservationCol("resource_id", "INTEGER");
    addReservationCol("start_time", "TEXT");

    db.exec(
      "UPDATE reservations SET start_time = time WHERE start_time IS NULL AND time IS NOT NULL",
    );

    db.exec(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER,
        customer_id INTEGER,
        people_count INTEGER,
        status TEXT DEFAULT 'waiting',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        offered_at DATETIME,
        expires_at DATETIME,
        FOREIGN KEY(restaurant_id) REFERENCES restaurants(id),
        FOREIGN KEY(customer_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER,
        customer_id INTEGER,
        rating INTEGER,
        comment TEXT,
        likes INTEGER DEFAULT 0,
        sentiment TEXT,
        categories TEXT,
        user_confirmed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(restaurant_id) REFERENCES restaurants(id),
        FOREIGN KEY(customer_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS collections (
        user_id INTEGER,
        restaurant_id INTEGER,
        PRIMARY KEY(user_id, restaurant_id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
      );

      CREATE TABLE IF NOT EXISTS restaurant_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER,
        url TEXT,
        image_type TEXT DEFAULT 'gallery',
        FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
      );

      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER,
        capacity INTEGER,
        location TEXT,
        shape TEXT DEFAULT 'square',
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
      );

      CREATE TABLE IF NOT EXISTS review_likes (
        user_id INTEGER,
        review_id INTEGER,
        PRIMARY KEY (user_id, review_id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(review_id) REFERENCES reviews(id)
      );
    `);

    db.exec(`
  CREATE TABLE IF NOT EXISTS bug_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category TEXT,
    details TEXT,
    restaurant_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
      );
    `);

    const bugTableInfo = db.prepare("PRAGMA table_info(bug_reports)").all();
    if (!bugTableInfo.some((c: any) => c.name === "details")) {
      db.exec("ALTER TABLE bug_reports ADD COLUMN details TEXT");
    }
    if (!bugTableInfo.some((c: any) => c.name === "restaurant_id")) {
      db.exec("ALTER TABLE bug_reports ADD COLUMN restaurant_id INTEGER");
    }

    const tableTableInfo = db.prepare("PRAGMA table_info(tables)").all();
    if (!tableTableInfo.some((col: any) => col.name === "shape")) {
      db.exec("ALTER TABLE tables ADD COLUMN shape TEXT DEFAULT 'square'");
    }

    const reviewTableInfo = db.prepare("PRAGMA table_info(reviews)").all();
    if (!reviewTableInfo.some((col: any) => col.name === "sentiment"))
      db.exec("ALTER TABLE reviews ADD COLUMN sentiment TEXT");
    if (!reviewTableInfo.some((col: any) => col.name === "categories"))
      db.exec("ALTER TABLE reviews ADD COLUMN categories TEXT");
    if (!reviewTableInfo.some((col: any) => col.name === "user_confirmed"))
      db.exec(
        "ALTER TABLE reviews ADD COLUMN user_confirmed INTEGER DEFAULT 0",
      );

    const imgTableInfo = db
      .prepare("PRAGMA table_info(restaurant_images)")
      .all();
    if (!imgTableInfo.some((col: any) => col.name === "image_type")) {
      db.exec(
        "ALTER TABLE restaurant_images ADD COLUMN image_type TEXT DEFAULT 'gallery'",
      );
      db.exec(
        "UPDATE restaurant_images SET image_type = 'gallery' WHERE image_type IS NULL",
      );
      console.log("[Reserva] Migrated: added image_type to restaurant_images");
    }

    const resourceCount: any = db
      .prepare("SELECT COUNT(*) as count FROM resources")
      .get();
    const tableCount: any = db
      .prepare("SELECT COUNT(*) as count FROM tables WHERE is_active = 1")
      .get();
    if (resourceCount.count === 0 && tableCount.count > 0) {
      console.log("[Reserva] Migrating tables → resources...");
      db.exec(`
        INSERT INTO resources (id, restaurant_id, name, resource_type, capacity, location, shape, features, min_booking_minutes, max_booking_minutes, price_per_hour, is_active)
        SELECT id, restaurant_id,
          'Table ' || id AS name,
          'table' AS resource_type,
          capacity,
          COALESCE(location, 'indoor'),
          COALESCE(shape, 'square'),
          '[]' AS features,
          30 AS min_booking_minutes,
          NULL AS max_booking_minutes,
          0.0 AS price_per_hour,
          is_active
        FROM tables WHERE is_active = 1
      `);
      db.exec(
        "UPDATE reservations SET resource_id = table_id WHERE table_id IS NOT NULL AND resource_id IS NULL",
      );
      console.log("[Reserva] Migration complete.");
    }

    console.log("[Reserva] Schema initialized.");

    // ── authenticate middleware ────────────────────────────────────────────────
    const authenticate = (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ error: "No token provided" });
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : authHeader;
      if (!token || token === "null" || token === "undefined")
        return res.status(401).json({ error: "Invalid token" });
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        console.log(
          `[Reserva Auth] JWT Verified for user: ${decoded.id}, role: ${decoded.role}`,
        );
        if (decoded.role) decoded.role = decoded.role.toLowerCase();
        req.user = decoded;
        next();
      } catch (err) {
        console.error("[Reserva Auth] JWT Verify Error:", err);
        res.status(401).json({ error: "Invalid token" });
      }
    };

    app.get("/api/notifications", authenticate, (req: any, res) => {
      try {
        const notifs = db
          .prepare(
            `SELECT * FROM notifications WHERE user_id = ? AND sent = 1 AND cancelled = 0 AND read = 0 ORDER BY send_at DESC LIMIT 50`,
          )
          .all(req.user.id);
        res.json(notifs.map((n: any) => ({ ...n, read: n.read === 1 })));
      } catch (err) {
        console.error("[Reserva] Notifications fetch error:", err);
        res.status(500).json([]);
      }
    });

    app.post("/api/notifications/:id/read", authenticate, (req: any, res) => {
      db.prepare(
        "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?",
      ).run(req.params.id, req.user.id);
      res.json({ success: true });
    });

    app.post("/api/notifications/read-all", authenticate, (req: any, res) => {
      db.prepare(
        "UPDATE notifications SET read = 1 WHERE user_id = ? AND sent = 1",
      ).run(req.user.id);
      res.json({ success: true });
    });

    app.post("/api/register", async (req, res) => {
      const { email, password, name, surname, role, phone } = req.body;
      if (!email || !password || (role !== "owner" && (!name || !surname))) {
        return res.status(400).json({
          error:
            role === "owner"
              ? "Email and Password are required."
              : "Email, Password, Name and Surname are required.",
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      try {
        const existingUser: any = db
          .prepare("SELECT * FROM users WHERE email = ?")
          .get(email);

        if (existingUser) {
          if (existingUser.is_verified) {
            return res.status(400).json({
              error: "Account already exists. Please sign in instead.",
              code: "USER_EXISTS",
            });
          }

          // Unverified account from an abandoned signup — refresh their
          // details/code instead of blocking them.
          db.prepare(
            "UPDATE users SET password = ?, name = ?, surname = ?, phone = ? , role = ?, verification_code = ?, code_expires_at = ? WHERE id = ?",
          ).run(
            hashedPassword,
            name,
            surname,
            phone,
            role || "customer",
            code,
            expiresAt,
            existingUser.id,
          );

          await sendEmail(
            email,
            "Verify your Reserva account",
            buildVerificationEmail(name || "there", code),
          );

          return res.json({ email, userId: existingUser.id });
        }

        const stmt = db.prepare(
          "INSERT INTO users (email, password, name, surname, phone , role, verification_code, code_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        );
        const result = stmt.run(
          email,
          hashedPassword,
          name,
          surname,
          phone,
          role || "customer",
          code,
          expiresAt,
        );
        await sendEmail(
          email,
          "Verify your Reserva account",
          buildVerificationEmail(name || "there", code),
        );
        res.json({ email, userId: result.lastInsertRowid });
      } catch (err) {
        console.error(err);
        res
          .status(500)
          .json({ error: "Internal server error during registration" });
      }
    });

    app.post("/api/verify", async (req, res) => {
      const { email, code } = req.body;
      const user: any = db
        .prepare(
          "SELECT * FROM users WHERE email = ? AND verification_code = ?",
        )
        .get(email, code);
      if (!user)
        return res.status(400).json({ error: "Invalid verification code" });
      if (new Date(user.code_expires_at) < new Date())
        return res.status(400).json({ error: "Code has expired" });
      db.prepare(
        "UPDATE users SET is_verified = 1, verification_code = NULL, code_expires_at = NULL WHERE id = ?",
      ).run(user.id);
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          surname: user.surname,
          role: user.role,
          photo_url: user.photo_url,
        },
      });
    });

    app.post("/api/resend-code", async (req, res) => {
      const { email } = req.body;
      const user: any = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(email);
      if (!user) return res.status(404).json({ error: "User not found" });
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      db.prepare(
        "UPDATE users SET verification_code = ?, code_expires_at = ? WHERE id = ?",
      ).run(code, expiresAt, user.id);
      await sendEmail(
        email,
        "Verify your Reserva account",
        buildVerificationEmail(user.name || "there", code),
      );
      res.json({ success: true });
    });

    app.post("/api/login", async (req, res) => {
      const { email, password } = req.body;
      const user: any = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(email);
      if (!user)
        return res
          .status(404)
          .json({ error: "No account found with this email address." });
      if (!(await bcrypt.compare(password, user.password)))
        return res.status(401).json({ error: "Invalid credentials" });
      if (user.is_verified === 0)
        return res
          .status(403)
          .json({ error: "Email not verified", unverified: true });
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          surname: user.surname,
          role: user.role,
          photo_url: user.photo_url,
        },
      });
    });

    app.post("/api/auth/forgot-password", async (req, res) => {
      const { email } = req.body;
      const user: any = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(email);
      if (!user)
        return res
          .status(404)
          .json({ error: "No account found with this email address." });
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      db.prepare(
        "UPDATE users SET verification_code = ?, code_expires_at = ? WHERE id = ?",
      ).run(code, expiresAt, user.id);
      await sendEmail(
        email,
        "Verify your Reserva account",
        buildVerificationEmail(user.name || "there", code),
      );
      res.json({ success: true });
    });

    app.post("/api/auth/verify-reset-code", async (req, res) => {
      const { email, code } = req.body;
      const user: any = db
        .prepare(
          "SELECT * FROM users WHERE email = ? AND verification_code = ?",
        )
        .get(email, code);
      if (!user)
        return res.status(400).json({ error: "Invalid or expired code." });
      if (new Date(user.code_expires_at) < new Date())
        return res.status(400).json({ error: "Code has expired." });
      db.prepare(
        "UPDATE users SET is_verified = 1, verification_code = NULL, code_expires_at = NULL WHERE id = ?",
      ).run(user.id);
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          surname: user.surname,
          role: user.role,
          photo_url: user.photo_url,
        },
      });
    });

    app.post("/api/user/update-photo", authenticate, (req: any, res) => {
      const { photo_url } = req.body;
      try {
        db.prepare("UPDATE users SET photo_url = ? WHERE id = ?").run(
          photo_url,
          req.user.id,
        );
        res.json({ success: true, photo_url });
      } catch (err) {
        console.error("[Reserva] Photo update error:", err);
        res.status(500).json({ error: "Failed to update profile photo" });
      }
    });

    app.post("/api/user/push-token", authenticate, (req: any, res) => {
      const { push_token } = req.body;
      console.log(
        "[Reserva] Saving push token for user",
        req.user.id,
        ":",
        push_token,
      );
      try {
        db.prepare("UPDATE users SET push_token = ? WHERE id = ?").run(
          push_token,
          req.user.id,
        );
        res.json({ success: true });
      } catch (err) {
        console.error("[Reserva] Push token update error:", err);
        res.status(500).json({ error: "Failed to save push token" });
      }
    });

    app.post("/api/user/clear-history", authenticate, (req: any, res) => {
      try {
        db.prepare("DELETE FROM notifications WHERE user_id = ?").run(
          req.user.id,
        );
        db.prepare("DELETE FROM reservations WHERE customer_id = ?").run(
          req.user.id,
        );
        db.prepare("DELETE FROM reviews WHERE customer_id = ?").run(
          req.user.id,
        );
        db.prepare("DELETE FROM waitlist WHERE customer_id = ?").run(
          req.user.id,
        );
        db.prepare("DELETE FROM collections WHERE user_id = ?").run(
          req.user.id,
        );
        res.json({ success: true });
      } catch (err) {
        console.error("[Reserva] Clear history error:", err);
        res.status(500).json({ error: "Failed to clear history" });
      }
    });

    app.delete("/api/user/delete", authenticate, (req: any, res) => {
      try {
        const userId = req.user.id;
        db.prepare("DELETE FROM notifications WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM reservations WHERE customer_id = ?").run(
          userId,
        );
        db.prepare("DELETE FROM reviews WHERE customer_id = ?").run(userId);
        db.prepare("DELETE FROM waitlist WHERE customer_id = ?").run(userId);
        db.prepare("DELETE FROM collections WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM review_likes WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM users WHERE id = ?").run(userId);
        res.json({ success: true });
      } catch (err) {
        console.error("[Reserva] Delete account error:", err);
        res.status(500).json({ error: "Failed to delete account" });
      }
    });

    app.post("/api/user/settings", authenticate, (req: any, res) => {
      const { name, surname, email } = req.body;
      if (!name || !surname || !email)
        return res
          .status(400)
          .json({ error: "Name, surname, and email are required." });
      try {
        const existing: any = db
          .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
          .get(email, req.user.id);
        if (existing)
          return res
            .status(400)
            .json({ error: "Email is already in use by another account." });
        db.prepare(
          "UPDATE users SET name = ?, surname = ?, email = ? WHERE id = ?",
        ).run(name, surname, email, req.user.id);
        const updated: any = db
          .prepare(
            "SELECT id, email, name, surname, role, photo_url FROM users WHERE id = ?",
          )
          .get(req.user.id);
        res.json({ success: true, user: updated });
      } catch (err) {
        console.error("[Reserva] Settings update error:", err);
        res.status(500).json({ error: "Failed to update settings" });
      }
    });

    app.get("/api/me", authenticate, (req: any, res) => {
      const user: any = db
        .prepare(
          "SELECT id, email, name, surname, role, photo_url, reliability_score FROM users WHERE id = ?",
        )
        .get(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    });

    app.get("/api/user/stats", authenticate, (req: any, res) => {
      try {
        const stats = db
          .prepare(
            `SELECT COUNT(*) as reviewsCount, COALESCE(SUM(likes), 0) as totalLikes FROM reviews WHERE customer_id = ?`,
          )
          .get(req.user.id) as any;
        res.json(stats);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch stats" });
      }
    });

    // ── Restaurants ───────────────────────────────────────────────────────────
    app.get("/api/restaurants", (req, res) => {
      const { cuisine, outdoor } = req.query;
      let query = `
        SELECT r.*,
          (SELECT ri.url FROM restaurant_images ri
           WHERE ri.restaurant_id = r.id
             AND (ri.image_type = 'gallery' OR ri.image_type IS NULL)
           ORDER BY ri.id ASC
           LIMIT 1) as cover_image_url
        FROM restaurants r
        WHERE r.status = 'approved'
      `;
      const params: any[] = [];
      if (cuisine) {
        query += " AND r.cuisine_type = ?";
        params.push(cuisine);
      }
      if (outdoor === "true") {
        query += " AND r.outdoor_seating = 1";
      }
      const all = db.prepare(query).all(...params);
      const recommended = all.filter((r: any) => r.is_recommended === 1);
      res.json({ recommended, all });
    });

    app.post("/api/restaurants", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      const {
        name,
        description,
        cuisine_type,
        location,
        logo_url,
        open_time,
        close_time,
        outdoor_seating,
        min_price,
        max_price,
        phone_number,
        experience_types,
        amenities,
        moods,
        deposit_amount,
        cancellation_policy_hours,
        status,
      } = req.body;
      if (!logo_url) return res.status(400).json({ error: "Logo is required" });
      const resolvedStatus =
        req.user.role === "admin" ? status || "approved" : "pending";
      try {
        const stmt = db.prepare(
          `INSERT INTO restaurants (owner_id, name, description, cuisine_type, location, logo_url, open_time, close_time, is_recommended, outdoor_seating, min_price, max_price, phone_number, experience_types, amenities, moods, deposit_amount, cancellation_policy_hours, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        const result = stmt.run(
          req.user.id,
          name,
          description,
          cuisine_type || "General",
          location,
          logo_url,
          open_time || "09:00",
          close_time || "22:00",
          0,
          outdoor_seating ? 1 : 0,
          min_price || 0,
          max_price || 0,
          phone_number || null,
          JSON.stringify(experience_types || []),
          JSON.stringify(amenities || []),
          JSON.stringify(moods || []),
          deposit_amount || 0,
          cancellation_policy_hours || 24,
          resolvedStatus,
        );
        db.prepare("UPDATE users SET photo_url = ? WHERE id = ?").run(
          logo_url,
          req.user.id,
        );
        res.json({
          id: result.lastInsertRowid,
          success: true,
          status: resolvedStatus,
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not create restaurant" });
      }
    });

    app.get("/api/owner/application-status", authenticate, (req: any, res) => {
      if (req.user.role !== "owner")
        return res.status(403).json({ error: "Not authorized" });
      const restaurant: any = db
        .prepare(
          "SELECT id, status, created_at FROM restaurants WHERE owner_id = ? ORDER BY id DESC LIMIT 1",
        )
        .get(req.user.id);
      if (!restaurant) return res.json({ status: "none" });
      if (restaurant.status === "pending")
        return res.json({
          status: "pending",
          restaurant_id: restaurant.id,
          submitted_at: restaurant.created_at,
        });
      if (restaurant.status === "declined")
        return res.json({ status: "declined", restaurant_id: restaurant.id });
      return res.json({ status: "approved", restaurant_id: restaurant.id });
    });

    app.get("/api/admin/restaurants/pending", authenticate, (req: any, res) => {
      if (req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      const pending = db
        .prepare(
          "SELECT * FROM restaurants WHERE status = 'pending' ORDER BY created_at ASC",
        )
        .all()
        .map((r: any) => ({
          ...r,
          experience_types: (() => {
            try {
              return JSON.parse(r.experience_types || "[]");
            } catch {
              return [];
            }
          })(),
          amenities: (() => {
            try {
              return JSON.parse(r.amenities || "[]");
            } catch {
              return [];
            }
          })(),
          moods: (() => {
            try {
              return JSON.parse(r.moods || "[]");
            } catch {
              return [];
            }
          })(),
          outdoor_seating: r.outdoor_seating === 1,
        }));
      res.json(pending);
    });

    app.get(
      "/api/admin/restaurants/approved",
      authenticate,
      (req: any, res) => {
        if (req.user.role !== "admin")
          return res.status(403).json({ error: "Not authorized" });
        const approved = db
          .prepare(
            `SELECT r.*,
            (SELECT ri.url FROM restaurant_images ri
             WHERE ri.restaurant_id = r.id
               AND (ri.image_type = 'gallery' OR ri.image_type IS NULL)
             ORDER BY ri.id ASC
             LIMIT 1) as cover_image_url
           FROM restaurants r
           WHERE r.status = 'approved'
           ORDER BY r.name ASC`,
          )
          .all()
          .map((r: any) => ({
            ...r,
            experience_types: (() => {
              try {
                return JSON.parse(r.experience_types || "[]");
              } catch {
                return [];
              }
            })(),
            amenities: (() => {
              try {
                return JSON.parse(r.amenities || "[]");
              } catch {
                return [];
              }
            })(),
            moods: (() => {
              try {
                return JSON.parse(r.moods || "[]");
              } catch {
                return [];
              }
            })(),
          }));
        res.json(approved);
      },
    );

    app.get("/api/admin/featured", authenticate, (req: any, res) => {
      if (req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      const featured = db
        .prepare(
          `SELECT r.*,
            (SELECT ri.url FROM restaurant_images ri
             WHERE ri.restaurant_id = r.id
               AND (ri.image_type = 'gallery' OR ri.image_type IS NULL)
             ORDER BY ri.id ASC
             LIMIT 1) as cover_image_url
           FROM restaurants r
           WHERE r.is_recommended = 1 AND r.status = 'approved'
           ORDER BY r.name ASC`,
        )
        .all();
      res.json(featured);
    });

    app.post("/api/admin/featured/:id", authenticate, (req: any, res) => {
      if (req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      db.prepare("UPDATE restaurants SET is_recommended = 1 WHERE id = ?").run(
        req.params.id,
      );
      res.json({ success: true });
    });

    app.delete("/api/admin/featured/:id", authenticate, (req: any, res) => {
      if (req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      db.prepare("UPDATE restaurants SET is_recommended = 0 WHERE id = ?").run(
        req.params.id,
      );
      res.json({ success: true });
    });

    app.post(
      "/api/admin/restaurants/:id/approve",
      authenticate,
      async (req: any, res) => {
        if (req.user.role !== "admin")
          return res.status(403).json({ error: "Not authorized" });
        const restaurant: any = db
          .prepare(
            "SELECT r.*, u.email, u.name FROM restaurants r JOIN users u ON r.owner_id = u.id WHERE r.id = ?",
          )
          .get(req.params.id);
        if (!restaurant)
          return res.status(404).json({ error: "Restaurant not found" });
        db.prepare(
          "UPDATE restaurants SET status = 'approved' WHERE id = ?",
        ).run(req.params.id);
        sendEmail(
          restaurant.email,
          "🎉 Your restaurant has been approved! — Reserva",
          `<div style="font-family: sans-serif; max-width: 400px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #0070f3; text-align: center;">RESERVA</h2>
          <p>Hi ${restaurant.name},</p>
          <p>Great news! Your restaurant <b>${restaurant.name}</b> has been approved and is now live on Reserva.</p>
        </div>`,
        ).catch(console.error);
        res.json({ success: true });
      },
    );

    app.post(
      "/api/admin/restaurants/:id/decline",
      authenticate,
      async (req: any, res) => {
        if (req.user.role !== "admin")
          return res.status(403).json({ error: "Not authorized" });
        const restaurant: any = db
          .prepare(
            "SELECT r.*, u.email, u.name FROM restaurants r JOIN users u ON r.owner_id = u.id WHERE r.id = ?",
          )
          .get(req.params.id);
        if (!restaurant)
          return res.status(404).json({ error: "Restaurant not found" });
        db.prepare(
          "UPDATE restaurants SET status = 'declined' WHERE id = ?",
        ).run(req.params.id);
        const { reason } = req.body;
        sendEmail(
          restaurant.email,
          "Update on your Reserva application",
          `<div style="font-family: sans-serif; max-width: 400px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #0070f3; text-align: center;">RESERVA</h2>
          <p>Hi ${restaurant.name},</p>
          <p>Unfortunately, your restaurant application for <b>${restaurant.name}</b> could not be approved at this time.</p>
          ${reason ? `<p><b>Reason:</b> ${reason}</p>` : ""}
        </div>`,
        ).catch(console.error);
        res.json({ success: true });
      },
    );

    app.post("/api/restaurants/:id/logo", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      const { logo_url } = req.body;
      try {
        if (req.user.role === "admin")
          db.prepare("UPDATE restaurants SET logo_url = ? WHERE id = ?").run(
            logo_url,
            req.params.id,
          );
        else
          db.prepare(
            "UPDATE restaurants SET logo_url = ? WHERE id = ? AND owner_id = ?",
          ).run(logo_url, req.params.id, req.user.id);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: "Failed to update logo" });
      }
    });

    app.post("/api/restaurants/:id/images", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      const { url } = req.body;
      try {
        const restaurant =
          req.user.role === "admin"
            ? db
                .prepare("SELECT id FROM restaurants WHERE id = ?")
                .get(req.params.id)
            : db
                .prepare(
                  "SELECT id FROM restaurants WHERE id = ? AND owner_id = ?",
                )
                .get(req.params.id, req.user.id);
        if (!restaurant)
          return res.status(403).json({ error: "Not authorized" });
        const imageCount: any = db
          .prepare(
            "SELECT COUNT(*) as count FROM restaurant_images WHERE restaurant_id = ?",
          )
          .get(req.params.id);
        db.prepare(
          "INSERT INTO restaurant_images (restaurant_id, url) VALUES (?, ?)",
        ).run(req.params.id, url);
        if (imageCount.count === 0)
          db.prepare(
            "UPDATE restaurants SET background_url = ? WHERE id = ?",
          ).run(url, req.params.id);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: "Failed to add image" });
      }
    });

    app.delete(
      "/api/restaurant-images/:imageId",
      authenticate,
      (req: any, res) => {
        if (req.user.role !== "owner" && req.user.role !== "admin")
          return res.status(403).json({ error: "Not authorized" });
        try {
          if (req.user.role === "admin")
            db.prepare("DELETE FROM restaurant_images WHERE id = ?").run(
              req.params.imageId,
            );
          else
            db.prepare(
              `DELETE FROM restaurant_images WHERE id = ? AND restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = ?)`,
            ).run(req.params.imageId, req.user.id);
          res.json({ success: true });
        } catch (err) {
          res.status(500).json({ error: "Failed to delete image" });
        }
      },
    );

    app.post(
      "/api/restaurants/:id/menu-images",
      authenticate,
      (req: any, res) => {
        if (req.user.role !== "owner" && req.user.role !== "admin")
          return res.status(403).json({ error: "Not authorized" });
        const { url } = req.body;
        try {
          const restaurant =
            req.user.role === "admin"
              ? db
                  .prepare("SELECT id FROM restaurants WHERE id = ?")
                  .get(req.params.id)
              : db
                  .prepare(
                    "SELECT id FROM restaurants WHERE id = ? AND owner_id = ?",
                  )
                  .get(req.params.id, req.user.id);
          if (!restaurant)
            return res.status(403).json({ error: "Not authorized" });
          db.prepare(
            "INSERT INTO restaurant_images (restaurant_id, url, image_type) VALUES (?, ?, 'menu')",
          ).run(req.params.id, url);
          res.json({ success: true });
        } catch (err) {
          res.status(500).json({ error: "Failed to add menu image" });
        }
      },
    );

    app.get("/api/restaurants/nearest", (req, res) => {
      const { lat, lng } = req.query;
      if (!lat || !lng)
        return res.status(400).json({ error: "lat/lng required" });
      const all = db
        .prepare(
          `
          SELECT r.*,
            (SELECT ri.url FROM restaurant_images ri
             WHERE ri.restaurant_id = r.id
               AND (ri.image_type = 'gallery' OR ri.image_type IS NULL)
             ORDER BY ri.id ASC
             LIMIT 1) as cover_image_url
          FROM restaurants r
          WHERE r.status = 'approved'
        `,
        )
        .all() as any[];
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const haversine = (
        lat1: number,
        lng1: number,
        lat2: number,
        lng2: number,
      ) => {
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };
      const nearby = all
        .map((r) => ({
          ...r,
          dist_km: haversine(Number(lat), Number(lng), r.lat, r.lng),
        }))
        .filter((r) => r.dist_km <= 1.5)
        .sort((a, b) => a.dist_km - b.dist_km);
      res.json(nearby);
    });

    app.get("/api/restaurants/:id", (req, res) => {
      const token = req.headers.authorization?.split(" ")[1];
      let userId = null;
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          userId = decoded.id;
        } catch (e) {}
      }
      const restaurant = db
        .prepare("SELECT * FROM restaurants WHERE id = ?")
        .get(req.params.id) as any;
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });
      const images = db
        .prepare(
          "SELECT id, url FROM restaurant_images WHERE restaurant_id = ? AND (image_type = 'gallery' OR image_type IS NULL)",
        )
        .all(req.params.id);
      const menuImages = db
        .prepare(
          "SELECT id, url FROM restaurant_images WHERE restaurant_id = ? AND image_type = 'menu'",
        )
        .all(req.params.id);
      const schedules = db
        .prepare("SELECT * FROM restaurant_schedules WHERE restaurant_id = ?")
        .all(req.params.id);
      const reviews = db
        .prepare(
          `SELECT r.*, u.name, u.surname, u.photo_url, (SELECT COUNT(*) FROM review_likes WHERE review_id = r.id AND user_id = ?) as is_liked FROM reviews r JOIN users u ON r.customer_id = u.id WHERE r.restaurant_id = ? ORDER BY r.created_at DESC`,
        )
        .all(userId, req.params.id);
      const result = {
        ...restaurant,
        latitude: restaurant.lat,
        longitude: restaurant.lng,
        experience_types: (() => {
          try {
            return JSON.parse(restaurant.experience_types || "[]");
          } catch {
            return [];
          }
        })(),
        amenities: (() => {
          try {
            return JSON.parse(restaurant.amenities || "[]");
          } catch {
            return [];
          }
        })(),
        moods: (() => {
          try {
            return JSON.parse(restaurant.moods || "[]");
          } catch {
            return [];
          }
        })(),
        images,
        menuImages,
        reviews,
        schedules,
      };
      res.json(result);
    });

    app.get("/api/owner/restaurant/settings", authenticate, (req: any, res) => {
      if (req.user.role !== "owner")
        return res.status(403).json({ error: "Not authorized" });
      const restaurant = db
        .prepare("SELECT * FROM restaurants WHERE owner_id = ?")
        .get(req.user.id);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });
      const schedule = db
        .prepare("SELECT * FROM restaurant_schedules WHERE restaurant_id = ?")
        .all(restaurant.id);
      res.json({ settings: restaurant, schedule });
    });

    app.patch("/api/restaurants/:id", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });

      const restaurant: any = db
        .prepare("SELECT * FROM restaurants WHERE id = ?")
        .get(req.params.id);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });
      if (req.user.role !== "admin" && restaurant.owner_id !== req.user.id)
        return res.status(403).json({ error: "Not authorized" });

      const {
        phone_number,
        secondary_phone,
        location,
        latitude,
        longitude,
        experience_types,
        amenities,
        moods,
      } = req.body;

      try {
        db.prepare(
          `UPDATE restaurants SET
            phone_number = COALESCE(?, phone_number),
            secondary_phone = ?,
            location = COALESCE(?, location),
            lat = COALESCE(?, lat),
            lng = COALESCE(?, lng),
            experience_types = COALESCE(?, experience_types),
            amenities = COALESCE(?, amenities),
            moods = COALESCE(?, moods)
          WHERE id = ?`,
        ).run(
          phone_number ?? null,
          secondary_phone ?? null,
          location ?? null,
          latitude ?? null,
          longitude ?? null,
          experience_types ? JSON.stringify(experience_types) : null,
          amenities ? JSON.stringify(amenities) : null,
          moods ? JSON.stringify(moods) : null,
          req.params.id,
        );
        res.json({ success: true });
      } catch (err) {
        console.error("[Reserva] Restaurant PATCH error:", err);
        res.status(500).json({ error: "Failed to update restaurant" });
      }
    });

    app.patch(
      "/api/owner/restaurant/settings",
      authenticate,
      (req: any, res) => {
        if (req.user.role !== "owner")
          return res.status(403).json({ error: "Not authorized" });
        const {
          name,
          description,
          phone_number,
          secondary_phone,
          location,
          lat,
          lng,
          max_reservation_duration,
          advance_booking_days,
          min_booking_notice_hours,
          allow_combining_tables,
          allow_upsizing_tables,
          notify_new_reservation,
          notify_cancellations,
          notify_waitlist,
          deposit_amount,
          cancellation_policy_hours,
          min_price,
          max_price,
          experience_types,
          amenities,
          moods,
          duration_mode,
        } = req.body;
        try {
          db.prepare(
            `UPDATE restaurants SET
        name = ?,
        description = ?,
        phone_number = ?,
        secondary_phone = ?,
        location = COALESCE(?, location),
        lat = COALESCE(?, lat),
        lng = COALESCE(?, lng),
        max_reservation_duration = ?,
        advance_booking_days = ?,
        min_booking_notice_hours = ?,
        allow_combining_tables = ?,
        allow_upsizing_tables = ?,
        notify_new_reservation = ?,
        notify_cancellations = ?,
        notify_waitlist = ?,
        deposit_amount = ?,
        cancellation_policy_hours = ?,
        min_price = ?,
        max_price = ?,
        experience_types = COALESCE(?, experience_types),
        amenities = COALESCE(?, amenities),
        moods = COALESCE(?, moods),
        duration_mode = COALESCE(?, duration_mode)
      WHERE owner_id = ?`,
          ).run(
            name,
            description,
            phone_number,
            secondary_phone || null,
            location || null,
            lat ?? null,
            lng ?? null,
            max_reservation_duration,
            advance_booking_days,
            min_booking_notice_hours,
            allow_combining_tables ? 1 : 0,
            allow_upsizing_tables ? 1 : 0,
            notify_new_reservation ? 1 : 0,
            notify_cancellations ? 1 : 0,
            notify_waitlist ? 1 : 0,
            deposit_amount,
            cancellation_policy_hours,
            min_price || 0,
            max_price || 0,
            experience_types ? JSON.stringify(experience_types) : null,
            amenities ? JSON.stringify(amenities) : null,
            moods ? JSON.stringify(moods) : null,
            duration_mode === "auto" || duration_mode === "manual"
              ? duration_mode
              : null,
            req.user.id,
          );
          res.json({ success: true });
        } catch (err) {
          console.error(err);
          res.status(500).json({ error: "Failed to update settings" });
        }
      },
    );

    app.post(
      "/api/owner/restaurant/schedule",
      authenticate,
      (req: any, res) => {
        if (req.user.role !== "owner")
          return res.status(403).json({ error: "Not authorized" });
        const { schedule } = req.body;
        const restaurant = db
          .prepare("SELECT id FROM restaurants WHERE owner_id = ?")
          .get(req.user.id);
        if (!restaurant)
          return res.status(404).json({ error: "Restaurant not found" });
        try {
          const deleteStmt = db.prepare(
            "DELETE FROM restaurant_schedules WHERE restaurant_id = ?",
          );
          const insertStmt = db.prepare(
            "INSERT INTO restaurant_schedules (restaurant_id, day_of_week, open_time, close_time, is_closed) VALUES (?, ?, ?, ?, ?)",
          );
          const transaction = db.transaction((data: any[]) => {
            deleteStmt.run(restaurant.id);
            for (const item of data)
              insertStmt.run(
                restaurant.id,
                item.day_of_week,
                item.open_time,
                item.close_time,
                item.is_closed ? 1 : 0,
              );
          });
          transaction(schedule);
          res.json({ success: true });
        } catch (err) {
          console.error(err);
          res.status(500).json({ error: "Failed to update schedule" });
        }
      },
    );

    app.post("/api/reviews/:reviewId/like", authenticate, (req: any, res) => {
      const { reviewId } = req.params;
      const userId = req.user.id;
      try {
        const existing = db
          .prepare(
            "SELECT * FROM review_likes WHERE user_id = ? AND review_id = ?",
          )
          .get(userId, reviewId);
        if (existing) {
          db.prepare(
            "DELETE FROM review_likes WHERE user_id = ? AND review_id = ?",
          ).run(userId, reviewId);
          db.prepare("UPDATE reviews SET likes = likes - 1 WHERE id = ?").run(
            reviewId,
          );
          res.json({ liked: false });
        } else {
          db.prepare(
            "INSERT INTO review_likes (user_id, review_id) VALUES (?, ?)",
          ).run(userId, reviewId);
          db.prepare("UPDATE reviews SET likes = likes + 1 WHERE id = ?").run(
            reviewId,
          );
          res.json({ liked: true });
        }
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to toggle like" });
      }
    });

    app.post("/api/reviews", authenticate, (req: any, res) => {
      const {
        restaurant_id,
        rating,
        comment,
        sentiment,
        categories,
        user_confirmed,
      } = req.body;
      if (!restaurant_id || !rating)
        return res
          .status(400)
          .json({ error: "Restaurant ID and rating are required" });
      const categoriesStr = categories ? JSON.stringify(categories) : null;
      try {
        db.prepare(
          "INSERT INTO reviews (restaurant_id, customer_id, rating, comment, sentiment, categories, user_confirmed) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run(
          restaurant_id,
          req.user.id,
          rating,
          comment || "",
          sentiment,
          categoriesStr,
          user_confirmed ? 1 : 0,
        );
        const stats: any = db
          .prepare(
            "SELECT AVG(rating) as avgRating FROM reviews WHERE restaurant_id = ?",
          )
          .get(restaurant_id);
        if (stats?.avgRating)
          db.prepare("UPDATE restaurants SET rating = ? WHERE id = ?").run(
            parseFloat(stats.avgRating.toFixed(1)),
            restaurant_id,
          );
        res.json({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to submit review" });
      }
    });

    app.get("/api/restaurants/:id/tables", authenticate, (req: any, res) => {
      const tables = db
        .prepare(
          "SELECT * FROM tables WHERE restaurant_id = ? AND is_active = 1",
        )
        .all(req.params.id);
      res.json(tables);
    });

    app.get(
      "/api/restaurants/:id/table-types",
      authenticate,
      (req: any, res) => {
        const types = db
          .prepare(
            `SELECT DISTINCT capacity, location, shape FROM tables WHERE restaurant_id = ? AND is_active = 1 ORDER BY capacity ASC, location ASC, shape ASC`,
          )
          .all(req.params.id);
        res.json(types);
      },
    );

    app.post("/api/restaurants/:id/tables", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      const { capacity, location, quantity, shape } = req.body;
      const count = quantity || 1;
      for (let i = 0; i < count; i++)
        db.prepare(
          "INSERT INTO tables (restaurant_id, capacity, location, shape) VALUES (?, ?, ?, ?)",
        ).run(req.params.id, capacity, location || "indoor", shape || "square");
      res.json({ success: true, added: count });
    });

    app.delete("/api/tables/:id", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      db.prepare("UPDATE tables SET is_active = 0 WHERE id = ?").run(
        req.params.id,
      );
      res.json({ success: true });
    });

    app.get("/api/restaurants/:id/resources", authenticate, (req: any, res) => {
      const resources = db
        .prepare(
          "SELECT * FROM resources WHERE restaurant_id = ? AND is_active = 1 ORDER BY resource_type, capacity",
        )
        .all(req.params.id);
      res.json(
        resources.map((r: any) => ({
          ...r,
          features: (() => {
            try {
              return JSON.parse(r.features || "[]");
            } catch {
              return [];
            }
          })(),
        })),
      );
    });

    app.get(
      "/api/restaurants/:id/resource-types",
      authenticate,
      (req: any, res) => {
        const types = db
          .prepare(
            `
        SELECT DISTINCT resource_type, location, capacity, shape, features, price_per_hour,
          MIN(id) as id
        FROM resources
        WHERE restaurant_id = ? AND is_active = 1
        ORDER BY resource_type, capacity
      `,
          )
          .all(req.params.id);
        res.json(
          types.map((t: any) => ({
            ...t,
            features: (() => {
              try {
                return JSON.parse(t.features || "[]");
              } catch {
                return [];
              }
            })(),
          })),
        );
      },
    );

    app.post(
      "/api/restaurants/:id/resources",
      authenticate,
      (req: any, res) => {
        if (req.user.role !== "owner" && req.user.role !== "admin")
          return res.status(403).json({ error: "Not authorized" });
        const {
          name,
          resource_type,
          capacity,
          location,
          shape,
          features,
          min_booking_minutes,
          max_booking_minutes,
          price_per_hour,
          quantity,
        } = req.body;
        const count = quantity || 1;
        try {
          const insertStmt = db.prepare(`
          INSERT INTO resources
            (restaurant_id, name, resource_type, capacity, location, shape, features, min_booking_minutes, max_booking_minutes, price_per_hour)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
          for (let i = 0; i < count; i++) {
            const resourceName =
              count > 1
                ? `${name || resource_type} #${i + 1}`
                : name || `${resource_type} ${Date.now()}`;
            insertStmt.run(
              req.params.id,
              resourceName,
              resource_type || "table",
              capacity,
              location || "indoor",
              shape || "square",
              JSON.stringify(features || []),
              min_booking_minutes || 30,
              max_booking_minutes || null,
              price_per_hour || 0,
            );
          }
          res.json({ success: true, added: count });
        } catch (err) {
          console.error(err);
          res.status(500).json({ error: "Failed to create resource" });
        }
      },
    );

    app.delete("/api/resources/:id", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      db.prepare("UPDATE resources SET is_active = 0 WHERE id = ?").run(
        req.params.id,
      );
      res.json({ success: true });
    });

    app.get("/api/resources/:id/availability", (req, res) => {
      const { date } = req.query;
      if (!date)
        return res.status(400).json({ error: "date query param required" });
      const blocked = db
        .prepare(
          `
        SELECT start_time, end_time FROM reservations
        WHERE resource_id = ?
          AND date = ?
          AND status IN ('pending', 'confirmed')
          AND start_time IS NOT NULL
          AND end_time IS NOT NULL
        ORDER BY start_time ASC
      `,
        )
        .all(req.params.id, date);
      res.json({ blocked });
    });

    app.post("/api/reservations", authenticate, (req: any, res) => {
      const {
        restaurant_id,
        resource_id,
        people_count,
        date,
        time,
        start_time,
        end_time,
        seating_preference,
        table_capacity,
        table_shape,
        addon_ids,
      } = req.body;

      const resolvedStart: string = start_time || time;

      const user: any = db
        .prepare("SELECT reliability_score FROM users WHERE id = ?")
        .get(req.user.id);
      if (user && user.reliability_score < 30) {
        return res.status(403).json({
          error:
            "Your reliability score is too low to make new reservations. Please contact support.",
        });
      }

      const restaurant: any = db
        .prepare("SELECT * FROM restaurants WHERE id = ?")
        .get(restaurant_id);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const durationMode =
        restaurant.duration_mode === "auto" ? "auto" : "manual";

      // In manual mode the customer must supply an end time. In auto mode we
      // ignore whatever the client sends and compute it ourselves below.
      if (durationMode === "manual" && !end_time) {
        return res.status(400).json({
          error: "Please select an end time for this reservation.",
        });
      }

      const bookingDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maxDate = new Date();
      maxDate.setDate(
        today.getDate() + (restaurant.advance_booking_days || 30),
      );
      if (bookingDate > maxDate)
        return res.status(400).json({
          error: `Bookings are only allowed up to ${restaurant.advance_booking_days} days in advance.`,
        });

      const reservationDateTime = new Date(`${date}T${resolvedStart}`);
      const now = new Date();
      const noticeMs =
        (restaurant.min_booking_notice_hours || 0) * 60 * 60 * 1000;
      if (reservationDateTime.getTime() - now.getTime() < noticeMs) {
        return res.status(400).json({
          error: `Bookings must be made at least ${restaurant.min_booking_notice_hours} hours in advance.`,
        });
      }

      const dayOfWeek = bookingDate.getDay();
      const schedule: any = db
        .prepare(
          "SELECT * FROM restaurant_schedules WHERE restaurant_id = ? AND day_of_week = ?",
        )
        .get(restaurant_id, dayOfWeek);
      const checkTimeInRange = (target: string, start: string, end: string) =>
        target >= start && target <= end;
      if (schedule) {
        if (schedule.is_closed)
          return res
            .status(400)
            .json({ error: "Restaurant is closed on this day." });
        if (
          !checkTimeInRange(
            resolvedStart,
            schedule.open_time,
            schedule.close_time,
          )
        ) {
          return res.status(400).json({
            error: `Opening hours are ${schedule.open_time} - ${schedule.close_time}`,
          });
        }
      } else {
        if (
          !checkTimeInRange(
            resolvedStart,
            restaurant.open_time,
            restaurant.close_time,
          )
        ) {
          return res.status(400).json({
            error: `Opening hours are ${restaurant.open_time} - ${restaurant.close_time}`,
          });
        }
      }

      // ── Resource-based booking ──────────────────────────────────────────────
      if (resource_id) {
        const resource: any = db
          .prepare("SELECT * FROM resources WHERE id = ? AND is_active = 1")
          .get(resource_id);
        if (!resource)
          return res.status(404).json({ error: "Resource not found." });

        let resolvedEnd: string;

        if (durationMode === "auto") {
          resolvedEnd = calculateEndTime(
            resolvedStart,
            people_count,
            restaurant.max_reservation_duration,
          );
          // keep the auto-computed duration inside whatever bounds the resource defines
          const [sh, sm] = resolvedStart.split(":").map(Number);
          let [eh, em] = resolvedEnd.split(":").map(Number);
          let durationMins = eh * 60 + em - (sh * 60 + sm);
          if (
            resource.min_booking_minutes &&
            durationMins < resource.min_booking_minutes
          )
            durationMins = resource.min_booking_minutes;
          if (
            resource.max_booking_minutes &&
            durationMins > resource.max_booking_minutes
          )
            durationMins = resource.max_booking_minutes;
          const totalMins = sh * 60 + sm + durationMins;
          eh = Math.floor(totalMins / 60) % 24;
          em = totalMins % 60;
          resolvedEnd = `${eh.toString().padStart(2, "0")}:${em.toString().padStart(2, "0")}`;
        } else {
          resolvedEnd = end_time;
          const [sh, sm] = resolvedStart.split(":").map(Number);
          const [eh, em] = resolvedEnd.split(":").map(Number);
          const startMins = sh * 60 + sm;
          const endMins = eh * 60 + em;

          if (endMins <= startMins)
            return res
              .status(400)
              .json({ error: "End time must be after start time." });

          const durationMins = endMins - startMins;
          if (
            resource.min_booking_minutes &&
            durationMins < resource.min_booking_minutes
          ) {
            return res.status(400).json({
              error: `Minimum booking duration is ${resource.min_booking_minutes} minutes.`,
            });
          }
          if (
            resource.max_booking_minutes &&
            durationMins > resource.max_booking_minutes
          ) {
            return res.status(400).json({
              error: `Maximum booking duration is ${resource.max_booking_minutes} minutes.`,
            });
          }
        }

        const conflict: any = db
          .prepare(
            `SELECT COUNT(*) as count FROM reservations
         WHERE resource_id = ? AND date = ? AND status IN ('pending', 'confirmed')
           AND start_time < ? AND end_time > ?`,
          )
          .get(resource_id, date, resolvedEnd, resolvedStart);

        if (conflict.count > 0) {
          return res.status(409).json({
            error: "This resource is already booked for that time range.",
            allowWaitlist: true,
          });
        }

        const result = db
          .prepare(
            `INSERT INTO reservations
          (restaurant_id, resource_id, customer_id, people_count,
           date, time, start_time, end_time, seating_preference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            restaurant_id,
            resource_id,
            req.user.id,
            people_count,
            date,
            resolvedStart,
            resolvedStart,
            resolvedEnd,
            seating_preference,
          );

        if (addon_ids?.length) {
          const insertAddon = db.prepare(
            "INSERT INTO reservation_addons (reservation_id, addon_id) VALUES (?, ?)",
          );
          for (const addonId of addon_ids)
            insertAddon.run(result.lastInsertRowid, addonId);
        }

        const restaurantInfo = db
          .prepare(
            `SELECT res.name, u.email FROM restaurants res JOIN users u ON res.owner_id = u.id WHERE res.id = ?`,
          )
          .get(restaurant_id) as any;
        if (restaurantInfo)
          sendEmail(
            restaurantInfo.email,
            "New Reservation Request!",
            `<h1>New Reservation</h1><p>You have a new request for ${restaurantInfo.name} on ${date} at ${resolvedStart}–${resolvedEnd} for ${people_count} people.</p>`,
          ).catch(console.error);

        scheduleNotifications(
          req.user.id,
          Number(result.lastInsertRowid),
          restaurantInfo?.name || "the restaurant",
          date,
          resolvedStart,
        );

        return res.json({
          id: result.lastInsertRowid,
          status: "pending",
          start_time: resolvedStart,
          end_time: resolvedEnd,
        });
      }

      // ── Legacy table-based booking ──────────────────────────────────────────
      const resolvedEnd: string =
        durationMode === "auto" || !end_time
          ? calculateEndTime(
              resolvedStart,
              people_count,
              restaurant.max_reservation_duration,
            )
          : end_time;

      const restaurantTables = db
        .prepare(
          "SELECT * FROM tables WHERE restaurant_id = ? AND is_active = 1",
        )
        .all(restaurant_id) as any[];
      let tableId: number | null = null;

      if (restaurantTables.length > 0) {
        const occupiedTableIds = db
          .prepare(
            `SELECT table_id FROM reservations WHERE restaurant_id = ? AND date = ? AND status IN ('pending', 'confirmed') AND table_id IS NOT NULL AND time < ? AND end_time > ?`,
          )
          .all(restaurant_id, date, resolvedEnd, resolvedStart)
          .map((r: any) => r.table_id);
        const availableTables = restaurantTables.filter(
          (t) => !occupiedTableIds.includes(t.id) && t.capacity >= people_count,
        );

        if (availableTables.length === 0)
          return res.status(409).json({
            error: "No tables available for this time slot.",
            allowWaitlist: true,
          });

        if (table_capacity || seating_preference || table_shape) {
          const specificMatch = availableTables.filter(
            (t) =>
              (!table_capacity || t.capacity === table_capacity) &&
              (!seating_preference || t.location === seating_preference) &&
              (!table_shape || t.shape === table_shape),
          );
          if (specificMatch.length > 0) {
            tableId = specificMatch[0].id;
          } else {
            const capacityMatch = availableTables.filter(
              (t) =>
                (!table_capacity || t.capacity === table_capacity) &&
                (!table_shape || t.shape === table_shape),
            );
            if (capacityMatch.length > 0 && seating_preference) {
              return res.status(409).json({
                error: `Selected table type is fully booked. Alternatives available in other areas.`,
                alternativeLocation:
                  seating_preference === "indoor" ? "outdoor" : "indoor",
                allowWaitlist: true,
              });
            }
            return res.status(409).json({
              error: "Selected table type is fully booked.",
              allowWaitlist: true,
            });
          }
        } else {
          availableTables.sort((a, b) => a.capacity - b.capacity);
          tableId = availableTables[0].id;
        }
      } else {
        const overlapping = db
          .prepare(
            `SELECT COUNT(*) as count FROM reservations WHERE restaurant_id = ? AND date = ? AND status IN ('pending', 'confirmed') AND time < ? AND end_time > ?`,
          )
          .get(restaurant_id, date, resolvedEnd, resolvedStart) as any;
        if (overlapping.count >= 10)
          return res.status(409).json({
            error: "No tables available for this time slot.",
            allowWaitlist: true,
          });
      }

      const result = db
        .prepare(
          "INSERT INTO reservations (restaurant_id, customer_id, people_count, date, time, start_time, end_time, table_id, seating_preference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          restaurant_id,
          req.user.id,
          people_count,
          date,
          resolvedStart,
          resolvedStart,
          resolvedEnd,
          tableId,
          seating_preference,
        );

      const restaurantInfo = db
        .prepare(
          `SELECT res.name, u.email FROM restaurants res JOIN users u ON res.owner_id = u.id WHERE res.id = ?`,
        )
        .get(restaurant_id) as any;
      if (restaurantInfo)
        sendEmail(
          restaurantInfo.email,
          "New Reservation Request!",
          `<h1>New Reservation</h1><p>You have a new request for ${restaurantInfo.name} on ${date} at ${resolvedStart} for ${people_count} people.</p>`,
        ).catch(console.error);

      scheduleNotifications(
        req.user.id,
        Number(result.lastInsertRowid),
        restaurantInfo?.name || "the restaurant",
        date,
        resolvedStart,
      );

      return res.json({
        id: result.lastInsertRowid,
        status: "pending",
        end_time: resolvedEnd,
      });
    });

    app.post(
      "/api/reservations/:id/cancel",
      authenticate,
      async (req: any, res) => {
        const reservation: any = db
          .prepare(
            "SELECT * FROM reservations WHERE id = ? AND customer_id = ?",
          )
          .get(req.params.id, req.user.id);
        if (!reservation)
          return res.status(404).json({ error: "Reservation not found" });
        if (reservation.status === "cancelled")
          return res.status(400).json({ error: "Already cancelled" });
        const visitTime = reservation.start_time || reservation.time;
        const visitDateTime = new Date(`${reservation.date}T${visitTime}`);
        const now = new Date();
        const hoursUntilVisit =
          (visitDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        let reliabilityPenalty = 0;
        if (reservation.status === "confirmed") {
          if (hoursUntilVisit < 2) reliabilityPenalty = 25;
          else if (hoursUntilVisit < 24) reliabilityPenalty = 15;
          else reliabilityPenalty = 5;
        }
        const info = db
          .prepare(
            `SELECT res.name as restaurant_name, u.email FROM reservations r JOIN restaurants res ON r.restaurant_id = res.id JOIN users u ON res.owner_id = u.id WHERE r.id = ?`,
          )
          .get(req.params.id) as any;
        db.prepare(
          "UPDATE reservations SET status = 'cancelled' WHERE id = ?",
        ).run(req.params.id);
        if (reliabilityPenalty > 0)
          db.prepare(
            "UPDATE users SET reliability_score = MAX(0, reliability_score - ?) WHERE id = ?",
          ).run(reliabilityPenalty, req.user.id);
        if (info)
          sendEmail(
            info.email,
            "Reservation Cancelled",
            `<h1>Reservation Cancelled</h1><p>A reservation at <b>${info.restaurant_name}</b> for ${reservation.date} at ${visitTime} has been cancelled.</p>`,
          ).catch(console.error);
        db.prepare(
          "UPDATE notifications SET cancelled = 1 WHERE reservation_id = ? AND sent = 0",
        ).run(req.params.id);
        db.prepare(
          "INSERT INTO notifications (user_id, reservation_id, message, send_at, sent) VALUES (?, ?, ?, datetime('now'), 1)",
        ).run(
          req.user.id,
          req.params.id,
          `❌ Your reservation at ${info?.restaurant_name || "the restaurant"} for ${reservation.date} at ${visitTime} has been cancelled.`,
        );
        res.json({ success: true, reliabilityPenalty });
      },
    );

    app.post("/api/reservations/:id/confirm", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      db.prepare(
        "UPDATE reservations SET status = 'confirmed' WHERE id = ?",
      ).run(req.params.id);
      const info = db
        .prepare(
          `SELECT r.*, u.email, res.name as restaurant_name FROM reservations r JOIN users u ON r.customer_id = u.id JOIN restaurants res ON r.restaurant_id = res.id WHERE r.id = ?`,
        )
        .get(req.params.id) as any;
      if (info)
        sendEmail(
          info.email,
          "Reservation Confirmed! ✅",
          `<h1>Great news!</h1><p>Your reservation at <b>${info.restaurant_name}</b> for ${info.date} at ${info.start_time || info.time} has been confirmed.</p>`,
        ).catch(console.error);
      res.json({ status: "confirmed" });
    });

    app.post("/api/reservations/:id/reject", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      db.prepare(
        "UPDATE reservations SET status = 'rejected' WHERE id = ?",
      ).run(req.params.id);
      const info = db
        .prepare(
          `SELECT r.*, u.email, res.name as restaurant_name FROM reservations r JOIN users u ON r.customer_id = u.id JOIN restaurants res ON r.restaurant_id = res.id WHERE r.id = ?`,
        )
        .get(req.params.id) as any;
      if (info)
        sendEmail(
          info.email,
          "Reservation Update",
          `<h1>Update on your reservation</h1><p>Unfortunately, your reservation at <b>${info.restaurant_name}</b> for ${info.date} at ${info.start_time || info.time} could not be accepted at this time.</p>`,
        ).catch(console.error);
      res.json({ status: "rejected" });
    });

    app.post(
      "/api/reservations/:id/complete",
      authenticate,
      (req: any, res) => {
        if (req.user.role !== "owner" && req.user.role !== "admin")
          return res.status(403).json({ error: "Not authorized" });
        const reservation: any = db
          .prepare(
            "SELECT customer_id, restaurant_id FROM reservations WHERE id = ?",
          )
          .get(req.params.id);
        if (!reservation)
          return res.status(404).json({ error: "Reservation not found" });
        db.prepare(
          "UPDATE reservations SET status = 'completed' WHERE id = ?",
        ).run(req.params.id);
        db.prepare(
          "UPDATE users SET reliability_score = MIN(100, reliability_score + 2) WHERE id = ?",
        ).run(reservation.customer_id);
        db.prepare(
          `UPDATE waitlist SET status = 'expired' WHERE restaurant_id = ? AND status = 'offered' AND expires_at < datetime('now')`,
        ).run(reservation.restaurant_id);
        const nextInLine: any = db
          .prepare(
            "SELECT * FROM waitlist WHERE restaurant_id = ? AND status = 'waiting' ORDER BY joined_at ASC LIMIT 1",
          )
          .get(reservation.restaurant_id);
        if (nextInLine) {
          const offeredAt = new Date().toISOString();
          const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
          db.prepare(
            "UPDATE waitlist SET status = 'offered', offered_at = ?, expires_at = ? WHERE id = ?",
          ).run(offeredAt, expiresAt, nextInLine.id);
        }
        res.json({ status: "completed" });
      },
    );

    app.post("/api/reservations/:id/no-show", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      const reservation: any = db
        .prepare("SELECT customer_id FROM reservations WHERE id = ?")
        .get(req.params.id);
      if (!reservation)
        return res.status(404).json({ error: "Reservation not found" });
      db.prepare("UPDATE reservations SET status = 'no-show' WHERE id = ?").run(
        req.params.id,
      );
      db.prepare(
        "UPDATE users SET reliability_score = MAX(0, reliability_score - 15) WHERE id = ?",
      ).run(reservation.customer_id);
      res.json({ status: "no-show" });
    });

    app.get("/api/my-reservations", authenticate, (req: any, res) => {
      const reservations = db
        .prepare(
          `SELECT r.*, res.name as restaurant_name, res.logo_url, res.rating, res.dist_km, res.location,
            (SELECT ri.url FROM restaurant_images ri
             WHERE ri.restaurant_id = res.id
               AND (ri.image_type = 'gallery' OR ri.image_type IS NULL)
             ORDER BY ri.id ASC
             LIMIT 1) as cover_image_url
          FROM reservations r JOIN restaurants res ON r.restaurant_id = res.id WHERE r.customer_id = ? ORDER BY r.created_at DESC`,
        )
        .all(req.user.id);
      res.json(reservations);
    });

    app.get("/api/owner/reservations", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      const reservations =
        req.user.role === "admin"
          ? db
              .prepare(
                `SELECT r.*, u.name as customer_name, u.surname as customer_surname, u.phone as customer_phone FROM reservations r JOIN users u ON r.customer_id = u.id JOIN restaurants res ON r.restaurant_id = res.id ORDER BY r.created_at DESC`,
              )
              .all()
          : db
              .prepare(
                `SELECT r.*, u.name as customer_name, u.surname as customer_surname, u.phone as customer_phone, u.reliability_score FROM reservations r JOIN users u ON r.customer_id = u.id JOIN restaurants res ON r.restaurant_id = res.id WHERE res.owner_id = ? ORDER BY r.created_at DESC`,
              )
              .all(req.user.id);
      res.json(reservations);
    });

    app.post("/api/waitlist", authenticate, (req: any, res) => {
      const { restaurant_id, people_count } = req.body;
      const result = db
        .prepare(
          "INSERT INTO waitlist (restaurant_id, customer_id, people_count) VALUES (?, ?, ?)",
        )
        .run(restaurant_id, req.user.id, people_count);
      const ahead = db
        .prepare(
          "SELECT COUNT(*) as count FROM waitlist WHERE restaurant_id = ? AND status = 'waiting' AND id < ?",
        )
        .get(restaurant_id, result.lastInsertRowid) as any;
      res.json({
        id: result.lastInsertRowid,
        status: "waiting",
        estimatedWait: (ahead.count + 1) * 15,
      });
    });

    app.get(
      "/api/waitlist/status/:restaurantId",
      authenticate,
      (req: any, res) => {
        db.prepare(
          `UPDATE waitlist SET status = 'expired' WHERE restaurant_id = ? AND status = 'offered' AND expires_at < datetime('now')`,
        ).run(req.params.restaurantId);
        const entry: any = db
          .prepare(
            "SELECT * FROM waitlist WHERE restaurant_id = ? AND customer_id = ? AND status IN ('waiting', 'offered') ORDER BY joined_at DESC LIMIT 1",
          )
          .get(req.params.restaurantId, req.user.id);
        if (!entry) return res.json({ inWaitlist: false });
        let estimatedWait = 0;
        if (entry.status === "waiting") {
          const ahead = db
            .prepare(
              "SELECT COUNT(*) as count FROM waitlist WHERE restaurant_id = ? AND status = 'waiting' AND id < ?",
            )
            .get(req.params.restaurantId, entry.id) as any;
          estimatedWait = (ahead.count + 1) * 15;
        }
        res.json({
          inWaitlist: true,
          status: entry.status,
          estimatedWait,
          offered_at: entry.offered_at,
          expires_at: entry.expires_at,
        });
      },
    );

    app.get("/api/my-waitlists", authenticate, (req: any, res) => {
      db.prepare(
        `UPDATE waitlist SET status = 'expired' WHERE customer_id = ? AND status = 'offered' AND expires_at < datetime('now')`,
      ).run(req.user.id);
      const list = db
        .prepare(
          `SELECT w.*, r.name as restaurant_name FROM waitlist w JOIN restaurants r ON w.restaurant_id = r.id WHERE w.customer_id = ? AND w.status IN ('waiting', 'offered') ORDER BY w.joined_at DESC`,
        )
        .all(req.user.id) as any[];
      const processed = list.map((entry) => {
        let estimated_wait = 0;
        if (entry.status === "waiting") {
          const ahead = db
            .prepare(
              "SELECT COUNT(*) as count FROM waitlist WHERE restaurant_id = ? AND status = 'waiting' AND id < ?",
            )
            .get(entry.restaurant_id, entry.id) as any;
          estimated_wait = (ahead.count + 1) * 15;
        }
        return { ...entry, estimated_wait };
      });
      res.json(processed);
    });

    app.get("/api/owner/analytics", authenticate, (req: any, res) => {
      if (req.user.role !== "owner" && req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      const reviews =
        req.user.role === "admin"
          ? db
              .prepare(
                `SELECT r.* FROM reviews r JOIN restaurants res ON r.restaurant_id = res.id`,
              )
              .all()
          : db
              .prepare(
                `SELECT r.* FROM reviews r JOIN restaurants res ON r.restaurant_id = res.id WHERE res.owner_id = ?`,
              )
              .all(req.user.id);
      res.json({ reviews });
    });

    app.post("/api/collections", authenticate, (req: any, res) => {
      const { restaurant_id } = req.body;
      try {
        db.prepare(
          "INSERT INTO collections (user_id, restaurant_id) VALUES (?, ?)",
        ).run(req.user.id, restaurant_id);
        res.json({ success: true });
      } catch (e) {
        res.status(400).json({ error: "Already saved" });
      }
    });

    app.get("/api/collections", authenticate, (req: any, res) => {
      const restaurants = db
        .prepare(
          `SELECT res.* FROM collections c JOIN restaurants res ON c.restaurant_id = res.id WHERE c.user_id = ?`,
        )
        .all(req.user.id);
      res.json(restaurants);
    });

    app.delete(
      "/api/collections/:restaurantId",
      authenticate,
      (req: any, res) => {
        try {
          db.prepare(
            "DELETE FROM collections WHERE user_id = ? AND restaurant_id = ?",
          ).run(req.user.id, req.params.restaurantId);
          res.json({ success: true });
        } catch (err) {
          res.status(500).json({ error: "Failed to remove from collection" });
        }
      },
    );

    app.get("/api/admin/users", authenticate, (req: any, res) => {
      if (req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      const users = db
        .prepare("SELECT id, email, name, surname, role FROM users")
        .all();
      res.json(users);
    });

    // ── Bug Reports ───────────────────────────────────────────────────────────
    app.post("/api/admin/bug-reports", authenticate, (req: any, res) => {
      const { category, details, restaurant_id } = req.body;
      if (!category)
        return res.status(400).json({ error: "Category is required" });
      try {
        db.prepare(
          "INSERT INTO bug_reports (user_id, category, details, restaurant_id) VALUES (?, ?, ?, ?)",
        ).run(req.user.id, category, details || null, restaurant_id || null);

        const admin: any = db
          .prepare("SELECT email FROM users WHERE role = 'admin' LIMIT 1")
          .get();
        const reporter: any = db
          .prepare("SELECT name, surname, email, phone FROM users WHERE id = ?")
          .get(req.user.id);
        const restaurant: any = restaurant_id
          ? db
              .prepare("SELECT name FROM restaurants WHERE id = ?")
              .get(restaurant_id)
          : null;

        if (admin) {
          sendEmail(
            admin.email,
            `🐛 New bug report: ${category}`,
            `<div style="font-family: sans-serif;">
          <h2>${category}</h2>
          <p><b>From:</b> ${reporter?.name || ""} ${reporter?.surname || ""} — ${reporter?.email || "unknown"}${reporter?.phone ? ` — ${reporter.phone}` : ""}</p>
          ${restaurant ? `<p><b>Restaurant:</b> ${restaurant.name}</p>` : ""}
          ${details ? `<p><b>Details:</b><br>${details}</p>` : ""}
        </div>`,
          ).catch(console.error);
        }

        res.json({ success: true });
      } catch (err) {
        console.error("[Reserva] Bug report error:", err);
        res.status(500).json({ error: "Failed to save bug report" });
      }
    });

    app.get("/api/admin/bug-reports", authenticate, (req: any, res) => {
      if (req.user.role !== "admin")
        return res.status(403).json({ error: "Not authorized" });
      try {
        const reports = db
          .prepare(
            `SELECT br.*, u.name, u.surname, u.email, u.phone, r.name as restaurant_name
         FROM bug_reports br
         LEFT JOIN users u ON br.user_id = u.id
         LEFT JOIN restaurants r ON br.restaurant_id = r.id
         ORDER BY br.created_at DESC
         LIMIT 100`,
          )
          .all();
        res.json(reports);
      } catch (err) {
        console.error("[Reserva] Fetch bug reports error:", err);
        res.status(500).json({ error: "Failed to fetch bug reports" });
      }
    });
  } catch (err) {
    console.error("[Reserva] FAILED TO INITIALIZE DATABASE:", err);
    db = null;
  }

  app.use("/api/*", (req: any, res: any) => {
    res.status(404).json({ error: "API route not found" });
  });

  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    console.log(`[Reserva] Serving static files from: ${finalDistPath}`);
    if (!fs.existsSync(finalDistPath))
      console.warn(
        `[Reserva] WARNING: Static dist path not found at ${finalDistPath}`,
      );
    app.use(express.static(finalDistPath, { maxAge: "1d", index: false }));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api"))
        return res.status(404).json({ error: "API route not found" });
      const indexPath = path.join(finalDistPath, "index.html");
      if (fs.existsSync(indexPath)) res.sendFile(indexPath);
      else
        res
          .status(404)
          .send(
            "Application shell not found. Please ensure the build completed successfully.",
          );
    });
  } else {
    try {
      console.log(`[Reserva] Creating Vite development server...`);
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: { port: 3001 } },
        appType: "spa",
      });
      console.log("[Reserva] Vite development server created.");
      app.use(vite.middlewares);
      app.get("*", async (req, res, next) => {
        if (req.path.startsWith("/api")) return next();
        try {
          const indexPath = path.resolve(__dirname, "index.html");
          if (!fs.existsSync(indexPath))
            return res
              .status(404)
              .send("Development index.html not found at root.");
          let template = fs.readFileSync(indexPath, "utf-8");
          template = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e: any) {
          vite.ssrFixStacktrace(e);
          next(e);
        }
      });
    } catch (viteErr) {
      console.error("[Reserva] FAILED TO CREATE VITE SERVER:", viteErr);
      throw viteErr;
    }
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Reserva] SERVER LISTENING ON PORT ${PORT}`);
    seedDatabase();
    startNotificationCron();
  });
}

function calculateEndTime(
  time: string,
  peopleCount: number,
  customDuration?: number,
): string {
  const [h, m] = time.split(":").map(Number);
  let duration: number;
  if (customDuration && customDuration > 0) duration = customDuration;
  else if (peopleCount >= 5) duration = 120;
  else if (peopleCount >= 3) duration = 90;
  else duration = 75;
  const totalMinutes = h * 60 + m + duration;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
}

function startNotificationCron() {
  setInterval(async () => {
    if (!db) return;
    try {
      const due = db
        .prepare(
          `SELECT * FROM notifications WHERE sent = 0 AND cancelled = 0 AND send_at <= datetime('now')`,
        )
        .all() as any[];
      for (const notif of due) {
        db.prepare("UPDATE notifications SET sent = 1 WHERE id = ?").run(
          notif.id,
        );
        console.log(
          `[Reserva Notif] Sending to user ${notif.user_id}: ${notif.message}`,
        );
      }
    } catch (err) {
      console.error("[Reserva] Notification cron error:", err);
    }
  }, 60000);
}

function seedDatabase() {
  if (!db) {
    console.warn("[Reserva] Skipping seeding: Database not initialized.");
    return;
  }
  try {
    const userCount = db
      .prepare("SELECT COUNT(*) as count FROM users")
      .get() as { count: number };
    if (userCount && userCount.count === 0) {
      console.log("[Reserva] Seeding initial data...");
      const adminPass = bcrypt.hashSync("admin123", 10);
      db.prepare(
        "INSERT INTO users (email, password, name, surname, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("admin@reserva.app", adminPass, "Admin", "User", "admin", 1);
      const ownerPass = bcrypt.hashSync("owner123", 10);
      db.prepare(
        "INSERT INTO users (email, password, name, surname, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("owner@grill.com", ownerPass, "Mario", "Rossi", "owner", 1);
      const ownerRow = db
        .prepare("SELECT id FROM users WHERE email = ?")
        .get("owner@grill.com") as any;
      const ownerId = ownerRow.id;
      db.prepare(
        `INSERT INTO restaurants (owner_id, name, description, cuisine_type, location, logo_url, rating, dist_km, is_recommended, outdoor_seating, open_time, close_time, lat, lng, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        ownerId,
        "Gino's Grill",
        "Best steaks in town with a modern touch.",
        "Steakhouse",
        "123 Main St, New York",
        "https://picsum.photos/seed/restaurant1/100/100",
        4.8,
        1.2,
        1,
        1,
        "10:00",
        "22:00",
        40.7128,
        -74.006,
        "approved",
      );
      db.prepare(
        `INSERT INTO restaurants (owner_id, name, description, cuisine_type, location, logo_url, rating, dist_km, is_recommended, outdoor_seating, open_time, close_time, lat, lng, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        ownerId,
        "Pasta Perfection",
        "Authentic Italian pasta handmade daily.",
        "Italian",
        "456 Broadway, New York",
        "https://picsum.photos/seed/restaurant2/100/100",
        4.6,
        0.8,
        1,
        0,
        "11:00",
        "23:00",
        40.7193,
        -74.0028,
        "approved",
      );
      db.prepare(
        `INSERT INTO restaurants (owner_id, name, description, cuisine_type, location, logo_url, rating, dist_km, is_recommended, outdoor_seating, open_time, close_time, lat, lng, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        ownerId,
        "Sushi Zen",
        "Zen garden atmosphere with the freshest fish.",
        "Japanese",
        "789 5th Ave, New York",
        "https://picsum.photos/seed/restaurant3/100/100",
        4.9,
        2.5,
        0,
        1,
        "12:00",
        "23:00",
        40.7637,
        -73.9736,
        "approved",
      );
      const grill = db
        .prepare("SELECT id FROM restaurants WHERE name = ?")
        .get("Gino's Grill") as any;
      db.prepare(
        `INSERT INTO restaurant_images (restaurant_id, url) VALUES (?, ?)`,
      ).run(grill.id, "https://picsum.photos/seed/food1/800/600");
      db.prepare(
        `INSERT INTO restaurant_images (restaurant_id, url) VALUES (?, ?)`,
      ).run(grill.id, "https://picsum.photos/seed/food2/800/600");
      const admin = db
        .prepare("SELECT id FROM users WHERE email = ?")
        .get("admin@reserva.app") as any;
      db.prepare(
        `INSERT INTO reviews (restaurant_id, customer_id, rating, comment, likes) VALUES (?, ?, ?, ?, ?)`,
      ).run(grill.id, admin.id, 5, "Amazing food and service!", 12);
      console.log("[Reserva] Database seeded successfully.");
    }
  } catch (err) {
    console.error(`[Reserva] Seeding error: ${err}`);
  }
}

startServer().catch((err) => {
  console.error("[Reserva] CRITICAL: Failed to start server:", err);
});

process.on("uncaughtException", (err) => {
  console.error("[Reserva] Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "[Reserva] Unhandled Rejection at:",
    promise,
    "reason:",
    reason,
  );
});
