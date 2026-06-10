import { NavLink } from "@/components/nav-link";
import { REGISTERS } from "@/lib/infra/registers";

export default async function InfrastructureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = `/events/${id}/infrastructure`;
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Infrastructure</h1>
      <nav className="flex flex-wrap gap-1 border-b pb-2">
        <NavLink href={base} exact>
          Overview
        </NavLink>
        {REGISTERS.map((r) => (
          <NavLink key={r.key} href={`${base}/${r.key}`}>
            {r.title}
          </NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}
