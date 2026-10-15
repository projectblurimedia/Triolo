import { PreferredLanguage } from '@/modules/auth/interfaces';

/** Admin actions the affected person is told about (saved in their notifications + pushed). */
export type AdminNoticeEvent =
  | 'suspended'
  | 'banned'
  | 'reactivated'
  | 'profiles_removed'
  | 'problem_closed'
  | 'job_post_hidden'
  | 'job_post_shown'
  | 'job_post_removed';

interface NoticeValues {
  days?: number;
  reason?: string | null;
}

type Template = (values: NoticeValues) => { title: string; body: string };

const TEMPLATES: Record<PreferredLanguage, Record<AdminNoticeEvent, Template>> = {
  en: {
    suspended: ({ days }) => ({
      title: 'Account Suspended',
      body: `Triolo has suspended your account for ${days} day${days === 1 ? '' : 's'}.`,
    }),
    banned: () => ({ title: 'Account Banned', body: 'Triolo has banned your account.' }),
    reactivated: () => ({ title: 'Account Active Again', body: 'Your Triolo account is active again. Welcome back!' }),
    profiles_removed: () => ({
      title: 'Profiles Removed',
      body: 'Triolo has removed your services, shop and job post profiles and banned your account.',
    }),
    problem_closed: () => ({ title: 'Problem Post Closed', body: 'Triolo support closed your problem post.' }),
    job_post_hidden: () => ({ title: 'Job Post Hidden', body: 'Triolo support has hidden your job post from customers.' }),
    job_post_shown: () => ({ title: 'Job Post Visible Again', body: 'Your job post is visible to customers again.' }),
    job_post_removed: () => ({ title: 'Job Post Removed', body: 'Triolo support has removed your job post.' }),
  },
  te: {
    suspended: ({ days }) => ({
      title: 'ఖాతా సస్పెండ్ చేయబడింది',
      body: `ట్రియోలో మీ ఖాతాను ${days} రోజుల పాటు సస్పెండ్ చేసింది.`,
    }),
    banned: () => ({ title: 'ఖాతా నిషేధించబడింది', body: 'ట్రియోలో మీ ఖాతాను నిషేధించింది.' }),
    reactivated: () => ({ title: 'ఖాతా మళ్లీ యాక్టివ్', body: 'మీ ట్రియోలో ఖాతా మళ్లీ యాక్టివ్‌గా ఉంది. తిరిగి స్వాగతం!' }),
    profiles_removed: () => ({
      title: 'ప్రొఫైల్‌లు తొలగించబడ్డాయి',
      body: 'ట్రియోలో మీ సేవలు, షాప్, జాబ్ పోస్ట్ ప్రొఫైల్‌లను తొలగించి మీ ఖాతాను నిషేధించింది.',
    }),
    problem_closed: () => ({ title: 'సమస్య పోస్ట్ మూసివేయబడింది', body: 'ట్రియోలో సపోర్ట్ మీ సమస్య పోస్ట్‌ను మూసివేసింది.' }),
    job_post_hidden: () => ({
      title: 'జాబ్ పోస్ట్ దాచబడింది',
      body: 'ట్రియోలో సపోర్ట్ మీ జాబ్ పోస్ట్‌ను కస్టమర్ల నుంచి దాచింది.',
    }),
    job_post_shown: () => ({ title: 'జాబ్ పోస్ట్ మళ్లీ కనిపిస్తుంది', body: 'మీ జాబ్ పోస్ట్ మళ్లీ కస్టమర్లకు కనిపిస్తోంది.' }),
    job_post_removed: () => ({ title: 'జాబ్ పోస్ట్ తొలగించబడింది', body: 'ట్రియోలో సపోర్ట్ మీ జాబ్ పోస్ట్‌ను తొలగించింది.' }),
  },
};

/** The notice text in the recipient's language, with the admin's reason added when given. */
export function adminNotice(
  event: AdminNoticeEvent,
  language: PreferredLanguage,
  values: NoticeValues = {},
): { title: string; body: string } {
  const text = (TEMPLATES[language] ?? TEMPLATES.en)[event](values);
  if (!values.reason) return text;
  return { title: text.title, body: `${text.body} ${language === 'te' ? 'కారణం' : 'Reason'}: ${values.reason}` };
}
