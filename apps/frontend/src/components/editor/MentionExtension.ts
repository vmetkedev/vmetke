import { Node, mergeAttributes } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { mentionSuggestion } from "./mentionSuggestion";
import { PluginKey } from "@tiptap/pm/state";

export interface MentionOptions {
  HTMLAttributes: Record<string, any>;
}

export const MentionExtension = Node.create<MentionOptions>({
  name: "mention",

  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      username: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-username"),
        renderHTML: (attributes) => ({
          "data-username": attributes.username,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-mention]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        { "data-mention": "", class: "text-blue-500 font-medium" },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      `@${node.attrs.username}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.username}`;
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`@${node.attrs.username}`);
        },
        parse: {},
      },
    };
  },

  addProseMirrorPlugins() {
  return [
    Suggestion({
      editor: this.editor,
      char: "@",
      pluginKey: new PluginKey("mentionSuggestion"),
      command: ({ editor, range, props }) => {
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: this.name, attrs: props },
            { type: "text", text: " " },
          ])
          .run();
      },
      ...mentionSuggestion,
    }),
  ];
},
});