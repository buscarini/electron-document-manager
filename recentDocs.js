'use strict';
let _ = require('lodash');
let Task = require('data.task')

let electron = require('electron')
let app = electron.app

let { preferences } = require('./preferences')

let recentFilesKey = "document_recentFiles"
let currentFilesKey = "document_currentFiles"

let clearRecentDocs = () => {
	
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

let cleanRecentDocs = docs => {
	return _.defaultTo(
				_.uniqBy(
					_.filter(docs || [], doc => typeof doc === "object" && typeof doc.filePath === 'string' && doc.filePath.length > 0),
				"filePath")
			, [])
}


let loadRecentDocs = () => {
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

let saveRecentDocs = (docs) => {
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

let addRecentDoc = (doc) => {
	try {
		console.log("add recent doc " + JSON.stringify(doc))
	}
	catch(err) {
		require('util').inspect(doc)
	}
	
	let path = _.get(doc, "filePath", null)
	if (path) app.addRecentDocument(path)
	
	return loadRecentDocs()
		.map(recents => _.concat(recents, doc))
		.map(cleanRecentDocs)
		.chain(saveRecentDocs)
		.map(docs => doc)
}

let cleanCurrentDocs = docs => {
	return _.defaultTo(
				_.uniqBy(
					_.filter(_.defaultTo(docs, []), doc => typeof doc === "object" && typeof Number.isInteger(doc.id) && doc.id > 0),
				"filePath")
			, [])
}

let loadCurrentDocs = () => {
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

let saveCurrentDocs = (docs) => {
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

let updateCurrentDoc = doc => {
	try {
		console.log("update current doc " + JSON.stringify(doc))	
	}
	catch(err) {
		require('util').inspect(doc)
	}
	
	return loadCurrentDocs()
		.map(docs => {
			console.log("loaded current docs: " + JSON.stringify(docs))
			return docs
		})
		.map(savedDocs => {
			
			let index = _.findIndex(savedDocs, saved => saved.id === doc)
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
	loadRecentDocs: loadRecentDocs,
	saveRecentDocs: saveRecentDocs,
	addRecentDoc: addRecentDoc,
	loadCurrentDocs: loadCurrentDocs,
	saveCurrentDocs: saveCurrentDocs,
	updateCurrentDoc: updateCurrentDoc
}

