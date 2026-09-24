import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { MentionList } from "./MentionList";
import { api } from "../../lib/api";

type MentionItem = { id: string; username: string; displayName: string | null; avatarColor: number | null };

export const mentionSuggestion = {
  items: async ({ query }: { query: string }): Promise<MentionItem[]> => {
    if (!query.trim()) return [];
    try {
      const res = await api.get(`/search?type=users&q=${encodeURIComponent(query)}&limit=5`);
      if (!res.ok) {
        console.error("Mention search failed:", res.status, await res.text());
        return [];
      }
      const data = await res.json();
      return data.results as MentionItem[];
    } catch (err) {
      console.error("Mention search error:", err);
      return [];
    }
  },

  render: () => {
    let component: ReactRenderer;
    let popup: TippyInstance[];

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props: {
            items: props.items,
            command: (item: MentionItem) => props.command({ username: item.username }),
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
          command: (item: MentionItem) => props.command({ username: item.username }),
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