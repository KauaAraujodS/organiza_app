"use client";

import { useState } from "react";
import styles from "../finance.module.css";

export default function AttachmentUpload({
  onFilesChange,
}: {
  onFilesChange: (files: File[]) => void;
}) {
  const [names, setNames] = useState<string[]>([]);

  return (
    <div>
      <label className={styles.label}>Anexos (opcional)</label>
      <input
        className={styles.input}
        type="file"
        multiple
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          setNames(list.map((f) => f.name));
          onFilesChange(list);
        }}
      />
      {names.length > 0 ? (
        <div className={`${styles.row} ${styles.mt8}`}>
          {names.map((name) => (
            <span key={name} className={styles.badge}>
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
