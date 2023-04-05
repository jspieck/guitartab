const { Menu } = require('electron');
const electron = require('electron');
const fs = require('fs');

const { app, dialog } = electron;
// const window = electron.BrowserWindow;

const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New File',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+N' : 'Ctrl+N',
        click() { // item, focusedWindow
          // TODO: Check if user wants to save file
          global.window.webContents.send('newFile');
        },
      },
      {
        label: 'Open File',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+O' : 'Ctrl+O',
        click() { // item, focusedWindow
          console.log('OPEN FILE CALLED');
          // if (focusedWindow) focusedWindow.webContents.toggleDevTools()
          const options = {
            // See place holder 1 in above image
            title: 'Load Guitar Tab File',
            // See place holder 3 in above image
            buttonLabel: 'Load File',
            // See place holder 4 in above image
            filters: [
              { name: 'Guitar Pro', extensions: ['gp3', 'gp4', 'gp5', 'gpx'] },
              { name: 'Serene Tab', extensions: ['gp'] },
              { name: 'Custom File Type', extensions: ['as'] },
              { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile'],
          };
          dialog.showOpenDialog(global.window, options).then((file) => {
            console.log('FILENAME', file.filePaths[0]);
            if (file.filePaths == null) {
              return;
            }
            // const filepath = fileName[0];
            // const fileType = filepath.split('.')[1];
            const buffer = fs.readFileSync(file.filePaths[0]);
            const activeWindow = global.window;
            // activeWindow.send('store-data', [filepath, buffer]);
            activeWindow.webContents.send('store-data', [file.filePaths[0], buffer]);
          });
        },
      },
      {
        label: 'Save File',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+S' : 'Ctrl+S',
        click() { // item, focusedWindow
          const activeWindow = global.window;
          activeWindow.webContents.send('saveFile');
        },
      },
      {
        label: 'Save As...',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+S' : 'Ctrl+Shift+S',
        click() { // item, focusedWindow
          const activeWindow = global.window;
          activeWindow.webContents.send('saveFileAs');
        },
      },
      {
        label: 'Export GP5',
        accelerator: process.platform === 'darwin' ? 'Alt+E' : 'Ctrl+E',
        click() { // item, focusedWindow
          const activeWindow = global.window;
          activeWindow.webContents.send('exportGP5');
        },
      },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Undo',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+Z' : 'Ctrl+Z',
        click() { // item, focusedWindow
          const activeWindow = global.window;
          activeWindow.webContents.send('revert');
        },
      },
      {
        label: 'Redo',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+Y' : 'Ctrl+Y',
        click() { // item, focusedWindow
          const activeWindow = global.window;
          activeWindow.webContents.send('restore');
        },
      },
      {
        type: 'separator',
      },
      {
        role: 'cut',
      },
      {
        role: 'copy',
      },
      {
        role: 'paste',
      },
      {
        role: 'pasteandmatchstyle',
      },
      {
        role: 'delete',
      },
      {
        role: 'selectall',
      },
    ],
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click(item, focusedWindow) {
          if (focusedWindow) {
            focusedWindow.reload();
          }
        },
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
        click(item, focusedWindow) {
          if (focusedWindow) focusedWindow.webContents.toggleDevTools();
        },
      },
      {
        type: 'separator',
      },
      {
        role: 'resetzoom',
      },
      {
        role: 'zoomin',
      },
      {
        role: 'zoomout',
      },
      {
        type: 'separator',
      },
      {
        role: 'togglefullscreen',
      },
    ],
  },
  {
    role: 'window',
    submenu: [
      {
        role: 'minimize',
      },
      {
        role: 'close',
      },
    ],
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click() {
          electron.shell.openExternal('http://electron.atom.io');
        },
      },
    ],
  },
];

if (process.platform === 'darwin') {
  const name = app.getName();
  template.unshift({
    label: name,
    submenu: [
      {
        role: 'about',
      },
      {
        type: 'separator',
      },
      {
        role: 'services',
        submenu: [],
      },
      {
        type: 'separator',
      },
      {
        role: 'hide',
      },
      {
        role: 'hideothers',
      },
      {
        role: 'unhide',
      },
      {
        type: 'separator',
      },
      {
        role: 'quit',
      },
    ],
  });
  // Edit menu.
  template[1].submenu.push(
    {
      type: 'separator',
    },
    {
      label: 'Speech',
      submenu: [
        {
          role: 'startspeaking',
        },
        {
          role: 'stopspeaking',
        },
      ],
    },
  );
  // Window menu.
  template[3].submenu = [
    {
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      role: 'close',
    },
    {
      label: 'Minimize',
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize',
    },
    {
      label: 'Zoom',
      role: 'zoom',
    },
    {
      type: 'separator',
    },
    {
      label: 'Bring All to Front',
      role: 'front',
    },
  ];
}

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
