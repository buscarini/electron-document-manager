const electron = require("electron")
const ipcMain = electron.ipcMain

const requestId = variable => "request-" + variable
const returnId = (variable, win) => "return-" + variable + "-" + win.id

function requestFromRenderer(win, variable, callback) {
	const id = returnId(variable, win)
	
	win.webContents.send(requestId(variable), id)

	// FIXME: If multiple requests are made to multiple windows, only the last one will be received and they will be mangled -> Pass the win id, and check in the callback against the window id -> Seems fixed, but we need to check

	//remove all listeners, because otherwise we"ll start calling old callbacks
	// ipcMain.removeAllListeners(id)
	ipcMain.once(id, callback)
}

module.exports = {
	requestFromRenderer: requestFromRenderer
}
