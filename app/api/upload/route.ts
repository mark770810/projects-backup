/**
 * 🚀 强制使用 Node.js Runtime（Supabase + OpenAI 必须）
 * 🚀 强制 Dynamic（避免 Next.js 静态优化导致 404）
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

/** 🔐 Supabase（服务端）客户端 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: {
      persistSession: false,
    },
  }
);

/** 🤖 OpenAI（API2D）客户端 */
const openai = new OpenAI({
  apiKey: process.env.API2D_KEY ?? "",
  baseURL: process.env.OPENAI_API_BASE || "https://api.api2d.net",
});

/**
 * 📤 文件上传 + 分段解析 + 向量生成
 */
export async function POST(req: Request) {
  console.log("🚀 [UPLOAD API] 开始智能分段 + 向量生成流程...");

  try {
    /** 1️⃣ 解析文件（form-data） */
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "未检测到文件" }, { status: 400 });
    }

    const fileName = file.name?.trim() || "未命名文件";

    console.log(`📄 收到文件: ${fileName}`);

    const text = (await file.text()).replace(/\r/g, "").trim();
    if (!text) {
      return NextResponse.json({ error: "文件为空" }, { status: 400 });
    }

    /** 2️⃣ 检查 Supabase 是否已有相同文件 */
    const { data: existing } = await supabase
      .from("embeddings")
      .select("id")
      .eq("file_name", fileName)
      .limit(1);

    if (existing?.length) {
      return NextResponse.json({
        message: `文件 ${fileName} 已存在，跳过处理。`,
        status: "skipped",
      });
    }

    /** 3️⃣ 智能分段逻辑（根据你的需求保留） */
    const rawLines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    let chunks: string[] = [];
    let buffer: string[] = [];

    for (const line of rawLines) {
      // 遇到明显字段时切段
      if (/^(姓名|Name|编号|员工|客户|人员|记录|档案|Person|王飞)/.test(line)) {
        if (buffer.length) chunks.push(buffer.join("，"));
        buffer = [line];
      } else {
        buffer.push(line);
      }
    }
    if (buffer.length) chunks.push(buffer.join("，"));

    // 超长段落切割
    chunks = chunks.flatMap((c) =>
      c.length > 900 ? c.match(/.{1,900}/g) || [] : [c]
    );

    console.log(`✂️ 分段完成：共 ${chunks.length} 段`);

    /** 4️⃣ 并发 + 重试逻辑 */
    const start = Date.now();
    let successCount = 0;
    const failed: string[] = [];

    const concurrency = 3; // ⚠️ 调低并发，让 Vercel 不会 CPU 爆掉
    const maxRetries = 3;

    async function processChunk(chunk: string, index: number, attempt = 1): Promise<void> {
      try {
        // 生成 embedding
        const embRes = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunk,
        });

        const embedding = embRes.data[0]?.embedding;

        if (!embedding) throw new Error("向量生成失败");

        // 写入数据库
        const { error: dbErr } = await supabase.from("embeddings").insert({
          content: chunk,
          embedding,
          file_name: fileName,
        });

        if (dbErr) throw new Error(dbErr.message);

        successCount++;
        console.log(`✅ 段落 ${index + 1}/${chunks.length} 完成`);
      } catch (err: any) {
        console.warn(`⚠️ 段落 ${index + 1} 失败（尝试 ${attempt}）：`, err.message);

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * 700));
          return processChunk(chunk, index, attempt + 1);
        }

        failed.push(`第 ${index + 1} 段：${err.message}`);
      }
    }

    /** 5️⃣ 控制并发执行 */
    for (let i = 0; i < chunks.length; i += concurrency) {
      const group = chunks.slice(i, i + concurrency);
      await Promise.all(
        group.map((chunk, j) => processChunk(chunk, i + j))
      );
    }

    /** 6️⃣ 统计耗时 */
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    const avg = (Number(duration) / chunks.length).toFixed(2);

    /** 7️⃣ 写入日志 upload_logs */
    const logData = {
      file_name: fileName,
      total_chunks: chunks.length,
      success_chunks: successCount,
      failed_chunks: failed.length,
      duration_seconds: duration,
      avg_seconds_per_chunk: avg,
      failed_segments: failed.length ? failed.slice(0, 5) : null,
      status:
        failed.length === 0
          ? "success"
          : failed.length < chunks.length
          ? "partial"
          : "failed",
      timestamp: new Date().toISOString(),
    };

    await supabase.from("upload_logs").insert(logData).catch(() => {});

    /** 8️⃣ 返回上传结果 */
    if (failed.length) {
      return NextResponse.json(
        {
          message: `部分成功：${successCount}/${chunks.length}（耗时 ${duration}s）`,
          fileName,
          failed,
        },
        { status: 206 }
      );
    }

    return NextResponse.json({
      message: `上传成功：共 ${successCount} 段（耗时 ${duration}s）`,
      fileName,
    });
  } catch (err: any) {
    console.error("🚨 [UPLOAD ERROR]:", err);
    return NextResponse.json(
      { error: `上传失败：${err.message}` },
      { status: 500 }
    );
  }
}

/** 🟡 CORS 预检 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
