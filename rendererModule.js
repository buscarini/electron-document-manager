'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const BrowserWindow = electron.remote.BrowserWindow;

var filepath = null,
    title = "Untitled",
    setContent = null,
    getContent = null;

ipcRenderer.on('set-content', function(event, content, callbackChannel) {
  setContent(content.toString());
	if(callbackChannel) ipcRenderer.send(callbackChannel);
});

ipcRenderer.on('request-content', function(event, callbackChannel) {
	ipcRenderer.send(callbackChannel, getContent());
});

ipcRenderer.on('set-filepath', function(event, filepathArg, callbackChannel) {
	console.log("set filepath " + filepathArg)
	filepath = filepathArg;
	if(callbackChannel) ipcRenderer.send(callbackChannel);
});

ipcRenderer.on('request-filepath', function(event, callbackChannel) {
	console.log("requesting filepath " + filepath)
	var path = filepath
	if (filepath == null) {
		path = ""
	}
	ipcRenderer.send(callbackChannel, path);
});

// ipcRenderer.on('request-properties', function(event, callbackChannel) {
// 	console.log("requesting properties")
// 	let win = BrowserWindow.getFocusedWindow()
// 	let bounds = win.getBounds()
// 	ipcRenderer.send(callbackChannel, { filepath: filepath, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
// });

// ipcRenderer.on('request-filepath_content', function(event, callbackChannel) {
// 	ipcRenderer.send(callbackChannel, { filepath: filepath, content: getContent() });
// });



module.exports = {
  setEdited: function(edited) {
	let win = BrowserWindow.getFocusedWindow()
    if (win) {
		win.setDocumentEdited(edited)
	}
  },
  setContentSetter: function(fn) {
    setContent = fn;
  },
  setContentGetter: function(fn) {
    getContent = fn;
  }
}
