"use strict"

const electron = require("electron")
const dialog = electron.dialog
const BrowserWindow = electron.BrowserWindow
const R = require("ramda")
const path = require("path")
const chokidar = require("chokidar")
let nodeFs = require("fs")
const Task = require("data.task")
const Immutable = require("immutable-ext")

const ipcHelper = require("./ipcHelper")
const { windowTitle, id, blankString, baseTemporalPath, temporalPath } = require("./utils")
const dialogTasks = require("./dialogTasks")
const { updateCurrentDoc } = require("./recentDocs")
const { guidLens, filePathLens, winLens } = require("./document")
const documentManager = require("./documentManager")
const { addRecentDoc } = require("./recentDocs")

let fs = require("./fileTasks")

let writingFiles = {}

const fileExists = nodeFs.existsSync

let localize
let documentChanged = (saved, current) => saved !== current

function hasChanges(filePath, content, completion) {
	if (filePath && filePath != "no-path") {
		fs.readFile(filePath)
			.map(data => data.toString())
			.map(fileContent => documentChanged(fileContent, content))
			.fork(err => completion(true) //if there's no file, we have changes
				, completion)
	}
	else {
		completion(content !== "")
	}
}

// RENDERER COMMUNICATION
const askRenderer = property => win => {
	return new Task((reject, resolve) => {
		ipcHelper.requestFromRenderer(win, property, (event, results) => {
			console.log("resolve ask renderer " + property)
			resolve(results)
		})
	})
}

const tellRenderer = property => value => win => {
	return new Task((reject, resolve) => {
		win.webContents.send(property, value)
		resolve(property)
	})
}

// requests filename and content from current browser window
const getFilepathAndContent = askRenderer("filepath_content")
const isWinDocumentEdited = askRenderer("is_edited")
const setWinDocumentEdited = tellRenderer("set_edited")

const getContent = win => getFilepathAndContent(win).map(results => results.content)

const removeTemporalFile = id => {
	return fs.removeFile(temporalPath(id))
}

// OPEN get path to the file-to-open
function userOpensHandler(filePath) {
	//check if already open
	if (!filePath || filePath.length === 0 ) {
		return new Task((reject, resolve) => {
			dialog.showOpenDialog({
				properties: ["openFile"]
			}, function(filePaths) {				
				if (filePaths instanceof Array && filePaths[0]) {
					resolve(filePaths[0])
				}
				else {
					reject("Err: cancelled")
				}
			})
		})
	}
	else {
		return Task.of(filePath)
	}
}

// SAVE

const userSavesHandler = (ext, callback) => {
	console.log("Getting focused window")
	const win = BrowserWindow.getFocusedWindow()
	genericSaveOrSaveAs(win, "save", ext)
		.fork(err => {
			console.error("Can't close window: Error saving. " + err)
			callback(err, null)
		}, res => {
			console.log("closing after saved")
			callback(null, res)
		})
}

const userSaveAsHandler = (ext, callback) => {
	const win = BrowserWindow.getFocusedWindow()
	genericSaveOrSaveAs(win, "save-as", ext)
		.fork(err => {
			console.error("Can't close window: Error saving. " + err)
			callback(err, null)
		}, res => {
			console.log("closing after saved")
			callback(null, res)
		})	
}

const askOverwrite = (filePath) => {
	return dialogTasks.ask("This file already exists. Do you want to overwrite it?", [
			{ name: "Cancel", task: Task.empty() },
			{ name: "Overwrite", task: Task.of(filePath) }
		])
}



