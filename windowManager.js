"use strict"

const electron = require("electron")
const app = electron.app
const R = require("ramda")
const BrowserWindow = electron.BrowserWindow
const _ = require("lodash")
const { windowTitle, runTask, temporalPath, blankString } = require("./utils")
const fs = require("./fileTasks")

const Immutable = require("immutable-ext")
const Task = require("data.task")

const fileManager = require("./fileManager")
const { addRecentDoc, loadCurrentDocs, saveCurrentDocs, updateCurrentDoc, recentDocument } = require("./recentDocs")

const { Doc, guidLens, filePathLens } = require("./document")
const documentManager = require("./documentManager")

// let documents = []
let untitledIndex = 1
let indexFile
let openDevTools
let appIsQuitting = false

let focusUpdateHandler = null

function createWindow(options) {
	options = options || {}
		
	const ext = options.docExtension || ".onemodel"
	
	const path = R.view(filePathLens, options)

	//pick a title (set as BrowserWindow.title and send with set-title)
	const title = path ? windowTitle(path) : ( "Untitled " + untitledIndex++ )

	const guid = R.view(guidLens, options)

	let parameters = {
		x: _.defaultTo(options.x, null),
		y: _.defaultTo(options.y, null),
		width: _.defaultTo(options.width, 900),
		height: _.defaultTo(options.height, 600),
		guid: guid,
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

	console.log("DO CREATE THE WINDOW")
	
	// Create the browser window.
	let win = null
	win = new BrowserWindow(parameters)
	win.show()
	// win.once("ready-to-show", () => {
	// 	console.log("SHOW THE WINDOW");
	// 	win.show()
	// })
	
	const minWidth = options.minWidth || 50
	const minHeight = options.minHeight || 50
	win.setMinimumSize(minWidth, minHeight)
	
	const container = Doc(win, path, guid)
	// documents.push(container)
	documentManager.addDocument(container)

	// and load the index.html of the app.
	win.loadURL(indexFile)

	win.webContents.on("did-finish-load", function() {
		setUpWindow(win, path, options.fileContent)
	})

	win.on("close", function(e) {
		console.log("close " + win.id + " " + path)
		e.preventDefault()
		
		// Ask the user if the doc file is not up to date
		fileManager.close(appIsQuitting, win, ext, filePath => {
			console.log("perform close " + win.id)
		
			const doc = documentManager.getWindowDocument(win)
			runTask(addRecentDoc(doc)
				.chain(updateCurrentDoc))
		
			// if (appIsQuitting) {
// 				runTask(updateCurrentDoc(doc))
// 			}
	
			console.log("docs: " + JSON.stringify(documentManager.getDocuments().length))
		
			documentManager.removeDocument(win.id)
			// documents = _.filter(documents, container => container.id !== win.id)
			if (win) {
				win.hide()
				win.destroy()
				win = null
			}
		
			console.log("docs: " + JSON.stringify(documentManager.getDocuments().length))
		
			if (appIsQuitting && documentManager.getDocuments().length == 0) {
				console.log("Try quitting again")
				app.quit()
			}
		
			if (!appIsQuitting) {
				saveWindows()
			}
		}, () => {
			appIsQuitting = false
		})
		
	})
	
// 	win.on("closed", function() {
// 		documents = _.filter(documents, container => container.id !== winId)
//
// 		// if (appIsQuitting && documents.length == 0) {
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
	
	return win
}

const createDocumentWindow = (properties, ext) => {
    //not open, do the rest of the stuff
	const focused = BrowserWindow.getFocusedWindow()

	const guid = R.view(guidLens, properties)
	const filePath = R.view(filePathLens, properties)
	
	const isTemporal = blankString(filePath) // || isBasePath(baseTemporalPath, properties.filePath)
	console.log("isTemporal: " + JSON.stringify(isTemporal))
	
	const path = isTemporal ? temporalPath(guid) : filePath
	
	const createWin = (path, contents) => {
		return new Task((reject, resolve) => {
			
			const options = {
				focusedWindow: focused,
				guid: guid,
				filePath: isTemporal ? null : path,
				fileContent: contents,
				x: properties.x,
				y: properties.y,
				width: properties.width,
				height: properties.height,
				docExtension: ext,
				minWidth: properties.minWidth,
				minHeight: properties.minHeight
			}

			const newWin = createWindow(options)

			resolve(newWin)
		})
	}
	
	console.log("created window for doc " + path)
		
	return Task.of(path)
			.chain(fs.readFile)
			.chain(contents => createWin(path, contents))
			.orElse(x => Task.of(createWin(null, "")))
			.chain(win => {
				saveWindows()
		
				console.log("Before add recent doc. Path: " + path)
		
				if (R.is(String, path) && !isTemporal) {
					return addRecentDoc(recentDocument(win, path))
				}

				return Task.of(win)
			})
}

function setUpWindow(win, filePath, contents) {
	console.log("setupWindow")
	
	if (filePath) {
		documentManager.updateDocumentPath(win.id, filePath)
		
		// documents = _.map(documents, c => {
		// 	if (c.window.id === win.id) {
		// 		c.path = filePath
		// 	}
		// 	return c
		// })
		
		fileManager.windowPathChanged(win, filePath)
		// win.webContents.send("set-filepath", filePath)
		win.setRepresentedFilename(filePath)
		win.setTitle(windowTitle(filePath))
	}
	
	if(contents) {
		win.webContents.send("set-content", contents)
	}
}

const loadWindows = (ext, options) => {
	console.log("load windows")
	loadCurrentDocs()
		.map(R.reverse)
		.fork(console.error, docs => {	
			console.log("loaded current docs")
			Immutable.fromJS(docs)
				.map(prop => prop.toJS())
				.traverse(Task.of, prop => createDocumentWindow(_.extend(prop, options), ext))
				.fork(console.error, results => {
					console.log("create windows: " + results)
					const windows = _.filter(results.toArray(), win => win != null)
					if (windows.length === 0) {
						createWindow(_.extend({ docExtension: ext }, options))
					}
				})
		})
}

const saveWindows = () => {
	saveCurrentDocs(documentManager.getDocuments())
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
	setQuitting: function(isQuitting) {
		appIsQuitting = isQuitting
	},
	getWindowDocuments: documentManager.getDocuments,
	getWindows: documentManager.getWindows,
	getWindowDocument: documentManager.getWindowDocument,
	saveWindows: saveWindows,
	loadWindows: loadWindows
}
