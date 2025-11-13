import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 强制此 API 为动态路由，避免被 Next.js 静态优化导致构建失败（Vercel 404）
 */
export const dynamic = "force-dynamic";

/**
 * 统一创建 Supabase 客户端
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

/**
 * 检查 Supabase 中是否存在相同文件名
 */
export async function GET(req: Request) {
  try {
    // 防止 URL 构造异常
    const url = new URL(req.url);
    const fileName = url.searchParams.get("name");

    if (!fileName || fileName.trim() === "") {
      return NextResponse.json(
        { error: "缺少文件名参数 name" },
        { status: 400 }
      );
    }

    // 查询数据库（模糊匹配）
    const { data, error } = await supabase
      .from("embeddings")
      .select("id")
      .ilike("file_name", `%${fileName}%`)
      .limit(1);

    if (error) {
      console.error("🔴 Supabase 查询错误:", error);
      throw new Error("数据库查询失败");
    }

    const exists = !!(data && data.length > 0);

    return NextResponse.json({ exists });
  } catch (err: any) {
    console.error("❌ 检查文件出错:", err?.message || err);
    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}
