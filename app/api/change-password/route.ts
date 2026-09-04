import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    // 1. Tambahkan await di sini karena cookies() mengembalikan Promise di versi Next.js ini
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token");

    if (!sessionToken) {
      return NextResponse.json({ message: "Sesi tidak ditemukan, silakan login ulang." }, { status: 401 });
    }

    const { oldPassword, newPassword } = await request.json();
    const username = sessionToken.value;

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return NextResponse.json({ message: "User tidak ditemukan di database" }, { status: 404 });
    }

    if (user.password !== oldPassword) {
      return NextResponse.json({ message: "Password lama salah!" }, { status: 400 });
    }

    await prisma.user.update({
      where: { username },
      data: { password: newPassword },
    });

    return NextResponse.json({ message: "Password berhasil diubah!" }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Terjadi kesalahan pada server" }, 
      { status: 500 }
    );
  }
}