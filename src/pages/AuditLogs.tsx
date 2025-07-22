
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import AuditLogFilters from "@/components/audit-logs/AuditLogFilters";
import AuditLogTable from "@/components/audit-logs/AuditLogTable";

const AuditLogs = () => {
  const [filters, setFilters] = useState({
    category: "",
    user: "",
    dateFrom: "",
    dateTo: "",
    search: "",
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Error Logs &amp; Audit Trail</h1>
        <p className="text-gray-500">Track all activity, changes, and errors for improved accountability.</p>
      </div>
      <Card className="mb-6 p-4">
        <AuditLogFilters filters={filters} onChange={setFilters} />
      </Card>
      <AuditLogTable filters={filters} />
    </div>
  );
};

export default AuditLogs;
