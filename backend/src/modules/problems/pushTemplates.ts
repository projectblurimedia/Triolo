import { PreferredLanguage } from '@/modules/auth/interfaces';

/**
 * Per-recipient-language push text for the problem job flow — same rule bookings'
 * pushTemplates.ts follows (`.cloud/architecture.md`, Localization Architecture).
 */
type Template = Record<PreferredLanguage, { title: string; body: string }>;

const ACCEPTED: Template = {
  en: { title: 'Worker Found', body: 'A worker accepted your problem. Open Your Problems to see their contact details.' },
  te: { title: 'వర్కర్ దొరికారు', body: 'ఒక వర్కర్ మీ సమస్యను అంగీకరించారు. వారి వివరాల కోసం "మీ సమస్యలు" తెరవండి.' },
};

const WORK_DONE: Template = {
  en: { title: 'Work Done', body: 'The worker marked your job as done. Please check and confirm it is finished.' },
  te: { title: 'పని పూర్తయింది', body: 'వర్కర్ మీ పని పూర్తయిందని తెలిపారు. దయచేసి చూసి పూర్తయిందని నిర్ధారించండి.' },
};

const COMPLETED: Template = {
  en: { title: 'Job Finished', body: 'The customer confirmed the job is finished. Great work!' },
  te: { title: 'పని ముగిసింది', body: 'పని పూర్తయిందని కస్టమర్ నిర్ధారించారు. చాలా బాగా చేశారు!' },
};

export const problemPushTemplates = {
  accepted: (language: PreferredLanguage) => ACCEPTED[language] ?? ACCEPTED.en,
  workDone: (language: PreferredLanguage) => WORK_DONE[language] ?? WORK_DONE.en,
  completed: (language: PreferredLanguage) => COMPLETED[language] ?? COMPLETED.en,
};
