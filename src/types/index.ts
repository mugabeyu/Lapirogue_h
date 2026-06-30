export type Role = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST';

export type GuestAccountStatus = 'PENDING' | 'ACTIVE' | 'FROZEN' | 'BANNED';

export type GuestStatus = 'RESERVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

export type ReservationStatus = 'RESERVED' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';

export type RoomType = 'STANDARD' | 'DELUXE' | 'SUITE' | 'VILLA';

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'ONLINE';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PAID' | 'PARTIALLY_PAID';

export type ActivityStatus = 'ACTIVE' | 'INACTIVE' | 'FULL';

export type OrderStatus = 'PENDING' | 'PREPARING' | 'SERVED' | 'CANCELLED';

export type OrderOrigin = 'MOBILE_APP' | 'RECEPTION_DESK' | 'MANAGER_PORTAL';

export type ScheduleItemType = 'RESERVATION' | 'ACTIVITY' | 'BOOKING' | 'ORDER' | 'SERVICE' | 'CUSTOM';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  homeAddress?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Manager {
  id: string;
  managerId: string;
  authId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  homeAddress?: string;
  departmentId?: string;
  departmentName?: string;
  dateOfJoining: string;
  isActive: boolean;
  imagePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Receptionist {
  id: string;
  employeeCode: string;
  authId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  homeAddress?: string;
  departmentId?: string;
  departmentName?: string;
  managerId?: string;
  managerName?: string;
  dateOfJoining: string;
  isActive: boolean;
  imagePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Guest {
  id: string;
  guestId: string;
  authId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  nationality?: string;
  passport?: string;
  dateOfBirth?: string;
  vip: boolean;
  status: GuestStatus;
  accountStatus: GuestAccountStatus;
  homeAddress?: string;
  notes?: string;
  imagePath?: string;
  createdAt: string;
  updatedAt: string;
  checkIn?: string;
  checkOut?: string;
  roomNumber?: string | null;
  roomType?: string | null;
}

export interface GuestStay {
  id: string;
  reservationId: string;
  roomId?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  status: string;
  totalAmount: number;
  notes?: string | null;
  roomNumber: string | null;
  roomType: string | null;
}

export interface GuestProfileData {
  guest: Guest;
  currentStay: GuestStay | null;
  reservations: GuestStay[];
  activityBookings: Array<{
    id: string;
    activity: string | null;
    amount?: number;
    date: string;
    participants: number;
    status: string;
    notes?: string | null;
  }>;
  foodOrders: Array<{
    id: string;
    orderId: string;
    subtotal?: number;
    serviceCharge?: number;
    taxAmount?: number;
    total: number;
    status: string;
    notes?: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    paymentId: string;
    amount: number;
    method: string;
    status: string;
    reference?: string | null;
    createdAt: string;
  }>;
  stats: {
    totalStays: number;
    activities: number;
    foodOrders: number;
    totalSpent: number;
    balanceDue: number;
  };
  billingSummary?: {
    totalCharges: number;
    totalPaid: number;
    balanceDue: number;
    status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
    totals: Record<string, number>;
    items: Array<{
      category: string;
      label: string;
      amount: number;
      sourceId?: string;
      createdAt?: string | null;
    }>;
  };
}

export interface Room {
  id: string;
  roomNumber: string;
  type: RoomType;
  floor?: string;
  capacity: number;
  price: number;
  status: RoomStatus;
  description?: string;
  amenities: string[];
  imagePath?: string;
  imagePaths?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  preparationMinutes?: number | null;
  isAvailable: boolean;
  imagePath?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  reservationId: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  totalAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  guest?: Guest;
  room?: Room;
  origin?: OrderOrigin;
}

export interface Payment {
  id: string;
  paymentId: string;
  reservationId?: string;
  guestId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  duration: number;
  capacity: number;
  status: ActivityStatus;
  imagePath?: string;
  meeting_point?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FoodOrder {
  id: string;
  orderId: string;
  guestId?: string;
  roomId?: string;
  guestImagePath?: string | null;
  items: OrderItem[];
  subtotal?: number;
  serviceCharge?: number;
  taxAmount?: number;
  total: number;
  status: OrderStatus;
  origin: OrderOrigin;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuestScheduleItem {
  id: string;
  guestId: string;
  title: string;
  itemType: ScheduleItemType;
  sourceModule?: string;
  sourceRecordId?: string;
  startAt: string;
  endAt: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface AuthContext {
  user: User;
  token: string;
}

export interface SustainabilityActivity {
  id: string;
  name: string;
  category: string;
  color: string;
  defaultPoints: number;
  carbonOffsetKg: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DbRole {
  id: string;
  name: string;
  description?: string;
  permissions?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EcaTier {
  id: string;
  name: string;
  minPoints: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GuestEcoPointEvent {
  id: string;
  guestId: string;
  activityId: string;
  activityName?: string;
  sourceType: 'ACTIVITY_BOOKING' | 'SERVICE_REQUEST' | 'MANUAL';
  sourceRecordId: string;
  sourceLabel?: string;
  points: number;
  carbonOffsetKg: number;
  metadata?: Record<string, unknown>;
  earnedAt: string;
  createdAt: string;
}

export interface EcoPointsBalance {
  id: string;
  guestId: string;
  balance: number;
  tier: string;
  updatedAt: string;
}

export interface EcoPointsTx {
  id: string;
  guestId: string;
  amount: number;
  type: 'EARN' | 'SPEND' | 'ADJUST';
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  reference?: string;
  notes?: string;
  createdAt: string;
}
