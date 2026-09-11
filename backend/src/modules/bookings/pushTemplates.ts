import { PreferredLanguage } from '@/modules/auth/interfaces';
import { WorkerSkillCategory } from '@/modules/workers/interfaces';

/**
 * Per-language templates for Quick Book's broadcast/taken pushes — per
 * `.cloud/architecture.md`'s Localization Architecture rule that anything the backend
 * composes and pushes to a user unprompted is language-aware via per-recipient template
 * lookup, never translated on the fly. (The older `profile_view` push predates this module
 * and still hardcodes English — a pre-existing gap, not touched here since it wasn't asked
 * for; this is the first push type to actually follow the documented rule.)
 */
const SKILL_LABELS: Record<WorkerSkillCategory, Record<PreferredLanguage, string>> = {
  electrician: { en: 'Electrician', te: 'ఎలక్ట్రీషియన్' },
  plumber: { en: 'Plumber', te: 'ప్లంబర్' },
  painter: { en: 'Painter', te: 'పెయింటర్' },
  carpenter: { en: 'Carpenter', te: 'కార్పెంటర్' },
  mechanic: { en: 'Mechanic', te: 'మెకానిక్' },
  cleaner: { en: 'Cleaner', te: 'క్లీనర్' },
  mason: { en: 'Mason', te: 'మేస్త్రీ' },
  other: { en: 'Other', te: 'ఇతర' },
};

function skillLabels(categories: string[], language: PreferredLanguage): string {
  return categories.map((key) => SKILL_LABELS[key as WorkerSkillCategory]?.[language] ?? key).join(', ');
}

function formatDistance(meters: number, language: PreferredLanguage): string {
  if (meters < 1000) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return language === 'te' ? `${rounded} మీ దూరంలో` : `${rounded}m away`;
  }
  const km = (meters / 1000).toFixed(1);
  return language === 'te' ? `${km} కి.మీ దూరంలో` : `${km}km away`;
}

export function bookingOfferTitle(language: PreferredLanguage): string {
  return language === 'te' ? 'కొత్త పని అభ్యర్థన' : 'New Job Nearby';
}

export function bookingOfferBody(distanceMeters: number, skillCategories: string[], language: PreferredLanguage): string {
  const distance = formatDistance(distanceMeters, language);
  const skills = skillLabels(skillCategories, language);
  return language === 'te' ? `${distance} ఉన్న వినియోగదారుకు ${skills} అవసరం.` : `Someone ${distance} needs ${skills}.`;
}

export function jobTakenTitle(language: PreferredLanguage): string {
  return language === 'te' ? 'పని అందుబాటులో లేదు' : 'Job No Longer Available';
}

export function jobTakenBody(language: PreferredLanguage): string {
  return language === 'te' ? 'ఈ పనిని మరొక వర్కర్ ఇప్పటికే అంగీకరించారు.' : 'This job was already accepted by another worker.';
}
