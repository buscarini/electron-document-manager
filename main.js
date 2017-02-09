'use strict';

const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;
const async = require('async');
const _ = require('lodash');

const Immutable = require('immutable')
const { List, Map } = require('immutable-ext')
const Task = require('data.task')

let menuManager = require('./menuManager')
let fileManager = require('./fileManager')
let windowManager = require('./windowManager')
let ipcHelper = require('./ipcHelper')
let { id, runTaskF, runTask, readFileTask } = require('./utils')

var userMenuOptions = null

let { loadRecentDocs, saveRecentDocs, addRecentDoc, loadCurrentDocs, saveCurrentDocs } = require("./recentDocs")

var processMenu = null

let recentFilesKey = "document_recentFiles"
let currentFilesKey = "document_currentFiles"

let shouldCloseWindow = ext => {
    fileManager.shouldCloseFile(ext, () => {
		windowManager.saveWindows()        	
    })
}

let winPath = win => {
	return new Task(function(reject, resolve) {
        ipcHelper.requestFromRenderer(win, 'filePath', function(event, winFilepath) {
			resolve(winFilepath)
		})
	})
}

let updateMenu = () => {
	return createMenuOptions(userMenuOptions)
				.map(menuManager.updateMenu)
}

// let saveWindows = windowManager => {
// 	loadProperties(windowManager)
// 		.fork(id, (properties) => {
// 			saveCurrentDocs(properties)
// 		})
// }

let clearRecentDocuments = () => {
	return clearRecentDocs()
		.chain(updateMenu)
}

let saveRecentDocuments = (docs) => {
	return saveRecentDocs(docs)
		.chain(updateMenu)
}

let addRecentDocument = (doc) => {
	return addRecentDoc(doc)
		.chain(updateMenu)
}

// let loadWindows = (windowManager, ext) => {
// 	console.log("load windows")
// 	loadCurrentDocs(docs => {
// 		console.log("loaded current docs")
// 		let recents = _.filter(docs, recent => typeof recent === 'object')
// 		Immutable.fromJS(recents)
// 			.map(prop => prop.toJS())
// 			.traverse(Task.of, prop => createDocWindow(prop, windowManager, ext, () => saveWindows(windowManager)))
// 			.fork(console.error, results => {
// 				console.log("create windows: " + results)
// 				let windows = _.filter(results.toArray(), win => win != null)
// 				if (windows.length === 0) {
// 					windowManager.createWindow({ docExtension: ext })
// 				}
// 			})
// 	})
// }

// let createDocWindow = (properties, windowManager, ext, onChange) => {
//     //not open, do the rest of the stuff
// 	let win = BrowserWindow.getFocusedWindow()
// 	let path = properties.filePath
//
// 	let createWin = (path, contents) => {
// 		return new Task((reject, resolve) => {
// 		    fileManager.fileIsEdited(path, contents, isEdited => {
// 			    if(win && !isEdited && contents === "") {
// 					//open in current window
// 					windowManager.setUpWindow(win, filePath, contents)
// 					resolve(win)
// 			    } else {
//
// 					let options = {
// 						focusedWindow: win,
// 						filePath: path,
// 						fileContent: contents,
// 						x: properties.x,
// 						y: properties.y,
// 						width: properties.width,
// 						height: properties.height,
// 						onChange: onChange,
// 						docExtension: ext
// 					}
//
// 					let newWin = windowManager.createWindow(options)
//
// 					if (onChange) onChange()
//
// 					resolve(newWin)
// 			    }
// 		    })
// 		})
// 	}
//
// 	var result = Task.of(null)
//
// 	if (path) {
// 		result = readFileTask(path)
// 			.chain(contents => createWin(path, contents))
// 	}
// 	else {
// 		result = createWin(path, "")
// 	}
//
//
// 	console.log("created window for doc " + path)
//
//
// 	return result.map(win => {
//
// 		saveWindows(windowManager)
//
// 		console.log("adding doc to recents " + path)
//
// 		// let container = windowManager.getWindowContainer(win)
// // 		if (container === undefined || container === null) {
// // 			console.log("no container for " + win.id)
// // 			return win
// // 		}
// //
// 		if (typeof path === 'string') {
// 			app.addRecentDocument(path)
// 			addRecentDocument({ filePath: path })
// 		}
//
// 		return win
// 	})
// }

// let loadProperties = (windowManager, completion) => {
//     var containers = windowManager.getWindowContainers()
//
// 	let results = _.map(containers, c => {
// 		return {
// 			filePath: c.filePath,
// 			x: c.window.getBounds().x,
// 			y: c.window.getBounds().y,
// 			width: c.window.getBounds().width,
// 			height: c.window.getBounds().height
// 		}
// 	})
//
// 	return Task.of(results)
// }

let createMenuOptions = (options) => {
	console.log("menuOptions")
	
	return loadRecentDocs()
		.map(docs => {
			console.log(docs)
		
			let ext = _.defaultTo(options.docExtension, "")
	
			let menu = {
			      newMethod: function(item, focusedWindow) {
			        windowManager.createWindow({ focusedWindow: focusedWindow, docExtension: ext })
			      },
			      openMethod: function(item, focusedWindow, event, filePath) {
	  		        fileManager.openFile(filePath).fork(console.error, filePath => {
	    		          //check if open in other window
	    		          var windows = windowManager.getWindows()
		  
	    				  let winForFile = _.reduce(windows, (winForFile, win) =>  {
	    						return (win.filePath === filePath) ? win : winForFile
	    				  }, null)

	    				  if (winForFile) {
	    					  console.log("File already open. Focusing window")
	    					  winForFile.focus()
	    				  }
	    				  else {
	    					  console.log("Creating doc for opened document")
	    					  windowManager.createDocumentWindow({ filePath: filePath }, ext, () => {
								  runTask(addRecentDocument({ filePath: path }))
								  windowManager.saveWindows()
							  })
	    					  	.fork(id, id)
	    				  } 	
	  		        })
				  },
			      saveMethod: function(item, focusedWindow) {
			        fileManager.saveFile(ext, (err, path) => {
			        	if (!err) {
							focusedWindow.webContents.send('document_saved', path)

							runTask(addRecentDocument({filePath: path}))
			        	}
			        })
					windowManager.saveWindows()
			      },
			      saveAsMethod: function(item, focusedWindow) {
			        fileManager.saveFileAs(ext)
					windowManager.saveWindows()
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
				  clearRecentDocs: clearRecentDocuments
			    }
			
			return menu
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
		runTask(updateMenu())
	})
	
	app.on('before-quit', function() {
		windowManager.setQuitting(true)
	})
	
	app.on('browser-window-blur', runTaskF(updateMenu()))
	app.on('browser-window-focus', runTaskF(updateMenu()))
	
	// Quit when all windows are closed.
	app.on('window-all-closed', function() {
		// On OS X it is common for applications and their menu bar
		// to stay active until the user quits explicitly with Cmd + Q
		if (process.platform != 'darwin') {
		  app.quit()
		}
		else {
			runTask(updateMenu())
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
	createMenuOptions(userMenuOptions).fork(console.error, menuManager.setMenu)
	  
    //set up window menu updates - to be run on focus, blur, and window create
    // windowManager.setFocusUpdateHandler(() => menuManager.updateMenu(menuOptions(userMenuOptions)) )


	// Restore windows
	windowManager.loadWindows(ext)
  })
	  
}

module.exports = {
  getRendererModule: function() {
    return require('./rendererModule');
  },
  main: initialize
}
