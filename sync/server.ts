import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createSyncServer } from "./src/app.ts";
import { run } from "./src/main.ts";

export { createSyncServer };

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await run(process.env);
