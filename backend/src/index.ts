import app from "./app.js";
import { env } from "./lib/env.js";

const server = app.listen(env.PORT, () => {
  console.log(`PrepPilot API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
