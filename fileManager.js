"use strict"

const electron = require("electron")
const dialog = electron.dialog
const BrowserWindow = electron.BrowserWindow
const path = require("path")
const ipcHelper = require("./ipcHelper")
const { windowTitle, id } = require("./utils")
const chokidar = require("chokidar")
const dialogTasks = require("./dialogTasks")

let fs = require("./fileTasks")

const Task = require("data.task")

let writingFiles = {}

const fileExists = fs.existsSync

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

const askRenderer = property => win => {
	return new Task((reject, resolve) => {
		ipcHelper.requestFromRenderer(win, property, (event, results) => {
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
	const win = BrowserWindow.getFocusedWindow()
	genericSaveOrSaveAs(win, "save", ext, callback)
}

const userSaveAsHandler = (ext, callback) => {
	const win = BrowserWindow.getFocusedWindow()
	genericSaveOrSaveAs(win, "save-as", ext, callback)
}

const checkNotNull = something => {
	return new Task((reject, resolve) => {
		if (something) {
			resolve(something)
		}
		else {
			reject("Error")
		}
	})
}

const genericSaveOrSaveAs = (win, type, ext, callback) => {
	
	const translate = localize || id
	
	getFilepathAndContent(win)
		.fork(console.error, results => {
			if (type === "save-as" || !results.filePath) {
				dialog.showSaveDialog({
						filters: [
							{name: "OneModel", extensions: ["onemodel"]},
							{name: translate("All Files"), extensions: ["*"]}
						]
					},
					function(filePath) {
						Task.of(filePath)
							.chain(checkNotNull)
							.map(filePath => {
								if (path.extname(filePath).length == 0 && ext.length > 0) {
									return filePath + "." + ext
								}
								else {
									return path
								}
							})
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
							.chain(filePath => fs.writeFile(filePath, results.content))
							.fork(err => {
								callback(err, filePath)
							}, path => {
								callback(null, path)
							})							
					}
				)
			}
			else {
				fs.writeFile(results.filePath, results.content)
					.fork(err => {
						callback(err, results.filePath)
					}, path => {
						callback(null, path)
					})	
			}
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
			return fs.writeFile(results.filePath, results.content)
		})
		.chain(x => setWinDocumentEdited(false)(win).map(result => x))
}

const cleanup = win => {
	if (win.watcher) { win.watcher.close() }
}

const closeWindow = (win, ext, performClose, closeCancelled) => {
	
	const closeAndCleanup = () => {
		cleanup(win)
		performClose()
	}
	
	getFilepathAndContent(win)
		.fork(console.error, (results) => {
			if(results.filePath) {
				hasChanges(results.filePath, results.content, edited => {
					resolveClose(win, edited, ext, results.content, closeAndCleanup, closeCancelled)	
				})
			
			} else {
				resolveClose(win, (results.content !== ""), ext, results.content, closeAndCleanup, closeCancelled)
			}
		})
}

const resolveClose = (win, edited, ext, content, performClose, closeCancelled) => {
	/*
		We want to immediately close if:          it has no content and hasn"t been edited
		We want to immediately save and close if: it has content but hasn"t been edited
		We want to ask if:                        it has been edited
	*/
	
	console.log("resolve close. Edited " + edited)
	
	const translate = localize || id

	if(!edited && content === "") {
		// BrowserWindow.getFocusedWindow().close()
		performClose()
		
	} else if(!edited && content !== "") {
		genericSaveOrSaveAs(win, "save", ext, function(err, filePath) {
			if (err) {
				console.log("Can't close window: Error saving. " + err)
			}
			else {
				console.log("closing after saved")
				performClose()
			}
		})
	} else {		
		// confirm with dialog
		let button = dialog.showMessageBox({
			type: "question",
			buttons: [ translate("Save changes"), translate("Discard changes"), translate("Cancel")],
			message: translate("Your file was changed since saving the last time. Do you want to save before closing?")
		})

		if (button === 0) { //SAVE
			genericSaveOrSaveAs(win, "save", ext, function(err, filePath) {
				if (err) {
					console.log("Can't close window: Error saving. " + err)
				}
				else {
					console.log("closing after saved")
					performClose(filePath)
				}
			})
		} else if (button === 1) { //DISCARD
			console.log("Discard save")			
			performClose(null)
		} else {
			//CANCEL - do nothing
			console.log("cancel close")
			closeCancelled()
		}
	}
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
	windowPathChanged: windowPathChanged
}
