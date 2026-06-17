import useSWR from 'swr';
import { ApiResponse } from '@/types';

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'include' });
  const data = await response.json();
  return data;
};

export function useApi<T>(url: string | null, options?: { revalidateOnMount?: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<T>>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
      keepPreviousData: true,
      revalidateOnMount: options?.revalidateOnMount ?? false,
    },
  );

  const apiError = data?.success === false ? (data.error || 'An error occurred') : null;

  return {
    data: data?.success !== false ? data?.data : undefined,
    error: apiError ?? (error instanceof Error ? error.message : null),
  
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
