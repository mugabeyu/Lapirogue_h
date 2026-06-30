'use client';

import { RoomAssignmentBoard } from '@/components/board/RoomAssignmentBoard';
import { PageHeader } from '@/components/PageHeader';

export default function RoomBoardPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Room Assignment Board"
        subtitle="Drag and drop arriving guests onto available rooms to check them in."
      />
      <RoomAssignmentBoard />
    </div>
  );
}
