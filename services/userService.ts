import { jwtDecode } from 'jwt-decode';
import { httpClient } from './httpClient';
import type { UserProfile } from '../types/auth';

type JwtPayload = {
  userId?: string;
  sub?: string;
  email?: string;
};

const getUserIdFromToken = (token: string): string | null => {
  try {
    const payload = jwtDecode<JwtPayload>(token);
    return payload.userId ?? payload.sub ?? null;
  } catch {
    return null;
  }
};

export const userService = {
  async getUserById(id: string, token: string): Promise<UserProfile> {
    const response = await httpClient.get<UserProfile>(`/users/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  },

  async getCurrentUserFromToken(token: string): Promise<UserProfile | null> {
    const userId = getUserIdFromToken(token);

    if (!userId) {
      return null;
    }

    try {
      return await this.getUserById(userId, token);
    } catch {
      return null;
    }
  },
};
