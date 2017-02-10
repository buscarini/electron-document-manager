"use strict"

const electron = require("electron")
const dialog = electron.dialog
const BrowserWindow = electron.BrowserWindow
const path = require("path")
const ipcHelper = require("./ipcHelper")
const { windowTitle, id } = require("./utils")

let fs = require("fs")

const Task = require("data.task")

const fileExists = fs.existsSync

let localize
let documentChanged = (saved, current) => saved !== current

function isEdited(filePath, content, completion) {
	if(filePath && filePath != "no-path") {
		fs.readFile(filePath, function (err, data) {
			if (err) {
					completion(true) //if there"s no file, it must have been changed
			} else {
				let savedContent = data.toString()
				completion(documentChanged(savedContent, content))
			}
		})
	}
	else {
		completion(content !== "")
	}
}

// requests filename and content from current browser window
function getFilepathAndContent(win, cb) {
	ipcHelper.requestFromRenderer(win, "filepath_content", function(event, results) {
		cb(results.filePath, results.content)
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

const genericSaveOrSaveAs = (win, type, ext, callback) => {
	
	const translate = localize || id
	
	console.log("generic save or save as " + win.id)
	
	getFilepathAndContent(win, function(filePath, content) {		
		if (type === "save-as" || !filePath) {
			dialog.showSaveDialog({
					filters: [
						{name: "OneModel", extensions: ["onemodel"]},
						{name: translate("All Files"), extensions: ["*"]}
					]
				},
				function(filePath) {
					if(filePath) { //else user cancelled, do nothing
						//send new filePath to renderer
					
						if (path.extname(filePath).length == 0 && ext.length > 0) {
							filePath = filePath + "." + ext
						}
					
						setImmediate(function() { //wait a tick so that dialog goes away and window focused again
							const win = BrowserWindow.getFocusedWindow()
							win.setRepresentedFilename(filePath)
							win.setTitle(windowTitle(filePath))
							win.filePath = filePath
							win.webContents.send("set-filepath", filePath)
						})
						writeToFile(filePath, content, callback)
					}
					else {
						if (callback) callback("User cancelled", filePath)
					}
				}
			)
		} else {
			writeToFile(filePath, content, callback)
		}
	})
}

const silentSave = (win, callback) => {
	getFilepathAndContent(win, function(filePath, content) {
		if (filePath) {
			console.log("about to save to " + filePath)
			writeToFile(filePath, content, callback)
		}
		else {
			console.log("can't save, abort")
			callback("Needs to ask to save")
		}
	})
}

const closeWindow = (win, ext, performClose, closeCancelled) => {
	getFilepathAndContent(win, function(filePath, content) {
		if(filePath) {
			isEdited(filePath,content, edited => {
				resolveClose(win, edited, ext, content, performClose, closeCancelled)	
			})
			
		} else {
			resolveClose(win, (content !== ""), ext, content, performClose, closeCancelled)
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

function writeToFile(filePath, content, callback) {
	if (typeof content !== "string") {
		throw new TypeError("getContent must return a string")
	}
	fs.writeFile(filePath, content, function (err) {
		callback(err, filePath)
		if (err) {
			console.log("Write failed: " + err)
			return
		}
	})
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
	}
}
