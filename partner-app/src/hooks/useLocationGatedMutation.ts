import { useCallback, useRef } from 'react';
import { MutateOptions, useMutation, UseMutationOptions } from '@tanstack/react-query';
import { ensureLocationOn } from '@/utils/ensureLocationOn';
import { requireLocationNow } from '@/utils/requireLocation';

/**
 * A mutation for a partner action that needs location on (accepting a job, trip steps, shop
 * order steps…). Location is asked for FIRST — the system dialog appears before the button's
 * spinner, not under it — and only then does the action run. If location is still off, the
 * action fails at once with `LOCATION_REQUIRED`, so each screen's usual error toast says why.
 */
export function useLocationGatedMutation<TData, TVariables, TContext = unknown>(
  options: UseMutationOptions<TData, Error, TVariables, TContext> & {
    mutationFn: (variables: TVariables) => Promise<TData>;
  },
) {
  const { mutationFn } = options;
  const mutation = useMutation<TData, Error, TVariables, TContext>({
    ...options,
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
      ensureLocationOn().then(() => {
        asking.current = false;
        run(variables, mutateOptions);
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
