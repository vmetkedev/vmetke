import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { CommandList, COMMAND_ITEMS, type CommandItem } from "./CommandList";

export const slashSuggestion = {
  items: ({ query }: { query: string }) =>
    COMMAND_ITEMS.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())),

  render: () => {
    let component: ReactRenderer;
    let popup: TippyInstance[];

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(CommandList, {
          props: {
            items: props.items,
            command: (item: CommandItem) => item.command({ editor: props.editor, range: props.range }),
          },
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },

      onUpdate(props: any) {
        component.updateProps({
          items: props.items,
          command: (item: CommandItem) => item.command({ editor: props.editor, range: props.range }),
        });
        if (!props.clientRect) return;
        popup[0].setProps({ getReferenceClientRect: props.clientRect });
      },

      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === "Escape") {
          popup[0].hide();
          return true;
        }
        return (component.ref as any)?.onKeyDown(props) ?? false;
      },

      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    };
  },
};