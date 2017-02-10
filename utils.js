const path = require("path")
const Task = require("data.task")
const fs = require("fs")

const removeExt = filePath => filePath.substr(0, filePath.lastIndexOf("."))
const windowTitle = filePath => removeExt(path.basename(filePath))
const id = x => x
const runTaskF = (task) => () => task.fork(id, id)
const runTask = (task) => runTaskF(task)()
const readFileTask = path => {
	return new Task((reject, resolve) => {
		if (typeof path !== "string" || path.length === 0) {
			reject("Invalid path: " + path)
			return
		}
		
		fs.readFile(path, function(err, contents) {
			if (err) {
				reject(err)
			}
			else {
				resolve(contents)
			}
		})		
	})
}

module.exports = {
	removeExt,
	windowTitle,
	id,
	runTaskF,
	runTask,
	readFileTask
}

