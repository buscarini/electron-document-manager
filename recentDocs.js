"use strict"
const _ = require("lodash")
const Task = require("data.task")

const electron = require("electron")
const app = electron.app

const { preferences } = require("./preferences")

const recentFilesKey = "document_recentFiles"
const currentFilesKey = "document_currentFiles"

const clearRecentDocs = () => {
	
	app.clearRecentDocuments()
	
	return new Task((reject, resolve) => {
		preferences.set(recentFilesKey, [], (err, data) => {
			if (err) {
				reject(err)
			}
			else {
				resolve(data)
			}
		})			
	})
	
}

const cleanRecentDocs = docs => {
	return _.defaultTo(
				_.uniqBy(
					_.filter(docs || [], doc => typeof doc === "object" && typeof doc.filePath === "string" && doc.filePath.length > 0),
				"filePath")
			, [])
}


const loadRecentDocs = () => {
	return new Task((reject, resolve) => {
		preferences.get(recentFilesKey, (err, docs) => {
			if (err) {
				reject(err)
			}
			else {
				resolve(_.defaultTo(docs, []))
			}
		})		
	})
	.map(cleanRecentDocs)
}

const saveRecentDocs = (docs) => {
	return Task.of(cleanRecentDocs(docs))
			.chain(docs => {
				return new Task((reject, resolve) => {
					preferences.set(recentFilesKey, docs, (err) => {
						if (err) {
							reject(err)
						}
						else {
							resolve(docs)
						}
					})
		
				})
			})
}

const addRecentDoc = (doc) => {
	try {
		console.log("add recent doc " + JSON.stringify(doc))
	}
	catch(err) {
		require("util").inspect(doc)
	}
	
	const path = _.get(doc, "filePath", null)
	if (path) app.addRecentDocument(path)
	
	return loadRecentDocs()
		.map(recents => _.concat(recents, doc))
		.map(cleanRecentDocs)
		.chain(saveRecentDocs)
		.map(docs => doc)
}

const cleanCurrentDocs = docs => {
	return _.defaultTo(
				_.uniqBy(
					_.filter(_.defaultTo(docs, []), doc => typeof doc === "object" && typeof Number.isInteger(doc.id) && doc.id > 0),
				"id")
			, [])
}

const loadCurrentDocs = () => {
	console.log("load current docs")
	return new Task((reject, resolve) => {
		preferences.get(currentFilesKey, (err, current) => {
			if (err) {
				reject(err)
			}
			else {
				resolve(_.defaultTo(current, []))
			}
		})		
	})
	.map(cleanCurrentDocs)
}

const saveCurrentDocs = (docs) => {
	console.log("save current docs " + JSON.stringify(docs))
	
	return Task.of(cleanCurrentDocs(docs))
				.chain(docs => {
					return new Task((reject, resolve) => {
						preferences.set(currentFilesKey, docs, err => {
							if (err) {
								console.error("Error saving current docs: " + err)
								reject(err)
							}
							else {
								console.log("saved current docs " + JSON.stringify(docs))
								resolve(docs)
							}
						})
					})
				})
}

const updateCurrentDoc = doc => {
	try {
		console.log("update current doc " + JSON.stringify(doc))	
	}
	catch(err) {
		require("util").inspect(doc)
	}
	
	return loadCurrentDocs()
		.map(docs => {
			console.log("loaded current docs: " + JSON.stringify(docs))
			return docs
		})
		.map(savedDocs => {
			
			const index = _.findIndex(savedDocs, saved => saved.id === doc)
			if (index === -1) {
				return _.concat(savedDocs, doc)
			}
			
			return _.map(savedDocs, saved => {
				return (saved.id === doc.id) ? doc : saved
			})
		})
		.chain(saveCurrentDocs)
}

module.exports = {
	loadRecentDocs,
	saveRecentDocs,
	addRecentDoc,
	clearRecentDocs,
	loadCurrentDocs,
	saveCurrentDocs,
	updateCurrentDoc
}

