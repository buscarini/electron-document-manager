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

const fileExists = fs.existsSync

let localize
let documentChanged = (saved, current) => saved !== current

function isEdited(filePath, content, completion) {
	if (filePath && filePath != "no-path") {
		fs.readFile(filePath)
			.map(data => data.toString())
			.map(fileContent => documentChanged(fileContent, content))
			.fork(err => {
				completion(true) //if there's no file, it must have been changed
			}, data => {
				let savedContent = data.toString()
				completion(documentChanged(savedContent, content))
			})
	}
	else {
		completion(content !== "")
	}
}

// requests filename and content from current browser window
function getFilepathAndContent(win) {
	return new Task((reject, resolve) => {
		ipcHelper.requestFromRenderer(win, "filepath_content", function(event, results) {
			resolve(results)
		})
	})
}

// OPEN get path to the file-to-open
function userOpensHandler(filePath) {
	//check if already open
	if (!filePath || filePath.length === 0 ) {
		return new Task((reject, resolve) => {
			console.log("Show open dialog")	
			dialog.showOpenDialog({
				properties: ["openFile"]
			}, function(filePaths) {
				console.log(filePaths)
				
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
		console.log("Returning filepath " + filePath)
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
	
	console.log("generic save or save as " + win.id)
	
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
						
						
						/*if (filePath) { //else user cancelled, do nothing
							//send new filePath to renderer
					
							if (path.extname(filePath).length == 0 && ext.length > 0) {
								filePath = filePath + "." + ext
							}
					
							setImmediate(function() { //wait a tick so that dialog goes away and window focused again
								const win = BrowserWindow.getFocusedWindow()
								win.setRepresentedFilename(filePath)
								win.setTitle(windowTitle(filePath))
								// win.filePath = filePath
								windowPathChanged(win, filePath)
								// win.webContents.send("set-filepath", filePath)
							})
							fs.writeFile(filePath, content)
								.fork(err => {
									callback(err, filePath)
								}, path => {
									callback(null, path)
								})							
						}
						else {
							if (callback) callback("User cancelled", filePath)
						}*/
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

const mergeChanges = (filePath, fileContents, win, winContents) => {

	const keepChanges = silentSaveTask(win)
		
	const reloadFromDisk = new Task((reject, resolve) => {
		win.webContents.send("set-content", fileContents)
		resolve(fileContents)
	})
	
	if (documentChanged(fileContents, winContents)) {
		// Ask the user which one to keep
		return dialogTasks.ask("The file has been changedo on disk. Do you want to keep your changes, or reload the document?", [
			{ name: "Reload From Disk", reloadFromDisk },
			{ name: "Keep My Changes", keepChanges }
		])
	}
	else {
		return reloadFromDisk
	}
}

const windowPathChanged = (win, filePath) => {
	win.filePath = filePath
	win.webContents.send("set-filepath", filePath)
	if (win.watcher) { win.watcher.close() }
	win.watcher = chokidar.watch(filePath)
		.on("change", path => {
			// TODO: see what to do here
			// If the document hasn't changed, reload from disk. If it has changed, ask the user and loose changes or keep the memory changes and save to disk
			
			(Task.of((fileContents, pathAndContents) => {
						mergeChanges(filePath, fileContents, win, pathAndContents.contents)
					})
					.ap(fs.readFile(path))
					.ap(getFilepathAndContent(win))
			)
			.fork(console.error, res => {
				console.log("Merged changes")
			})
		})
		.on("unlink", path => {
			// TODO: see what to do when the file is deleted
			
		})
}

const silentSaveTask = (win) => {
	getFilepathAndContent(win)		
		.chain(results => {
			return fs.writeFile(results.filePath, results.content)
		})
}

const silentSave = (win, callback) => {
	silentSaveTask(win)
		.fork(err => {
			callback(err, null)
		}, path => {
			callback(null, path)
		})
}

const closeWindow = (win, ext, performClose, closeCancelled) => {
	getFilepathAndContent(win)
		.fork(console.error, (results) => {
			if(results.filePath) {
				isEdited(results.filePath, results.content, edited => {
					resolveClose(win, edited, ext, results.content, performClose, closeCancelled)	
				})
			
			} else {
				resolveClose(win, (results.content !== ""), ext, results.content, performClose, closeCancelled)
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
	silentSave: silentSave,
	fileExists: fileExists,
	renameFile: null,
	close: closeWindow,
	fileIsEdited: isEdited,
	setCompareDocument: (docChanged) => {
		documentChanged = docChanged
	},
	windowPathChanged: windowPathChanged
}
