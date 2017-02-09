'use strict';
let _ = require('lodash');
let Task = require('data.task')

let { preferences } = require('./preferences')

let recentFilesKey = "document_recentFiles"
let currentFilesKey = "document_currentFiles"

let clearRecentDocs = () => {
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
	return _.uniqBy(
				_.filter(docs || [], doc => typeof doc === "object" && doc.filePath.length > 0),
			"filePath")
}


let loadRecentDocs = () => {
	return new Task((reject, resolve) => {
		preferences.get(recentFilesKey, (err, docs) => {
			console.log("loaded docs " + JSON.stringify(docs))
			let recents = _.filter(docs, x => x !== null)
			console.log("recents " + JSON.stringify(recents))
			if (err) {
				reject(err)
			}
			else {
				resolve(_.defaultTo(recents, []))
			}
		})		
	})
}

let saveRecentDocs = (docs) => {
	return new Task((reject, resolve) => {
		console.log("saveRecentDocs " + JSON.stringify(docs))
		preferences.set(recentFilesKey, cleanRecentDocs(docs), (err) => {
			if (err) {
				reject(err)
			}
			else {
				resolve()
			}
		})
		
	})
}

let addRecentDoc = (doc) => {
	console.log("add recent doc " + JSON.stringify(doc))	
	
	return loadRecentDocs()
		.map(recents => _.concat(recents, doc))
		.map(cleanRecentDocs)
		.chain(saveRecentDocs)
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
	}).map(docs => _.filter(docs, x => x !== null))
}

let saveCurrentDocs = (properties) => {
	return new Task((reject, resolve) => {
		preferences.set(currentFilesKey, properties, err => {
			if (err) {
				console.error(err)
				reject(err)
			}
			else {
				resolve(properties)
			}
		})
	})
}

module.exports = {
	loadRecentDocs: loadRecentDocs,
	saveRecentDocs: saveRecentDocs,
	addRecentDoc: addRecentDoc,
	loadCurrentDocs: loadCurrentDocs,
	saveCurrentDocs: saveCurrentDocs
}

