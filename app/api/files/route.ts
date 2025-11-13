import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("embeddings")
      .select("file_name")
      .not("file_name", "is", null);

    if (error) throw error;

    const files = [...new Set(data.map((d) => d.file_name))];

    return NextResponse.json({
      count: files.length,
      files,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `查询失败：${err.message}` },
      { status: 500 }
    );
  }
}
