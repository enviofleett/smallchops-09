
import React from "react";

const CATEGORIES = ["All", "Order", "Product", "Category", "User"];
interface Filters {
  category: string;
  user: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}
interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

const AuditLogFilters: React.FC<Props> = ({ filters, onChange }) => {
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => e.preventDefault()}
    >
      {/* Category */}
      <div>
        <label className="block text-xs font-medium mb-1">Category</label>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
        >
          {CATEGORIES.map((c) => (
            <option value={c === "All" ? "" : c} key={c}>{c}</option>
          ))}
        </select>
      </div>
      {/* User */}
      <div>
        <label className="block text-xs font-medium mb-1">User</label>
        <input
          type="text"
          placeholder="Name or email"
          className="border rounded px-2 py-1 text-sm"
          value={filters.user}
          onChange={(e) => onChange({ ...filters, user: e.target.value })}
        />
      </div>
      {/* Date From */}
      <div>
        <label className="block text-xs font-medium mb-1">From</label>
        <input
          type="date"
          className="border rounded px-2 py-1 text-sm"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
        />
      </div>
      {/* Date To */}
      <div>
        <label className="block text-xs font-medium mb-1">To</label>
        <input
          type="date"
          className="border rounded px-2 py-1 text-sm"
          value={filters.dateTo}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
        />
      </div>
      {/* Search */}
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium mb-1">Search</label>
        <input
          type="text"
          placeholder="Action, entity, message"
          className="border rounded px-2 py-1 w-full text-sm"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
    </form>
  );
};

export default AuditLogFilters;
