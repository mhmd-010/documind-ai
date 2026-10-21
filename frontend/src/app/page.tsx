
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "motion/react";
import PdfViewer from "@/components/dashboard/PdfViewer";

import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  FilePlus2,
  FileText,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  Menu,
  MessageCircle,
  PanelLeftClose,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import DocuMindLogo from "@/components/branding/DocuMindLogo";
import MiniBot from "@/components/branding/MiniBot";
import GlowButton from "@/components/dashboard/GlowButton";

// -------------------------------------------------------
// TYPES
// -------------------------------------------------------

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

type DocumentListResponse = {
  documents: DocumentInfo[];
};

type ChatHistoryResponse = {
  messages: ChatMessage[];
};

type AskResponse = {
  answer: string;
  sources: Source[];
};

// -------------------------------------------------------
// CONFIGURATION
// -------------------------------------------------------

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

const SELECTED_DOCUMENT_KEY =
  "documind_selected_document";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// -------------------------------------------------------
// HELPERS
// -------------------------------------------------------

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

async function getApiError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const data = await response.json();

    if (typeof data.detail === "string") {
      return data.detail;
    }
  } catch {
    // Keep the fallback message.
  }

  return `${fallback} (${response.status})`;
}

function formatDocumentName(name: string) {
  return name.replace(/\.pdf$/i, "");
}

// -------------------------------------------------------
// MAIN DASHBOARD
// -------------------------------------------------------

