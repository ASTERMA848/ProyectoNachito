import { NextRequest } from "next/server";
import { handleDistributedSale } from "@/lib/distributed-sale-request";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleDistributedSale(req);
}
