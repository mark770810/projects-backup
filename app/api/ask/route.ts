import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  baseURL: process.env.OPENAI_API_BASE!,
  apiKey: process.env.API2D_KEY!,
});

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    if (!question) {
      return NextResponse.json({ error: "缺少问题参数" }, { status: 400 });
    }

    // Step 1: 生成查询向量
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const queryEmbedding = embeddingRes.data[0].embedding;

    // Step 2: 从 Supabase 检索最相似的文本
    const { data: matches, error: matchError } = await supabase.rpc(
      "match_embeddings",
      {
        query_embedding: queryEmbedding,
        match_count: 3, // 返回前 3 条最相似记录
      }
    );

    if (matchError) {
      console.error("数据库查询出错：", matchError);
      return NextResponse.json({ error: "数据库查询失败" }, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ answer: "未找到相关内容。" });
    }

    // 拼接最相关的上下文内容
    const contextText = matches.map((m) => m.content).join("\n");

    // Step 3: 让 GPT 生成回答
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "你是一个知识问答助手，根据提供的文本内容回答问题，回答时尽量简洁准确。",
        },
        {
          role: "user",
          content: `已知内容：\n${contextText}\n\n请回答问题：${question}`,
        },
      ],
    });

    const answer = completion.choices[0].message?.content || "无法生成回答。";

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error("❌ 出错：", err);
    return NextResponse.json(
      { error: "请求失败", detail: err.message },
      { status: 500 }
    );
  }
}
