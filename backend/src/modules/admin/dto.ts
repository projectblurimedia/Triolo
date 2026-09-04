import { VerificationDecision } from './interfaces';

export interface SetVerificationStatusDto {
  status: VerificationDecision;
}

export interface ListQueryDto {
  status?: 'pending_verification' | 'verified' | 'rejected';
  page: number;
  limit: number;
}
