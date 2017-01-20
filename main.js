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

let id = x => x

let recentFilesKey = "document_recentFiles"

let winPath = win => {
	return new Task(function(reject, resolve) {
        ipcHelper.requestFromRenderer(win, 'filepath', function(event, winFilepath) {
			resolve(winFilepath)
		})
	})
}

let saveWindows = windowManager => {
	loadProperties(windowManager, properties => {		
		settings.set(recentFilesKey, properties)
	})
}

let loadRecentDocs = () => {
	let recents = _.filter(settings.getSync(recentFilesKey), x => x !== null)
	return _.defaultTo(recents, [])
}

let loadWindows = windowManager => {	
	let recents = _.filter(loadRecentDocs(), recent => typeof recent === 'object')
	Immutable.fromJS(recents)
		.map(prop => prop.toJS())
		.traverse(Task.of, prop => createDocWindow(prop, windowManager, () => saveWindows(windowManager)))
		.fork(console.error, results => {			
			let windows = _.filter(results.toArray(), win => win != null)
			if (windows.length === 0) {
				windowManager.createWindow()		
			}			
		})
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
			return win
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
		
			let newWin = windowManager.createWindow(options)
	  
			if (onChange) onChange()
				
			return newWin
	    }
	}
	
	if (path) {
		return new Task(function(reject, resolve) {
			fs.readFile(path, function(err, contents) {
				let result = err ? null : createWin(path, contents)
				resolve(result)				
			})
		})
	}
	else {
		return Task.of(createWin(path, ""))
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

  app.on('open-file', function(e, filepath) {
	app.addRecentDocument(filepath);

	createDocWindow({ filepath: filepath }, windowManager, () => saveWindows(windowManager)).fork(id, id)

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
			  createDocWindow({ filepath: filepath }, windowManager, () => saveWindows(windowManager)).fork(id, id)
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
        fileManager.closeFile(ext)()
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
