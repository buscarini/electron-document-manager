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

let { loadRecentDocs, addRecentDoc, loadCurrentDocs } = require("./recentDocs")

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

let clearRecentDocuments = () => {
	return clearRecentDocs()
		.chain(updateMenu)
}

let addRecentDocument = (doc) => {
	return addRecentDoc(doc)
		.chain(updateMenu)
}

let createMenuOptions = (options) => {
	console.log("menuOptions")
	
	return loadRecentDocs()
		.map(docs => {		
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
	    					  windowManager.createDocumentWindow({ filePath: filePath }, ext, windowManager.saveWindows)
								  .chain(updateMenu)
		    					  	.fork(console.error, console.log)
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
	})
	
	app.on('open-file', function(e, filePath) {		
		windowManager.createDocumentWindow({ filePath: filePath }, ext)
			.chain(updateMenu)
			.fork(console.error, console.log)
	})

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
