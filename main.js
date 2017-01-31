'use strict';

const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;
const async = require('async');
const _ = require('lodash');
const settings = require('electron-settings');

const Immutable = require('immutable')
const { List, Map } = require('immutable-ext')
const Task = require('data.task')
const fs = require("fs")

let menuManager = require('./menuManager')
let fileManager = require('./fileManager')
let windowManager = require('./windowManager')
let ipcHelper = require('./ipcHelper')
let { id } = require('./utils')

let recentFilesKey = "document_recentFiles"
let currentFilesKey = "document_currentFiles"

let shouldCloseWindow = ext => {
    fileManager.shouldCloseFile(ext, () => {
		saveWindows(windowManager)        	
    })
}

let winPath = win => {
	return new Task(function(reject, resolve) {
        ipcHelper.requestFromRenderer(win, 'filePath', function(event, winFilepath) {
			resolve(winFilepath)
		})
	})
}

let saveWindows = windowManager => {
	loadProperties(windowManager, properties => {		
		settings.set(currentFilesKey, properties)
	})
}

let clearRecentDocs = () => {
	settings.set(recentFilesKey, [])
}

let loadRecentDocs = () => {
	let recents = _.filter(settings.getSync(recentFilesKey), x => x !== null)
	return _.defaultTo(recents, [])
}

let saveRecentDocs = (docs) => {
	console.log("saveRecentDocs")
	console.log(docs)
	settings.set(recentFilesKey, docs)
}

let addRecentDoc = doc => {
	loadProperties(windowManager, properties => {
		let docProps = _.filter(properties, prop => prop.filePath === doc.filePath)[0]
		let recents = loadRecentDocs()
		let newRecents = _.concat(recents, doc)
		saveRecentDocs(newRecents)		
	})
}

let loadCurrentDocs = () => {
	let current = _.filter(settings.getSync(currentFilesKey), x => x !== null)
	return _.defaultTo(current, [])
}

let loadWindows = (windowManager, ext) => {	
	let recents = _.filter(loadCurrentDocs(), recent => typeof recent === 'object')
	Immutable.fromJS(recents)
		.map(prop => prop.toJS())
		.traverse(Task.of, prop => createDocWindow(prop, windowManager, ext, () => saveWindows(windowManager)))
		.fork(console.error, results => {			
			let windows = _.filter(results.toArray(), win => win != null)
			if (windows.length === 0) {
				windowManager.createWindow({ docExtension: ext })
			}			
		})
}

let createDocWindow = (properties, windowManager, ext, onChange) => {
    //not open, do the rest of the stuff
	let win = BrowserWindow.getFocusedWindow()
	let path = properties.filePath
	
	let createWin = (path, contents) => {
	    var isEdited = fileManager.fileIsEdited(path, contents)

	    if(win && !isEdited && contents === "") {
			//open in current window
			windowManager.setUpWindow(win, filePath, contents)
			return win
	    } else {

			let options = {
				focusedWindow: win,
				filePath: path,
				fileContent: contents,
				x: properties.x,
				y: properties.y,
				width: properties.width,
				height: properties.height,
				onChange: onChange,
				docExtension: ext
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
			filePath: c.filePath,
			x: c.window.getBounds().x,
			y: c.window.getBounds().y,
			width: c.window.getBounds().width,
			height: c.window.getBounds().height
		}
	})
	
	completion(results)
}


var initialize = function(options) {

	let ext = _.defaultTo(options.docExtension, "")
	
	let localize = options.localize || id
	fileManager.localize(localize)

	windowManager.initializeWithEntryPoint(options.entryPoint, () => shouldCloseWindow(ext), options.openDevTools)

	fileManager.setCompareDocument(options.documentChanged)

	fileManager.windowCloseCancelled(() => {
		windowManager.windowCloseCancelled()
	})
	
	app.on('activate', function () {
	  if (windowManager.getWindowContainers().length === 0) windowManager.createWindow({ docExtension: ext })
	})
	
	app.on('before-quit', function() {
		windowManager.setQuitting(true)
	})
	
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

  app.on('open-file', function(e, filePath) {
	app.addRecentDocument(filePath);

	createDocWindow({ filePath: filePath }, windowManager, ext, () => saveWindows(windowManager)).fork(id, id)

	addRecentDocument({ filePath: filePath })

	saveWindows(windowManager)	
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  app.on('ready', function() {
	  
    //set up menu
    menuManager.setMenu({
      newMethod: function(item, focusedWindow) {
        windowManager.createWindow({ focusedWindow: focusedWindow, docExtension: ext });
		saveWindows(windowManager)
      },
      openMethod: function(item, focusedWindow, filePath) {
        fileManager.openFile(function(err, filePath, currentFileContent, openFileContent) {
          //check if open in other window
          var windows = windowManager.getWindows();
		  
		  let winForFile = _.reduce(windows, (winForFile, win) =>  {
				return (win.filePath === filePath) ? win : winForFile
		  }, null)

		  if (winForFile) {
			  winForFile.focus()
		  }
		  else {
			  createDocWindow({ filePath: filePath }, windowManager, ext, () => saveWindows(windowManager)).fork(id, id)
		  }
        });
      },
      saveMethod: function(item, focusedWindow) {
        fileManager.saveFile(ext, (err, path) => {
        	if (!err) {
				focusedWindow.webContents.send('document_saved', path)
        	}
        })
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
		  BrowserWindow.getFocusedWindow().close()
      },
	  processMenu: options.processMenu,
	  recentDocs: loadRecentDocs(),
	  clearRecentDocs: clearRecentDocs
    })

    //set up window menu updates - to be run on focus, blur, and window create
    windowManager.setFocusUpdateHandler(() => menuManager.updateMenu(options.processMenu) );


	// Restore windows
	loadWindows(windowManager, ext)
  })
}

module.exports = {
  getRendererModule: function() {
    return require('./rendererModule');
  },
  main: initialize
}
