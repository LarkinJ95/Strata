import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth";

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await ctx.params;
  const rel = key.join("/");
  if (rel.includes("..")) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const candidates = [
    path.join(process.cwd(), "public", rel),
    path.join(process.cwd(), "uploads", rel),
    path.join(process.cwd(), rel),
  ];
  const file = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
