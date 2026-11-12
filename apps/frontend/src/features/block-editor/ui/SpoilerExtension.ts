import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { SpoilerComponent } from "./SpoilerComponent";

export const SpoilerExtension = Node.create({
  name: "spoiler",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      title: { default: "Спойлер" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="spoiler"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "spoiler" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SpoilerComponent);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`::: spoiler ${node.attrs.title || "Спойлер"}\n`);
          state.renderContent(node);
          state.write(":::\n\n");
          state.closeBlock(node);
        },
      },
    };
  },
});