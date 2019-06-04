'use strict';
const { app, BrowserWindow, systemPreferences, Tray, ipcMain, shell } = require('electron');
const path = require('path')
const url = require('url')
const Positioner = require('electron-positioner')
const tesla = require('./tesla-api')
const Store = require('electron-store');
const store = new Store();
const Poller = require('./poller');
const contextMenu = require('electron-context-menu');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// Keep a reference for dev mode
let dev = false;
if (process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath)) {
  dev = true;
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 300,
    height: 450,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    transparent: true,
    titleBarStyle: 'customButtonsOnHover',
    webPreferences: {
      // Prevents renderer process code from not running when window is
      // hidden
      backgroundThrottling: false,
      nodeIntegration: true,
    }
  })

  // tray stuff
  let tray;
  if (systemPreferences.isDarkMode()) {
    tray = new Tray(path.join(__dirname, 'src', 'assets', 'img', 'dark.png'))
  } else {
    tray = new Tray(path.join(__dirname, 'src', 'assets', 'img', 'white.png'))
  }

  tray.setToolTip('Nikola App')

  // Don't show the app in the doc
  app.dock.hide()
  // hide window initially
  mainWindow.hide()

  // Show detached devtools (for development)
    // mainWindow.openDevTools({
    //   mode: 'detach'
    // })
  

  // Main window behavior
  mainWindow.on('blur', () => {
    mainWindow.hide()
  })

  // Tesla data Pooling
  mainWindow.webContents.on('did-finish-load', () => {

    // start login and init sequence
    const startLogin = async (authToken, loginEmailPw) => {
      try {
        if(!authToken){
          authToken = await tesla.login(loginEmailPw)
          store.set('authToken', authToken)
        }
        mainWindow.webContents.send('login', true)
        // passing true to indicate initial login attempt and run immediatelly
        await teslaPoll(true)
        startPoller()
      } catch (error) {
        console.log(error)
        store.delete('authToken')
        mainWindow.webContents.send('login-failed', JSON.stringify(error))
      }
    }

    ipcMain.on('login-attempt', async (event, loginEmailPw) => {
      startLogin(false, loginEmailPw)
    })

    // get tesla Data
    let authToken;
    const teslaPoll = async (first) => {
      authToken = store.get('authToken')

      if ((mainWindow.isVisible() || first) && authToken) {
        try {
          const vehicle = await tesla.vehicle(authToken)
          if(vehicle.state !== 'online'){
            await tesla.wakeUp(authToken, vehicle.vehicleID)
            mainWindow.webContents.send('tesla-data', {vehicle})
            return
          }
          const driveState = await tesla.driveState(authToken, vehicle.vehicleID)
          const chargeState = await tesla.chargeState(authToken, vehicle.vehicleID)
          const climateState = await tesla.climateState(authToken, vehicle.vehicleID)
          const allData = {
            driveState,
            chargeState,
            vehicle,
            climateState
          }
          mainWindow.webContents.send('tesla-data', allData)
          mainWindow.webContents.send('tesla-data-error', false)
        } catch (error) {
          console.log(error)
          mainWindow.webContents.send('tesla-data-error', true)
        }
      }
    }

    // Polling function
    let poller;
    const startPoller = () => {
      // Set 10s timeout between polls
      poller = new Poller(10000);
      // Wait till the timeout sent our event to the EventEmitter
      poller.onPoll(async () => {
        await teslaPoll()
        poller.poll();
      });
      // Initial start
      if (store.get('authToken')) {
        poller.poll();
      }
    }

    const setMenu = () => {
      contextMenu({
        menu: actions => [
          {
            label: `Nikola App ${app.getVersion()}`,
            click(){shell.openExternal('https://github.com/geraldoramos/nikola')}
          },
          actions.separator(),
          {
            label: 'Logout',
            enabled: store.get('authToken') ? true : false,
            click() { 
              store.delete('authToken')
              poller ? poller.removeAllListeners() : null
              mainWindow.webContents.send('login', false)
            }
          },
          {
            label: 'Quit',
            accelerator: 'Command+Q',
            click() { 
              app.quit()
            }
          }
        ]
      });
    }
    setMenu()

    const currentLogin = store.get('authToken')
    if (currentLogin) {
      startLogin(currentLogin, false)
    }

  })

  // position window to the tray area
  const positioner = new Positioner(mainWindow)
  let bounds = tray.getBounds()
  positioner.move('trayCenter', bounds)

  tray.on('click', (event) => {
    bounds = tray.getBounds()
    positioner.move('trayCenter', bounds)
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()

  })

  // and load the index.html of the app.
  let indexPath;
  if (dev && process.argv.indexOf('--noDevServer') === -1) {
    indexPath = url.format({
      protocol: 'http:',
      host: 'localhost:8080',
      pathname: 'index.html',
      slashes: true
    });
  } else {
    indexPath = url.format({
      protocol: 'file:',
      pathname: path.join(__dirname, 'dist', 'index.html'),
      slashes: true
    });
  }
  mainWindow.loadURL(indexPath);

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {

    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
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
  if (mainWindow === null) {
    createWindow();
  }
})
