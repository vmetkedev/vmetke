import { AppLayout } from "../../components/AppLayout";

export default function WysiwygHelpPage() {
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <h1 className="text-xl font-semibold dark:text-gray-100">Справка: визуальный редактор (WYSIWYG)</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          В визуальном режиме пост оформляется через панель инструментов и меню команд, без ручного ввода разметки.
        </p>

        <Section title='Меню команд ("/")'>
          Введите <code className="bg-gray-100 dark:bg-gray-900 rounded px-1 text-xs">/</code> в начале строки, чтобы
          открыть меню и вставить заголовок, список, цитату, таблицу, блок кода, формулу, спойлер, якорь или упоминание.
        </Section>

        <Section title="Упоминание пользователя">
          Введите <code className="bg-gray-100 dark:bg-gray-900 rounded px-1 text-xs">@</code> и начните печатать имя —
          появится список пользователей для выбора.
        </Section>

        <Section title="Таблицы">
          При наведении на таблицу появляется панель для добавления/удаления строк и столбцов, а также объединения ячеек.
        </Section>

        <Section title="Блок кода">
          В правом верхнем углу блока кода можно выбрать язык подсветки синтаксиса.
        </Section>

        <Section title="Формула">
          Кликните по формуле, чтобы отредактировать LaTeX-выражение.
        </Section>

        <Section title="Якорь">
          Кликните по якорю, чтобы переименовать его.
        </Section>

        <Section title="Изображения">
          Вставляются по прямой ссылке (URL) на изображение.
        </Section>
      </div>
    </AppLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="text-sm font-medium dark:text-gray-200">{title}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">{children}</p>
    </div>
  );
}