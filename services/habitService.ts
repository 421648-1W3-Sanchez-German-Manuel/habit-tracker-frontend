import { AxiosError } from 'axios';
import { httpClient } from './httpClient';
import { ApiError } from '../types/api';
import type {
  CreateHabitLogRequest,
  CreateHabitRequest,
  Habit,
  HabitBase,
  HabitLogQuery,
  HabitLog,
  HabitStreakResponse,
  SimilarityCheckResult,
  UpdateHabitRequest,
} from '../types/habit';

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

const withDefaultStreak = (habit: HabitBase): Habit => ({
  ...habit,
  currentStreak: 0,
  lastCompletedAt: null,
});

export const habitService = {
  async getDefaultHabits(token: string): Promise<Habit[]> {
    try {
      const response = await httpClient.get<HabitBase[]>('/habits/defaults', authHeaders(token));
      return response.data.map(withDefaultStreak);
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
      const response = await httpClient.get<HabitBase[]>(`/habits/user/${userId}`, authHeaders(token));
      return response.data.map(withDefaultStreak);
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
      const response = await httpClient.post<HabitBase>('/habits', payload, authHeaders(token));
      return withDefaultStreak(response.data);
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while creating habit');
    }
  },

  async checkSimilarity(name: string, token: string): Promise<SimilarityCheckResult | null> {
    try {
      const response = await httpClient.post<SimilarityCheckResult>(
        '/habits/check-similarity',
        { name },
        authHeaders(token)
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;

        if (status === 404) {
          return null;
        }

        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while checking habit similarity');
    }
  },

  async addDefaultHabitToCurrentUser(defaultHabitId: string, token: string): Promise<Habit> {
    try {
      const response = await httpClient.post<HabitBase>(
        `/habits/defaults/${defaultHabitId}/users/me`,
        null,
        authHeaders(token)
      );
      return withDefaultStreak(response.data);
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
      const response = await httpClient.put<HabitBase>(`/habits/${habitId}`, payload, authHeaders(token));
      return withDefaultStreak(response.data);
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while updating habit');
    }
  },

  async getHabitsWithStreaks(token: string): Promise<HabitStreakResponse[]> {
    try {
      const response = await httpClient.get<HabitStreakResponse[]>('/habits/with-streaks', authHeaders(token));
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while fetching habit streaks');
    }
  },

  async createHabitLog(payload: CreateHabitLogRequest, token: string): Promise<HabitLog> {
    try {
      const response = await httpClient.post<HabitLog>('/logs', payload, authHeaders(token));
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while creating habit log');
    }
  },

  async getHabitLogs(habitId: string, token: string, query?: HabitLogQuery): Promise<HabitLog[]> {
    try {
      const response = await httpClient.get<HabitLog[]>(`/logs/habit/${habitId}`, {
        ...authHeaders(token),
        params: query,
      });
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const responseData = error.response?.data as ErrorResponseBody | undefined;
        throw new ApiError(status, getErrorMessage(status, responseData));
      }

      throw new ApiError(500, 'Unexpected error while fetching habit logs');
    }
  },
};
