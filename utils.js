const path = require("path")
const Task = require("data.task")

const removeExt = filePath => filePath.substr(0, filePath.lastIndexOf("."))
const windowTitle = filePath => removeExt(path.basename(filePath))
const id = x => x
const runTaskF = (task) => () => task.fork(id, id)
const runTask = (task) => runTaskF(task)()

const checkNotNull = something => {
	return new Task((reject, resolve) => {
		if (something) {
			resolve(something)
		}
		else {
			reject("Error")
		}
	})
}

module.exports = {
	removeExt,
	windowTitle,
	id,
	runTaskF,
	runTask,
	checkNotNull
}

