import { pool } from '@/config/database';
import { logger } from '@/common/utils/logger';

/**
 * One-off CLI bootstrap for bulk test Worker/Business listings — requested explicitly to
 * cover every skill/shop category with more than 5 profiles each, all in one test location
 * (Kannapuram, Eluru district, Andhra Pradesh, 534311), pre-verified (skips admin review,
 * since manually approving dozens of profiles one at a time isn't practical for test data).
 * Bypasses the OTP/API flow entirely, same pattern as `seedAdmin.ts` — direct `pool` queries
 * against `accounts`/`worker_profiles`/`business_profiles`. Idempotent: re-running skips any
 * account/profile that already exists (matched by mobile_number / account_id) rather than
 * erroring or duplicating. Run: `npm run seed:test-listings`.
 */

const WORKER_CATEGORIES = ['electrician', 'plumber', 'painter', 'carpenter', 'mechanic', 'cleaner', 'mason'] as const;
const SHOP_CATEGORIES = ['grocery', 'restaurant', 'pharmacy', 'electronics', 'clothing', 'hardware', 'salon'] as const;
const PER_CATEGORY = 6; // more than 5, per the request

const AREAS = ['Main Road', 'Bus Stand Road', 'Market Street', 'Temple Street', 'Canal Road', 'School Road'];
const CITY = 'Kannapuram';
const DISTRICT = 'Eluru';
const STATE = 'Andhra Pradesh';
const PINCODE = '534311';
const BASE_LAT = 16.75;
const BASE_LNG = 81.55;

// Every 1st worker in each skill category (worker1, worker7, worker13, ...) also gets a
// Business profile, and every 1st shopkeeper in each shop category (shopkeeper1,
// shopkeeper7, ...) also gets a Worker profile — "some should have both worker, shopkeeper
// too," spread across every category rather than piled onto a handful of accounts.
const BOTH_CAPABILITY_OFFSET = 0;

function jitter(base: number, index: number): number {
  return Number((base + ((index % 7) - 3) * 0.01).toFixed(6));
}

async function upsertAccount(fullName: string, mobileNumber: string): Promise<string> {
  const existing = await pool.query('SELECT id FROM accounts WHERE mobile_number = $1', [mobileNumber]);
  if (existing.rows[0]) return existing.rows[0].id;
  const inserted = await pool.query(
    `INSERT INTO accounts (full_name, mobile_number, role, status) VALUES ($1, $2, 'user', 'active') RETURNING id`,
    [fullName, mobileNumber],
  );
  return inserted.rows[0].id;
}

async function upsertWorkerProfile(accountId: string, skillCategory: string, index: number): Promise<void> {
  const existing = await pool.query('SELECT id FROM worker_profiles WHERE account_id = $1', [accountId]);
  if (existing.rows[0]) return;
  await pool.query(
    `INSERT INTO worker_profiles
       (account_id, skill_categories, experience_years, latitude, longitude, area, city, district, state, pincode, portfolio_photo_urls, verification_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{}', 'verified')`,
    [
      accountId,
      [skillCategory],
      2 + (index % 7),
      jitter(BASE_LAT, index),
      jitter(BASE_LNG, index + 3),
      AREAS[index % AREAS.length],
      CITY,
      DISTRICT,
      STATE,
      PINCODE,
    ],
  );
}

async function upsertBusinessProfile(accountId: string, shopName: string, shopCategory: string, index: number): Promise<void> {
  const existing = await pool.query('SELECT id FROM business_profiles WHERE account_id = $1', [accountId]);
  if (existing.rows[0]) return;
  const deliveryAvailable = index % 2 === 0;
  await pool.query(
    `INSERT INTO business_profiles
       (account_id, shop_name, shop_categories, latitude, longitude, area, city, district, state, pincode, shop_photo_urls, verification_status, delivery_available, delivery_price_per_km)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{}', 'verified', $11, $12)`,
    [
      accountId,
      shopName,
      [shopCategory],
      jitter(BASE_LAT, index + 1),
      jitter(BASE_LNG, index + 4),
      AREAS[index % AREAS.length],
      CITY,
      DISTRICT,
      STATE,
      PINCODE,
      deliveryAvailable,
      deliveryAvailable ? 10 : null,
    ],
  );
}

async function run(): Promise<void> {
  let workerCount = 0;
  let businessCount = 0;
  let comboCount = 0;

  for (let c = 0; c < WORKER_CATEGORIES.length; c++) {
    const category = WORKER_CATEGORIES[c];
    for (let n = 1; n <= PER_CATEGORY; n++) {
      const workerNumber = c * PER_CATEGORY + n;
      const fullName = `worker${workerNumber}`;
      const mobileNumber = String(9700000000 + workerNumber);
      const accountId = await upsertAccount(fullName, mobileNumber);
      await upsertWorkerProfile(accountId, category, workerNumber);
      workerCount++;

      if (n === 1 + BOTH_CAPABILITY_OFFSET) {
        const shopCategory = SHOP_CATEGORIES[c];
        await upsertBusinessProfile(accountId, `${fullName} ${shopCategory} shop`, shopCategory, workerNumber);
        comboCount++;
      }
    }
  }

  for (let c = 0; c < SHOP_CATEGORIES.length; c++) {
    const category = SHOP_CATEGORIES[c];
    for (let n = 1; n <= PER_CATEGORY; n++) {
      const shopNumber = c * PER_CATEGORY + n;
      const fullName = `shopkeeper${shopNumber}`;
      const mobileNumber = String(9700001000 + shopNumber);
      const accountId = await upsertAccount(fullName, mobileNumber);
      await upsertBusinessProfile(accountId, `${fullName} ${category} shop`, category, shopNumber);
      businessCount++;

      if (n === 1 + BOTH_CAPABILITY_OFFSET) {
        const skillCategory = WORKER_CATEGORIES[c];
        await upsertWorkerProfile(accountId, skillCategory, shopNumber);
        comboCount++;
      }
    }
  }

  logger.info(
    `Seeded ${workerCount} worker profiles (${PER_CATEGORY} per category × ${WORKER_CATEGORIES.length} categories) and ${businessCount} business profiles (${PER_CATEGORY} per category × ${SHOP_CATEGORIES.length} categories), plus ${comboCount} accounts given the other capability too — all pre-verified, all in ${CITY}, ${DISTRICT}, ${STATE} - ${PINCODE}.`,
  );

  await pool.end();
}

run().catch((err) => {
  logger.error(err, 'Test listings seed failed');
  process.exit(1);
});
