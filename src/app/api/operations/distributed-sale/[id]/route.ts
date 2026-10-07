import { NextRequest } from "next/server";
import { handleDistributedSale } from "@/lib/distributed-sale-request";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return handleDistributedSale(req, params.id);
}
