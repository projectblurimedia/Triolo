import { ReviewsService, shortName } from './service';
import { WorkersService } from '@/modules/workers/service';
import { BookingsService } from '@/modules/bookings/service';
import { ProblemsService } from '@/modules/problems/service';
import { BusinessesService } from '@/modules/businesses/service';
import { OrdersService } from '@/modules/orders/service';

let workers: jest.Mocked<WorkersService>;
let bookings: jest.Mocked<BookingsService>;
let problems: jest.Mocked<ProblemsService>;
let businesses: jest.Mocked<BusinessesService>;
let orders: jest.Mocked<OrdersService>;
let service: ReviewsService;

beforeEach(() => {
  workers = { getPublicProfile: jest.fn(), getMyProfile: jest.fn() } as unknown as jest.Mocked<WorkersService>;
  bookings = { listRatedJobsForWorker: jest.fn() } as unknown as jest.Mocked<BookingsService>;
  problems = { listRatedJobsForWorker: jest.fn() } as unknown as jest.Mocked<ProblemsService>;
  businesses = { getPublicProfile: jest.fn(), getMyProfile: jest.fn() } as unknown as jest.Mocked<BusinessesService>;
  orders = { listRatedOrdersForBusiness: jest.fn() } as unknown as jest.Mocked<OrdersService>;
  service = new ReviewsService(workers, bookings, problems, businesses, orders);
});

describe('shortName', () => {
  it('keeps only the first name and last initial', () => {
    expect(shortName('Ravi Kumar')).toBe('Ravi K.');
    expect(shortName('  Sita  Rama  lakshmi ')).toBe('Sita L.');
    expect(shortName('Ravi')).toBe('Ravi');
  });
});

describe('getForWorker', () => {
  it('merges trip and older problem reviews newest first, with a star breakdown', async () => {
    workers.getPublicProfile.mockResolvedValue({ id: 'worker-1', ratingAverage: 4.3, ratingCount: 3 } as never);
    bookings.listRatedJobsForWorker.mockResolvedValue([
      { rating: 5, review: 'Great', customerFullName: 'Ravi Kumar', skillCategories: ['plumber'], completedAt: new Date('2026-10-10') },
      { rating: 4, review: null, customerFullName: 'Anil', skillCategories: ['plumber'], completedAt: new Date('2026-10-01') },
    ]);
    problems.listRatedJobsForWorker.mockResolvedValue([
      { rating: 4, review: 'Neat', customerFullName: 'Sita Devi', skillCategories: ['electrician'], completedAt: new Date('2026-10-05') },
    ]);

    const summary = await service.getForWorker('worker-1');

    expect(summary.ratingAverage).toBe(4.3);
    expect(summary.distribution).toEqual([0, 0, 0, 2, 1]);
    expect(summary.reviews.map((review) => review.customerName)).toEqual(['Ravi K.', 'Sita D.', 'Anil']);
  });

  it('404s for an unknown worker', async () => {
    workers.getPublicProfile.mockResolvedValue(null);
    await expect(service.getForWorker('nope')).rejects.toMatchObject({ code: 'WORKER_PROFILE_NOT_FOUND' });
  });
});

describe('getForBusiness', () => {
  it("lists a shop's rated orders with a star breakdown", async () => {
    businesses.getPublicProfile.mockResolvedValue({ id: 'shop-1', ratingAverage: 4.5, ratingCount: 2 } as never);
    orders.listRatedOrdersForBusiness.mockResolvedValue([
      { rating: 5, review: 'Fresh items', customerFullName: 'Lakshmi Devi', completedAt: new Date('2026-10-10') },
      { rating: 4, review: null, customerFullName: 'Ravi', completedAt: new Date('2026-10-11') },
    ]);

    const summary = await service.getForBusiness('shop-1');

    expect(summary.distribution).toEqual([0, 0, 0, 1, 1]);
    expect(summary.reviews.map((review) => review.customerName)).toEqual(['Ravi', 'Lakshmi D.']);
  });
});
