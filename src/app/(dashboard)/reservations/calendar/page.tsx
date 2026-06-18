import { Suspense } from 'react';
import ReservationCalendarPage from '@/components/forms/ReservationCalendarPage';

export default function ReservationCalendarRoute() {
  return (
    <Suspense fallback={<div className="p-8 text-[var(--color-text-secondary)]">Loading calendar...</div>}>
      <ReservationCalendarPage />
    </Suspense>
  );
}
