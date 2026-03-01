/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_APP_URL = "https://organiza-app-peach.vercel.app";
const APP_URL = process.env.ORGANIZA_APP_URL || DEFAULT_APP_URL;
const TEMP_OPEN_DIR = path.join(os.tmpdir(), "OrganizaApp", "open");
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const GOOGLE_EXPORT_MIME_BY_TYPE = {
  "application/vnd.google-apps.document": {
    mime: "application/pdf",
    ext: ".pdf",
  },
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: ".xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: ".pptx",
  },
  "application/vnd.google-apps.drawing": {
    mime: "image/png",
    ext: ".png",
  },
  "application/vnd.google-apps.script": {
    mime: "application/vnd.google-apps.script+json",
    ext: ".json",
  },
};

function sanitizeFilename(name) {
  const base = String(name || "arquivo")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.+$/g, "")
    .trim();
  return base || "arquivo";
}

async function downloadDriveFileToTemp({ fileId, fileName, mimeType, accessToken }) {
  const exportCfg = GOOGLE_EXPORT_MIME_BY_TYPE[mimeType] || null;
  const url = exportCfg
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}/export?mimeType=${encodeURIComponent(exportCfg.mime)}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}?alt=media`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Falha ao baixar arquivo (${response.status})`);
  }

  const baseName = sanitizeFilename(fileName);
  const ext = exportCfg?.ext || path.extname(baseName) || "";
  const normalized = ext && baseName.toLowerCase().endsWith(ext.toLowerCase())
    ? baseName
    : `${baseName}${ext}`;

  await fs.mkdir(TEMP_OPEN_DIR, { recursive: true });
  const outPath = path.join(TEMP_OPEN_DIR, `${Date.now()}-${normalized}`);

  const ab = await response.arrayBuffer();
  const bytes = Buffer.from(ab);
  await fs.writeFile(outPath, bytes);

  return outPath;
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#0B1020",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.loadURL(APP_URL);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  return win;
}

function setupAutoUpdater(win) {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", async (info) => {
    const version = info?.version ? `v${info.version}` : "nova versão";
    const ask = await dialog.showMessageBox(win, {
      type: "info",
      title: "Atualização disponível",
      message: `Existe uma atualização (${version}).`,
      detail: "Deseja baixar agora e instalar ao reiniciar o app?",
      buttons: ["Atualizar agora", "Depois"],
      defaultId: 0,
      cancelId: 1,
    });

    if (ask.response === 0) {
      await autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-downloaded", async () => {
    const ask = await dialog.showMessageBox(win, {
      type: "info",
      title: "Atualização pronta",
      message: "A atualização foi baixada.",
      detail: "Clique em Reiniciar agora para aplicar a nova versão.",
      buttons: ["Reiniciar agora", "Depois"],
      defaultId: 0,
      cancelId: 1,
    });

    if (ask.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", async (err) => {
    const detail = err instanceof Error ? err.message : String(err || "");
    await dialog.showMessageBox(win, {
      type: "warning",
      title: "Falha ao atualizar",
      message: "Não foi possível verificar/baixar atualização agora.",
      detail,
      buttons: ["OK"],
    });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => undefined);
  }, 15_000);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => undefined);
  }, UPDATE_CHECK_INTERVAL_MS);
}

ipcMain.handle("drive:open-file", async (_event, payload) => {
  try {
    const fileId = String(payload?.fileId || "");
    const fileName = String(payload?.fileName || "arquivo");
    const mimeType = String(payload?.mimeType || "");
    const accessToken = String(payload?.accessToken || "");
    if (!fileId || !accessToken) {
      throw new Error("Dados insuficientes para abrir arquivo.");
    }

    const localPath = await downloadDriveFileToTemp({
      fileId,
      fileName,
      mimeType,
      accessToken,
    });

    const openError = await shell.openPath(localPath);
    if (openError) {
      throw new Error(openError);
    }

    return { ok: true, path: localPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao abrir arquivo";
    const fallbackUrl = String(payload?.webViewLink || "");
    if (fallbackUrl) {
      shell.openExternal(fallbackUrl);
    }
    return { ok: false, error: message };
  }
});

ipcMain.handle("app:check-updates", async () => {
  if (!app.isPackaged) return { ok: false, error: "Atualização indisponível em modo desenvolvimento." };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao verificar atualizações.";
    return { ok: false, error: message };
  }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    const mainWindow = createMainWindow();
    setupAutoUpdater(mainWindow);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
