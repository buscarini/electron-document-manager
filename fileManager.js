'use strict';

const electron = require('electron');
const dialog = electron.dialog;
const BrowserWindow = electron.BrowserWindow;
const path = require('path');
const async = require('async');
const ipcHelper = require('./ipcHelper');
const { windowTitle, id } = require('./utils')

var fs = require("fs");

const Immutable = require('immutable')
const { List, Map } = require('immutable-ext')
const Task = require('data.task')

let fileExists = fs.existsSync

var localize
var windowCloseCancelled
var documentChanged = (saved, current) => saved !== current

function isEdited(filePath, content) {
	if(filePath && filePath != 'no-path') {
		fs.readFile(filePath, function (err, data) {
			if (err) {
				return true; //if there's no file, it must have been changed
			} else {
				var savedContent = data.toString()
				return documentChanged(savedContent, content)
			}
		});
	}
}

let getParam = (win, param) => {
	return new Task(function(reject, resolve) {
		ipcHelper.requestFromRenderer(win, param, function(event, data) {
			resolve(data)
		})
	})
}

// requests filename and content from current browser window
function getFilepathAndContent(win, cb) {
	ipcHelper.requestFromRenderer(win, 'filepath_content', function(event, results) {
		cb(results.filePath, results.content)
	})
}

// OPEN get path to the file-to-open
function userOpensHandler(callback) {
	//check if already open
	async.parallel({
		currentContent: function(callback) {
			if(BrowserWindow.getFocusedWindow()) {
				ipcHelper.requestFromRenderer(BrowserWindow.getFocusedWindow(), 'content', function(event, currentContent) {
					callback(null, currentContent);
				});
			} else {
				callback(null, null); //no content
			}
		},
		filePath: function(callback) {
			dialog.showOpenDialog({
				properties: ['openFile']
			}, function(filePath) {
				callback(null, filePath);
			});
		}
	},
	function (err, results) {
		var filePath = results.filePath;
		var currentContent = results.currentContent;

		if(filePath) { // else user cancelled, do nothing
			filePath = filePath.toString();
			fs.readFile(filePath, function(err, openFileContent) {
				callback(err, filePath, currentContent, openFileContent);
			});
		}
	});
}

// SAVE
// 		if no path, call dialog window
// 		otherwise save to path
var isSaveAs;

var returnedFilepathCallback = null;
var returnedContentCallback = null;

let userSavesHandler = (ext, callback) => {
	genericSaveOrSaveAs('save', ext, callback)
}

let userSaveAsHandler = (ext, callback) => {
	genericSaveOrSaveAs('save-as', ext, callback)
}

let genericSaveOrSaveAs = (type, ext, callback) => {
	
	let translate = localize || id
	
	let win = BrowserWindow.getFocusedWindow()
	getFilepathAndContent(win, function(filePath, content) {		
		if (type === 'save-as' || !filePath) {
			dialog.showSaveDialog({
				  filters: [
						{name: 'OneModel', extensions: ['onemodel']},
						{name: translate('All Files'), extensions: ['*']}
				  ]
				},
				function(filePath) {
					if(filePath) { //else user cancelled, do nothing
						//send new filePath to renderer
					
						if (path.extname(filePath).length == 0 && ext.length > 0) {
							filePath = filePath + "." + ext
						}
					
						setImmediate(function() { //wait a tick so that dialog goes away and window focused again
							let win = BrowserWindow.getFocusedWindow()
							win.setRepresentedFilename(filePath)
							win.setTitle(windowTitle(filePath))
							win.filePath = filePath
							win.webContents.send('set-filepath', filePath)
						});
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
	});
}

let closeHandler = (ext, closed) => {
	let win = BrowserWindow.getFocusedWindow()
	getFilepathAndContent(win, function(filePath, content) {
		if(filePath) {
			resolveClose( isEdited(filePath, content), ext, content, closed)
		} else {
			resolveClose( (content !== ""), ext, content, closed)
		}
	})
}

let closeWindow = (win, ext, performClose) => {
	getFilepathAndContent(win, function(filePath, content) {
		if(filePath) {
			resolveClose( isEdited(filePath, content), ext, content, performClose)
		} else {
			resolveClose( (content !== ""), ext, content, performClose)
		}
	})
}

let resolveClose = (edited, ext, content, performClose) => {
	/*
		We want to immediately close if:          it has no content and hasn't been edited
		We want to immediately save and close if: it has content but hasn't been edited
		We want to ask if:                        it has been edited
	*/

	let doClose = performClose ? performClose : id
	
	let translate = localize || id

	if(!edited && content === "") {
		// BrowserWindow.getFocusedWindow().close()
		performClose()
		
	} else if(!edited && content !== "") {
		genericSaveOrSaveAs('save', ext, function() {
			performClose()
		});
	} else {		
		// confirm with dialog
		var button = dialog.showMessageBox({
			type: "question",
			buttons: [ translate("Save changes"), translate("Discard changes"), translate("Cancel")],
			message: translate("Your file was changed since saving the last time. Do you want to save before closing?")
		});

		if (button === 0) { //SAVE
			genericSaveOrSaveAs('save', function() {
				performClose()
			});
		} else if (button === 1) { //DISCARD
			performClose()
		} else {
			//CANCEL - do nothing
			if (windowCloseCancelled) windowCloseCancelled()
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
			console.log("Write failed: " + err);
			return;
		}
	});
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
	fileIsEdited: isEdited,
	windowCloseCancelled: (cancelled) => {
		windowCloseCancelled = cancelled
	},
	setCompareDocument: (docChanged) => {
		documentChanged = docChanged
	}
};
