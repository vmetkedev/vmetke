import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";

export function FormulaComponent({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.latex);
  const [draft, setDraft] = useState((node.attrs.latex as string) || "");

  const commit = () => {
    updateAttributes({ latex: draft });
    setEditing(false);
  };

  let html = "";
  let error = false;
  try {
    html = katex.renderToString((node.attrs.latex as string) || "", {
      throwOnError: true,
      displayMode: true,
    });
  } catch {
    error = true;
  }

  return (
    <NodeViewWrapper className="my-2">
      {editing ? (
        <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-700">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            onBlur={commit}
            placeholder="Формула в LaTeX, например E = mc^2"
            className="w-full bg-transparent text-sm font-mono focus:outline-none dark:text-gray-100"
          />
        </div>
      ) : (
        <div
          contentEditable={false}
          onClick={() => {
            setDraft((node.attrs.latex as string) || "");
            setEditing(true);
          }}
          className="p-2 text-center cursor-text overflow-x-auto rounded hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          {error ? (
            <span className="text-red-500 text-xs">Ошибка в формуле</span>
          ) : (
            <span dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}