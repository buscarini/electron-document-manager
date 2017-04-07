const electron = require("electron")
const dialog = electron.dialog
const _ = require("lodash")
const Task = require("data.task")

const showMessageBox = (message, buttonTasks, type) => {
	return new Task((reject, resolve) => {
		dialog.showMessageBox({
			type: "question",
			buttons: _.map(buttonTasks, task => task.name),
			message: message
		}, resolve)
	})
	.chain(button => {
		console.log("button pressed: " + JSON.stringify(button))
		return buttonTasks[button].task
	})
}

const saveDialog = filters => {
	return new Task((reject, resolve) => {
		dialog.showSaveDialog({ filters: filters }, filePath => {
			if (filePath) {
				resolve(filePath)
			}
			else {
				reject("User cancelled")
			}
		})
	})
}

const ask = (message, buttonTasks) => {
	return showMessageBox(message, buttonTasks, "question")
}

const info = (message, buttonTasks) => {
	return showMessageBox(message, buttonTasks, "info")
}

const error = (message, buttonTasks) => {
	return showMessageBox(message, buttonTasks, "error")
}

module.exports = {
	showMessageBox,
	ask,
	saveDialog,
	info,
	error
}
