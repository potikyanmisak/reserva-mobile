// Usage:
//   1) Check a restaurant's stored coordinates:
//        node fix-restaurant-location.js check "restaurant name"
//
//   2) Fix a restaurant's coordinates:
//        node fix-restaurant-location.js fix <restaurant_id> <lat> <lng>
//
// Run this from the SAME folder as your reserva.db (or edit dbPath below).

const Database = require("better-sqlite3");
const dbPath = "reserva.db"; // adjust if your db lives elsewhere, e.g. "/tmp/reserva.db"
const db = new Database(dbPath);

const [, , mode, ...args] = process.argv;

if (mode === "check") {
  const name = args.join(" ");
  const rows = db
    .prepare(
      "SELECT id, name, location, lat, lng, status, is_hidden FROM restaurants WHERE name LIKE ?",
    )
    .all(`%${name}%`);
  if (rows.length === 0) {
    console.log("No restaurant found matching:", name);
  } else {
    console.table(rows);
  }
} else if (mode === "fix") {
  const [id, lat, lng] = args;
  if (!id || lat === undefined || lng === undefined) {
    console.error(
      "Usage: node fix-restaurant-location.js fix <restaurant_id> <lat> <lng>",
    );
    process.exit(1);
  }
  const result = db
    .prepare("UPDATE restaurants SET lat = ?, lng = ? WHERE id = ?")
    .run(Number(lat), Number(lng), Number(id));
  console.log(`Updated ${result.changes} row(s).`);
  const row = db
    .prepare("SELECT id, name, lat, lng FROM restaurants WHERE id = ?")
    .get(Number(id));
  console.log("Now:", row);
} else {
  console.log(`
Usage:
  node fix-restaurant-location.js check "restaurant name"
  node fix-restaurant-location.js fix <restaurant_id> <lat> <lng>
`);
}

db.close();
