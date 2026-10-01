"use client";

// A failure while rendering the dashboard must not leave a flood tool on a blank or generic error page.
// The language is not known here (it comes from the URL on the server), so both are shown.
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-white p-6 text-slate-900">
      <div className="max-w-md space-y-4">
        <h1 className="text-balance text-xl font-bold">
          แสดงข้อมูลไม่สำเร็จ <span className="font-normal text-slate-700">· Could not show the data</span>
        </h1>
        <p className="text-slate-800">
          เกิดข้อผิดพลาดชั่วคราว ลองใหม่อีกครั้ง หากยังไม่ได้ โปรดตรวจสอบประกาศอย่างเป็นทางการที่{" "}
          <a className="underline" href="https://www.tmd.go.th">tmd.go.th</a>
        </p>
        <p className="text-slate-700">
          A temporary error occurred. Try again, and if it persists check official announcements at{" "}
          <a className="underline" href="https://www.tmd.go.th">tmd.go.th</a>.
        </p>
        <button type="button" onClick={() => retry()} className="min-h-11 rounded-lg bg-sky-700 px-4 py-2 font-medium text-white hover:bg-sky-800">
          ลองใหม่ · Try again
        </button>
      </div>
    </main>
  );
}
