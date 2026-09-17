import { notFound } from "next/navigation";
import { AdminHub } from "./AdminHub";

// Dev-only hub (mirrors /story-map gating): 404s in production builds.
// Note: the homepage-template controls inside still write production data,
// so this stays hidden until access control is decided.
export default function AdminPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AdminHub />;
}
