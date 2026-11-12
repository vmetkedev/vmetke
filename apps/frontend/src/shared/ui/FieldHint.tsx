import { useState } from "react";
import { Info } from "lucide-react";

export function FieldHint({ text, className = "" }: { text: string; className?: string }) {
  const [show, setShow] = useState(false);

  return (
    <span className={`inline-flex ${className}`}>
      <Info
        size={18}
        className="text-gray-400 hover:text-gray-600 cursor-help"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <span className="absolute right-0 bottom-full mb-2 w-52 rounded-md bg-gray-800 text-white text-xs leading-snug px-3 py-2 shadow-lg z-10">
          {text}
        </span>
      )}
    </span>
  );
}