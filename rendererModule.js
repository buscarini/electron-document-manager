"use strict"

const electron = require("electron")
const ipcRenderer = electron.ipcRenderer
const BrowserWindow = electron.remote.BrowserWindow

const requestId = name => "request-" + name

let filePath = null,
	setContent = null,
	getContent = null,
	notifyDocSaved = null,
	isEdited = false

const updateEdited = edited => {
	// FIXME: We also need to check if the state is empty
	isEdited = edited //blankString(filePath) ? true : edited
	
	const win = BrowserWindow.getFocusedWindow() || electron.remote.getCurrentWindow()
	if (win) {
		console.log("setting document edited to")
		console.log(isEdited)
		win.setDocumentEdited(isEdited)
	}
}

ipcRenderer.on("set-content", function(event, content, callbackChannel) {
	updateEdited(false)
	
	setContent(content.toString())
	if(callbackChannel) ipcRenderer.send(callbackChannel)
})

ipcRenderer.on(requestId("content"), function(event, callbackChannel) {
	ipcRenderer.send(callbackChannel, getContent())
})

ipcRenderer.on("set-filepath", function(event, filePathArg, callbackChannel) {
	filePath = filePathArg
	if(callbackChannel) ipcRenderer.send(callbackChannel)
})

ipcRenderer.on("document_saved", function(event, filePathArg, callbackChannel) {
	filePath = filePathArg
	
	if (notifyDocSaved) notifyDocSaved(filePath)
	if(callbackChannel) ipcRenderer.send(callbackChannel)	
})


ipcRenderer.on(requestId("filepath"), function(event, callbackChannel) {
	let path = filePath
	if (filePath == null) {
		path = ""
	}
	ipcRenderer.send(callbackChannel, path)
})

ipcRenderer.on(requestId("filepath_content"), function(event, callbackChannel) {	
	ipcRenderer.send(callbackChannel, { filePath: filePath, content: getContent() })
})

ipcRenderer.on(requestId("is_edited"), function(event, callbackChannel) {	
	ipcRenderer.send(callbackChannel, isEdited)
})

ipcRenderer.on("set_edited", function(event, edited, callbackChannel) {
	console.log("set edited to: ")
	console.log(edited)
	
	updateEdited(edited)
	if(callbackChannel) ipcRenderer.send(callbackChannel)
})


module.exports = {
	setEdited: updateEdited,
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
