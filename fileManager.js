'use strict';

const electron = require('electron');
const dialog = electron.dialog;
const BrowserWindow = electron.BrowserWindow;
const path = require('path');
const async = require('async');
const ipcHelper = require('./ipcHelper');
const { windowTitle } = require('./utils')

var fs = require("fs");

const Immutable = require('immutable')
const { List, Map } = require('immutable-ext')
const Task = require('data.task')

let fileExists = fs.existsSync

function isEdited(filepath, content) {
	if(filepath && filepath != 'no-path') {
		fs.readFile(filepath, function (err, data) {
			if (err) {
				return true; //if there's no file, it must have been changed
			} else {
				var savedContent = data.toString()
				return content !== savedContent;
			}
		});
	}
}

let getParam = (win, param) => {
	return new Task(function(reject, resolve) {
		ipcHelper.requestFromRenderer(win, param, function(event, data) {
			console.log("Retrieved " + param + " value: " + data + " event " + event)
			resolve(data)
		})
	})
}

// requests filename and content from current browser window
function getFilepathAndContent(cb) {
	ipcHelper.requestFromRenderer(BrowserWindow.getFocusedWindow(), 'filepath_content', function(event, results) {
		cb(results.filepath, results.content)
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
		filepath: function(callback) {
			dialog.showOpenDialog({
				properties: ['openFile']
			}, function(filepath) {
				callback(null, filepath);
			});
		}
	},
	function (err, results) {
		var filepath = results.filepath;
		var currentContent = results.currentContent;

		if(filepath) { // else user cancelled, do nothing
			filepath = filepath.toString();
			fs.readFile(filepath, function(err, openFileContent) {
				callback(err, filepath, currentContent, openFileContent);
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

let userSavesHandler = ext => {
	genericSaveOrSaveAs('save', ext);
}

let userSaveAsHandler = ext => {
	genericSaveOrSaveAs('save-as', ext);
}

let genericSaveOrSaveAs = (type, ext, callback) => {
	getFilepathAndContent(function(filepath, content) {		
		if (type === 'save-as' || !filepath) {
			dialog.showSaveDialog({
				  filters: [
						{name: 'OneModel', extensions: ['onemodel']},
						{name: 'All Files', extensions: ['*']}
				  ]
				},
				function(filepath) {
					if(filepath) { //else user cancelled, do nothing
						//send new filepath to renderer
					
						if (path.extname(filepath).length == 0 && ext.length > 0) {
							filepath = filepath + "." + ext
						}
					
						setImmediate(function() { //wait a tick so that dialog goes away and window focused again
							let win = BrowserWindow.getFocusedWindow()
							win.setRepresentedFilename(filepath)
							win.setTitle(windowTitle(filepath))
							win.filePath = filepath
							win.webContents.send('set-filepath', filepath)
							if(callback) { callback() }
						});
						writeToFile(filepath, content)
					}
				}
			)
		} else {
			console.log(filepath)
			writeToFile(filepath, content);
			if(callback) { callback(); }
		}
	});
}

let closeHandler = ext => edited => {
	getFilepathAndContent(function(filepath, content) {
		if(filepath) {
			resolveClose( isEdited(filepath, content), ext , content);
		} else {
			resolveClose( (content !== ""), ext, content);
		}
	});
}

let resolveClose = (edited, ext, content) => {
	/*
		We want to immediately close if:          it has no content and hasn't been edited
		We want to immediately save and close if: it has content but hasn't been edited
		We want to ask if:                        it has been edited
	*/

	if(!edited && content === "") {
		BrowserWindow.getFocusedWindow().close();
	} else if(!edited && content !== "") {
		console.log("in resolve close")
		genericSaveOrSaveAs('save', ext, function() {
			BrowserWindow.getFocusedWindow().close();
		});
		
		console.log("done generic save")
	} else {
		// confirm with dialog
		var button = dialog.showMessageBox({
			type: "question",
			buttons: ["Save changes", "Discard changes", "Cancel"],
			message: "Your file was changed since saving the last time. Do you want to save before closing?"
		});

		if (button === 0) { //SAVE
			genericSaveOrSaveAs('save', function() {
				BrowserWindow.getFocusedWindow().close();
			});
		} else if (button === 1) { //DISCARD
			BrowserWindow.getFocusedWindow().close();
		} else {
			//CANCEL - do nothing
		}
	}
}

function writeToFile(filepath, content) {
	if (typeof content !== "string") {
		throw new TypeError("getContent must return a string")
	}
	fs.writeFile(filepath, content, function (err) {
		if (err) {
			console.log("Write failed: " + err);
			return;
		}
	});
}

module.exports = {
	openFile: userOpensHandler,
	saveFile: userSavesHandler,
	saveFileAs: userSaveAsHandler,
	fileExists: fileExists,
	renameFile: null,
	closeFile: closeHandler,
	fileIsEdited: isEdited
};
