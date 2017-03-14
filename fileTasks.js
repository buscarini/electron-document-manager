"use strict"

const fs = require("fs")
const Task = require("data.task")

const pathIsValid = path => {
	return (typeof path === "string" && path.length > 0)
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

const writeFile = (path, content) => {
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
				resolve(path)
			}
		})
	})
}

module.exports = {
	readFile: readFile,
	writeFile: writeFile
}
