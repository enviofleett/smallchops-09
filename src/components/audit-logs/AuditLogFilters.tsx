
import React from "react";

const CATEGORIES = ["All", "Order Management", "User Management", "Security", "System Maintenance", "Communication"];
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
      className="flex flex-col sm:flex-row flex-wrap items-end gap-3"
      onSubmit={(e) => e.preventDefault()}
    >
      {/* Category */}
      <div className="w-full sm:w-auto">
        <label className="block text-xs font-medium mb-1">Category</label>
        <select
          className="border rounded px-3 py-2 text-sm w-full sm:w-auto min-w-[120px]"
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
        >
          {CATEGORIES.map((c) => (
            <option value={c === "All" ? "" : c} key={c}>{c}</option>
          ))}
        </select>
      </div>
      {/* User */}
      <div className="w-full sm:w-auto">
        <label className="block text-xs font-medium mb-1">User</label>
        <input
          type="text"
          placeholder="Name or email"
          className="border rounded px-3 py-2 text-sm w-full sm:w-auto min-w-[140px]"
          value={filters.user}
          onChange={(e) => onChange({ ...filters, user: e.target.value })}
        />
      </div>
      {/* Date From */}
      <div className="w-full sm:w-auto">
        <label className="block text-xs font-medium mb-1">From</label>
        <input
          type="date"
          className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
        />
      </div>
      {/* Date To */}
      <div className="w-full sm:w-auto">
        <label className="block text-xs font-medium mb-1">To</label>
        <input
          type="date"
          className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
          value={filters.dateTo}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
        />
      </div>
      {/* Search */}
      <div className="flex-1 min-w-[160px] w-full sm:w-auto">
        <label className="block text-xs font-medium mb-1">Search</label>
        <input
          type="text"
          placeholder="Action, entity, message"
          className="border rounded px-3 py-2 w-full text-sm"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
    </form>
  );
};

export default AuditLogFilters;
