import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: "No ID provided" }, { status: 400 });
        }

        await prisma.transaction.delete({
            where: {
                id: id,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
    }
}
