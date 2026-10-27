import { useCallback, useRef } from 'react';
import { MutateOptions, useMutation, UseMutationOptions } from '@tanstack/react-query';
import { ensureLocationOn } from '@/utils/ensureLocationOn';
import { requireLocationNow } from '@/utils/requireLocation';
import { payIfNeeded } from '@/state/payGateStore';
import { PartnerPlan, PassKind } from '@/services/subscriptionsService';

/**
 * A mutation for a partner action that needs location on (accepting a job, trip steps, shop
 * order steps…). Location is asked for FIRST — the system dialog appears before the button's
 * spinner, not under it — and only then does the action run. If location is still off, the
 * action fails at once with `LOCATION_REQUIRED`, so each screen's usual error toast says why.
 */
export function useLocationGatedMutation<TData, TVariables, TContext = unknown>(
  options: UseMutationOptions<TData, Error, TVariables, TContext> & {
    mutationFn: (variables: TVariables) => Promise<TData>;
    /** Without a partner plan this action is paid for once (the admin's fee) — asked after location. */
    payKind?: PassKind;
    /** Which side's plan makes it free (services for jobs, shop for orders). */
    payPlan?: PartnerPlan;
  },
) {
  const { mutationFn, payKind, payPlan, ...mutationOptions } = options;
  const mutation = useMutation<TData, Error, TVariables, TContext>({
    ...mutationOptions,
    // A quick check with no dialog: the dialog was already shown by `mutate` below.
    mutationFn: async (variables) => {
      await requireLocationNow();
      return mutationFn(variables);
    },
  });
  const asking = useRef(false);
  const { mutate: run, mutateAsync: runAsync } = mutation;

  const mutate = useCallback(
    (variables: TVariables, mutateOptions?: MutateOptions<TData, Error, TVariables, TContext>) => {
      if (asking.current) return;
      asking.current = true;
      ensureLocationOn()
        .then(async () => (payKind ? payIfNeeded(payKind, null, payPlan) : true))
        .then((go) => {
          asking.current = false;
          if (go) run(variables, mutateOptions);
        });
    },
    [run],
  );

  const mutateAsync = useCallback(
    async (variables: TVariables, mutateOptions?: MutateOptions<TData, Error, TVariables, TContext>) => {
      await ensureLocationOn();
      return runAsync(variables, mutateOptions);
    },
    [runAsync],
  );

  return { ...mutation, mutate, mutateAsync };
}
