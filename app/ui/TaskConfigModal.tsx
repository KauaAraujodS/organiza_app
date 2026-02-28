"use client";

import { useState } from "react";
import ModalShell from "./ModalShell";

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
  if (p === "Alta") return "bg-red-500/20 text-red-300 border-red-400/35";
  if (p === "Média") return "bg-amber-500/20 text-amber-300 border-amber-400/35";
  return "bg-emerald-500/20 text-emerald-300 border-emerald-400/35";
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
        className="modal-field flex items-center justify-between"
      >
        <span className={["px-3 py-1 rounded-full border font-medium", priorityPill(value)].join(" ")}>
          {value}
        </span>
        <span className="modal-muted">▾</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-label="fechar"
          />
          <div className="modal-menu absolute z-50 mt-2 w-full rounded-2xl p-2">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={[
                  "w-full flex items-center gap-2 rounded-xl px-3 py-2 transition",
                  opt === value ? "bg-white/15" : "hover:bg-white/10",
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
        className="modal-field flex items-center justify-between text-left"
      >
        <span>{selected?.label}</span>
        <span className="modal-muted">▾</span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-label="fechar"
          />
          <div className="modal-menu absolute z-50 mt-2 w-full rounded-2xl p-2">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={[
                  "w-full rounded-xl px-3 py-2 text-left transition",
                  opt.value === value ? "bg-white/15" : "hover:bg-white/10",
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
    <ModalShell
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar Tarefa" : "Nova Tarefa"}
      subtitle="Defina prioridade, vencimento, recorrência e sincronização."
      maxWidthClass="max-w-3xl"
      footer={null}
    >
      <div className="mt-1 grid gap-4">
        <div>
          <div className="modal-label mb-2 text-sm">Título</div>
          <input
            className="modal-field"
            placeholder="Digite o título da tarefa"
            value={taskTitle}
            onChange={(e) => onTaskTitleChange(e.target.value)}
            maxLength={120}
          />
          <div className="modal-muted mt-1 text-xs">{taskTitle.trim().length}/120</div>
        </div>

        <div>
          <div className="modal-label mb-2 text-sm">Descrição</div>
          <textarea
            className="modal-field w-full min-h-[110px]"
            placeholder="Adicione detalhes sobre a tarefa"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="modal-label mb-2 text-sm">Prioridade</div>
                <PrioritySelect value={priority} onChange={onPriorityChange} />
              </div>

              <div>
                <div className="modal-label mb-2 text-sm">Data de Vencimento</div>
                <label className="modal-muted mb-2 inline-flex items-center gap-2 text-xs">
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
                  className="modal-field"
                  value={dueDate}
                  onChange={(e) => onDueDateChange(e.target.value)}
                  disabled={useDefaultDate}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDueDateChange(new Date().toISOString().slice(0, 10))}
                    className="app-button-ghost rounded-lg px-3 py-1.5 text-xs"
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
                    className="app-button-ghost rounded-lg px-3 py-1.5 text-xs"
                  >
                    Amanhã
                  </button>
                  <button
                    type="button"
                    onClick={() => onDueDateChange("")}
                    className="app-button-ghost rounded-lg px-3 py-1.5 text-xs"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="modal-label mb-2 text-sm">Hora</div>
                <input
                  type="text"
                  className="modal-field"
                  value={dueTime}
                  onChange={(e) => {
                    const next = e.target.value.replace(/[^\d:]/g, "").slice(0, 5);
                    onDueTimeChange(next);
                  }}
                  placeholder="HH:MM"
                />
              </div>
              <div>
                <div className="modal-label mb-2 text-sm">Lembrete</div>
                <DropdownSelect
                  value={reminderValue}
                  options={reminderOptions}
                  onChange={(v) =>
                    onReminderMinutesChange(v === "default" ? null : Number(v))
                  }
                />
              </div>
              <div>
                <div className="modal-label mb-2 text-sm">Recorrência</div>
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
                  <div className="modal-label mb-2 text-sm">Início da Recorrência</div>
                  <input
                    type="date"
                    className="modal-field"
                    value={recurrenceStartDate}
                    onChange={(e) => onRecurrenceStartDateChange(e.target.value)}
                  />
                </div>
                <div>
                  <div className="modal-label mb-2 text-sm">Fim da Recorrência (opcional)</div>
                  <input
                    type="date"
                    className="modal-field"
                    value={recurrenceEndDate}
                    onChange={(e) => onRecurrenceEndDateChange(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {recurrencePreset === "custom" ? (
              <div>
                <div className="modal-label mb-2 text-sm">RRULE personalizada</div>
                <input
                  className="modal-field"
                  placeholder="Ex: RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
                  value={recurrenceCustom}
                  onChange={(e) => onRecurrenceCustomChange(e.target.value)}
                />
              </div>
            ) : null}

            <div className="modal-soft-box rounded-xl px-4 py-3">
              <label className="modal-label inline-flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => onDoneChange(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                Marcar como concluída
              </label>
            </div>

            <div className="modal-soft-box rounded-xl px-4 py-3">
              <label className="modal-label inline-flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={syncGoogle}
                  onChange={(e) => onSyncGoogleChange(e.target.checked)}
                  className="h-4 w-4 accent-violet-500"
                />
                Sincronizar com Agenda
              </label>
              <p className="modal-muted mt-1 text-xs">
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
                className="app-button rounded-xl px-6 py-3 font-medium transition disabled:opacity-60"
              >
                {saving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Tarefa"}
              </button>

              <button
                onClick={onClose}
                disabled={saving}
                className="app-button-ghost rounded-xl px-6 py-3 transition disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>

            {message ? <div className="text-sm text-red-300">{message}</div> : null}
      </div>
    </ModalShell>
  );
}
