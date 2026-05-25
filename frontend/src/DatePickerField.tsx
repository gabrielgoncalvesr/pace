import { useEffect, useMemo, useRef, useState } from 'react';

type DatePickerFieldProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function toIsoDate(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value?: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPtBr(value?: string): string {
  const date = parseIsoDate(value);
  if (!date) return '';
  return date.toLocaleDateString('pt-BR');
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DatePickerField({ value, onChange, placeholder = 'Selecione uma data', disabled }: DatePickerFieldProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => selectedDate ?? new Date());

  useEffect(() => {
    if (selectedDate) setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: Array<{ date: Date; currentMonth: boolean }> = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, prevMonthDays - i), currentMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), currentMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const next = cells.length - (firstWeekday + daysInMonth) + 1;
    cells.push({ date: new Date(year, month + 1, next), currentMonth: false });
  }

  const monthLabel = visibleMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const today = new Date();

  return (
    <div className="date-picker" ref={rootRef}>
      <button
        type="button"
        className="date-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className="date-trigger-icon">📅</span>
        <span className={value ? 'date-value' : 'date-placeholder'}>{value ? formatPtBr(value) : placeholder}</span>
      </button>

      {open ? (
        <div className="date-popover">
          <div className="date-popover-header">
            <button type="button" className="date-nav-btn" onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}>‹</button>
            <strong>{monthLabel}</strong>
            <button type="button" className="date-nav-btn" onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}>›</button>
          </div>

          <div className="date-grid-head">
            {WEEK_DAYS.map((label, i) => <span key={`${label}-${i}`}>{label}</span>)}
          </div>

          <div className="date-grid-body">
            {cells.map(({ date, currentMonth }, idx) => {
              const iso = toIsoDate(date);
              const selected = selectedDate ? isSameDay(date, selectedDate) : false;
              const isToday = isSameDay(date, today);
              return (
                <button
                  key={`${iso}-${idx}`}
                  type="button"
                  className={`date-cell ${currentMonth ? '' : 'date-cell-muted'} ${selected ? 'date-cell-selected' : ''} ${isToday ? 'date-cell-today' : ''}`}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
