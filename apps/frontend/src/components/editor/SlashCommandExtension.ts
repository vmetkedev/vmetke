import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { slashSuggestion } from "./slashSuggestion";

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        items: slashSuggestion.items,
        render: slashSuggestion.render,
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});