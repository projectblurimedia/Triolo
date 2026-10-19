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

/** A customer booked this worker in particular — a personal request, not a broadcast. */
export function directOfferTitle(language: PreferredLanguage): string {
  return language === 'te' ? 'మీకు బుకింగ్ అభ్యర్థన' : 'Booking Request for You';
}

export function directOfferBody(
  customerName: string,
  distanceMeters: number | null,
  skillCategories: string[],
  language: PreferredLanguage,
): string {
  const skills = skillLabels(skillCategories, language);
  const distance = distanceMeters != null ? formatDistance(distanceMeters, language) : null;
  if (language === 'te') {
    return `${customerName} మిమ్మల్ని ${skills} పని కోసం బుక్ చేయాలనుకుంటున్నారు${distance ? ` (${distance})` : ''}.`;
  }
  return `${customerName} wants to book you for ${skills}${distance ? ` (${distance})` : ''}.`;
}

export function jobTakenTitle(language: PreferredLanguage): string {
  return language === 'te' ? 'పని అందుబాటులో లేదు' : 'Job No Longer Available';
}

export function jobTakenBody(language: PreferredLanguage): string {
  return language === 'te' ? 'ఈ పనిని మరొక వర్కర్ ఇప్పటికే అంగీకరించారు.' : 'This job was already accepted by another worker.';
}

/** Quick Book trip steps — each goes to the other person, in their own language. */
export type TripEvent =
  | 'accepted'
  | 'on_the_way'
  | 'arrived'
  | 'work_done'
  | 'completed'
  | 'cancelled'
  | 'worker_cancelled'
  | 'worker_cancelled_problem'
  | 'worker_declined'
  | 'cancelled_late'
  | 'admin_cancelled';

const TRIP_TEMPLATES: Record<TripEvent, Record<PreferredLanguage, { title: string; body: string }>> = {
  // → customer
  accepted: {
    en: { title: 'Worker Found', body: 'A worker accepted your Quick Book request. Open the app to see them.' },
    te: { title: 'వర్కర్ దొరికారు', body: 'ఒక వర్కర్ మీ క్విక్ బుక్ అభ్యర్థనను అంగీకరించారు. వారిని చూడటానికి యాప్ తెరవండి.' },
  },
  on_the_way: {
    en: { title: 'Worker On The Way', body: 'Your worker has started. Track them live in the app.' },
    te: { title: 'వర్కర్ బయలుదేరారు', body: 'మీ వర్కర్ బయలుదేరారు. యాప్‌లో లైవ్‌గా చూడండి.' },
  },
  arrived: {
    en: { title: 'Worker Has Arrived', body: 'Share your PIN from the app with the worker to start the work.' },
    te: { title: 'వర్కర్ వచ్చేశారు', body: 'పని మొదలుపెట్టడానికి యాప్‌లోని మీ PINని వర్కర్‌కు చెప్పండి.' },
  },
  // → both sides; the admin's reason is added after the body.
  admin_cancelled: {
    en: { title: 'Booking Cancelled by Triolo', body: 'Triolo support cancelled this booking.' },
    te: { title: 'ట్రియోలో బుకింగ్‌ను రద్దు చేసింది', body: 'ట్రియోలో సపోర్ట్ ఈ బుకింగ్‌ను రద్దు చేసింది.' },
  },
  worker_cancelled: {
    en: { title: 'Worker Cancelled', body: 'Your worker had to cancel this booking. Please book again to find another worker.' },
    te: {
      title: 'వర్కర్ రద్దు చేశారు',
      body: 'మీ వర్కర్ ఈ బుకింగ్‌ను రద్దు చేయాల్సి వచ్చింది. మరొక వర్కర్ కోసం మళ్లీ బుక్ చేయండి.',
    },
  },
  worker_declined: {
    en: { title: 'Worker Not Available', body: "The worker you chose can't take this job. Try Quick Book to ask everyone nearby." },
    te: {
      title: 'వర్కర్ అందుబాటులో లేరు',
      body: 'మీరు ఎంచుకున్న వర్కర్ ఈ పని తీసుకోలేరు. దగ్గరలోని అందరినీ అడగడానికి క్విక్ బుక్ ప్రయత్నించండి.',
    },
  },
  worker_cancelled_problem: {
    en: { title: 'Worker Cancelled', body: 'Your worker had to cancel. Your problem is open again for other workers nearby.' },
    te: { title: 'వర్కర్ రద్దు చేశారు', body: 'మీ వర్కర్ రద్దు చేశారు. మీ సమస్య మళ్లీ దగ్గరలోని ఇతర వర్కర్లకు అందుబాటులో ఉంది.' },
  },
  work_done: {
    en: { title: 'Work Done', body: 'The worker marked the job as done. Please check, then confirm and rate.' },
    te: { title: 'పని పూర్తయింది', body: 'వర్కర్ పని పూర్తయిందని తెలిపారు. దయచేసి చూసి, నిర్ధారించి రేటింగ్ ఇవ్వండి.' },
  },
  // → worker
  completed: {
    en: { title: 'Job Finished', body: 'The customer confirmed the job is finished. Great work!' },
    te: { title: 'పని ముగిసింది', body: 'పని పూర్తయిందని కస్టమర్ నిర్ధారించారు. చాలా బాగా చేశారు!' },
  },
  cancelled_late: {
    en: { title: 'Booking Cancelled', body: "The customer cancelled because you didn't arrive in time, and rated the job." },
    te: { title: 'బుకింగ్ రద్దయింది', body: 'మీరు సమయానికి రాలేదని కస్టమర్ రద్దు చేసి, రేటింగ్ ఇచ్చారు.' },
  },
  cancelled: {
    en: { title: 'Booking Cancelled', body: 'The customer cancelled this booking.' },
    te: { title: 'బుకింగ్ రద్దయింది', body: 'కస్టమర్ ఈ బుకింగ్‌ను రద్దు చేశారు.' },
  },
};

export function tripTemplate(event: TripEvent, language: PreferredLanguage): { title: string; body: string } {
  return TRIP_TEMPLATES[event][language] ?? TRIP_TEMPLATES[event].en;
}
