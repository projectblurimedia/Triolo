import { authService } from '@/services/authService';
import { useAuthStore } from '@/state/authStore';

/**
 * The person's name belongs to the account, so the worker, shop and job-post edit forms all
 * change the same one. Saves only when it actually changed; returns nothing to wait on twice.
 */
export async function saveAccountName(fullName: string): Promise<void> {
  const name = fullName.trim();
  const { account, setAccount } = useAuthStore.getState();
  if (!account || name.length < 2 || name === account.fullName) return;
  const updated = await authService.updateProfile({ fullName: name });
  setAccount({ ...account, ...updated });
}
