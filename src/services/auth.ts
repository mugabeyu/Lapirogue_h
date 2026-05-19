import bcrypt from 'bcrypt';

export function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
	return bcrypt.compare(password, hashedPassword);
}




