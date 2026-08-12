import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, assertBuildingAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/primitives";
import { PhotoThumb } from "@/components/records";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cat?: string }>;
}) {
  const { id } = await params;
  const { cat } = await searchParams;
  const user = await getSession();
  if (!user) redirect("/login");
  const building = await db.building.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      photos: {
        include: { links: true },
        orderBy: { uploadedAt: "desc" },
      },
    },
  });
  if (!building || !assertBuildingAccess(user, building)) notFound();
  const photos = building.photos.filter((p) => {
    if (user.isClient && p.visibility === "internal") return false;
    if (cat && !p.links.some((l) => l.category === cat)) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        kicker={building.buildingNumber}
        title="Building gallery"
        description="Photographs remain attached to their source records. Selecting one never replaces an earlier image."
        actions={<Link href={`/buildings/${building.id}`} className="btn btn-ghost">Back</Link>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {["", "material", "damage", "label", "before", "after", "sample_bag"].map((c) => (
          <Link key={c} href={c ? `?cat=${c}` : "?"} className={`btn ${cat === c || (!cat && !c) ? "btn-primary" : "btn-ghost"} text-xs`}>
            {c || "All"}
          </Link>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id}>
            <PhotoThumb storageKey={p.storageKey} caption={`${p.links[0]?.category || "photo"} · ${formatDate(p.capturedAt || p.uploadedAt)}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
