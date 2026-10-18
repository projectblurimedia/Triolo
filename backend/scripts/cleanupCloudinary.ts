/**
 * Finds files in Cloudinary (under `triolo/`) that no profile, account, job post, problem or
 * ad uses any more — left over from before cleanup-on-change existed, or from an upload that
 * failed halfway — and deletes them.
 *
 *   npm run cleanup:cloudinary                 # dry run: only lists what it would delete
 *   npm run cleanup:cloudinary -- --delete     # deletes them
 *   --min-age-hours=24 (default)               # never touches files newer than this, so an
 *                                              # upload still being saved is safe
 */
import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { Pool } from 'pg';
import { extractPublicIdFromUrl } from '../src/common/services/cloudinaryService';

const args = process.argv.slice(2);
const apply = args.includes('--delete');
const minAgeHours = Number(args.find((arg) => arg.startsWith('--min-age-hours='))?.split('=')[1] ?? 24);

// Every column that holds a Cloudinary URL (or a list of them).
const URL_QUERIES = [
  `SELECT profile_photo_url AS url FROM accounts WHERE profile_photo_url IS NOT NULL`,
  `SELECT profile_photo_url AS url FROM worker_profiles WHERE profile_photo_url IS NOT NULL`,
  `SELECT unnest(portfolio_photo_urls) AS url FROM worker_profiles`,
  `SELECT profile_photo_url AS url FROM business_profiles WHERE profile_photo_url IS NOT NULL`,
  `SELECT unnest(shop_photo_urls) AS url FROM business_profiles`,
  `SELECT photo_url AS url FROM job_seeker_posts WHERE photo_url IS NOT NULL`,
  `SELECT unnest(photo_urls) AS url FROM problem_posts`,
  `SELECT unnest(image_urls) AS url FROM ads`,
  `SELECT video_url AS url FROM ads WHERE video_url IS NOT NULL`,
];

async function main() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const used = new Set<string>();
  for (const query of URL_QUERIES) {
    const result = await pool.query(query);
    for (const row of result.rows) {
      const id = row.url ? extractPublicIdFromUrl(row.url) : null;
      if (id) used.add(id);
    }
  }
  await pool.end();
  console.log(`${used.size} files are in use.`);

  const cutoff = Date.now() - minAgeHours * 3600 * 1000;
  const unused: { id: string; type: 'image' | 'video'; created: string; bytes: number }[] = [];
  for (const type of ['image', 'video'] as const) {
    let cursor: string | undefined;
    do {
      const page = await cloudinary.api.resources({
        type: 'upload',
        resource_type: type,
        prefix: 'triolo/',
        max_results: 500,
        next_cursor: cursor,
      });
      for (const file of page.resources) {
        if (!used.has(file.public_id) && new Date(file.created_at).getTime() < cutoff) {
          unused.push({ id: file.public_id, type, created: file.created_at, bytes: file.bytes });
        }
      }
      cursor = page.next_cursor;
    } while (cursor);
  }

  const megabytes = (unused.reduce((sum, file) => sum + file.bytes, 0) / 1024 / 1024).toFixed(1);
  console.log(`${unused.length} unused files (${megabytes} MB) older than ${minAgeHours} h:`);
  for (const file of unused) console.log(`  ${file.type}  ${file.id}  ${file.created}`);

  if (!apply) {
    console.log('\nDry run — nothing deleted. Add --delete to delete them.');
    return;
  }
  for (const file of unused) {
    await cloudinary.uploader.destroy(file.id, { resource_type: file.type, invalidate: true });
  }
  console.log(`\nDeleted ${unused.length} files.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
