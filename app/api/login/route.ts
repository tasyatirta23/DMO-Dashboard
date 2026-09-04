import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.password !== password) {
      return NextResponse.json(
        { message: "Username atau password salah!" },
        { status: 401 }
      );
    }

    // Buat response sukses terlebih dahulu
    const response = NextResponse.json(
      { 
        message: "Login berhasil!", 
        user: { username: user.username, role: user.role } 
      },
      { status: 200 }
    );

    // Set cookie langsung di response-nya (paling aman & kompatibel)
    response.cookies.set({
      name: "session_token",
      value: user.username,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 hari
    });

    return response;

  } catch (error: any) {
    console.error("DETAIL ERRORNYA:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan pada server: " + error.message },
      { status: 500 }
    );
  }
}