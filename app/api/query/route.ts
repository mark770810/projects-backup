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

// ✅ 主逻辑：根据问题匹配向量并生成回答
export async function POST(req: Request) {
  console.log("💬 [问答流程启动] 正在执行向量匹配 + 智能中文回答生成...");

  try {
    // ✅ 解码请求体（防止中文乱码）
    const raw = await req.text();
    const body = JSON.parse(raw);
    const { question, threshold = 0.3, topK = 5 } = body;

    if (!question?.trim()) {
      console.warn("⚠️ 接收到空问题");
      return NextResponse.json({ error: "问题不能为空" }, { status: 400 });
    }

    console.log(`🧠 收到问题: ${question}`);
    console.log(`🎯 匹配阈值: ${threshold} | 返回数量: ${topK}`);

    // 1️⃣ 生成问题的向量 Embedding
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const queryEmbedding = embeddingRes.data[0]?.embedding;

    if (!queryEmbedding) {
      throw new Error("向量生成失败，请检查 OpenAI API Key 或模型设置。");
    }

    // 2️⃣ 调用数据库向量匹配函数（与你 Supabase 中定义的函数一致）
    let { data: matches, error: matchError } = await supabase.rpc(
      "match_documents", // ✅ 修正函数名
      {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: topK,
      }
    );

    if (matchError) {
      console.error("❌ 向量匹配失败：", matchError.message);
      throw new Error(`向量匹配失败：${matchError.message}`);
    }

    // 3️⃣ 若无结果则自动降低阈值重试
    if (!matches?.length) {
      console.warn("⚠️ 未找到匹配内容，自动降低阈值至 0.15 重试...");
      const retry = await supabase.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_threshold: 0.15,
        match_count: topK * 2,
      });
      matches = retry.data || [];
    }

    // 4️⃣ 若仍无匹配，返回提示
    if (!matches?.length) {
      console.warn("⚠️ 数据库无匹配结果。");
      return NextResponse.json({
        question,
        answer: "资料中没有相关内容。",
        matches: [],
      });
    }

    // 5️⃣ 拼接上下文内容
    const context = matches
      .map((m) => m.content)
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 4000); // 限制 token 长度

    console.log(`📚 命中 ${matches.length} 条内容，开始生成回答...`);

    // 6️⃣ 调用模型生成中文回答
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "你是一个中文知识问答助手，请基于提供的上下文回答问题，不要编造。如果找不到答案，请回答：'资料中没有相关内容。'",
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

    // 7️⃣ 写入查询日志（可选表 query_logs）
    try {
      const logData = {
        question,
        matched_count: matches.length,
        threshold,
        top_k: topK,
        answer_preview: answer.slice(0, 120),
        timestamp: new Date().toISOString(),
      };

      const { error: logError } = await supabase
        .from("query_logs")
        .insert(logData);

      if (logError)
        console.warn("⚠️ 查询日志写入失败：", logError.message);
      else console.log("🧾 查询日志成功：", logData);
    } catch (logErr: any) {
      console.warn("⚠️ 查询日志异常：", logErr.message);
    }

    // 8️⃣ 返回结果给前端
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
    console.error("🚨 问答接口异常：", err.message);
    return NextResponse.json(
      { error: `问答失败：${err.message}` },
      { status: 500 }
    );
  }
}

// ✅ 跨域支持（允许前端 fetch 请求）
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
