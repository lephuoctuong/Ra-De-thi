import { loadEnvFile } from "node:process";
import app from "./server";

// Load local secrets for development without exposing them to Vite.
// Missing env files are intentionally ignored; production/Vercel uses
// process.env configured by the hosting platform.
try {
  loadEnvFile(".env.local");
} catch {}
try {
  loadEnvFile(".env");
} catch {}

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`🚀 Ra-De-thi API running at http://localhost:${PORT}`);
});
