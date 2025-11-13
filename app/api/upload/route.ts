// ✅ 指定 Node.js 运行环境（防止 Edge Runtime 报错）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// ✅ 初始化 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ 初始化 OpenAI(API2D) 客户端
const openai = new OpenAI({
  apiKey: process.env.API2D_KEY!,
  baseURL: process.env.OPENAI_API_BASE || "https://api.api2d.net",
});

// ✅ 文件上传与分段向量化
export async function POST(req: Request) {
  console.log("🚀 [上传流程启动] 正在执行智能分段 + 向量生成...");

  try {
    // 1️⃣ 解析上传文件
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "未检测到文件" }, { status: 400 });

    const fileName = file.name?.trim() || "未命名文件";
    const text = await file.text();
    const cleanText = text.replace(/\r/g, "").trim();
    if (!cleanText) return NextResponse.json({ error: "文件为空" }, { status: 400 });

    console.log(`📄 上传文件：${fileName}`);

    // 2️⃣ 检查是否重复导入
    const { data: existing } = await supabase
      .from("embeddings")
      .select("id")
      .eq("file_name", fileName)
      .limit(1);

    if (existing?.length) {
      console.warn(`⚠️ 文件 ${fileName} 已存在，跳过写入。`);
      return NextResponse.json({
        message: `文件 ${fileName} 已存在，跳过重新生成。`,
        status: "skipped",
        fileName,
      });
    }

    // 3️⃣ 智能语义分段逻辑
    const lines = cleanText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    let chunks: string[] = [];
    let buffer: string[] = [];

    for (const line of lines) {
      // 遇到“姓名 / 王飞 / Person / Name”等关键字时换段
      if (/^(姓名|Name|编号|员工|客户|人员|记录|档案|Person|王飞)/.test(line) && buffer.length > 0) {
        chunks.push(buffer.join("，"));
        buffer = [line];
      } else {
        buffer.push(line);
      }
    }
    if (buffer.length > 0) chunks.push(buffer.join("，"));

    // 防止单段过长（超出 token 限制）
    chunks = chunks.flatMap((chunk) =>
      chunk.length > 900 ? chunk.match(/.{1,900}/g) || [] : [chunk]
    );

    console.log(`✂️ 智能分段完成：共 ${chunks.length} 段`);

    // 4️⃣ 初始化执行参数
    const start = Date.now();
    let successCount = 0;
    const failed: string[] = [];
    const concurrency = 4; // 并发控制
    const maxRetries = 3; // 每段最多重试3次

    // 5️⃣ 定义分段处理逻辑
    async function processChunk(chunk: string, index: number, attempt = 1): Promise<void> {
      try {
        const embeddingRes = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunk,
        });
        const embedding = embeddingRes.data[0].embedding;

        const { error } = await supabase.from("embeddings").insert({
          content: chunk,
          embedding,
          file_name: fileName,
        });

        if (error) throw new Error(error.message);
        successCount++;
        console.log(`✅ 第 ${index + 1}/${chunks.length} 段成功 (${chunk.length} 字)`);
      } catch (err: any) {
        console.warn(`⚠️ 第 ${index + 1} 段失败（第 ${attempt} 次尝试）：`, err.message);
        if (attempt < maxRetries) {
          console.log(`🔁 正在重试第 ${index + 1} 段...`);
          await new Promise((r) => setTimeout(r, 800 * attempt));
          return processChunk(chunk, index, attempt + 1);
        } else {
          failed.push(`第${index + 1}段：${err.message}`);
        }
      }
    }

    // 6️⃣ 控制并发执行
    for (let i = 0; i < chunks.length; i += concurrency) {
      const group = chunks.slice(i, i + concurrency);
      await Promise.all(group.map((chunk, j) => processChunk(chunk, i + j)));
    }

    // 7️⃣ 统计与日志
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    const avg = (Number(duration) / chunks.length).toFixed(2);

    const logData = {
      file_name: fileName,
      total_chunks: chunks.length,
      success_chunks: successCount,
      failed_chunks: failed.length,
      duration_seconds: duration,
      avg_seconds_per_chunk: avg,
      status:
        failed.length === 0
          ? "success"
          : failed.length < chunks.length
          ? "partial"
          : "failed",
      failed_segments: failed.length > 0 ? failed.slice(0, 5) : null,
    };

    const { error: logError } = await supabase.from("upload_logs").insert(logData);
    if (logError)
      console.error("⚠️ 上传日志写入失败：", logError.message);
    else console.log("🧾 上传日志记录成功：", logData);

    // 8️⃣ 返回执行结果
    if (failed.length > 0) {
      return NextResponse.json(
        {
          message: `部分成功：${successCount}/${chunks.length} 段完成（耗时 ${duration}s，平均 ${avg}s/段）`,
          failed_count: failed.length,
          fileName,
        },
        { status: 206 }
      );
    }

    return NextResponse.json({
      message: `✅ 上传成功！共生成 ${successCount} 条记录（耗时 ${duration}s，平均 ${avg}s/段）`,
      fileName,
    });
  } catch (err: any) {
    console.error("🚨 上传异常:", err.message);
    return NextResponse.json(
      { error: `上传失败：${err.message}` },
      { status: 500 }
    );
  }
}

// ✅ CORS 支持（兼容 Postman / Web / curl 请求）
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}
