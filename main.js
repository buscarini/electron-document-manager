'use strict';

const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;
const async = require('async');
const _ = require('lodash');
const menuManager = require('./menuManager');
const fileManager = require('./fileManager');
const windowManager = require('./windowManager');
const ipcHelper = require('./ipcHelper');
const settings = require('electron-settings');

const { List, Map } = require('immutable-ext')
const Task = require('data.task')

let recentFilesKey = "document_recentFiles"

let winPath = win => {
	return new Task(function(reject, resolve) {
        ipcHelper.requestFromRenderer(win, 'filepath', function(event, winFilepath) {
			resolve(winFilepath)
		}		
	})
}

let saveWindows = windowManager => {
	var windows = windowManager.getWindows()
	
	List(windows)
		.traverse(winPath)
		.fork(console.error, pathsList => {
			settings.set(recentFilesKey, pathsList.toJS())
		})
}

let loadRecentDocs = () => {
	let recents = settings.getSync(recentFilesKey)
	return _.defaultTo(recents, [])
}

let loadWindows = windowManager => {
	let recents = loadRecentDocs()
	_.map(recents, docPath => createDocWindow(docPath, windowManager, ""))
	
	windowManager.createWindow()
}

let createDocWindow = (path, windowManager, currentFileContent) => {
    //not open, do the rest of the stuff

    //check if should open in current window or new
    var isEdited = fileManager.fileIsEdited(path, currentFileContent)

    if(BrowserWindow.getFocusedWindow() && !isEdited && currentFileContent === "") {
      //open in current window
      windowManager.setUpWindow(BrowserWindow.getFocusedWindow(), filepath, openFileContent)
    } else {
      //open in different window
      windowManager.createWindow({
        focusedWindow: focusedWindow,
        fileContent: openFileContent,
        filepath: path
      })
    }
}

var initialize = function(options) {

  windowManager.initializeWithEntryPoint(options.entryPoint);

  // Quit when all windows are closed.
  app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform != 'darwin') {
	  saveWindows(windowManager)
      app.quit();
    } else {
      menuManager.updateMenu(options.processMenu);
    }
  });

  app.on('open-file', function(e, path) {
    app.addRecentDocument(path);
	saveWindows(windowManager)
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  app.on('ready', function() {
    //set up menu
    menuManager.setMenu({
      newMethod: function(item, focusedWindow) {
        windowManager.createWindow({ focusedWindow: focusedWindow });
      },
      openMethod: function(item, focusedWindow) {
        fileManager.openFile(function(err, filepath, currentFileContent, openFileContent) {
          //check if open in other window
          var windows = windowManager.getWindows();

          var checkFilepathFuncs = [];
          windows.forEach(function(win) {
            checkFilepathFuncs.push(function(callback) {
              ipcHelper.requestFromRenderer(win, 'filepath', function(event, winFilepath) {
                var alreadyOpen = false;
                if(winFilepath === filepath) {
                  alreadyOpen = true;
                  win.focus();
                }
                callback(null, alreadyOpen);
              });
            });
          });

          //not sure if ipcHelper response will work with paralle, so doing this in series
          async.series(checkFilepathFuncs, function(err, results) {
            if(!_.includes(results, true)) {
              createDocWindow(filepath, windowManager, currentFileContent)
            }
          });
        });
      },
      saveMethod: function(item, focusedWindow) {
        fileManager.saveFile()
		saveWindows(windowManager)
      },
      saveAsMethod: function(item, focusedWindow) {
        fileManager.saveFileAs()
		saveWindows(windowManager)
      },
      renameMethod: function(item, focusedWindow) {
        //fileManager.renameFile();
        //to implement later
      },
      closeMethod: function(item, focusedWindow) {
        fileManager.closeFile()
		saveWindows(windowManager)
      },
	  processMenu: options.processMenu
    });

    //set up window menu updates - to be run on focus, blur, and window create
    windowManager.setFocusUpdateHandler(() => menuManager.updateMenu(options.processMenu) );


	// Restore windows
	loadWindows(windowManager)

    //create first window
    // windowManager.createWindow();
  });
}

module.exports = {
  getRendererModule: function() {
    return require('./rendererModule');
  },
  main: initialize
}
