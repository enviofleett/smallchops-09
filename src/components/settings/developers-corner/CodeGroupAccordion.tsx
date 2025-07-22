
import React from "react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import ExampleSection from "./ExampleSection";

interface CodeGroupProps {
  grp: {
    title: string;
    description?: string;
    examples: Array<{ label: string; code: string; notes?: React.ReactNode }>;
  };
  idx: number;
}

const CodeGroupAccordion = ({ grp, idx }: CodeGroupProps) => (
  <AccordionItem value={`devgrp-${idx}`} key={grp.title}>
    <AccordionTrigger className="text-lg font-semibold my-2">{grp.title}</AccordionTrigger>
    <AccordionContent>
      {grp.description && <div className="text-gray-500 text-xs mb-3">{grp.description}</div>}
      {grp.examples.map((ex) => (
        <ExampleSection key={ex.label} label={ex.label} code={ex.code} notes={ex.notes} />
      ))}
    </AccordionContent>
  </AccordionItem>
);

export default CodeGroupAccordion;
