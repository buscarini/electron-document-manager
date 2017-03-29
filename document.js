"use strict"

const uuid = require("uuid/v4")
const R = require("ramda")

const winLens = R.lensProp("window")
const idLens = R.lensProp("id")
const guidLens = R.lensProp("guid")
const filePathLens = R.lensProp("filePath")

const Doc = (win, path, guid) => {
	
	const defaultBounds = { x: 0, y: 0, width: 800, height: 600 }
	
	const id = R.view(idLens, win)
	const bounds = win.getBounds ? win.getBounds() : defaultBounds
	
	return {
		window: win,
		id: id,
		guid: R.defaultTo(uuid(), guid),
		filePath: path,
		x: bounds.x,
		y: bounds.y,
		width: bounds.width,
		height: bounds.height
	}
}

module.exports = {
	Doc,
	
	winLens,
	idLens,
	guidLens,
	filePathLens
}
