"use strict"

const _ = require("lodash")
const Task = require("data.task")
const R = require("ramda")
const electron = require("electron")
const app = electron.app

const fs = require("fs")

const { preferences } = require("./preferences")
const { blankString } = require("./utils")
const { Doc, winLens } = require("./document")

const recentFilesKey = "document_recentFiles"
const currentFilesKey = "document_currentFiles"

const filePathLens = R.lensProp("filePath")

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

const requireArray = items => R.is(Array, items) ? items : []
const requireFilePath = items => R.filter(doc => doc && R.is(Object, doc) && R.is(String, doc.filePath) && doc.filePath.length > 0, items)

const uniqueFilePath = R.pipe(
						R.uniqBy(item => item.filePath),
						R.defaultTo([])
					)

const requireId = items => _.filter(items || [], doc => typeof doc === "object" && Number.isInteger(doc.id) && doc.id > 0)

const uniqueId = R.pipe(
						R.groupBy(item => item.id.toString()),
						R.mapObjIndexed((items, id, obj) => R.reduce((acc, item) => {
								return acc === null ? item : (
									blankString(acc.filePath) ? item : acc
								)
							}, null)(items)
						),
						R.values,
						R.reject(R.isNil),
						R.defaultTo([])
					)

const removeNotExisting = R.filter(doc => R.is(String, doc.filePath) && fs.exists(doc.filePath))

const cleanRecentDocs = R.pipe(
							requireArray,
							R.reject(R.isNil),
							requireFilePath,
							uniqueFilePath,
							removeNotExisting,
							R.map(R.set(winLens, null))
						)

const cleanCurrentDocs = R.pipe(
		requireArray,
		R.reject(R.isNil),
		uniqueFilePath,
		requireId,
		uniqueId,
		R.map(R.set(winLens, null))
	)

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

	const path = R.view(filePathLens, doc)
	if (path) app.addRecentDocument(path)
	
	return loadRecentDocs()
		.map(recents => _.concat(recents, doc))
		.map(cleanRecentDocs)
		.chain(saveRecentDocs)
		.map(docs => doc)
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
	return Task.of(cleanCurrentDocs(docs))
				.chain(docs => {				
					console.log("save current docs " + JSON.stringify(docs))
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

const checkRecentDocument = path => {
	if (fs.exists(path)) {
		return Task.empty()
	}
	
	return loadCurrentDocs
		.chain(saveCurrentDocs)
}

const recentDocument = (win, path) => {
	return Doc(win, path)
}

module.exports = {
	loadRecentDocs,
	saveRecentDocs,
	addRecentDoc,
	cleanRecentDocs,
	clearRecentDocs,
	loadCurrentDocs,
	saveCurrentDocs,
	updateCurrentDoc,
	checkRecentDocument,
	recentDocument
}

