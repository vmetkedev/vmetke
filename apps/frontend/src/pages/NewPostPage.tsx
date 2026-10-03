import { useState } from "react";
import { useNavigate } from "react-router";
import { PostComposer } from "../components/PostComposer";
import { AppLayout } from "../components/AppLayout";
import { EditorSettingsModal } from "../components/editor/EditorSettingsModal";

export default function NewPostPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"wysiwyg" | "markdown">("wysiwyg");
  const [editorKey, setEditorKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleModeSave = (newMode: "wysiwyg" | "markdown") => {
    if (newMode !== mode && newMode === "wysiwyg") {
      setEditorKey((k) => k + 1);
    }
    setMode(newMode);
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold dark:text-gray-100">Новый пост</h1>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
            title="Настройки редактора"
          >
            <span className="inline-flex items-center justify-center w-4 h-4 rounded border border-current text-[10px] font-semibold">
              {mode === "wysiwyg" ? "W" : "M"}
            </span>
            {mode === "wysiwyg" ? "WYSIWYG" : "Markdown"}
          </button>
        </div>
        <PostComposer mode={mode} editorKey={editorKey} onPosted={() => navigate("/")} />
      </div>
      {settingsOpen && (
        <EditorSettingsModal
          currentMode={mode}
          onSave={handleModeSave}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </AppLayout>
  );
}