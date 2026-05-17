import useSWR from 'swr';
import { ApiResponse } from '@/types';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  return data;
};

export function useApi<T>(url: string) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<T>>(
    url,
    fetcher
  );

  return {
    data: data?.data,
    error,
    isLoading,
    mutate,
    success: data?.success ?? false,
  };
}

export function useApiMutation(url: string) {
  const mutate = async (body: unknown, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST') => {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    return response.json();
  };

  return { mutate };
}
