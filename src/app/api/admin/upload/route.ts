import { NextResponse } from "next/server";
import { handler, ApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/session";
import { saveImage, UploadError } from "@/services/storage";

/** POST /api/admin/upload — multipart com campo "file"; retorna { url } */
export const POST = handler(async (req) => {
  await requireAdmin();

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Envie o arquivo no campo 'file'");

  try {
    const url = await saveImage(file);
    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) throw new ApiError(400, err.message);
    throw err;
  }
});
