"use client";

import { useState } from "react";

export type Priority = "Baixa" | "Média" | "Alta";
export type RecurrencePreset = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";

type Props = {
  open: boolean;
  isEditing: boolean;
  taskTitle: string;
  description: string;
  priority: Priority;
  dueDate: string;
  useDefaultDate: boolean;
  dueTime: string;
  recurrenceStartDate: string;
  recurrenceEndDate: string;
  reminderMinutes: number | null;
  recurrencePreset: RecurrencePreset;
  recurrenceCustom: string;
  done: boolean;
  syncGoogle: boolean;
  googleEventId: string | null;
  saving: boolean;
  message: string;
  onTaskTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onPriorityChange: (v: Priority) => void;
  onDueDateChange: (v: string) => void;
  onUseDefaultDateChange: (v: boolean) => void;
  onDueTimeChange: (v: string) => void;
  onRecurrenceStartDateChange: (v: string) => void;
  onRecurrenceEndDateChange: (v: string) => void;
  onReminderMinutesChange: (v: number | null) => void;
  onRecurrencePresetChange: (v: RecurrencePreset) => void;
  onRecurrenceCustomChange: (v: string) => void;
  onDoneChange: (v: boolean) => void;
  onSyncGoogleChange: (v: boolean) => void;
  onSubmit: () => void;
  onClose: () => void;
};

function priorityPill(p: Priority) {
  if (p === "Alta") return "bg-red-500/20 text-red-100 border-red-400/30";
  if (p === "Média") return "bg-amber-500/20 text-amber-100 border-amber-400/30";
  return "bg-emerald-500/20 text-emerald-100 border-emerald-400/30";
}

