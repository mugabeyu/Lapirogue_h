import { Suspense } from 'react';
import ProtectedPage from '@/components/ProtectedPage';
import ReservationCalendarPage from '@/components/forms/ReservationCalendarPage';

export default function ReservationCalendarRoute() {
  return (
    <ProtectedPage>
      <Suspense fallback={<div className="p-8 text-ink-600">Loading calendar...</div>}>
        <ReservationCalendarPage />
      </Suspense>
    </ProtectedPage>
  );
}
