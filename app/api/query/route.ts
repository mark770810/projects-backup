/**
 * 🚀 强制：不要静态化，不要运行在 Edge runtime！
 * 这是一个 RAG + 向量检索 API，必须在 Node.js 下运行。
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

/** 🤖 OpenAI / API2D 客户端 */
const openai = new OpenAI({
  apiKey: process.env.API2D_KEY ?? "",
  baseURL: process.env.OPENAI_API_BASE || "https://api.api2d.net",
});

/** 🧠 主逻辑：向量匹配 + RAG 问答 */
export async function POST(req: Request) {
  console.log("🔵 [QUERY API] 执行向量检索 + 智能回答...");

  try {
    // 🔍 用 req.text 解析可以避免中文乱码
    const raw = await req.text();
    const body = JSON.parse(raw);

    const { question, threshold = 0.3, topK = 5 } = body || {};

    if (!question?.trim()) {
      return NextResponse.json({ error: "问题不能为空" }, { status: 400 });
    }

    console.log("❓ 问题：", question);
    console.log("🎯 阈值:", threshold, " | topK:", topK);

    /** 1️⃣ 创建 Embedding */
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });

    const queryEmbedding = embeddingRes.data[0]?.embedding;
    if (!queryEmbedding) {
      throw new Error("向量生成失败，请检查 API Key 或模型。");
    }

    /** 2️⃣ 调用 Supabase 的向量匹配 */
    let { data: matches, error: matchError } = await supabase.rpc(
      "match_documents",
      {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: topK,
      }
    );

    if (matchError) {
      console.error("❌ 向量匹配失败:", matchError);
      throw new Error(matchError.message);
    }

    /** 3️⃣ 若无匹配，则降低阈值后重试 */
    if (!matches?.length) {
      console.log("⚠️ 无匹配，降低 threshold=0.15 并扩大 topK 重试...");
      const retry = await supabase.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_threshold: 0.15,
        match_count: topK * 2,
      });
      matches = retry.data || [];
    }

    /** 4️⃣ 若仍无数据 */
    if (!matches?.length) {
      return NextResponse.json({
        question,
        answer: "资料中没有相关内容。",
        matches: [],
      });
    }

    /** 5️⃣ 拼接上下文（控制最大长度） */
    const context = matches
      .map((m) => m.content)
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 4000);

    console.log(`📚 命中 ${matches.length} 条内容，开始生成答案...`);

    /** 6️⃣ 调用 GPT（API2D / OpenAI）生成回答 */
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "你是一个中文知识库问答助手，请基于提供的上下文回答问题，不要编造。如果找不到答案，请回答：'资料中没有相关内容。'",
        },
        {
          role: "user",
          content: `问题：${question}\n\n资料内容：\n${context}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 512,
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() ||
      "资料中没有相关内容。";

    /** 7️⃣ 写入查询日志（可选） */
    try {
      const logData = {
        question,
        matched_count: matches.length,
        threshold,
        top_k: topK,
        answer_preview: answer.slice(0, 120),
        timestamp: new Date().toISOString(),
      };

      const { error: logErr } = await supabase
        .from("query_logs")
        .insert(logData);

      if (logErr) {
        console.warn("⚠️ 日志写入失败:", logErr.message);
      } else {
        console.log("🧾 日志写入成功");
      }
    } catch (err: any) {
      console.warn("⚠️ 日志写入异常:", err.message);
    }

    /** 8️⃣ 返回结果 */
    return NextResponse.json({
      question,
      answer,
      matches: matches.map((m) => ({
        file: m.file_name,
        similarity: m.similarity?.toFixed(3),
        preview: m.content?.slice(0, 100),
      })),
    });
  } catch (err: any) {
    console.error("🚨 [QUERY API ERROR]:", err);
    return NextResponse.json(
      { error: `问答失败：${err.message}` },
      { status: 500 }
    );
  }
}

/** 🟡 OPTIONS 处理 CORS 预检 */
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
