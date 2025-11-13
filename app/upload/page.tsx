"use client";
import React, { useState } from "react";

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [resultLog, setResultLog] = useState<any[]>([]);

  // ✅ 选择文件或文件夹
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  // ✅ 拖拽上传
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  // ✅ 上传逻辑
  const handleUpload = async () => {
    if (!files.length) return alert("请选择文件或文件夹后上传。");
    setUploading(true);
    setResultLog([]);
    setProgress({});
    setStatus({});

    const total = files.length;
    let completed = 0;

    for (const file of files) {
      setStatus((s) => ({ ...s, [file.name]: "上传中..." }));
      setProgress((p) => ({ ...p, [file.name]: 0 }));

      try {
        const formData = new FormData();
        formData.append("files", file);

        // 使用 XMLHttpRequest 以便监听上传进度
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/upload");
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setProgress((p) => ({ ...p, [file.name]: percent }));
            }
          };
          xhr.onload = () => {
            if (xhr.status === 200) {
              const data = JSON.parse(xhr.responseText);
              setResultLog((r) => [...r, ...data.results]);
              setStatus((s) => ({ ...s, [file.name]: "✅ 上传成功" }));
              resolve();
            } else {
              setStatus((s) => ({ ...s, [file.name]: "❌ 上传失败" }));
              reject(new Error(xhr.statusText));
            }
          };
          xhr.onerror = () => reject(new Error("网络错误"));
          xhr.send(formData);
        });

        completed++;
      } catch (err: any) {
        console.error(`文件 ${file.name} 上传失败：`, err.message);
        setStatus((s) => ({ ...s, [file.name]: `❌ 失败：${err.message}` }));
      }
    }

    setUploading(false);
    alert(`上传完成：成功 ${completed}/${total}`);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="w-full max-w-3xl border-2 border-dashed border-gray-300 rounded-2xl bg-white p-10 shadow-md text-center transition hover:border-blue-500"
      >
        <h1 className="text-2xl font-bold mb-6">📁 智能文件 / 文件夹上传</h1>

        {/* 文件选择区 */}
        <input
          type="file"
          webkitdirectory="true"
          directory="true"
          multiple
          onChange={handleFileChange}
          className="block w-full mb-4 text-sm text-gray-700"
        />

        <p className="text-gray-500 mb-6">或将文件 / 文件夹直接拖拽到此处</p>

        {/* 上传按钮 */}
        <button
          onClick={handleUpload}
          disabled={uploading}
          className={`px-6 py-2 rounded-lg font-semibold text-white transition ${
            uploading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {uploading ? "上传中..." : "开始上传"}
        </button>

        {/* 文件列表 */}
        {files.length > 0 && (
          <div className="mt-8 text-left w-full">
            <h2 className="font-semibold mb-2">📦 待上传文件（{files.length} 个）</h2>
            <ul className="space-y-2 max-h-60 overflow-auto border rounded-lg p-3 bg-gray-50">
              {files.map((file) => (
                <li
                  key={file.name}
                  className="flex flex-col border-b border-gray-200 pb-2 mb-2"
                >
                  <div className="flex justify-between">
                    <span className="font-medium text-sm text-gray-800 truncate">
                      {file.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  {/* 进度条 */}
                  <div className="w-full bg-gray-200 h-2 rounded mt-1">
                    <div
                      className="bg-blue-500 h-2 rounded transition-all"
                      style={{ width: `${progress[file.name] || 0}%` }}
                    ></div>
                  </div>

                  <p className="text-xs text-gray-600 mt-1">
                    {status[file.name] || "等待上传..."}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 上传结果 */}
        {resultLog.length > 0 && (
          <div className="mt-8 w-full text-left">
            <h2 className="font-semibold mb-2">✅ 上传结果</h2>
            <pre className="bg-gray-100 text-xs p-3 rounded-lg overflow-auto max-h-64">
              {JSON.stringify(resultLog, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
