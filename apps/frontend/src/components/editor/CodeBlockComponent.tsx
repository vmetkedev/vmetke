import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";

const LANGUAGE_OPTIONS = [
  { value: "", label: "Обычный текст" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "bash", label: "Bash" },
  { value: "json", label: "JSON" },
  { value: "css", label: "CSS" },
  { value: "html", label: "HTML" },
  { value: "sql", label: "SQL" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
];

export function CodeBlockComponent({ node, updateAttributes }: NodeViewProps) {
  return (
    <NodeViewWrapper className="relative my-2">
      <select
        contentEditable={false}
        value={(node.attrs.language as string) || ""}
        onChange={(e) => updateAttributes({ language: e.target.value })}
        className="absolute top-1.5 right-1.5 text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-1 py-0.5 border-none focus:outline-none z-10"
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <pre className="bg-gray-100 dark:bg-gray-900 rounded p-3 pt-6 overflow-x-auto text-xs">
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}