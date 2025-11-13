export default function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px",
        background: "linear-gradient(135deg, #f0f4ff 0%, #e8faff 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* 大标题 */}
      <h1
        style={{
          fontSize: "42px",
          fontWeight: "800",
          background: "linear-gradient(90deg,#0070f3,#7928ca)",
          WebkitBackgroundClip: "text",
          color: "transparent",
          marginBottom: "20px",
          textAlign: "center",
        }}
      >
        AI 知识库系统
      </h1>

      <p
        style={{
          fontSize: "18px",
          color: "#444",
          marginBottom: "45px",
          textAlign: "center",
        }}
      >
        让文档变成可问答的智能知识库系统  
        <br />
        选择一个功能开始使用 ↓
      </p>

      {/* 三大功能入口 */}
      <div
        style={{
          display: "flex",
          gap: "30px",
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "900px",
        }}
      >
        {/* 上传文件 */}
        <a
          href="/upload"
          style={{
            width: "260px",
            padding: "25px",
            borderRadius: "16px",
            background: "white",
            boxShadow:
              "0 4px 15px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)",
            textDecoration: "none",
            color: "#111",
            transition: "0.2s",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0" }}>📤 上传文档</h3>
          <p style={{ margin: 0, color: "#777" }}>
            支持 TXT / PDF / Markdown 内容，一键自动拆段 + 生成向量。
          </p>
        </a>

        {/* AI 问答 */}
        <a
          href="/dashboard"
          style={{
            width: "260px",
            padding: "25px",
            borderRadius: "16px",
            background: "white",
            boxShadow:
              "0 4px 15px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)",
            textDecoration: "none",
            color: "#111",
            transition: "0.2s",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0" }}>💡 知识库问答</h3>
          <p style={{ margin: 0, color: "#777" }}>
            输入问题，AI 将从知识库中搜索并给出专业回答。
          </p>
        </a>

        {/* 文件管理 */}
        <a
          href="/files"
          style={{
            width: "260px",
            padding: "25px",
            borderRadius: "16px",
            background: "white",
            boxShadow:
              "0 4px 15px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)",
            textDecoration: "none",
            color: "#111",
            transition: "0.2s",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0" }}>📁 文件管理</h3>
          <p style={{ margin: 0, color: "#777" }}>
            查看所有已向量化的文档，支持查看记录与重新上传。
          </p>
        </a>
      </div>

      <footer
        style={{
          marginTop: "60px",
          fontSize: "14px",
          color: "#666",
        }}
      >
        © {new Date().getFullYear()} AI 知识库系统 · Vercel
      </footer>
    </div>
  );
}
