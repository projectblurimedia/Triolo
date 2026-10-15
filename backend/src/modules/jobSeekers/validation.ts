import { z } from 'zod';
import { JOB_SEEKER_AVAILABILITIES, JOB_SEEKER_CATEGORIES, JOB_SEEKER_PAY_PERIODS } from './interfaces';

export const saveJobSeekerPostSchema = z.object({
  category: z.enum(JOB_SEEKER_CATEGORIES),
  title: z.string().trim().min(2, 'Say what work you do').max(80),
  payAmount: z.number().int('Enter a whole amount').min(1, 'Enter your expected pay').max(10_000_000),
  payPeriod: z.enum(JOB_SEEKER_PAY_PERIODS),
  availability: z.enum(JOB_SEEKER_AVAILABILITIES),
  experienceYears: z.number().int().min(0).max(60).default(0),
  skills: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
  description: z.string().trim().max(500).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationAddress: z.string().trim().min(3, 'Add your location').max(300),
});

export const setActiveSchema = z.object({ isActive: z.boolean() });

export const searchQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(50).default(25),
  category: z.enum(JOB_SEEKER_CATEGORIES).optional(),
  payPeriod: z.enum(JOB_SEEKER_PAY_PERIODS).optional(),
  availability: z.enum(JOB_SEEKER_AVAILABILITIES).optional(),
  query: z.string().trim().max(60).optional(),
  sort: z.enum(['distance', 'pay']).default('distance'),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
