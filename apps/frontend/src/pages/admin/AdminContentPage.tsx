import { useMemo, useState } from "react";
import { AdminCommentsList } from "./AdminCommentsList";
import { AdminPostsList } from "./AdminPostsList";
import { useDebounced } from "./adminShared";

const INPUT =
  "border rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100";

type Tab = "posts" | "comments";

export function AdminContentPage() {
  const [tab, setTab] = useState<Tab>("posts");
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const q = useDebounced(search.trim(), 300);
  const authorName = useDebounced(author.trim().replace(/^@/, ""), 300);
  const filter = useMemo(() => ({ q, author: authorName, from, to }), [q, authorName, from, to]);

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-md ${
      active
        ? "bg-gray-200 dark:bg-gray-700 font-medium dark:text-gray-100"
        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
    }`;

  return (
    <div>
      <h1 className="text-xl font-semibold dark:text-gray-100">Контент</h1>

      <div className="mt-3 flex gap-1">
        <button className={tabCls(tab === "posts")} aria-pressed={tab === "posts"} onClick={() => setTab("posts")}>
          Посты
        </button>
        <button
          className={tabCls(tab === "comments")}
          aria-pressed={tab === "comments"}
          onClick={() => setTab("comments")}
        >
          Комментарии
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          aria-label="Поиск"
          placeholder="Поиск по тексту"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${INPUT} flex-1 min-w-40`}
        />
        <input
          aria-label="Автор (username)"
          placeholder="Автор"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className={`${INPUT} w-40`}
        />
        <input
          aria-label="С даты"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={INPUT}
        />
        <input
          aria-label="По дату"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={INPUT}
        />
      </div>

      {tab === "posts" ? <AdminPostsList filter={filter} /> : <AdminCommentsList filter={filter} />}
    </div>
  );
}