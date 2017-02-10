"use strict"

const electron = require("electron")
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const _ = require("lodash")
const { windowTitle, readFileTask, runTask } = require("./utils")

const Immutable = require("immutable")
const Task = require("data.task")

const fileManager = require("./fileManager")
const { addRecentDoc, loadCurrentDocs, saveCurrentDocs, updateCurrentDoc } = require("./recentDocs")

const Container = (win, path) => {
	return {
		window: win,
		id: win.id,
		filePath: path
	}
}

let containers = []
let untitledIndex = 1
let indexFile
let openDevTools
let appIsQuitting = false

let focusUpdateHandler = null

function createWindow(options) {
	options = options || {}
		
	const ext = options.docExtension || ".onemodel"

	//pick a title (set as BrowserWindow.title and send with set-title)
	let title = options.filePath ? windowTitle(options.filePath) : ( "Untitled " + untitledIndex++ )

	let parameters = {
		x: _.defaultTo(options.x, null),
		y: _.defaultTo(options.y, null),
		width: _.defaultTo(options.width, 900),
		height: _.defaultTo(options.height, 600),
		title: title
	}

	if(options.focusedWindow) {
		let bounds = options.focusedWindow.getBounds()
		parameters = _.extend(parameters, {
			x: bounds.x + 20,
			y: bounds.y + 20
		})
	}

	parameters = _.extend(parameters, { show: false })

	// Create the browser window.
	let win = null
	win = new BrowserWindow(parameters)
	win.once("ready-to-show", () => {
		win.show()
	})
	
	const container = Container(win, options.filePath, options.tmpPath)
	containers.push(container)

	// and load the index.html of the app.
	win.loadURL(indexFile)

	win.webContents.on("did-finish-load", function() {
		setUpWindow(win, options.filePath, options.fileContent)
	})
	
	const filePath = options.filePath

	win.on("close", function(e) {
		console.log("close " + win.id + " " + filePath)
		e.preventDefault()
		
		fileManager.close(win, ext, (filePath) => {
			console.log("perform close " + win.id)
			
			const doc = recentDocument(win, filePath)
			addRecentDoc(doc)
				.fork(console.error, console.log)
			
			if (appIsQuitting) {
				runTask(updateCurrentDoc(doc))
			}
			else {
				saveWindows()
			}
		
			
			containers = _.filter(containers, container => container.id !== win.id)
			if (win) {
				win.hide()
				win.destroy()
				win = null
			}
			
			if (appIsQuitting && containers.length == 0) {
				console.log("Try quitting again")
				app.quit()
			}
		}, () => {
			appIsQuitting = false
		})
	})
	
// 	win.on("closed", function() {
// 		containers = _.filter(containers, container => container.id !== winId)
//
// 		// if (appIsQuitting && containers.length == 0) {
// // 			app.exit(0)
// // 		}
// 	})

	win.on("move", () => saveWindows())
	win.on("resize", () => saveWindows())

	if(focusUpdateHandler) {
		focusUpdateHandler()
		win.on("focus", focusUpdateHandler)
		win.on("blur", focusUpdateHandler)
	}
	
	if (openDevTools) {
		win.webContents.openDevTools()
	}
	
	
	saveWindows()
	
	return win
}

const createDocumentWindow = (properties, ext) => {
    //not open, do the rest of the stuff
	const win = BrowserWindow.getFocusedWindow()
	const path = properties.filePath
	
	const createWin = (path, contents) => {
		return new Task((reject, resolve) => {
			fileManager.fileIsEdited(path, contents, isEdited => {
				if(win && !isEdited && contents === "") {
					//open in current window
					setUpWindow(win, path, contents)
					resolve(win)
				} else {

					const options = {
						focusedWindow: win,
						filePath: path,
						fileContent: contents,
						x: properties.x,
						y: properties.y,
						width: properties.width,
						height: properties.height,
						docExtension: ext
					}
		
					const newWin = createWindow(options)

					resolve(newWin)
				}
			})
		})
	}
	
	let result = Task.of(null)
	
	if (path) {
		result = readFileTask(path)
			.chain(contents => createWin(path, contents))
	}
	else {
		result = createWin(path, "")
	}
	
	
	console.log("created window for doc " + path)
	
	
	return result
			.chain(win => {		
				saveWindows()
		
				console.log("Before add recent doc. Path: " + path)
		
				if (typeof path === "string") {
					return addRecentDoc(recentDocument(win, path))
				}

				return Task.of(win)
			})
}

function setUpWindow(win, filePath, contents) {
	if (filePath) {
		containers = _.map(containers, c => {
			if (c.window.id === win.id) {
				c.path = filePath
			}
			return c
		})
		
		win.webContents.send("set-filepath", filePath)
		win.setRepresentedFilename(filePath)
		win.setTitle(windowTitle(filePath))
	}
	if(contents) {
		win.webContents.send("set-content", contents)
	}
}

const loadWindows = (ext) => {
	console.log("load windows")
	loadCurrentDocs()
		.fork(console.error, docs => {	
			console.log("loaded current docs")
			const recents = _.filter(docs, recent => typeof recent === "object")
			Immutable.fromJS(recents)
				.map(prop => prop.toJS())
				.traverse(Task.of, prop => createDocumentWindow(prop, ext))
				.fork(console.error, results => {
					console.log("create windows: " + results)
					const windows = _.filter(results.toArray(), win => win != null)
					if (windows.length === 0) {
						createWindow({ docExtension: ext })
					}			
				})
		})
}

const recentDocumentForWin = win => {
	return {
			id: win.id,
			x: win.getBounds().x,
			y: win.getBounds().y,
			width: win.getBounds().width,
			height: win.getBounds().height
	}
}

const recentDocumentForPath = path => {
	return {
		filePath: path
	}
}

const recentDocument = (win, path) => {
	return Object.assign(recentDocumentForWin(win), recentDocumentForPath(path))
}

const loadProperties = () => {
	const results = _.map(containers, c => {
		return recentDocument(c.window, c.filePath)		
	})
	
	return Task.of(results)
}

const saveWindows = () => {
	loadProperties()
		.chain(saveCurrentDocs)
		.fork(console.error, console.log)
}


module.exports = {
	createWindow: createWindow,
	createDocumentWindow: createDocumentWindow,
	
	setUpWindow: setUpWindow,
	//note: focus and blur handlers will only apply to future windows at creation
	setFocusUpdateHandler: function(func) {
		focusUpdateHandler = func
	},
	initializeWithEntryPoint: function(entryPointArg, showDevTools) {
		indexFile = entryPointArg
		openDevTools = showDevTools
	},
	windowCloseCancelled: () => {
		appIsQuitting = false
	},
	getWindowContainers: function() { return containers },
	getWindows: function() { return _.map(containers, c => c.window) },
	setQuitting: function(isQuitting) {
		appIsQuitting = isQuitting
	},
	getWindowContainer: (win) => {
		if (win === undefined || win === null) return null
			
		return _.find(containers, c => c.id === win.id)
	},
	
	saveWindows: saveWindows,
	loadWindows: loadWindows
}
