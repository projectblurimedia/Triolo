import { useBookingOffers } from './useBookingOffers';
import { useMyJobs } from './useJobs';
import { useAssignedProblems } from './useProblems';
import { useShopOrders } from './useShopOrders';
import { useMyWorkerProfile } from './useWorkerMutations';
import { useMyBusinessProfile } from './useBusinessMutations';
import { useMyJobPosts } from './useJobPost';
import { ACTIVE_JOB_STATUSES } from '@/services/jobsService';
import { ACTIVE_SHOP_STATUSES } from '@/services/shopOrdersService';

/**
 * What needs the partner's eye, as red counts: job requests and jobs under way (Service Jobs),
 * new and in-progress shop orders (Shop Orders), and their sum (the Bookings tab icon). One
 * place, so the tab bar, Home's switch and Bookings' switches always show the same numbers.
 * Reads the same polled queries those screens already use — no extra requests.
 */
export function useAttentionCounts() {
  const workerProfile = useMyWorkerProfile();
  const businessProfile = useMyBusinessProfile();
  const isWorker = workerProfile.data?.verificationStatus === 'verified';
  const isShop = businessProfile.data?.verificationStatus === 'verified';
  const offers = useBookingOffers();
  const jobs = useMyJobs();
  const problems = useAssignedProblems(isWorker);
  const orders = useShopOrders(isShop);
  const posts = useMyJobPosts();

  const jobRequests = isWorker ? (offers.data ?? []).length : 0;
  const activeJobs = isWorker
    ? (jobs.data ?? []).filter((job) => ACTIVE_JOB_STATUSES.includes(job.status)).length +
      // A problem accepted since problems became trips is already counted as its trip.
      (problems.data ?? []).filter((problem) => !problem.bookingRequestId && problem.status !== 'completed').length
    : 0;
  const newOrders = isShop ? (orders.data ?? []).filter((order) => order.status === 'placed').length : 0;
  const activeOrders = isShop ? (orders.data ?? []).filter((order) => ACTIVE_SHOP_STATUSES.includes(order.status)).length : 0;

  // People who opened a job post since the partner last looked at its views.
  const jobPostViews = (posts.data ?? []).reduce((sum, post) => sum + (post.newViews ?? 0), 0);

  return {
    jobPostViews,
    jobRequests,
    activeJobs,
    jobs: jobRequests + activeJobs,
    newOrders,
    activeOrders,
    orders: newOrders + activeOrders,
    total: jobRequests + activeJobs + newOrders + activeOrders + jobPostViews,
  };
}
