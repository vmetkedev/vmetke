import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";

export function InlineFormulaComponent({ node, updateAttributes }: NodeViewProps) {
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
      displayMode: false,
    });
  } catch {
    error = true;
  }

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle">
      {editing ? (
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
          placeholder="LaTeX"
          className="text-sm font-mono bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded px-1 focus:outline-none dark:text-gray-100"
          style={{ width: `${Math.max(4, draft.length)}ch` }}
        />
      ) : (
        <span
          contentEditable={false}
          onClick={() => {
            setDraft((node.attrs.latex as string) || "");
            setEditing(true);
          }}
          className="cursor-text px-0.5 rounded hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          {error ? (
            <span className="text-red-500 text-xs">?</span>
          ) : (
            <span dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </span>
      )}
    </NodeViewWrapper>
  );
}