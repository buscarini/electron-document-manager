'use strict';
let _ = require('lodash');

let { preferences } = require('./preferences')

let logError = (err) => {
	if (err) {
		console.error(err)
	}
}

let recentFilesKey = "document_recentFiles"
let currentFilesKey = "document_currentFiles"

let clearRecentDocs = (completion) => {
	preferences.set(recentFilesKey, [], (err, data) => {
		completion(err, data)
	})
}

let cleanRecentDocs = docs => {
	return _.uniqBy(
				_.filter(docs || [], doc => typeof doc === "object" && doc.filePath.length > 0),
			"filePath")
}


let loadRecentDocs = (completion) => {
	preferences.get(recentFilesKey, (err, docs) => {
		console.log("loaded docs " + JSON.stringify(docs))
		let recents = _.filter(docs, x => x !== null)
		console.log("recents " + JSON.stringify(recents))
		completion(_.defaultTo(recents, []))
	})
}

let saveRecentDocs = (docs, completion) => {
	console.log("saveRecentDocs " + JSON.stringify(docs))
	preferences.set(recentFilesKey, cleanRecentDocs(docs), (err) => {
		completion(err)
	})
}

let addRecentDoc = (doc, completion) => {
	console.log("add recent doc " + JSON.stringify(doc))

	loadRecentDocs(recents => {
		let newRecents = _.concat(recents, doc)
		saveRecentDocs(newRecents, completion)
	})
}

let loadCurrentDocs = (completion) => {
	console.log("load current docs")
	preferences.get(currentFilesKey, (err, data) => {
		let current = _.filter(data, x => x !== null)
		completion(_.defaultTo(current, []))
	})
}

let saveCurrentDocs = (properties) => {
	preferences.set(currentFilesKey, properties, logError)
}

module.exports = {
	loadRecentDocs: loadRecentDocs,
	saveRecentDocs: saveRecentDocs,
	addRecentDoc: addRecentDoc,
	loadCurrentDocs: loadCurrentDocs,
	saveCurrentDocs: saveCurrentDocs
}



