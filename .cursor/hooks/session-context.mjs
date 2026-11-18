#!/usr/bin/env node
import { existsSync } from "node:fs";

function contractPath(name) {
  if (existsSync(`docs/${name}`)) return `docs/${name}`;
  if (existsSync(`../docs/${name}`)) return `../docs/${name}`;
  return name;
}

const context = [
  "Doctor Tracker API (Express, MongoDB, Zod).",
  `Contract: ${contractPath("lld.md")}, ${contractPath("backend-structure.md")}.`,
  `Next task: lowest unchecked item in ${contractPath("backend-tasks.md")}. One task, then its tests.`,
  "Layers: route wires middleware; controller calls one service and writes the envelope; service throws DomainError; model returns lean objects.",
  "NodeNext imports end in .js. Calendar goes through lib/calendar.ts (Temporal).",
  "Use the context7 MCP for library APIs. Use the mongodb MCP read-only.",
  "If the LLD does not state a field, status, message, or error code, stop. No any, ts-ignore, TODO, empty catch, or invented code.",
  "CSRF: Origin must match the FRONTEND_ORIGIN allowlist on refresh and logout. No outbound fetch of a request URL. No $where. No secrets in JSON or logs.",
  "Do not log passwords, hashes, or tokens.",
  "After a task's edits, the stop hook runs format:check, lint, typecheck, unit tests, and build when those scripts exist. Commit with the commit guidelines only after that gate passes.",
].join(" ");

process.stdout.write(JSON.stringify({ additional_context: context }));
