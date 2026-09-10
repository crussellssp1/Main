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

const [, , command = "dev", ...rest] = process.argv;

const env = { ...process.env };
if (env.NODE_USE_ENV_PROXY === undefined) env.NODE_USE_ENV_PROXY = "1";
if (env.NODE_USE_ENV_PROXY === "0") delete env.NODE_USE_ENV_PROXY;
// EnvHttpProxyAgent is flagged experimental and prints a warning on every boot.
if (env.NODE_NO_WARNINGS === undefined) env.NODE_NO_WARNINGS = "1";

const child = spawn(
  process.platform === "win32" ? "next.cmd" : "next",
  [command, ...rest],
  { stdio: "inherit", env, shell: process.platform === "win32" }
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error(`failed to start next ${command}:`, err.message);
  process.exit(1);
});
