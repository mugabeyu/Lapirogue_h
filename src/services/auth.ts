import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JwtPayload {
	userId: string;
	email: string;
	role: Role;
}

export type Role = 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'RESTAURANT' | 'TOUR_MANAGER' | 'STAFF';

export function generateToken(user: User): string {
	const payload: JwtPayload = {
		userId: user.id,
		email: user.email,
		role: user.role,
	};
  
	return jwt.sign(payload as JwtPayload, JWT_SECRET as Secret, { expiresIn: JWT_EXPIRES_IN } as SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
		return decoded;
	} catch {
		return null;
	}
}

export function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
	return bcrypt.compare(password, hashedPassword);
}

export function getTokenFromHeader(authHeader?: string): string | null {
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}
	return authHeader.substring(7);
}


