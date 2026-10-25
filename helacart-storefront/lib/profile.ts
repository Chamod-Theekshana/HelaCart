export type AccountProfile = {
  id: string;
  firebaseUid: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  hasPhoto: boolean;
  photoVersion: number;
  createdAt: string;
  updatedAt: string;
};

export const previewAccount: AccountProfile = {
  id: "preview-buyer", firebaseUid: "preview-buyer", name: "Kasun Perera",
  email: "kasun@example.com", emailVerified: true, phone: "+94 77 123 4567",
  hasPhoto: false, photoVersion: 0,
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-21T00:00:00.000Z",
};

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "HC";
}
