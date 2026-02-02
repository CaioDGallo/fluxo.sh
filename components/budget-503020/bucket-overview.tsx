import { BucketCard } from './bucket-card';
import type { BucketData } from '@/lib/actions/budget-503020';

interface BucketOverviewProps {
  buckets: BucketData[];
}

export function BucketOverview({ buckets }: BucketOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {buckets.map((bucket) => (
        <BucketCard key={bucket.bucket} bucket={bucket} />
      ))}
    </div>
  );
}
