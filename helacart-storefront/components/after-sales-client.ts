"use client";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { useShop } from "./shop-provider";
export function useBuyerAfterSalesRequest() {
  const { user } = useShop();
  return useCallback(
    async function request<T>(
      path: string,
      method = "GET",
      body?: unknown,
    ): Promise<T> {
      if (!user) throw Error("Sign in to use support and returns");
      return api<T>(path, { method, body, token: await user.getIdToken() });
    },
    [user],
  );
}
