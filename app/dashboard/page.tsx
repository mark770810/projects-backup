"use client";
import { useState, useCallback, useEffect, useRef } from "react";

const MAX_TOTAL_FILES = 200;
const MAX_FILE_SIZE_MB = 20;
const CONCURRENCY = 5;
const MAX_REQUEST_SIZE_MB = 20;

export default function Dashboard() {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [fileList, setFileList] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const logBoxRef = useRef<HTMLDivElement>(null);

  // ============ 自动滚动日志 ============
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  // ============ 拖拽文件夹处理 ============
  const handleDirectoryFiles = async (entry: any, path = ""): Promise<File[]> => {
    let results: File[] = [];
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => entry.file(resolve));
      results.push(new File([file], path + file.name));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries: any[] = await new Promise((res) => reader.readEntries(res));
      for (const e of entries) {
        const child = await handleDirectoryFiles(e, `${path}${entry.name}/`);
        results = results.concat(child);
      }
    }
    return results;
  };

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    let allFiles: File[] = [];

    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        const folderFiles = await handleDirectoryFiles(entry);
        allFiles = allFiles.concat(folderFiles);
      } else {
        const file = item.getAsFile();
        if (file) allFiles.push(file);
      }
    }

    if (allFiles.length > MAX_TOTAL_FILES) {
      alert(`⚠️ 一次最多上传 ${MAX_TOTAL_FILES} 个文件，请分批上传。`);
      return;
    }

    setFiles(allFiles);
    setLogs((prev) => [...prev, `📁 检测到 ${allFiles.length} 个文件，准备上传...`]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > MAX_TOTAL_FILES) {
      alert(`⚠️ 一次最多上传 ${MAX_TOTAL_FILES} 个文件，请分批上传。`);
      return;
    }
    setFiles(selected);
    setLogs((prev) => [...prev, `📂 选择了 ${selected.length} 个文件，准备上传...`]);
  };

  // ============ 上传逻辑（含进度条） ============
  const handleUpload = async () => {
    if (files.length === 0) return alert("请先选择文件");

    const oversized = files.find((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized) {
      alert(`文件 "${oversized.name}" 超出 ${MAX_FILE_SIZE_MB}MB 限制`);
      return;
    }

    setUploading(true);
    setProgress({});
    setLogs((prev) => [...prev, "🚀 开始上传..."]);

    let index = 0;
    const failed: string[] = [];

    const uploadChunk = async (file: File) => {
      return new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", file);

        if (file.size > MAX_REQUEST_SIZE_MB * 1024 * 1024) {
          setLogs((prev) => [
            ...prev,
            `⚠️ ${file.name} 超过单请求体 ${MAX_REQUEST_SIZE_MB}MB 限制，跳过。`,
          ]);
          resolve();
          return;
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress((prev) => ({ ...prev, [file.name]: percent }));
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            setLogs((prev) => [...prev, `✅ ${file.name} 上传成功`]);
          } else {
            failed.push(file.name);
            setLogs((prev) => [
              ...prev,
              `❌ ${file.name} 上传失败 (${xhr.status})`,
            ]);
          }
          resolve();
        };

        xhr.onerror = () => {
          failed.push(file.name);
          setLogs((prev) => [...prev, `❌ ${file.name} 网络错误`]);
          resolve();
        };

        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });
    };

    // 并发上传控制
    const runBatch = async () => {
      while (index < files.length) {
        const batch = files.slice(index, index + CONCURRENCY);
        await Promise.all(batch.map(uploadChunk));
        index += CONCURRENCY;
      }
    };

    await runBatch();
    setUploading(false);
    refreshFiles();

    if (failed.length > 0) {
      setLogs((prev) => [...prev, `⚠️ 上传完成，但 ${failed.length} 个失败：${failed.join(", ")}`]);
    } else {
      setLogs((prev) => [...prev, "🎉 全部文件上传成功！"]);
    }
  };

  // ============ 文件列表 ============
  const refreshFiles = async () => {
    const res = await fetch("/api/files");
    const data = await res.json();
    if (Array.isArray(data)) setFileList(data.map((f: any) => f.file_name));
  };
  useEffect(() => {
    refreshFiles();
  }, []);

  // ============ 问答功能 ============
  const handleAsk = async () => {
    if (!question.trim()) return setAnswer("❌ 出错了：问题不能为空");
    setAnswer("⏳ 正在思考中...");
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAnswer(data.answer || "（暂无相关内容）");
    } catch (err: any) {
      setAnswer(`🚨 请求异常：${err.message}`);
    }
  };

  // ============ 页面结构 ============
  return (
    <main className="flex flex-col min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-center mb-6 text-blue-700">
        🤖 AI 知识库中控台
      </h1>

      <div className="grid grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        {/* 上传区 */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="col-span-1 bg-white shadow-md rounded-xl p-4 border border-gray-300 hover:border-blue-400 transition"
        >
          <h2 className="text-lg font-semibold mb-3">📤 文件上传</h2>
          <input
            type="file"
            multiple
            webkitdirectory="true"
            onChange={handleFileSelect}
            className="hidden"
            id="fileInput"
          />
          <label
            htmlFor="fileInput"
            className={`block text-center py-2 rounded-lg cursor-pointer font-semibold ${
              uploading
                ? "bg-gray-400 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {uploading ? "上传中..." : "点击选择文件或文件夹"}
          </label>

          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className={`mt-3 w-full py-2 rounded-lg text-white font-bold ${
              uploading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {uploading ? "正在上传..." : "开始上传"}
          </button>

          {/* 上传进度 */}
          {Object.keys(progress).length > 0 && (
            <div className="mt-4">
              {Object.entries(progress).map(([name, percent]) => (
                <div key={name} className="mb-2 text-sm">
                  <div className="flex justify-between">
                    <span>{name}</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            ref={logBoxRef}
            className="mt-4 bg-gray-100 rounded-lg p-2 h-48 overflow-auto text-sm font-mono whitespace-pre-wrap"
          >
            {logs.length === 0 ? "📄 暂无上传日志" : logs.join("\n")}
          </div>
        </div>

        {/* 文件列表 */}
        <div className="col-span-1 bg-white shadow-md rounded-xl p-4 border border-gray-300">
          <h2 className="text-lg font-semibold mb-3">📚 已上传文件</h2>
          <button
            onClick={refreshFiles}
            className="mb-2 text-sm text-blue-600 hover:underline"
          >
            🔄 刷新列表
          </button>
          <div className="bg-gray-100 rounded-lg p-3 h-64 overflow-auto text-sm">
            {fileList.length === 0
              ? "暂无文件"
              : fileList.map((f, i) => (
                  <div key={i} className="border-b border-gray-200 py-1">
                    📄 {f}
                  </div>
                ))}
          </div>
        </div>

        {/* 问答区 */}
        <div className="col-span-1 bg-white shadow-md rounded-xl p-4 border border-gray-300">
          <h2 className="text-lg font-semibold mb-3">💬 知识库问答</h2>
          <textarea
            rows={3}
            className="w-full border rounded-lg p-2 mb-2 text-sm"
            placeholder="请输入你的问题..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            onClick={handleAsk}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
          >
            发送问题
          </button>
          <div className="mt-4 bg-gray-100 rounded-lg p-3 h-64 overflow-auto text-sm whitespace-pre-wrap">
            {answer || "（暂无回答）"}
          </div>
        </div>
      </div>
    </main>
  );
}
