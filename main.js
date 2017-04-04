"use strict"

const electron = require("electron")
const app = electron.app	// Module to control application life.
const BrowserWindow = electron.BrowserWindow
const _ = require("lodash")
const Task = require("data.task")

const menuManager = require("./menuManager")
const fileManager = require("./fileManager")
const windowManager = require("./windowManager")
const { id, runTaskF, runTask } = require("./utils")

let userMenuOptions = null

const { loadRecentDocs, addRecentDoc, clearRecentDocs, checkRecentDocument } = require("./recentDocs")

let processMenu = null

const updateMenu = () => {
	return createMenuOptions(userMenuOptions)
				.map(menuManager.updateMenu)
}

const clearRecentDocuments = () => {
	return clearRecentDocs()
		.chain(updateMenu)
}

const addRecentDocument = (doc) => {
	return addRecentDoc(doc)
		.chain(updateMenu)
}

const openDocument = windowOptions => path => {
	console.log("Open Document")
	
	const ext = _.defaultTo(windowOptions.docExtension, "")
	fileManager.openFile(path)
		.fork(console.error, filePath => {			
			console.log("Opened document")
			
			//check if open in other window
			let windows = windowManager.getWindows()

			const winForFile = _.reduce(windows, (winForFile, win) =>	{
				return (win.filePath === filePath) ? win : winForFile
			}, null)

			if (winForFile) {
				console.log("File already open. Focusing window")
				winForFile.focus()
			}
			else {
				console.log("Creating doc for opened document")
				windowManager.createDocumentWindow(_.extend({ filePath: filePath }, windowOptions), ext, windowManager.saveWindows)
					.map(x => { console.log(x); return x })
					.chain(updateMenu)
					.fork(err => {
						checkRecentDocument(path)
							.chain(updateMenu)
							.fork(console.error, console.log)
					}, console.log)
			}
		})
}

const createMenuOptions = (options) => {
	console.log("menuOptions")
	
	const windowOptions = options.windowOptions || {}
	
	return loadRecentDocs()
		.map(docs => {		
			const ext = _.defaultTo(options.docExtension, "")
	
			const menu = {
						newMethod: function(item, focusedWindow) {
							windowManager.createWindow(_.extend({ focusedWindow: focusedWindow, docExtension: ext }, windowOptions))
						},
						openMethod: function(item, focusedWindow, event, filePath) {
							openDocument(windowOptions)(filePath)
						},
						saveMethod: function(item, focusedWindow) {
							console.log("SAVE")
							fileManager.saveFile(ext, (err, path) => {
								if (!err) {
									focusedWindow.webContents.send("document_saved", path)
									runTask(addRecentDocument({filePath: path}))
									windowManager.saveWindows()
								}
							})
					windowManager.saveWindows()
						},
						saveAsMethod: function(item, focusedWindow) {
							fileManager.saveFileAs(ext, (err, path) => {
								if (!err) {
									focusedWindow.webContents.send("document_saved", path)
									runTask(addRecentDocument({filePath: path}))
									windowManager.saveWindows()
								}
							})
							
						},
						renameMethod: function(item, focusedWindow) {
							//fileManager.renameFile()
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


let initialize = function(options) {
	
	processMenu = options.processMenu
	
	userMenuOptions = options
	userMenuOptions.processMenu = processMenu || id
	
	const windowOptions = options.windowOptions || {}

	const ext = _.defaultTo(options.docExtension, "")
	
	const localize = options.localize || id
	fileManager.localize(localize)

	windowManager.initializeWithEntryPoint(options.entryPoint, options.openDevTools)

	fileManager.setCompareDocument(options.documentChanged)
	
	app.on("activate", function () {
		if (windowManager.getWindowDocuments().length === 0) windowManager.createWindow(_.extend({ docExtension: ext }, windowOptions))
		runTask(updateMenu())
	})
	
	app.on("before-quit", function() {
		windowManager.setQuitting(true)
	})
	
	app.on("browser-window-blur", runTaskF(updateMenu()
											.chain(docs => windowManager.isQuitting() ? Task.empty() : Task.of(docs))
											.chain(windowManager.saveWindowsTask)
									)
		)
	app.on("browser-window-focus", runTaskF(updateMenu()))
	
	// Quit when all windows are closed.
	app.on("window-all-closed", function() {
		// On OS X it is common for applications and their menu bar
		// to stay active until the user quits explicitly with Cmd + Q
		if (process.platform != "darwin") {
			app.quit()
		}
		else {
			runTask(updateMenu())
		}
	})
	
	app.on("open-file", function(e, filePath) {
		console.log("open-file")
		openDocument(windowOptions)(filePath)
	})

	// This method will be called when Electron has finished
	// initialization and is ready to create browser windows.
	app.on("ready", function() {
		
		//set up menu
		createMenuOptions(userMenuOptions).fork(console.error, menuManager.setMenu)
		
		// Restore windows
		windowManager.loadWindows(ext, windowOptions)
	})
		
}

module.exports = {
	getRendererModule: function() {
		return require("./rendererModule")
	},
	main: initialize
}
