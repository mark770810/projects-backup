/**
 * 让该 API 永远以动态方式运行，避免被 Next.js 静态优化
 * 并强制使用 Node.js 运行环境（Supabase + OpenAI 需要 Node 环境）
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Supabase（必须使用服务端 Key 且只在 Node 环境下运行）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: {
      persistSession: false,
    },
  }
);

// API2D / OpenAI 客户端
const openai = new OpenAI({
  baseURL: process.env.OPENAI_API_BASE ?? "",
  apiKey: process.env.API2D_KEY ?? "",
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = body?.question;

    if (!question || question.trim() === "") {
      return NextResponse.json({ error: "缺少问题参数 question" }, { status: 400 });
    }

    // Step 1: 生成查询向量（Embedding）
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });

    const queryEmbedding = embeddingRes.data[0].embedding;

    // Step 2: 查询 Supabase 向量相似度
    const { data: matches, error: matchError } = await supabase.rpc(
      "match_embeddings",
      {
        query_embedding: queryEmbedding,
        match_count: 3,
      }
    );

    if (matchError) {
      console.error("🔴 Supabase 向量查询出错:", matchError);
      return NextResponse.json({ error: "数据库查询失败" }, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ answer: "未找到相关内容。" });
    }

    // 拼接最相关内容
    const contextText = matches.map((m) => m.content).join("\n");

    // Step 3: 调用 GPT（API2D）
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "你是一个知识库问答助手，根据给定的上下文回答问题。回答要简洁准确，不要编造内容。",
        },
        {
          role: "user",
          content: `已知内容：\n${contextText}\n\n请回答问题：${question}`,
        },
      ],
    });

    const answer =
      completion.choices[0].message?.content ?? "无法生成回答。";

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error("❌ ask API 出错：", err);
    return NextResponse.json(
      {
        error: "服务器内部错误",
        detail: err?.message ?? err,
      },
      { status: 500 }
    );
  }
}
