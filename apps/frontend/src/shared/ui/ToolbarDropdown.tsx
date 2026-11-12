import { useEffect, useRef, useState } from "react";

export function ToolbarDropdown({
  icon: Icon,
  label,
  active,
  children,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={label}
        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${
          active || open ? "text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-800" : "text-gray-600 dark:text-gray-300"
        }`}
      >
        <Icon size={18} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 flex bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg p-1 gap-1 z-10 whitespace-nowrap">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}