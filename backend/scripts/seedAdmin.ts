import { pool } from '@/config/database';
import { logger } from '@/common/utils/logger';

/**
 * One-off CLI bootstrap for the very first admin account — `admin` is "provisioned
 * separately, never self-registered" (see .cloud/project-context.md's Account Model), so
 * there's no API route that creates one. Run once per admin: `npm run seed:admin -- <mobile>
 * <fullName> [email]`. The admin then logs in through the existing `/auth/login/request-otp`
 * + `/auth/login/verify-otp` flow — this script only ever touches the `accounts` row.
 */
async function run(): Promise<void> {
  const [mobileNumber, fullName, email] = process.argv.slice(2);
  if (!mobileNumber || !fullName) {
    logger.error('Usage: npm run seed:admin -- <mobileNumber> <fullName> [email]');
    process.exit(1);
  }

  const existing = await pool.query('SELECT id, role FROM accounts WHERE mobile_number = $1', [mobileNumber]);
  if (existing.rows[0]) {
    if (existing.rows[0].role === 'admin') {
      logger.info(`Account ${mobileNumber} already exists and is already an admin — nothing to do.`);
    } else {
      logger.error(
        `Account ${mobileNumber} already exists with role '${existing.rows[0].role}'. This script only creates new accounts — promote it manually if that's intended.`,
      );
      process.exit(1);
    }
  } else {
    await pool.query(
      `INSERT INTO accounts (full_name, mobile_number, email, role, status)
       VALUES ($1, $2, $3, 'admin', 'active')`,
      [fullName, mobileNumber, email ?? null],
    );
    logger.info(`Admin account created for ${mobileNumber}. Log in via the normal login-OTP flow.`);
  }

  await pool.end();
}

run().catch((err) => {
  logger.error(err, 'Admin seed failed');
  process.exit(1);
});