export default function Home() {
  // DOM references
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);

  // Prevent old chat requests from changing the
  // currently selected document's conversation.
  const activeDocumentRef = useRef("");
  const chatRequestRef = useRef(0);

  // Prevent duplicate requests before React rerenders.
  const answeringRef = useRef(false);

  // Data state
  const [documents, setDocuments] =
    useState<DocumentInfo[]>([]);

  const [selectedDocumentId, setSelectedDocumentId] =
    useState("");
  const [showPdfViewer, setShowPdfViewer] = useState(false); 
  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [question, setQuestion] = useState("");

  // Request state
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [answering, setAnswering] = useState(false);

  const [loadingDocuments, setLoadingDocuments] =
    useState(true);

  const [loadingMessages, setLoadingMessages] =
    useState(false);

  const [deletingDocumentId, setDeletingDocumentId] =
    useState("");

  // Interface state
  const [error, setError] = useState("");
  const [backendOnline, setBackendOnline] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [documentToDelete, setDocumentToDelete] =
    useState<DocumentInfo | null>(null);

  // Derived values
  const selectedDocument =
    documents.find(
      (document) =>
        document.document_id === selectedDocumentId
    ) ?? null;

  const filteredDocuments = documents.filter(
    (document) =>
      document.filename
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const totalPages = documents.reduce(
    (total, document) => total + document.pages,
    0
  );

  const totalChunks = documents.reduce(
    (total, document) => total + document.chunks,
    0
  );

  const interactionLocked =
    answering || Boolean(deletingDocumentId);

  // -----------------------------------------------------
  // LOAD SAVED CHAT HISTORY
  // -----------------------------------------------------

  const loadChatHistory = useCallback(
    async (documentId: string) => {
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
            await getApiError(
              response,
              "Failed to load conversation"
            )
          );
        }

        const data: ChatHistoryResponse =
          await response.json();

        // Discard a response if the user has since
        // switched to another document.
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
            getErrorMessage(
              err,
              "Unable to load chat history."
            )
          );
        }
      } finally {
        if (requestId === chatRequestRef.current) {
          setLoadingMessages(false);
        }
      }
    },
    []
  );

  // -----------------------------------------------------
  // SELECT DOCUMENT
  // -----------------------------------------------------

  const selectDocument = useCallback(
    (documentId: string) => {
      if (
        answeringRef.current ||
        deletingDocumentId
      ) {
        return;
      }

      activeDocumentRef.current = documentId;

      setSelectedDocumentId(documentId);
      setMessages([]);
      setQuestion("");
      setError("");
      setSidebarOpen(false);

      localStorage.setItem(
        SELECTED_DOCUMENT_KEY,
        documentId
      );

      void loadChatHistory(documentId);
    },
    [deletingDocumentId, loadChatHistory]
  );

  // -----------------------------------------------------
  // LOAD DOCUMENTS ON PAGE START
  // -----------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      try {
        const response = await fetch(
          `${API_URL}/documents`
        );

        if (!response.ok) {
          throw new Error(
            await getApiError(
              response,
              "Failed to load documents"
            )
          );
        }

        const data: DocumentListResponse =
          await response.json();

        if (cancelled) return;

        const savedDocuments = data.documents ?? [];

        setDocuments(savedDocuments);

        const previousDocumentId =
          localStorage.getItem(
            SELECTED_DOCUMENT_KEY
          );

        if (
          previousDocumentId &&
          savedDocuments.some(
            (document) =>
              document.document_id ===
              previousDocumentId
          )
        ) {
          activeDocumentRef.current =
            previousDocumentId;

          setSelectedDocumentId(
            previousDocumentId
          );

          void loadChatHistory(
            previousDocumentId
          );
        } else {
          localStorage.removeItem(
            SELECTED_DOCUMENT_KEY
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              err,
              "Unable to load documents."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingDocuments(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [loadChatHistory]);

 // -----------------------------------------------------
// SMART CHAT AUTO-SCROLL
// -----------------------------------------------------

useEffect(() => {
  const container = chatContainerRef.current;

  if (!container) return;

  const distanceFromBottom =
    container.scrollHeight -
    container.scrollTop -
    container.clientHeight;

  // Only scroll automatically if the user is already
  // close to the bottom of the conversation.
  if (distanceFromBottom < 180) {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }
}, [messages, answering, loadingMessages]);

  // -----------------------------------------------------
  // UPLOAD PDF
  // -----------------------------------------------------

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setUploadSuccess("");

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        "The maximum supported PDF size is 10 MB."
      );
      event.target.value = "";
      return;
    }

    if (interactionLocked || uploading) {
      event.target.value = "";
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
        throw new Error(
          await getApiError(
            response,
            "Upload failed"
          )
        );
      }

      const data: DocumentInfo =
        await response.json();

      setDocuments((previous) => [
        data,
        ...previous.filter(
          (document) =>
            document.document_id !==
            data.document_id
        ),
      ]);

      selectDocument(data.document_id);
      setSearchTerm("");
      setUploadSuccess(`${data.filename} is ready for questions!`);
    } catch (err) {
      setError(
        getErrorMessage(err, "Upload failed.")
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // -----------------------------------------------------
  // ASK RAG PIPELINE
  // -----------------------------------------------------

  async function handleAsk(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const currentQuestion = question.trim();
    const documentId = selectedDocumentId;

    if (
      !currentQuestion ||
      !documentId ||
      answeringRef.current ||
      loadingMessages ||
      deletingDocumentId
    ) {
      return;
    }

    answeringRef.current = true;

    setError("");
    setAnswering(true);
    setQuestion("");

    // Show the user's message immediately.
    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: currentQuestion,
      },
    ]);

    try {
      const response = await fetch(
        `${API_URL}/ask`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: currentQuestion,
            top_k: 3,
            document_id: documentId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await getApiError(
            response,
            "Question answering failed"
          )
        );
      }

      const data: AskResponse =
        await response.json();

      if (
        activeDocumentRef.current !== documentId
      ) {
        return;
      }

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
        getErrorMessage(
          err,
          "Unable to generate an answer."
        )
      );

      // Restore the server's saved history if the
      // request failed, avoiding unsaved messages.
      await loadChatHistory(documentId);

      if (
        activeDocumentRef.current === documentId
      ) {
        setQuestion(currentQuestion);
      }
    } finally {
      answeringRef.current = false;
      setAnswering(false);
    }
  }

  // -----------------------------------------------------
  // DELETE DOCUMENT
  // -----------------------------------------------------

  async function handleDeleteDocument() {
    if (
      !documentToDelete ||
      deletingDocumentId ||
      answeringRef.current ||
      uploading
    ) {
      return;
    }

    const documentId =
      documentToDelete.document_id;

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
        throw new Error(
          await getApiError(
            response,
            "Deletion failed"
          )
        );
      }

      setDocuments((previous) =>
        previous.filter(
          (document) =>
            document.document_id !== documentId
        )
      );

      if (selectedDocumentId === documentId) {
        chatRequestRef.current += 1;
        activeDocumentRef.current = "";

        setSelectedDocumentId("");
        setMessages([]);
        setQuestion("");
        setLoadingMessages(false);

        localStorage.removeItem(
          SELECTED_DOCUMENT_KEY
        );
      }

      setDocumentToDelete(null);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to delete document."
        )
      );

      setDocumentToDelete(null);
    } finally {
      setDeletingDocumentId("");
    }
  }

  // -----------------------------------------------------
  // KEYBOARD SHORTCUT FOR QUESTION INPUT
  // -----------------------------------------------------

  function handleQuestionKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();

      event.currentTarget.form?.requestSubmit();
    }
  }

  // Check whether the FastAPI backend is reachable.
