import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, Plus, X, FileText, Upload, ChevronRight, ChevronLeft, CheckCircle, Check, Circle, Pencil, Trash2, Download, Image as ImageIcon, Search, Filter, Radio } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { useGetQuizzesQuery, useCreateQuizMutation, useUpdateQuizMutation, useDeleteQuizMutation } from "../services/quizApi";
import { reportsApi } from "../services/reportsApi";
import { useGetCategoriesQuery } from "../services/categoryApi";
import { useCreateGameMutation } from "../services/gameApi";
import type { Quiz } from "../types/quiz";
import { parseCsv, csvRowsToMcq } from "../utils/parseCsv";

const inputClass =
  "w-full rounded border border-slate-500 bg-slate-700/50 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

type Step = "idle" | "rules" | "choose" | "manual" | "upload";

interface McqQuestion {
  id: number;
  questionText: string;
  imageUrl: string;
  options: string[];
  correctAnswerIndex: number;
}

const defaultOptions = ["", "", "", ""];

export default function Quiz() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const membership = useAppSelector((state) => state.auth.membership);
  const { data: quizzes = [], isLoading: quizzesLoading } = useGetQuizzesQuery(undefined, { skip: false });
  const { data: categories = [] } = useGetCategoriesQuery(undefined, { skip: false });
  const [createQuiz, { isLoading: createLoading }] = useCreateQuizMutation();
  const [createGame, { isLoading: createGameLoading }] = useCreateGameMutation();
  const [updateQuiz, { isLoading: updateLoading }] = useUpdateQuizMutation();
  const [deleteQuiz, { isLoading: deleteLoading }] = useDeleteQuizMutation();
  const hasQuizzes = (quizzes?.length ?? 0) > 0;
  const [step, setStep] = useState<Step>("idle");
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [deleteConfirmQuiz, setDeleteConfirmQuiz] = useState<Quiz | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [quizName, setQuizName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [durationPerQuestion, setDurationPerQuestion] = useState<number>(30);
  const [sendReportEnabled, setSendReportEnabled] = useState<boolean>(true);
  const [questions, setQuestions] = useState<McqQuestion[]>([]);
  const [nextId, setNextId] = useState(1);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadParseError, setUploadParseError] = useState("");
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
  const [quizSearchQuery, setQuizSearchQuery] = useState("");
  const [quizCategoryFilterId, setQuizCategoryFilterId] = useState<string | null>(null);

  const startForm = () => {
    setEditingQuizId(null);
    setStep("rules");
    setQuizName("");
    setCategoryId(quizzes[0]?.category?._id ?? (categories[0]?._id ?? null));
    setDurationPerQuestion(30);
    setSendReportEnabled(true);
    setQuestions([]);
    setNextId(1);
    setUploadFile(null);
    setUploadParseError("");
    setActiveQuestionId(null);
  };

  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
    setUploadParseError("");
    if (!file) {
      setQuestions([]);
      setNextId(1);
      setActiveQuestionId(null);
      return;
    }
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    if (!isCsv) {
      setUploadParseError("Please upload a CSV file. Use the sample template for the correct format.");
      setQuestions([]);
      return;
    }
    file
      .text()
      .then((text) => {
        const rows = parseCsv(text);
        const parsed = csvRowsToMcq(rows);
        if (parsed.length === 0) {
          setUploadParseError("No valid questions found. Check the format: Question, option A, option B, option C, option D, correct answer (0-3 or A-D).");
          setQuestions([]);
          return;
        }
        const mapped: McqQuestion[] = parsed.map((q, i) => ({
          id: i + 1,
          questionText: q.questionText,
          imageUrl: "",
          options: q.options,
          correctAnswerIndex: q.correctAnswerIndex,
        }));
        setQuestions(mapped);
        setNextId(mapped.length + 1);
        setActiveQuestionId(1);
        setUploadParseError("");
      })
      .catch(() => {
        setUploadParseError("Could not read the file.");
        setQuestions([]);
      });
  };

  const startEdit = (quiz: Quiz) => {
    setEditingQuizId(quiz._id);
    setQuizName(quiz.name);
    setCategoryId(quiz.category?._id ?? (categories[0]?._id ?? null));
    setDurationPerQuestion(quiz.durationPerQuestion ?? 30);
    setSendReportEnabled(quiz.sendReportEnabled !== false);
    const mapped: McqQuestion[] = (quiz.questions ?? []).map((q, i) => ({
      id: i + 1,
      questionText: q.questionText,
      imageUrl: q.imageUrl ?? "",
      options: q.options?.length ? [...q.options] : [...defaultOptions],
      correctAnswerIndex: q.correctAnswerIndex ?? 0,
    }));
    setQuestions(mapped);
    setNextId(mapped.length + 1);
    setActiveQuestionId(mapped[0]?.id ?? null);
    setUploadFile(null);
    setStep("manual");
  };

  const goBack = () => {
    if (step === "rules") {
      setEditingQuizId(null);
      setStep("idle");
    } else if (step === "choose") setStep("rules");
    else if (step === "manual" || step === "upload") {
      if (editingQuizId) {
        setEditingQuizId(null);
        setStep("idle");
      } else {
        if (step === "upload") {
          setUploadFile(null);
          setUploadParseError("");
          setQuestions([]);
          setNextId(1);
          setActiveQuestionId(null);
        }
        setStep("choose");
      }
    }
  };

  const activeQuestion = activeQuestionId !== null ? questions.find((q) => q.id === activeQuestionId) : null;
  const canAddNewQuestion =
    questions.length === 0 ||
    (activeQuestion != null &&
      activeQuestion.questionText.trim() !== "" &&
      activeQuestion.correctAnswerIndex >= 0);

  const addQuestion = () => {
    if (!canAddNewQuestion) return;
    const id = nextId;
    setQuestions((prev) => [...prev, { id, questionText: "", imageUrl: "", options: [...defaultOptions], correctAnswerIndex: -1 }]);
    setNextId((n) => n + 1);
    setActiveQuestionId(id);
  };

  const updateQuestion = (id: number, field: keyof McqQuestion, value: string | string[] | number) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const updateOption = (questionId: number, optionIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const options = [...q.options];
        options[optionIndex] = value;
        return { ...q, options };
      })
    );
  };

  const addOption = (questionId: number) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, options: [...q.options, ""] } : q))
    );
  };

  const removeOption = (questionId: number, optionIndex: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const options = q.options.filter((_, i) => i !== optionIndex);
        let correctAnswerIndex = q.correctAnswerIndex;
        if (optionIndex === q.correctAnswerIndex) correctAnswerIndex = -1;
        else if (q.correctAnswerIndex > optionIndex) correctAnswerIndex = q.correctAnswerIndex - 1;
        correctAnswerIndex = Math.max(-1, Math.min(correctAnswerIndex, options.length - 1));
        return { ...q, options, correctAnswerIndex };
      })
    );
  };

  const removeQuestion = (id: number) => {
    const q = questions.find((qq) => qq.id === id);
    const ok = window.confirm(`Delete this question${q?.questionText?.trim() ? `: "${q.questionText.trim()}"` : ""}?`);
    if (!ok) return;
    setQuestions((prev) => {
      const next = prev.filter((qq) => qq.id !== id);
      if (activeQuestionId === id) {
        const idx = prev.findIndex((qq) => qq.id === id);
        const nextActive = idx > 0 ? prev[idx - 1].id : next[0]?.id ?? null;
        setActiveQuestionId(nextActive);
      }
      return next;
    });
  };

  const isEditing = editingQuizId !== null;
  const saveLoading = createLoading || updateLoading;

  const handleCreateOrUpdateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== "manual" || questions.length === 0) return;
    const payload = {
      name: quizName,
      category: categoryId || null,
      durationPerQuestion,
      sendReportEnabled,
      questions: questions.map((q) => ({
        questionText: q.questionText,
        imageUrl: q.imageUrl?.trim() || undefined,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex >= 0 ? q.correctAnswerIndex : 0,
      })),
    };
    try {
      if (isEditing) {
        await updateQuiz({ _id: editingQuizId, ...payload }).unwrap();
        setEditingQuizId(null);
      } else {
        await createQuiz(payload).unwrap();
      }
      setStep("idle");
      setQuizName("");
      setCategoryId(null);
      setDurationPerQuestion(30);
      setQuestions([]);
      setActiveQuestionId(null);
    } catch {
      // Error shown via RTK Query
    }
  };

  const openDeleteConfirm = (quiz: Quiz) => setDeleteConfirmQuiz(quiz);
  const closeDeleteConfirm = () => {
    setDeleteConfirmQuiz(null);
    setDeleteError(null);
  };

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDeleteQuiz = async () => {
    if (!deleteConfirmQuiz) return;
    setDeletingId(deleteConfirmQuiz._id);
    setDeleteError(null);
    try {
      await deleteQuiz(deleteConfirmQuiz._id).unwrap();
      dispatch(reportsApi.util.invalidateTags([{ type: "Reports", id: "QUIZZES" }]));
      closeDeleteConfirm();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "data" in err && typeof (err as { data?: { message?: string } }).data?.message === "string"
          ? (err as { data: { message: string } }).data.message
          : "Failed to delete quiz.";
      setDeleteError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((quiz) => {
      const matchesSearch =
        !quizSearchQuery.trim() ||
        quiz.name.toLowerCase().includes(quizSearchQuery.trim().toLowerCase());
      const matchesCategory =
        !quizCategoryFilterId || (quiz.category?._id ?? null) === quizCategoryFilterId;
      return matchesSearch && matchesCategory;
    });
  }, [quizzes, quizSearchQuery, quizCategoryFilterId]);

  if (quizzesLoading) {
    return (
      <div className="p-6 w-full min-w-0 px-3 py-4 sm:px-4">
        <h1 className="text-2xl font-bold text-white mb-6">Quiz</h1>
        <div className="flex items-center justify-center py-16 text-slate-400">Loading quizzes...</div>
      </div>
    );
  }

  if (hasQuizzes && !editingQuizId && step === "idle") {
    return (
      <div className="w-full min-w-0 px-3 py-4 sm:px-4">
        <h1 className="text-2xl font-bold text-white mb-1">Quizzes</h1>
        {membership?.teamName && (
          <p className="text-slate-400 text-sm mb-4">Team: {membership.teamName}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={quizSearchQuery}
              onChange={(e) => setQuizSearchQuery(e.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="Search by quiz name..."
            />
          </div>
          <div className="flex items-center gap-3 ml-auto shrink-0">
            <div className="flex items-center gap-2 w-44">
              <Filter className="h-4 w-4 text-slate-500 shrink-0" />
              <select
                value={quizCategoryFilterId ?? ""}
                onChange={(e) => setQuizCategoryFilterId(e.target.value ? e.target.value : null)}
                className={inputClass}
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={startForm}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" /> Create Quiz
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur overflow-hidden">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="border-b border-slate-600 bg-slate-700/50">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Quiz name</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Category</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">No. of questions</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Actions</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Host Live</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuizzes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                    {quizzes.length === 0 ? "No quizzes yet." : "No quizzes match your search or filter."}
                  </td>
                </tr>
              ) : (
              filteredQuizzes.map((quiz) => (
                <tr key={quiz._id} className="border-b border-slate-600/80 hover:bg-slate-700/30 transition-colors last:border-b-0">
                  <td className="px-4 py-3 text-white font-medium">{quiz.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{quiz.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300 text-sm">{quiz.questions?.length ?? 0} question{(quiz.questions?.length ?? 0) !== 1 ? "s" : ""}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(quiz)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-600 hover:text-white transition-colors"
                        title="Edit quiz"
                        aria-label="Edit quiz"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteConfirm(quiz)}
                        disabled={deleteLoading && deletingId === quiz._id}
                        className="p-2 rounded-lg text-slate-400 hover:bg-red-600/20 hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Delete quiz"
                        aria-label="Delete quiz"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={createGameLoading || (quiz.questions?.length ?? 0) === 0}
                      onClick={async () => {
                        try {
                          const { code } = await createGame({ quizId: quiz._id }).unwrap();
                          navigate(`/host-game/${code}`);
                        } catch {
                          // Error handled by RTK Query
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Radio className="h-4 w-4" /> {createGameLoading ? "Creating..." : "Host Live"}
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        {/* Delete confirmation modal */}
        {deleteConfirmQuiz && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-2">Delete quiz?</h3>
              <p className="text-slate-300 text-sm mb-4">
                Are you sure you want to delete &quot;{deleteConfirmQuiz.name}&quot;? This cannot be undone.
              </p>
              {deleteError && (
                <p className="text-red-400 text-sm mb-4">{deleteError}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeDeleteConfirm}
                  className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteQuiz}
                  disabled={deleteLoading && deletingId === deleteConfirmQuiz._id}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                >
                  {deleteLoading && deletingId === deleteConfirmQuiz._id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === "idle") {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Quiz</h1>
        <div className="max-w-md mx-auto flex flex-col items-center justify-center py-16 px-6 bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-lg shadow-xl text-center">
          <div className="h-16 w-16 rounded-full bg-slate-700/80 flex items-center justify-center mb-4">
            <HelpCircle className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-white font-medium mb-2">No quiz available to host</p>
          <p className="text-slate-400 text-sm mb-6">Create your first quiz to get started.</p>
          <button
            type="button"
            onClick={startForm}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Quiz
          </button>
        </div>
      </div>
    );
  }

  const cardClass = "w-full min-w-0 bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl shadow-xl p-4 sm:p-6";

  return (
    <div className="w-full min-w-0 px-3 py-4 sm:px-4">
      <h1 className="text-2xl font-bold text-white mb-4 sm:mb-6">Quiz</h1>

      {/* Step 1: Quiz rules */}
      {step === "rules" && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-white mb-4">Quiz rules</h2>
          <form onSubmit={(e) => { e.preventDefault(); setStep("choose"); }} className="space-y-4">
            <div>
              <label htmlFor="quizName" className="block text-sm font-medium text-white mb-1">Quiz name</label>
              <input
                id="quizName"
                type="text"
                required
                value={quizName}
                onChange={(e) => setQuizName(e.target.value)}
                className={inputClass}
                placeholder="Enter quiz name"
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-white mb-1">Category</label>
              <select
                id="category"
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value ? e.target.value : null)}
                className={inputClass}
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-white mb-1">Duration per question (seconds)</label>
              <input
                id="duration"
                type="number"
                min={5}
                max={300}
                value={durationPerQuestion}
                onChange={(e) => setDurationPerQuestion(Number(e.target.value) || 30)}
                className={inputClass}
              />
            </div>
            <div className="flex items-start gap-3">
              <input
                id="sendReportEnabled"
                type="checkbox"
                checked={sendReportEnabled}
                onChange={(e) => setSendReportEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-700 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="sendReportEnabled" className="text-sm text-slate-200">
                <span className="font-medium text-white">Send report enabled</span>
                <span className="block text-slate-400 mt-0.5">When enabled, players must enter name and email to get the report before seeing results. When disabled, results are shown directly.</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={goBack} className="inline-flex items-center gap-1 rounded-lg border border-slate-500 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2: Add Manually or Upload */}
      {step === "choose" && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-white mb-4">Add questions</h2>
          <p className="text-slate-400 text-sm mb-6">Choose how you want to add questions to your quiz.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setStep("manual")}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-slate-600 bg-slate-700/30 p-6 text-white hover:border-blue-500 hover:bg-slate-700/50 transition-colors text-left"
            >
              <FileText className="h-10 w-10 text-slate-400" />
              <span className="font-medium">Add Manually</span>
              <span className="text-sm text-slate-400">Enter questions and MCQ options one by one.</span>
            </button>
            <button
              type="button"
              onClick={() => setStep("upload")}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-slate-600 bg-slate-700/30 p-6 text-white hover:border-blue-500 hover:bg-slate-700/50 transition-colors text-left"
            >
              <Upload className="h-10 w-10 text-slate-400" />
              <span className="font-medium">Upload Via file</span>
              <span className="text-sm text-slate-400">Upload a file with questions (e.g. JSON/CSV).</span>
            </button>
          </div>
          <div className="mt-6">
            <button type="button" onClick={goBack} className="inline-flex items-center gap-1 rounded-lg border border-slate-500 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3a: Add questions manually (MCQ) – two-panel layout */}
      {step === "manual" && (
        <div className={`${cardClass} flex flex-col min-h-[calc(100vh-8rem)]`}>
          <h2 className="text-lg font-semibold text-white mb-1">{isEditing ? "Edit quiz" : "Add questions (MCQ)"}</h2>
          <p className="text-slate-400 text-sm mb-4">Jump to any question from the list. Tap an option row to mark the correct answer.</p>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mb-4 p-3 rounded-lg border border-slate-600 bg-slate-700/20">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Quiz name</label>
              <input
                type="text"
                value={quizName}
                onChange={(e) => setQuizName(e.target.value)}
                className={inputClass}
                placeholder="Quiz name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
              <select
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value ? e.target.value : null)}
                className={inputClass}
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Duration (sec)</label>
              <input
                type="number"
                min={5}
                max={300}
                value={durationPerQuestion}
                onChange={(e) => setDurationPerQuestion(Number(e.target.value) || 30)}
                className={inputClass}
              />
            </div>
          </div>
          <form onSubmit={handleCreateOrUpdateQuiz} className="flex flex-col flex-1 min-h-0">
            {questions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-600 bg-slate-700/20 py-16 text-center">
                <p className="text-slate-400 text-sm mb-4">No questions yet.</p>
                <button type="button" onClick={addQuestion} className="inline-flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-500 transition-colors">
                  <Plus className="h-4 w-4" /> Add question
                </button>
              </div>
            ) : (
              <div className="flex gap-4 flex-1 min-h-0">
                {/* Left: question index – 3 square boxes per row */}
                <div className="w-52 shrink-0 flex flex-col min-h-0">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Questions</span>
                  <div className="flex-1 overflow-y-auto rounded-lg border border-slate-600 bg-slate-700/20 p-2 min-h-0">
                    <div className="grid grid-cols-3 gap-2">
                      {questions.map((q, qIndex) => {
                        const isActive = q.id === activeQuestionId;
                        const hasContent = !!q.questionText.trim() && q.correctAnswerIndex >= 0;
                        return (
                          <div key={q.id} className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveQuestionId(q.id)}
                              className={`w-full aspect-square min-h-[3rem] flex flex-col items-center justify-center gap-0.5 rounded-lg font-semibold tabular-nums transition-colors ${
                                isActive ? "bg-blue-600 text-white" : "bg-slate-700/50 text-slate-200 hover:bg-slate-600/50"
                              }`}
                            >
                              <span>{qIndex + 1}</span>
                              {hasContent && (
                                <span className={`h-1 w-1 rounded-full ${isActive ? "bg-white/80" : "bg-emerald-500"}`} title="Has content" aria-hidden />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeQuestion(q.id);
                              }}
                              className="absolute -top-1.5 -right-1.5 rounded-full bg-slate-900/80 border border-slate-600 p-1 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                              aria-label={`Delete question ${qIndex + 1}`}
                              title="Delete question"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={addQuestion}
                      disabled={!canAddNewQuestion}
                      className={`mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-2.5 text-sm font-medium transition-colors ${
                        canAddNewQuestion
                          ? "border-slate-500 text-slate-400 hover:border-slate-400 hover:text-slate-300"
                          : "border-slate-600 text-slate-500 cursor-not-allowed"
                      }`}
                      title={canAddNewQuestion ? "Add question" : "Fill question text and select correct answer first"}
                    >
                      <Plus className="h-4 w-4" /> Add
                    </button>
                    {!canAddNewQuestion && questions.length > 0 && (
                      <p className="mt-1.5 text-xs text-amber-400/90">Fill question and select correct answer to add next</p>
                    )}
                  </div>
                </div>
                {/* Right: active question form – full height */}
                <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto">
                  {activeQuestionId !== null && (() => {
                    const q = questions.find((qu) => qu.id === activeQuestionId);
                    if (!q) return null;
                    const qIndex = questions.findIndex((qu) => qu.id === activeQuestionId) + 1;
                    return (
                      <>
                        <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
                          <span className="text-sm font-medium text-slate-300">Question {qIndex}</span>
                          <button
                            type="button"
                            onClick={() => removeQuestion(q.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-200 bg-slate-700/40 border border-slate-600 hover:bg-slate-700/70 hover:text-white transition-colors"
                            aria-label="Delete question"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                        <div className="space-y-4 flex-1 min-h-0">
                          <div>
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Question</label>
                            <input
                              type="text"
                              value={q.questionText}
                              onChange={(e) => updateQuestion(q.id, "questionText", e.target.value)}
                              className={`${inputClass} min-h-[2.75rem]`}
                              placeholder="Enter question text"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <ImageIcon className="h-3.5 w-3.5" /> Image (optional) — paste image URL
                            </label>
                            <input
                              type="text"
                              value={q.imageUrl}
                              onChange={(e) => updateQuestion(q.id, "imageUrl", e.target.value)}
                              className={inputClass}
                              placeholder="https://example.com/image.png"
                            />
                            {q.imageUrl.trim() && (
                              <div className="mt-2 rounded-lg border border-slate-600 bg-slate-800/50 overflow-hidden">
                                <p className="text-xs text-slate-500 px-2 py-1">Preview</p>
                                <div className="image-preview-container relative min-h-[120px] max-h-[200px] bg-slate-800 flex items-center justify-center">
                                  <img
                                    src={q.imageUrl.trim()}
                                    alt="Question"
                                    className="max-w-full max-h-[180px] object-contain"
                                    onError={(e) => {
                                      const img = e.target as HTMLImageElement;
                                      img.style.display = "none";
                                      const container = img.closest(".image-preview-container");
                                      const fallback = container?.querySelector("[data-fallback]");
                                      if (fallback) (fallback as HTMLElement).style.display = "block";
                                    }}
                                  />
                                  <span
                                    className="absolute text-xs text-red-400 hidden"
                                    style={{ display: "none" }}
                                    data-fallback
                                  >
                                    Could not load image. Check the URL.
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-h-0 flex flex-col">
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-3 shrink-0">Options · tap a row to set correct answer</label>
                            {q.correctAnswerIndex < 0 && (
                              <p className="text-xs text-amber-400/90 mb-2 shrink-0">Select the correct answer before adding the next question.</p>
                            )}
                            <div className="space-y-2 flex-1 min-h-0">
                              {q.options.map((opt, optIndex) => {
                                const isCorrect = q.correctAnswerIndex === optIndex;
                                return (
                                  <div
                                    key={optIndex}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => updateQuestion(q.id, "correctAnswerIndex", optIndex)}
                                    onKeyDown={(e) => {
                                    const target = e.target as HTMLElement;
                                    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      updateQuestion(q.id, "correctAnswerIndex", optIndex);
                                    }
                                  }}
                                    className={`flex items-center gap-3 rounded-lg border-2 transition-all min-h-[2.75rem] ${
                                      isCorrect ? "border-emerald-500/80 bg-emerald-500/10" : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                                    }`}
                                  >
                                    <div className="flex shrink-0 items-center justify-center w-10 h-10 rounded-l-md bg-slate-700/50">
                                      {isCorrect ? <Check className="h-5 w-5 text-emerald-400" aria-hidden /> : <Circle className="h-5 w-5 text-slate-500" aria-hidden />}
                                    </div>
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => { e.stopPropagation(); updateOption(q.id, optIndex, e.target.value); }}
                                      onClick={(e) => e.stopPropagation()}
                                      className={`${inputClass} flex-1 border-0 bg-transparent focus:ring-0 py-2.5 min-h-[2.5rem]`}
                                      placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                                    />
                                    {q.options.length > 2 && (
                                      <button type="button" onClick={(e) => { e.stopPropagation(); removeOption(q.id, optIndex); }} className="shrink-0 p-2 rounded-lg text-slate-400 hover:bg-slate-600 hover:text-white transition-colors" aria-label="Remove option">
                                        <X className="h-4 w-4" />
                                      </button>
                                    )}
                                    {isCorrect && (
                                      <span className="shrink-0 mr-2 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">Correct answer</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <button type="button" onClick={() => addOption(q.id)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-500 px-3 py-2 text-sm text-slate-400 hover:border-slate-400 hover:text-slate-300 transition-colors shrink-0">
                              <Plus className="h-4 w-4" /> Add option
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-4 mt-4 border-t border-slate-700 shrink-0">
              <button type="button" onClick={goBack} className="inline-flex items-center gap-1 rounded-lg border border-slate-500 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button type="submit" disabled={saveLoading} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
                <CheckCircle className="h-4 w-4" /> {saveLoading ? (isEditing ? "Updating..." : "Creating...") : isEditing ? "Update Quiz" : "Create Quiz"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 3b: Upload via file */}
      {step === "upload" && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-white mb-4">Upload Via file</h2>
          <p className="text-slate-400 text-sm mb-4">Upload a CSV file with your MCQ questions. Use the same format as the sample template.</p>
          <a
            href="/template.csv"
            download="template.csv"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-500 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors mb-4"
          >
            <Download className="h-4 w-4" /> Download sample CSV
          </a>
          <p className="text-slate-500 text-xs mb-4">
            Format: Question, option A, option B, option C, option D, correct answer (use 0–3 for first–fourth option, or A–D).
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Select CSV file</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleUploadFileChange}
                className="block w-full text-sm text-slate-300 file:mr-4 file:rounded file:border-0 file:bg-slate-600 file:px-4 file:py-2 file:text-white file:hover:bg-slate-500"
              />
              {uploadFile && <p className="mt-2 text-sm text-slate-400">{uploadFile.name}</p>}
            </div>
            {uploadParseError && <p className="text-sm text-red-400">{uploadParseError}</p>}
            {questions.length > 0 && !uploadParseError && (
              <p className="text-sm text-emerald-400">{questions.length} question{questions.length !== 1 ? "s" : ""} extracted. Review and create the quiz below.</p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <button type="button" onClick={goBack} className="inline-flex items-center gap-1 rounded-lg border border-slate-500 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStep("manual")}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                >
                  Review & Create Quiz <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
