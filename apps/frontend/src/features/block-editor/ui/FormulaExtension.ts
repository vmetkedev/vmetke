import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FormulaComponent } from "./FormulaComponent";

export const FormulaExtension = Node.create({
  name: "formula",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      latex: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="formula"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "formula" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FormulaComponent);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write("$$\n" + (node.attrs.latex || "") + "\n$$\n\n");
          state.closeBlock(node);
        },
      },
    };
  },
});