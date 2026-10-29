import "dotenv/config";
import { grantRole } from "../services/admin.service.js";
import type { UserRole } from "../db/schema/index.js";

const ROLES = ["user", "moderator", "admin"];

async function main() {
  const [username, role = "admin"] = process.argv.slice(2);
  if (!username || !ROLES.includes(role)) {
    console.error("Usage: pnpm --filter backend admin:grant <username> [admin|moderator|user]");
    process.exit(1);
  }
  const result = await grantRole(username, role as UserRole);
  if (!result) {
    console.error(`Пользователь «${username}» не найден`);
    process.exit(1);
  }
  console.log(`@${result.username}: ${result.previousRole} → ${result.role}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});