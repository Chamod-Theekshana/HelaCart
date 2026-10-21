import { OrderConfirmation } from "@/components/order-confirmation";
export default async function OrderSuccessPage({ searchParams }: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  return <OrderConfirmation orderId={orderId ?? ""} />;
}
