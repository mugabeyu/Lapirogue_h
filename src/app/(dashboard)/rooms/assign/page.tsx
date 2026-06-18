export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import AssignRoomPage from '@/components/forms/AssignRoomPage';

export default function RoomAssignmentRoute() {
  return (
    <Suspense fallback={<div className="p-8 text-[var(--color-text-secondary)]">Loading...</div>}>
      <AssignRoomPage />
    </Suspense>
  );
}
