import { AxiosError } from 'axios';
import { httpClient } from './httpClient';
import { ApiError } from '../types/api';
import type { LoginRequest, LoginResponse } from '../types/auth';

type ErrorResponseBody = {
  message?: string;
  error?: string;
};

const getErrorMessage = (status: number, data?: ErrorResponseBody): string => {
  if (status === 401 || status === 403) {
    return 'Invalid email or password';
  }

  if (status >= 500) {
    return 'Something went wrong. Please try again later.';
  }

  return data?.message || data?.error || 'Request failed';
};

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await httpClient.post<LoginResponse>('/auth/login', payload);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        const message = getErrorMessage(status, responseData);
        throw new ApiError(status, message);
      }

      throw new ApiError(500, 'Unexpected error during login');
    }
  },
};
