"use client";
import { useState, useEffect } from "react";

export default function AIKnowledgeBase() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  // ✅ 加载数据库中已有文件
  const fetchFiles = async () => {
    try {
      const res = await fetch("/api/files");
      const data = await res.json();
      setUploadedFiles(data.files || []);
    } catch {
      setUploadedFiles([]);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // ✅ 上传文件逻辑
  const handleUpload = async () => {
    if (files.length === 0) return alert("请先选择文件！");
    setUploadProgress("上传中...");

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      setUploadProgress(
        data.message || `✅ ${file.name} 上传完成（状态：${res.status}）`
      );
    }

    await fetchFiles();
    setUploadProgress("✅ 所有文件处理完成！");
  };

  // ✅ 提问逻辑
  const handleAsk = async () => {
    if (!question.trim()) {
      setAnswer("❌ 出错了：问题不能为空");
      return;
    }

    setLoading(true);
    setAnswer("⏳ 正在思考中，请稍候...");

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      setAnswer(data.answer || "资料中没有相关内容。");
    } catch (err: any) {
      setAnswer(`🚨 请求异常：${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center min-h-screen bg-gray-50 py-8 px-6">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-lg p-6 space-y-8">

        {/* 🔹 标题区 */}
        <h1 className="text-2xl font-bold text-center text-blue-600">
          📚 我的 AI 知识库系统
        </h1>

        {/* 🔹 上传区 */}
        <section className="border rounded-lg p-4 bg-gray-50">
          <h2 className="font-semibold mb-2">📁 上传文件生成 Embeddings</h2>
          <p className="text-sm text-gray-500 mb-3">
            支持单文件、多文件上传（自动去重，每次最多 5 个）
          </p>
          <input
            type="file"
            multiple
            className="block w-full border p-2 rounded-lg mb-3"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          <button
            onClick={handleUpload}
            disabled={files.length === 0}
            className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            开始上传
          </button>
          {uploadProgress && (
            <p className="text-sm mt-3 text-green-700">{uploadProgress}</p>
          )}
        </section>

        {/* 🔹 文件列表 */}
        <section className="border rounded-lg p-4 bg-gray-50">
          <h2 className="font-semibold mb-2">🗂️ 已上传文件</h2>
          {uploadedFiles.length === 0 ? (
            <p className="text-gray-400 text-sm">暂无文件，请先上传。</p>
          ) : (
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {uploadedFiles.map((file) => (
                <li key={file}>📄 {file}</li>
              ))}
            </ul>
          )}
        </section>

        {/* 🔹 提问区 */}
        <section className="border rounded-lg p-4 bg-gray-50">
          <h2 className="font-semibold mb-2">🤖 知识库问答</h2>
          <textarea
            className="w-full border rounded-lg p-3 mb-3 text-sm"
            rows={3}
            placeholder="请输入你的问题..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "Enter") handleAsk();
            }}
          />

          <button
            onClick={handleAsk}
            disabled={loading}
            className={`w-full py-2 font-bold text-white rounded-lg transition ${
              loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "思考中..." : "发送问题"}
          </button>

          <div className="mt-4">
            <p className="text-gray-800 text-sm font-semibold mb-1">回答：</p>
            <div
              className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${
                answer.startsWith("❌") || answer.startsWith("🚨")
                  ? "bg-red-50 text-red-700"
                  : answer.startsWith("⏳")
                  ? "bg-yellow-50 text-yellow-700"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {answer || "（暂无回答）"}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            💡 小贴士：按 Ctrl + Enter 快速发送问题
          </p>
        </section>
      </div>
    </main>
  );
}
