"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
export function PageQueryBridge({
  onChange,
}: {
  onChange: (params: URLSearchParams) => void;
}) {
  return (
    <Suspense fallback={null}>
      <QueryReader onChange={onChange} />
    </Suspense>
  );
}
function QueryReader({
  onChange,
}: {
  onChange: (params: URLSearchParams) => void;
}) {
  const value = useSearchParams().toString();
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      onChange(new URLSearchParams(value)),
    );
    return () => cancelAnimationFrame(frame);
  }, [value, onChange]);
  return null;
}
