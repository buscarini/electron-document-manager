"use strict"

const fs = require("fs")
const Task = require("data.task")

const pathIsValid = path => {
	return (typeof path === "string" && path.length > 0)
}

const createDir = path => {
	if (fs.existsSync(path)) {
		return Task.of(path)
	}
	
	return new Task((reject, resolve) => {	
		fs.mkdir(path, err => {
			console.log("finished mkdir " + err)
			if (err) {
				reject(err)
			}
			else {
				resolve(path)
			}
		})
	})
}

const readFile = path => {
	return new Task((reject, resolve) => {
		if (!pathIsValid(path)) {
			reject("Error: invalid path")
			return
		}
		
		fs.readFile(path, function (err, data) {
			if (err) {
				reject(err)
			}
			else {
				resolve(data)
			}
		})
	})
}

const writeFile = content => path => {
	return new Task((reject, resolve) => {
		if (!pathIsValid(path)) {
			reject("no file Path")
			return
		}
		
		if (typeof content !== "string") {
			reject("getContent must return a string")
			return
		}
		
		fs.writeFile(path, content, function (err) {
			if (err) {
				reject(err)
			}
			else {
				resolve({ path, content })
			}
		})
	})
}

const removeFile = (path) => {
	return new Task((reject, resolve) => {
		fs.unlink(path, err => {
			if (err) {
				console.log("Error removing file")
				reject(err)
			}
			else {
				resolve(path)
			}
		})
	})
}

const removeFileIfExists = path => {
	if (!fs.existsSync(path)) {
		return Task.of(path)
	}
	else {
		return removeFile(path)
	}
}

module.exports = {
	createDir,
	readFile,
	writeFile,
	removeFile,
	removeFileIfExists
}
