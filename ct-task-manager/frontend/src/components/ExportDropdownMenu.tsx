import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import './ExportDropdownMenu.css';

export interface ExportDropdownMenuProps {
  onExport: (format: 'excel' | 'pdf' | 'csv') => void | Promise<void>;
  isExporting?: boolean;
  disabled?: boolean;
  label?: string;
  selectedCount?: number;
  align?: 'left' | 'right';
  className?: string;
}

export const ExportDropdownMenu: React.FC<ExportDropdownMenuProps> = ({
  onExport,
  isExporting = false,
  disabled = false,
  label = 'Export',
  selectedCount,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleSelect = (format: 'excel' | 'pdf' | 'csv') => {
    setIsOpen(false);
    onExport(format);
  };

  return (
    <div className={`ct-export-dropdown-wrapper ${className}`} ref={containerRef}>
      <button
        type="button"
        className="ct-export-btn"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        title="Export data in multiple formats (Excel, PDF, CSV)"
      >
        {isExporting ? (
          <>
            <Loader2 size={15} className="ct-export-spin" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <Download size={15} />
            <span>{selectedCount ? `${label} (${selectedCount})` : label}</span>
            <ChevronDown size={13} className={isOpen ? 'ct-export-chevron-open' : ''} />
          </>
        )}
      </button>

      {isOpen && (
        <div className={`ct-export-menu align-${align}`}>
          <div className="ct-export-menu-header">
            <span>Export Format</span>
            {selectedCount ? (
              <span className="ct-export-badge">{selectedCount} Selected</span>
            ) : null}
          </div>

          <button
            type="button"
            className="ct-export-item"
            onClick={() => handleSelect('excel')}
          >
            <FileSpreadsheet size={16} className="ct-export-icon-excel" />
            <div className="ct-export-item-text">
              <strong>Excel Spreadsheet (.xlsx)</strong>
              <span>Formatted workbook with CTU branding</span>
            </div>
          </button>

          <button
            type="button"
            className="ct-export-item"
            onClick={() => handleSelect('pdf')}
          >
            <FileText size={16} className="ct-export-icon-pdf" />
            <div className="ct-export-item-text">
              <strong>PDF Document (.pdf)</strong>
              <span>Official printable report with header</span>
            </div>
          </button>

          <button
            type="button"
            className="ct-export-item"
            onClick={() => handleSelect('csv')}
          >
            <Download size={16} className="ct-export-icon-csv" />
            <div className="ct-export-item-text">
              <strong>CSV Data (.csv)</strong>
              <span>Raw table data for external software</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportDropdownMenu;
