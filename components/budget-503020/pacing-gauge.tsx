'use client';

import { Card, CardContent } from '@/components/ui/card';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import type { PacingData } from '@/lib/actions/budget-503020';
import { PACING_CONFIG } from '@/lib/budget-503020-config';

interface PacingGaugeProps {
  pacing: PacingData;
  daysRemaining: number;
}

export function PacingGauge({ pacing, daysRemaining }: PacingGaugeProps) {
  const config = PACING_CONFIG[pacing.status];

  const data = [
    {
      name: 'pacing',
      value: Math.min(pacing.percentageOfExpected, 150), // Cap at 150% for visual
      fill: config.hexColor,
    },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Ritmo de Gastos</h3>

          <div className="flex items-center justify-center">
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="90%"
                  data={data}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar
                    background={{ fill: '#f3f4f6' }}
                    dataKey="value"
                    cornerRadius={10}
                  />
                </RadialBarChart>
              </ResponsiveContainer>

              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: config.hexColor }}>
                  {pacing.percentageOfExpected}%
                </span>
                <span className="text-xs text-gray-600 mt-1">do esperado</span>
              </div>
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="font-medium" style={{ color: config.hexColor }}>
              {config.labelCapitalized}
            </p>
            <p className="text-sm text-gray-600">{config.description}</p>
            <p className="text-xs text-gray-500">
              {daysRemaining} dias restantes no mês
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
