import React from 'react';
import { useTranslation } from 'react-i18next';
import { StackStep, StepStack } from './StepStack';
import { useMyJobs } from '@/hooks/useJobs';
import { useShopOrders } from '@/hooks/useShopOrders';
import { ACTIVE_JOB_STATUSES } from '@/services/jobsService';
import { ACTIVE_SHOP_STATUSES } from '@/services/shopOrdersService';
import { openJob } from '@/state/jobFocusStore';
import { openShopOrder } from '@/state/shopOrderFocusStore';

interface Step {
  key: string;
  kind: 'job' | 'problem' | 'order';
  name: string;
  stepTitle: string;
  hint: string;
  createdAt: string;
  urgent: boolean;
  onPress: () => void;
}

/**
 * Home's "Continue where you left off": every job or shop order that is mid-way (accepted,
 * on the way, waiting for a PIN, packing, out for delivery…) in one place at the top of Home,
 * each one tap from its step screen — no digging through Bookings → Active after the app was
 * closed or minimised. Renders nothing when nothing is in progress.
 */
export function ContinueSteps({ isShop }: { isShop: boolean }) {
  const { t } = useTranslation();
  const jobs = useMyJobs();
  const orders = useShopOrders(isShop);

  const skills = (keys: string[]) => keys.map((key) => t(`workerProfile.skills.${key}`)).join(', ');

  const steps: Step[] = [
    ...(jobs.data ?? [])
      .filter((job) => ACTIVE_JOB_STATUSES.includes(job.status))
      .map<Step>((job) => ({
        key: `job-${job.id}`,
        kind: job.problemPostId ? 'problem' : 'job',
        name: job.customerFullName,
        stepTitle: `${t(`job.status.${job.status}.title`)} · ${skills(job.skillCategories)}`,
        hint: t(`job.status.${job.status}.message`, { name: job.customerFullName }),
        createdAt: job.createdAt,
        // Waiting on the customer, not on you.
        urgent: job.status !== 'work_done',
        onPress: () => openJob(job.id),
      })),
    ...(isShop ? (orders.data ?? []) : [])
      // New ones are in "New for you" above; here only what is under way.
      .filter((order) => ACTIVE_SHOP_STATUSES.includes(order.status))
      .map<Step>((order) => ({
        key: `order-${order.id}`,
        kind: 'order',
        name: order.customerFullName,
        stepTitle: `${t(`shopOrders.status.${order.status}.title`)} · ${t('continueSteps.itemCount', { count: order.items.length })}`,
        hint: t(`shopOrders.status.${order.status}.message`, { name: order.customerFullName }),
        createdAt: order.createdAt,
        urgent: order.status !== 'packed',
        onPress: () => openShopOrder(order.id),
      })),
  ].sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.createdAt.localeCompare(a.createdAt));

  // Every step uses the app's own blue, whatever kind it is; the icon says which kind.
  const stack: StackStep[] = steps.map((step) => ({
    key: step.key,
    icon: step.kind === 'order' ? 'store' : step.kind === 'problem' ? 'clipboard-list' : 'bolt',
    name: step.name,
    stepTitle: step.stepTitle,
    hint: step.hint,
    action: t('continueSteps.continue'),
    onPress: step.onPress,
  }));
  // At the top of Home: room below it, not above.
  return <StepStack title={t('continueSteps.title')} steps={stack} style={{ marginTop: 0, marginBottom: 18 }} />;
}
