import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Suppress console.error to keep test output clean
// Tests that need to verify error logging can spy on it individually
vi.spyOn(console, 'error').mockImplementation(() => {});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js cache functions
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock Next.js headers to provide a stable locale for error translations
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) => (name === 'NEXT_LOCALE' ? { value: 'en' } : undefined),
  }),
}));