function PrioritySelect({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (v: Priority) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: Priority[] = ["Baixa", "Média", "Alta"];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none flex items-center justify-between hover:bg-white/10 transition"
      >
        <span className={["px-3 py-1 rounded-full border font-medium", priorityPill(value)].join(" ")}>
          {value}
        </span>
        <span className="text-slate-300">▾</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-label="fechar"
          />
          <div className="absolute z-50 mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur p-2 shadow-xl">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={[
                  "w-full flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/10 transition",
                  opt === value ? "bg-white/10" : "",
                ].join(" ")}
              >
                <span className={["px-3 py-1 rounded-full border font-medium", priorityPill(opt)].join(" ")}>
                  {opt}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type SelectOption<T extends string> = {
  label: string;
  value: T;
};

function DropdownSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((opt) => opt.value === value) ?? options[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left outline-none flex items-center justify-between hover:bg-white/10 transition"
      >
        <span>{selected?.label}</span>
        <span className="text-slate-300">▾</span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-label="fechar"
          />
          <div className="absolute z-50 mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur p-2 shadow-xl">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={[
                  "w-full rounded-xl px-3 py-2 text-left hover:bg-white/10 transition",
                  opt.value === value ? "bg-white/10" : "",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function shortEventId(id: string | null) {
  if (!id) return "";
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}...${id.slice(-6)}`;
}

export default function TaskConfigModal(props: Props) {
  const {
    open,
    isEditing,
    taskTitle,
    description,
    priority,
    dueDate,
    useDefaultDate,
    dueTime,
    recurrenceStartDate,
    recurrenceEndDate,
    reminderMinutes,
    recurrencePreset,
    recurrenceCustom,
    done,
    syncGoogle,
    googleEventId,
    saving,
    message,
    onTaskTitleChange,
    onDescriptionChange,
    onPriorityChange,
    onDueDateChange,
    onUseDefaultDateChange,
    onDueTimeChange,
    onRecurrenceStartDateChange,
    onRecurrenceEndDateChange,
    onReminderMinutesChange,
    onRecurrencePresetChange,
    onRecurrenceCustomChange,
    onDoneChange,
    onSyncGoogleChange,
    onSubmit,
    onClose,
  } = props;

  if (!open) return null;

  const reminderValue =
    reminderMinutes === null ? "default" : String(reminderMinutes);
  const reminderOptions: SelectOption<string>[] = [
    { value: "default", label: "Padrão do Google" },
    { value: "5", label: "5 min antes" },
    { value: "10", label: "10 min antes" },
    { value: "15", label: "15 min antes" },
    { value: "30", label: "30 min antes" },
    { value: "60", label: "1 hora antes" },
    { value: "120", label: "2 horas antes" },
    { value: "1440", label: "1 dia antes" },
  ];
  const recurrenceOptions: SelectOption<RecurrencePreset>[] = [
    { value: "none", label: "Sem recorrência" },
    { value: "daily", label: "Diária" },
    { value: "weekly", label: "Semanal" },
    { value: "monthly", label: "Mensal" },
    { value: "yearly", label: "Anual" },
    { value: "custom", label: "Personalizada (RRULE)" },
  ];

  return (
    <>
      <button className="fixed inset-0 bg-black/60 z-40" onClick={onClose} aria-label="Fechar" />
      <div className="fixed z-50 inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur p-6">
          <div className="text-lg font-semibold">{isEditing ? "Editar Tarefa" : "Nova Tarefa"}</div>

          <div className="mt-4 grid gap-4">
            <div>
              <div className="text-sm text-slate-300 mb-2">Título</div>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                placeholder="Digite o título da tarefa"
                value={taskTitle}
                onChange={(e) => onTaskTitleChange(e.target.value)}
                maxLength={120}
              />
              <div className="mt-1 text-xs text-slate-400">{taskTitle.trim().length}/120</div>
            </div>

            <div>
              <div className="text-sm text-slate-300 mb-2">Descrição</div>
              <textarea
                className="w-full min-h-[110px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                placeholder="Adicione detalhes sobre a tarefa"
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm text-slate-300 mb-2">Prioridade</div>
                <PrioritySelect value={priority} onChange={onPriorityChange} />
              </div>

              <div>
                <div className="text-sm text-slate-300 mb-2">Data de Vencimento</div>
                <label className="mb-2 inline-flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={useDefaultDate}
                    onChange={(e) => onUseDefaultDateChange(e.target.checked)}
                    className="h-4 w-4 accent-violet-500"
                  />
                  Usar data padrão (hoje)
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                  value={dueDate}
                  onChange={(e) => onDueDateChange(e.target.value)}
                  disabled={useDefaultDate}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDueDateChange(new Date().toISOString().slice(0, 10))}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      onDueDateChange(d.toISOString().slice(0, 10));
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                  >
                    Amanhã
                  </button>
                  <button
                    type="button"
                    onClick={() => onDueDateChange("")}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm text-slate-300 mb-2">Hora</div>
                <input
                  type="text"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                  value={dueTime}
                  onChange={(e) => {
                    const next = e.target.value.replace(/[^\d:]/g, "").slice(0, 5);
                    onDueTimeChange(next);
                  }}
                  placeholder="HH:MM"
                />
              </div>
              <div>
                <div className="text-sm text-slate-300 mb-2">Lembrete</div>
                <DropdownSelect
                  value={reminderValue}
                  options={reminderOptions}
                  onChange={(v) =>
                    onReminderMinutesChange(v === "default" ? null : Number(v))
                  }
                />
              </div>
              <div>
                <div className="text-sm text-slate-300 mb-2">Recorrência</div>
                <DropdownSelect
                  value={recurrencePreset}
                  options={recurrenceOptions}
                  onChange={onRecurrencePresetChange}
                />
              </div>
            </div>

            {recurrencePreset !== "none" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-slate-300 mb-2">Início da Recorrência</div>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                    value={recurrenceStartDate}
                    onChange={(e) => onRecurrenceStartDateChange(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-sm text-slate-300 mb-2">Fim da Recorrência (opcional)</div>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                    value={recurrenceEndDate}
                    onChange={(e) => onRecurrenceEndDateChange(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {recurrencePreset === "custom" ? (
              <div>
                <div className="text-sm text-slate-300 mb-2">RRULE personalizada</div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                  placeholder="Ex: RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
                  value={recurrenceCustom}
                  onChange={(e) => onRecurrenceCustomChange(e.target.value)}
                />
              </div>
            ) : null}

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <label className="inline-flex items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => onDoneChange(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                Marcar como concluída
              </label>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <label className="inline-flex items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={syncGoogle}
                  onChange={(e) => onSyncGoogleChange(e.target.checked)}
                  className="h-4 w-4 accent-violet-500"
                />
                Sincronizar com Agenda
              </label>
              <p className="mt-1 text-xs text-slate-400">
                Requer data de vencimento e login com Google.
              </p>
              {googleEventId ? (
                <p className="mt-1 text-xs text-emerald-300">
                  Evento vinculado: {shortEventId(googleEventId)}
                </p>
              ) : null}
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={onSubmit}
                disabled={saving}
                className="rounded-xl bg-violet-600/90 px-6 py-3 font-medium hover:bg-violet-500 transition border border-white/10 disabled:opacity-60"
              >
                {saving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Tarefa"}
              </button>

              <button
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 hover:bg-white/10 transition disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>

            {message ? <div className="text-sm text-red-300">{message}</div> : null}
          </div>
        </div>
      </div>
    </>
  );
}
