import { Suspense } from 'react';
import ProtectedPage from '@/components/ProtectedPage';
import AssignRoomPage from '@/components/forms/AssignRoomPage';

export default function RoomAssignmentRoute() {
  return (
    <ProtectedPage>
      <Suspense fallback={<div className="p-8 text-ink-600">Loading...</div>}>
        <AssignRoomPage />
      </Suspense>
    </ProtectedPage>
  );
}
