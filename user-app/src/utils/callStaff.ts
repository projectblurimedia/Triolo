import { JobSeeker, jobSeekersService } from '@/services/jobSeekersService';
import { payIfNeeded } from '@/state/payGateStore';
import { callPhone } from './tripLinks';

/**
 * Calls a job seeker. Without a plan their number is hidden until paid for once (the admin's
 * fee); then it's fetched, called, and handed to `onUnlocked` so the screen can show it.
 */
export async function callStaff(person: Pick<JobSeeker, 'id' | 'mobileNumber'>, onUnlocked?: (mobileNumber: string) => void) {
  if (person.mobileNumber) {
    callPhone(person.mobileNumber);
    return;
  }
  if (!(await payIfNeeded('staff_contact', person.id))) return;
  const fresh = await jobSeekersService.getPublic(person.id);
  if (fresh.mobileNumber) {
    onUnlocked?.(fresh.mobileNumber);
    callPhone(fresh.mobileNumber);
  }
}
