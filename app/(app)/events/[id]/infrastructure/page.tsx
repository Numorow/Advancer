import { redirect } from "next/navigation";
import { REGISTERS } from "@/lib/infra/registers";

export default async function InfrastructureIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/events/${id}/infrastructure/${REGISTERS[0].key}`);
}
