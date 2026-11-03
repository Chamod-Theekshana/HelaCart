import type { Notification } from "./types";
export function notificationHref(
  notice: Notification,
  workspace: "buyer" | "seller" | "admin" = "buyer",
) {
  if (
    notice.href?.startsWith("/") &&
    !notice.href.startsWith("//") &&
    !/[\\\r\n]/.test(notice.href)
  )
    return notice.href;
  if (notice.type?.startsWith("COMMISSION_"))
    return workspace === "admin" ? "/admin/commission" : "/seller/commission";
  if (notice.type?.startsWith("RETURN_"))
    return workspace === "admin"
      ? "/admin/returns"
      : workspace === "seller"
        ? "/seller/orders"
        : "/account/returns";
  return workspace === "seller"
    ? "/seller/orders"
    : workspace === "admin"
      ? "/admin/orders"
      : "/orders";
}
