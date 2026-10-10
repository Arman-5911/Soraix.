import fs from "node:fs/promises";
import path from "node:path";
import { restrictedPath } from "../server/request-guard.mjs";

// Fail the deployment build instead of publishing accidental private artifacts.
const root = path.resolve(process.argv[2] || "dist");
const failures = [];
async function inspect(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    const relative = path.relative(root, full).replaceAll(path.sep, "/");
    if (
      entry.isSymbolicLink() ||
      restrictedPath("/" + relative) ||
      /(?:^|\/)(?:package(?:-lock)?\.json|vercel\.json|.*\.log)$/i.test(
        relative,
      )
    ) {
      failures.push(relative);
    } else if (entry.isDirectory()) await inspect(full);
    else if (/\.(?:js|html|json|txt)$/i.test(entry.name)) {
      const text = await fs.readFile(full, "utf8");
      if (
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|AKIA[0-9A-Z]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{40,}/.test(
          text,
        )
      )
        failures.push(relative + " (possible credential; value redacted)");
    }
  }
}
await inspect(root);
if (failures.length) {
  console.error("Unsafe public build artifacts:\n" + failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Public build check passed: no restricted artifacts or known credential patterns.",
  );
