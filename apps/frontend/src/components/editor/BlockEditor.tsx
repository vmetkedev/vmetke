import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import { Markdown } from "tiptap-markdown";
import { SlashCommandExtension } from "./SlashCommandExtension";
import { CodeBlockComponent } from "./CodeBlockComponent";
import { TableToolbar } from "./TableToolbar";
import { FormulaExtension } from "./FormulaExtension";
import { InlineFormulaExtension } from "./InlineFormulaExtension";
import { SpoilerExtension } from "./SpoilerExtension";
import { AnchorExtension } from "./AnchorExtension";

const lowlight = createLowlight(common);

function fixInlineFormulas(editor: any) {
  const { state } = editor;
  const { doc, schema } = state;
  const matches: { from: number; to: number; latex: string }[] = [];

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    const text = node.text || "";
    const regex = /\$([^$\n]+)\$/g;
    let m;
    while ((m = regex.exec(text))) {
      matches.push({ from: pos + m.index, to: pos + m.index + m[0].length, latex: m[1] });
    }
  });

  if (matches.length === 0) return;

  const tr = state.tr;
  for (let idx = matches.length - 1; idx >= 0; idx--) {
    const { from, to, latex } = matches[idx];
    const inlineNode = schema.nodes.inlineFormula.create({ latex });
    tr.replaceWith(from, to, inlineNode);
  }
  editor.view.dispatch(tr);
}

function fixFormulaParagraphs(editor: any) {
  const { state } = editor;
  const { doc, schema } = state;
  const replacements: { pos: number; nodeSize: number; latex: string }[] = [];

  doc.descendants((node: any, pos: number) => {
    if (node.type.name === "paragraph" && node.childCount === 1 && node.firstChild?.isText) {
      const text = node.textContent.trim();
      const match = text.match(/^\$\$\s*([\s\S]+?)\s*\$\$$/);
      if (match) {
        replacements.push({ pos, nodeSize: node.nodeSize, latex: match[1] });
      }
    }
  });

  if (replacements.length === 0) return;

  const tr = state.tr;
  for (let idx = replacements.length - 1; idx >= 0; idx--) {
    const { pos, nodeSize, latex } = replacements[idx];
    const formulaNode = schema.nodes.formula.create({ latex });
    tr.replaceWith(pos, pos + nodeSize, formulaNode);
  }
  editor.view.dispatch(tr);
}

type BlockEditorProps = {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
};

export function BlockEditor({ content, onChange, placeholder }: BlockEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent);
        },
      }).configure({ lowlight }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      FormulaExtension,
      InlineFormulaExtension,
      SpoilerExtension,
      AnchorExtension,
      Image.configure({
        HTMLAttributes: { class: "max-w-full rounded my-2" },
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Нажмите "/" для вызова меню',
      }),
      SlashCommandExtension,
    ],
    content,
    onCreate: ({ editor }) => {
      setTimeout(() => {
        fixFormulaParagraphs(editor);
        fixInlineFormulas(editor);
      }, 0);
    },
    onUpdate: ({ editor }) => {
      const markdown = (editor.storage as any).markdown.getMarkdown();
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[200px] focus:outline-none text-sm text-gray-700 dark:text-gray-300 " +
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-gray-900 dark:[&_h1]:text-gray-100 " +
          "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-gray-900 dark:[&_h2]:text-gray-100 " +
          "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-gray-900 dark:[&_h3]:text-gray-100 " +
          "[&_p]:my-1 " +
          "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-600 dark:[&_blockquote]:text-gray-400 [&_blockquote]:my-1 " +
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 " +
          "[&_hr]:border-gray-300 dark:[&_hr]:border-gray-600 [&_hr]:my-4 " +
          "[&_code]:bg-gray-100 dark:[&_code]:bg-gray-900 [&_code]:rounded [&_code]:px-1 [&_code]:text-xs " +
          "[&_pre]:bg-gray-100 dark:[&_pre]:bg-gray-900 [&_pre]:rounded [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:px-0",
      },
    },
  });

  return (
    <>
      {editor && <TableToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </>
  );
}