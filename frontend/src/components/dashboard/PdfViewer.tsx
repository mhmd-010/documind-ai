"use client";

import { useState } from "react";
import {
  ExternalLink,
  FileText,
  LoaderCircle,
  X,
} from "lucide-react";

type PdfViewerProps = {
  documentId: string;
  filename: string;
  onClose: () => void;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export default function PdfViewer({
  documentId,
  filename,
  onClose,
}: PdfViewerProps) {
  const [loadedDocumentId, setLoadedDocumentId] =
    useState<string | null>(null);

  const pdfUrl = `${API_URL}/documents/${encodeURIComponent(
    documentId
  )}/pdf`;

  const loading = loadedDocumentId !== documentId;

  return (
    <section className="flex h-full min-h-[650px] flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#101426]">
      {/* Viewer header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-300">
            <FileText size={20} />
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">
              PDF Viewer
            </h2>

            <p
              className="truncate text-xs text-slate-400"
              title={filename}
            >
              {filename}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open PDF in new tab"
            title="Open PDF in new tab"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <ExternalLink size={17} />
          </a>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close PDF viewer"
            title="Close PDF viewer"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* PDF content */}
      <div className="relative min-h-[550px] flex-1 bg-[#090D1D]">
        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-400">
            <LoaderCircle
              size={18}
              className="animate-spin text-violet-300"
            />
            Loading PDF...
          </div>
        )}

        <iframe
          key={documentId}
          src={pdfUrl}
          title={`PDF document: ${filename}`}
          className="relative h-full min-h-[550px] w-full border-0"
          onLoad={() => setLoadedDocumentId(documentId)}
        />
      </div>
    </section>
  );
}