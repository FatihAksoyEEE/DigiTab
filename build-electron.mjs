import { build } from "esbuild";

// server.ts'yi Electron'un çalıştıracağı server.js'e derler; bağımlılıklar node_modules'tan yüklenir
await build({
  entryPoints: ["server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  outfile: "server.js",
  packages: "external",
});
console.log("Server compiled successfully!");