const genericSaveOrSaveAs = (win, type, ext) => {
	
	const translate = localize || id
	
	const doc = documentManager.getWindowDocument(win)
	const guid = R.view(guidLens, doc)

	console.log("genericSaveOrSaveAs")
		
	return getFilepathAndContent(win)
		.chain(results => {
			
			console.log("EEOAFKSDOASDOFKASDFKA")
			// console.log("RESULTS: " + JSON.stringify(results))
			
			if (type === "save-as" || blankString(results.filePath)) {
				return dialogTasks.saveDialog([
						{name: "OneModel", extensions: ["onemodel"]},
						{name: translate("All Files"), extensions: ["*"]}
					])
					.chain(filePath => blankString(filePath) ? Task.empty() : Task.of(filePath))
					.map(filePath => {
						if (path.extname(filePath).length == 0 && ext.length > 0) {
							return filePath + "." + ext
						}
						else {
							return path
						}
					})
					.map(R.tap(console.log))
					.chain(filePath => fileExists(filePath) ? askOverwrite(filePath) : Task.of(filePath))
					.chain(filePath => {
						return new Task((reject, resolve) => {
							setImmediate(function() { //wait a tick so that dialog goes away and window focused again
								const win = BrowserWindow.getFocusedWindow()
								win.setRepresentedFilename(filePath)
								win.setTitle(windowTitle(filePath))
								// win.filePath = filePath
								windowPathChanged(win, filePath)
								// win.webContents.send("set-filepath", filePath)
								resolve(filePath)
							})
						})
					})
					.chain(filePath => removeTemporalFile(guid).map(x => filePath))
					.map(filePath => R.set(filePathLens, filePath, doc))
					.chain(doc => addRecentDoc(doc))
					.map(R.view(filePathLens))
					.map(filePath => { return { filePath: filePath, content: results.content }})
			}
			else {
				return Task.of(results)
			}
		})
		.chain(results => fs.writeFile(results.content)(results.filePath))
		.map(res => res.path)
		.chain(path => {
			console.log("genericSaveOrSaveAs -> before update current doc (after save)")
			return updateCurrentDoc(doc).map(x => path)
		})
}

const mergeContents = (filePath, fileContents, win, winContents) => {
	const keepChanges = silentSaveTask(win)
	const reloadFromDisk = new Task((reject, resolve) => {
		win.webContents.send("set-content", fileContents)
		resolve(fileContents)
	})
	const askWhat2Do = dialogTasks.ask("The file has been changed on disk. Do you want to keep your changes, or reload the document?", [
		{ name: "Reload From Disk", task: reloadFromDisk },
		{ name: "Keep My Changes", task: keepChanges }
	])
		
	if (documentChanged(fileContents, winContents)) {
		return Task.of(winContents)
	}
		
	return isWinDocumentEdited(win)
		.chain(edited => {
			return edited ? askWhat2Do : reloadFromDisk
		})
}

const mergeChanges = (win, path) => {
	return (Task.of(fileContents => pathAndContents => {
						return { fileContents: fileContents, winContents: pathAndContents.content }
					})
					.ap(fs.readFile(path))
					.ap(getFilepathAndContent(win))
			)
			.chain(allContents => mergeContents(path, allContents.fileContents, win, allContents.winContents))
}

const windowPathChanged = (win, filePath) => {
	win.filePath = filePath
	win.webContents.send("set-filepath", filePath)
	if (win.watcher) { win.watcher.close() }
	win.watcher = chokidar.watch(filePath)
		.on("change", path => {
			
			if (writingFiles[filePath] === true) {
				writingFiles[filePath] = false
				return
			}
			
			mergeChanges(win, path)
				.fork(console.error, res => {
					console.log("Merged changes")
				})
		})
		.on("unlink", path => {
			// TODO: see what to do when the file is deleted
			
		})
}

const silentSaveTask = (win) => {
	return getFilepathAndContent(win)
		.map(results => {
			writingFiles[results.filePath] = true
			return results
		})
		.chain(results => {
			return fs.writeFile(results.content)(results.filePath)
		})
		.chain(x => setWinDocumentEdited(false)(win).map(result => x))
}

const cleanup = win => {
	if (win.watcher) { win.watcher.close() }
}

const saveTemporalDocument = doc => {
	const pathTask = fs.createDir(baseTemporalPath())
						.map(path => R.view(guidLens, doc))
						.map(temporalPath)
						
	const win = R.view(winLens, doc)
	
	return (
			Task.of(fs.writeFile)
				.ap(getContent(win))
				.ap(pathTask)
			)
			.chain(t => t)
			.map(path => doc)
}

