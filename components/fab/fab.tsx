'use client';

import { FABDataProvider } from './fab-data-provider';
import { FABSpeedDial } from './fab-speed-dial';

export function FAB() {
  return (
    <div className="fixed bottom-20 right-4 z-40 md:hidden pb-[env(safe-area-inset-bottom)]">
      <FABDataProvider>
        <FABSpeedDial />
      </FABDataProvider>
    </div>
  );
}
