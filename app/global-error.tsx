"use client";

// Last resort when the root layout itself fails. It replaces the layout, so it brings its own <html> and <body>.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", color: "#0f172a" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 440 }}>
            <h1 style={{ fontSize: 20 }}>แสดงข้อมูลไม่สำเร็จ · Could not show the data</h1>
            <p>
              ตรวจสอบประกาศอย่างเป็นทางการที่ <a href="https://www.tmd.go.th">tmd.go.th</a> · Check official announcements at{" "}
              <a href="https://www.tmd.go.th">tmd.go.th</a>
            </p>
            <button type="button" onClick={() => retry()} style={{ minHeight: 44, padding: "8px 16px", fontSize: 16 }}>
              ลองใหม่ · Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
