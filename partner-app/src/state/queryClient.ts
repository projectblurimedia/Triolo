import { QueryClient } from '@tanstack/react-query';

/** The app's one query cache (also used outside React, e.g. right after accepting a job). */
export const queryClient = new QueryClient();
