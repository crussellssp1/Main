#!/usr/bin/env node
/**
 * Launcher for the Next server.
 *
 * Node's built-in fetch (undici) ignores HTTPS_PROXY/HTTP_PROXY unless
 * NODE_USE_ENV_PROXY is set. Several publishers block datacenter egress, and
 * corporate networks route everything through a proxy, so the terminal's
 * server-side feed fetches need that behaviour. Setting it here and spawning
 * Next as a child keeps this cross-platform, where an inline `VAR=1 next dev`
 * would fail on Windows.
 *
 * Set NODE_USE_ENV_PROXY=0 in the environment to opt out.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const [, , command = "dev", ...rest] = process.argv;

const env = { ...process.env };
if (env.NODE_USE_ENV_PROXY === undefined) env.NODE_USE_ENV_PROXY = "1";
if (env.NODE_USE_ENV_PROXY === "0") delete env.NODE_USE_ENV_PROXY;
// EnvHttpProxyAgent is flagged experimental and prints a warning on every boot.
if (env.NODE_NO_WARNINGS === undefined) env.NODE_NO_WARNINGS = "1";

/**
 * Resolve Next's CLI entry point and run it with this same Node binary.
 *
 * Launching the `next` shim instead would depend on node_modules/.bin being on
 * PATH and, on Windows, on a .cmd wrapper and a shell — both of which fail on
 * machines with a restricted PowerShell execution policy. Resolving the JS
 * entry point sidesteps the shell entirely on every platform.
 */
let nextCli;
try {
  nextCli = require.resolve("next/dist/bin/next");
} catch {
  console.error(
    "Could not find Next.js. Run `npm install` in this folder first, then try again."
  );
  process.exit(1);
}

const child = spawn(process.execPath, [nextCli, command, ...rest], {
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error(`failed to start next ${command}:`, err.message);
  process.exit(1);
});
