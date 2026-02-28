"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type DriveEditValues = {
  name: string;
  author: string;
  priority: "Baixa" | "Média" | "Alta";
  color: string; // "#RRGGBB"
  applyColorToChildren?: boolean;
  isLocked: boolean;
  password: string;
  iconEmoji: string;
};

type Props = {
  open: boolean;
  title: string;
  initial: DriveEditValues;
  isFolder: boolean;
  onClose: () => void;
  onSave: (values: DriveEditValues) => Promise<void> | void;
};

const ICONS = [
  "📁",
  "📂",
  "📌",
  "📚",
  "🧾",
  "📄",
  "🗂️",
  "✅",
  "⭐",
  "🔒",
  "🟣",
  "🧩",
  "🪪",
  "📦",
  "🏠",
];

function clampHex(v: string) {
  let x = v.trim();
  if (!x.startsWith("#")) x = "#" + x;
  x = "#" + x.slice(1).replace(/[^0-9a-fA-F]/g, "");
  if (x.length > 7) x = x.slice(0, 7);
  if (x.length === 1) x = "#";
  return x;
}

function toFullHex(v: string) {
  // garante #RRGGBB quando possível
  let x = clampHex(v);
  if (x.length === 4) {
    // #RGB -> #RRGGBB
    const r = x[1],
      g = x[2],
      b = x[3];
    x = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (x.length !== 7) return null;
  return x.toUpperCase();
}

export default function EditDriveItemModal({
  open,
  title,
  initial,
  isFolder,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initial.name);
  const [author, setAuthor] = useState(initial.author);
  const [priority, setPriority] = useState<DriveEditValues["priority"]>(
    initial.priority
  );
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [color, setColor] = useState(initial.color || "#7C3AED");
  const [iconEmoji, setIconEmoji] = useState(initial.iconEmoji || (isFolder ? "📁" : "📄"));
  const [isLocked, setIsLocked] = useState(!!initial.isLocked);
  const [password, setPassword] = useState(initial.password || "");
  const [applyColorToChildren, setApplyColorToChildren] = useState(
    isFolder ? initial.applyColorToChildren ?? true : false
  );

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  const colorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial.name);
    setAuthor(initial.author);
    setPriority(initial.priority);
    setColor(initial.color || "#7C3AED");
    setIconEmoji(initial.iconEmoji || (isFolder ? "📁" : "📄"));
    setIsLocked(!!initial.isLocked);
    setPassword("");
    setApplyColorToChildren(isFolder ? initial.applyColorToChildren ?? true : false);
    setErr("");
    setPriorityOpen(false);
  }, [open, initial, isFolder]);

  const colorFull = useMemo(() => toFullHex(color) || "#7C3AED", [color]);

  function priorityPillClass(p: DriveEditValues["priority"]) {
    if (p === "Alta") return "border-red-400/35 bg-red-500/20 text-red-100";
    if (p === "Média")
      return "border-amber-400/35 bg-amber-500/20 text-amber-100";
    return "border-emerald-400/35 bg-emerald-500/20 text-emerald-100";
  }

  function openPicker() {
    // força o picker abrir no clique do quadradinho
    colorInputRef.current?.click();
  }

  async function handleSave() {
    setErr("");
    if (!name.trim()) {
      setErr("Nome nao pode ficar vazio.");
      return;
    }
    const fixed = toFullHex(color);
    if (!fixed) {
      setErr("Cor inválida. Use HEX no formato #RRGGBB (ex: #7C3AED).");
      return;
    }

    if (isLocked && password.trim().length > 0 && password.trim().length < 4) {
      setErr("Senha precisa ter no mínimo 4 caracteres.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        author: author.trim(),
        priority,
        color: fixed,
        applyColorToChildren,
        isLocked,
        password: password.trim(),
        iconEmoji,
      });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0B1220] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-white/60">
              {isFolder ? "Editar pasta" : "Editar arquivo"}
            </div>
            <div className="text-xl font-semibold">{title}</div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
          >
            Fechar
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Nome */}
          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              placeholder={isFolder ? "Nome da pasta" : "Nome do arquivo"}
            />
            <div className="mt-1 text-xs text-white/50">
              Isso renomeia no Google Drive.
            </div>
          </div>

          {/* Autor */}
          <div>
            <label className="text-sm text-white/70">Autor</label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              placeholder="Ex: Kauã"
            />
            <div className="mt-1 text-xs text-white/50">
              Metadado do app (Supabase).
            </div>
          </div>

          {/* Prioridade */}
          <div className="relative">
            <label className="text-sm text-white/70">Prioridade</label>
            <button
              type="button"
              onClick={() => setPriorityOpen((v) => !v)}
              className="mt-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
            >
              <span
                className={[
                  "rounded-full border px-3 py-1 text-base font-medium",
                  priorityPillClass(priority),
                ].join(" ")}
              >
                {priority}
              </span>
              <span className="text-xs text-white/70">▼</span>
            </button>

            {priorityOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40"
                  onClick={() => setPriorityOpen(false)}
                  aria-label="Fechar seletor de prioridade"
                />
                <div className="absolute z-50 mt-2 w-full rounded-2xl border border-white/10 bg-[#050d28] p-2 shadow-xl">
                  {(["Baixa", "Média", "Alta"] as DriveEditValues["priority"][]).map(
                    (opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setPriority(opt);
                          setPriorityOpen(false);
                        }}
                        className={[
                          "mb-1 flex w-full items-center rounded-xl px-3 py-2 text-left transition last:mb-0",
                          opt === priority ? "bg-white/10" : "hover:bg-white/5",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "rounded-full border px-3 py-1 text-base font-medium",
                            priorityPillClass(opt),
                          ].join(" ")}
                        >
                          {opt}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Cor */}
          <div>
            <label className="text-sm text-white/70">Cor (HEX)</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                value={color}
                onChange={(e) => setColor(clampHex(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                placeholder="#7C3AED"
                maxLength={7}
              />

              {/* Quadradinho clicável */}
              <button
                type="button"
                onClick={openPicker}
                className="h-12 w-12 rounded-xl border border-white/10"
                style={{ backgroundColor: colorFull }}
                title="Escolher cor"
              />

              {/* input color invisível */}
              <input
                ref={colorInputRef}
                type="color"
                value={colorFull}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                className="hidden"
              />
            </div>

            <div className="mt-1 text-xs text-white/50">
              Clique no quadrado para abrir o seletor de cor.
            </div>
          </div>

          {/* Ícone */}
          <div className="md:col-span-1">
            <label className="text-sm text-white/70">Ícone</label>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 text-xs text-white/50">
                  Sem imagem. Só ícone/emoji (do app).
                </div>
              <div className="max-h-40 overflow-y-auto pr-1">
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                  {ICONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setIconEmoji(ic)}
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-xl border",
                        iconEmoji === ic
                          ? "border-violet-400 bg-violet-500/20"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                      ].join(" ")}
                      title={ic}
                      type="button"
                    >
                      <span className="text-xl">{ic}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {isFolder ? (
            <div className="md:col-span-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={applyColorToChildren}
                    onChange={(e) => setApplyColorToChildren(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Aplicar cor aos itens dentro desta pasta
                </label>
              </div>
            </div>
          ) : null}

          {/* Trancar */}
          <div className="md:col-span-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    Trancar {isFolder ? "pasta" : "arquivo"}
                  </div>
                  <div className="text-sm text-white/60">
                    Se trancar, o app pede senha antes de abrir.
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isLocked}
                    onChange={(e) => setIsLocked(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Ativar
                </label>
              </div>

              <div className="mt-4">
                <label className="text-sm text-white/70">Senha (mín. 4)</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!isLocked}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none disabled:opacity-50"
                  placeholder="Digite uma senha"
                  type="password"
                />
                <div className="mt-1 text-xs text-white/50">
                  A senha e salva de forma protegida para validar o desbloqueio.
                </div>
              </div>
            </div>
          </div>
        </div>

        {err ? <div className="mt-4 text-sm text-red-300">{err}</div> : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 hover:bg-white/10"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-violet-600 px-6 py-3 font-medium hover:bg-violet-500 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