useEffect(() => {
  let active = true;

  async function checkBackend() {
    try {
      const response = await fetch(`${API_URL}/health`, {
        cache: "no-store",
      });

      if (active) {
        setBackendOnline(response.ok);
      }
    } catch {
      if (active) {
        setBackendOnline(false);
      }
    }
  }

  void checkBackend();

  // Recheck every 15 seconds.
  const interval = window.setInterval(checkBackend, 15000);

  return () => {
    active = false;
    window.clearInterval(interval);
  };
}, []);
  // -----------------------------------------------------
  // RENDER
  // -----------------------------------------------------

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080B17] text-slate-100">
      {/* Ambient background lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-48 h-[550px] w-[550px] rounded-full bg-violet-700/15 blur-[130px]" />

        <div className="absolute -right-48 top-1/4 h-[550px] w-[550px] rounded-full bg-cyan-500/10 blur-[140px]" />

        <div className="absolute bottom-[-250px] left-1/3 h-[550px] w-[550px] rounded-full bg-indigo-700/10 blur-[140px]" />
      </div>

      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.button
            type="button"
            aria-label="Close sidebar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 flex min-h-screen">
        {/* ================================================= */}
        {/* SIDEBAR */}
        {/* ================================================= */}

        <aside
          className={[
            "fixed inset-y-0 left-0 z-40 flex w-[310px] flex-col",
            "border-r border-white/10 bg-[#0E1225]/95",
            "p-5 shadow-2xl backdrop-blur-2xl",
            "transition-transform duration-300",
            "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full",
          ].join(" ")}
        >
          {/* Branding */}
          <div className="mb-8 flex items-center justify-between">
            <DocuMindLogo size={52} />

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden"
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <div className="mb-8 space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-violet-400/20 bg-gradient-to-r from-violet-600/20 to-indigo-600/10 px-4 py-3 text-sm font-semibold text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <FolderOpen size={18} />
              Documents
            </div>

            <div className="flex items-center gap-3 px-4 py-3 text-sm text-slate-500">
              <MessageCircle size={18} />
              Chat history
              <span className="ml-auto text-[10px] text-slate-600">
                Per PDF
              </span>
            </div>
          </div>

          {/* Upload */}
          <div className="rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/10 to-cyan-400/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-300">
                <FilePlus2 size={20} />
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  Add a document
                </p>
                <p className="text-xs text-slate-400">
                  Build your knowledge base
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleUpload}
              className="hidden"
              aria-label="Choose PDF to upload"
            />

            <GlowButton
              fullWidth
              loading={uploading}
              disabled={
                interactionLocked || uploading
              }
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              <UploadCloud size={17} />
              {uploading
                ? "Processing PDF..."
                : "Upload PDF"}
            </GlowButton>

            <p className="mt-3 text-center text-[11px] text-slate-500">
              PDF format · Maximum 10 MB
            </p>
            {/* Animated PDF processing indicator */}
