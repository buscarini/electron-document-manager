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

const Immutable = require('immutable')
const { List, Map } = require('immutable-ext')
const Task = require('data.task')
const fs = require("fs")

let recentFilesKey = "document_recentFiles"

let winPath = win => {
	return new Task(function(reject, resolve) {
        ipcHelper.requestFromRenderer(win, 'filepath', function(event, winFilepath) {
			console.log("got filepath")
			console.log(winFilepath)
			resolve(winFilepath)
		})
	})
}

let saveWindows = windowManager => {
	loadProperties(windowManager, properties => {
		console.log("save windows")
		console.log(properties)
		
		settings.set(recentFilesKey, properties)
	})
}

let loadRecentDocs = () => {
	let recents = _.filter(settings.getSync(recentFilesKey), x => x !== null)
	console.log("recents")
	console.log(recents)
	return _.defaultTo(recents, [])
}

let loadWindows = windowManager => {	
	let recents = _.filter(loadRecentDocs(), recent => typeof recent === 'object')
	_.map(recents, prop => createDocWindow(prop, windowManager, () => saveWindows(windowManager)))
	
	if (recents.length === 0) {
		windowManager.createWindow()		
	}
	
	return recents
}

let createDocWindow = (properties, windowManager, onChange) => {
    //not open, do the rest of the stuff
	let win = BrowserWindow.getFocusedWindow()
	let path = properties.filepath
	
	let createWin = (path, contents) => {
	    var isEdited = fileManager.fileIsEdited(path, contents)

	    if(win && !isEdited && contents === "") {
			//open in current window
			windowManager.setUpWindow(win, filepath, contents)
	    } else {

			let options = {
				focusedWindow: win,
				filepath: path,
				fileContent: contents,
				x: properties.x,
				y: properties.y,
				width: properties.width,
				height: properties.height,
				onChange: onChange
			}
		
			windowManager.createWindow(options)
	  
			if (onChange) onChange()
	    }
	}
	
	if (path) {
		fs.readFile(path, function(err, contents) {
		    createWin(path, contents)
		})		
	}
	else {
		createWin(path, "")
	}
}

let loadProperties = (windowManager, completion) => {
    var containers = windowManager.getWindowContainers()

	let results = _.map(containers, c => {
		return {
			filepath: c.filePath,
			x: c.window.getBounds().x,
			y: c.window.getBounds().y,
			width: c.window.getBounds().width,
			height: c.window.getBounds().height
		}
	})
	
	completion(results)
}

var initialize = function(options) {

	windowManager.initializeWithEntryPoint(options.entryPoint)

	let ext = _.defaultTo(options.docExtension, "")
	

  // Quit when all windows are closed.
  app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform != 'darwin') {
      app.quit();
	}
	else {
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
		  
		  let winForFile = _.reduce(windows, (winForFile, win) =>  {
				return (win.filePath === filepath) ? win : winForFile
		  }, null)

		  if (winForFile) {
			  winForFile.focus()
		  }
		  else {
			  createDocWindow({ filepath: filepath }, windowManager, () => saveWindows(windowManager))
		  }
		  
        });
      },
      saveMethod: function(item, focusedWindow) {
        fileManager.saveFile(ext)
		saveWindows(windowManager)
      },
      saveAsMethod: function(item, focusedWindow) {
        fileManager.saveFileAs(ext)
		saveWindows(windowManager)
      },
      renameMethod: function(item, focusedWindow) {
        //fileManager.renameFile();
        //to implement later
      },
      closeMethod: function(item, focusedWindow) {
        fileManager.closeFile(ext)
		saveWindows(windowManager)
      },
	  processMenu: options.processMenu
    });

    //set up window menu updates - to be run on focus, blur, and window create
    windowManager.setFocusUpdateHandler(() => menuManager.updateMenu(options.processMenu) );


	// Restore windows
	loadWindows(windowManager)
  });
}

module.exports = {
  getRendererModule: function() {
    return require('./rendererModule');
  },
  main: initialize
}
