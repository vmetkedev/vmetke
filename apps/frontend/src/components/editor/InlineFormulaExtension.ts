import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { InlineFormulaComponent } from "./InlineFormulaComponent";

export const InlineFormulaExtension = Node.create({
  name: "inlineFormula",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="inline-formula"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "inline-formula" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineFormulaComponent);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`$${node.attrs.latex || ""}$`);
        },
      },
    };
  },
});