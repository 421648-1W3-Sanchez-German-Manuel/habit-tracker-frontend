import { AxiosError } from 'axios';
import { httpClient } from './httpClient';
import { ApiError } from '../types/api';
import type { CreateHabitRequest, Habit, UpdateHabitRequest } from '../types/habit';

type ErrorResponseBody = {
  message?: string;
  error?: string;
};

const getErrorMessage = (status: number, data?: ErrorResponseBody): string => {
  if (status === 401 || status === 403) {
    return 'You are not authorized to perform this action.';
  }

  if (status >= 500) {
    return 'Something went wrong. Please try again later.';
  }

  return data?.message || data?.error || 'Request failed';
};

const authHeaders = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const habitService = {
  async getDefaultHabits(token: string): Promise<Habit[]> {
    try {
      const response = await httpClient.get<Habit[]>('/habits/defaults', authHeaders(token));
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while fetching default habits');
    }
  },

  async getUserHabits(userId: string, token: string): Promise<Habit[]> {
    try {
      const response = await httpClient.get<Habit[]>(`/habits/user/${userId}`, authHeaders(token));
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while fetching your habits');
    }
  },

  async createHabit(payload: CreateHabitRequest, token: string): Promise<Habit> {
    try {
      const response = await httpClient.post<Habit>('/habits', payload, authHeaders(token));
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while creating habit');
    }
  },

  async addDefaultHabitToCurrentUser(defaultHabitId: string, token: string): Promise<Habit> {
    try {
      const response = await httpClient.post<Habit>(
        `/habits/defaults/${defaultHabitId}/users/me`,
        null,
        authHeaders(token)
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while adding default habit');
    }
  },

  async deleteHabit(habitId: string, token: string): Promise<void> {
    try {
      await httpClient.delete(`/habits/${habitId}`, authHeaders(token));
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while deleting habit');
    }
  },

  async updateHabit(habitId: string, payload: UpdateHabitRequest, token: string): Promise<Habit> {
    try {
      const response = await httpClient.put<Habit>(`/habits/${habitId}`, payload, authHeaders(token));
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while updating habit');
    }
  },
};
