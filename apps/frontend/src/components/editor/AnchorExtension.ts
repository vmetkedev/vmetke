import { Node, mergeAttributes } from "@tiptap/core";

export const AnchorExtension = Node.create({
  name: "anchor",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      name: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="anchor"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "anchor",
        class:
          "inline-flex items-center px-1 text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/30 rounded cursor-pointer select-none",
      }),
      `#${node.attrs.name}`,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`{#${node.attrs.name}}`);
        },
      },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }: any) => {
      const dom = document.createElement("span");
      dom.className =
        "inline-flex items-center px-1 text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/30 rounded cursor-pointer select-none";
      dom.textContent = `#${node.attrs.name}`;
      dom.contentEditable = "false";
      dom.addEventListener("click", () => {
        const newName = window.prompt("Имя якоря:", node.attrs.name);
        if (newName && typeof getPos === "function") {
          editor
            .chain()
            .focus()
            .command(({ tr }: any) => {
              tr.setNodeMarkup(getPos(), undefined, { name: newName });
              return true;
            })
            .run();
        }
      });
      return { dom };
    };
  },
});