// v1.10.37 — Reusable page-header card. Reported: "I like the heading
// that you gave into this page — I want you to do in all the pages,
// that looks better". Extracted from the SettingsView v1.10.36 header
// so every page gets a consistent visual identity: gradient card +
// icon badge + title + subtitle + optional meta chip + right-side
// action slot.
//
// Props:
//   icon        emoji / string / element rendered inside the 44px badge
//   title       page title (h1)
//   subtitle    one-line description shown below the title
//   meta        optional short string rendered as a pill next to the
//               subtitle (e.g. "231 invoices", "11 sections", "FY 2025-26")
//   children    right-hand slot for action buttons, HelpButton, etc.
//   compact     v1.10.77 (#84): a slim title row, no card, icon or subtitle,
//               for screens where the table needs the room (the Dashboard).

export default function PageHeader({ icon, title, subtitle, meta, children, compact = false }) {
  if (compact) {
    return (
      <div className="page-header page-header-compact">
        <h1 className="page-title">{title}</h1>
        {meta && <span className="page-header-meta">{meta}</span>}
        <div className="page-header-actions">{children}</div>
      </div>
    );
  }
  return (
    <div className="page-header">
      <div className="page-header-row">
        {icon !== undefined && (
          <div className="page-header-icon">{icon}</div>
        )}
        <div className="page-header-titles">
          <h1 className="page-title">{title}</h1>
          {(subtitle || meta) && (
            <p className="page-subtitle">
              {subtitle && <span>{subtitle}</span>}
              {meta && (
                <span className="page-header-meta">{meta}</span>
              )}
            </p>
          )}
        </div>
        {children && <div className="page-header-actions">{children}</div>}
      </div>
    </div>
  );
}
