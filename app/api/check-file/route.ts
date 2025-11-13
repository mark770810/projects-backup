import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 检查 Supabase 中是否存在相同文件名的记录
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("name");

    if (!fileName) {
      return NextResponse.json({ error: "缺少文件名参数" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("embeddings")
      .select("id")
      .ilike("file_name", `%${fileName}%`)
      .limit(1);

    if (error) throw error;

    const exists = data && data.length > 0;

    return NextResponse.json({ exists });
  } catch (err: any) {
    console.error("❌ 检查文件出错:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
