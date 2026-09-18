import { useState } from "react";
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { ChevronDown } from "lucide-react";

export function SpoilerComponent({ node, updateAttributes }: NodeViewProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState((node.attrs.title as string) || "Спойлер");

  const commitTitle = () => {
    updateAttributes({ title: titleDraft || "Спойлер" });
    setEditingTitle(false);
  };

  return (
    <NodeViewWrapper className="my-1 border dark:border-gray-700 rounded overflow-hidden">
      <div
        contentEditable={false}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 cursor-pointer select-none text-sm font-medium dark:text-gray-100"
        onClick={() => !editingTitle && setEditingTitle(true)}
      >
        <ChevronDown size={14} className="text-gray-400" />
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTitle();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent focus:outline-none border-b border-gray-300 dark:border-gray-600"
          />
        ) : (
          <span>{(node.attrs.title as string) || "Спойлер"}</span>
        )}
      </div>
      <div className="p-2">
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
}