import {
  app, BrowserWindow, dialog, session,
} from 'electron';
import '../menu/mainmenu';
/* import path from 'path';
import url from 'url';
import { dialog } from 'electron'; */
// const { app, BrowserWindow, dialog, session } = require('electron');
// const path = require('path');
const fs = require('fs');

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win: BrowserWindow | null = null;
// global.window = win;

let fileNameGt: Promise<Electron.SaveDialogReturnValue> | null = null;
let fileNameGp5: Promise<Electron.SaveDialogReturnValue> | null = null;
let fileNamePdf: Promise<Electron.SaveDialogReturnValue> | null = null;

async function handleUserSaveOptions(
  fileN: Promise<Electron.SaveDialogReturnValue>,
  downloadItem: Electron.DownloadItem,
) {
  const fileName = await fileN;
  if (fileName.filePath == null) {
    downloadItem.cancel();
    return false;
  }
  downloadItem.setSavePath(fileName.filePath);
  return true;
}

function saveGt(downloadItem: Electron.DownloadItem) {
  fileNameGt = dialog.showSaveDialog({
    filters: [{ name: 'Serene Guitar Tab (.gt)', extensions: ['gt'] }],
  });
  return handleUserSaveOptions(fileNameGt, downloadItem);
}

function saveGP5(downloadItem: Electron.DownloadItem) {
  fileNameGp5 = dialog.showSaveDialog({
    filters: [{ name: 'Guitar Tab Pro (.gp5)', extensions: ['gp5'] }],
  });
  return handleUserSaveOptions(fileNameGp5, downloadItem);
}

function savePdf(downloadItem: Electron.DownloadItem) {
  fileNamePdf = dialog.showSaveDialog({
    filters: [{ name: 'Adobe Acrobat Document (.pdf)', extensions: ['pdf'] }],
  });
  return handleUserSaveOptions(fileNamePdf, downloadItem);
}

function createWindow() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['worker-src blob:'],
      },
    });
  });
  // Create the browser window.
  win = new BrowserWindow({
    icon: './build/logo.png',
    webPreferences: {
      nodeIntegration: false,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  global.window = win as unknown as Window & typeof globalThis;
  win.maximize();
  // Open the DevTools.
  // win.webContents.openDevTools()
  // and load the index.html of the app.
  win.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  win.webContents.on('did-finish-load', () => {
    if (process.argv.length >= 2) {
      const filePath = process.argv[1];
      try {
        // global.window.webContents.send('store-data', process.argv);
        const buffer = fs.readFileSync(filePath);
        win!.webContents.send('store-data', [filePath, buffer]);
      } catch (e) {
        console.error(e);
      }
    }
  });

  win.webContents.session.on('will-download', async (event, downloadItem) => {
    let saved = false;
    if (downloadItem.getFilename() === 'saveAs.gt') {
      saved = await saveGt(downloadItem);
    } else if (downloadItem.getFilename() === 'tab.gt') {
      saved = await saveGt(downloadItem);
    } else if (downloadItem.getFilename() === 'pdfCreation.pdf') {
      saved = await savePdf(downloadItem);
    } else if (downloadItem.getFilename() === 'saveAs') {
      saved = await saveGP5(downloadItem);
    }
    if (saved && win != null) {
      win.webContents.send('saved');
    }
  });

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  // require('./menu/mainmenu');
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
