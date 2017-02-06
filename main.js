'use strict';

const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;
const async = require('async');
const _ = require('lodash');

const Immutable = require('immutable')
const { List, Map } = require('immutable-ext')
const Task = require('data.task')
const fs = require("fs")

let menuManager = require('./menuManager')
let fileManager = require('./fileManager')
let windowManager = require('./windowManager')
let ipcHelper = require('./ipcHelper')
let { id } = require('./utils')

var userMenuOptions = null

const pref = require('electron-pref')

const preferences = pref.from({
});

let settings = {
	get: (k, cb) => {
		cb(null, preferences.get(k))
	},
	set: (k,v, cb) => {
		preferences.set(k, v)
		cb()
	}
}

let readFileTask = path => {
	return new Task((reject, resolve) => {
		if (typeof path !== 'string' || path.length === 0) {
			reject("Invalid path: " + path)
			return
		}
		
		fs.readFile(path, function(err, contents) {
			if (err) {
				reject(err)
			}
			else {
				resolve(contents)
			}
		})		
	})
}

var processMenu = null

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

let logError = (err) => {
	if (err) {
		console.error(err)
	}
}

let saveWindows = windowManager => {
	loadProperties(windowManager)
		.map(properties => {
			settings.set(currentFilesKey, properties, logError)
			return properties
		})
		.fork(id, id)
}

let clearRecentDocs = () => {
	settings.set(recentFilesKey, [], (err, data) => {
		if (!err) {
			menuOptions(userMenuOptions, menuManager.updateMenu)
		}
	})
}

let loadRecentDocs = (completion) => {
	settings.get(recentFilesKey, (err, docs) => {
		console.log("loaded docs " + JSON.stringify(docs))
		let recents = _.filter(docs, x => x !== null)
		console.log("recents " + JSON.stringify(recents))
		completion(_.defaultTo(recents, []))
	})
}

let saveRecentDocs = (docs) => {
	console.log("saveRecentDocs " + JSON.stringify(docs))
	settings.set(recentFilesKey, docs, (err) => {
		if (err) {
			console.log("error saving recent docs " + err)
		}
		else {
			console.log("update menu")
			menuOptions(userMenuOptions, menuManager.updateMenu)
		}
	})
}

let addRecentDoc = doc => {
	console.log("add recent doc " + JSON.stringify(doc))
	
	loadProperties(windowManager)
		.fork(console.error, properties => {
			let docProps = _.filter(properties, prop => prop.filePath === doc.filePath)[0]
			loadRecentDocs(recents => {
				let newRecents = _.concat(recents, doc)
				saveRecentDocs(newRecents)		
			})
		})
}

let loadCurrentDocs = (completion) => {
	console.log("load current docs")
	settings.get(currentFilesKey, (err, data) => {
		let current = _.filter(data, x => x !== null)
		completion(_.defaultTo(current, []))
	})
}

let loadWindows = (windowManager, ext) => {
	console.log("load windows")
	loadCurrentDocs(docs => {
		console.log("loaded current docs")
		let recents = _.filter(docs, recent => typeof recent === 'object')
		Immutable.fromJS(recents)
			.map(prop => prop.toJS())
			.traverse(Task.of, prop => createDocWindow(prop, windowManager, ext, () => saveWindows(windowManager)))
			.fork(console.error, results => {
				console.log("create windows: " + results)
				let windows = _.filter(results.toArray(), win => win != null)
				if (windows.length === 0) {
					windowManager.createWindow({ docExtension: ext })
				}			
			})
	})
}

let createDocWindow = (properties, windowManager, ext, onChange) => {
    //not open, do the rest of the stuff
	let win = BrowserWindow.getFocusedWindow()
	let path = properties.filePath
	
	let createWin = (path, contents) => {
		return new Task((reject, resolve) => {
		    fileManager.fileIsEdited(path, contents, isEdited => {
			    if(win && !isEdited && contents === "") {
					//open in current window
					windowManager.setUpWindow(win, filePath, contents)
					resolve(win)
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
				
					resolve(newWin)
			    }
		    })
		})
	}
	
	var result = Task.of(null)
 	
	if (path) {
		result = readFileTask(path)
			.chain(contents => createWin(path, contents))
	}
	else {
		result = createWin(path, "")
	}
	
	
	console.log("created window for doc " + path)
	
	
	return result.map(win => {
		
		saveWindows(windowManager)
		
		console.log("adding doc to recents " + path)
		
		// let container = windowManager.getWindowContainer(win)
// 		if (container === undefined || container === null) {
// 			console.log("no container for " + win.id)
// 			return win
// 		}
//
		if (typeof path === 'string') {
			app.addRecentDocument(path)
			addRecentDoc({ filePath: path })			
		}
		
		return win
	})
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
	
	return Task.of(results)
}

let menuOptions = (options, completion) => {
	console.log("menuOptions")
	loadRecentDocs(docs => {
		console.log(docs)
		
		let ext = _.defaultTo(options.docExtension, "")
	
		let menu = {
		      newMethod: function(item, focusedWindow) {
		        windowManager.createWindow({ focusedWindow: focusedWindow, docExtension: ext });
				saveWindows(windowManager)
		      },
		      openMethod: function(item, focusedWindow, event, filePath) {
  		        fileManager.openFile(filePath).fork(console.error, filePath => {
    		          //check if open in other window
    		          var windows = windowManager.getWindows();
		  
    				  let winForFile = _.reduce(windows, (winForFile, win) =>  {
    						return (win.filePath === filePath) ? win : winForFile
    				  }, null)

    				  if (winForFile) {
    					  console.log("File already open. Focusing window")
    					  winForFile.focus()
    				  }
    				  else {
    					  console.log("Creating doc for opened document")
    					  createDocWindow({ filePath: filePath }, windowManager, ext, () => saveWindows(windowManager))
    					  	.fork(id, id)
    				  } 	
  		        })
			  },			  
		      saveMethod: function(item, focusedWindow) {
		        fileManager.saveFile(ext, (err, path) => {
		        	if (!err) {
						focusedWindow.webContents.send('document_saved', path)

						addRecentDoc({filePath: path})
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
			  recentDocs: docs,
			  clearRecentDocs: clearRecentDocs
		    }
			
		completion(menu)
	})
}


var initialize = function(options) {
	
	processMenu = options.processMenu
	
	userMenuOptions = options
	userMenuOptions.processMenu = processMenu || id

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
		  app.quit()
		}
		else {
			menuOptions(userMenuOptions, menuManager.updateMenu)
		}
	});

	//   app.on('open-file', function(e, filePath) {
	//   console.log("open file")
	// app.addRecentDocument(filePath);
	//
	// createDocWindow({ filePath: filePath }, windowManager, ext, () => saveWindows(windowManager)).fork(id, id)
	//
	// addRecentDoc({ filePath: filePath })
	//
	// saveWindows(windowManager)
	//   });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  app.on('ready', function() {
	  
    //set up menu
	menuOptions(userMenuOptions, menuManager.setMenu)		
	  
    //set up window menu updates - to be run on focus, blur, and window create
    // windowManager.setFocusUpdateHandler(() => menuManager.updateMenu(menuOptions(userMenuOptions)) )


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
