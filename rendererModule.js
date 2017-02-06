'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const BrowserWindow = electron.remote.BrowserWindow;

let win = BrowserWindow.getFocusedWindow() || { id: null }

let winId = win.id

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
	if(callbackChannel) ipcRenderer.send(callbackChannel)
});

ipcRenderer.on('document_saved', function(event, filePathArg, callbackChannel) {
	filePath = filePathArg
	
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

ipcRenderer.on(requestId('filepath_content'), function(event, callbackChannel) {	
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
