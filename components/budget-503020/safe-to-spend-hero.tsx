import { Card, CardContent } from '@/components/ui/card';
import { centsToDisplay } from '@/lib/utils';
import type { SafeToSpendData } from '@/lib/actions/budget-503020';
import { PACING_CONFIG } from '@/lib/budget-503020-config';

interface SafeToSpendHeroProps {
  data: SafeToSpendData;
}

export function SafeToSpendHero({ data }: SafeToSpendHeroProps) {
  const wantsBucket = data.buckets.find((b) => b.bucket === 'wants');
  const pacingConfig = PACING_CONFIG[data.pacing.status];

  if (!wantsBucket) return null;

  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Hero number */}
          <div>
            <p className="text-sm text-gray-600 mb-1">Disponível para Gastar</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900">
                R$ {centsToDisplay(data.wantsSafeToSpendDaily)}
              </span>
              <span className="text-lg text-gray-600">/ dia</span>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">R$ {centsToDisplay(data.wantsSafeToSpend)}</span>
              {' '}restante em Desejos
            </div>
            <div>•</div>
            <div>
              <span className="font-medium">{data.daysRemaining}</span>
              {' '}dias restantes
            </div>
          </div>

          {/* Pacing indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${pacingConfig.bgColor}`}>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${pacingConfig.color}`}>
                  {pacingConfig.label}
                </span>
                <span className="text-xs text-gray-600">
                  {data.pacing.percentageOfExpected}%
                </span>
              </div>
              <div className="h-2 bg-white rounded-full overflow-hidden">
                <div
                  className={`h-full ${pacingConfig.barColor} transition-all`}
                  style={{ width: `${Math.min(data.pacing.percentageOfExpected, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
