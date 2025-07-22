
import React from "react";
import { Copy } from "lucide-react";

const ExampleSection = ({
  label,
  code,
  notes,
}: {
  label: string;
  code: string;
  notes?: React.ReactNode;
}) => (
  <section className="mb-6">
    <div className="flex items-center justify-between mb-1">
      <h4 className="font-semibold text-sm text-gray-800">{label}</h4>
      <button
        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-xs font-medium"
        onClick={() => {
          navigator.clipboard.writeText(code);
        }}
        aria-label={`Copy ${label} code`}
      >
        <Copy size={14} /> Copy
      </button>
    </div>
    <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto">{code}</pre>
    {notes && <div className="mt-1 text-xs text-gray-600">{notes}</div>}
  </section>
);

export default ExampleSection;