<AnimatePresence>
  {uploading && (
    <motion.div
      initial={{ opacity: 0, height: 0, y: -8 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
      role="status"
      aria-live="polite"
    >
      <div className="mt-4 rounded-xl border border-violet-400/20 bg-[#11152B] p-3">
        <div className="flex items-center gap-2">
          <LoaderCircle
            size={16}
            className="animate-spin text-violet-300"
          />

          <span className="text-xs font-semibold text-violet-200">
            Processing your document
          </span>
        </div>

        <p className="mt-2 text-[11px] leading-5 text-slate-400">
          Extracting text, creating embeddings, and indexing
          your PDF for intelligent search.
        </p>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
            animate={{ x: ["-100%", "300%"] }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        <p className="mt-2 text-[10px] text-slate-500">
          Please wait while your PDF is prepared...
        </p>
      </div>
    </motion.div>
  )}
</AnimatePresence>
          </div>

          {/* Library */}
          <div className="mt-7 flex min-h-0 flex-1 flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Your Library
              </h2>

              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-400">
                {documents.length}
              </span>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search documents..."
                aria-label="Search documents"
                className="w-full rounded-xl border border-white/10 bg-[#090D1D] py-3 pl-10 pr-4 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10"
              />
            </div>

            {/* Document cards */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {loadingDocuments ? (
                <div className="flex items-center gap-2 px-2 py-5 text-sm text-slate-400">
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                  Loading documents...
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
                  <FileText
                    size={28}
                    className="mx-auto mb-3 text-slate-600"
                  />

                  <p className="text-sm text-slate-400">
                    {documents.length === 0
                      ? "No PDFs uploaded yet"
                      : "No matching documents"}
                  </p>
                </div>
              ) : (
                filteredDocuments.map((document) => {
                  const isSelected =
                    document.document_id ===
                    selectedDocumentId;

                  return (
                    <motion.div
                      key={document.document_id}
                      layout
                      className={[
                        "group relative rounded-2xl border p-3",
                        "transition-colors duration-200",
                        isSelected
                          ? "border-violet-400/50 bg-gradient-to-br from-violet-600/20 to-indigo-600/10 shadow-[0_8px_30px_rgba(124,58,237,0.12)]"
                          : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        disabled={
                          interactionLocked ||
                          uploading
                        }
                        onClick={() =>
                          selectDocument(
                            document.document_id
                          )
                        }
                        className="flex w-full items-start gap-3 text-left disabled:opacity-50"
                      >
                        <div
                          className={[
                            "flex h-11 w-10 shrink-0 items-center justify-center rounded-xl",
                            isSelected
                              ? "bg-violet-500/25 text-violet-200"
                              : "bg-rose-500/10 text-rose-300",
                          ].join(" ")}
                        >
                          <FileText size={21} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className="break-words text-sm font-semibold leading-5 text-slate-100"
                            title={document.filename}
                          >
                            {document.filename}
                          </p>

                          <p className="mt-1.5 text-xs text-slate-500">
                            {document.pages > 0
                              ? `${document.pages} pages · `
                              : ""}
                            {document.chunks} chunks
                          </p>
                        </div>

                        {isSelected && (
                          <Check
                            size={16}
                            className="shrink-0 text-cyan-300"
                          />
                        )}
                      </button>

                      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
                        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <BookOpen size={12} />
                          Indexed
                        </span>

                        <button
                          type="button"
                          disabled={
                            interactionLocked ||
                            uploading
                          }
                          onClick={() =>
                            setDocumentToDelete(document)
                          }
                          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                          aria-label={`Delete ${document.filename}`}
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          {/* Library statistics */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <HardDrive
                size={15}
                className="text-cyan-300"
              />
              Knowledge Base
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xl font-bold text-white">
                  {totalPages}
                </p>
                <p className="text-[11px] text-slate-500">
                  Total pages
                </p>
              </div>

              <div>
                <p className="text-xl font-bold text-white">
                  {totalChunks}
                </p>
                <p className="text-[11px] text-slate-500">
                  Indexed chunks
                </p>
              </div>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 opacity-80" />
            </div>

            <p className="mt-2 text-[10px] text-slate-500">
              Local document index
            </p>
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] text-slate-500">
            <ShieldCheck
              size={14}
              className="text-emerald-400"
            />
            Powered by hybrid retrieval
          </div>
        </aside>

        {/* ================================================= */}
        {/* MAIN CONTENT */}
        {/* ================================================= */}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top navigation */}
          <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-white/10 bg-[#090D1D]/80 px-4 backdrop-blur-xl sm:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white sm:text-base">
                    AI Workspace
                  </h2>

                  <span className="hidden rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300 sm:inline-flex">
                    BETA
                  </span>
                </div>

                <p className="mt-0.5 text-xs text-slate-500">
                  Document intelligence dashboard
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                Workspace ready
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-600/30 to-indigo-600/20 text-sm font-bold text-violet-200">
                DM
              </div>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
            {/* Page heading */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-violet-300">
                  <Sparkles size={14} />
                  INTELLIGENT DOCUMENT ANALYSIS
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Your AI Research Workspace
                </h1>

                <p className="mt-2 text-sm text-slate-400">
                  Turn complex PDFs into clear,
                  source-grounded answers.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs text-slate-400">
                <Clock3 size={15} />
                Conversations saved per document
              </div>
            </div>

            {/* ================================================= */}
            {/* ASSISTANT HERO */}
            {/* ================================================= */}

            <section className="relative overflow-hidden rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-[#1A1741] via-[#151735] to-[#0E1D34] shadow-[0_20px_80px_rgba(41,25,104,0.25)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              >
                <div className="absolute -right-10 -top-24 h-72 w-72 rounded-full bg-violet-500/20 blur-[80px]" />

                <div className="absolute bottom-[-130px] left-1/3 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px]" />

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(167,139,250,0.12),transparent_35%)]" />
              </div>

              <div className="relative flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:gap-8 sm:p-8 sm:text-left">
                <div className="relative shrink-0">
                  <div className="absolute inset-5 rounded-full bg-violet-500/20 blur-2xl" />

                  <MiniBot
                    size={122}
                    className="relative"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-200">
                    <Sparkles size={13} />
                    MEET YOUR AI ASSISTANT
                  </div>

                  <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">
                    Hi there! I&apos;m DocuMind.
                  </h2>

                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                    Upload a PDF, ask me anything
                    about it, and explore answers
                    supported by retrieved evidence.
                  </p>
                </div>

                <div className="hidden shrink-0 lg:block">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-xl backdrop-blur-md">
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-200">
                      <Sparkles
                        size={15}
                        className="text-cyan-300"
                      />
                      Research toolkit
                    </div>

                    <div className="space-y-2 text-xs text-slate-400">
                      <p className="flex items-center gap-2">
                        <Check
                          size={13}
                          className="text-emerald-400"
                        />
                        Semantic retrieval
                      </p>

                      <p className="flex items-center gap-2">
                        <Check
                          size={13}
                          className="text-emerald-400"
                        />
                        Keyword search
                      </p>

                      <p className="flex items-center gap-2">
                        <Check
                          size={13}
                          className="text-emerald-400"
                        />
                        Source citations
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ================================================= */}
            {/* CHAT PANEL */}
            {/* ================================================= */}
            {/* PDF and chat workspace */}
<div className="flex min-w-0 flex-col gap-5 xl:flex-row">
 {/* PDF viewer — displayed beside the chat */}
{showPdfViewer && selectedDocument && (
  <div className="min-w-0 flex-1">
    <PdfViewer
      documentId={selectedDocument.document_id}
      filename={selectedDocument.filename}
      onClose={() => setShowPdfViewer(false)}
    />
  </div>
)}
            <section className="flex min-h-[650px] min-w-0 flex-1 flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#101426]/90 shadow-[0_20px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl">
              {/* Chat header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
              {/* PDF viewer toggle */}
{selectedDocument && (
  <button
    type="button"
    onClick={() => setShowPdfViewer((previous) => !previous)}
    className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-200 transition hover:border-violet-400/40 hover:bg-violet-500/20"
  >
    <FileText size={16} />
    {showPdfViewer ? "Hide PDF" : "View PDF"}
  </button>
)}
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/25 to-cyan-500/10 text-violet-200 shadow-[0_8px_20px_rgba(124,58,237,0.15)]">
                    <MessageCircle size={22} />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-white">
                      Document Chat
                    </h2>

                    <p
                      className="mt-1 truncate text-xs text-slate-400"
                      title={
                        selectedDocument?.filename
                      }
                    >
                      {selectedDocument
                        ? selectedDocument.filename
                        : "Choose a PDF to begin"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedDocument && (
                    <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200">
                      {selectedDocument.pages} pages
                    </span>
                  )}

                  <span
  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
    backendOnline
      ? "border-emerald-400/15 bg-emerald-400/5 text-emerald-300"
      : "border-red-400/15 bg-red-400/5 text-red-300"
  }`}
>
  <span
    className={`h-1.5 w-1.5 rounded-full ${
      backendOnline
        ? "bg-emerald-400"
        : "bg-red-400"
    }`}
  />
  {backendOnline ? "Connected" : "Offline"}
</span>
                </div>
              </div>

              {/* Messages */}
              <div
  ref={chatContainerRef}
  className="min-h-[390px] flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-7"
>
                {loadingMessages ? (
                  <div className="flex h-full min-h-[340px] flex-col items-center justify-center gap-4 text-slate-400">
                    <LoaderCircle
                      size={28}
                      className="animate-spin text-violet-400"
                    />

                    <p className="text-sm">
                      Restoring conversation...
                    </p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-2xl" />

                      <div className="relative flex h-20 w-20 items-center justify-center rounded-[24px] border border-violet-400/20 bg-gradient-to-br from-violet-600/20 to-cyan-500/10 shadow-xl">
                        <Sparkles
                          size={34}
                          className="text-violet-200"
                        />
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white">
                      {selectedDocument
                        ? "Ready to explore your PDF?"
                        : "Your next insight starts here"}
                    </h3>

                    <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                      {selectedDocument
                        ? "Ask a question about your selected document. DocuMind will retrieve relevant passages and generate an answer."
                        : "Upload a document from the sidebar, or select one from your library to start a conversation."}
                    </p>

                    {!selectedDocument && (
                      <GlowButton
                        className="mt-6"
                        disabled={uploading}
                        loading={uploading}
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                      >
                        <UploadCloud size={17} />
                        Upload your first PDF
                      </GlowButton>
                    )}

                    {selectedDocument && (
                      <div className="mt-7 flex flex-wrap justify-center gap-2">
                        {[
                          "Summarize this document",
                          "What are the key findings?",
                          "Explain the main concepts",
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            disabled={
                              answering ||
                              loadingMessages ||
                              Boolean(deletingDocumentId)
                            }
                            onClick={() => {
                              setQuestion(suggestion);
                              questionInputRef.current?.focus();
                            }}
                            className="rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-xs text-violet-200 transition hover:border-violet-400/40 hover:bg-violet-500/20 disabled:opacity-50"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isUser =
                      message.role === "user";

                    return (
                      <motion.div
                        key={`${index}-${message.role}`}
                        initial={{
                          opacity: 0,
                          y: 10,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        transition={{
                          duration: 0.25,
                        }}
                        className={[
                          "flex items-start gap-3",
                          isUser
                            ? "justify-end"
                            : "justify-start",
                        ].join(" ")}
                      >
                        {!isUser && (
                          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/15 text-violet-200 sm:flex">
                            <Sparkles size={17} />
                          </div>
                        )}

                        <div
                          className={[
                            "max-w-[94%] rounded-2xl px-5 py-4 sm:max-w-[82%]",
                            isUser
                              ? "rounded-tr-md border border-violet-400/30 bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-[0_10px_30px_rgba(91,33,182,0.22)]"
                              : "rounded-tl-md border border-white/10 bg-[#1B2138] text-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
                          ].join(" ")}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className={[
                                "text-[11px] font-bold uppercase tracking-wider",
                                isUser
                                  ? "text-violet-100/80"
                                  : "text-cyan-300",
                              ].join(" ")}
                            >
                              {isUser
                                ? "You"
                                : "DocuMind AI"}
                            </span>
                          </div>

                          <div className="break-words text-sm leading-7 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_ul]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:mb-3 [&_ol]:ml-5 [&_ol]:list-decimal [&_li]:mb-1 [&_h1]:mb-3 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-violet-400 [&_blockquote]:pl-3 [&_code]:break-all [&_code]:text-cyan-200 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/30 [&_pre]:p-3 [&_table]:my-3 [&_table]:block [&_table]:overflow-x-auto [&_th]:border [&_th]:border-white/15 [&_th]:p-2 [&_td]:border [&_td]:border-white/15 [&_td]:p-2">
                            <ReactMarkdown
                              remarkPlugins={[
                                remarkGfm,
                              ]}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>

                          {/* Retrieved source references */}
                          {!isUser &&
                            message.sources &&
                            message.sources.length > 0 && (
                              <details className="group/evidence mt-5 border-t border-white/10 pt-4">
                                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-violet-200 [&::-webkit-details-marker]:hidden">
                                  <BookOpen size={15} />

                                  Retrieved evidence

                                  <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px]">
                                    {message.sources.length}
                                  </span>

                                  <ChevronDown
                                    size={14}
                                    className="ml-auto transition-transform group-open/evidence:rotate-180"
                                  />
                                </summary>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {message.sources.map(
                                    (source, i) => (
                                      <span
                                        key={`${source.document_id}-${source.chunk_id}-${i}`}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/15 bg-cyan-400/5 px-3 py-2 text-[11px] text-cyan-200"
                                      >
                                        <FileText size={12} />
                                        Page {source.page_number}
                                        {" · "}
                                        Chunk {source.chunk_id}
                                      </span>
                                    )
                                  )}
                                </div>
                              </details>
                            )}
                        </div>
                      </motion.div>
                    );
                  })
                )}

                {/* AI typing indicator */}
                {answering && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/15 text-violet-200">
                      <Sparkles size={17} />
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#1B2138] px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              className="h-2 w-2 rounded-full bg-cyan-300"
                              animate={{
                                opacity: [
                                  0.3,
                                  1,
                                  0.3,
                                ],
                                y: [
                                  0,
                                  -4,
                                  0,
                                ],
                              }}
                              transition={{
                                duration: 1.2,
                                repeat: Infinity,
                                delay: i * 0.18,
                              }}
                            />
                          ))}
                        </div>

                        <span className="text-xs text-slate-400">
                          Searching your document...
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Error notification */}
              {error && (
                <div
                  role="alert"
                  className="mx-5 mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200 sm:mx-7"
                >
                  <p>{error}</p>

                  <button
                    type="button"
                    onClick={() => setError("")}
                    className="shrink-0 text-red-300 hover:text-white"
                    aria-label="Dismiss error"
                  >
                    <X size={17} />
                  </button>
                </div>
              )}

              {/* ================================================= */}
              {/* CHAT COMPOSER */}
              {/* ================================================= */}

              <form
                onSubmit={handleAsk}
                className="border-t border-white/10 bg-[#0D1122]/80 p-4 sm:p-6"
              >
                <div className="rounded-2xl border border-white/10 bg-[#171D32] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.15)] transition focus-within:border-violet-400/40 focus-within:ring-2 focus-within:ring-violet-500/10">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={questionInputRef}
                      value={question}
                      onChange={(event) =>
                        setQuestion(
                          event.target.value
                        )
                      }
                      onKeyDown={
                        handleQuestionKeyDown
                      }
                      rows={2}
                      disabled={
                        !selectedDocumentId ||
                        answering ||
                        loadingMessages ||
                        Boolean(deletingDocumentId)
                      }
                      placeholder={
                        selectedDocumentId
                          ? "Ask anything about your document..."
                          : "Select or upload a PDF to begin..."
                      }
                      aria-label="Your question"
                      className="max-h-40 min-h-[56px] min-w-0 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />

                    <GlowButton
                      type="submit"
                      disabled={
                        !question.trim() ||
                        !selectedDocumentId ||
                        answering ||
                        loadingMessages ||
                        Boolean(deletingDocumentId)
                      }
                      loading={answering}
                      className="mb-1 !min-h-11 !px-4"
                      aria-label="Send question"
                    >
                      <ArrowUp size={19} />
                      <span className="hidden sm:inline">
                        Send
                      </span>
                    </GlowButton>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={13} />
                    Answers grounded in retrieved PDF passages
                  </span>

                  <span>
                    Enter to send · Shift + Enter for new line
                  </span>
                </div>
              </form>
            </section>
          </div>

            {/* Footer */}
<footer className="flex flex-wrap items-center justify-between gap-3 pb-3 text-[11px] text-slate-600">
  <span>
    &copy; 2026 DocuMind AI
  </span>

  <span>
    Built with Next.js, FastAPI and hybrid RAG
  </span>
</footer>
          </div>
        </div>
      </div>

      {/* ================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ================================================= */}

      <AnimatePresence>
        {documentToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.94,
                y: 15,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                y: 10,
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
              className="w-full max-w-md rounded-[26px] border border-white/15 bg-[#151A30] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.5)]"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-300">
                <Trash2 size={25} />
              </div>

              <h2
                id="delete-dialog-title"
                className="text-xl font-bold text-white"
              >
                Delete this document?
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                You&apos;re about to permanently remove
                this PDF and its saved conversation.
              </p>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="break-words text-sm font-semibold text-white">
                  {documentToDelete.filename}
                </p>

                <p className="mt-2 break-all text-[11px] text-slate-500">
                  ID: {documentToDelete.document_id}
                </p>
              </div>

              <p className="mt-4 text-xs leading-5 text-red-300">
                This action cannot be undone. All indexed
                chunks and chat history for this document
                will be removed.
              </p>

              <div className="mt-7 flex justify-end gap-3">
                <GlowButton
                  variant="secondary"
                  disabled={Boolean(
                    deletingDocumentId
                  )}
                  onClick={() =>
                    setDocumentToDelete(null)
                  }
                >
                  Cancel
                </GlowButton>

                <GlowButton
                  variant="danger"
                  loading={Boolean(
                    deletingDocumentId
                  )}
                  disabled={Boolean(
                    deletingDocumentId
                  )}
                  onClick={
                    handleDeleteDocument
                  }
                >
                  <Trash2 size={16} />
                  Delete permanently
                </GlowButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* PDF upload success notification */}
<AnimatePresence>
  {uploadSuccess && (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      role="status"
      className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3"
    >
      <div className="flex items-start gap-2.5">
        <Check
          size={18}
          className="mt-0.5 shrink-0 text-emerald-400"
        />

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-emerald-300">
            Document ready!
          </p>

          <p className="mt-1 break-words text-[11px] leading-5 text-slate-300">
            {uploadSuccess}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setUploadSuccess("")}
          className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Dismiss upload success notification"
        >
          <X size={15} />
        </button>
      </div>
    </motion.div>
  )}
</AnimatePresence>
    </main>
  );
}
