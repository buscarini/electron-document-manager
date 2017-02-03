'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const BrowserWindow = electron.remote.BrowserWindow;

let win = BrowserWindow.getFocusedWindow() || { id: null }

let winId = win.id

console.log("Init renderer module " + winId)

let requestId = name => "request-" + name

var filePath = null,
    title = "Untitled",
    setContent = null,
    getContent = null,
	notifyDocSaved = null

ipcRenderer.on('set-content', function(event, content, callbackChannel) {
  setContent(content.toString());
	if(callbackChannel) ipcRenderer.send(callbackChannel);
});

ipcRenderer.on(requestId('content'), function(event, callbackChannel) {
	ipcRenderer.send(callbackChannel, getContent());
});

ipcRenderer.on('set-filepath', function(event, filePathArg, callbackChannel) {
	filePath = filePathArg
	console.log("set filepath to " + filePath)
	if(callbackChannel) ipcRenderer.send(callbackChannel)
});

ipcRenderer.on('document_saved', function(event, filePathArg, callbackChannel) {
	filePath = filePathArg
	console.log("set filepath to " + filePath)
	
	if (notifyDocSaved) notifyDocSaved(filePath)
	if(callbackChannel) ipcRenderer.send(callbackChannel)	
});


ipcRenderer.on(requestId('filepath'), function(event, callbackChannel) {
	var path = filePath
	if (filePath == null) {
		path = ""
	}
	ipcRenderer.send(callbackChannel, path);
});

// ipcRenderer.on('request-properties', function(event, callbackChannel) {
// 	console.log("requesting properties")
// 	let win = BrowserWindow.getFocusedWindow()
// 	let bounds = win.getBounds()
// 	ipcRenderer.send(callbackChannel, { filePath: filePath, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
// });

console.log(requestId('filepath_content'))
ipcRenderer.on(requestId('filepath_content'), function(event, callbackChannel) {
	
	console.log("requested filepath and content: " + callbackChannel + " " + filePath)
	
	ipcRenderer.send(callbackChannel, { filePath: filePath, content: getContent() });
});



module.exports = {
  setEdited: function(edited) {
	let win = BrowserWindow.getFocusedWindow()
    if (win) {
		console.log("setting doc edited " + edited)
		win.setDocumentEdited(edited)
	}
  },
  setContentSetter: function(fn) {
    setContent = fn
  },
  setContentGetter: function(fn) {
    getContent = fn
  },
  documentSaved: function(fn) {
  	notifyDocSaved = fn
  }
}
