import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostComposer } from "./PostComposer";
import * as postsLib from "../lib/posts";
import * as authContext from "../auth/AuthContext";

vi.mock("../lib/posts");
vi.mock("../auth/AuthContext");

const mockUser = { username: "admin", avatarColor: "#123456" };

describe("PostComposer", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(authContext.useAuth).mockReturnValue({ user: mockUser } as any);
    vi.mocked(postsLib.createPost).mockResolvedValue({} as any);
  });

  it("ограничивает заголовок 100 символами (атрибут maxLength)", () => {
    render(<PostComposer mode="wysiwyg" editorKey={0} onPosted={vi.fn()} />);
    const input = screen.getByPlaceholderText("Заголовок") as HTMLInputElement;
    expect(input.maxLength).toBe(100);
  });

  it("не показывает счётчик символов текста поста", () => {
    render(<PostComposer mode="markdown" editorKey={0} onPosted={vi.fn()} />);
    expect(screen.queryByText(/\/55000/)).not.toBeInTheDocument();
  });

  it("кнопка 'Опубликовать' отключена, пока пустой заголовок или текст", () => {
    render(<PostComposer mode="markdown" editorKey={0} onPosted={vi.fn()} />);
    const button = screen.getByText("Опубликовать");
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Заголовок"), {
      target: { value: "Заголовок" },
    });
    expect(button).toBeDisabled(); // текста ещё нет

    fireEvent.change(screen.getByPlaceholderText("Введите текст"), {
      target: { value: "Текст поста" },
    });
    expect(button).not.toBeDisabled();
  });

  it("вызывает createPost и onPosted при успешной публикации", async () => {
    const onPosted = vi.fn();
    render(<PostComposer mode="markdown" editorKey={0} onPosted={onPosted} />);

    fireEvent.change(screen.getByPlaceholderText("Заголовок"), {
      target: { value: "Заголовок" },
    });
    fireEvent.change(screen.getByPlaceholderText("Введите текст"), {
      target: { value: "Текст поста" },
    });
    fireEvent.click(screen.getByText("Опубликовать"));

    await waitFor(() => {
      expect(postsLib.createPost).toHaveBeenCalledWith("Заголовок", "Текст поста", []);
      expect(onPosted).toHaveBeenCalledTimes(1);
    });
  });

  it("очищает черновик из localStorage после успешной публикации", async () => {
    localStorage.setItem(
      "vmetke:draft:new-post",
      JSON.stringify({ title: "Старый", content: "Черновик", savedAt: 1 })
    );
    render(<PostComposer mode="markdown" editorKey={0} onPosted={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Заголовок"), {
      target: { value: "Новый заголовок" },
    });
    fireEvent.change(screen.getByPlaceholderText("Введите текст"), {
      target: { value: "Новый текст" },
    });
    fireEvent.click(screen.getByText("Опубликовать"));

    await waitFor(() => {
      expect(localStorage.getItem("vmetke:draft:new-post")).toBeNull();
    });
  });

  it("показывает сообщение об ошибке при сбое createPost", async () => {
    vi.mocked(postsLib.createPost).mockRejectedValue(new Error("Ошибка сети"));
    render(<PostComposer mode="markdown" editorKey={0} onPosted={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Заголовок"), {
      target: { value: "Заголовок" },
    });
    fireEvent.change(screen.getByPlaceholderText("Введите текст"), {
      target: { value: "Текст" },
    });
    fireEvent.click(screen.getByText("Опубликовать"));

    await waitFor(() => {
      expect(screen.getByText("Ошибка сети")).toBeInTheDocument();
    });
  });

  it("показывает баннер восстановления, если есть сохранённый черновик", () => {
    localStorage.setItem(
      "vmetke:draft:new-post",
      JSON.stringify({ title: "Черновик", content: "Текст", savedAt: Date.now() })
    );
    render(<PostComposer mode="markdown" editorKey={0} onPosted={vi.fn()} />);
    expect(
      screen.getByText(/У вас есть резервное сохранение материала/)
    ).toBeInTheDocument();
  });

  it("восстанавливает заголовок и текст при клике 'Восстановить'", () => {
    localStorage.setItem(
      "vmetke:draft:new-post",
      JSON.stringify({ title: "Черновик X", content: "Текст Y", savedAt: Date.now() })
    );
    render(<PostComposer mode="markdown" editorKey={0} onPosted={vi.fn()} />);

    fireEvent.click(screen.getByText("Восстановить"));

    expect(screen.getByPlaceholderText("Заголовок")).toHaveValue("Черновик X");
    expect(screen.getByPlaceholderText("Введите текст")).toHaveValue("Текст Y");
    expect(
      screen.queryByText(/У вас есть резервное сохранение материала/)
    ).not.toBeInTheDocument();
  });
});