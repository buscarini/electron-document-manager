"use strict"

const R = require("ramda")

const { idLens, filePathLens, winLens } = require("./document")

let documents = []

const getDocuments = () => documents

const getWindows = R.map(R.view(winLens), documents)

const getDocument = (id) => {
	return R.find(R.propEq("id", id), documents)
}

const getWindowDocument = (win) => {
	const id = R.view(idLens, win)
	return getDocument(id)
}

const addDocument = doc => {
	documents.push(doc)
}

const removeDocument = id => {
	documents = R.filter(doc => R.view(idLens, doc) !== id, documents)
}

const updateDocumentPath = id => path => {
	documents = R.map(doc => R.view(idLens, doc) === id ? R.set(filePathLens, path, doc) : doc, documents)
}

module.exports = {
	getDocuments,
	getWindows,
	addDocument,
	getDocument,
	removeDocument,
	getWindowDocument,
	updateDocumentPath
}