const closeWindow = (appIsQuitting, win, ext, performClose, closeCancelled) => {
	
	console.log("Close window")
	
	const closeAndCleanup = () => {
		cleanup(win)
		performClose()
	}
	
	getFilepathAndContent(win)
		.fork(console.error, results => {
			
			if (appIsQuitting && blankString(results.filePath)) {
				// If has path and no changes, just close it, otherwise save it in a temporal path
				const saveTask = R.pipe(
					documentManager.getWindowDocument,
					saveTemporalDocument
				)(win)
				
				saveTask.fork(closeCancelled, res => {
						console.log("closing")
						closeAndCleanup()
					})
								
				// fs.createDir(baseTemporalPath())
// 					.chain(base => {
// 						return R.pipe(
// 							documentManager.getWindowDocument,
// 							R.view(guidLens),
// 							temporalPath,
// 							R.tap(console.log),
// 							fs.writeFile(results.content)
// 						)(win)
//
// 						// console.log("writing file to " + path)
// 						// return fs.writeFile(path, results.content)
// 					})
// 					.fork(closeCancelled, res => {
// 						console.log("closing")
// 						closeAndCleanup()
// 					})
			}
			else if (!blankString(results.filePath)) {
				isWinDocumentEdited(win)
					.fork(console.error, edited => {
						console.log("has filepath")
						console.log("edited: " + JSON.stringify(edited))
						resolveClose(win, edited, ext, results.content, closeAndCleanup, closeCancelled)	
					})
			}
			else {
					console.log("no filepath")
					resolveClose(win, (results.content !== ""), ext, results.content, closeAndCleanup, closeCancelled)
				}				
			})
}

// discardWindowDocument :: win => Task(path)
const discardWindowDocument = R.pipe(
		documentManager.getWindowDocument,
		R.view(guidLens),
		temporalPath,
		R.tap(console.log),
		fs.removeFileIfExists
	)

const resolveClose = (win, edited, ext, content, performClose, closeCancelled) => {
	/*
		We want to immediately close if:          it has no content and hasn"t been edited
		We want to immediately save and close if: it has content but hasn"t been edited
		We want to ask if:                        it has been edited
	*/
	
	const performCloseTask = (x) => {
		return new Task((reject, resolve) => {
			// closing after user decided
			performClose()
			return resolve(x)
		})
	}
	
	const translate = localize || id	
	
	const saveTask = genericSaveOrSaveAs(win, "save", ext).chain(performCloseTask)
	
	if(!edited && content === "") {
		performClose()
		
	} else if(!edited && content !== "") { // See if we really need to save here
		saveTask.fork(err => {
				console.error("Can't close window: Error saving. " + err)	
			}, res => {
				console.log("closing after saved")
			})
	} else {		
		// confirm with dialog
		
		dialogTasks.ask(translate("Your file was changed since saving the last time. Do you want to save before closing?"),
			[
				{ name: translate("Save Changes"), task: saveTask },
				{ name: translate("Discard Changes"), task: discardWindowDocument(win).chain(performCloseTask) },
				{ name: translate("Cancel"), task: Task.of("cancelled").map(x => {
					closeCancelled()
					return x
				}) }
			])
			.fork(err => {
				console.error("Can't close window: Error saving. " + err)	
			}, res => {
				// console.log("// closing after user decided")
			})
	}
}

// saveTemporalDocuments:: [Doc] -> Task [Doc]
const saveTemporalDocuments = docs => {
	return Immutable.fromJS(docs)
		.map(doc => doc.toJS())
		.traverse(Task.of, saveTemporalDocument)
		.map(results => results.toArray())
}

module.exports = {
	localize: (translate) => {
		localize = translate
	},
	openFile: userOpensHandler,
	saveFile: userSavesHandler,
	saveFileAs: userSaveAsHandler,
	fileExists: fileExists,
	renameFile: null,
	close: closeWindow,
	fileIsEdited: hasChanges,
	setCompareDocument: (docChanged) => {
		documentChanged = docChanged
	},
	windowPathChanged: windowPathChanged,
	saveTemporalDocuments: saveTemporalDocuments
}
