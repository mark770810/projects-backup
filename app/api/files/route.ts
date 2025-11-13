/** 强制 API 永远动态执行，避免被 Next.js 当成静态页面生成 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** Supabase 服务器端客户端：使用 Service Role Key，只能在后端调用 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("embeddings")
      .select("file_name")
      .not("file_name", "is", null);

    if (error) throw error;

    // 去重
    const files = [...new Set(data.map((d) => d.file_name))];

    return NextResponse.json({
      count: files.length,
      files,
    });
  } catch (err: any) {
    console.error("❌ 查询文件列表失败:", err);
    return NextResponse.json(
      { error: `查询失败：${err.message}` },
      { status: 500 }
    );
  }
}
