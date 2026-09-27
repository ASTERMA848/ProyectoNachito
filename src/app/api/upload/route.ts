import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Extensiones de imagen permitidas
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"];
// Magic bytes para validar el tipo real del archivo
const MAGIC_BYTES: Record<string, string[]> = {
  ".jpg": ["ffd8ff"],
  ".jpeg": ["ffd8ff"],
  ".png": ["89504e47"],
  ".gif": ["47494638"],
  ".webp": ["52494646"],
  ".avif": [], // AVIF varía, confiar en extensión + content-type como segundo check
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function getHexSignature(buffer: Buffer, bytes: number): string {
  return buffer.subarray(0, bytes).toString("hex");
}

function validateMagicBytes(buffer: Buffer, ext: string): boolean {
  const magics = MAGIC_BYTES[ext];
  if (!magics || magics.length === 0) return true; // Sin magic registrado, aceptar
  const hex = getHexSignature(buffer, 8);
  return magics.some((magic) => hex.startsWith(magic));
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("sessionToken")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se encontró ningún archivo" }, { status: 400 });
    }

    // Validar tamaño
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "El archivo supera el tamaño máximo de 5 MB" },
        { status: 400 }
      );
    }

    // Validar content-type declarado
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "El archivo debe ser una imagen" },
        { status: 400 }
      );
    }

    // Extraer y validar extensión del nombre original
    const originalExt = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(originalExt)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Solo se aceptan imágenes (jpg, png, gif, webp, avif)." },
        { status: 400 }
      );
    }

    // Leer bytes y validar magic bytes (firma real del archivo)
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytes(buffer, originalExt)) {
      return NextResponse.json(
        { error: "El archivo no es una imagen válida." },
        { status: 400 }
      );
    }

    // Generar nombre interno seguro — nunca usar el nombre original
    const uniqueId = crypto.randomUUID();
    const safeFilename = `profile-${session.user.id}-${uniqueId}${originalExt}`;

    // Resolver ruta — prevenir path traversal
    const uploadDir = path.resolve(process.cwd(), "public", "uploads", "profiles");
    const filepath = path.resolve(uploadDir, safeFilename);

    // Verificar que el path resultante sigue dentro del directorio permitido
    if (!filepath.startsWith(uploadDir)) {
      return NextResponse.json({ error: "Ruta inválida." }, { status: 400 });
    }

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(filepath, buffer);

    const fileUrl = `/uploads/profiles/${safeFilename}`;
    return NextResponse.json({ url: fileUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}
