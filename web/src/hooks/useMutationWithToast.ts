import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToastStore, type ToastType } from "../stores/toastStore";

interface Options<TData, TVariables, TContext> {
  successMessage?: string;
  errorMessage?: string;
  successType?: ToastType;
  errorType?: ToastType;
  invalidateKeys?: string[][];
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
  onError?: (error: unknown, variables: TVariables, context: TContext) => void;
}

export function useMutationWithToast<TVariables = void, TData = unknown, TContext = unknown>(
  mutationFn: (vars: TVariables) => Promise<TData>,
  options: Options<TData, TVariables, TContext> = {},
) {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();
  const { successMessage, errorMessage, successType = "success", errorType = "error", invalidateKeys, onSuccess, onError } = options;

  return useMutation({
    mutationFn,
    onSuccess: (data, variables, context) => {
      if (successMessage) addToast(successType, successMessage);
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      }
      onSuccess?.(data, variables, context as TContext);
    },
    onError: (error, variables, context) => {
      const msg = errorMessage || (error instanceof Error ? error.message : "Có lỗi xảy ra");
      addToast(errorType, msg);
      onError?.(error, variables, context as TContext);
    },
  });
}
