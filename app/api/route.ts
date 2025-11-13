import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// ✅ 初始化 OpenAI(API2D) 客户端
const openai = new OpenAI({
  apiKey: process.env.API2D_KEY!,
  baseURL: process.env.OPENAI_API_BASE || "https://api.api2d.net",
});

// ✅ 初始化 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ 主逻辑入口
export async function POST(req: Request) {
  console.log("🔍 [API] 向量入库接口启动中...");

  try {
    const { text, file_id } = await req.json();

    // 参数校验
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "缺少文本内容，无法生成 Embedding。" },
        { status: 400 }
      );
    }

    // 环境变量检测
    const requiredVars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      OPENAI_API_BASE: process.env.OPENAI_API_BASE,
      API2D_KEY: process.env.API2D_KEY,
    };
    for (const [key, val] of Object.entries(requiredVars)) {
      if (!val) console.error(`❌ 缺失环境变量: ${key}`);
      else console.log(`✅ ${key} 已加载`);
    }

    // 1️⃣ 生成文本的向量 Embedding
    console.log(`🧠 正在生成向量...`);
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    const embedding = embeddingResponse.data[0]?.embedding;
    if (!embedding) {
      throw new Error("生成向量失败，返回为空。");
    }

    console.log(`✅ 向量生成成功 (${embedding.length} 维)`);

    // 2️⃣ 写入 Supabase 数据库
    console.log(`💾 正在写入数据库...`);
    const { error } = await supabase.from("embeddings").insert({
      file_id: file_id || null,
      content: text.trim(),
      embedding,
    });

    if (error) {
      console.error("❌ 写入数据库失败:", error.message);
      throw error;
    }

    console.log(`✅ 向量已成功写入 Supabase！`);

    // 3️⃣ 返回结果
    return NextResponse.json({
      success: true,
      message: "文本已成功生成向量并存储。",
    });
  } catch (err: any) {
    console.error("🚨 向量入库出错:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
