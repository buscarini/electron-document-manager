const path = require('path')
const Task = require('data.task')
const fs = require("fs")

let removeExt = filePath => filePath.substr(0, filePath.lastIndexOf('.'))
let windowTitle = filePath => removeExt(path.basename(filePath))
let id = x => x
let runTaskF = (task) => () => task.fork(id, id)
let runTask = (task) => runTaskF(task)()
let readFileTask = path => {
	return new Task((reject, resolve) => {
		if (typeof path !== 'string' || path.length === 0) {
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

