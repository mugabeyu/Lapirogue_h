export type GuestRow = {
  id: string;
  guest_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  passport: string | null;
  date_of_birth: string | null;
  vip: boolean;
  status: string;
  notes: string | null;
  image_path: string | null;
  fcm_token: string | null;
  auth_id: string | null;
  temporary_password: string | null;
  is_temp_password_changed: boolean;
  created_at: string;
  updated_at: string;
};

export function toGuest(row: GuestRow) {
  return {
    id: row.id,
    guestId: row.guest_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    nationality: row.nationality ?? undefined,
    passport: row.passport ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    vip: row.vip,
    status: row.status,
    notes: row.notes ?? undefined,
    imagePath: row.image_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}