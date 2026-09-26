import { AppLayout } from "../../components/AppLayout";

export default function MarkdownHelpPage() {
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <h1 className="text-xl font-semibold dark:text-gray-100">Справка: Markdown-редактор</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          В Markdown-режиме пост пишется как обычный текст с разметкой. Ниже — поддерживаемый синтаксис vmetke.
        </p>

        <Section title="Заголовки">
          <Code>{"# Заголовок 1\n## Заголовок 2\n### Заголовок 3"}</Code>
        </Section>

        <Section title="Списки">
          <Code>{"- пункт\n- пункт\n\n1. первый\n2. второй"}</Code>
        </Section>

        <Section title="Цитата">
          <Code>{"> текст цитаты"}</Code>
        </Section>

        <Section title="Разделитель">
          <Code>{"---"}</Code>
        </Section>

        <Section title="Таблицы">
          <Code>{"| A | B |\n| - | - |\n| 1 | 2 |"}</Code>
        </Section>

        <Section title="Блок кода">
          <Code>{"```js\nconsole.log('hi');\n```"}</Code>
        </Section>

        <Section title="Формула (блочная)">
          <Code>{"$$\nE = mc^2\n$$"}</Code>
        </Section>

        <Section title="Формула (инлайн)">
          <Code>{"текст $x^2 + y^2 = z^2$ текст"}</Code>
        </Section>

        <Section title="Спойлер">
          <Code>{"::: spoiler Заголовок\nскрытый текст\n:::"}</Code>
        </Section>

        <Section title="Якорь">
          <Code>{"{#название-якоря}"}</Code>
        </Section>

        <Section title="Упоминание">
          <Code>{"@username"}</Code>
        </Section>

        <Section title="Изображение">
          <Code>{"![подпись](https://example.com/image.png)"}</Code>
        </Section>
      </div>
    </AppLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="text-sm font-medium dark:text-gray-200">{title}</h2>
      {children}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-gray-100 dark:bg-gray-900 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap dark:text-gray-300">
      {children}
    </pre>
  );
}