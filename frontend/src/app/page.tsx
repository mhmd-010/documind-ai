
"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type DocumentInfo = {
  document_id: string;
  filename: string;
  pages: number;
  chunks: number;
};

type Source = {
  document_id: string;
  page_number: number;
  chunk_id: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const SELECTED_DOCUMENT_KEY = "documind_selected_document";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState("");
  const [documentToDelete, setDocumentToDelete] =
    useState<DocumentInfo | null>(null);
  const [error, setError] = useState("");

  // Track the currently active document to prevent stale
  // network responses from displaying another PDF's chat.
  const activeDocumentRef = useRef("");
  const chatRequestRef = useRef(0);

  // STEP 1: Load documents and restore the last selection.
  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      try {
        const response = await fetch(`${API_URL}/documents`);

        if (!response.ok) {
          throw new Error(
            `Failed to load documents (${response.status})`
          );
        }

        const data: { documents: DocumentInfo[] } =
          await response.json();

        if (cancelled) return;

        const savedDocuments = data.documents ?? [];
        setDocuments(savedDocuments);

        const previousDocumentId =
          localStorage.getItem(SELECTED_DOCUMENT_KEY);

        if (
          previousDocumentId &&
          savedDocuments.some(
            (document) =>
              document.document_id === previousDocumentId
          )
        ) {
          selectDocument(previousDocumentId);
        } else {
          localStorage.removeItem(SELECTED_DOCUMENT_KEY);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load documents."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingDocuments(false);
        }
      }
    }

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, []);

  // STEP 2: Retrieve saved SQLite messages for one PDF.
  async function loadChatHistory(documentId: string) {
    const requestId = ++chatRequestRef.current;

    setLoadingMessages(true);

    try {
      const response = await fetch(
        `${API_URL}/documents/${encodeURIComponent(
          documentId
        )}/messages`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to load chat history (${response.status})`
        );
      }

      const data: { messages: ChatMessage[] } =
        await response.json();

      // Ignore responses belonging to a document that
      // is no longer selected.
      if (
        requestId !== chatRequestRef.current ||
        activeDocumentRef.current !== documentId
      ) {
        return;
      }

      setMessages(data.messages ?? []);
    } catch (err) {
      if (
        requestId === chatRequestRef.current &&
        activeDocumentRef.current === documentId
      ) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load chat history."
        );
      }
    } finally {
      if (requestId === chatRequestRef.current) {
        setLoadingMessages(false);
      }
    }
  }

  // STEP 3: Select a document and restore its conversation.
  function selectDocument(documentId: string) {
    if (answering || deletingDocumentId) return;

    activeDocumentRef.current = documentId;

    setSelectedDocumentId(documentId);
    setMessages([]);
    setQuestion("");
    setError("");

    localStorage.setItem(
      SELECTED_DOCUMENT_KEY,
      documentId
    );

    void loadChatHistory(documentId);
  }

  // STEP 4: Upload and index a PDF.
  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("The maximum PDF size is 10 MB.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_URL}/documents/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        let detail = `Upload failed (${response.status})`;

        try {
          const errorData = await response.json();

          if (typeof errorData.detail === "string") {
            detail = errorData.detail;
          }
        } catch {
          // Keep the default error message.
        }

        throw new Error(detail);
      }

      const data: DocumentInfo = await response.json();

      setDocuments((previous) => [
        ...previous.filter(
          (document) =>
            document.document_id !== data.document_id
        ),
        data,
      ]);

      selectDocument(data.document_id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed."
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // STEP 5: Ask a question and show the saved response.
  async function handleAsk(event: React.FormEvent) {
    event.preventDefault();

    const currentQuestion = question.trim();
    const documentId = selectedDocumentId;

    if (
      !currentQuestion ||
      !documentId ||
      answering ||
      loadingMessages ||
      deletingDocumentId
    ) {
      return;
    }

    setError("");
    setAnswering(true);
    setQuestion("");

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: currentQuestion,
      },
    ]);

    try {
      const response = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: currentQuestion,
          top_k: 3,
          document_id: documentId,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Question answering failed (${response.status})`
        );
      }

      const data: {
        answer: string;
        sources: Source[];
      } = await response.json();

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources ?? [],
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate an answer."
      );

      // Reload saved history so an unsuccessful request
      // does not leave an unsaved user message in the chat.
      await loadChatHistory(documentId);

      setQuestion(currentQuestion);
    } finally {
      setAnswering(false);
    }
  }

  // STEP 6: Permanently delete a PDF and its chat history.
  async function handleDeleteDocument() {
    if (!documentToDelete || deletingDocumentId || answering) {
      return;
    }

    const documentId = documentToDelete.document_id;

    setDeletingDocumentId(documentId);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/documents/${encodeURIComponent(
          documentId
        )}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        let detail = `Deletion failed (${response.status})`;

        try {
          const errorData = await response.json();

          if (typeof errorData.detail === "string") {
            detail = errorData.detail;
          }
        } catch {
          // Keep the default error message.
        }

        throw new Error(detail);
      }

      setDocuments((previous) =>
        previous.filter(
          (document) =>
            document.document_id !== documentId
        )
      );

      if (selectedDocumentId === documentId) {
        // Invalidate any in-flight chat history request.
        chatRequestRef.current += 1;
        activeDocumentRef.current = "";

        setSelectedDocumentId("");
        setMessages([]);
        setQuestion("");
        setLoadingMessages(false);

        localStorage.removeItem(SELECTED_DOCUMENT_KEY);
      }

      setDocumentToDelete(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete document."
      );

      setDocumentToDelete(null);
    } finally {
      setDeletingDocumentId("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* HEADER */}
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="rounded-xl bg-indigo-600 px-3 py-2 text-xl font-bold">
            D
          </div>

          <div>
            <h1 className="text-xl font-bold">
              DocuMind AI
            </h1>
            <p className="text-xs text-slate-400">
              Intelligent document question answering
            </p>
          </div>
        </div>
      </header>

      {/* DASHBOARD */}
      <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[320px_1fr]">
        {/* DOCUMENT SIDEBAR */}
        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-lg font-semibold">
            Your Documents
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleUpload}
            className="hidden"
          />

          <button
            type="button"
            disabled={uploading || Boolean(deletingDocumentId)}
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "+ Upload PDF"}
          </button>

          <p className="mt-3 text-center text-xs text-slate-500">
            PDF files up to 10 MB
          </p>

          <div className="mt-8 space-y-3">
            {loadingDocuments ? (
              <p className="text-sm text-slate-400">
                Loading saved documents...
              </p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-slate-400">
                No indexed documents found. Upload a PDF
                to begin.
              </p>
            ) : (
              documents.map((document) => (
                <div
                  key={document.document_id}
                  className={`rounded-xl border p-3 transition ${
                    selectedDocumentId === document.document_id
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-700"
                  }`}
                >
                  <button
                    type="button"
                    disabled={
                      answering || Boolean(deletingDocumentId)
                    }
                    onClick={() =>
                      selectDocument(document.document_id)
                    }
                    className="w-full text-left disabled:opacity-50"
                  >
                    <p className="break-words text-sm font-semibold">
                      📄 {document.filename}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      {document.pages > 0
                        ? `${document.pages} pages · `
                        : ""}
                      {document.chunks} chunks
                    </p>

                    {document.filename === "Unknown PDF" && (
                      <p className="mt-2 break-all text-xs text-slate-500">
                        ID: {document.document_id}
                      </p>
                    )}
                  </button>

                  <div className="mt-3 border-t border-slate-700 pt-3">
                    <button
                      type="button"
                      disabled={
                        answering ||
                        uploading ||
                        Boolean(deletingDocumentId)
                      }
                      onClick={() =>
                        setDocumentToDelete(document)
                      }
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
                    >
                      {deletingDocumentId === document.document_id
                        ? "Deleting..."
                        : "Delete document"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* CHAT PANEL */}
        <section className="flex min-h-[650px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-6 py-5">
            <h2 className="text-lg font-semibold">
              Chat with your document
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Ask questions and get answers grounded
              in your PDF.
            </p>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {loadingMessages ? (
              <div className="flex h-full items-center justify-center">
                <p className="animate-pulse text-sm text-slate-400">
                  Loading conversation history...
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 text-5xl">✦</div>

                <h3 className="text-xl font-semibold">
                  Ask DocuMind anything
                </h3>

                <p className="mt-2 max-w-md text-sm text-slate-400">
                  Select an indexed PDF and ask questions
                  about its contents.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 ${
                      message.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "border border-slate-700 bg-slate-800"
                    }`}
                  >
                    <div className="text-sm leading-7 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>

                    {message.sources &&
                      message.sources.length > 0 && (
                        <details className="mt-4 border-t border-slate-600 pt-3">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                            View retrieved evidence (
                            {message.sources.length})
                          </summary>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.sources.map(
                              (source, i) => (
                                <span
                                  key={`${source.chunk_id}-${i}`}
                                  className="rounded-lg bg-slate-700 px-3 py-1 text-xs text-slate-200"
                                >
                                  Page {source.page_number} ·
                                  Chunk {source.chunk_id}
                                </span>
                              )
                            )}
                          </div>
                        </details>
                      )}
                  </div>
                </div>
              ))
            )}

            {answering && (
              <p className="animate-pulse text-sm text-slate-400">
                DocuMind is searching your document...
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mx-6 mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          {/* QUESTION INPUT */}
          <form
            onSubmit={handleAsk}
            className="border-t border-slate-800 p-5"
          >
            <div className="flex gap-3">
              <input
                value={question}
                onChange={(event) =>
                  setQuestion(event.target.value)
                }
                disabled={
                  !selectedDocumentId ||
                  answering ||
                  loadingMessages ||
                  Boolean(deletingDocumentId)
                }
                placeholder={
                  selectedDocumentId
                    ? "Ask a question about your PDF..."
                    : "Select a PDF to begin..."
                }
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={
                  !question.trim() ||
                  !selectedDocumentId ||
                  answering ||
                  loadingMessages ||
                  Boolean(deletingDocumentId)
                }
                className="rounded-xl bg-indigo-600 px-5 py-3 font-medium transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* DELETE CONFIRMATION */}
      {documentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <h2
              id="delete-dialog-title"
              className="text-xl font-semibold"
            >
              Delete document?
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              You are about to delete{" "}
              <strong className="break-words text-white">
                {documentToDelete.filename}
              </strong>
              .
            </p>

            <p className="mt-2 break-all text-xs text-slate-400">
              Document ID: {documentToDelete.document_id}
            </p>

            <p className="mt-3 text-sm text-red-300">
              This permanently removes the document&apos;s
              indexed chunks and saved chat history.
              It cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={Boolean(deletingDocumentId)}
                onClick={() => setDocumentToDelete(null)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={Boolean(deletingDocumentId)}
                onClick={handleDeleteDocument}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deletingDocumentId
                  ? "Deleting..."
                  : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
