"use client";

import { useEffect, useRef, useState } from "react";

export function DropFileInput({
  name,
  accept,
  capture,
  resetToken,
  label = "Drop a file here or click to browse",
}: {
  name: string;
  accept?: string;
  capture?: "environment" | "user";
  resetToken?: number;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState("");

  useEffect(() => {
    if (input.current) input.current.value = "";
    setFilename("");
  }, [resetToken]);

  function select(files: FileList | null) {
    const file = files?.[0];
    setFilename(file?.name || "");
  }

  return (
    <label
      className={`block cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${dragging ? "border-teal bg-teal/10" : "border-[rgba(16,36,72,0.16)] bg-paper/50 hover:border-teal/60 hover:bg-teal/5"}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = event.dataTransfer.files;
        if (!files.length || !input.current) return;
        input.current.files = files;
        select(files);
      }}
    >
      <input ref={input} name={name} type="file" accept={accept} capture={capture} className="sr-only" required onChange={(event) => select(event.target.files)} />
      <div className="font-medium text-teal-dim">{filename || label}</div>
      <div className="mt-1 text-xs text-ink-3">{filename ? "Click or drop another file to replace it" : "Files up to 25 MB"}</div>
    </label>
  );
}
