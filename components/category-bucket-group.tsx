'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CategoryCard } from '@/components/category-card';
import { BUCKET_CONFIG } from '@/lib/budget-503020-config';
import type { BucketType } from '@/lib/actions/budget-503020';
import type { Category } from '@/lib/schema';

type CategoryBucketGroupProps = {
  bucket: BucketType;
  categories: Category[];
  defaultOpen?: boolean;
};

export function CategoryBucketGroup({
  bucket,
  categories,
  defaultOpen = false,
}: CategoryBucketGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const config = BUCKET_CONFIG[bucket];
  const Icon = config.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-none border bg-card">
        {/* Header */}
        <CollapsibleTrigger
          className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors touch-action-manipulation min-h-11"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Bucket icon */}
            <div className={`p-2 rounded-none shrink-0`}>
              <HugeiconsIcon icon={Icon} className={config.color} size={18} />
            </div>

            {/* Bucket label and count */}
            <div className="flex items-center gap-2 flex-1">
              <span className="font-medium text-sm">{config.label}</span>
              <span className="text-xs text-muted-foreground">
                {categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}
              </span>
            </div>

            {/* Chevron */}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={20}
              className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </CollapsibleTrigger>

        {/* Content */}
        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-3">
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                Nenhuma categoria neste grupo ainda
              </p>
            ) : (
              categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
