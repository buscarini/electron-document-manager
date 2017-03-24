const electron = require("electron")

const path = require("path")
const Task = require("data.task")
const R = require("ramda")
const { Conjunction, mconcat } = require("fantasy-monoids")


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

const isBasePath = basePath => path => {
	const baseComponents = basePath.split(path.sep)
	const pathComponents = path.split(path.sep)
	
	const xLens = R.lensProp('x')
	
	return R.pipe(
		R.zip(baseComponents),
		R.map((basePart, part) => Conjunction(R.equals(basePart, part))),
		mconcat,
		R.view(xLens)
	)(pathComponents)
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
	
	isBasePath,
	baseTemporalPath,
	temporalPath,
	
	checkNotNull,
	emptyString,
	blankString
}

