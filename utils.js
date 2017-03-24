const electron = require("electron")

const path = require("path")
const Task = require("data.task")
const R = require("ramda")


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

const baseTemporalPath = () => path.join(electron.app.getPath("userData"), "currentDocs")
const temporalPath = id => path.join(baseTemporalPath(), id.toString())

const emptyString = string => string === null || string === undefined || string.length === 0
const blankString = string => (R.is(String, string) && emptyString(R.trim(string))) || emptyString(string)

module.exports = {
	removeExt,
	windowTitle,
	id,
	runTaskF,
	runTask,
	
	baseTemporalPath,
	temporalPath,
	
	checkNotNull,
	emptyString,
	blankString
}

