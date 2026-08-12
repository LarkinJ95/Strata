import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROLE_PRESETS } from "../src/lib/permissions";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sql(value: string) { return `'${value.replaceAll("'", "''")}'`; }

async function main() {
  const organizationName = required("STRATA_ORGANIZATION_NAME");
  const organizationSlug = required("STRATA_ORGANIZATION_SLUG").toLowerCase();
  const adminName = required("STRATA_ADMIN_NAME");
  const adminEmail = required("STRATA_ADMIN_EMAIL").toLowerCase();
  const password = required("STRATA_ADMIN_PASSWORD");
  const organizationId = crypto.randomUUID();
  const roleId = crypto.randomUUID();
  const clientViewerRoleId = crypto.randomUUID();
  const inspectorRoleId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  const statements = [
    `INSERT INTO "Organization" ("id", "name", "slug", "legalName", "settings", "createdAt", "updatedAt") VALUES (${sql(organizationId)}, ${sql(organizationName)}, ${sql(organizationSlug)}, ${sql(organizationName)}, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    `INSERT INTO "Role" ("id", "organizationId", "name", "slug", "description", "permissions", "isSystem", "createdAt", "updatedAt") VALUES (${sql(roleId)}, ${sql(organizationId)}, 'Organization Administrator', 'org_admin', 'Full organization administration', ${sql(JSON.stringify(ROLE_PRESETS.org_admin))}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    `INSERT INTO "Role" ("id", "organizationId", "name", "slug", "description", "permissions", "isSystem", "createdAt", "updatedAt") VALUES (${sql(clientViewerRoleId)}, ${sql(organizationId)}, 'Client Viewer', 'client_viewer', 'Read-only portal access for one client', ${sql(JSON.stringify(ROLE_PRESETS.client_viewer))}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    `INSERT INTO "Role" ("id", "organizationId", "name", "slug", "description", "permissions", "isSystem", "createdAt", "updatedAt") VALUES (${sql(inspectorRoleId)}, ${sql(organizationId)}, 'Inspector', 'inspector', 'Field inspection and evidence collection access', ${sql(JSON.stringify(ROLE_PRESETS.inspector))}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    `INSERT INTO "User" ("id", "organizationId", "roleId", "email", "passwordHash", "name", "status", "mfaEnabled", "createdAt", "updatedAt") VALUES (${sql(userId)}, ${sql(organizationId)}, ${sql(roleId)}, ${sql(adminEmail)}, ${sql(passwordHash)}, ${sql(adminName)}, 'active', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
  ].join("\n");
  const directory = await mkdtemp(join(tmpdir(), "strata-bootstrap-"));
  const file = join(directory, "bootstrap.sql");
  try {
    await writeFile(file, statements, { mode: 0o600 });
    execFileSync("npx", ["wrangler", "d1", "execute", "strata", "--remote", "--file", file], { stdio: "inherit" });
    console.log(`Created administrator ${adminEmail} for ${organizationName}.`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
