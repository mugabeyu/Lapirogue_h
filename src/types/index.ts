export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface Guest {
  id: string;
  guestId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  nationality?: string;
  passport?: string;
  dateOfBirth?: string;
  vip: boolean;
  status: GuestStatus;
  notes?: string;
  imagePath?: string;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  isAvailable: boolean;
  imagePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  position: string;
  email?: string;
  phone?: string;
  status: string;
  imagePath?: string;
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
}

export interface Payment {
  id: string;
  paymentId: string;
  reservationId: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface FoodOrder {
  id: string;
  orderId: string;
  roomId?: string;
  guestId?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  notes?: string;
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

export type Role = 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'RESTAURANT' | 'TOUR_MANAGER' | 'STAFF';

export type GuestStatus = 'RESERVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

export type RoomType = 'STANDARD' | 'DELUXE' | 'SUITE' | 'VILLA';

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';

export type ReservationStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'ONLINE';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export type ActivityStatus = 'ACTIVE' | 'INACTIVE' | 'FULL';

export type OrderStatus = 'PENDING' | 'PREPARING' | 'SERVED' | 'CANCELLED';