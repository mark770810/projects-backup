export const metadata = {
  title: "AI 知识库系统",
  description: "智能问答 + 文档向量化 + 文件管理",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
